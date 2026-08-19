import type {
  Budget,
  CharacterProfile,
  ConfidenceLevel,
  CostEstimate,
  Goal,
  PriceQuote,
  Recommendation,
  SourceEvidence,
} from "../../shared/domain.js";
import { ENGINE_VERSION, RULES, type Magnitude, type RuleCandidate } from "./rules.js";
import type { QuotesResult } from "../services/poeninja.js";

/**
 * Motor de recomendaciones 100 % determinista (sin IA).
 *
 * Puntuación: score = impacto × pesoGoal − penalizaciónCoste − penalizaciónRiesgo.
 * Devuelve hasta 3 Recommendation ordenadas por prioridad. NUNCA genera DPS
 * ficticio: todos los impactos son métricas parciales etiquetadas.
 */

/** Contrato mínimo de precios que el motor necesita (inyección de dependencia). */
export interface PriceLookup {
  getQuotes(names: string[], league: string): Promise<QuotesResult>;
}

export interface EngineOptions {
  budget: Budget;
  goal: Goal;
  league: string;
  patch: string;
}

export interface EngineResult {
  recommendations: Recommendation[];
  generatedAt: string;
  engineVersion: string;
}

const MAGNITUDE_VALUE: Record<Magnitude, number> = { low: 1, medium: 2, high: 3 };
const RISK_PENALTY: Record<"low" | "medium" | "high", number> = { low: 0, medium: 0.4, high: 0.9 };
/** Penalización si el coste conocido supera el presupuesto (misma divisa). */
const OVER_BUDGET_PENALTY = 1.5;

function downgrade(conf: ConfidenceLevel): ConfidenceLevel {
  if (conf === "high") return "medium";
  return "low";
}

interface ScoredCandidate {
  candidate: RuleCandidate;
  score: number;
  cost: CostEstimate;
  quote: PriceQuote | null;
  unverified: string[];
  confidence: ConfidenceLevel;
}

async function resolveCost(
  candidate: RuleCandidate,
  options: EngineOptions,
  priceService: PriceLookup | null,
  unverified: string[],
): Promise<{ cost: CostEstimate; quote: PriceQuote | null }> {
  if (candidate.priceNames.length === 0) {
    unverified.push("No verificado — coste no estimado: esta acción no tiene un precio consultable.");
    return {
      cost: { min: null, max: null, currency: options.budget.currency, known: false },
      quote: null,
    };
  }
  if (!priceService) {
    unverified.push("No verificado — servicio de precios no disponible para valorar la mejora.");
    return {
      cost: { min: null, max: null, currency: options.budget.currency, known: false },
      quote: null,
    };
  }

  const { quotes } = await priceService.getQuotes(candidate.priceNames, options.league);
  const usable = quotes.find((q) => q.verified && q.value !== null);
  if (!usable || usable.value === null) {
    unverified.push(
      `No verificado — no hay precio confirmado en poe.ninja para: ${candidate.priceNames.join(", ")}.`,
    );
    return {
      cost: { min: null, max: null, currency: options.budget.currency, known: false },
      quote: quotes[0] ?? null,
    };
  }

  const min = usable.value;
  const max = Math.max(min, Math.round(min * 1.5 * 100) / 100);
  return {
    cost: { min, max, currency: usable.currency, known: true },
    quote: usable,
  };
}

function computeScore(
  candidate: RuleCandidate,
  cost: CostEstimate,
  budget: Budget,
  goalKind: Goal["kind"],
): number {
  const impact = MAGNITUDE_VALUE[candidate.magnitude];
  const weight = candidate.goalWeights[goalKind] ?? 1;
  let score = impact * weight - RISK_PENALTY[candidate.riskLevel];
  if (cost.known && cost.min !== null && cost.currency === budget.currency && cost.min > budget.amount) {
    score -= OVER_BUDGET_PENALTY;
  }
  return score;
}

export async function generateRecommendations(
  profile: CharacterProfile,
  options: EngineOptions,
  deps: { priceService?: PriceLookup | null } = {},
): Promise<EngineResult> {
  const generatedAt = new Date().toISOString();
  const ctx = { profile, league: options.league, patch: options.patch };

  const candidates = RULES.flatMap((rule) => rule(ctx));
  const priceService = deps.priceService ?? null;

  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    const unverified = [...candidate.unverified];
    const { cost, quote } = await resolveCost(candidate, options, priceService, unverified);

    let confidence: ConfidenceLevel = candidate.confidenceBase;
    // Sin coste confirmado cuando la regla lo necesita → un escalón menos de confianza.
    if (candidate.priceNames.length > 0 && !cost.known) confidence = downgrade(confidence);
    if (unverified.length > 1) confidence = downgrade(confidence);

    scored.push({
      candidate,
      score: computeScore(candidate, cost, options.budget, options.goal.kind),
      cost,
      quote,
      unverified,
      confidence,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.candidate.ruleId.localeCompare(b.candidate.ruleId));
  const top = scored.slice(0, 3);

  const recommendations: Recommendation[] = top.map((entry, index) => {
    const { candidate, cost, quote, unverified, confidence } = entry;

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
    ];
    if (quote) {
      sources.push({
        kind: "poe.ninja",
        label: "API económica pública de poe.ninja",
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
    };
  });

  return { recommendations, generatedAt, engineVersion: ENGINE_VERSION };
}
