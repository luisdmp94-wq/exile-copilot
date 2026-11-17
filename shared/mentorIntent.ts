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
  // Inglés
  "why",
  "reason",
  "explain",
  "main problem",
  "my problem",
  "whats wrong",
  "what s wrong",
  "what is wrong",
  "what am i doing wrong",
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
  // Inglés
  "what should i",
  "what do i",
  "what to improve",
  "what to upgrade",
  "what can i improve",
  "improve first",
  "upgrade first",
  "next step",
  "first step",
  "where do i start",
  "what next",
  "whats next",
  "what s next",
];

/**
 * Preguntas sobre MORIR o aguantar. No son una intención aparte: marcan el
 * foco «supervivencia», para que el mentor mire solo lo defensivo. Sin esto,
 * «¿por qué muero?» caía en «explica tu prioridad» y podía contestar «mejora
 * el arma».
 */
const SURVIVAL_PATTERNS: readonly string[] = [
  "muero",
  "muere",
  "morir",
  "muriendo",
  "muerto",
  "muertes",
  "me matan",
  "me mata",
  "me revientan",
  "me pegan",
  "sobrevivir",
  "supervivencia",
  "aguantar",
  "aguanto",
  "one shot",
  "oneshot",
  // Inglés
  "dying",
  "keep dying",
  "i die",
  "i died",
  "die so",
  "deaths",
  "survive",
  "survival",
  "tankier",
  "squishy",
  "one shotted",
];

export type MentorQuestionFocus = "survival" | null;

/** Conversación social que no debe convertirse en una recomendación. */
const CONVERSATION_PATTERNS: readonly string[] = [
  "hola",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
  "buenas",
  "hey",
  "gracias",
  "muchas gracias",
  "vale",
  "entendido",
  "ok",
  // Inglés
  "hi",
  "hello",
  "good morning",
  "good evening",
  "thanks",
  "thank you",
  "okay",
  "got it",
];

/**
 * Preguntas sobre la identidad y el alcance del propio Mentor. Son conversación
 * de producto, no consultas de juego: nunca deben producir una recomendación.
 */
const IDENTITY_PATTERNS: readonly string[] = [
  "quien eres",
  "que eres",
  "como te llamas",
  "que puedes hacer",
  "para que sirves",
  // Inglés
  "who are you",
  "what are you",
  "whats your name",
  "what is your name",
  "what can you do",
];

export function isMentorIdentityQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);
  return IDENTITY_PATTERNS.some(
    (pattern) => normalized === pattern || normalized.startsWith(`${pattern} `),
  );
}

/**
 * Clasifica la pregunta. El orden importa: primero explicación, después
 * siguiente paso; si nada casa, `unsupported`.
 */
export function classifyMentorQuestion(question: string): {
  intent: MentorIntent;
  normalizedQuestion: string;
  /** Patrón que disparó la clasificación; null si no hubo ninguno. */
  matchedPattern: string | null;
  /** «survival» si la pregunta habla de morir o aguantar. */
  focus: MentorQuestionFocus;
} {
  const normalized = normalizeQuestion(question);
  if (normalized.length === 0) {
    return { intent: "unsupported", normalizedQuestion: normalized, matchedPattern: null, focus: null };
  }
  const survivalPattern = SURVIVAL_PATTERNS.find((pattern) => normalized.includes(pattern)) ?? null;
  const focus: MentorQuestionFocus = survivalPattern ? "survival" : null;

  for (const pattern of EXPLAIN_PRIORITY_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        intent: "explain_priority",
        normalizedQuestion: normalized,
        matchedPattern: pattern,
        focus,
      };
    }
  }
  for (const pattern of NEXT_IMPROVEMENT_PATTERNS) {
    if (normalized.includes(pattern)) {
      return {
        intent: "next_improvement",
        normalizedQuestion: normalized,
        matchedPattern: pattern,
        focus,
      };
    }
  }
  // «Me matan mucho» no pide explícitamente una explicación, pero sí la merece,
  // y va antes que el saludo: «hola, me matan mucho» es una pregunta de juego.
  if (survivalPattern) {
    return { intent: "explain_priority", normalizedQuestion: normalized, matchedPattern: survivalPattern, focus };
  }
  if (isMentorIdentityQuestion(normalized)) {
    return {
      intent: "conversation",
      normalizedQuestion: normalized,
      matchedPattern:
        IDENTITY_PATTERNS.find(
          (pattern) => normalized === pattern || normalized.startsWith(`${pattern} `),
        ) ?? null,
      focus,
    };
  }
  if (
    CONVERSATION_PATTERNS.some(
      (pattern) => normalized === pattern || normalized.startsWith(`${pattern} `),
    )
  ) {
    return {
      intent: "conversation",
      normalizedQuestion: normalized,
      matchedPattern: normalized.split(" ").slice(0, 2).join(" "),
      focus,
    };
  }
  return { intent: "unsupported", normalizedQuestion: normalized, matchedPattern: null, focus };
}
