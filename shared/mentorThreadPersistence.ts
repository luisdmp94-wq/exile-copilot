import { z } from "zod";
import { MentorAnswerSchema } from "./mentorQuery.js";

/** Hilo breve que puede conservarse sin convertir el chat en una fuente de verdad. */
export const MENTOR_THREAD_VERSION = "mentor-v4" as const;
export const MAX_PERSISTED_MENTOR_TURNS = 8;
export const MAX_MENTOR_INPUTS_KEY_CHARACTERS = 1024 * 1024;
export const MAX_MENTOR_THREAD_PAYLOAD_BYTES = 128 * 1024;

export const PersistedMentorTurnSchema = z
  .strictObject({
    id: z.string().min(1).max(200),
    role: z.enum(["player", "mentor"]),
    /** Siempre texto plano; la interfaz nunca lo interpreta como HTML. */
    text: z.string().min(1).max(8_000),
    answer: MentorAnswerSchema.nullable(),
  })
  .superRefine((turn, context) => {
    if (turn.role === "player" && turn.answer !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answer"],
        message: "Un turno del jugador no puede contener una respuesta del Mentor.",
      });
    }
    if (turn.role === "mentor" && turn.answer === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answer"],
        message: "Un turno del Mentor debe conservar su respuesta estructurada.",
      });
    }
  });
export type PersistedMentorTurn = z.infer<typeof PersistedMentorTurnSchema>;

export const MentorStoredThreadSchema = z.strictObject({
  version: z.literal(MENTOR_THREAD_VERSION),
  turns: z
    .array(PersistedMentorTurnSchema)
    .min(1)
    .max(MAX_PERSISTED_MENTOR_TURNS),
  updatedAt: z.string().datetime(),
});
export type MentorStoredThread = z.infer<typeof MentorStoredThreadSchema>;

const MentorInputsKeySchema = z
  .string()
  .min(1)
  .max(MAX_MENTOR_INPUTS_KEY_CHARACTERS);

export const RestoreMentorThreadRequestSchema = z.strictObject({
  threadInputsKey: MentorInputsKeySchema,
});
export type RestoreMentorThreadRequest = z.infer<
  typeof RestoreMentorThreadRequestSchema
>;

export const RestoreMentorThreadResponseSchema = z.strictObject({
  thread: MentorStoredThreadSchema.nullable(),
});
export type RestoreMentorThreadResponse = z.infer<
  typeof RestoreMentorThreadResponseSchema
>;

export const SaveMentorThreadRequestSchema = z.strictObject({
  threadInputsKey: MentorInputsKeySchema,
  turns: z
    .array(PersistedMentorTurnSchema)
    .min(1)
    .max(MAX_PERSISTED_MENTOR_TURNS),
});
export type SaveMentorThreadRequest = z.infer<typeof SaveMentorThreadRequestSchema>;

export const SaveMentorThreadResponseSchema = z.strictObject({
  thread: MentorStoredThreadSchema,
});
export type SaveMentorThreadResponse = z.infer<
  typeof SaveMentorThreadResponseSchema
>;

export const DeleteMentorThreadResponseSchema = z.strictObject({
  deleted: z.boolean(),
});
export type DeleteMentorThreadResponse = z.infer<
  typeof DeleteMentorThreadResponseSchema
>;
