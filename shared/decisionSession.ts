import { z } from "zod";
import type { CharacterProfile, Recommendation } from "./domain.js";
import {
  BudgetSchema,
  GoalKind,
  ItemRarity,
  ItemSchema,
  RecommendationSchema,
  RiskLevel,
} from "./domain.js";
import { CraftingGoalCategorySchema } from "./craftingGoal.js";

/** Límites duros: el historial no crece sin cota. */
export const MAX_SESSION_EVENTS = 40;
/**
 * Plazas EXTRA reservadas para transiciones terminales (pausar, registrar el
 * resultado, descartar).
 *
 * `MAX_SESSION_EVENTS` sigue acotando el material que se puede acumular
 * (restricciones y evidencia). Las transiciones que cierran o aparcan la sesión
 * disponen además de esta reserva, de modo que una sesión con el historial
 * lleno SIEMPRE puede cerrarse. Antes, al llegar a 40 el servidor rechazaba
 * también el cierre: el mensaje pedía «ciérrala o páusala» y ésas eran justo
 * las dos acciones que ya no permitía.
 */
export const RESERVED_TERMINAL_EVENTS = 2;
export const MAX_NON_TERMINAL_SESSION_EVENTS = MAX_SESSION_EVENTS;
export const MAX_SESSION_EVENTS_HARD_CAP =
  MAX_SESSION_EVENTS + RESERVED_TERMINAL_EVENTS;

/** Triggers que cierran o aparcan la sesión: pueden usar la reserva. */
const TERMINAL_TRIGGERS: ReadonlySet<string> = new Set([
  "paused",
  "result_recorded",
  "discarded",
]);

export function isTerminalSessionTrigger(trigger: string): boolean {
  return TERMINAL_TRIGGERS.has(trigger);
}
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

/**
 * Valoración corta del jugador al volver de probar una acción.
 *
 * No pretende ser una medición de PoE2 ni interpreta el comentario libre. Es
 * una señal estructurada que permite cerrar o mantener abierto el caso sin que
 * el servidor tenga que adivinar el significado de una frase.
 */
export const DecisionOutcome = z.enum([
  "resolved",
  "improved",
  "unchanged",
  "worse",
  "different",
]);
export type DecisionOutcome = z.infer<typeof DecisionOutcome>;

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

/** Contexto estructurado de una única moneda de crafting guiada. */
export const CraftingExperimentSchema = z.object({
  actionId: z.enum(["transmutation", "augmentation", "regal", "exalted", "essence", "alloy"]),
  /** Etiqueta exacta de la moneda; en sesiones antiguas puede ser la genérica. */
  actionLabel: z.string().trim().min(1).max(100),
  /** Ausentes en sesiones anteriores: no se presupone que usaran la variante base. */
  variantId: z.enum(["base", "lesser", "normal", "greater", "perfect", "corrupted"]).optional(),
  variantLabel: z.string().trim().min(1).max(50).optional(),
  minimumModifierLevel: z.number().int().nonnegative().nullable().optional(),
  /** Datos de resultado explícitos para acciones que reemplazan un afijo. */
  resultRarity: ItemRarity.optional(),
  expectedRemovedModifierCount: z.number().int().min(0).max(1).optional(),
  expectedAddedCrafted: z.boolean().optional(),
  maximumCraftedModifierCount: z.number().int().positive().optional(),
  guaranteedModifierText: z.string().trim().min(1).max(500).optional(),
  resultUnknownLabel: z.string().trim().min(1).max(500).optional(),
  /** Ausente en sesiones anteriores; nunca se deduce del texto libre. */
  goalCategory: CraftingGoalCategorySchema.optional(),
  desiredOutcome: z.string().trim().min(1).max(500),
  /** Ids del snapshot original que el jugador declaró imprescindibles. */
  protectedModifierIds: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
  originalItem: ItemSchema,
});
export type CraftingExperiment = z.infer<typeof CraftingExperimentSchema>;

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
  /** Ausente o `null` para sesiones normales y sesiones antiguas. */
  craftingExperiment: CraftingExperimentSchema.nullable().optional(),
  activeAction: SessionActiveActionSchema.nullable().default(null),
  /**
   * Recomendación (o plan manual) que un freno dejó sin ejecutar, conservada
   * VALIDADA y completa: fuentes, coste, riesgo e ids. Al resolver la incógnita
   * crítica se reevalúa el freno y, si ya es seguro, se restaura esta acción en
   * lugar de perderla. `null` cuando no hay nada frenado.
   */
  blockedRecommendation: RecommendationSchema.nullable().default(null),
  /**
   * Presupuesto aceptado al abrir la decisión. Se guarda porque al reevaluar un
   * freno (por ejemplo tras resolver la incógnita crítica) hay que volver a
   * comparar el coste con el MISMO presupuesto, no con uno improvisado.
   */
  budget: BudgetSchema.nullable().default(null),
  /**
   * Objetivo del jugador al abrir la decisión (`GoalKind`, no un string libre).
   *
   * `null` significa DESCONOCIDO, no «equilibrado»: las sesiones guardadas antes
   * de que existiera este campo se cargan así y no se les inventa un objetivo
   * que nadie eligió.
   */
  goal: GoalKind.nullable().default(null),
  lastResult: z
    .object({
      text: z.string().trim().min(1).max(4000),
      subjective: z.boolean(),
      /** `null` en sesiones anteriores al Hito 6C: no se inventa un resultado. */
      outcome: DecisionOutcome.nullable().default(null),
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
/** Protección con sus ids: NUNCA se aplana, o el conflicto citaría otra. */
export const SessionConstraintDigestSchema = z.object({
  label: z.string(),
  itemIds: z.array(z.string()).max(20),
});
export type SessionConstraintDigest = z.infer<typeof SessionConstraintDigestSchema>;

export const SessionMemoryDigestSchema = z.object({
  sessionId: z.string().min(1).nullable(),
  status: DecisionSessionStatus.nullable(),
  /**
   * Fuente de verdad del conflicto: cada label con SUS ids. Los dos arrays
   * planos de abajo se derivan de aquí y se conservan solo porque el motor y la
   * memoria ya los publicaban; no deben usarse para decidir qué label mostrar.
   */
  constraints: z.array(SessionConstraintDigestSchema).max(MAX_SESSION_CONSTRAINTS),
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
    constraints: [],
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
  const active = session.constraints.filter((constraint) => constraint.protected);
  return SessionMemoryDigestSchema.parse({
    sessionId: session.id,
    status: session.status,
    constraints: active.map((constraint) => ({
      label: constraint.label,
      itemIds: constraint.relatedItemIds,
    })),
    constraintLabels: active.map((constraint) => constraint.label),
    constraintItemIds: active.flatMap((constraint) => constraint.relatedItemIds),
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

/**
 * Huella del personaje para una sesión.
 *
 * Debe cambiar ante CUALQUIER cambio que pueda invalidar una decisión en curso:
 * nivel, liga, parche, vida y defensas, atributos, resistencias, habilidades,
 * pasivas y el CONTENIDO del equipo (slot, id, base, rareza, calidad,
 * requisitos, estados de crafting y mods) — no solo el id del objeto, que
 * sobrevive a una edición.
 *
 * No entra nada volátil: ni fechas (`retrievedAt`, `dataUpdatedAt`), ni
 * `sources`, ni `rawText`. Todas las colecciones se ORDENAN por una clave
 * estable, de modo que reordenar un array sin cambiar su contenido no altera
 * la huella (y al revés: cambiar el contenido siempre la altera).
 */
export function characterSessionFingerprint(
  profile: CharacterProfile,
): string {
  const byKey = <T>(values: readonly T[], key: (value: T) => string): T[] =>
    [...values].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));

  const items = byKey(profile.items, (item) => `${item.slot}|${item.id}`).map((item) => ({
    id: item.id,
    slot: item.slot,
    name: item.name,
    baseType: item.baseType,
    rarity: item.rarity,
    itemLevel: item.itemLevel ?? null,
    quality: item.quality ?? null,
    requirements: {
      level: item.requirements?.level ?? null,
      str: item.requirements?.str ?? null,
      dex: item.requirements?.dex ?? null,
      int: item.requirements?.int ?? null,
    },
    craftingState: item.craftingState
      ? {
          corrupted: item.craftingState.corrupted,
          mirrored: item.craftingState.mirrored,
          split: item.craftingState.split,
          unidentified: item.craftingState.unidentified,
        }
      : null,
    // El texto del mod es lo que el jugador ve; el id puede regenerarse.
    modifiers: byKey(
      item.modifiers.map((modifier) => ({
        kind: modifier.kind,
        text: modifier.text,
        values: modifier.values,
        affix: modifier.affix ?? null,
        name: modifier.name ?? null,
        tier: modifier.tier ?? null,
        tags: modifier.tags ? [...modifier.tags].sort() : [],
        crafted: modifier.crafted ?? false,
        desecrated: modifier.desecrated ?? false,
      })),
      (modifier) => `${modifier.kind}|${modifier.text}`,
    ),
  }));

  const skills = byKey(profile.skills, (skill) => `${skill.id}|${skill.mainSkill}`).map(
    (skill) => ({
      id: skill.id,
      label: skill.label,
      mainSkill: skill.mainSkill,
      mainSkillGemId: skill.mainSkillGemId,
      supports: byKey(
        skill.supports.map((support) => ({ name: support.name, gemId: support.gemId })),
        (support) => `${support.name}|${support.gemId ?? ""}`,
      ),
    }),
  );

  const passives = byKey(
    profile.passives.allocated.map((node) => ({
      ref: node.ref,
      isOfficialId: node.isOfficialId,
      additionalText: node.additionalText ?? null,
    })),
    (node) => node.ref,
  );

  return sessionFingerprintHash(
    JSON.stringify({
      id: profile.id,
      name: profile.name,
      characterClass: profile.characterClass,
      ascendancy: profile.ascendancy,
      ascendancyId: profile.ascendancyId,
      level: profile.level,
      league: profile.league,
      patch: profile.patch,
      defences: {
        life: profile.life ?? null,
        energyShield: profile.energyShield ?? null,
        evasion: profile.evasion ?? null,
        armour: profile.armour ?? null,
      },
      attributes: profile.attributes,
      resistances: profile.resistances,
      items,
      skills,
      passives,
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
  /**
   * Protecciones con SUS ids. `constraintLabels`/`constraintItemIds` siguen
   * aceptándose para los llamadores antiguos, pero solo como respaldo: el
   * conflicto se resuelve siempre contra estos pares.
   */
  constraints?: ReadonlyArray<{ label: string; itemIds: readonly string[] }>;
  constraintLabels: readonly string[];
  constraintItemIds: readonly string[];
  soonReplacedItemIds: readonly string[];
  status: string | null;
  budget: { amount: number; currency: string } | null;
}

/** Pares label→ids desde la vista, tolerando llamadores que solo dan los planos. */
function gateConstraints(
  view: SessionGateView,
): ReadonlyArray<{ label: string; itemIds: readonly string[] }> {
  if (view.constraints !== undefined) return view.constraints;
  // Respaldo: sin la relación original solo se puede emparejar por posición.
  return view.constraintLabels.map((label, index) => ({
    label,
    itemIds:
      view.constraintItemIds[index] === undefined ? [] : [view.constraintItemIds[index]!],
  }));
}

export function sessionGateViewFromSession(
  session: DecisionSession | null,
  budget: { amount: number; currency: string } | null = null,
): SessionGateView {
  const digest = sessionMemoryDigest(session);
  return {
    unresolvedBlockingUnknowns: digest.unresolvedBlockingUnknowns,
    constraints: digest.constraints,
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

  // El conflicto por id se atribuye a la protección que POSEE ese id, no a la
  // primera de la lista: si no, el jugador leería el nombre de otra protección.
  const byItemId = gateConstraints(view).find((constraint) =>
    constraint.itemIds.some((id) => recommendation.relatedItemIds.includes(id)),
  );
  if (byItemId !== undefined) {
    return { kind: "protected_constraint", label: byItemId.label };
  }
  const haystack =
    `${recommendation.title}\n${recommendation.action}\n${recommendation.reason}`.toLowerCase();
  const byPhrase = gateConstraints(view).find((constraint) => {
    const phrase = constraint.label.trim().toLowerCase();
    return phrase.length >= 3 && haystack.includes(phrase);
  });
  if (byPhrase !== undefined) {
    return { kind: "protected_constraint", label: byPhrase.label };
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

export const DECISION_OUTCOME_LABELS: Record<DecisionOutcome, string> = {
  resolved: "Problema resuelto",
  improved: "Mejoró, pero continúa",
  unchanged: "Sigue igual",
  worse: "Empeoró",
  different: "Ocurrió algo diferente",
};

/**
 * Semántica determinista del regreso del jugador.
 *
 * Solo «resuelto» cierra el caso automáticamente. Una mejora parcial, la
 * ausencia de cambio o un empeoramiento conservan la misma decisión abierta:
 * sin datos nuevos el sistema no puede inventar otra estrategia. Un hallazgo
 * valioso sí cambia el plan porque el jugador lo nombra y el servicio lo
 * protege expresamente.
 */
export function conclusionForDecisionOutcome(
  outcome: DecisionOutcome,
  hasUnexpectedValuable = false,
): DecisionConclusionKind {
  if (hasUnexpectedValuable) return "change_strategy";
  return outcome === "resolved" ? "complete" : "continue";
}

/**
 * Guía observable derivada del impacto que YA declaró el motor. Se comparte
 * entre la recomendación y la sesión para que el servidor no la sustituya por
 * un «mira qué pasa» genérico al empezar la prueba.
 */
export function observationMethodForExpectedImpact(
  expectedImpact: string,
): string {
  return `Confirma el cambio esperado: ${expectedImpact} Revisa qué dato del personaje cambió y si otra estadística o sensación empeoró.`;
}

export const EVIDENCE_KIND_LABELS: Record<SessionEvidenceKind, string> = {
  confirmed: "Dato que has confirmado",
  inferred: "Indicio, no medido",
  unverified: "Todavía sin verificar",
  player_subjective: "Tu sensación, no una medición",
};
