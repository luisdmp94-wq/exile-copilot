import { randomUUID } from "node:crypto";
import {
  CharacterProfileSchema,
  compactJournalTitle,
  type GoalKind,
  JournalEntrySchema,
  type CharacterJournal,
  type CharacterProfile,
  type JournalEntry,
  type Recommendation,
} from "../../shared/domain.js";
import {
  canTransition,
  characterSessionFingerprint,
  DecisionSessionEventSchema,
  DecisionSessionSchema,
  evaluateSessionGate,
  evidenceMatchesReopenCondition,
  hasBlockingUnknown,
  isTerminalSessionTrigger,
  MAX_NON_TERMINAL_SESSION_EVENTS,
  MAX_SESSION_CONSTRAINTS,
  MAX_SESSION_EVIDENCE,
  MAX_SESSION_EVENTS_HARD_CAP,
  MAX_SESSION_UNKNOWNS,
  MAX_SESSIONS_PER_CHARACTER,
  recommendationConflictsConstraint,
  sessionFingerprintHash,
  sessionGateViewFromSession,
  sessionIsOpen,
  type DecisionConclusionKind,
  type DecisionSession,
  type DecisionSessionEvent,
  type DecisionSessionKind,
  type DecisionSessionStatus,
  type SessionEvidenceKind,
} from "../../shared/decisionSession.js";
import type { JournalResponse } from "../../shared/api.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
import type { Database } from "../db/database.js";
import { withTransaction } from "../db/database.js";
import {
  countSessionEvents,
  deleteDecisionSession,
  getActiveSessionId,
  getCharacter,
  getDecisionSession,
  getEventByIdempotencyKey,
  getJournalEntry,
  getJournalPrimaryEntryId,
  listDecisionSessionEvents,
  listDecisionSessionIdsBeyond,
  listDecisionSessions,
  listJournalEntries,
  saveDecisionSession,
  saveDecisionSessionEvent,
  saveJournalEntry,
  setActiveSessionId,
  setJournalPrimaryEntryId,
} from "../db/repositories.js";
import { ApiHttpError } from "../errors.js";

export interface JournalBundle {
  journal: JournalResponse;
  memoryRevision: string;
}

function parseSession(payload: string): DecisionSession {
  return DecisionSessionSchema.parse(JSON.parse(payload));
}

function persistSession(db: Database, session: DecisionSession): void {
  saveDecisionSession(db, {
    id: session.id,
    characterId: session.characterId,
    payload: JSON.stringify(session),
    status: session.status,
    characterFingerprint: session.characterFingerprint,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

function persistEntry(db: Database, entry: JournalEntry): void {
  saveJournalEntry(db, {
    id: entry.id,
    characterId: entry.characterId,
    payload: JSON.stringify(entry),
    status: entry.status,
    recommendationId: entry.recommendationSnapshot?.id ?? null,
    recommendationActionKind: entry.recommendationSnapshot?.actionKind ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

export function readJournalBundle(
  db: Database,
  characterId: string,
  profile: CharacterProfile | null = null,
): JournalBundle {
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
  const journalBase: CharacterJournal = {
    characterId,
    primaryEntryId: primaryEntry?.id ?? null,
    primaryEntry,
    entries,
  };
  const activeId = getActiveSessionId(db, characterId);
  const sessionRow = activeId ? getDecisionSession(db, activeId) : null;
  let session =
    sessionRow && sessionRow.character_id === characterId
      ? parseSession(sessionRow.payload)
      : null;
  if (session && profile !== null) {
    const fingerprint = characterSessionFingerprint(profile);
    session = {
      ...session,
      needsReconciliation: fingerprint !== session.characterFingerprint,
    };
  }
  const events = session
    ? listDecisionSessionEvents(db, session.id, MAX_SESSION_EVENTS_HARD_CAP).map((row) =>
        DecisionSessionEventSchema.parse(JSON.parse(row.payload)),
      )
    : [];
  const journal: JournalResponse = {
    ...journalBase,
    session,
    sessionEvents: events,
  };
  return {
    journal,
    memoryRevision: buildRecommendationMemory(journalBase, session).revision,
  };
}

/**
 * Perfil AUTORITATIVO: el que está guardado en SQLite, leído dentro de la misma
 * transacción que la operación.
 *
 * El `profile` que envía una pestaña es una copia que puede estar obsoleta; si
 * se usara para calcular la huella, una pestaña antigua podría reenviar su
 * snapshot viejo y eludir la reconciliación. Aquí el cliente nunca sustituye a
 * la fuente de verdad: como mucho sirve para el mensaje de error.
 */
function loadAuthoritativeProfile(
  db: Database,
  characterId: string,
): CharacterProfile {
  const row = getCharacter(db, characterId);
  if (row === null) {
    throw new ApiHttpError(
      409,
      "personaje-no-guardado",
      "Guarda el personaje antes de trabajar con una decisión: el servidor decide con los datos guardados, no con los de la pestaña.",
    );
  }
  return CharacterProfileSchema.parse(JSON.parse(row.payload));
}

/**
 * Huella estable del cuerpo de la petición para la idempotencia. Se excluyen la
 * propia clave y el `profile` del cliente (que no es autoritativo y varía entre
 * pestañas sin cambiar la intención de la operación).
 */
const FINGERPRINT_EXCLUDED: ReadonlySet<string> = new Set([
  "idempotencyKey",
  "profile",
  "journalRevision",
]);

function requestFingerprint(input: Record<string, unknown>): string {
  const rest = Object.fromEntries(
    Object.entries(input).filter(([key]) => !FINGERPRINT_EXCLUDED.has(key)),
  );
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, entry]) => [key, stable(entry)]),
      );
    }
    return value;
  };
  return sessionFingerprintHash(JSON.stringify(stable(rest)));
}

export function assertRevision(
  db: Database,
  characterId: string,
  expected: string,
  profile: CharacterProfile | null = null,
): JournalBundle {
  const bundle = readJournalBundle(db, characterId, profile);
  if (bundle.memoryRevision !== expected) {
    throw new ApiHttpError(
      409,
      "memoria-diario-obsoleta",
      "La memoria del personaje cambió. Recárgala antes de continuar esta decisión.",
    );
  }
  return bundle;
}

/**
 * Reproducción idempotente ligada a LA OPERACIÓN. La misma clave con otra ruta
 * o con otro payload no puede devolver éxito silencioso: sería contestar con el
 * resultado de una operación que el cliente no pidió.
 */
function replayIdempotent(
  db: Database,
  key: string,
  characterId: string,
  operation: string,
  fingerprint: string,
): JournalBundle | null {
  const existing = getEventByIdempotencyKey(db, key);
  if (!existing) return null;
  if (existing.character_id !== characterId) {
    throw new ApiHttpError(
      409,
      "clave-de-idempotencia-ajena",
      "Esa clave ya se usó en otra decisión.",
    );
  }
  // Filas anteriores a la migración no tienen operación registrada: se aceptan
  // como reintento, que es como se comportaban antes.
  if (existing.operation !== null && existing.operation !== operation) {
    throw new ApiHttpError(
      409,
      "clave-de-idempotencia-reutilizada",
      "Esa clave ya se usó para otra operación distinta. Usa una clave nueva.",
    );
  }
  if (existing.request_fingerprint !== null && existing.request_fingerprint !== fingerprint) {
    throw new ApiHttpError(
      409,
      "clave-de-idempotencia-reutilizada",
      "Esa clave ya se usó con datos distintos. Usa una clave nueva.",
    );
  }
  return readJournalBundle(db, characterId);
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function runIdempotent(
  db: Database,
  key: string,
  characterId: string,
  operation: string,
  fingerprint: string,
  fn: (context: { operation: string; fingerprint: string }) => JournalBundle,
): JournalBundle {
  const replay = replayIdempotent(db, key, characterId, operation, fingerprint);
  if (replay) return replay;
  try {
    return withTransaction(db, () => fn({ operation, fingerprint }));
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const again = replayIdempotent(db, key, characterId, operation, fingerprint);
      if (again) return again;
    }
    throw error;
  }
}

/**
 * Añade un evento respetando la RESERVA de cierre.
 *
 * Las operaciones que solo acumulan material (restricciones, evidencia) se
 * cortan antes del tope para que siempre queden plazas con las que pausar o
 * cerrar. Antes, al llegar a 40 el servidor rechazaba también las transiciones
 * terminales: el mensaje pedía «ciérrala o páusala» y esas dos acciones eran
 * justo las que ya no permitía, dejando la sesión atrapada.
 */
function appendEvent(
  db: Database,
  session: DecisionSession,
  input: {
    idempotencyKey: string;
    fromStatus: DecisionSessionStatus | null;
    toStatus: DecisionSessionStatus;
    trigger: string;
    summary: string;
    operation: string;
    requestFingerprint: string;
  },
): DecisionSessionEvent {
  const count = countSessionEvents(db, session.id);
  const terminal = isTerminalSessionTrigger(input.trigger);
  const cap = terminal ? MAX_SESSION_EVENTS_HARD_CAP : MAX_NON_TERMINAL_SESSION_EVENTS;
  if (count >= cap) {
    throw new ApiHttpError(
      400,
      "historial-de-sesion-lleno",
      terminal
        ? "Esta decisión agotó su historial incluso con las plazas reservadas para cerrarla. Empieza otra decisión."
        : "Esta decisión ya tiene el historial máximo para añadir material. Puedes pausarla, registrar su resultado o descartarla: esas transiciones siguen disponibles.",
    );
  }
  const now = new Date().toISOString();
  const event = DecisionSessionEventSchema.parse({
    id: randomUUID(),
    sessionId: session.id,
    characterId: session.characterId,
    idempotencyKey: input.idempotencyKey,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    trigger: input.trigger,
    summary: input.summary,
    createdAt: now,
  });
  saveDecisionSessionEvent(db, {
    id: event.id,
    sessionId: event.sessionId,
    characterId: event.characterId,
    idempotencyKey: event.idempotencyKey,
    payload: JSON.stringify(event),
    createdAt: event.createdAt,
    operation: input.operation,
    requestFingerprint: input.requestFingerprint,
  });
  return event;
}

/**
 * Retención documentada: como máximo `MAX_SESSIONS_PER_CHARACTER` sesiones por
 * personaje. Se aplica DENTRO de la transacción y solo sobre sesiones ya
 * cerradas: una sesión abierta nunca se borra por retención. Si todas las que
 * sobran siguen abiertas no se borra ninguna (no se pierde historia viva).
 */
function enforceSessionRetention(db: Database, characterId: string): void {
  const surplus = listDecisionSessionIdsBeyond(db, characterId, MAX_SESSIONS_PER_CHARACTER);
  for (const id of surplus) {
    const row = getDecisionSession(db, id);
    if (row === null || row.character_id !== characterId) continue;
    if (sessionIsOpen(parseSession(row.payload).status)) continue;
    if (getActiveSessionId(db, characterId) === id) continue;
    deleteDecisionSession(db, id);
  }
}

function requireSession(
  bundle: JournalBundle,
  profile: CharacterProfile,
): DecisionSession {
  const session = bundle.journal.session;
  if (session === null) {
    throw new ApiHttpError(
      404,
      "sesion-no-encontrada",
      "No hay una decisión en curso para este personaje.",
    );
  }
  if (session.characterId !== profile.id) {
    throw new ApiHttpError(
      409,
      "sesion-incompatible-con-perfil",
      "Esta decisión pertenece a otro personaje. Empieza una nueva o reconcilia los datos.",
    );
  }
  return session;
}

function requireMutableSession(
  bundle: JournalBundle,
  profile: CharacterProfile,
): DecisionSession {
  const session = requireSession(bundle, profile);
  if (!sessionIsOpen(session.status)) {
    throw new ApiHttpError(
      400,
      "transicion-de-sesion-invalida",
      "Esa decisión ya está cerrada. Reábrela como candidata si quieres volver a ella.",
    );
  }
  return session;
}

function assertCompatible(session: DecisionSession, profile: CharacterProfile): void {
  const fingerprint = characterSessionFingerprint(profile);
  if (fingerprint !== session.characterFingerprint) {
    throw new ApiHttpError(
      409,
      "sesion-incompatible-con-perfil",
      "El personaje cambió desde que empezó esta decisión. Confirma los datos antes de seguir.",
    );
  }
}

function moveStatus(
  session: DecisionSession,
  to: DecisionSessionStatus,
): DecisionSession {
  if (!canTransition(session.status, to)) {
    throw new ApiHttpError(
      400,
      "transicion-de-sesion-invalida",
      "Ese cambio de estado no está permitido ahora.",
    );
  }
  return { ...session, status: to, updatedAt: new Date().toISOString() };
}

function closePreviousPrimary(db: Database, characterId: string, now: string): void {
  const previousPrimaryId = getJournalPrimaryEntryId(db, characterId);
  if (!previousPrimaryId) return;
  const row = getJournalEntry(db, previousPrimaryId);
  if (row && row.character_id === characterId) {
    const previous = JournalEntrySchema.parse(JSON.parse(row.payload));
    if (previous.status === "active" || previous.status === "waiting_result") {
      persistEntry(db, {
        ...previous,
        status: "cancelled",
        nextAction: null,
        updatedAt: now,
        resolvedAt: previous.resolvedAt ?? now,
      });
    }
  }
  setJournalPrimaryEntryId(db, characterId, null);
}

function buildActionFromRecommendation(
  session: DecisionSession,
  recommendation: Recommendation,
  budget: { amount: number; currency: "divine" | "exalted" | "chaos" | "gold" },
): {
  action: NonNullable<DecisionSession["activeAction"]>;
  gateReason: string | null;
} {
  const gate = evaluateSessionGate(
    recommendation,
    sessionGateViewFromSession(session, budget),
  );
  if (gate?.kind === "irreversible_missing_evidence") {
    return {
      action: {
        journalEntryId: null,
        summary: `Antes de seguir, anota exactamente: ${gate.label}.`,
        irreversible: false,
        riskLevel: "low",
        maxCost: null,
        blockedReason: `Falta comprobar «${gate.label}» y el paso siguiente no se puede deshacer.`,
        expectedResult: `El texto o tooltip exacto de «${gate.label}».`,
        observationMethod: "Cópialo tal cual aparece, sin interpretarlo.",
      },
      gateReason: gate.kind,
    };
  }
  if (gate?.kind === "protected_constraint") {
    return {
      action: {
        journalEntryId: null,
        summary: `Conflicto: «${gate.label}» está protegido y este paso lo tocaría.`,
        irreversible: false,
        riskLevel: recommendation.risk.level,
        maxCost: null,
        blockedReason: `No se propone en silencio un cambio que viola «${gate.label}».`,
        expectedResult: "Confirmar si mantienes esa protección o si quieres cambiar de plan.",
        observationMethod: "Decide si esa pieza o habilidad sigue siendo intocable.",
      },
      gateReason: gate.kind,
    };
  }
  if (gate?.kind === "opportunity_cost") {
    return {
      action: {
        journalEntryId: null,
        summary: "Pausa: esa pieza se sustituirá pronto; no gastes el recurso ahora.",
        irreversible: false,
        riskLevel: "low",
        maxCost: budget,
        blockedReason: "Coste de oportunidad: la mejora se perdería al reemplazar la pieza.",
        expectedResult: "Conservar el recurso hasta el equipo que sí se quedará.",
        observationMethod: "Comprueba si esa pieza sigue en el plan a corto plazo.",
      },
      gateReason: gate.kind,
    };
  }
  if (gate?.kind === "over_budget") {
    return {
      action: {
        journalEntryId: null,
        summary: "Pausa: el coste conocido supera el presupuesto que aceptaste.",
        irreversible: false,
        riskLevel: "low",
        maxCost: budget,
        blockedReason: "No es un fracaso: el presupuesto no cubre esta compra ahora.",
        expectedResult: "Esperar recurso o bajar el coste, no forzar la compra.",
        observationMethod: "Revisa tu presupuesto o busca una alternativa más barata.",
      },
      gateReason: gate.kind,
    };
  }
  return {
    action: {
      journalEntryId: null,
      summary: recommendation.action,
      irreversible: recommendation.irreversible,
      riskLevel: recommendation.risk.level,
      maxCost: recommendation.cost.known
        ? { amount: recommendation.cost.min ?? 0, currency: recommendation.cost.currency }
        : budget,
      blockedReason: null,
      expectedResult: recommendation.impact.description,
      observationMethod: "Mira el resultado en el juego y anótalo aquí con tus palabras.",
    },
    gateReason: null,
  };
}

function createJournalAction(
  characterId: string,
  profile: CharacterProfile,
  session: DecisionSession,
  action: NonNullable<DecisionSession["activeAction"]>,
  recommendation: Recommendation | null,
  kind: JournalEntry["kind"],
): JournalEntry {
  const now = new Date().toISOString();
  return JournalEntrySchema.parse({
    id: randomUUID(),
    characterId,
    kind,
    status: action.blockedReason ? "active" : "waiting_result",
    title: compactJournalTitle(session.objective),
    summary: session.hypothesis,
    nextAction: action.summary,
    result: null,
    relatedItemIds: recommendation?.relatedItemIds ?? [],
    sources: recommendation?.sources ?? [
      {
        kind: "user",
        label: "Decisión guiada por el jugador",
        retrievedAt: now,
        patch: profile.patch,
      },
    ],
    context: {
      characterLevel: profile.level,
      league: profile.league,
      patch: profile.patch,
      budget: action.maxCost,
      // El objetivo viene de la sesión que crea la acción. `null` solo cuando la
      // sesión es anterior a este campo: desconocido, no «equilibrado».
      goal: session.goal,
    },
    recommendationSnapshot: recommendation,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  });
}

export function startDecisionSession(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    kind: DecisionSessionKind;
    objective: string;
    hypothesis: string;
    expectedResult: string;
    observationMethod: string;
    unknowns: Array<{ label: string; blockingIrreversible: boolean }>;
    constraints: Array<{ label: string; relatedItemIds: string[] }>;
    soonReplacedItemIds: string[];
    protectedResources: string[];
    recommendation: Recommendation | null;
    profile: CharacterProfile;
    budget: { amount: number; currency: "divine" | "exalted" | "chaos" | "gold" };
    /** Objetivo del jugador; se conserva en la sesión y en sus entradas. */
    goal: GoalKind;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "start",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    assertRevision(db, characterId, input.journalRevision, profile);
    const existingOpen = listDecisionSessions(db, characterId, MAX_SESSIONS_PER_CHARACTER).filter(
      (row) => sessionIsOpen(parseSession(row.payload).status),
    );
    if (existingOpen.length > 0) {
      throw new ApiHttpError(
        400,
        "sesion-ya-activa",
        "Ya hay una decisión en curso. Ciérrala, páusala o registra el resultado antes de empezar otra.",
      );
    }
    const now = new Date().toISOString();
    closePreviousPrimary(db, characterId, now);
    let session = DecisionSessionSchema.parse({
      id: randomUUID(),
      characterId,
      kind: input.kind,
      status: "active",
      objective: input.objective,
      hypothesis: input.hypothesis,
      unknowns: input.unknowns.slice(0, MAX_SESSION_UNKNOWNS).map((unknown) => ({
        id: randomUUID(),
        label: unknown.label,
        blockingIrreversible: unknown.blockingIrreversible,
        resolved: false,
      })),
      constraints: input.constraints.slice(0, MAX_SESSION_CONSTRAINTS).map((constraint) => ({
        id: randomUUID(),
        label: constraint.label,
        relatedItemIds: constraint.relatedItemIds,
        protected: true,
      })),
      evidence: [],
      soonReplacedItemIds: input.soonReplacedItemIds,
      protectedResources: input.protectedResources,
      activeAction: null,
      blockedRecommendation: null,
      budget: input.budget,
      goal: input.goal,
      lastResult: null,
      conclusion: null,
      characterFingerprint: characterSessionFingerprint(profile),
      needsReconciliation: false,
      createdAt: now,
      updatedAt: now,
    });

    let gateReason: string | null = "manual";
    if (input.recommendation) {
      const built = buildActionFromRecommendation(
        session,
        input.recommendation,
        input.budget,
      );
      session = {
        ...session,
        activeAction: built.action,
        // Si un freno impide ejecutarla, la recomendación se CONSERVA completa
        // (fuentes, coste, riesgo e ids) para poder restaurarla al resolver la
        // incógnita. Sin esto, aportar el dato crítico no desbloqueaba nada.
        blockedRecommendation: built.gateReason === null ? null : input.recommendation,
      };
      gateReason = built.gateReason;
      if (built.gateReason === "opportunity_cost" || built.gateReason === "over_budget") {
        session = moveStatus(session, "paused");
        session = {
          ...session,
          conclusion: {
            kind: "pause",
            reason: built.action.blockedReason ?? built.action.summary,
            reopenWhen: built.action.observationMethod,
            recordedAt: now,
          },
        };
      }
    } else {
      session = {
        ...session,
        activeAction: {
          journalEntryId: null,
          summary: "Describe el resultado que vas a observar antes de gastar nada irreversible.",
          irreversible: false,
          riskLevel: "low",
          maxCost: input.budget,
          blockedReason: hasBlockingUnknown(session)
            ? "Hay un dato crítico sin verificar."
            : null,
          expectedResult: input.expectedResult,
          observationMethod: input.observationMethod,
        },
      };
    }

    const action = session.activeAction;
    if (action) {
      const entry = createJournalAction(
        characterId,
        profile,
        session,
        action,
        gateReason === null ? input.recommendation : null,
        input.kind === "skill_experiment" ? "experiment" : "decision",
      );
      persistEntry(db, entry);
      setJournalPrimaryEntryId(db, characterId, entry.id);
      session = {
        ...session,
        activeAction: { ...action, journalEntryId: entry.id },
        status: session.status === "paused" ? "paused" : entry.status === "waiting_result" ? "waiting_result" : "active",
      };
    }

    persistSession(db, session);
    setActiveSessionId(db, characterId, session.id);
    // La retención se aplica en la misma transacción: nunca más de
    // MAX_SESSIONS_PER_CHARACTER y solo sobre sesiones ya cerradas.
    enforceSessionRetention(db, characterId);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: null,
      toStatus: session.status,
      trigger: "start",
      summary:
        gateReason === "irreversible_missing_evidence"
          ? "No se autoriza el paso irreversible: falta un dato crítico."
          : gateReason === "protected_constraint"
            ? "La recomendación choca con una pieza protegida; se muestra el conflicto."
            : gateReason === "opportunity_cost"
              ? "Se pausa para conservar el recurso: la pieza se sustituirá pronto."
              : gateReason === "over_budget"
                ? "Se pausa porque el coste conocido supera el presupuesto."
                : `Empezamos a comprobar: ${session.hypothesis}`,
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

export function addSessionConstraint(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    label: string;
    relatedItemIds: string[];
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "constraint",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const current = requireMutableSession(bundle, profile);
    assertCompatible(current, profile);
    if (current.constraints.length >= MAX_SESSION_CONSTRAINTS) {
      throw new ApiHttpError(400, "demasiadas-restricciones", "No caben más piezas protegidas en esta decisión.");
    }
    const from = current.status;
    let session: DecisionSession = {
      ...current,
      constraints: [
        ...current.constraints,
        {
          id: randomUUID(),
          label: input.label,
          relatedItemIds: input.relatedItemIds,
          protected: true,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    if (session.activeAction && session.activeAction.blockedReason === null) {
      const rec = bundle.journal.primaryEntry?.recommendationSnapshot;
      if (rec && recommendationConflictsConstraint(rec, session.constraints[session.constraints.length - 1]!)) {
        const blocked = `Conflicto: «${input.label}» está protegido y el paso activo lo tocaría.`;
        const nextAction = {
          ...session.activeAction,
          summary: blocked,
          blockedReason: blocked,
          irreversible: false,
        };
        session = {
          ...session,
          activeAction: nextAction,
        };
        const entryId = nextAction.journalEntryId;
        if (entryId) {
          const row = getJournalEntry(db, entryId);
          if (row) {
            const previous = JournalEntrySchema.parse(JSON.parse(row.payload));
            persistEntry(db, {
              ...previous,
              nextAction: blocked,
              updatedAt: session.updatedAt,
            });
          }
        }
      }
    }
    persistSession(db, session);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: session.status,
      trigger: "constraint_added",
      summary: `Protegido: ${input.label}.`,
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

/**
 * Retira una protección de forma consciente y reevalúa el freno.
 *
 * El mensaje de conflicto propone «decide si esa pieza sigue siendo intocable»,
 * así que la acción debe existir. No se borra la restricción (queda en el
 * historial), solo se marca `protected: false`, y si con eso la recomendación
 * frenada pasa a ser segura se restaura como próxima acción.
 */
export function releaseSessionConstraint(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    constraintId: string;
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "constraint_released",
    requestFingerprint(input),
    (ctx) => {
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const current = requireMutableSession(bundle, profile);
    assertCompatible(current, profile);
    const target = current.constraints.find(
      (constraint) => constraint.id === input.constraintId,
    );
    if (target === undefined) {
      throw new ApiHttpError(
        404,
        "restriccion-no-encontrada",
        "Esa protección ya no está en la decisión.",
      );
    }
    const from = current.status;
    const now = new Date().toISOString();
    let session: DecisionSession = {
      ...current,
      constraints: current.constraints.map((constraint) =>
        constraint.id === input.constraintId
          ? { ...constraint, protected: false }
          : constraint,
      ),
      updatedAt: now,
    };

    const blocked = session.blockedRecommendation;
    if (blocked !== null) {
      const budget = session.budget ?? current.activeAction?.maxCost ?? null;
      const rebuilt = buildActionFromRecommendation(
        session,
        blocked,
        budget ?? { amount: Number.MAX_SAFE_INTEGER, currency: blocked.cost.currency },
      );
      const previousEntryId = session.activeAction?.journalEntryId ?? null;
      if (rebuilt.gateReason === null) {
        if (previousEntryId !== null) {
          const row = getJournalEntry(db, previousEntryId);
          if (row && row.character_id === characterId) {
            const previous = JournalEntrySchema.parse(JSON.parse(row.payload));
            persistEntry(db, {
              ...previous,
              status: "completed",
              result: `Protección retirada: «${target.label}».`,
              nextAction: null,
              updatedAt: now,
              resolvedAt: previous.resolvedAt ?? now,
            });
          }
        }
        const entry = createJournalAction(
          characterId,
          profile,
          session,
          rebuilt.action,
          blocked,
          "decision",
        );
        persistEntry(db, entry);
        setJournalPrimaryEntryId(db, characterId, entry.id);
        session = {
          ...session,
          activeAction: { ...rebuilt.action, journalEntryId: entry.id },
          blockedRecommendation: null,
          status: entry.status === "waiting_result" ? "waiting_result" : "active",
        };
      } else if (session.activeAction !== null) {
        session = {
          ...session,
          activeAction: { ...rebuilt.action, journalEntryId: previousEntryId },
        };
      }
    }

    persistSession(db, session);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: session.status,
      trigger: "constraint_released",
      summary: `Protección retirada a conciencia: ${target.label}.`,
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

export function addSessionEvidence(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    kind: SessionEvidenceKind;
    text: string;
    resolvesUnknownLabel: string | null;
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "evidence",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const current = requireSession(bundle, profile);
    assertCompatible(current, profile);
    if (current.evidence.length >= MAX_SESSION_EVIDENCE) {
      throw new ApiHttpError(400, "demasiada-evidencia", "Esta decisión ya tiene demasiadas notas de evidencia.");
    }
    const from = current.status;
    const evidence = {
      id: randomUUID(),
      kind: input.kind,
      text: input.text,
      recordedAt: new Date().toISOString(),
    };
    let unknowns = current.unknowns;
    if (input.resolvesUnknownLabel) {
      const needle = input.resolvesUnknownLabel.trim().toLowerCase();
      unknowns = unknowns.map((unknown) =>
        unknown.label.trim().toLowerCase() === needle
          ? { ...unknown, resolved: true }
          : unknown,
      );
    }
    let session: DecisionSession = {
      ...current,
      evidence: [...current.evidence, evidence],
      unknowns,
      updatedAt: evidence.recordedAt,
    };

    /*
     * DESBLOQUEO REAL POR EVIDENCIA.
     *
     * Si había una recomendación frenada y la evidencia resolvió la incógnita,
     * se REEVALÚA el freno con el estado actual. Si ya es seguro, se restaura
     * la acción original completa (texto, coste, riesgo, irreversibilidad) y se
     * crea la entrada de diario correspondiente. Si sigue frenada por otro
     * motivo, se actualiza el motivo pero no se pierde la recomendación.
     */
    const blocked = session.blockedRecommendation;
    if (blocked !== null && sessionIsOpen(session.status)) {
      // El presupuesto es el que se aceptó al abrir la decisión, no el
      // `maxCost` de la acción bloqueada (que a propósito puede ser null).
      const budget = session.budget ?? current.activeAction?.maxCost ?? null;
      const rebuilt = buildActionFromRecommendation(
        session,
        blocked,
        budget ?? { amount: Number.MAX_SAFE_INTEGER, currency: blocked.cost.currency },
      );
      const previousEntryId = session.activeAction?.journalEntryId ?? null;
      if (rebuilt.gateReason === null) {
        // Ya es segura: la acción original vuelve a ser la próxima acción.
        if (previousEntryId !== null) {
          const row = getJournalEntry(db, previousEntryId);
          if (row && row.character_id === characterId) {
            const previous = JournalEntrySchema.parse(JSON.parse(row.payload));
            persistEntry(db, {
              ...previous,
              status: "completed",
              result: `Resuelto: ${input.text}`,
              nextAction: null,
              updatedAt: evidence.recordedAt,
              resolvedAt: previous.resolvedAt ?? evidence.recordedAt,
            });
          }
        }
        const entry = createJournalAction(
          characterId,
          profile,
          session,
          rebuilt.action,
          blocked,
          "decision",
        );
        persistEntry(db, entry);
        setJournalPrimaryEntryId(db, characterId, entry.id);
        session = {
          ...session,
          activeAction: { ...rebuilt.action, journalEntryId: entry.id },
          blockedRecommendation: null,
          status: entry.status === "waiting_result" ? "waiting_result" : "active",
        };
      } else if (session.activeAction !== null) {
        // Sigue frenada, pero por otro motivo: se refresca el texto sin perder
        // la recomendación ni el id de la entrada viva.
        session = {
          ...session,
          activeAction: { ...rebuilt.action, journalEntryId: previousEntryId },
        };
      }
    }

    const reopenWhen = current.conclusion?.reopenWhen ?? null;
    if (
      (current.status === "discarded" || current.status === "completed" || current.status === "paused") &&
      evidenceMatchesReopenCondition(input.text, reopenWhen)
    ) {
      session = moveStatus(session, "reopening");
      session = {
        ...session,
        conclusion: {
          kind: "reopen",
          reason:
            "Hay evidencia compatible con la condición de reapertura. Sigue siendo candidata, no un hecho demostrado.",
          reopenWhen,
          recordedAt: evidence.recordedAt,
        },
      };
    }
    persistSession(db, session);
    if (session.status === "reopening") {
      setActiveSessionId(db, characterId, session.id);
    }
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: session.status,
      trigger: input.kind === "player_subjective" ? "subjective_evidence" : "evidence_added",
      summary:
        session.status === "reopening"
          ? "Candidata a revisar: la premisa de reapertura es compatible con lo anotado. No está demostrada."
          : input.kind === "player_subjective"
            ? "Sensación del jugador anotada; no se trata como medición."
            : "Evidencia añadida a la decisión.",
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

export function recordSessionResult(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    result: string;
    subjective: boolean;
    unexpectedValuable: string | null;
    conclusion?: DecisionConclusionKind;
    reopenWhen: string | null;
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "result",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const current = requireMutableSession(bundle, profile);
    assertCompatible(current, profile);
    const from = current.status;
    const now = new Date().toISOString();
    let conclusionKind: DecisionConclusionKind =
      input.conclusion ?? (input.unexpectedValuable ? "change_strategy" : "complete");
    if (input.subjective && !input.unexpectedValuable && !input.conclusion) {
      conclusionKind = "continue";
    }
    const toStatus: DecisionSessionStatus =
      conclusionKind === "pause"
        ? "paused"
        : conclusionKind === "discard"
          ? "discarded"
          : conclusionKind === "change_strategy" || conclusionKind === "continue"
            ? "active"
            : "completed";

    let session = moveStatus(current, toStatus);
    const evidenceKind: SessionEvidenceKind = input.subjective
      ? "player_subjective"
      : "confirmed";
    session = {
      ...session,
      lastResult: {
        text: input.result,
        subjective: input.subjective,
        unexpectedValuable: input.unexpectedValuable,
        recordedAt: now,
      },
      evidence:
        session.evidence.length >= MAX_SESSION_EVIDENCE
          ? session.evidence
          : [
              ...session.evidence,
              {
                id: randomUUID(),
                kind: evidenceKind,
                text: input.result,
                recordedAt: now,
              },
            ],
      conclusion: {
        kind: conclusionKind,
        reason: input.subjective
          ? "La hipótesis no queda medida: es la experiencia del jugador."
          : input.unexpectedValuable
            ? `El objetivo inicial no se cumplió, pero «${input.unexpectedValuable}» merece protección.`
            : input.reopenWhen
              ? `Descartada porque la condición necesaria era inconsistente.`
              : "El jugador informó del resultado y cerramos este paso.",
        reopenWhen:
          input.reopenWhen ??
          (input.unexpectedValuable
            ? `Reevaluar si ${input.unexpectedValuable} deja de ser valioso.`
            : null),
        recordedAt: now,
      },
    };

    if (input.unexpectedValuable) {
      if (session.constraints.length < MAX_SESSION_CONSTRAINTS) {
        session = {
          ...session,
          constraints: [
            ...session.constraints,
            {
              id: randomUUID(),
              label: input.unexpectedValuable,
              relatedItemIds: [],
              protected: true,
            },
          ],
          hypothesis: `Mantener y aprovechar ${input.unexpectedValuable} en lugar del plan original.`,
          objective: `Proteger ${input.unexpectedValuable} y decidir el siguiente paso.`,
          activeAction: {
            journalEntryId: null,
            summary: `Observa cómo encaja ${input.unexpectedValuable} con el resto del personaje antes de gastar más.`,
            irreversible: false,
            riskLevel: "low",
            maxCost: current.activeAction?.maxCost ?? null,
            blockedReason: null,
            expectedResult: `Confirmar si ${input.unexpectedValuable} sigue mereciendo la protección.`,
            observationMethod: "Juega un encuentro representativo y anota si sigue valiendo la pena.",
          },
        };
      }
    }

    const primaryId = current.activeAction?.journalEntryId ?? bundle.journal.primaryEntryId;
    if (primaryId) {
      const row = getJournalEntry(db, primaryId);
      if (row && row.character_id === characterId) {
        const previous = JournalEntrySchema.parse(JSON.parse(row.payload));
        const completed = JournalEntrySchema.parse({
          ...previous,
          status: conclusionKind === "continue" || conclusionKind === "change_strategy" ? "completed" : previous.status === "waiting_result" || previous.status === "active" ? "completed" : previous.status,
          result: input.result,
          nextAction: null,
          updatedAt: now,
          resolvedAt: previous.resolvedAt ?? now,
        });
        persistEntry(db, completed);
        setJournalPrimaryEntryId(db, characterId, null);
      }
    }

    /*
     * INVARIANTE DE PRÓXIMA ACCIÓN.
     *
     * Tras `continue` o `change_strategy` la sesión sigue abierta, así que debe
     * quedar con UNA entrada principal viva y `activeAction.journalEntryId`
     * apuntando exactamente a ella. La entrada anterior acaba de completarse
     * arriba: conservar su id dejaría la sesión activa, sin `primaryEntryId` y
     * con una acción que ya no existe. Por eso el id se descarta SIEMPRE y se
     * crea una entrada nueva a partir de la acción vigente.
     */
    if (conclusionKind === "change_strategy" || conclusionKind === "continue") {
      const carried = session.activeAction;
      const nextAction =
        carried !== null
          ? { ...carried, journalEntryId: null }
          : {
              journalEntryId: null,
              summary:
                "Describe el siguiente paso que vas a observar antes de gastar nada irreversible.",
              irreversible: false,
              riskLevel: "low" as const,
              maxCost: null,
              blockedReason: null,
              expectedResult: session.hypothesis,
              observationMethod:
                "Juega un encuentro representativo y anota aquí lo que veas.",
            };
      const entry = createJournalAction(
        characterId,
        profile,
        session,
        nextAction,
        null,
        "decision",
      );
      persistEntry(db, entry);
      setJournalPrimaryEntryId(db, characterId, entry.id);
      session = {
        ...session,
        activeAction: { ...nextAction, journalEntryId: entry.id },
        status: entry.status === "waiting_result" ? "waiting_result" : "active",
      };
    } else if (session.activeAction !== null) {
      // Transiciones terminales (complete/discard/pause): la sesión ya no tiene
      // un paso vivo, así que la acción no puede seguir citando una entrada
      // completada. Se conserva el texto para el historial, sin id.
      session = {
        ...session,
        activeAction: { ...session.activeAction, journalEntryId: null },
      };
    }

    persistSession(db, session);
    if (session.status === "completed" || session.status === "discarded") {
      setActiveSessionId(db, characterId, session.id);
      enforceSessionRetention(db, characterId);
    }
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: session.status,
      trigger: "result_recorded",
      summary: session.conclusion?.reason ?? "Resultado registrado.",
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

export function pauseSession(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    reason: string;
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "pause",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const current = requireMutableSession(bundle, profile);
    assertCompatible(current, profile);
    const from = current.status;
    const now = new Date().toISOString();
    const session = {
      ...moveStatus(current, "paused"),
      conclusion: {
        kind: "pause" as const,
        reason: input.reason,
        reopenWhen: "Reanudar cuando el recurso o la pieza dejen de estar comprometidos.",
        recordedAt: now,
      },
    };
    persistSession(db, session);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: "paused",
      trigger: "paused",
      summary: input.reason,
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

export function reopenSession(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    note: string;
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "reopen",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const listed = listDecisionSessions(db, characterId, MAX_SESSIONS_PER_CHARACTER);
    const current =
      bundle.journal.session ??
      (listed[0] ? parseSession(listed[0].payload) : null);
    if (current === null) {
      throw new ApiHttpError(404, "sesion-no-encontrada", "No hay una decisión que reabrir.");
    }
    assertCompatible(current, profile);
    const from = current.status;
    const now = new Date().toISOString();
    let session = moveStatus(current, "reopening");
    session = {
      ...session,
      conclusion: {
        kind: "reopen",
        reason: `${input.note} Sigue siendo candidata, no un hecho demostrado.`,
        reopenWhen: current.conclusion?.reopenWhen ?? null,
        recordedAt: now,
      },
    };
    persistSession(db, session);
    setActiveSessionId(db, characterId, session.id);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: "reopening",
      trigger: "reopen_requested",
      summary: "La decisión vuelve a ser candidata a revisión. La premisa no se da por demostrada.",
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}

export function reconcileSession(
  db: Database,
  characterId: string,
  input: {
    journalRevision: string;
    idempotencyKey: string;
    profile: CharacterProfile;
  },
): JournalBundle {
  return runIdempotent(
    db,
    input.idempotencyKey,
    characterId,
    "reconcile",
    requestFingerprint(input),
    (ctx) => {
    // El perfil AUTORITATIVO es el guardado en SQLite, leído dentro de esta
    // transacción. El `profile` del cliente no decide nada.
    const profile = loadAuthoritativeProfile(db, characterId);
    const bundle = assertRevision(db, characterId, input.journalRevision, profile);
    const current = bundle.journal.session;
    if (current === null) {
      throw new ApiHttpError(404, "sesion-no-encontrada", "No hay una decisión que reconciliar.");
    }
    const from = current.status;
    const session: DecisionSession = {
      ...current,
      characterFingerprint: characterSessionFingerprint(profile),
      needsReconciliation: false,
      updatedAt: new Date().toISOString(),
    };
    persistSession(db, session);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      operation: ctx.operation,
      requestFingerprint: ctx.fingerprint,
      fromStatus: from,
      toStatus: session.status,
      trigger: "profile_reconciled",
      summary: "El jugador confirmó que esta decisión sigue aplicando al personaje actual.",
    });
    return readJournalBundle(db, characterId, profile);
    },
  );
}
