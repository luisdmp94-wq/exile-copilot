import { z } from "zod";
import { CraftingActionIdSchema } from "./craftingActions.js";
import {
  CRAFTING_BUILD_ALIGNMENTS,
  CRAFTING_BUILD_INTENT_SOURCES,
} from "./craftingBuildIntent.js";
import { COACH_FOCUSES } from "./craftingFocus.js";
import { CraftingGoalCategorySchema } from "./craftingGoal.js";

/**
 * Contrato declarado por el jugador en la ayuda de Crafting.
 *
 * Solo contiene enums y contadores acotados. No transporta descripciones de
 * mecánicas, pools, probabilidades ni instrucciones libres que el proveedor
 * pudiera confundir con hechos del juego.
 */
const MentorCoachCraftingStateSchema = z.strictObject({
  mode: z.literal("coach"),
  focus: z.enum(COACH_FOCUSES).nullable(),
  rollMinimum: z.enum(["any", "middle", "high"]),
  attemptCurrent: z.number().int().min(0).max(3),
  attemptLimit: z.number().int().min(1).max(3),
  phase: z.enum(["planning", "result"]),
  decision: z.enum(["continue", "stop", "restart", "unclear"]).nullable(),
  nextAction: CraftingActionIdSchema.nullable(),
});

const MentorAdvancedStopCriterionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("goal-affix-count"),
    category: CraftingGoalCategorySchema.exclude(["other"]),
    minimumCount: z.number().int().min(1).max(6),
  }),
  z.strictObject({
    kind: z.literal("exact-modifier-text"),
    /** El texto libre no sale del cliente; solo se declara que existe. */
    maximumTier: z.number().int().min(1).max(20).nullable(),
  }),
  z.strictObject({
    kind: z.literal("explicit-count"),
    minimumCount: z.number().int().min(1).max(6),
  }),
]);

const MentorCraftingBuildIntentSchema = z.strictObject({
  source: z.enum(CRAFTING_BUILD_INTENT_SOURCES),
  alignment: z.enum(CRAFTING_BUILD_ALIGNMENTS),
  focuses: z.array(z.enum(COACH_FOCUSES)).max(COACH_FOCUSES.length),
  suggestedCategories: z
    .array(CraftingGoalCategorySchema.exclude(["other"]))
    .max(5),
});

const MentorAdvancedCraftingStateSchema = z.strictObject({
  mode: z.literal("advanced"),
  goalCategory: CraftingGoalCategorySchema,
  buildIntent: MentorCraftingBuildIntentSchema.nullable().default(null),
  protectedModifierCount: z.number().int().min(0).max(12),
  stopCriteria: z.array(MentorAdvancedStopCriterionSchema).max(3),
  tool: z.enum(["currency", "essence", "alloy"]),
  action: CraftingActionIdSchema.nullable(),
  variant: z.enum(["base", "greater", "perfect"]).nullable(),
  preflightConfirmed: z.boolean(),
  stopAlreadyReached: z.boolean(),
  ready: z.boolean(),
  projectPhase: z.enum(["blocked", "base", "foundation", "finishing", "recovery", "finished"]),
  baseDecision: z.enum(["hold", "continue", "recover", "change-base", "stop"]),
  attemptCount: z.number().int().min(0).max(12),
  latestBranch: z.enum(["success", "salvage", "failure"]).nullable(),
  targetEvidence: z.enum([
    "target-on-current",
    "target-observed-locally",
    "partial-local-evidence",
    "unobserved",
  ]).optional(),
  localObservationCount: z.number().int().min(0).max(100).optional(),
  modPoolCoverage: z.enum([
    "available-complete",
    "available-partial",
    "unavailable",
    "unknown",
  ]).optional(),
});

export const MentorCraftingStateSchema = z.discriminatedUnion("mode", [
  MentorCoachCraftingStateSchema,
  MentorAdvancedCraftingStateSchema,
]);

export type MentorCraftingState = z.infer<typeof MentorCraftingStateSchema>;

export const ContextEnvelopeSchema = z.strictObject({
  version: z.literal("1.0"),
  activeArea: z.enum(["expediente", "plan", "crafting"]),
  character: z.strictObject({
    level: z.number().int().min(1).max(100).nullable(),
    characterClass: z.string().max(100).nullable(),
  }),
  targetBuild: z.string().max(200).nullable(),
  selectedItem: z.strictObject({
    id: z.string().max(200),
    name: z.string().max(200),
  }).nullable(),
  craftingState: MentorCraftingStateSchema.nullable(),
  activeRecommendationId: z.string().max(200).nullable(),
  market: z.strictObject({
    budgetAmount: z.number().nonnegative(),
    budgetCurrency: z.string().max(50),
    league: z.string().max(100),
  }),
  sessionActive: z.boolean(),
  lastAction: z.string().max(500).nullable(),
});

export type ContextEnvelope = z.infer<typeof ContextEnvelopeSchema>;
