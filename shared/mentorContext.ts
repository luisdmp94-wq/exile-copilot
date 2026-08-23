import { z } from "zod";

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
  craftingState: z.strictObject({
    goal: z.string().max(200).nullable(),
    stopCondition: z.string().max(200).nullable(),
  }).nullable(),
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
