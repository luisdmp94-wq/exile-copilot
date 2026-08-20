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
  SourceEvidence,
} from "../../shared/domain.js";
import type { MarketRates } from "../../shared/api.js";
import {
  ENGINE_VERSION,
  RULES,
  type Magnitude,
  type RuleCandidate,
} from "./rules.js";
import type { PriceQuery, QuotesResult } from "../services/poeninja.js";

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
}

export interface EngineResult {
  recommendations: Recommendation[];
  generatedAt: string;
  engineVersion: string;
  inputFingerprint: string;
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
}): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
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
  const ctx = {
    profile,
    league: options.league,
    patch: options.patch,
    ...(options.target !== undefined ? { target: options.target } : {}),
  };

  const candidates = RULES.flatMap((rule) => rule(ctx));
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
      relatedItemIds: candidate.relatedItemIds ?? [],
    };
  });

  return {
    recommendations,
    generatedAt,
    engineVersion: ENGINE_VERSION,
    inputFingerprint: computeInputFingerprint({
      profile,
      budget: options.budget,
      goal: options.goal,
      league: options.league,
      patch: options.patch,
      ...(options.target !== undefined ? { target: options.target } : {}),
    }),
  };
}
