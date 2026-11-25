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
  "mayor problema",
  "mi problema",
  "que me falla",
  "que esta mal",
  "en que fallo",
  // Inglés
  "why",
  "reason",
  "explain",
  "main problem",
  "biggest problem",
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
  // Pedir ayuda sin más («estoy atascado, ¿puedes ayudarme?», caso real de
  // Luis, 25-11-2026): es pedir el siguiente paso. Las dudas concretas del
  // juego (gemas, árbol, lo básico) se contestan antes de llegar aquí.
  "atascad",
  "estancad",
  "estoy perdid",
  "ando perdid",
  "ayudame",
  "ayudarme",
  "me ayudas",
  "necesito ayuda",
  "como mejoro",
  "como puedo mejorar",
  "como podria mejorar",
  "como mejorar",
  "mejorar mi personaje",
  "mejorar mi build",
  "mejorarlo",
  "mejorarla",
  "no se que hacer",
  "no se como seguir",
  // Inglés
  "stuck",
  "help me",
  "need help",
  "i m lost",
  "im lost",
  "how do i improve",
  "how can i improve",
  "how to improve",
  "improve my character",
  "improve my build",
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
  "recibo mucho dano",
  "me hacen mucho dano",
  "too much damage",
];

/**
 * Preguntas sobre que FALTA DAÑO o se mata lento. Igual que morir: marcan el
 * foco «daño», para que el mentor mire primero lo que hace pegar más. Sin
 * esto, «me falta daño» no se entendía y la lista empezaba por resistencias.
 * Se comprueban DESPUÉS de las de morir: «recibo mucho daño» es aguante.
 * («dano» es «daño» ya normalizado: la «ñ» se pliega a «n».)
 */
const DAMAGE_PATTERNS: readonly string[] = [
  "dano",
  "dps",
  "no mato",
  "mato lento",
  "mato muy lento",
  "tardo en matar",
  "tardo mucho en matar",
  "matar mas rapido",
  "pego poco",
  "pego flojo",
  "pego muy poco",
  // Inglés
  "damage",
  "kill faster",
  "killing slow",
  "kill slow",
  "kills slow",
  "takes forever to kill",
  "hit harder",
];

/**
 * Piden una CIFRA de daño («dime mi DPS», «¿cuánto daño hago?»). El Mentor no
 * la calcula: esas preguntas no llevan foco daño y siguen sin respuesta.
 */
const NUMBER_REQUEST_PATTERNS: readonly string[] = [
  "cuanto",
  "dime el",
  "dime mi",
  "calcula",
  "how much",
  "calculate",
];
/** «What's my DPS?» pide una cifra; «What's my main problem? I do no damage» no. */
const NUMBER_REQUEST_RE = /\bwhat(?:s| s| is) my (?:dps|damage)\b/;

/**
 * El jugador RECIBE daño: es aguante, aunque la frase lleve «daño» y no
 * «morir». Sin esto, «el jefe me hace mucho daño» se contestaba con «si te
 * falta daño, mejora el arma».
 */
const TAKES_DAMAGE_RES: readonly RegExp[] = [
  /\b(?:me|nos) (?:hace|hacen|hizo|hicieron|mete|meten|pega|pegan|quita|quitan)\b.*\bdano\b/,
  /\b(?:recibo|recibimos|recibir|recibiendo|sufro|sufrir)\b.*\bdano\b/,
  /\bdano (?:que )?(?:recibo|me hace|me hacen)\b/,
  /\bcontra el dano\b/,
  /\b(?:i|we|i m|im) (?:take|took|keep taking|am taking)\b.*\bdamage\b/,
  /\b(?:take|taking|took) (?:a lot of|so much|too much|tons of|loads of|way too much) damage\b/,
  /\b(?:boss|bosses|enemy|enemies|monsters?|mobs?|they|everything) (?:deal|deals|do|does|hit|hits)\b.*\bdamage\b/,
  /\b(?:get|getting|got) (?:killed|one ?shot|destroyed|deleted)\b/,
];

/**
 * El ENEMIGO no muere: es que falta daño, aunque la frase lleve «muere» o
 * «morir». Sin esto, «el jefe no se muere» se contestaba como «¿por qué muero?».
 */
const ENEMY_SURVIVES_RES: readonly RegExp[] = [
  /\bno (?:se )?(?:muere|mueren|muera|mueran)\b/,
  /\b(?:tarda|tardan|cuesta|cuestan)\b.*\b(?:morir|caer)\b/,
  /\b(?:won t|wont|doesn t|doesnt|don t|dont|never|not) die\b/,
  /\b(?:take|takes|taking) (?:forever|ages|so long|too long) to die\b/,
];

/** Palabras que nombran una pieza de equipo (o su rareza: «única», «amarilla»). */
const ITEM_WORD_RE =
  /\b(armas?|arcos?|varitas?|mazos?|mazas?|baston(?:es)?|cetros?|espadas?|hachas?|dagas?|lanzas?|ballestas?|escudos?|cascos?|yelmos?|pecho|pechera|armaduras?|petos?|botas|guantes|anillos?|amuletos?|cinturon(?:es)?|carcaj|focos?|piezas?|objetos?|items?|unic[oa]s?|amarill[oa]s?|rar[oa]s?|weapons?|bows?|wands?|maces?|staffs?|staves|sceptres?|scepters?|swords?|axes?|daggers?|spears?|crossbows?|shields?|helmets?|helms?|chest|armou?rs?|boots|gloves|rings?|amulets?|belts?|quivers?|pieces?|uniques?|rares?|yellow)\b/;

/** Formas de preguntar «¿cambio esta por aquella?» o «¿cuál de las dos es mejor?». */
const ITEM_SWAP_RES: readonly RegExp[] = [
  /\bcambi(?:o|ar|arlo|arla|aria|amos)\b.*\bpor\b/,
  /\b(?:me )?(?:lo|la|los|las) cambio\b/,
  /\bmejor que (?:el|la|lo|los|las) (?:que )?(?:llevo|tengo|uso|mio|mia)\b/,
  /\bcual (?:es|de l[oa]s dos es|de est[oa]s es|de est[oa]s dos es) (?:el |la )?mejor\b/,
  /\bcompar(?:o|ar|a|arlo|arla|arlos|arlas)\b/,
  /\bme quedo con\b/,
  /\bvale la pena cambiar\b/,
  /\bswap\b|\breplace\b.*\bwith\b|\bbetter than (?:the one|mine|what i|my)\b|\bwhich (?:one )?is better\b|\bcompare\b|\bshould i (?:switch|change)\b/,
];

/**
 * «¿Me cambio el arma única por una varita amarilla?», «¿cómo sé si un arco es
 * mejor que el que llevo?»: es comparar dos piezas. No es «me falta daño»
 * aunque la frase lleve «daño» (caso real de Luis, 24-11-2026).
 */
export function isItemSwapQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);
  return ITEM_WORD_RE.test(normalized) && ITEM_SWAP_RES.some((pattern) => pattern.test(normalized));
}

export type MentorQuestionFocus = "survival" | "damage" | null;

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
  /** «survival» si habla de morir o aguantar; «damage» si de que falta daño. */
  focus: MentorQuestionFocus;
} {
  const normalized = normalizeQuestion(question);
  if (normalized.length === 0) {
    return { intent: "unsupported", normalizedQuestion: normalized, matchedPattern: null, focus: null };
  }
  // Quién recibe el daño y quién no muere pesa más que la palabra suelta.
  const takesDamage = TAKES_DAMAGE_RES.some((pattern) => pattern.test(normalized));
  const enemySurvives = !takesDamage && ENEMY_SURVIVES_RES.some((pattern) => pattern.test(normalized));
  const survivalPattern = enemySurvives
    ? null
    : takesDamage
      ? "recibe dano"
      : (SURVIVAL_PATTERNS.find((pattern) => normalized.includes(pattern)) ?? null);
  const asksForNumber =
    NUMBER_REQUEST_PATTERNS.some((pattern) => normalized.includes(pattern)) || NUMBER_REQUEST_RE.test(normalized);
  // «¿Cambio A por B?» compara dos piezas: no lleva foco daño aunque diga «daño».
  const damagePattern =
    survivalPattern || asksForNumber || isItemSwapQuestion(normalized)
      ? null
      : enemySurvives
        ? "el enemigo no muere"
        : (DAMAGE_PATTERNS.find((pattern) => normalized.includes(pattern)) ?? null);
  const focusPattern = survivalPattern ?? damagePattern;
  const focus: MentorQuestionFocus = survivalPattern ? "survival" : damagePattern ? "damage" : null;

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
  // «Me matan mucho» o «me falta daño» no piden explícitamente una explicación,
  // pero sí la merecen, y van antes que el saludo: «hola, me matan mucho» es
  // una pregunta de juego.
  if (focusPattern) {
    return { intent: "explain_priority", normalizedQuestion: normalized, matchedPattern: focusPattern, focus };
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
