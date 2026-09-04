import { z } from "zod";
import { BudgetSchema, GoalKind } from "@shared/domain.js";
import { BuildTargetPlanSchema } from "@shared/gggBuildPlanner.js";
import { PlanResolutionSchema } from "@shared/passiveRegistry.js";

const STORAGE_KEY = "exile-copilot:planning-workspace:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const TargetDraftSchema = z.strictObject({
  name: z.string().max(240),
  sourceUrl: z.string().max(4_000),
  summary: z.string().max(20_000),
  desiredModsText: z.string().max(20_000),
  plan: BuildTargetPlanSchema.nullable(),
});

export const PlanningWorkspaceProgressSchema = z.strictObject({
  schemaVersion: z.literal(1),
  targetDraft: TargetDraftSchema,
  targetWarnings: z.array(z.string().max(4_000)).max(100),
  targetResolution: PlanResolutionSchema.nullable(),
  /** null significa que el jugador todavía no ha declarado ningún límite. */
  budget: BudgetSchema.nullable(),
  goal: GoalKind,
  activeWorkspace: z.enum(["expediente", "plan", "crafting"]).default("expediente"),
});

export interface PlanningWorkspaceProgress {
  schemaVersion: 1;
  targetDraft: z.infer<typeof TargetDraftSchema>;
  targetWarnings: string[];
  targetResolution: z.infer<typeof PlanResolutionSchema> | null;
  budget: z.infer<typeof BudgetSchema> | null;
  goal: z.infer<typeof GoalKind>;
  activeWorkspace: "expediente" | "plan" | "crafting";
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadPlanningWorkspaceProgress(
  storage: StorageLike | null = defaultStorage(),
): PlanningWorkspaceProgress | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = PlanningWorkspaceProgressSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Plan y mercado siguen utilizables aunque el navegador bloquee storage.
    }
    return null;
  }
}

export function savePlanningWorkspaceProgress(
  progress: PlanningWorkspaceProgress,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  const parsed = PlanningWorkspaceProgressSchema.safeParse(progress);
  if (!parsed.success) return false;
  try {
    const value = parsed.data;
    const targetIsEmpty =
      value.targetDraft.name === "" &&
      value.targetDraft.sourceUrl === "" &&
      value.targetDraft.summary === "" &&
      value.targetDraft.desiredModsText === "" &&
      value.targetDraft.plan === null;
    const isDefaultWorkspace =
      targetIsEmpty &&
      value.targetWarnings.length === 0 &&
      value.targetResolution === null &&
      value.budget === null &&
      value.goal === "balanced" &&
      value.activeWorkspace === "expediente";

    // No recrear una clave vacía inmediatamente después de «Borrar todos mis
    // datos». El estado por defecto ya vive en el código y no necesita ocupar
    // almacenamiento hasta que el jugador haga una elección real.
    if (isDefaultWorkspace) {
      storage.removeItem(STORAGE_KEY);
      return true;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
