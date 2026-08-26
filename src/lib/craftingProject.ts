import { z } from "zod";
import {
  CraftingGoalCategorySchema,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";
import {
  CraftingSuccessCriteriaSchema,
  type CraftingSuccessCriterion,
  type CraftingSuccessAssessmentStatus,
} from "@shared/craftingSuccessCriteria.js";
import type { CraftingNextDecisionKind } from "@shared/craftingNextDecision.js";

export const CRAFTING_PROJECT_UPDATED_EVENT = "exile-copilot:crafting-project-updated";

export type CraftingProjectBranch = "success" | "salvage" | "failure";

const CraftingProjectAttemptSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  recordedAt: z.string().trim().min(1).max(100),
  actionLabel: z.string().trim().min(1).max(100),
  resultName: z.string().trim().min(1).max(300),
  branch: z.enum(["success", "salvage", "failure"]),
  decisionKind: z.enum(["continue", "stop", "restart"]),
  decisionTitle: z.string().trim().min(1).max(500),
  addedModifiers: z.array(z.string().trim().min(1).max(500)).max(8),
  removedModifiers: z.array(z.string().trim().min(1).max(500)).max(8),
  protectedStatus: z.enum(["not-requested", "preserved", "lost", "unverifiable"]),
  successStatus: z.enum(["fulfilled", "not-fulfilled", "unknown", "not-defined"]),
});

export type CraftingProjectAttempt = z.infer<typeof CraftingProjectAttemptSchema>;

const CraftingProjectSchema = z.object({
  desiredOutcome: z.string().max(500).default(""),
  goalCategory: CraftingGoalCategorySchema.default("other"),
  protectedModifierIds: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
  successCriteria: CraftingSuccessCriteriaSchema,
  attempts: z.array(CraftingProjectAttemptSchema).max(12).default([]),
});

export interface CraftingProject {
  desiredOutcome: string;
  goalCategory: CraftingGoalCategory;
  protectedModifierIds: string[];
  successCriteria: CraftingSuccessCriterion[];
  attempts: CraftingProjectAttempt[];
}

export type CraftingProjectContract = Omit<CraftingProject, "attempts">;

export function craftingProjectStorageKey(profileId: string | null, itemId: string): string {
  return `exile-copilot:crafting-project:v1:${profileId ?? "loose"}:${itemId}`;
}

export function emptyCraftingProject(): CraftingProject {
  return {
    desiredOutcome: "",
    goalCategory: "other",
    protectedModifierIds: [],
    successCriteria: [],
    attempts: [],
  };
}

export function readCraftingProject(storageKey: string): CraftingProject {
  if (typeof window === "undefined") return emptyCraftingProject();
  try {
    const parsed = CraftingProjectSchema.safeParse(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
    );
    return parsed.success ? parsed.data : emptyCraftingProject();
  } catch {
    return emptyCraftingProject();
  }
}

function notifyProjectUpdated(storageKey: string): void {
  window.dispatchEvent(
    new CustomEvent(CRAFTING_PROJECT_UPDATED_EVENT, { detail: { storageKey } }),
  );
}

export function saveCraftingProjectContract(
  storageKey: string,
  contract: CraftingProjectContract,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = readCraftingProject(storageKey);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(CraftingProjectSchema.parse({ ...current, ...contract })),
    );
  } catch {
    // El proyecto sigue disponible en memoria si el navegador bloquea localStorage.
  }
}

export function appendCraftingProjectAttempt(
  storageKey: string,
  attempt: CraftingProjectAttempt,
): void {
  if (typeof window === "undefined") return;
  try {
    const parsedAttempt = CraftingProjectAttemptSchema.parse(attempt);
    const current = readCraftingProject(storageKey);
    const withoutDuplicate = current.attempts.filter(
      (entry) => entry.sessionId !== parsedAttempt.sessionId,
    );
    const attempts = [...withoutDuplicate, parsedAttempt].slice(-12);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(CraftingProjectSchema.parse({ ...current, attempts })),
    );
    notifyProjectUpdated(storageKey);
  } catch {
    // Registrar el resultado en el diario sigue siendo la fuente autoritativa.
  }
}

export function classifyCraftingProjectBranch(input: {
  successStatus: CraftingSuccessAssessmentStatus;
  decisionKind: CraftingNextDecisionKind;
  protectedStatus: CraftingProjectAttempt["protectedStatus"];
}): CraftingProjectBranch {
  if (input.successStatus === "fulfilled") return "success";
  if (input.protectedStatus === "lost" || input.decisionKind === "restart") return "failure";
  return "salvage";
}
