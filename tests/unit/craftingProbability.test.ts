import { describe, expect, it } from "vitest";
import {
  CraftingPoolSnapshotSchema,
  calculateCraftingChance,
  chanceWithinAttempts,
  type CraftingPoolSnapshot,
} from "../../shared/craftingProbability.js";

function completePool(): CraftingPoolSnapshot {
  return {
    snapshotId: "test-pool-1",
    patch: "test-only",
    scopeLabel: "Fixture sintético de pruebas; no son datos de PoE2",
    completeness: "verified-complete",
    selectionModel: "weighted-random-one",
    scopeVerified: true,
    candidates: [
      {
        id: "target-a",
        label: "Objetivo A sintético",
        affixType: "prefix",
        modGroup: "group-a",
        tags: ["damage", "attack"],
        weight: 20,
        eligibility: "eligible",
        blockedReason: null,
      },
      {
        id: "target-b",
        label: "Objetivo B sintético",
        affixType: "suffix",
        modGroup: "group-b",
        tags: ["speed", "attack"],
        weight: 30,
        eligibility: "eligible",
        blockedReason: null,
      },
      {
        id: "other",
        label: "Otro candidato sintético",
        affixType: "suffix",
        modGroup: "group-c",
        tags: ["defence"],
        weight: 50,
        eligibility: "eligible",
        blockedReason: null,
      },
      {
        id: "blocked",
        label: "Candidato bloqueado sintético",
        affixType: "prefix",
        modGroup: "group-d",
        tags: ["damage"],
        weight: 900,
        eligibility: "blocked",
        blockedReason: "Conflicto sintético para probar el filtrado.",
      },
    ],
    limitations: ["Fixture matemático sin mecánicas del juego."],
  };
}

describe("calculateCraftingChance", () => {
  it("calcula peso, probabilidad, intentos y coste exactos sobre un pool completo", () => {
    const result = calculateCraftingChance({
      pool: completePool(),
      target: { label: "Objetivo A", candidateIds: ["target-a"], modGroups: [], tags: [], match: "any" },
      attemptCost: {
        amount: 2,
        currency: "exalted",
        verified: true,
        sourceLabel: "Fixture de precio",
        asOf: "2026-08-22T00:00:00.000Z",
      },
      attemptMilestones: [10, 1, 5],
    });

    expect(result.status).toBe("exact");
    if (result.status !== "exact") throw new Error("Resultado inesperado");
    expect(result.totalEligibleWeight).toBe(100);
    expect(result.targetWeight).toBe(20);
    expect(result.probability).toBeCloseTo(0.2);
    expect(result.expectedAttempts).toBeCloseTo(5);
    expect(result.expectedCost).toMatchObject({ amount: 10, currency: "exalted" });
    expect(result.chanceWithinAttempts.map((entry) => entry.attempts)).toEqual([1, 5, 10]);
  });

  it("excluye del denominador candidatos explícitamente bloqueados", () => {
    const result = calculateCraftingChance({
      pool: completePool(),
      target: { label: "Daño", candidateIds: [], modGroups: [], tags: ["damage"], match: "any" },
    });
    expect(result.status).toBe("exact");
    if (result.status === "exact") {
      expect(result.totalEligibleWeight).toBe(100);
      expect(result.targetCandidateIds).toEqual(["target-a"]);
    }
  });

  it("admite objetivos any y all sin confundir las etiquetas", () => {
    const any = calculateCraftingChance({
      pool: completePool(),
      target: { label: "Ataque", candidateIds: [], modGroups: [], tags: ["damage", "speed"], match: "any" },
    });
    const all = calculateCraftingChance({
      pool: completePool(),
      target: { label: "Daño de ataque", candidateIds: [], modGroups: [], tags: ["damage", "attack"], match: "all" },
    });
    expect(any.status === "exact" ? any.targetWeight : null).toBe(50);
    expect(all.status === "exact" ? all.targetCandidateIds : null).toEqual(["target-a"]);
  });

  it("declara imposible un objetivo ausente de un pool completo", () => {
    const result = calculateCraftingChance({
      pool: completePool(),
      target: { label: "No existe", candidateIds: ["missing"], modGroups: [], tags: [], match: "any" },
    });
    expect(result).toMatchObject({ status: "impossible", targetWeight: 0 });
  });

  it.each(["verified-partial", "observed-only", "unavailable"] as const)(
    "no calcula con completeness=%s",
    (completeness) => {
      const result = calculateCraftingChance({
        pool: { ...completePool(), completeness },
        target: { label: "Objetivo", candidateIds: ["target-a"], modGroups: [], tags: [], match: "any" },
      });
      expect(result.status).toBe("unavailable");
    },
  );

  it("distingue peso cero conocido de peso desconocido", () => {
    const zeroPool = completePool();
    zeroPool.candidates[0]!.weight = 0;
    const zero = calculateCraftingChance({
      pool: zeroPool,
      target: { label: "Peso cero", candidateIds: ["target-a"], modGroups: [], tags: [], match: "any" },
    });
    expect(zero.status).toBe("impossible");

    const unknownPool = completePool();
    unknownPool.candidates[0]!.weight = null;
    expect(() => CraftingPoolSnapshotSchema.parse(unknownPool)).toThrow(/pesos desconocidos/i);
  });

  it("rechaza ids duplicados y elegibilidad desconocida en un pool completo", () => {
    const duplicate = completePool();
    duplicate.candidates[1]!.id = duplicate.candidates[0]!.id;
    expect(() => CraftingPoolSnapshotSchema.parse(duplicate)).toThrow(/duplicado/i);

    const unknown = completePool();
    unknown.candidates[0]!.eligibility = "unknown";
    unknown.candidates[0]!.blockedReason = "No se verificó la elegibilidad sintética.";
    expect(() => CraftingPoolSnapshotSchema.parse(unknown)).toThrow(/elegibilidad desconocida/i);
  });

  it("exige motivo para candidatos no elegibles y fecha válida para el precio", () => {
    const blockedWithoutReason = completePool();
    blockedWithoutReason.candidates[3]!.blockedReason = null;
    expect(() => CraftingPoolSnapshotSchema.parse(blockedWithoutReason)).toThrow(/explicar el motivo/i);

    expect(() =>
      calculateCraftingChance({
        pool: completePool(),
        target: { label: "Objetivo", candidateIds: ["target-a"], modGroups: [], tags: [], match: "any" },
        attemptCost: {
          amount: 1,
          currency: "exalted",
          verified: true,
          sourceLabel: "Fixture",
          asOf: "fecha inventada",
        },
      }),
    ).toThrow(/fecha/i);
  });

  it("no fabrica coste esperado sin una cotización verificada", () => {
    const result = calculateCraftingChance({
      pool: completePool(),
      target: { label: "Objetivo A", candidateIds: ["target-a"], modGroups: [], tags: [], match: "any" },
    });
    expect(result.status === "exact" ? result.expectedCost : "wrong").toBeNull();
  });
});

describe("chanceWithinAttempts", () => {
  it("calcula la probabilidad acumulada sin redondear internamente", () => {
    expect(chanceWithinAttempts(0.2, 5)).toBeCloseTo(0.67232);
  });

  it("rechaza probabilidades e intentos inválidos", () => {
    expect(() => chanceWithinAttempts(-0.1, 1)).toThrow();
    expect(() => chanceWithinAttempts(1.1, 1)).toThrow();
    expect(() => chanceWithinAttempts(0.5, 0)).toThrow();
  });
});
