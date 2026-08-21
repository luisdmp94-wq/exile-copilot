import { createHash } from "node:crypto";
import type {
  Budget,
  BuildTarget,
  CharacterProfile,
  ConfidenceLevel,
  CostEstimate,
  CurrencyKind,
  Goal,
  PriceQuote,
  Recommendation,
  RecommendationMemory,
  RecommendationMemoryEntry,
  RecommendationMemoryImpact,
  SourceEvidence,
} from "../../shared/domain.js";
import { compactJournalTitle } from "../../shared/domain.js";
import type { MarketRates } from "../../shared/api.js";
import {
  ENGINE_VERSION,
  RULES,
  type Magnitude,
  type RuleCandidate,
} from "./rules.js";
import type { PriceQuery, QuotesResult } from "../services/poeninja.js";
import {
  evaluateSessionGate,
  recommendationConflictsConstraint,
  sessionIsOpen,
  type SessionGateKind,
} from "../../shared/decisionSession.js";

/**
 * Motor de recomendaciones 100 % determinista (sin IA).
 *
 * Puntuación: score = impacto × pesoGoal − penalizaciónCoste − penalizaciónRiesgo.
 * La penalización por coste solo se aplica cuando el presupuesto se puede
 * CONVERTIR de forma verificada a la moneda de cotización (rates de poe.ninja);
 * sin tasas nunca se afirma que algo entra (o no) en el presupuesto.
 * NUNCA genera DPS ficticio ni rangos de precio inventados.
 */

/** Contrato mínimo de precios que el motor necesita (inyección de dependencia). */
export interface PriceLookup {
  getQuotes(queries: PriceQuery[], league: string): Promise<QuotesResult>;
}

export interface EngineOptions {
  budget: Budget;
  goal: Goal;
  league: string;
  patch: string;
  target?: BuildTarget;
  memory?: RecommendationMemory;
}

export interface EngineResult {
  recommendations: Recommendation[];
  generatedAt: string;
  engineVersion: string;
  inputFingerprint: string;
  memoryImpact: RecommendationMemoryImpact;
}

const MAGNITUDE_VALUE: Record<Magnitude, number> = { low: 1, medium: 2, high: 3 };
const RISK_PENALTY: Record<"low" | "medium" | "high", number> = { low: 0, medium: 0.4, high: 0.9 };
/** Penalización si el coste conocido supera el presupuesto (tras conversión verificada). */
const OVER_BUDGET_PENALTY = 1.5;

function downgrade(conf: ConfidenceLevel): ConfidenceLevel {
  if (conf === "high") return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Fingerprint estable de los inputs (sha256, claves ordenadas)
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

export function computeInputFingerprint(input: {
  profile: CharacterProfile;
  target?: BuildTarget;
  budget: Budget;
  goal: Goal;
  league: string;
  patch: string;
  memory?: RecommendationMemory;
}): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

const MEMORY_GOAL_WEIGHTS: RuleCandidate["goalWeights"] = {
  damage: 1.3,
  survival: 1.3,
  mapping: 1.3,
  bossing: 1.3,
  balanced: 1.3,
};

/**
 * Si una regla vuelve a activarse después de que el jugador ya informara del
 * resultado, no repetimos la mejora a ciegas. Se reemplaza por UNA acción de
 * reconciliación de datos. El resultado libre se conserva como evidencia,
 * pero nunca se analiza para deducir números o mods.
 */
function reconcileCandidateWithMemory(
  candidate: RuleCandidate,
  memoryEntry: RecommendationMemoryEntry,
): RuleCandidate {
  const originalRecommendationId = `rec-${candidate.ruleId}`;
  return {
    ruleId: `memoria-${candidate.ruleId}`,
    title: compactJournalTitle(`Actualizar el perfil tras «${memoryEntry.title}»`),
    action:
      `Actualiza en «Mi personaje» los datos afectados por «${memoryEntry.title}» ` +
      "usando el resultado que guardaste; después vuelve a generar recomendaciones.",
    reason:
      `El diario registra que ya completaste «${memoryEntry.title}», pero el perfil ` +
      `actual todavía activa «${candidate.title}». El mentor no repetirá esa mejora ` +
      "hasta reconciliar el resultado con los datos actuales.",
    impactMetric: "calidad de los datos del personaje",
    impactDescription:
      "Evita repetir una acción basándose en un perfil que puede haber quedado desactualizado.",
    magnitude: "high",
    riskLevel: "low",
    riskDescription: "Solo actualiza la memoria estructurada; no modifica objetos del juego.",
    mayLoseValuableMods: false,
    irreversible: false,
    priceQueries: [],
    goalWeights: MEMORY_GOAL_WEIGHTS,
    confidenceBase: "high",
    unverified: [
      `No verificado — el resultado guardado no se convierte automáticamente en estadísticas. ` +
        `La recomendación ${originalRecommendationId} sigue activándose con el perfil actual.`,
    ],
    extraSources: [
      ...candidate.extraSources,
      {
        kind: "user",
        label: `Resultado del diario informado por el jugador: ${memoryEntry.title}`,
        retrievedAt: memoryEntry.updatedAt,
        ...(memoryEntry.patch ? { patch: memoryEntry.patch } : {}),
      },
    ],
    relatedItemIds: Array.from(
      new Set([...(candidate.relatedItemIds ?? []), ...memoryEntry.relatedItemIds]),
    ).slice(0, 100),
  };
}

// ---------------------------------------------------------------------------
// Conversión de presupuesto con tasas verificadas de poe.ninja
// ---------------------------------------------------------------------------

/**
 * Convierte el presupuesto a la moneda de cotización.
 * rates.values de poe.ninja: unidades de X por 1 unidad de la moneda primaria
 * (p. ej. rates.values.exalted = 1000 → 1 divine = 1000 exalted).
 * Devuelve null si la conversión no es verificable (sin tasas o tasas NO
 * verificadas: fixture/caché antigua). El motor NUNCA usa tasas no
 * verificadas para afirmar que algo entra o no en el presupuesto.
 */
export function convertBudget(
  budget: Budget,
  quoteCurrency: CurrencyKind,
  rates: MarketRates | null,
): number | null {
  if (budget.currency === quoteCurrency) return budget.amount;
  if (!rates || !rates.verified) return null;
  const budgetRate = rates.values[budget.currency]; // unidades de la moneda del presupuesto por 1 primaria
  if (typeof budgetRate !== "number" || budgetRate <= 0) return null;
  return budget.amount / budgetRate;
}

interface ScoredCandidate {
  candidate: RuleCandidate;
  score: number;
  cost: CostEstimate;
  quote: PriceQuote | null;
  unverified: string[];
  confidence: ConfidenceLevel;
  extraSources: SourceEvidence[];
}

async function resolveCost(
  candidate: RuleCandidate,
  options: EngineOptions,
  priceService: PriceLookup | null,
  unverified: string[],
): Promise<{ cost: CostEstimate; quote: PriceQuote | null; overBudget: boolean }> {
  const unknownCost = {
    cost: { min: null, max: null, currency: options.budget.currency, known: false } satisfies CostEstimate,
    quote: null,
    overBudget: false,
  };

  if (candidate.priceQueries.length === 0) {
    if (!unverified.some((u) => u.includes("coste"))) {
      unverified.push("No verificado — coste no estimado: esta acción no tiene un precio consultable.");
    }
    return unknownCost;
  }
  if (!priceService) {
    unverified.push("No verificado — servicio de precios no disponible para valorar la mejora.");
    return unknownCost;
  }

  const { quotes, rates } = await priceService.getQuotes(candidate.priceQueries, options.league);
  const usable = quotes.find((q) => q.verified && q.value !== null);
  if (!usable || usable.value === null) {
    unverified.push(
      `No verificado — no hay precio confirmado en poe.ninja para: ${candidate.priceQueries.map((q) => q.name).join(", ")}.`,
    );
    return { ...unknownCost, quote: quotes[0] ?? null };
  }

  // Coste puntual verificado: NUNCA un rango inventado (max queda null).
  const cost: CostEstimate = { min: usable.value, max: null, currency: usable.currency, known: true };

  // Comparación con el presupuesto SOLO si la conversión es verificable.
  const budgetConverted = convertBudget(options.budget, usable.currency, rates);
  if (budgetConverted === null) {
    unverified.push(
      `No verificado si entra en el presupuesto: el coste cotiza en ${usable.currency} y no hay tasas de conversión verificadas desde ${options.budget.currency}.`,
    );
    return { cost, quote: usable, overBudget: false };
  }
  return { cost, quote: usable, overBudget: usable.value > budgetConverted };
}

function computeScore(
  candidate: RuleCandidate,
  overBudget: boolean,
  goalKind: Goal["kind"],
): number {
  const impact = MAGNITUDE_VALUE[candidate.magnitude];
  const weight = candidate.goalWeights[goalKind] ?? 1;
  let score = impact * weight - RISK_PENALTY[candidate.riskLevel];
  if (overBudget) score -= OVER_BUDGET_PENALTY;
  return score;
}

export async function generateRecommendations(
  profile: CharacterProfile,
  options: EngineOptions,
  deps: { priceService?: PriceLookup | null } = {},
): Promise<EngineResult> {
  const generatedAt = new Date().toISOString();
  const memoryImpact: RecommendationMemoryImpact = {
    revision: options.memory?.revision ?? null,
    blockedByPrimaryEntryId: options.memory?.primaryEntry?.entryId ?? null,
    usedEntryIds: [],
    repeatedRecommendationIds: [],
  };

  // Regla de producto: mientras exista una única acción activa, el mentor se
  // detiene. No consulta precios ni genera tareas paralelas.
  if (options.memory?.primaryEntry) {
    memoryImpact.usedEntryIds.push(options.memory.primaryEntry.entryId);
    return {
      recommendations: [],
      generatedAt,
      engineVersion: ENGINE_VERSION,
      inputFingerprint: computeInputFingerprint({
        profile,
        budget: options.budget,
        goal: options.goal,
        league: options.league,
        patch: options.patch,
        memory: options.memory,
        ...(options.target !== undefined ? { target: options.target } : {}),
      }),
      memoryImpact,
    };
  }
  const ctx = {
    profile,
    league: options.league,
    patch: options.patch,
    ...(options.target !== undefined ? { target: options.target } : {}),
  };

  // `recentCompleted` llega de más reciente a más antiguo. Conservamos la
  // primera entrada por recomendación para no sustituirla accidentalmente por
  // un intento anterior al construir el Map.
  const completedByRecommendationId = new Map<string, RecommendationMemoryEntry>();
  for (const entry of options.memory?.recentCompleted ?? []) {
    if (
      entry.recommendationId !== null &&
      !completedByRecommendationId.has(entry.recommendationId)
    ) {
      completedByRecommendationId.set(entry.recommendationId, entry);
    }
  }
  const candidates = RULES.flatMap((rule) => rule(ctx)).map((candidate) => {
    const recommendationId = `rec-${candidate.ruleId}`;
    const memoryEntry = completedByRecommendationId.get(recommendationId);
    if (!memoryEntry) return candidate;
    memoryImpact.usedEntryIds.push(memoryEntry.entryId);
    memoryImpact.repeatedRecommendationIds.push(recommendationId);
    return reconcileCandidateWithMemory(candidate, memoryEntry);
  });
  memoryImpact.usedEntryIds = Array.from(new Set(memoryImpact.usedEntryIds));
  memoryImpact.repeatedRecommendationIds = Array.from(
    new Set(memoryImpact.repeatedRecommendationIds),
  );
  const priceService = deps.priceService ?? null;

  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    const unverified = [...candidate.unverified];
    const { cost, quote, overBudget } = await resolveCost(candidate, options, priceService, unverified);

    let confidence: ConfidenceLevel = candidate.confidenceBase;
    // Sin coste confirmado cuando la regla lo necesita → un escalón menos de confianza.
    if (candidate.priceQueries.length > 0 && !cost.known) confidence = downgrade(confidence);
    if (unverified.length > 1) confidence = downgrade(confidence);

    scored.push({
      candidate,
      score: computeScore(candidate, overBudget, options.goal.kind),
      cost,
      quote,
      unverified,
      confidence,
      extraSources: candidate.extraSources,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.candidate.ruleId.localeCompare(b.candidate.ruleId));
  const top = scored.slice(0, 3);

  const recommendations: Recommendation[] = top.map((entry, index) => {
    const { candidate, cost, quote, unverified, confidence, extraSources } = entry;
    const relatedItemIds = (candidate.relatedItemIds ?? []).slice(0, 100);
    if ((candidate.relatedItemIds?.length ?? 0) > relatedItemIds.length) {
      unverified.push(
        `No verificado — se omitieron ${(candidate.relatedItemIds?.length ?? 0) - relatedItemIds.length} vínculos de objeto por el límite de 100.`,
      );
    }

    const sources: SourceEvidence[] = [
      {
        kind: "calculation",
        label: `Motor de reglas determinista Exile Copilot v${ENGINE_VERSION}`,
        retrievedAt: generatedAt,
        patch: options.patch,
      },
      {
        kind: "user",
        label: "Perfil del personaje importado por el usuario",
        retrievedAt: profile.importedAt,
        patch: profile.patch,
      },
      ...extraSources,
    ];
    if (quote) {
      sources.push({
        kind: "poe.ninja",
        label: "API económica pública documentada de poe.ninja (PoE2)",
        url: "https://poe.ninja/",
        retrievedAt: quote.fetchedAt,
      });
    }

    const dataUpdatedAt = quote?.fetchedAt ?? generatedAt;

    return {
      id: `rec-${candidate.ruleId}`,
      priority: index + 1,
      title: candidate.title,
      action: candidate.action,
      reason: candidate.reason,
      actionKind: candidate.ruleId.startsWith("memoria-")
        ? "profile_sync"
        : "game_change",
      cost,
      impact: {
        metric: candidate.impactMetric,
        description: candidate.impactDescription,
        magnitude: candidate.magnitude,
        isPartialMetric: true, // nunca DPS ficticio
      },
      risk: { level: candidate.riskLevel, description: candidate.riskDescription },
      mayLoseValuableMods: candidate.mayLoseValuableMods,
      irreversible: candidate.irreversible,
      patch: options.patch,
      sources,
      dataUpdatedAt,
      confidence,
      unverified,
      relatedItemIds,
    };
  });

  const gated = applySessionGates(recommendations, options.memory, options.budget, generatedAt);

  return {
    recommendations: gated,
    generatedAt,
    engineVersion: ENGINE_VERSION,
    inputFingerprint: computeInputFingerprint({
      profile,
      budget: options.budget,
      goal: options.goal,
      league: options.league,
      patch: options.patch,
      ...(options.target !== undefined ? { target: options.target } : {}),
      ...(options.memory !== undefined ? { memory: options.memory } : {}),
    }),
    memoryImpact,
  };
}

function sessionGateRecommendation(
  id: string,
  title: string,
  action: string,
  reason: string,
  generatedAt: string,
  patch: string,
  relatedItemIds: string[],
  sourceLabel = "Restricción o evidencia de la sesión de decisión",
): Recommendation {
  return {
    id,
    priority: 1,
    title,
    action,
    reason,
    actionKind: "session_gate",
    cost: { min: null, max: null, currency: "exalted", known: false },
    impact: {
      metric: "decisión",
      description: "El mentor frena o redirige el plan; no es una compra.",
      magnitude: "medium",
      isPartialMetric: true,
    },
    risk: { level: "low", description: "No se ejecuta un cambio irreversible." },
    mayLoseValuableMods: false,
    irreversible: false,
    patch,
    sources: [
      {
        kind: "user",
        label: sourceLabel,
        retrievedAt: generatedAt,
        patch,
      },
    ],
    dataUpdatedAt: generatedAt,
    confidence: "medium",
    unverified: ["El mentor no autoriza este paso hasta que se resuelva el conflicto o la evidencia."],
    relatedItemIds,
  };
}

/**
 * La sesión no reordena el motor por puntuación: si el primero choca, se muestra
 * el conflicto. Nunca se sustituye en silencio por el segundo mejor.
 */
function applySessionGates(
  recommendations: Recommendation[],
  memory: RecommendationMemory | undefined,
  budget: Budget,
  generatedAt: string,
): Recommendation[] {
  if (recommendations.length === 0) return recommendations;
  const first = recommendations[0];
  if (!first) return recommendations;

  // La identidad core pertenece a la build, no a una sesión temporal. Solo se
  // frena cuando el vínculo es demostrable por ids o por la coincidencia
  // explícita ya soportada; el texto no se interpreta como mecánica de PoE2.
  const coreConflict = memory?.build.entries
    .filter((entry) => entry.active && entry.kind === "core")
    .find((entry) =>
      recommendationConflictsConstraint(first, {
        id: entry.id,
        label: entry.label,
        relatedItemIds: entry.relatedItemIds,
        protected: true,
      }),
    );
  if (coreConflict) {
    return [
      sessionGateRecommendation(
        "rec-memoria-build-core",
        "Conflicto con la identidad de la build",
        `No toques «${coreConflict.label}». Está marcado como Core en la memoria de esta build.`,
        `La prioridad calculada choca con «${coreConflict.label}». El mentor se detiene en vez de romper una pieza esencial.`,
        generatedAt,
        first.patch,
        first.relatedItemIds,
        "Identidad Core declarada por el jugador en la memoria de la build",
      ),
    ];
  }

  const session = memory?.session;
  if (!session?.sessionId) return recommendations;
  if (session.status === null || !sessionIsOpen(session.status)) {
    return recommendations;
  }

  const gate = evaluateSessionGate(first, {
    unresolvedBlockingUnknowns: session.unresolvedBlockingUnknowns,
    constraintLabels: session.constraintLabels,
    constraintItemIds: session.constraintItemIds,
    soonReplacedItemIds: session.soonReplacedItemIds,
    status: session.status,
    budget,
  });
  if (gate === null) {
    return recommendations.map((rec, index) => ({ ...rec, priority: index + 1 }));
  }

  const copy: Record<
    SessionGateKind,
    { id: string; title: string; action: string; reason: string }
  > = {
    irreversible_missing_evidence: {
      id: "rec-sesion-evidencia-critica",
      title: "Falta un dato crítico",
      action: `Anota exactamente: ${gate.label}. No uses todavía el paso irreversible.`,
      reason: `Sin «${gate.label}» el mentor no autoriza una acción que no se puede deshacer.`,
    },
    protected_constraint: {
      id: "rec-sesion-restriccion-core",
      title: "Conflicto con una pieza protegida",
      action: `No toques «${gate.label}». Está marcada como intocable.`,
      reason: `La mejor puntuación del motor chocaba con «${gate.label}». No se sustituye por otra compra en silencio.`,
    },
    opportunity_cost: {
      id: "rec-sesion-oportunidad",
      title: "Mejor conservar el recurso",
      action: "No gastes en esa pieza: se sustituirá pronto.",
      reason: "Una mejora estadística sigue siendo mala si el objeto no se va a quedar.",
    },
    over_budget: {
      id: "rec-sesion-presupuesto",
      title: "Pausa por presupuesto",
      action: "No fuerces esta compra: el coste conocido supera lo que aceptaste.",
      reason: "Superar el presupuesto no es un fracaso del plan; es una pausa.",
    },
  };
  const text = copy[gate.kind];
  return [
    sessionGateRecommendation(
      text.id,
      text.title,
      text.action,
      text.reason,
      generatedAt,
      first.patch,
      first.relatedItemIds,
    ),
  ];
}
