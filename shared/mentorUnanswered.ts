import { z } from "zod";

/**
 * Preguntas que el Mentor no supo contestar. Sirven para saber qué regla
 * falta. Se guarda solo el texto de la pregunta, el motivo, el idioma y
 * cuántas veces ha llegado: ni sesión, ni IP, ni personaje, ni la hora.
 */

export const UNANSWERED_REASONS = [
  "no-entendida",
  "sin-datos",
  "sin-causa",
  "ia-sin-respuesta",
  "area-sin-revisar",
] as const;
export type UnansweredReason = (typeof UNANSWERED_REASONS)[number];

/** El motivo, dicho para leerlo de un vistazo. */
export const UNANSWERED_REASON_LABELS: Record<UnansweredReason, string> = {
  "no-entendida": "No la entendió: ninguna regla la reconoce",
  "sin-datos": "La entendió, pero la web no tiene ese dato",
  "sin-causa": "Respuesta genérica: dijo que no ve la causa",
  "ia-sin-respuesta": "La IA no encontró respuesta segura",
  "area-sin-revisar": "Área sin revisar para este parche",
};

export const UnansweredEntrySchema = z.object({
  question: z.string(),
  reason: z.enum(UNANSWERED_REASONS),
  lang: z.enum(["es", "en"]),
  /** Veces que ha llegado la misma pregunta con el mismo motivo. */
  count: z.number().int(),
  /** Días en UTC, «2026-11-24». Sin hora. */
  firstDay: z.string(),
  lastDay: z.string(),
});
export type UnansweredEntry = z.infer<typeof UnansweredEntrySchema>;

export const UnansweredResponseSchema = z.object({ questions: z.array(UnansweredEntrySchema) });

/** Las preguntas se borran solas si no se repiten en este tiempo. */
export const UNANSWERED_RETENTION_DAYS = 90;

/**
 * Preguntas distintas que se guardan como mucho. Solo frena a un programa que
 * quiera llenar el disco: al llegar al tope, las repetidas siguen sumando y
 * las nuevas no se guardan.
 */
export const UNANSWERED_MAX_ROWS = 2000;

/**
 * Quita de la pregunta lo que pueda señalar a una persona si alguien lo
 * escribe por error: correos, enlaces y números largos (teléfonos).
 */
export function scrubQuestion(question: string): string {
  return question
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[correo]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[enlace]")
    .replace(/\d{7,}/g, "[número]")
    .replace(/\s+/g, " ")
    .trim();
}
