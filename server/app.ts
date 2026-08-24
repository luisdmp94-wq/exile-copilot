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
  StartDecisionSessionRequestSchema,
  AddSessionConstraintRequestSchema,
  ReleaseSessionConstraintRequestSchema,
  AddSessionEvidenceRequestSchema,
  RecordSessionResultRequestSchema,
  PauseSessionRequestSchema,
  AbandonSessionRequestSchema,
  ReopenSessionRequestSchema,
  ReconcileSessionRequestSchema,
  CreateBuildMemoryEntryRequestSchema,
  UpdateBuildMemoryEntryRequestSchema,
  type ApiError,
  CraftingKnowledgeResponseSchema,
} from "../shared/api.js";
import {
  CharacterProfileSchema,
  BuildMemoryEntrySchema,
  JournalEntrySchema,
  PatchVersionSchema,
  type JournalEntry,
  type BuildMemoryEntry,
  type CharacterProfile,
  type PatchVersion,
} from "../shared/domain.js";
import { buildRecommendationMemory } from "../shared/journalMemory.js";
import { loadConfig, type ServerConfig } from "./config.js";
import { createDatabase, withTransaction } from "./db/database.js";
import {
  getCharacter,
  getJournalEntry,
  getBuildMemoryEntry,
  getJournalPrimaryEntryId,
  listCompletedRecommendationJournalEntries,
  listBuildMemoryEntries,
  saveCharacter,
  saveJournalEntry,
  saveBuildMemoryEntry,
  setJournalPrimaryEntryId,
} from "./db/repositories.js";
import {
  addSessionConstraint,
  releaseSessionConstraint,
  addSessionEvidence,
  assertRevision,
  pauseSession,
  abandonSession,
  readJournalBundle,
  recordSessionResult,
  reconcileSession,
  reopenSession,
  startDecisionSession,
} from "./decision/sessionService.js";
import { sessionIsOpen } from "../shared/decisionSession.js";
import { importBuild } from "./importers/buildImporter.js";
import { parseItemText } from "./importers/itemTextParser.js";
import { PoeNinjaClient, PriceService } from "./services/poeninja.js";
import { generateRecommendations } from "./engine/engine.js";
import { getExplainer, type ExplainerProvider } from "./explainers/index.js";
import { exportGggBuild } from "./exporters/gggBuildExporter.js";
import { MentorQueryRequestSchema } from "../shared/mentorQuery.js";
import { answerMentorQuery } from "./mentor/mentorService.js";
import {
  createMentorDecisionSelector,
  type MentorDecisionSelector,
} from "./mentor/mentorAi.js";
import { ApiHttpError } from "./errors.js";
import { resolvePlan } from "./registry/passiveRegistry.js";
import {
  loadCraftingKnowledge,
  listObservedActions,
  queryModCandidates,
} from "./crafting/knowledgeRegistry.js";
import { OBSERVED_CRAFTING_ACTIONS } from "../shared/craftingActions.js";

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
  /** Explainer inyectable para comprobar carreras sin usar servicios externos. */
  explainer?: ExplainerProvider;
  /** Selector IA inyectable; `null` fuerza reglas incluso si la flag está activa. */
  mentorSelector?: MentorDecisionSelector | null;
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

function loadCraftingKnowledgeRegistry() {
  const files = [
    "observedCurrencyActions.2026-08-22.json",
    "modPools.unavailable.2026-08-22.json",
  ];
  const raw = files.map((file) =>
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL(`./data/crafting/${file}`, import.meta.url)),
        "utf8",
      ),
    ) as unknown,
  );
  return loadCraftingKnowledge(raw);
}

function readJournal(
  db: ReturnType<typeof createDatabase>,
  characterId: string,
) {
  const row = getCharacter(db, characterId);
  const profile = row
    ? CharacterProfileSchema.parse(JSON.parse(row.payload))
    : null;
  return readJournalBundle(db, characterId, profile).journal;
}

/** Contexto acotado del motor: una primaria por id + diez completadas indexadas. */
function readRecommendationMemory(
  db: ReturnType<typeof createDatabase>,
  characterId: string,
) {
  const storedPrimaryId = getJournalPrimaryEntryId(db, characterId);
  const primaryRow = storedPrimaryId ? getJournalEntry(db, storedPrimaryId) : null;
  const parsedPrimary =
    primaryRow?.character_id === characterId
      ? JournalEntrySchema.parse(JSON.parse(primaryRow.payload))
      : null;
  const primaryEntry =
    parsedPrimary?.status === "active" || parsedPrimary?.status === "waiting_result"
      ? parsedPrimary
      : null;
  const completedEntries = listCompletedRecommendationJournalEntries(
    db,
    characterId,
    10,
  ).map((row) => JournalEntrySchema.parse(JSON.parse(row.payload)));
  const session = readJournalBundle(db, characterId).journal.session;
  const buildMemory = listBuildMemoryEntries(db, characterId).map((row) =>
    BuildMemoryEntrySchema.parse(JSON.parse(row.payload)),
  );
  return buildRecommendationMemory(
    {
      characterId,
      primaryEntryId: primaryEntry?.id ?? null,
      primaryEntry,
      entries: completedEntries,
      buildMemory,
    },
    session,
  );
}

function assertKnownBuildMemoryItems(
  profile: CharacterProfile,
  relatedItemIds: string[],
): void {
  const knownItemIds = new Set(profile.items.map((item) => item.id));
  const unknownItemId = relatedItemIds.find((id) => !knownItemIds.has(id));
  if (unknownItemId) {
    throw new ApiHttpError(
      400,
      "objeto-de-memoria-desconocido",
      `El objeto «${unknownItemId}» no pertenece al personaje guardado.`,
    );
  }
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const config: ServerConfig = { ...loadConfig(), ...(options.config ?? {}) };
  const db = createDatabase(options.dbPath ?? config.databasePath);
  const ninjaClient = new PoeNinjaClient({ db, config, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
  const priceService = new PriceService(ninjaClient);
  const explainer = options.explainer ?? getExplainer(config);
  const mentorSelector =
    options.mentorSelector !== undefined
      ? options.mentorSelector
      : createMentorDecisionSelector(config);
  const patches = loadPatches();
  const craftingKnowledge = loadCraftingKnowledgeRegistry();

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

  // GET /crafting/knowledge — acciones observadas + disponibilidad real del
  // pool. Nunca expone candidatos ni pesos si el registro no es exhaustivo.
  app.get("/crafting/knowledge", (req, res, next) => {
    try {
      const itemClass =
        typeof req.query.itemClass === "string" && req.query.itemClass.trim().length > 0
          ? req.query.itemClass.trim()
          : "Desconocida";
      const baseType =
        typeof req.query.baseType === "string" && req.query.baseType.trim().length > 0
          ? req.query.baseType.trim()
          : undefined;
      const patch =
        typeof req.query.patch === "string" && req.query.patch.trim().length > 0
          ? req.query.patch.trim()
          : undefined;
      const pool = queryModCandidates(craftingKnowledge, {
        itemClass,
        ...(baseType ? { baseType } : {}),
        ...(patch ? { patch } : {}),
      });
      const observedIds = new Set(listObservedActions(craftingKnowledge).map((action) => action.id));
      const actions = OBSERVED_CRAFTING_ACTIONS.filter((action) => observedIds.has(action.id));
      const observedSnapshot = craftingKnowledge.snapshots.find(
        (snapshot) => snapshot.observedActions.length > 0,
      );

      res.json(
        CraftingKnowledgeResponseSchema.parse({
          asOf: observedSnapshot?.asOf ?? "desconocida",
          completeness: observedSnapshot?.completeness ?? "unavailable",
          actions,
          modPool: {
            status: pool.status,
            snapshotId: pool.snapshotId,
            probabilityBasis: pool.probabilityBasis,
            reasons: "reasons" in pool ? pool.reasons : [],
            limitations: pool.limitations,
          },
        }),
      );
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

  // Memoria estable de la identidad de la build. No implica que el juego haya
  // ejecutado nada: son reglas declaradas por el jugador y conservadas aparte
  // de una sesión concreta.
  app.post("/journal/:characterId/build-memory", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = CreateBuildMemoryEntryRequestSchema.parse(req.body);
      const profileRow = getCharacter(db, characterId);
      if (!profileRow) {
        throw new ApiHttpError(
          409,
          "personaje-no-guardado",
          "Guarda el personaje antes de definir la identidad de su build.",
        );
      }
      const profile = CharacterProfileSchema.parse(JSON.parse(profileRow.payload));
      assertKnownBuildMemoryItems(profile, input.relatedItemIds);
      const now = new Date().toISOString();
      const entry: BuildMemoryEntry = BuildMemoryEntrySchema.parse({
        id: randomUUID(),
        characterId,
        kind: input.kind,
        label: input.label,
        reason: input.reason,
        relatedItemIds: input.relatedItemIds,
        reconsiderWhen: input.kind === "discarded" ? input.reconsiderWhen : null,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      const journal = withTransaction(db, () => {
        assertRevision(db, characterId, input.journalRevision);
        saveBuildMemoryEntry(db, {
          id: entry.id,
          characterId,
          kind: entry.kind,
          payload: JSON.stringify(entry),
          active: entry.active,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        });
        return readJournal(db, characterId);
      });
      res.status(201).json({ journal, entry });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/journal/:characterId/build-memory/:entryId", (req, res, next) => {
    try {
      const { characterId, entryId } = req.params;
      const input = UpdateBuildMemoryEntryRequestSchema.parse(req.body);
      const row = getBuildMemoryEntry(db, entryId);
      if (!row || row.character_id !== characterId) {
        throw new ApiHttpError(
          404,
          "memoria-build-no-encontrada",
          "No existe esa regla de build para este personaje.",
        );
      }
      const previous = BuildMemoryEntrySchema.parse(JSON.parse(row.payload));
      if (input.relatedItemIds !== undefined) {
        const profileRow = getCharacter(db, characterId);
        if (!profileRow) {
          throw new ApiHttpError(
            409,
            "personaje-no-guardado",
            "Guarda el personaje antes de cambiar los objetos de una regla.",
          );
        }
        assertKnownBuildMemoryItems(
          CharacterProfileSchema.parse(JSON.parse(profileRow.payload)),
          input.relatedItemIds,
        );
      }
      const nextKind = input.kind ?? previous.kind;
      const entry: BuildMemoryEntry = BuildMemoryEntrySchema.parse({
        ...previous,
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.relatedItemIds !== undefined
          ? { relatedItemIds: input.relatedItemIds }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        reconsiderWhen:
          nextKind === "discarded"
            ? input.reconsiderWhen !== undefined
              ? input.reconsiderWhen
              : previous.reconsiderWhen
            : null,
        updatedAt: new Date().toISOString(),
      });
      const journal = withTransaction(db, () => {
        assertRevision(db, characterId, input.journalRevision);
        saveBuildMemoryEntry(db, {
          id: entry.id,
          characterId,
          kind: entry.kind,
          payload: JSON.stringify(entry),
          active: entry.active,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        });
        return readJournal(db, characterId);
      });
      res.json({ journal, entry });
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
      const journal = withTransaction(db, () => {
        if (input.journalRevision) {
          assertRevision(db, characterId, input.journalRevision);
        }
        if (input.makePrimary) {
          const openSession = readJournalBundle(db, characterId).journal.session;
          if (openSession && sessionIsOpen(openSession.status)) {
            throw new ApiHttpError(
              400,
              "sesion-ya-activa",
              "Ya hay una decisión en curso. Registra el resultado o páusala antes de guardar otro paso.",
            );
          }
        }
        saveJournalEntry(db, {
          id: entry.id,
          characterId,
          payload: JSON.stringify(entry),
          status: entry.status,
          recommendationId: entry.recommendationSnapshot?.id ?? null,
          recommendationActionKind:
            entry.recommendationSnapshot?.actionKind ?? null,
          createdAt: now,
          updatedAt: now,
        });
        if (input.makePrimary) setJournalPrimaryEntryId(db, characterId, entry.id);
        return readJournal(db, characterId);
      });
      res.status(201).json({ journal, entry });
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
      const journal = withTransaction(db, () => {
        if (input.journalRevision) {
          assertRevision(db, characterId, input.journalRevision);
        }
        saveJournalEntry(db, {
          id: entry.id,
          characterId,
          payload: JSON.stringify(entry),
          status: entry.status,
          recommendationId: entry.recommendationSnapshot?.id ?? null,
          recommendationActionKind:
            entry.recommendationSnapshot?.actionKind ?? null,
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
        return readJournal(db, characterId);
      });
      res.json({ journal, entry });
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = StartDecisionSessionRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = startDecisionSession(db, characterId, {
        journalRevision: input.journalRevision,
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        objective: input.objective,
        hypothesis: input.hypothesis,
        expectedResult: input.expectedResult,
        observationMethod: input.observationMethod,
        unknowns: input.unknowns,
        constraints: input.constraints,
        soonReplacedItemIds: input.soonReplacedItemIds,
        protectedResources: input.protectedResources,
        craftingExperiment: input.craftingExperiment,
        recommendation: input.recommendation,
        profile: input.profile,
        budget: input.budget,
        goal: input.goal,
      });
      res.status(201).json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/constraints", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = AddSessionConstraintRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = addSessionConstraint(db, characterId, input);
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/constraints/release", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = ReleaseSessionConstraintRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = releaseSessionConstraint(db, characterId, input);
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/evidence", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = AddSessionEvidenceRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = addSessionEvidence(db, characterId, input);
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/result", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = RecordSessionResultRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = recordSessionResult(db, characterId, {
        ...input,
        conclusion: input.conclusion,
      });
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/pause", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = PauseSessionRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = pauseSession(db, characterId, input);
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/abandon", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = AbandonSessionRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = abandonSession(db, characterId, input);
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/reopen", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = ReopenSessionRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = reopenSession(db, characterId, input);
      res.json(journal.journal);
    } catch (err) {
      next(err);
    }
  });

  app.post("/journal/:characterId/session/reconcile", (req, res, next) => {
    try {
      const characterId = req.params.characterId;
      const input = ReconcileSessionRequestSchema.parse(req.body);
      if (input.profile.id !== characterId) {
        throw new ApiHttpError(400, "personaje-no-coincide", "El personaje de la sesión no coincide con la ruta.");
      }
      const journal = reconcileSession(db, characterId, input);
      res.json(journal.journal);
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
      const memory = readRecommendationMemory(db, body.profile.id);
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
      // Segunda lectura tras cualquier espera asíncrona (precios/explainer):
      // una acción creada en otra pestaña invalida esta respuesta antes de que
      // pueda presentar tareas paralelas.
      if (readRecommendationMemory(db, body.profile.id).revision !== memory.revision) {
        throw new ApiHttpError(
          409,
          "memoria-diario-obsoleta",
          "La memoria del personaje cambió mientras se calculaba la decisión. Recárgala y vuelve a intentarlo.",
        );
      }
      res.json({ ...result, recommendations });
    } catch (err) {
      next(err);
    }
  });

  // POST /mentor/query — conversación fundamentada (reglas + redacción IA opcional).
  // Mismas protecciones que /recommendations: el servidor carga la memoria
  // autoritativa del diario, rechaza una revisión obsoleta con 409 y vuelve a
  // comprobarla tras cualquier espera asíncrona (carrera entre pestañas).
  app.post("/mentor/query", async (req, res, next) => {
    try {
      const body = MentorQueryRequestSchema.parse(req.body);
      const memory = readRecommendationMemory(db, body.profile.id);
      if (
        body.journalRevision !== undefined &&
        body.journalRevision !== null &&
        body.journalRevision !== memory.revision
      ) {
        throw new ApiHttpError(
          409,
          "memoria-diario-obsoleta",
          "La memoria del personaje cambió. Recárgala antes de volver a preguntar al mentor.",
        );
      }

      const answer = await answerMentorQuery(
        {
          question: body.question,
          ...(body.intentHint !== undefined ? { intentHint: body.intentHint } : {}),
          profile: body.profile,
          budget: body.budget,
          goal: body.goal,
          league: body.league,
          patch: body.patch,
          memory,
          ...(body.target !== undefined ? { target: body.target } : {}),
          ...(body.contextEnvelope !== undefined ? { contextEnvelope: body.contextEnvelope } : {}),
          ...(body.conversation !== undefined ? { conversation: body.conversation } : {}),
        },
        { priceService, selector: mentorSelector },
      );

      // Segunda lectura tras la espera asíncrona: si otra pestaña creó o cerró
      // una acción mientras respondíamos, esta respuesta ya no es válida.
      if (readRecommendationMemory(db, body.profile.id).revision !== memory.revision) {
        throw new ApiHttpError(
          409,
          "memoria-diario-obsoleta",
          "La memoria del personaje cambió mientras se preparaba la respuesta. Recárgala y vuelve a preguntar.",
        );
      }

      res.json({ answer });
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
