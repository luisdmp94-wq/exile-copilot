import { z } from "zod";
import {
  BudgetSchema,
  BuildTargetSchema,
  CharacterProfileSchema,
  ConfidenceLevel,
  GoalSchema,
  RecommendationMemoryImpactSchema,
  RecommendationSchema,
  SourceEvidenceSchema,
} from "./domain.js";

/**
 * Contrato de la conversación con el mentor (Hito 6A).
 *
 * La autoridad sigue siendo el motor: no se inventa conocimiento de PoE2. El
 * selector IA opcional de Hito 6E solo puede escoger ids canónicos; toda
 * respuesta procede del perfil, la build objetivo, el presupuesto/objetivo, el
 * Character Journal y las recomendaciones ya calculadas.
 */

/**
 * Intenciones que el clasificador sabe reconocer. La lista es pequeña a
 * propósito: preferimos declarar «no lo sé» antes que adivinar.
 */
export const MentorIntent = z.enum([
  /** «¿Qué mejoro ahora?», «¿Qué hago primero?» */
  "next_improvement",
  /** «¿Por qué me recomiendas esto?», «¿Cuál es mi problema principal?» */
  "explain_priority",
  /** Cualquier otra cosa: se contesta honestamente y con ejemplos válidos. */
  "unsupported",
]);
export type MentorIntent = z.infer<typeof MentorIntent>;

/** Longitud máxima de la pregunta aceptada por la API. */
export const MAX_MENTOR_QUESTION_LENGTH = 500;

/**
 * La ÚNICA próxima acción de la respuesta. El mentor nunca devuelve una lista
 * de tareas paralelas: o hay un paso, o no hay ninguno (`null`).
 */
export const MentorNextActionSchema = z.strictObject({
  /** Texto de la acción, tal y como lo produjo el motor o el diario. */
  text: z.string().min(1),
  /** Recomendación de la que procede, si viene del motor. */
  recommendationId: z.string().nullable(),
  /** Objetos implicados: solo vínculos estructurados, nunca inferidos por texto. */
  relatedItemIds: z.array(z.string()),
  /**
   * true solo cuando la acción es nueva y puede registrarse en el diario.
   * Una acción que el mentor RECUERDA del diario ya está registrada.
   */
  canSaveToJournal: z.boolean(),
  /**
   * Recomendación completa para poder guardarla como snapshot del diario sin
   * que el cliente tenga que reconstruirla. null cuando la acción se recuerda.
   */
  recommendation: RecommendationSchema.nullable(),
  /** Entrada del diario que se está recordando, si la acción viene de ahí. */
  recalledFromEntryId: z.string().nullable(),
});
export type MentorNextAction = z.infer<typeof MentorNextActionSchema>;

/** Estado explícito cuando la consulta no está soportada. */
export const MentorUnsupportedSchema = z.strictObject({
  reason: z.string().min(1),
  /** Ejemplos de preguntas que sí funcionan hoy. */
  examples: z.array(z.string().min(1)).min(1),
});
export type MentorUnsupported = z.infer<typeof MentorUnsupportedSchema>;

/**
 * Quién decidió cómo responder. Incluso en modo IA, la acción y los hechos
 * finales los reconstruye el servidor a partir del motor determinista.
 */
export const MentorResponseModeSchema = z.enum(["rules", "ai", "rules_fallback"]);
export type MentorResponseMode = z.infer<typeof MentorResponseModeSchema>;

export const MentorAnswerSchema = z.strictObject({
  intent: MentorIntent,
  /** Pregunta normalizada con la que se clasificó (auditable). */
  normalizedQuestion: z.string(),
  /** Respuesta breve en español. Texto plano: la interfaz nunca lo interpreta como HTML. */
  answer: z.string().min(1),
  /** Exactamente una próxima acción, o ninguna. */
  nextAction: MentorNextActionSchema.nullable(),
  /** Ids de recomendaciones del motor utilizadas para responder. */
  usedRecommendationIds: z.array(z.string()),
  /** Objetos relacionados (vínculo estructurado del motor o del diario). */
  relatedItemIds: z.array(z.string()),
  /** Fuentes heredadas de la recomendación/diario: nunca se fabrican. */
  sources: z.array(SourceEvidenceSchema),
  /** Confianza de la decisión citada; null cuando no hay decisión que citar. */
  confidence: ConfidenceLevel.nullable(),
  /** Lo que falta por verificar, tal y como lo declara el motor. */
  unverified: z.array(z.string()),
  /** Cómo influyó el Character Journal en esta respuesta. */
  memoryImpact: RecommendationMemoryImpactSchema,
  /** Huella de los inputs: la interfaz invalida la conversación si cambia. */
  inputFingerprint: z.string(),
  /** Presente solo cuando `intent` es "unsupported". */
  unsupported: MentorUnsupportedSchema.nullable(),
  generatedAt: z.string(),
  engineVersion: z.string(),
  /** `ai` significa selección supervisada; nunca texto libre autoritativo. */
  responseMode: MentorResponseModeSchema.optional(),
  /** Modelo que tomó la decisión estructurada; null en modo reglas. */
  model: z.string().min(1).max(200).nullable().optional(),
  /** Motivo seguro y sin secretos cuando la IA falló y se usaron reglas. */
  fallbackReason: z.string().min(1).max(500).nullable().optional(),
});
export type MentorAnswer = z.infer<typeof MentorAnswerSchema>;

// POST /api/mentor/query
export const MentorQueryRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_MENTOR_QUESTION_LENGTH),
  profile: CharacterProfileSchema,
  target: BuildTargetSchema.optional(),
  budget: BudgetSchema,
  goal: GoalSchema,
  league: z.string(),
  patch: z.string(),
  /**
   * Revisión del diario que vio la interfaz. El servidor carga SIEMPRE la
   * memoria autoritativa; el cliente no puede inyectar memoria.
   */
  journalRevision: z.string().min(1).max(4000).nullable().optional(),
});
export type MentorQueryRequest = z.infer<typeof MentorQueryRequestSchema>;

export const MentorQueryResponseSchema = z.object({
  answer: MentorAnswerSchema,
});
export type MentorQueryResponse = z.infer<typeof MentorQueryResponseSchema>;

/**
 * Clave de invalidación del hilo conversacional: todo lo que puede cambiar la
 * respuesta del mentor MENOS la pregunta. Cambiar de pregunta no descarta el
 * hilo; cambiar personaje, build objetivo, presupuesto, objetivo, liga, parche
 * o revisión del diario, sí.
 */
export function mentorInputsKey(request: MentorQueryRequest): string {
  return JSON.stringify({
    profile: request.profile,
    target: request.target,
    budget: request.budget,
    goal: request.goal,
    league: request.league,
    patch: request.patch,
    journalRevision: request.journalRevision ?? null,
  });
}

/** Sugerencias que la interfaz ofrece y que el clasificador reconoce con certeza. */
export const MENTOR_SUGGESTIONS = [
  "¿Qué mejoro ahora?",
  "¿Qué debería hacer primero?",
  "¿Cuál es mi principal problema?",
  "¿Por qué me recomiendas esto?",
] as const;
