import type { CraftingChance, VerifiedAttemptCost } from "./craftingProbability.js";
import { VerifiedAttemptCostSchema } from "./craftingProbability.js";

export interface CraftingSequenceStep {
  id: string;
  label: string;
  chance: CraftingChance;
  cost: VerifiedAttemptCost | null;
}

export interface CraftingSequenceUnavailable {
  status: "unavailable";
  reasons: string[];
}

export interface CraftingSequenceImpossible {
  status: "impossible";
  failedStepId: string;
  reason: string;
}

export interface CraftingSequenceExact {
  status: "exact";
  onePassSuccessProbability: number;
  expectedPassesToSuccess: number;
  stepReachProbabilities: Array<{ stepId: string; probability: number }>;
  expectedOnePassCost: { amount: number; currency: string } | null;
  /**
   * Solo existe si el llamador demuestra que cada fallo vuelve al mismo estado
   * inicial y aporta el coste completo de reinicio.
   */
  expectedCostUntilSuccess: { amount: number; currency: string } | null;
  limitations: string[];
}

export type CraftingSequenceAnalysis =
  | CraftingSequenceUnavailable
  | CraftingSequenceImpossible
  | CraftingSequenceExact;

export interface VerifiedRestartPolicy {
  verified: true;
  returnsToInitialState: true;
  resetCost: VerifiedAttemptCost;
  sourceLabel: string;
}

export interface CraftingStrategyCandidate {
  id: string;
  label: string;
  analysis: CraftingSequenceAnalysis;
}

export interface RankedCraftingStrategy {
  id: string;
  label: string;
  expectedCostUntilSuccess: { amount: number; currency: string };
  onePassSuccessProbability: number;
}

export type CraftingStrategyRanking =
  | {
      status: "ranked";
      currency: string;
      strategies: RankedCraftingStrategy[];
      excluded: Array<{ id: string; reason: string }>;
      limitation: string;
    }
  | {
      status: "unavailable";
      reasons: string[];
      excluded: Array<{ id: string; reason: string }>;
    };

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "es"));
}

/**
 * Calcula una secuencia de probabilidades CONDICIONALES ya verificadas.
 * No presupone independencia de pools: cada probabilidad debe describir el
 * estado que deja el paso anterior. El coste esperado hasta acertar queda
 * oculto salvo que exista una política de reinicio verificada.
 */
export function analyzeCraftingSequence(input: {
  steps: CraftingSequenceStep[];
  restartPolicy?: VerifiedRestartPolicy | null;
}): CraftingSequenceAnalysis {
  if (input.steps.length === 0) {
    return { status: "unavailable", reasons: ["La secuencia no contiene pasos."] };
  }

  const unavailable = input.steps.filter((step) => step.chance.status === "unavailable");
  if (unavailable.length > 0) {
    return {
      status: "unavailable",
      reasons: sortedUnique(
        unavailable.flatMap((step) =>
          step.chance.status === "unavailable"
            ? step.chance.reasons.map((reason) => `${step.label}: ${reason}`)
            : [],
        ),
      ),
    };
  }

  const impossible = input.steps.find((step) => step.chance.status === "impossible");
  if (impossible?.chance.status === "impossible") {
    return {
      status: "impossible",
      failedStepId: impossible.id,
      reason: `${impossible.label}: ${impossible.chance.reason}`,
    };
  }

  const exactSteps = input.steps.map((step) => {
    if (step.chance.status !== "exact") {
      throw new Error("Invariante rota: todos los pasos restantes deben ser exactos.");
    }
    return { ...step, chance: step.chance };
  });
  let reachProbability = 1;
  let onePassSuccessProbability = 1;
  const stepReachProbabilities: Array<{ stepId: string; probability: number }> = [];
  let expectedOnePassAmount = 0;
  let commonCurrency: string | null = null;
  let allCostsVerified = true;

  for (const step of exactSteps) {
    stepReachProbabilities.push({ stepId: step.id, probability: reachProbability });
    if (step.cost === null) {
      allCostsVerified = false;
    } else {
      const cost = VerifiedAttemptCostSchema.parse(step.cost);
      if (commonCurrency === null) commonCurrency = cost.currency;
      if (commonCurrency !== cost.currency) allCostsVerified = false;
      expectedOnePassAmount += reachProbability * cost.amount;
    }
    reachProbability *= step.chance.probability;
    onePassSuccessProbability *= step.chance.probability;
  }

  const expectedPassesToSuccess = 1 / onePassSuccessProbability;
  const expectedOnePassCost =
    allCostsVerified && commonCurrency !== null
      ? { amount: expectedOnePassAmount, currency: commonCurrency }
      : null;

  let expectedCostUntilSuccess: CraftingSequenceExact["expectedCostUntilSuccess"] = null;
  const restartPolicy = input.restartPolicy ?? null;
  if (restartPolicy !== null && expectedOnePassCost !== null) {
    const resetCost = VerifiedAttemptCostSchema.parse(restartPolicy.resetCost);
    if (resetCost.currency === expectedOnePassCost.currency) {
      // En el último pase exitoso no hay reinicio. Los pases fallidos esperados
      // son E[pases]-1; cada uno paga el coste verificado de volver al inicio.
      expectedCostUntilSuccess = {
        amount:
          expectedOnePassCost.amount * expectedPassesToSuccess +
          resetCost.amount * (expectedPassesToSuccess - 1),
        currency: expectedOnePassCost.currency,
      };
    }
  }

  return {
    status: "exact",
    onePassSuccessProbability,
    expectedPassesToSuccess,
    stepReachProbabilities,
    expectedOnePassCost,
    expectedCostUntilSuccess,
    limitations: [
      "Cada paso usa una probabilidad condicional para el estado dejado por el paso anterior.",
      "El coste hasta acertar solo se muestra cuando el reinicio al estado inicial está verificado.",
      "No se atribuye valor de mercado al resultado ni se supone que un afijo sea útil para la build.",
    ],
  };
}

/**
 * Ordena alternativas únicamente cuando todas las candidatas comparables tienen
 * coste total verificado y expresado en la misma moneda. «Primera» significa
 * menor coste matemático esperado, no mejor craft para la build.
 */
export function rankCraftingStrategies(
  candidates: CraftingStrategyCandidate[],
): CraftingStrategyRanking {
  if (candidates.length === 0) {
    return { status: "unavailable", reasons: ["No hay estrategias para comparar."], excluded: [] };
  }

  const ranked: RankedCraftingStrategy[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  for (const candidate of candidates) {
    const analysis = candidate.analysis;
    if (analysis.status !== "exact") {
      excluded.push({
        id: candidate.id,
        reason:
          analysis.status === "impossible"
            ? analysis.reason
            : analysis.reasons.join(" "),
      });
      continue;
    }
    if (analysis.expectedCostUntilSuccess === null) {
      excluded.push({
        id: candidate.id,
        reason: "Falta un coste total verificable o una política de reinicio demostrada.",
      });
      continue;
    }
    ranked.push({
      id: candidate.id,
      label: candidate.label,
      expectedCostUntilSuccess: analysis.expectedCostUntilSuccess,
      onePassSuccessProbability: analysis.onePassSuccessProbability,
    });
  }

  if (ranked.length === 0) {
    return {
      status: "unavailable",
      reasons: ["Ninguna estrategia tiene probabilidad y coste total verificables."],
      excluded,
    };
  }
  const currencies = new Set(ranked.map((candidate) => candidate.expectedCostUntilSuccess.currency));
  if (currencies.size !== 1) {
    return {
      status: "unavailable",
      reasons: ["Las estrategias usan monedas no normalizadas y no pueden ordenarse entre sí."],
      excluded,
    };
  }

  ranked.sort((left, right) => {
    const byCost =
      left.expectedCostUntilSuccess.amount - right.expectedCostUntilSuccess.amount;
    if (byCost !== 0) return byCost;
    const byProbability = right.onePassSuccessProbability - left.onePassSuccessProbability;
    if (byProbability !== 0) return byProbability;
    return left.id.localeCompare(right.id, "en");
  });
  return {
    status: "ranked",
    currency: ranked[0]!.expectedCostUntilSuccess.currency,
    strategies: ranked,
    excluded,
    limitation:
      "La clasificación solo compara coste esperado verificado; no determina valor para la build, liquidez ni riesgo subjetivo.",
  };
}
