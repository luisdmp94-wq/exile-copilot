import { randomUUID } from "node:crypto";
import {
  compactJournalTitle,
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
  MAX_SESSION_CONSTRAINTS,
  MAX_SESSION_EVIDENCE,
  MAX_SESSION_EVENTS,
  MAX_SESSION_UNKNOWNS,
  MAX_SESSIONS_PER_CHARACTER,
  recommendationConflictsConstraint,
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
  getActiveSessionId,
  getDecisionSession,
  getEventByIdempotencyKey,
  getJournalEntry,
  getJournalPrimaryEntryId,
  listDecisionSessionEvents,
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
    ? listDecisionSessionEvents(db, session.id, MAX_SESSION_EVENTS).map((row) =>
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

function replayIdempotent(db: Database, key: string, characterId: string): JournalBundle | null {
  const existing = getEventByIdempotencyKey(db, key);
  if (!existing) return null;
  if (existing.character_id !== characterId) {
    throw new ApiHttpError(
      409,
      "clave-de-idempotencia-ajena",
      "Esa clave ya se usó en otra decisión.",
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
  fn: () => JournalBundle,
): JournalBundle {
  const replay = replayIdempotent(db, key, characterId);
  if (replay) return replay;
  try {
    return withTransaction(db, fn);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const again = replayIdempotent(db, key, characterId);
      if (again) return again;
    }
    throw error;
  }
}

function appendEvent(
  db: Database,
  session: DecisionSession,
  input: {
    idempotencyKey: string;
    fromStatus: DecisionSessionStatus | null;
    toStatus: DecisionSessionStatus;
    trigger: string;
    summary: string;
  },
): DecisionSessionEvent {
  const count = countSessionEvents(db, session.id);
  if (count >= MAX_SESSION_EVENTS) {
    throw new ApiHttpError(
      400,
      "historial-de-sesion-lleno",
      "Esta decisión ya tiene el historial máximo. Ciérrala o páusala antes de seguir.",
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
  });
  return event;
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
      goal: null,
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
  },
): JournalBundle {
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    assertRevision(db, characterId, input.journalRevision, input.profile);
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
      lastResult: null,
      conclusion: null,
      characterFingerprint: characterSessionFingerprint(input.profile),
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
      session = { ...session, activeAction: built.action };
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
        input.profile,
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
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
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
    return readJournalBundle(db, characterId, input.profile);
  });
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
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    const bundle = assertRevision(db, characterId, input.journalRevision, input.profile);
    const current = requireMutableSession(bundle, input.profile);
    assertCompatible(current, input.profile);
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
      fromStatus: from,
      toStatus: session.status,
      trigger: "constraint_added",
      summary: `Protegido: ${input.label}.`,
    });
    return readJournalBundle(db, characterId, input.profile);
  });
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
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    const bundle = assertRevision(db, characterId, input.journalRevision, input.profile);
    const current = requireSession(bundle, input.profile);
    assertCompatible(current, input.profile);
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
    return readJournalBundle(db, characterId, input.profile);
  });
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
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    const bundle = assertRevision(db, characterId, input.journalRevision, input.profile);
    const current = requireMutableSession(bundle, input.profile);
    assertCompatible(current, input.profile);
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

    if (session.activeAction && session.activeAction.journalEntryId === null && (conclusionKind === "change_strategy" || conclusionKind === "continue")) {
      const entry = createJournalAction(
        characterId,
        input.profile,
        session,
        session.activeAction,
        null,
        "decision",
      );
      persistEntry(db, entry);
      setJournalPrimaryEntryId(db, characterId, entry.id);
      session = {
        ...session,
        activeAction: { ...session.activeAction, journalEntryId: entry.id },
        status: "waiting_result",
      };
    }

    persistSession(db, session);
    if (session.status === "completed" || session.status === "discarded") {
      setActiveSessionId(db, characterId, session.id);
    }
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      fromStatus: from,
      toStatus: session.status,
      trigger: "result_recorded",
      summary: session.conclusion?.reason ?? "Resultado registrado.",
    });
    return readJournalBundle(db, characterId, input.profile);
  });
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
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    const bundle = assertRevision(db, characterId, input.journalRevision, input.profile);
    const current = requireMutableSession(bundle, input.profile);
    assertCompatible(current, input.profile);
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
      fromStatus: from,
      toStatus: "paused",
      trigger: "paused",
      summary: input.reason,
    });
    return readJournalBundle(db, characterId, input.profile);
  });
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
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    const bundle = assertRevision(db, characterId, input.journalRevision, input.profile);
    const listed = listDecisionSessions(db, characterId, MAX_SESSIONS_PER_CHARACTER);
    const current =
      bundle.journal.session ??
      (listed[0] ? parseSession(listed[0].payload) : null);
    if (current === null) {
      throw new ApiHttpError(404, "sesion-no-encontrada", "No hay una decisión que reabrir.");
    }
    assertCompatible(current, input.profile);
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
      fromStatus: from,
      toStatus: "reopening",
      trigger: "reopen_requested",
      summary: "La decisión vuelve a ser candidata a revisión. La premisa no se da por demostrada.",
    });
    return readJournalBundle(db, characterId, input.profile);
  });
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
  return runIdempotent(db, input.idempotencyKey, characterId, () => {
    const bundle = assertRevision(db, characterId, input.journalRevision, input.profile);
    const current = bundle.journal.session;
    if (current === null) {
      throw new ApiHttpError(404, "sesion-no-encontrada", "No hay una decisión que reconciliar.");
    }
    const from = current.status;
    const session: DecisionSession = {
      ...current,
      characterFingerprint: characterSessionFingerprint(input.profile),
      needsReconciliation: false,
      updatedAt: new Date().toISOString(),
    };
    persistSession(db, session);
    appendEvent(db, session, {
      idempotencyKey: input.idempotencyKey,
      fromStatus: from,
      toStatus: session.status,
      trigger: "profile_reconciled",
      summary: "El jugador confirmó que esta decisión sigue aplicando al personaje actual.",
    });
    return readJournalBundle(db, characterId, input.profile);
  });
}
