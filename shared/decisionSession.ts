import { z } from "zod";
import type { CharacterProfile, Recommendation } from "./domain.js";
import { BudgetSchema, RiskLevel } from "./domain.js";

/** Límites duros: el historial no crece sin cota. */
export const MAX_SESSION_EVENTS = 40;
export const MAX_SESSION_CONSTRAINTS = 20;
export const MAX_SESSION_EVIDENCE = 30;
export const MAX_SESSION_UNKNOWNS = 15;
export const MAX_SESSIONS_PER_CHARACTER = 8;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 80;

export const DecisionSessionKind = z.enum([
  "skill_experiment",
  "equipment_investment",
  "guided_decision",
]);
export type DecisionSessionKind = z.infer<typeof DecisionSessionKind>;

export const DecisionSessionStatus = z.enum([
  "active",
  "waiting_result",
  "paused",
  "completed",
  "discarded",
  "reopening",
]);
export type DecisionSessionStatus = z.infer<typeof DecisionSessionStatus>;

export const DecisionConclusionKind = z.enum([
  "continue",
  "change_strategy",
  "pause",
  "discard",
  "complete",
  "reopen",
]);
export type DecisionConclusionKind = z.infer<typeof DecisionConclusionKind>;

export const SessionEvidenceKind = z.enum([
  "confirmed",
  "inferred",
  "unverified",
  "player_subjective",
]);
export type SessionEvidenceKind = z.infer<typeof SessionEvidenceKind>;

export const SessionUnknownSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(400),
  blockingIrreversible: z.boolean(),
  resolved: z.boolean().default(false),
});
export type SessionUnknown = z.infer<typeof SessionUnknownSchema>;

export const SessionConstraintSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  relatedItemIds: z.array(z.string().min(1).max(200)).max(20).default([]),
  protected: z.boolean().default(true),
});
export type SessionConstraint = z.infer<typeof SessionConstraintSchema>;

export const SessionEvidenceSchema = z.object({
  id: z.string().min(1).max(80),
  kind: SessionEvidenceKind,
  text: z.string().trim().min(1).max(2000),
  recordedAt: z.string(),
});
export type SessionEvidence = z.infer<typeof SessionEvidenceSchema>;

export const SessionActiveActionSchema = z.object({
  journalEntryId: z.string().min(1).nullable(),
  summary: z.string().trim().min(1).max(2000),
  irreversible: z.boolean(),
  riskLevel: RiskLevel,
  maxCost: BudgetSchema.nullable().default(null),
  blockedReason: z.string().trim().min(1).max(1000).nullable().default(null),
  expectedResult: z.string().trim().min(1).max(2000),
  observationMethod: z.string().trim().min(1).max(1000),
});
export type SessionActiveAction = z.infer<typeof SessionActiveActionSchema>;

export const SessionConclusionSchema = z.object({
  kind: DecisionConclusionKind,
  reason: z.string().trim().min(1).max(2000),
  reopenWhen: z.string().trim().min(1).max(1000).nullable().default(null),
  recordedAt: z.string(),
});
export type SessionConclusion = z.infer<typeof SessionConclusionSchema>;

export const DecisionSessionSchema = z.object({
  id: z.string().min(1),
  characterId: z.string().min(1),
  kind: DecisionSessionKind,
  status: DecisionSessionStatus,
  objective: z.string().trim().min(1).max(500),
  hypothesis: z.string().trim().min(1).max(2000),
  unknowns: z.array(SessionUnknownSchema).max(MAX_SESSION_UNKNOWNS).default([]),
  constraints: z.array(SessionConstraintSchema).max(MAX_SESSION_CONSTRAINTS).default([]),
  evidence: z.array(SessionEvidenceSchema).max(MAX_SESSION_EVIDENCE).default([]),
  soonReplacedItemIds: z.array(z.string().min(1).max(200)).max(20).default([]),
  protectedResources: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  activeAction: SessionActiveActionSchema.nullable().default(null),
  lastResult: z
    .object({
      text: z.string().trim().min(1).max(4000),
      subjective: z.boolean(),
      unexpectedValuable: z.string().trim().min(1).max(400).nullable().default(null),
      recordedAt: z.string(),
    })
    .nullable()
    .default(null),
  conclusion: SessionConclusionSchema.nullable().default(null),
  characterFingerprint: z.string().min(1).max(64),
  needsReconciliation: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DecisionSession = z.infer<typeof DecisionSessionSchema>;

export const DecisionSessionEventSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  characterId: z.string().min(1),
  idempotencyKey: z.string().trim().min(1).max(MAX_IDEMPOTENCY_KEY_LENGTH),
  fromStatus: DecisionSessionStatus.nullable(),
  toStatus: DecisionSessionStatus,
  trigger: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(2000),
  createdAt: z.string(),
});
export type DecisionSessionEvent = z.infer<typeof DecisionSessionEventSchema>;

/** Vista acotada que entra en la memoria del motor (fingerprint). */
export const SessionMemoryDigestSchema = z.object({
  sessionId: z.string().min(1).nullable(),
  status: DecisionSessionStatus.nullable(),
  constraintLabels: z.array(z.string()).max(MAX_SESSION_CONSTRAINTS),
  constraintItemIds: z.array(z.string()).max(100),
  unresolvedBlockingUnknowns: z.array(z.string()).max(MAX_SESSION_UNKNOWNS),
  soonReplacedItemIds: z.array(z.string()).max(20),
  characterFingerprint: z.string().nullable(),
});
export type SessionMemoryDigest = z.infer<typeof SessionMemoryDigestSchema>;

export function emptySessionDigest(): SessionMemoryDigest {
  return {
    sessionId: null,
    status: null,
    constraintLabels: [],
    constraintItemIds: [],
    unresolvedBlockingUnknowns: [],
    soonReplacedItemIds: [],
    characterFingerprint: null,
  };
}

export function sessionMemoryDigest(
  session: DecisionSession | null,
): SessionMemoryDigest {
  if (session === null) return emptySessionDigest();
  return SessionMemoryDigestSchema.parse({
    sessionId: session.id,
    status: session.status,
    constraintLabels: session.constraints
      .filter((constraint) => constraint.protected)
      .map((constraint) => constraint.label),
    constraintItemIds: session.constraints
      .filter((constraint) => constraint.protected)
      .flatMap((constraint) => constraint.relatedItemIds),
    unresolvedBlockingUnknowns: session.unknowns
      .filter((unknown) => unknown.blockingIrreversible && !unknown.resolved)
      .map((unknown) => unknown.label),
    soonReplacedItemIds: session.soonReplacedItemIds,
    characterFingerprint: session.characterFingerprint,
  });
}

/** Hash FNV-1a 64 bits: huella síncrona, no criptográfica. */
export function sessionFingerprintHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function characterSessionFingerprint(
  profile: CharacterProfile,
): string {
  const itemIds = profile.items.map((item) => item.id).sort();
  return sessionFingerprintHash(
    JSON.stringify({
      id: profile.id,
      level: profile.level,
      league: profile.league,
      patch: profile.patch,
      itemIds,
    }),
  );
}

const OPEN_STATUSES: ReadonlySet<DecisionSessionStatus> = new Set([
  "active",
  "waiting_result",
  "paused",
  "reopening",
]);

export function sessionIsOpen(status: string): boolean {
  return OPEN_STATUSES.has(status as DecisionSessionStatus);
}

export function canTransition(
  from: DecisionSessionStatus,
  to: DecisionSessionStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<DecisionSessionStatus, DecisionSessionStatus[]> = {
    active: ["waiting_result", "paused", "completed", "discarded", "active"],
    waiting_result: ["active", "paused", "completed", "discarded", "waiting_result"],
    paused: ["active", "reopening", "discarded", "completed", "paused"],
    completed: ["reopening"],
    discarded: ["reopening"],
    reopening: ["active", "waiting_result", "paused", "discarded", "completed"],
  };
  return allowed[from].includes(to);
}

export function hasBlockingUnknown(session: DecisionSession): boolean {
  return session.unknowns.some(
    (unknown) => unknown.blockingIrreversible && !unknown.resolved,
  );
}

function normalizeHaystack(text: string): string {
  return text.trim().toLowerCase();
}

/** Conflicto por id de objeto o por la frase que el jugador protegió. Sin conocimiento de PoE2. */
export function recommendationConflictsConstraint(
  recommendation: Pick<Recommendation, "title" | "action" | "reason" | "relatedItemIds">,
  constraint: SessionConstraint,
): boolean {
  if (!constraint.protected) return false;
  if (
    constraint.relatedItemIds.some((id) => recommendation.relatedItemIds.includes(id))
  ) {
    return true;
  }
  const phrase = normalizeHaystack(constraint.label);
  if (phrase.length < 3) return false;
  const haystack = normalizeHaystack(
    `${recommendation.title}\n${recommendation.action}\n${recommendation.reason}`,
  );
  return haystack.includes(phrase);
}

export function recommendationHitsSoonReplaced(
  recommendation: Pick<Recommendation, "relatedItemIds">,
  soonReplacedItemIds: readonly string[],
): boolean {
  return recommendation.relatedItemIds.some((id) => soonReplacedItemIds.includes(id));
}

export function knownCostExceedsBudget(
  recommendation: Pick<Recommendation, "cost">,
  budget: { amount: number; currency: string } | null,
): boolean {
  if (budget === null) return false;
  if (!recommendation.cost.known || recommendation.cost.min === null) return false;
  if (recommendation.cost.currency !== budget.currency) return false;
  return recommendation.cost.min > budget.amount;
}

export type SessionGateKind =
  | "irreversible_missing_evidence"
  | "protected_constraint"
  | "opportunity_cost"
  | "over_budget";

/** Vista mínima para el freno de sesión: motor y servicio deben coincidir. */
export interface SessionGateView {
  unresolvedBlockingUnknowns: readonly string[];
  constraintLabels: readonly string[];
  constraintItemIds: readonly string[];
  soonReplacedItemIds: readonly string[];
  status: string | null;
  budget: { amount: number; currency: string } | null;
}

export function sessionGateViewFromSession(
  session: DecisionSession | null,
  budget: { amount: number; currency: string } | null = null,
): SessionGateView {
  const digest = sessionMemoryDigest(session);
  return {
    unresolvedBlockingUnknowns: digest.unresolvedBlockingUnknowns,
    constraintLabels: digest.constraintLabels,
    constraintItemIds: digest.constraintItemIds,
    soonReplacedItemIds: digest.soonReplacedItemIds,
    status: digest.status,
    budget,
  };
}

/**
 * Orden fijo: evidencia crítica, restricción protegida, pieza a sustituir,
 * presupuesto. Si el primero choca, no se mira el segundo mejor.
 */
export function evaluateSessionGate(
  recommendation: Pick<
    Recommendation,
    "title" | "action" | "reason" | "relatedItemIds" | "irreversible" | "cost"
  >,
  view: SessionGateView,
): { kind: SessionGateKind; label: string } | null {
  if (view.status !== null && !sessionIsOpen(view.status)) return null;

  const unknowns = view.unresolvedBlockingUnknowns;
  if (recommendation.irreversible && unknowns.length > 0) {
    return {
      kind: "irreversible_missing_evidence",
      label: unknowns[0] ?? "un dato crítico",
    };
  }

  if (
    view.constraintItemIds.some((id) => recommendation.relatedItemIds.includes(id))
  ) {
    return {
      kind: "protected_constraint",
      label: view.constraintLabels[0] ?? "una pieza protegida",
    };
  }
  const conflictLabel = view.constraintLabels.find((label) => {
    const phrase = label.trim().toLowerCase();
    if (phrase.length < 3) return false;
    const haystack = `${recommendation.title}\n${recommendation.action}\n${recommendation.reason}`.toLowerCase();
    return haystack.includes(phrase);
  });
  if (conflictLabel !== undefined) {
    return { kind: "protected_constraint", label: conflictLabel };
  }

  if (recommendationHitsSoonReplaced(recommendation, view.soonReplacedItemIds)) {
    return { kind: "opportunity_cost", label: "pieza a sustituir" };
  }
  if (knownCostExceedsBudget(recommendation, view.budget)) {
    return { kind: "over_budget", label: "presupuesto" };
  }
  return null;
}

/** Texto de reapertura: coincidencia literal normalizada, no «demostración». */
export function evidenceMatchesReopenCondition(
  evidenceText: string,
  reopenWhen: string | null,
): boolean {
  if (reopenWhen === null) return false;
  const needle = normalizeHaystack(reopenWhen);
  if (needle.length < 4) return false;
  return normalizeHaystack(evidenceText).includes(needle);
}

export const SESSION_KIND_LABELS: Record<DecisionSessionKind, string> = {
  skill_experiment: "Experimento de habilidad",
  equipment_investment: "Inversión de equipo",
  guided_decision: "Decisión guiada",
};

export const SESSION_STATUS_LABELS: Record<DecisionSessionStatus, string> = {
  active: "En curso",
  waiting_result: "Esperando lo que observes",
  paused: "En pausa",
  completed: "Completada",
  discarded: "Descartada",
  reopening: "Candidata a revisar",
};

export const CONCLUSION_LABELS: Record<DecisionConclusionKind, string> = {
  continue: "Seguimos comprobando lo mismo",
  change_strategy: "Cambiamos de plan",
  pause: "Pausa: conservamos el recurso",
  discard: "Descartada, con motivo",
  complete: "Damos este paso por cerrado",
  reopen: "Vuelve a ser candidata",
};

export const EVIDENCE_KIND_LABELS: Record<SessionEvidenceKind, string> = {
  confirmed: "Dato que has confirmado",
  inferred: "Indicio, no medido",
  unverified: "Todavía sin verificar",
  player_subjective: "Tu sensación, no una medición",
};
