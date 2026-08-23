import { describe, expect, it } from "vitest";
import type { CraftingChance, VerifiedAttemptCost } from "../../shared/craftingProbability.js";
import {
  analyzeCraftingSequence,
  rankCraftingStrategies,
} from "../../shared/craftingStrategy.js";

function exact(id: string, probability: number): CraftingChance {
  return {
    status: "exact",
    targetLabel: id,
    probability,
    probabilityPercent: probability * 100,
    targetWeight: probability * 100,
    totalEligibleWeight: 100,
    eligibleCandidateCount: 2,
    targetCandidateIds: [id],
    expectedAttempts: 1 / probability,
    chanceWithinAttempts: [],
    expectedCost: null,
    snapshotId: `snapshot-${id}`,
    patch: "test-only",
    limitations: [],
  };
}

function cost(amount: number, currency = "exalted"): VerifiedAttemptCost {
  return {
    amount,
    currency,
    verified: true,
    sourceLabel: "Fixture de coste",
    asOf: "2026-08-22T00:00:00.000Z",
  };
}

describe("analyzeCraftingSequence", () => {
  it("multiplica probabilidades condicionales y pondera el coste por alcance", () => {
    const result = analyzeCraftingSequence({
      steps: [
        { id: "one", label: "Paso uno", chance: exact("one", 0.5), cost: cost(2) },
        { id: "two", label: "Paso dos", chance: exact("two", 0.25), cost: cost(4) },
      ],
    });
    expect(result.status).toBe("exact");
    if (result.status !== "exact") throw new Error("Resultado inesperado");
    expect(result.onePassSuccessProbability).toBeCloseTo(0.125);
    expect(result.expectedPassesToSuccess).toBeCloseTo(8);
    expect(result.stepReachProbabilities).toEqual([
      { stepId: "one", probability: 1 },
      { stepId: "two", probability: 0.5 },
    ]);
    expect(result.expectedOnePassCost).toEqual({ amount: 4, currency: "exalted" });
    expect(result.expectedCostUntilSuccess).toBeNull();
  });

  it("solo calcula coste hasta acertar con reinicio verificado", () => {
    const result = analyzeCraftingSequence({
      steps: [{ id: "one", label: "Paso", chance: exact("one", 0.5), cost: cost(2) }],
      restartPolicy: {
        verified: true,
        returnsToInitialState: true,
        resetCost: cost(3),
        sourceLabel: "Fixture de reinicio",
      },
    });
    expect(result.status === "exact" ? result.expectedCostUntilSuccess : null).toEqual({
      amount: 7,
      currency: "exalted",
    });
  });

  it("propaga indisponibilidad sin convertirla en cero", () => {
    const unavailable: CraftingChance = {
      status: "unavailable",
      targetLabel: "Sin datos",
      reasons: ["Pool parcial"],
      snapshotId: "partial",
      patch: "test-only",
      limitations: [],
    };
    expect(
      analyzeCraftingSequence({
        steps: [{ id: "missing", label: "Paso sin datos", chance: unavailable, cost: null }],
      }),
    ).toEqual({ status: "unavailable", reasons: ["Paso sin datos: Pool parcial"] });
  });

  it("detiene una secuencia matemáticamente imposible", () => {
    const impossible: CraftingChance = {
      status: "impossible",
      targetLabel: "Objetivo",
      reason: "Sin candidatos",
      targetWeight: 0,
      totalEligibleWeight: 100,
      eligibleCandidateCount: 2,
      snapshotId: "complete",
      patch: "test-only",
      limitations: [],
    };
    expect(
      analyzeCraftingSequence({
        steps: [{ id: "blocked", label: "Paso bloqueado", chance: impossible, cost: cost(1) }],
      }),
    ).toEqual({
      status: "impossible",
      failedStepId: "blocked",
      reason: "Paso bloqueado: Sin candidatos",
    });
  });

  it("no suma costes expresados en monedas diferentes", () => {
    const result = analyzeCraftingSequence({
      steps: [
        { id: "one", label: "Uno", chance: exact("one", 0.5), cost: cost(1, "exalted") },
        { id: "two", label: "Dos", chance: exact("two", 0.5), cost: cost(1, "divine") },
      ],
    });
    expect(result.status === "exact" ? result.expectedOnePassCost : "wrong").toBeNull();
  });

  it("rechaza una secuencia vacía", () => {
    expect(analyzeCraftingSequence({ steps: [] })).toEqual({
      status: "unavailable",
      reasons: ["La secuencia no contiene pasos."],
    });
  });
});

describe("rankCraftingStrategies", () => {
  it("ordena por coste esperado y conserva exclusiones honestas", () => {
    const cheap = analyzeCraftingSequence({
      steps: [{ id: "cheap-step", label: "Barato", chance: exact("cheap", 0.5), cost: cost(1) }],
      restartPolicy: {
        verified: true,
        returnsToInitialState: true,
        resetCost: cost(1),
        sourceLabel: "Fixture",
      },
    });
    const expensive = analyzeCraftingSequence({
      steps: [{ id: "expensive-step", label: "Caro", chance: exact("expensive", 0.5), cost: cost(4) }],
      restartPolicy: {
        verified: true,
        returnsToInitialState: true,
        resetCost: cost(1),
        sourceLabel: "Fixture",
      },
    });
    const result = rankCraftingStrategies([
      { id: "expensive", label: "Caro", analysis: expensive },
      { id: "missing", label: "Sin datos", analysis: { status: "unavailable", reasons: ["Pool parcial"] } },
      { id: "cheap", label: "Barato", analysis: cheap },
    ]);
    expect(result.status).toBe("ranked");
    if (result.status === "ranked") {
      expect(result.strategies.map((entry) => entry.id)).toEqual(["cheap", "expensive"]);
      expect(result.excluded).toEqual([{ id: "missing", reason: "Pool parcial" }]);
    }
  });

  it("no compara monedas diferentes sin normalización", () => {
    const exalted = analyzeCraftingSequence({
      steps: [{ id: "e", label: "E", chance: exact("e", 1), cost: cost(1, "exalted") }],
      restartPolicy: {
        verified: true,
        returnsToInitialState: true,
        resetCost: cost(1, "exalted"),
        sourceLabel: "Fixture",
      },
    });
    const divine = analyzeCraftingSequence({
      steps: [{ id: "d", label: "D", chance: exact("d", 1), cost: cost(1, "divine") }],
      restartPolicy: {
        verified: true,
        returnsToInitialState: true,
        resetCost: cost(1, "divine"),
        sourceLabel: "Fixture",
      },
    });
    const result = rankCraftingStrategies([
      { id: "e", label: "Exaltado", analysis: exalted },
      { id: "d", label: "Divino", analysis: divine },
    ]);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") expect(result.reasons[0]).toMatch(/no normalizadas/i);
  });

  it("no elige ganador si ninguna alternativa tiene reinicio y coste total verificados", () => {
    const result = rankCraftingStrategies([
      {
        id: "open",
        label: "Sin reinicio",
        analysis: analyzeCraftingSequence({
          steps: [{ id: "s", label: "S", chance: exact("s", 0.5), cost: cost(1) }],
        }),
      },
    ]);
    expect(result.status).toBe("unavailable");
  });
});
