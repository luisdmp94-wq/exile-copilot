import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import {
  ExportBuildRequestSchema,
  CreateJournalEntryRequestSchema,
  ImportBuildRequestSchema,
  ImportItemTextRequestSchema,
  RecommendationsRequestSchema,
  SaveCharacterRequestSchema,
  UpdateJournalEntryRequestSchema,
  type ApiError,
} from "../shared/api.js";
import {
  CharacterProfileSchema,
  JournalEntrySchema,
  PatchVersionSchema,
  type CharacterJournal,
  type JournalEntry,
  type PatchVersion,
} from "../shared/domain.js";
import { buildRecommendationMemory } from "../shared/journalMemory.js";
import { loadConfig, type ServerConfig } from "./config.js";
import { createDatabase } from "./db/database.js";
import {
  getCharacter,
  getJournalEntry,
  getJournalPrimaryEntryId,
  listJournalEntries,
  saveCharacter,
  saveJournalEntry,
  setJournalPrimaryEntryId,
} from "./db/repositories.js";
import { importBuild } from "./importers/buildImporter.js";
import { parseItemText } from "./importers/itemTextParser.js";
import { PoeNinjaClient, PriceService } from "./services/poeninja.js";
import { generateRecommendations } from "./engine/engine.js";
import { getExplainer } from "./explainers/index.js";
import { exportGggBuild } from "./exporters/gggBuildExporter.js";
import { ApiHttpError } from "./errors.js";
import { resolvePlan } from "./registry/passiveRegistry.js";

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

function fixtureUrl(rel: string): URL {
  return new URL(`./fixtures/${rel}`, import.meta.url);
}

/** Parches versionados en server/data/patches.json (fuente y fecha, sin "actual" hardcodeado). */
function loadPatches(): PatchVersion[] {
  const raw = readFileSync(fileURLToPath(new URL("./data/patches.json", import.meta.url)), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((p) => PatchVersionSchema.parse(p));
}

function readJournal(db: ReturnType<typeof createDatabase>, characterId: string): CharacterJournal {
  const entries = listJournalEntries(db, characterId).map((row) =>
    JournalEntrySchema.parse(JSON.parse(row.payload)),
  );
  const storedPrimaryId = getJournalPrimaryEntryId(db, characterId);
  const primaryEntry =
    entries.find(
      (entry) =>
        entry.id === storedPrimaryId &&
        (entry.status === "active" || entry.status === "waiting_result"),
    ) ?? null;

  // Un id obsoleto nunca se presenta como acción activa. La lectura no repara
  // ni muta el estado: las transiciones de escritura mantienen la referencia.
  const primaryEntryId = primaryEntry?.id ?? null;
  return { characterId, primaryEntryId, primaryEntry, entries };
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const config: ServerConfig = { ...loadConfig(), ...(options.config ?? {}) };
  const db = createDatabase(options.dbPath ?? config.databasePath);
  const ninjaClient = new PoeNinjaClient({ db, config, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
  const priceService = new PriceService(ninjaClient);
  const explainer = getExplainer(config);
  const patches = loadPatches();

  const importDefaults = { league: config.defaultLeague, patch: config.defaultPatch };

  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Cabeceras mínimas de seguridad (mismo origen vía proxy; CORS no necesario).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // GET /health — patch como objeto {content, hotfix, asOf, source}
  app.get("/health", (_req, res) => {
    const current =
      patches.find((p) => p.id === config.defaultPatch) ?? patches[0];
    res.json({
      ok: true,
      patch: {
        content: current?.content ?? current?.id ?? config.defaultPatch,
        hotfix: current?.hotfix ?? null,
        asOf: current?.asOf ?? "desconocida",
        source: current?.source ?? "desconocida",
      },
      dataUpdatedAt: new Date().toISOString(),
    });
  });

  // GET /meta — ligas reales desde poe.ninja (endpoint documentado /economy/leagues),
  // con fallback degradado a fixture si no hay red. Parches desde datos versionados.
  app.get("/meta", async (_req, res, next) => {
    try {
      const { leagues } = await ninjaClient.getLeagues();
      const leagueIds = leagues.map((l) => l.id);
      if (!leagueIds.includes("Standard")) leagueIds.push("Standard");
      res.json({
        leagues: leagueIds,
        patches,
        goals: ["damage", "survival", "mapping", "bossing", "balanced"],
        currencies: ["chaos", "exalted", "divine", "gold"],
        archetypes: [{ id: "mercenary-crossbow", label: "Mercenario con ballesta (Gemling)" }],
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /import/build — detecta .build oficial (GGG Build Planner v1) o código PoB
  app.post("/import/build", (req, res, next) => {
    try {
      const { content } = ImportBuildRequestSchema.parse(req.body);
      const result = importBuild(content, importDefaults);
      // Un plan oficial viaja con la resolución de sus ids contra el registro
      // de GGG. La resolución es PARALELA: el `.build` crudo no se toca.
      if (result.plan !== undefined) {
        res.json({ ...result, resolution: resolvePlan(result.plan.build) });
        return;
      }
      res.json(result);
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

  // GET /character/demo — snapshot interno de demostración precargado
  app.get("/character/demo", (_req, res, next) => {
    try {
      const raw = readFileSync(fileURLToPath(fixtureUrl("demoSnapshot.json")), "utf8");
      const profile = CharacterProfileSchema.parse(JSON.parse(raw));
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

  // GET /journal/:characterId — memoria persistente y única próxima acción.
  app.get("/journal/:characterId", (req, res, next) => {
    try {
      res.json(readJournal(db, req.params.characterId));
    } catch (err) {
      next(err);
    }
  });

  // POST /journal/:characterId/entries — registra una decisión, experimento,
  // craft, hito o nota. Registrar no significa que el jugador ya lo ejecutó.
  app.post("/journal/:characterId/entries", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = CreateJournalEntryRequestSchema.parse(req.body);
      const now = new Date().toISOString();
      const entry: JournalEntry = JournalEntrySchema.parse({
        id: randomUUID(),
        characterId,
        kind: input.kind,
        status: "active",
        title: input.title,
        summary: input.summary,
        nextAction: input.nextAction,
        result: null,
        relatedItemIds: input.relatedItemIds,
        sources: input.sources,
        context: input.context,
        recommendationSnapshot: input.recommendationSnapshot,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      });
      saveJournalEntry(db, {
        id: entry.id,
        characterId,
        payload: JSON.stringify(entry),
        createdAt: now,
        updatedAt: now,
      });
      if (input.makePrimary) setJournalPrimaryEntryId(db, characterId, entry.id);
      res.status(201).json({ journal: readJournal(db, characterId), entry });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /journal/:characterId/entries/:entryId — actualiza el estado cuando
  // el jugador informa del resultado. No existe DELETE en este hito: la memoria
  // se completa o cancela, no desaparece silenciosamente.
  app.patch("/journal/:characterId/entries/:entryId", (req, res, next) => {
    try {
      const { characterId, entryId } = req.params;
      const input = UpdateJournalEntryRequestSchema.parse(req.body);
      const row = getJournalEntry(db, entryId);
      if (!row || row.character_id !== characterId) {
        throw new ApiHttpError(
          404,
          "entrada-diario-no-encontrada",
          `No existe la entrada "${entryId}" para este personaje.`,
        );
      }
      const previous = JournalEntrySchema.parse(JSON.parse(row.payload));
      const now = new Date().toISOString();
      const status = input.status ?? previous.status;
      const resolved = status === "completed" || status === "cancelled";
      const entry = JournalEntrySchema.parse({
        ...previous,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
        ...(input.result !== undefined ? { result: input.result } : {}),
        status,
        updatedAt: now,
        resolvedAt: resolved ? previous.resolvedAt ?? now : null,
      });
      if (entry.status === "waiting_result" && entry.nextAction === null) {
        throw new ApiHttpError(
          400,
          "proxima-accion-requerida",
          "No se puede esperar el resultado de una entrada sin acción concreta.",
        );
      }
      if (entry.status === "completed" && entry.result === null) {
        throw new ApiHttpError(
          400,
          "resultado-requerido",
          "Una entrada solo se completa cuando el jugador informa del resultado.",
        );
      }
      if (input.makePrimary === true && (entry.nextAction === null || resolved)) {
        throw new ApiHttpError(
          400,
          "proxima-accion-requerida",
          "La próxima acción principal debe estar activa y contener una acción concreta.",
        );
      }
      saveJournalEntry(db, {
        id: entry.id,
        characterId,
        payload: JSON.stringify(entry),
        createdAt: entry.createdAt,
        updatedAt: now,
      });

      const currentPrimary = getJournalPrimaryEntryId(db, characterId);
      if (resolved && currentPrimary === entry.id) {
        setJournalPrimaryEntryId(db, characterId, null);
      } else if (input.makePrimary === true) {
        setJournalPrimaryEntryId(db, characterId, entry.id);
      } else if (input.makePrimary === false && currentPrimary === entry.id) {
        setJournalPrimaryEntryId(db, characterId, null);
      }
      res.json({ journal: readJournal(db, characterId), entry });
    } catch (err) {
      next(err);
    }
  });

  // GET /market/prices?league=&names=a,b,c — incluye primaryCurrency y rates
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

  // POST /recommendations — incluye inputFingerprint; target opcional influye en las reglas
  app.post("/recommendations", async (req, res, next) => {
    try {
      const body = RecommendationsRequestSchema.parse(req.body);
      const memory = buildRecommendationMemory(readJournal(db, body.profile.id));
      if (
        body.journalRevision !== undefined &&
        body.journalRevision !== null &&
        body.journalRevision !== memory.revision
      ) {
        throw new ApiHttpError(
          409,
          "memoria-diario-obsoleta",
          "La memoria del personaje cambió. Recárgala antes de generar otra decisión.",
        );
      }
      const result = await generateRecommendations(
        body.profile,
        {
          budget: body.budget,
          goal: body.goal,
          league: body.league,
          patch: body.patch,
          memory,
          ...(body.target !== undefined ? { target: body.target } : {}),
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

  // POST /export/build — archivo .build oficial (GGG Build Planner v1) como JSON:
  // { fileName (".build"), content (string JSON), report (ExportReport) }
  app.post("/export/build", (req, res, next) => {
    try {
      const { profile, target, appliedRecommendations } = ExportBuildRequestSchema.parse(req.body);
      res.json(exportGggBuild(profile, target, appliedRecommendations ?? []));
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
