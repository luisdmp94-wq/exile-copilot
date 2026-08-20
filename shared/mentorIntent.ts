import type { MentorIntent } from "./mentorQuery.js";

/**
 * Clasificador de intención DETERMINISTA y deliberadamente pequeño.
 *
 * No intenta entender cualquier pregunta humana: reconoce un puñado de formas
 * habituales y, ante la duda, devuelve `unsupported`. Es preferible decir
 * «esto todavía no lo sé responder» a improvisar una respuesta.
 *
 * No usa LLM ni red. Misma entrada, misma salida.
 */

/**
 * Normaliza para comparar: minúsculas, sin tildes/diacríticos, sin signos de
 * puntuación (incluidos «¿» y «?») y con espacios colapsados.
 *
 * La descomposición NFD pliega también «ñ» a «n» y «ü» a «u». Es intencionado:
 * hace el reconocimiento más tolerante a cómo escriba el jugador y ningún
 * patrón depende de esas letras.
 */
export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFD")
    // Marcas diacríticas combinantes (tildes, diéresis…).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Cualquier cosa que no sea letra latina básica, dígito o espacio.
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Frases que piden una EXPLICACIÓN o el diagnóstico principal.
 * Se comprueban ANTES que las de mejora: «¿por qué me recomiendas esto?»
 * también contiene palabras de recomendación.
 */
const EXPLAIN_PRIORITY_PATTERNS: readonly string[] = [
  "por que",
  "porque",
  "por q",
  "motivo",
  "razon",
  "explica",
  "explicame",
  "explicacion",
  "problema principal",
  "principal problema",
  "mi problema",
  "que me falla",
  "que esta mal",
  "en que fallo",
];

/** Frases que piden el SIGUIENTE PASO concreto. */
const NEXT_IMPROVEMENT_PATTERNS: readonly string[] = [
  "que mejoro",
  "que mejora",
  "que puedo mejorar",
  "que deberia mejorar",
  "que hago",
  "que hago ahora",
  "que hago primero",
  "que deberia hacer",
  "que debo hacer",
  "que hacer",
  "siguiente paso",
  "proximo paso",
  "primer paso",
  "por donde empiezo",
  "por donde sigo",
  "que toca",
  "que sigue",
];

/**
 * Clasifica la pregunta. El orden importa: primero explicación, después
 * siguiente paso; si nada casa, `unsupported`.
 */
export function classifyMentorQuestion(question: string): {
  intent: MentorIntent;
  normalizedQuestion: string;
  /** Patrón que disparó la clasificación; null si no hubo ninguno. */
  matchedPattern: string | null;
} {
  const normalized = normalizeQuestion(question);
  if (normalized.length === 0) {
    return { intent: "unsupported", normalizedQuestion: normalized, matchedPattern: null };
  }

  for (const pattern of EXPLAIN_PRIORITY_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        intent: "explain_priority",
        normalizedQuestion: normalized,
        matchedPattern: pattern,
      };
    }
  }
  for (const pattern of NEXT_IMPROVEMENT_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        intent: "next_improvement",
        normalizedQuestion: normalized,
        matchedPattern: pattern,
      };
    }
  }
  return { intent: "unsupported", normalizedQuestion: normalized, matchedPattern: null };
}
