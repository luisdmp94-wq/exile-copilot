import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import {
  ExportBuildRequestSchema,
  ImportBuildRequestSchema,
  ImportItemTextRequestSchema,
  RecommendationsRequestSchema,
  SaveCharacterRequestSchema,
  type ApiError,
} from "../shared/api.js";
import { loadConfig, type ServerConfig } from "./config.js";
import { createDatabase } from "./db/database.js";
import { getCharacter, saveCharacter } from "./db/repositories.js";
import { importBuild } from "./importers/buildFileImporter.js";
import { parseItemText } from "./importers/itemTextParser.js";
import { PoeNinjaClient, PriceService } from "./services/poeninja.js";
import { generateRecommendations } from "./engine/engine.js";
import { getExplainer } from "./explainers/index.js";
import { exportBuild } from "./exporters/buildFileExporter.js";
import { ApiHttpError } from "./errors.js";

/**
 * Crea la app Express de la API. Las rutas se definen SIN prefijo: el caller
 * las monta donde corresponda (`/api` en server/index.ts).
 *
 * Nota: los imports de `shared/` son relativos con extensión `.js` (estilo ESM),
 * compatibles con tsc (moduleResolution bundler), vitest y tsx.
 */

export interface CreateApiAppOptions {
  /** ":memory:" para tests. */
  dbPath?: string;
  /** Overrides de configuración (p. ej. { poeNinjaOffline: true } en tests). */
  config?: Partial<ServerConfig>;
  /** Fetch inyectable para tests del cliente poe.ninja. */
  fetchImpl?: ConstructorParameters<typeof PoeNinjaClient>[0]["fetchImpl"];
}

function demoFixturePath(): string {
  return fileURLToPath(new URL("./fixtures/demoBuild.build.json", import.meta.url));
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const config: ServerConfig = { ...loadConfig(), ...(options.config ?? {}) };
  const db = createDatabase(options.dbPath ?? config.databasePath);
  const ninjaClient = new PoeNinjaClient({ db, config, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
  const priceService = new PriceService(ninjaClient);
  const explainer = getExplainer(config);

  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Cabeceras mínimas de seguridad (mismo origen vía proxy; CORS no necesario).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // GET /health
  app.get("/health", (_req, res) => {
    res.json({ ok: true, patch: config.defaultPatch, dataUpdatedAt: new Date().toISOString() });
  });

  // GET /meta — ligas reales desde poe.ninja (endpoint documentado /economy/leagues),
  // con fallback degradado a fixture si no hay red.
  app.get("/meta", async (_req, res, next) => {
    try {
      const { leagues } = await ninjaClient.getLeagues();
      const leagueIds = leagues.map((l) => l.id);
      if (!leagueIds.includes("Standard")) leagueIds.push("Standard");
      res.json({
        leagues: leagueIds,
        patches: [
          { id: "0.5.0", label: "PoE2 0.5.0 (actual)" },
          { id: "0.3.0", label: "PoE2 0.3.0" },
        ],
        goals: ["damage", "survival", "mapping", "bossing", "balanced"],
        currencies: ["chaos", "exalted", "divine", "gold"],
        archetypes: [{ id: "mercenary-crossbow", label: "Mercenario con ballesta (Gemling)" }],
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /import/build
  app.post("/import/build", (req, res, next) => {
    try {
      const { content } = ImportBuildRequestSchema.parse(req.body);
      res.json(importBuild(content));
    } catch (err) {
      next(err);
    }
  });

  // POST /import/item-text
  app.post("/import/item-text", (req, res, next) => {
    try {
      const { text } = ImportItemTextRequestSchema.parse(req.body);
      res.json(parseItemText(text));
    } catch (err) {
      next(err);
    }
  });

  // POST /character — persiste el perfil normalizado
  app.post("/character", (req, res, next) => {
    try {
      const { profile } = SaveCharacterRequestSchema.parse(req.body);
      saveCharacter(db, profile.id, JSON.stringify(profile));
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  // GET /character/demo — perfil de demostración precargado (antes de /:id)
  app.get("/character/demo", (_req, res, next) => {
    try {
      const content = readFileSync(demoFixturePath(), "utf8");
      const { profile } = importBuild(content);
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  });

  // GET /character/:id — recupera un perfil guardado
  app.get("/character/:id", (req, res, next) => {
    try {
      const row = getCharacter(db, req.params.id);
      if (!row) throw new ApiHttpError(404, "personaje-no-encontrado", `No existe un personaje con id "${req.params.id}".`);
      res.json({ profile: JSON.parse(row.payload) });
    } catch (err) {
      next(err);
    }
  });

  // GET /market/prices?league=&names=a,b,c
  app.get("/market/prices", async (req, res, next) => {
    try {
      const league = typeof req.query.league === "string" && req.query.league.length > 0
        ? req.query.league
        : config.defaultLeague;
      const namesParam = typeof req.query.names === "string" ? req.query.names : "";
      const names = namesParam.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      if (names.length === 0) {
        throw new ApiHttpError(400, "parametro-names-requerido", "Pasa ?names=a,b,c con al menos un nombre.");
      }
      res.json(await priceService.getQuotes(names, league));
    } catch (err) {
      next(err);
    }
  });

  // POST /recommendations
  app.post("/recommendations", async (req, res, next) => {
    try {
      const body = RecommendationsRequestSchema.parse(req.body);
      const result = await generateRecommendations(
        body.profile,
        {
          budget: body.budget,
          goal: body.goal,
          league: body.league,
          patch: body.patch,
        },
        { priceService },
      );

      // El motor no depende del explainer: enriquecemos `reason` aquí.
      const recommendations = await Promise.all(
        result.recommendations.map(async (rec) => ({
          ...rec,
          reason: await explainer.explain(rec, {
            budgetText: `${body.budget.amount} ${body.budget.currency}`,
            goalKind: body.goal.kind,
          }),
        })),
      );
      res.json({ ...result, recommendations });
    } catch (err) {
      next(err);
    }
  });

  // POST /export/build — descarga .build (JSON versionado)
  app.post("/export/build", (req, res, next) => {
    try {
      const { profile, appliedRecommendations } = ExportBuildRequestSchema.parse(req.body);
      const content = exportBuild(profile, appliedRecommendations ?? []);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="exile-copilot.build.json"');
      res.send(content);
    } catch (err) {
      next(err);
    }
  });

  // 404 para rutas no definidas
  app.use((_req, res) => {
    const body: ApiError = { error: "ruta-no-encontrada", detail: "La ruta solicitada no existe en la API." };
    res.status(404).json(body);
  });

  // Manejador central de errores → ApiError JSON
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiHttpError) {
      const body: ApiError = { error: err.message };
      if (err.detail !== undefined) body.detail = err.detail;
      res.status(err.statusCode).json(body);
      return;
    }
    if (err instanceof ZodError) {
      const body: ApiError = {
        error: "validacion-fallida",
        detail: err.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; "),
      };
      res.status(400).json(body);
      return;
    }
    console.error("[api] error inesperado:", err);
    const body: ApiError = { error: "error-interno", detail: err instanceof Error ? err.message : String(err) };
    res.status(500).json(body);
  });

  return app;
}
