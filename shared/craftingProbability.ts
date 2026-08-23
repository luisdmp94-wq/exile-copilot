import { z } from "zod";

/**
 * Motor matemático aislado de la obtención de datos.
 *
 * Este módulo no sabe qué mods existen en PoE2 ni descarga pools. Solo acepta
 * snapshots ya acotados por clase/base/parche y se niega a calcular si el
 * registro no demuestra que el pool y la elegibilidad están completos.
 */

export const CraftingPoolCompletenessSchema = z.enum([
  "verified-complete",
  "verified-partial",
  "observed-only",
  "unavailable",
]);
export type CraftingPoolCompleteness = z.infer<typeof CraftingPoolCompletenessSchema>;

export const CraftingCandidateSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  affixType: z.enum(["prefix", "suffix"]),
  modGroup: z.string().trim().min(1).nullable(),
  tags: z.array(z.string().trim().min(1)).default([]),
  /** null significa peso desconocido, no peso cero. */
  weight: z.number().int().nonnegative().nullable(),
  /** Debe venir resuelto por la capa de datos para el objeto y acción concretos. */
  eligibility: z.enum(["eligible", "blocked", "unknown"]),
  blockedReason: z.string().trim().min(1).nullable().default(null),
});
export type CraftingCandidate = z.infer<typeof CraftingCandidateSchema>;

export const CraftingPoolSnapshotSchema = z
  .object({
    snapshotId: z.string().trim().min(1),
    patch: z.string().trim().min(1),
    scopeLabel: z.string().trim().min(1),
    completeness: CraftingPoolCompletenessSchema,
    selectionModel: z.literal("weighted-random-one"),
    scopeVerified: z.boolean(),
    candidates: z.array(CraftingCandidateSchema),
    limitations: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((pool, context) => {
    const ids = new Set<string>();
    for (const [index, candidate] of pool.candidates.entries()) {
      if (ids.has(candidate.id)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "id"],
          message: `Id de candidato duplicado: ${candidate.id}`,
        });
      }
      ids.add(candidate.id);
      if (candidate.eligibility !== "eligible" && candidate.blockedReason === null) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "blockedReason"],
          message: "Una elegibilidad bloqueada o desconocida debe explicar el motivo.",
        });
      }
    }

    if (pool.completeness !== "verified-complete") return;
    if (!pool.scopeVerified) {
      context.addIssue({
        code: "custom",
        path: ["scopeVerified"],
        message: "Un pool completo debe tener el alcance verificado.",
      });
    }
    if (pool.candidates.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "Un pool completo no puede estar vacío.",
      });
    }
    for (const [index, candidate] of pool.candidates.entries()) {
      if (candidate.weight === null) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "weight"],
          message: "Un pool completo no puede contener pesos desconocidos.",
        });
      }
      if (candidate.eligibility === "unknown") {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "eligibility"],
          message: "Un pool completo no puede contener elegibilidad desconocida.",
        });
      }
    }
  });
export type CraftingPoolSnapshot = z.infer<typeof CraftingPoolSnapshotSchema>;

export const CraftingTargetSchema = z
  .object({
    label: z.string().trim().min(1),
    candidateIds: z.array(z.string().trim().min(1)).default([]),
    modGroups: z.array(z.string().trim().min(1)).default([]),
    tags: z.array(z.string().trim().min(1)).default([]),
    match: z.enum(["any", "all"]).default("any"),
  })
  .refine(
    (target) =>
      target.candidateIds.length > 0 || target.modGroups.length > 0 || target.tags.length > 0,
    { message: "El objetivo debe contener al menos un selector verificable." },
  );
export type CraftingTarget = z.infer<typeof CraftingTargetSchema>;

export const VerifiedAttemptCostSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().trim().min(1),
  verified: z.literal(true),
  sourceLabel: z.string().trim().min(1),
  asOf: z
    .string()
    .trim()
    .min(1)
    .refine((value) => Number.isFinite(Date.parse(value)), "La fecha del precio no es válida."),
});
export type VerifiedAttemptCost = z.infer<typeof VerifiedAttemptCostSchema>;

export interface ExactCraftingChance {
  status: "exact";
  targetLabel: string;
  probability: number;
  probabilityPercent: number;
  targetWeight: number;
  totalEligibleWeight: number;
  eligibleCandidateCount: number;
  targetCandidateIds: string[];
  expectedAttempts: number;
  chanceWithinAttempts: Array<{ attempts: number; probability: number }>;
  expectedCost: { amount: number; currency: string; sourceLabel: string; asOf: string } | null;
  snapshotId: string;
  patch: string;
  limitations: string[];
}

export interface ImpossibleCraftingChance {
  status: "impossible";
  targetLabel: string;
  reason: string;
  targetWeight: 0;
  totalEligibleWeight: number;
  eligibleCandidateCount: number;
  snapshotId: string;
  patch: string;
  limitations: string[];
}

export interface UnavailableCraftingChance {
  status: "unavailable";
  targetLabel: string;
  reasons: string[];
  snapshotId: string;
  patch: string;
  limitations: string[];
}

export type CraftingChance =
  | ExactCraftingChance
  | ImpossibleCraftingChance
  | UnavailableCraftingChance;

function candidateMatchesTarget(candidate: CraftingCandidate, target: CraftingTarget): boolean {
  const checks: boolean[] = [];
  if (target.candidateIds.length > 0) checks.push(target.candidateIds.includes(candidate.id));
  if (target.modGroups.length > 0) {
    checks.push(candidate.modGroup !== null && target.modGroups.includes(candidate.modGroup));
  }
  if (target.tags.length > 0) {
    checks.push(
      target.match === "all"
        ? target.tags.every((tag) => candidate.tags.includes(tag))
        : target.tags.some((tag) => candidate.tags.includes(tag)),
    );
  }
  return target.match === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

export function chanceWithinAttempts(probability: number, attempts: number): number {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError("La probabilidad debe estar entre 0 y 1.");
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError("Los intentos deben ser un entero positivo.");
  }
  return 1 - (1 - probability) ** attempts;
}

export function calculateCraftingChance(input: {
  pool: CraftingPoolSnapshot;
  target: CraftingTarget;
  attemptCost?: VerifiedAttemptCost | null;
  attemptMilestones?: number[];
}): CraftingChance {
  const pool = CraftingPoolSnapshotSchema.parse(input.pool);
  const target = CraftingTargetSchema.parse(input.target);
  const attemptCost =
    input.attemptCost === undefined || input.attemptCost === null
      ? null
      : VerifiedAttemptCostSchema.parse(input.attemptCost);

  if (pool.completeness !== "verified-complete") {
    return {
      status: "unavailable",
      targetLabel: target.label,
      reasons: [
        pool.completeness === "verified-partial"
          ? "El pool verificado es parcial: faltan candidatos o pesos."
          : pool.completeness === "observed-only"
            ? "Solo hay observaciones locales; no forman un pool completo."
            : "No hay un pool verificable disponible para este alcance.",
      ],
      snapshotId: pool.snapshotId,
      patch: pool.patch,
      limitations: uniqueSorted(pool.limitations),
    };
  }

  const eligible = pool.candidates.filter((candidate) => candidate.eligibility === "eligible");
  const totalEligibleWeight = eligible.reduce((sum, candidate) => sum + candidate.weight!, 0);
  if (totalEligibleWeight <= 0) {
    return {
      status: "unavailable",
      targetLabel: target.label,
      reasons: ["El pool completo no contiene peso elegible positivo para esta acción."],
      snapshotId: pool.snapshotId,
      patch: pool.patch,
      limitations: uniqueSorted(pool.limitations),
    };
  }

  const targetCandidates = eligible.filter((candidate) => candidateMatchesTarget(candidate, target));
  const targetWeight = targetCandidates.reduce((sum, candidate) => sum + candidate.weight!, 0);
  if (targetWeight === 0) {
    return {
      status: "impossible",
      targetLabel: target.label,
      reason: "Ningún candidato elegible del snapshot completo satisface el objetivo.",
      targetWeight: 0,
      totalEligibleWeight,
      eligibleCandidateCount: eligible.length,
      snapshotId: pool.snapshotId,
      patch: pool.patch,
      limitations: uniqueSorted(pool.limitations),
    };
  }

  const probability = targetWeight / totalEligibleWeight;
  const expectedAttempts = 1 / probability;
  const milestones = [
    ...new Set(
      (input.attemptMilestones ?? [1, 5, 10, 25]).filter(
        (attempts) => Number.isInteger(attempts) && attempts > 0,
      ),
    ),
  ].sort((left, right) => left - right);

  return {
    status: "exact",
    targetLabel: target.label,
    probability,
    probabilityPercent: probability * 100,
    targetWeight,
    totalEligibleWeight,
    eligibleCandidateCount: eligible.length,
    targetCandidateIds: uniqueSorted(targetCandidates.map((candidate) => candidate.id)),
    expectedAttempts,
    chanceWithinAttempts: milestones.map((attempts) => ({
      attempts,
      probability: chanceWithinAttempts(probability, attempts),
    })),
    expectedCost:
      attemptCost === null
        ? null
        : {
            amount: expectedAttempts * attemptCost.amount,
            currency: attemptCost.currency,
            sourceLabel: attemptCost.sourceLabel,
            asOf: attemptCost.asOf,
          },
    snapshotId: pool.snapshotId,
    patch: pool.patch,
    limitations: uniqueSorted(pool.limitations),
  };
}
