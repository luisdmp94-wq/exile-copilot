import { createHash } from "node:crypto";
import {
  readCharacterLevel,
  type Budget,
  type BuildTarget,
  type CharacterProfile,
  type Goal,
  type Recommendation,
  type RecommendationMemory,
  type RecommendationMemoryImpact,
} from "../../shared/domain.js";
import {
  assessMentorReadiness,
  type CharacterReadiness,
} from "../../shared/characterReadiness.js";
import {
  MentorAnswerSchema,
  MENTOR_SUGGESTIONS,
  type MentorAnswer,
  type MentorConversationTurn,
  type MentorGearAsk,
  type MentorIntent,
  type MentorNextAction,
} from "../../shared/mentorQuery.js";
import {
  classifyMentorQuestion,
  isMentorIdentityQuestion,
  type MentorQuestionFocus,
} from "../../shared/mentorIntent.js";
import {
  computeInputFingerprint,
  generateRecommendations,
  type EngineResult,
  type PriceLookup,
} from "../engine/engine.js";
import { ENGINE_VERSION } from "../engine/rules.js";
import { answerImproveSkillQuestion, answerSupportGemQuestion, type GemKnowledge } from "./gemQuestion.js";
import {
  answerAttributeQuestion,
  answerCurseQuestion,
  answerDamageQuestion,
  answerMinionQuestion,
  answerSkillChoiceQuestion,
  answerSupportCompareQuestion,
  isSupportTierQuestion,
} from "./gameQuestions.js";
import { answerPassiveTreeQuestion } from "./treeQuestion.js";
import { answerBasicsQuestion, answerItemCompareQuestion } from "./basicsQuestions.js";
import { answerSkillChoiceTopic } from "./skillChoiceQuestions.js";
import { gearReading, gearRulesAnswer } from "./gearQuestion.js";
import { routeInputFor, routedQuestion, understoodLine, type RoutedQuestion } from "./questionRouter.js";
import { answerGuideQuestion, asksAboutFight, guideAsk, guideInQuestion, guideLines, stepsNamedIn, type GuideKnowledge } from "./guideKnowledge.js";
import {
  adoptSupportGroups,
  alreadySaid,
  anotherSupports,
  answerLines,
  arrangeSaid,
  asksForAnother,
  asksForMore,
  SUPPORT_GROUP,
  asksWhichFirst,
  buildFichas,
  topUpSupports,
  characterFacts,
  checkWrittenMessage,
  composeWrittenAnswer,
  topicLines,
  UnverifiedWriting,
  writerVocabulary,
  type FichaOrigin,
  type TopicLine,
  type WriterVocabulary,
} from "./mentorWriter.js";
import type { TreeKnowledge } from "../advice/passiveTreeAdvisor.js";
import {
  MentorAiError,
  type MentorAiContext,
  type MentorAiDecision,
  type MentorDecisionSelector,
} from "./mentorAi.js";
import type {
  ContextEnvelope,
  MentorCraftingState,
} from "../../shared/mentorContext.js";
import { COACH_FOCUS_LABELS } from "../../shared/craftingFocus.js";
import { COACH_ROLL_MINIMUM_LABELS } from "../../shared/craftingCoach.js";
import { OBSERVED_CRAFTING_ACTIONS } from "../../shared/craftingActions.js";
import {
  craftingBuildIntentLabel,
  deriveCraftingBuildIntent,
} from "../../shared/craftingBuildIntent.js";
import { CRAFTING_GOAL_LABELS } from "../../shared/craftingGoal.js";
import type { PatchFeatureId } from "../../shared/patchCompatibility.js";

/**
 * Mentor conversacional.
 *
 * El motor y la memoria siguen siendo la autoridad. Cuando Mentor v4 está
 * activo, la IA recibe un contexto compacto, redacta conversación natural y
 * debe fundamentarla con ids que el motor ya produjo. El servidor valida
 * estructura y texto; ante cualquier fallo vuelve a las reglas.
 */

export interface MentorQueryOptions {
  question: string;
  /** Intención explícita de un control semántico de la interfaz. */
  intentHint?: Exclude<MentorIntent, "unsupported">;
  /** Sin equipo: solo preguntas del juego, sin motor ni IA. */
  gameOnly?: boolean;
  /** La comparación de equipo de la que pregunta (Mentor de equipo). */
  gear?: MentorGearAsk;
  /** Mentor de equipo sin redacción de IA: contestan las reglas (`MENTOR_GEAR_AI_ENABLED`). */
  gearRulesOnly?: boolean;
  profile: CharacterProfile;
  target?: BuildTarget;
  budget: Budget | null;
  goal: Goal;
  league: string;
  patch: string;
  /** Memoria AUTORITATIVA leída por el servidor; el cliente nunca la construye. */
  memory: RecommendationMemory;
  contextEnvelope?: ContextEnvelope;
  /** Historial visible, compacto y NO autoritativo. */
  conversation?: MentorConversationTurn[];
  /** Idioma en el que redacta la IA; sin él, español. */
  lang?: "es" | "en";
  /** Semilla anónima de servidor para antiabuso del proveedor; nunca procede del personaje. */
  safetyIdentifierSeed?: string;
  /**
   * Barrera AUTORITATIVA calculada por el servidor cuando la consulta pide
   * conocimiento de un área que aún no está revisada para este parche.
   */
  patchFeatureBlock?: {
    featureId: PatchFeatureId;
    label: string;
    patch: string;
    note: string;
  };
}

export interface MentorQueryDependencies {
  priceService?: PriceLookup | null;
  /** null/undefined conserva exactamente el comportamiento por reglas. */
  selector?: MentorDecisionSelector | null;
  /** Datos de gemas: con ellos el Mentor contesta preguntas de asistencias. */
  gems?: GemKnowledge | null;
  /** Árbol de pasivas: con él contesta «¿por dónde sigo en el árbol?». */
  tree?: TreeKnowledge | null;
  /** Guías por acto: con ellas contesta por jefes, zonas y recompensas de un acto. */
  guides?: GuideKnowledge | null;
}

const UNSUPPORTED_REASON =
  "Todavía no sé responder esa pregunta con seguridad. Solo respondo a partir de tu " +
  "personaje, tu build objetivo, tu presupuesto y tu diario: no invento estadísticas, " +
  "precios ni conocimiento del juego.";
const UNSUPPORTED_REASON_EN =
  "I can't answer that question safely yet. I only answer from your character, " +
  "your target build, your budget and your journal: I don't make up stats, prices " +
  "or game knowledge.";
const MENTOR_SUGGESTIONS_EN = [
  "What should I improve now?",
  "What should I do first?",
  "What's my main problem?",
  "Why do you recommend this?",
];

/** Idioma de la respuesta: el de la página, español si no llega. */
type AnswerLang = "es" | "en";
function langOf(options: { lang?: AnswerLang }): AnswerLang {
  return options.lang ?? "es";
}
function unsupportedInfo(lang: AnswerLang) {
  return lang === "en"
    ? { reason: UNSUPPORTED_REASON_EN, examples: [...MENTOR_SUGGESTIONS_EN] }
    : { reason: UNSUPPORTED_REASON, examples: [...MENTOR_SUGGESTIONS] };
}

function memoryImpactWithoutEngine(memory: RecommendationMemory): RecommendationMemoryImpact {
  return {
    revision: memory.revision,
    blockedByPrimaryEntryId: memory.primaryEntry?.entryId ?? null,
    usedEntryIds: [],
    repeatedRecommendationIds: [],
  };
}

function nextActionFromRecommendation(recommendation: Recommendation): MentorNextAction {
  return {
    text: publicText(recommendation.action, [recommendation]),
    recommendationId: recommendation.id,
    relatedItemIds: [...recommendation.relatedItemIds],
    canSaveToJournal: recommendation.actionKind !== "session_gate",
    recommendation,
    recalledFromEntryId: null,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nunca presenta ids internos aunque un texto legado los contenga. */
function publicText(value: string, recommendations: Recommendation[] = []): string {
  let result = value;
  for (const recommendation of recommendations) {
    result = result.replace(
      new RegExp(escapeRegExp(recommendation.id), "gi"),
      `«${recommendation.title}»`,
    );
  }
  return result
    .replace(/\b(?:rec|fact)(?::|-)[a-z0-9][a-z0-9:_-]*/gi, "la mejora correspondiente")
    .replace(/\b(?:recommendationId|missingFactId|inputFingerprint)\b/gi, "dato interno")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprintInput(options: MentorQueryOptions) {
  return {
    profile: options.profile,
    budget: options.budget,
    goal: options.goal,
    league: options.league,
    patch: options.patch,
    memory: options.memory,
    ...(options.target !== undefined ? { target: options.target } : {}),
  };
}

function unsupportedAnswer(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  fallback?: { model: string; reason: string },
): MentorAnswer {
  return MentorAnswerSchema.parse({
    intent: "unsupported",
    normalizedQuestion,
    answer:
      langOf(options) === "en"
        ? "I can't answer that with data yet, and I won't make it up. What I can tell you: what to " +
          "improve first, why you die or lack damage, which support gem to use, which skill to engrave " +
          "with an uncut gem, which curses and minion gems exist, what to raise in attributes and where " +
          "to go next in the passive tree."
        : "Eso todavía no sé contestarlo con datos, y no me lo voy a inventar. Lo que sí sé decirte: qué " +
          "mejorar primero, por qué mueres o te falta daño, qué asistencia poner, qué habilidad tallar con " +
          "una gema sin tallar, qué maldiciones y gemas de esbirro hay, qué subir en atributos y por dónde " +
          "seguir en el árbol.",
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: unsupportedInfo(langOf(options)),
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    responseMode: fallback ? "rules_fallback" : "rules",
    model: fallback?.model ?? null,
    fallbackReason: fallback?.reason ?? null,
  });
}

/** Respuesta a una pregunta de gemas de asistencia: texto de las reglas, sin motor ni IA. */
function gemQuestionAnswer(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  answer: string,
): MentorAnswer {
  return MentorAnswerSchema.parse({
    intent: "conversation",
    normalizedQuestion,
    answer,
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: null,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    responseMode: "rules",
    model: null,
    fallbackReason: null,
  });
}

function conversationFallback(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  fallback?: { model: string; reason: string },
): MentorAnswer {
  const identity = isMentorIdentityQuestion(normalizedQuestion);
  const thanks = /\b(gracias|thanks|thank you|thx)\b/.test(normalizedQuestion);
  const answer = langOf(options) === "en"
    ? identity
      ? "I'm the Exile Copilot Mentor, your PoE2 copilot. I use the character you " +
        "imported, the item you're checking, your goal, budget and journal to help " +
        "you pick the next step. I don't play or spend currency for you, and if I'm " +
        "missing data I tell you instead of making it up."
      : thanks
        ? "You're welcome. Whenever you want, tell me which item or part of your character to check."
        : "Hi! I can check your character, explain your current priority or help with the item you have open. What do you want to work on first?"
    : identity
    ? "Soy el Mentor de Exile Copilot, tu copiloto para PoE2. Uso el personaje que has " +
      "importado, el objeto que estás revisando, tu objetivo, presupuesto y diario para " +
      "ayudarte a decidir el siguiente paso. No juego ni gasto monedas por ti y, si me " +
      "faltan datos, te lo digo en vez de inventarlos."
    : thanks
      ? "De nada. Cuando quieras, dime qué pieza o parte del personaje quieres revisar."
      : "¡Hola! Puedo revisar tu personaje, explicar tu prioridad actual o ayudarte con la pieza que tengas abierta. ¿Qué quieres trabajar primero?";
  return MentorAnswerSchema.parse({
    intent: "conversation",
    normalizedQuestion,
    answer,
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: null,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    responseMode: fallback ? "rules_fallback" : "rules",
    model: fallback?.model ?? null,
    fallbackReason: fallback?.reason ?? null,
  });
}

type AnswerMetadata = {
  responseMode: "rules" | "ai" | "rules_fallback";
  model: string | null;
  fallbackReason: string | null;
};

/**
 * Datos pendientes que el JUGADOR puede resolver mirando el juego o rellenando
 * su perfil: un dato que falta, el límite de resistencias o sus atributos.
 * El resto (precio en el mercado, caché de precios, heurísticas del motor…) no
 * se le puede preguntar: «necesito el precio de tu varita» no tiene respuesta
 * útil en el chat, y la IA lo volvía a preguntar en cada turno.
 */
const ASKABLE_FACT_RE =
  /falta el dato|is missing from the profile|confirma el l[ií]mite|confirm each resistance|rev[ií]salos|check them/i;

function isAskableFact(text: string): boolean {
  return ASKABLE_FACT_RE.test(text);
}

function metadata(
  mode: AnswerMetadata["responseMode"] = "rules",
  model: string | null = null,
  fallbackReason: string | null = null,
): AnswerMetadata {
  return { responseMode: mode, model, fallbackReason };
}

/**
 * Recomendaciones que responden a «¿por qué muero?». El resto (arma, enlaces,
 * build objetivo) puede ser útil, pero no explica las muertes.
 */
const SURVIVAL_RECOMMENDATION_IDS: ReadonlySet<string> = new Set([
  "rec-resistencias-elementales",
  "rec-resistencia-caos",
  "rec-huecos-equipo",
  "rec-vida-baja",
  "rec-datos-resistencias",
  "rec-datos-vida",
]);

/**
 * Recomendaciones que responden a «me falta daño»: arma, supports de la skill
 * principal y requisitos de atributos (sin ellos, gemas y equipo no rinden).
 */
const DAMAGE_RECOMMENDATION_IDS: ReadonlySet<string> = new Set([
  "rec-mejora-arma",
  "rec-enlaces-skill",
  "rec-requisitos-atributos",
]);

function answerFromRecommendation(
  recommendation: Recommendation,
  intent: "next_improvement" | "explain_priority",
  normalizedQuestion: string,
  result: EngineResult,
  answerMetadata: AnswerMetadata,
  focus: MentorQuestionFocus = null,
  lang: AnswerLang = "es",
): MentorAnswer {
  const title = publicText(recommendation.title, [recommendation]);
  const reason = publicText(recommendation.reason, [recommendation]);
  const action = publicText(recommendation.action, [recommendation]);
  const answer =
    recommendation.actionKind === "session_gate"
      ? `${title}. ${reason} ${action}`
      : lang === "en"
        ? focus === "survival"
          ? `If you die often, the first thing I'd check is "${title}". ${reason}`
          : focus === "damage"
            ? `If you're low on damage, the first thing I'd check is "${title}". ${reason}`
            : intent === "explain_priority"
              ? `Your main problem right now is "${title}". ${reason}`
              : `What I'd do next: ${title}. ${reason}`
      : focus === "survival"
        ? `Si mueres a menudo, lo primero que revisaría es «${title}». ${reason}`
        : focus === "damage"
          ? `Si te falta daño, lo primero que revisaría es «${title}». ${reason}`
          : intent === "explain_priority"
            ? // Sin «Impacto estimado… (métrica parcial orientativa). Riesgo medio: …»:
              // era jerga del motor en mitad de la respuesta. El riesgo sigue en la
              // tarjeta de la recomendación.
              `Tu principal problema ahora es «${title}». ${reason}`
            : `Lo siguiente que haría: ${title}. ${reason}`;

  return MentorAnswerSchema.parse({
    intent,
    normalizedQuestion,
    answer,
    nextAction: nextActionFromRecommendation(recommendation),
    usedRecommendationIds: [recommendation.id],
    relatedItemIds: [...recommendation.relatedItemIds],
    sources: recommendation.sources,
    confidence: recommendation.confidence,
    unverified: recommendation.unverified.map((text) => publicText(text, [recommendation])),
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: null,
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...answerMetadata,
  });
}

/**
 * «Me falta daño» sin nada que corregir en arma, supports ni atributos. Señala
 * lo que más daño da en campaña y aún no compruebo con equipo: el nivel de la
 * gema principal.
 */
function damageNothingFoundAnswer(lang: AnswerLang): string {
  return lang === "en"
    ? "In what I can check (your weapon, your main skill's support gems and your attributes) " +
        "I don't see a clear cause. What usually gives the most damage while levelling is your " +
        "main skill gem's level: raise it with an uncut gem of a higher level, as far as your " +
        "character level allows. The quick review tells you if it's behind."
    : "En lo que puedo revisar (tu arma, los apoyos de tu habilidad principal y tus atributos) " +
        "no veo una causa clara. Lo que más daño suele dar mientras subes de nivel es el nivel " +
        "de tu gema principal: súbela con una gema sin tallar de más nivel, hasta donde te deje " +
        "tu personaje. La revisión rápida te dice si va atrasada.";
}

function focusNothingFoundAnswer(
  normalizedQuestion: string,
  result: EngineResult,
  answerMetadata: AnswerMetadata,
  lang: AnswerLang = "es",
  focus: MentorQuestionFocus = "survival",
  /** Con foco daño: lo más grave de aguante que sí se ve, para no callárselo. */
  alsoSeen?: Recommendation,
): MentorAnswer {
  const also =
    focus === "damage" && alsoSeen
      ? lang === "en"
        ? `\n\nIt isn't damage, but I do see something else that gets you killed sooner: “${alsoSeen.title}”. ${alsoSeen.action}`
        : `\n\nNo es de daño, pero sí veo otra cosa que te hace morir antes: «${alsoSeen.title}». ${alsoSeen.action}`
      : "";
  return MentorAnswerSchema.parse({
    intent: "explain_priority",
    normalizedQuestion,
    answer: focus === "damage" ? damageNothingFoundAnswer(lang) + also : lang === "en"
      ? "In what I can check (elemental resistances, chaos resistance, life and empty gear slots) " +
        "I don't find a clear cause for your deaths. It may be something I don't check yet, like " +
        "armour, evasion, energy shield or the exact mechanic that kills you. If you tell me what " +
        "kills you (a boss, a damage type, a group of monsters), I'll keep it in mind in the journal."
      :
      "En lo que puedo revisar —resistencias elementales, resistencia al caos, vida y huecos de equipo— " +
      "no encuentro una causa clara de tus muertes. Puede deberse a algo que todavía no compruebo, como " +
      "armadura, evasión, escudo de energía o la mecánica concreta que te mata. Si me dices qué te mata " +
      "(un jefe, un tipo de daño, un grupo de monstruos), lo tendré en cuenta en el diario.",
    nextAction: null,
    usedRecommendationIds: also ? [alsoSeen!.id] : [],
    relatedItemIds: [],
    sources: also ? alsoSeen!.sources : [],
    confidence: null,
    unverified: [],
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: null,
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...answerMetadata,
  });
}

function patchFeatureReviewAnswer(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  block: NonNullable<MentorQueryOptions["patchFeatureBlock"]>,
): MentorAnswer {
  const en = langOf(options) === "en";
  const missingEvidence = en
    ? `The "${block.label}" area isn't reviewed yet for ${block.patch}.`
    : `El área «${block.label}» todavía no está revisada para ${block.patch}.`;
  return MentorAnswerSchema.parse({
    intent: "explain_priority",
    normalizedQuestion,
    answer: en
      ? `${missingEvidence} ${block.note} ` +
        "I won't recommend that mechanic until there's evidence that fits this patch."
      : `${missingEvidence} ${block.note} ` +
        "No te recomendaré esa mecánica hasta que exista evidencia compatible con este parche.",
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [missingEvidence],
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: null,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    ...metadata(),
  });
}

function incompleteProfileAnswer(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  intent: "next_improvement" | "explain_priority",
  readiness: CharacterReadiness,
): MentorAnswer {
  const en = langOf(options) === "en";
  const missing = readiness.issues
    .map((issue) => (en ? issue.labelEn : issue.label).toLowerCase())
    .join(", ");
  return MentorAnswerSchema.parse({
    intent,
    normalizedQuestion,
    answer: en
      ? `Before picking an improvement I need your real character. Missing: ${missing}. ` +
        "Open \"Complete character\" and copy that data from PoE2; I won't turn a partial plan into observed stats."
      : `Antes de elegir una mejora necesito completar tu personaje real. Faltan: ${missing}. ` +
        "Abre «Completar personaje» y copia esos datos desde PoE2; no convertiré un plan parcial en estadísticas observadas.",
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: readiness.issues.map((issue) => (en ? issue.detailEn : issue.detail)),
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: null,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    ...metadata(),
  });
}

/**
 * «¿Qué mejoro ahora?» sin equipo: la web contesta con la revisión rápida y
 * no enseña este texto mientras falten datos; queda en el hilo como registro.
 */
function quickReviewFirstAnswer(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  intent: "next_improvement" | "explain_priority",
): MentorAnswer {
  return MentorAnswerSchema.parse({
    intent,
    normalizedQuestion,
    answer:
      langOf(options) === "en"
        ? "To pick an improvement in depth I need your gear. Until then, the quick review answers with what it already knows about your character."
        : "Para elegir una mejora a fondo necesito tu equipo. Mientras tanto te contesta la revisión rápida, con lo que ya sabe de tu personaje.",
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: null,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    ...metadata(),
  });
}

function craftingContextAnswer(
  state: MentorCraftingState,
  normalizedQuestion: string,
  result: EngineResult,
  answerMetadata: AnswerMetadata,
): MentorAnswer {
  const canonical = state.mode === "coach"
    ? (() => {
        const focus = state.focus === null
          ? "un objetivo todavía sin clasificar"
          : COACH_FOCUS_LABELS[state.focus];
        const roll = COACH_ROLL_MINIMUM_LABELS[state.rollMinimum];
        const steps = `${state.attemptLimit} ${state.attemptLimit === 1 ? "paso" : "pasos"}`;
        const progress = state.phase === "planning"
          ? `Has autorizado como máximo ${steps}.`
          : `El último resultado corresponde al paso ${state.attemptCurrent} de ${state.attemptLimit}.`;
        const decision = state.decision === "continue"
          ? "El contrato todavía permite continuar, pero solo hasta su límite."
          : state.decision === "stop"
            ? "El contrato indica detener el gasto."
            : state.decision === "restart"
              ? "El contrato indica replantear el objetivo o cambiar de base."
              : state.decision === "unclear"
                ? "El resultado aún no es suficientemente claro para decidir otro gasto."
                : "Todavía no se ha registrado ningún resultado.";
        const action = state.nextAction === null
          ? "No hay otra moneda autorizada por el guía en este momento."
          : `La siguiente acción estructurada del guía es ${
              OBSERVED_CRAFTING_ACTIONS.find((candidate) => candidate.id === state.nextAction)
                ?.label ?? "la moneda ya mostrada"
            }.`;
        return (
          `Tu contrato activo busca ${focus} y exige ${roll}. ${progress} ${decision} ${action} ` +
          "El Mentor puede explicar esta decisión, pero no sustituirla por una receta inventada."
        );
      })()
    : (() => {
        const goal = CRAFTING_GOAL_LABELS[state.goalCategory];
        const buildContext = state.buildIntent === null
          ? "El encaje con el personaje todavía no está comprobado."
          : state.buildIntent.alignment === "aligned"
            ? `El objetivo está alineado con ${craftingBuildIntentLabel(state.buildIntent)}, aunque eso no demuestra que esta base pueda recibirlo.`
            : state.buildIntent.alignment === "choice-required"
              ? `El contexto del personaje apunta a ${craftingBuildIntentLabel(state.buildIntent)}; elige cuál trabajar antes de gastar.`
              : state.buildIntent.alignment === "conflict"
                ? `Revisa el encaje: el contexto apunta a ${craftingBuildIntentLabel(state.buildIntent)}, no al objetivo actual.`
                : "El personaje no demuestra una prioridad de crafting para esta pieza.";
        const protection = state.protectedModifierCount === 0
          ? "No has marcado ninguna línea como intocable."
          : `Has marcado ${state.protectedModifierCount} ${
              state.protectedModifierCount === 1 ? "línea intocable" : "líneas intocables"
            }.`;
        const stop = state.stopCriteria.length === 0
          ? "Todavía falta una condición observable de parada."
          : `La parada contiene ${state.stopCriteria.length} ${
              state.stopCriteria.length === 1 ? "condición observable" : "condiciones observables"
            }.`;
        const action = state.action === null
          ? state.tool === "currency"
            ? "Todavía no has elegido una moneda compatible."
            : `Has abierto ${state.tool === "essence" ? "Essences" : "Alloys"}, pero su preflight todavía se completa dentro de ese panel.`
          : `La moneda preparada es ${
              OBSERVED_CRAFTING_ACTIONS.find((candidate) => candidate.id === state.action)?.label ??
              "la moneda mostrada"
            } en variante ${
              state.variant === "greater"
                ? "superior"
                : state.variant === "perfect"
                  ? "perfecta"
                  : "base"
            }.`;
        const status = state.stopAlreadyReached
          ? "La pieza ya cumple la parada: no autorices otro gasto para perseguir el mismo objetivo."
          : state.ready
            ? "Contrato y preflight completos: puedes preparar la sesión, sin asumir que el resultado esté garantizado."
            : state.preflightConfirmed
              ? "Has confirmado el riesgo, pero el contrato aún no reúne todo lo necesario para preparar la sesión."
              : "El gasto sigue bloqueado hasta completar el contrato y confirmar el preflight.";
        return (
          `Contrato avanzado para ${goal}. ${buildContext} ${protection} ${stop} ${action} ${status} ` +
          "El Mentor no añadirá una receta, un peso ni una probabilidad que el banco no haya demostrado."
        );
      })();

  return MentorAnswerSchema.parse({
    intent: "explain_priority",
    normalizedQuestion,
    answer: canonical,
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: null,
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...answerMetadata,
  });
}

function recalledAnswer(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  intent: MentorIntent,
  result: EngineResult,
): MentorAnswer {
  const primaryEntry = options.memory.primaryEntry!;
  const recalled: MentorNextAction | null =
    primaryEntry.nextAction !== null
      ? {
          text: publicText(primaryEntry.nextAction, result.recommendations),
          recommendationId: primaryEntry.recommendationId,
          relatedItemIds: [...primaryEntry.relatedItemIds],
          canSaveToJournal: false,
          recommendation: null,
          recalledFromEntryId: primaryEntry.entryId,
        }
      : null;

  const primaryTitle = publicText(primaryEntry.title, result.recommendations);
  const answer = langOf(options) === "en"
    ? intent === "explain_priority"
      ? `Your priority is still "${primaryTitle}", which you saved in the journal and is still ` +
        "in progress. I won't suggest another decision until you record its result: one action at a time."
      : `You already have an action in progress: "${primaryTitle}". Finish it and write the result in ` +
        "the journal; then I'll work out the next step."
    : intent === "explain_priority"
      ? `Tu prioridad sigue siendo «${primaryTitle}», que anotaste en el diario y aún está ` +
        "en curso. No propongo otra decisión hasta que registres su resultado: una sola acción a la vez."
      : `Ya tienes una acción en marcha: «${primaryTitle}». Termínala y anota el resultado en ` +
        "el diario; entonces calcularé el siguiente paso.";

  return MentorAnswerSchema.parse({
    intent: intent === "unsupported" ? "next_improvement" : intent,
    normalizedQuestion,
    answer,
    nextAction: recalled,
    usedRecommendationIds: [],
    relatedItemIds: recalled?.relatedItemIds ?? [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: null,
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...metadata(),
  });
}

function compact(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const withoutControls = Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? " " : character;
  }).join("");
  const cleaned = withoutControls.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, max);
}

type MissingFact = {
  id: string;
  text: string;
  recommendationIds: string[];
};

function factId(text: string): string {
  return `fact-${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

function sanitizeEnvelope(
  envelope: ContextEnvelope | undefined,
  options: MentorQueryOptions,
  recommendations: Recommendation[],
): ContextEnvelope | null {
  if (!envelope) return null;
  const levelReading = readCharacterLevel(options.profile);

  let selectedItem = null;
  if (envelope.selectedItem) {
    const canonicalItem = options.profile.items.find((i) => i.id === envelope.selectedItem!.id);
    if (canonicalItem) {
      selectedItem = {
        id: canonicalItem.id.slice(0, 200),
        name: (canonicalItem.name || canonicalItem.baseType).slice(0, 200),
      };
    }
  }

  let activeRecommendationId = null;
  if (envelope.activeRecommendationId) {
    const canonicalRec = recommendations.find((r) => r.id === envelope.activeRecommendationId);
    if (canonicalRec) {
      activeRecommendationId = canonicalRec.id.slice(0, 200);
    }
  }

  const craftingState =
    envelope.activeArea === "crafting" && envelope.craftingState !== null
      ? envelope.craftingState.mode === "coach"
        ? {
            ...envelope.craftingState,
            attemptCurrent: Math.min(
              envelope.craftingState.attemptCurrent,
              envelope.craftingState.attemptLimit,
            ),
            decision:
              envelope.craftingState.phase === "result"
                ? envelope.craftingState.decision
                : null,
          }
        : {
            ...envelope.craftingState,
            // La relación con la build se vuelve a derivar desde el perfil y
            // el objetivo canónicos; nunca se confía en el resumen del cliente.
            buildIntent: deriveCraftingBuildIntent({
              profile: options.profile,
              target: options.target,
              profileGoal: options.goal.kind,
              goalCategory: envelope.craftingState.goalCategory,
            }),
            // La interfaz no puede declarar el contrato listo si la parada no
            // existe, ya se cumple o falta la confirmación previa.
            ready:
              envelope.craftingState.ready &&
              envelope.craftingState.stopCriteria.length > 0 &&
              !envelope.craftingState.stopAlreadyReached &&
              envelope.craftingState.preflightConfirmed,
          }
      : null;

  return {
    version: "1.0",
    activeArea: envelope.activeArea,
    character: {
      level: levelReading.known ? levelReading.level : null,
      characterClass: (options.profile.characterClass ?? "").slice(0, 100) || null,
    },
    targetBuild: options.target ? options.target.name.slice(0, 200) : null,
    selectedItem,
    // Preferencias y progreso declarados por el jugador. La forma está
    // completamente acotada por enums; no se aceptan mecánicas ni texto libre.
    craftingState,
    activeRecommendationId,
    market: {
      budgetAmount: options.budget?.amount ?? null,
      budgetCurrency: options.budget?.currency.slice(0, 50) ?? null,
      league: options.league.slice(0, 100),
    },
    sessionActive: envelope.sessionActive,
    lastAction: null, // No authoritative state available
  };
}

function buildAiContext(
  options: MentorQueryOptions,
  heuristicIntent: MentorIntent,
  recommendations: Recommendation[],
): { context: MentorAiContext; missingById: Map<string, MissingFact> } {
  const missingByText = new Map<string, MissingFact>();
  for (const recommendation of recommendations) {
    for (const rawFact of recommendation.unverified) {
      const text = compact(publicText(rawFact, recommendations), 400);
      if (!text || !isAskableFact(text)) continue;
      const current = missingByText.get(text);
      if (current) {
        if (!current.recommendationIds.includes(recommendation.id)) {
          current.recommendationIds.push(recommendation.id);
        }
      } else {
        missingByText.set(text, {
          id: factId(text),
          text,
          recommendationIds: [recommendation.id],
        });
      }
    }
  }
  const missingFacts = [...missingByText.values()].slice(0, 12);
  const missingById = new Map(missingFacts.map((fact) => [fact.id, fact]));

  const levelReading = readCharacterLevel(options.profile);
  const context: MentorAiContext = {
    question: options.question,
    heuristicIntent,
    conversation: (options.conversation ?? []).slice(-8).map((turn) => ({
      role: turn.role,
      text: compact(turn.text, 800) ?? "Mensaje vacío",
    })),
    character: {
      level: levelReading.known ? levelReading.level : null,
      characterClass: compact(options.profile.characterClass, 100) ?? "Desconocida",
      ascendancy: compact(options.profile.ascendancy, 100),
      archetype: compact(options.profile.archetype, 200),
      life: options.profile.life ?? null,
      energyShield: options.profile.energyShield ?? null,
      armour: options.profile.armour ?? null,
      evasion: options.profile.evasion ?? null,
      resistances: { ...options.profile.resistances },
    },
    goal: {
      kind: options.goal.kind,
      note: compact(options.goal.note, 300),
    },
    budget: options.budget === null ? null : { ...options.budget },
    activeAction:
      options.memory.primaryEntry === null
        ? null
        : {
            title: compact(options.memory.primaryEntry.title, 200) ?? "Acción en curso",
            action: compact(options.memory.primaryEntry.nextAction, 500),
            relatedItemIds: options.memory.primaryEntry.relatedItemIds.slice(0, 20),
          },
    buildMemory: options.memory.build.entries
      .filter((entry) => entry.active)
      .slice(0, 12)
      .map((entry) => ({
        kind: entry.kind,
        label: compact(entry.label, 160) ?? "Regla sin título",
        reason: compact(entry.reason, 200) ?? "Sin motivo indicado",
        relatedItemIds: entry.relatedItemIds.slice(0, 20),
      })),
    items: options.profile.items.slice(0, 14).map((item) => ({
      id: item.id.slice(0, 200),
      slot: item.slot,
      name: compact(item.name, 100) ?? "Objeto sin nombre",
      baseType: compact(item.baseType, 100) ?? "Base desconocida",
    })),
    candidates: recommendations.map((recommendation) => ({
      id: recommendation.id.slice(0, 200),
      priority: recommendation.priority,
      title: compact(recommendation.title, 200) ?? "Recomendación sin título",
      action: compact(recommendation.action, 500) ?? "Sin acción",
      reason: compact(recommendation.reason, 500) ?? "Sin motivo",
      confidence: recommendation.confidence,
      actionKind: recommendation.actionKind,
      relatedItemIds: recommendation.relatedItemIds.slice(0, 20),
      missingFactIds: missingFacts
        .filter((fact) => fact.recommendationIds.includes(recommendation.id))
        .map((fact) => fact.id),
    })),
    missingFacts,
    envelope: sanitizeEnvelope(options.contextEnvelope, options, recommendations),
  };
  return { context, missingById };
}

function safetyIdentifier(seed: string | undefined): string {
  return `ec_${createHash("sha256")
    .update(seed ?? "server-internal")
    .digest("hex")
    .slice(0, 32)}`;
}

function validateDecision(
  decision: MentorAiDecision,
  recommendations: Recommendation[],
  missingById: Map<string, MissingFact>,
  heuristicIntent: MentorIntent,
  context: MentorAiContext,
): void {
  const groundedRecommendationIds = decision.groundedRecommendationIds ?? [];
  const groundedMissingFactIds = decision.groundedMissingFactIds ?? [];
  const hasCraftingContract =
    heuristicIntent === "explain_priority" &&
    context.envelope?.activeArea === "crafting" &&
    context.envelope.craftingState !== null;
  if (hasCraftingContract && decision.kind !== "explain_context") {
    throw new MentorAiError(
      "La IA ignoró el contrato de crafting activo; se usaron las reglas.",
    );
  }
  if (
    groundedRecommendationIds.some(
      (id) => !recommendations.some((candidate) => candidate.id === id),
    ) || groundedMissingFactIds.some((id) => !missingById.has(id))
  ) {
    throw new MentorAiError("La IA citó un hecho inexistente; se usaron las reglas.");
  }

  if (decision.kind === "conversation") {
    if (
      heuristicIntent !== "conversation" ||
      decision.recommendationId !== null ||
      decision.missingFactId !== null ||
      !decision.message
    ) {
      throw new MentorAiError("La conversación de IA no pasó la validación; se usaron las reglas.");
    }
    return;
  }
  if (decision.kind === "explain_context") {
    if (
      !hasCraftingContract ||
      decision.recommendationId !== null ||
      decision.missingFactId !== null ||
      groundedRecommendationIds.length > 0 ||
      groundedMissingFactIds.length > 0
    ) {
      throw new MentorAiError(
        "La explicación contextual de IA no respetó el contrato; se usaron las reglas.",
      );
    }
    return;
  }
  if (decision.kind === "choose_recommendation") {
    if (
      decision.recommendationId === null ||
      !recommendations.some((candidate) => candidate.id === decision.recommendationId) ||
      decision.missingFactId !== null
    ) {
      throw new MentorAiError("La IA eligió una recomendación inexistente; se usaron las reglas.");
    }
    if (
      decision.message &&
      !groundedRecommendationIds.includes(decision.recommendationId)
    ) {
      throw new MentorAiError("La explicación de IA no citó su recomendación; se usaron las reglas.");
    }
    return;
  }
  if (decision.kind === "ask_missing_fact") {
    // Una pregunta que el Mentor no ha sabido clasificar no se contesta
    // pidiendo un dato pendiente de otra recomendación: «¿y en atributos qué
    // subo?» recibía «¿cuál es el límite de tus resistencias?» (24-11-2026).
    if (heuristicIntent === "unsupported") {
      throw new MentorAiError(
        "La IA contestó a otra cosa con un dato pendiente; se usaron las reglas.",
      );
    }
    if (
      decision.missingFactId === null ||
      !missingById.has(decision.missingFactId) ||
      decision.recommendationId !== null
    ) {
      throw new MentorAiError("La IA pidió un dato inexistente; se usaron las reglas.");
    }
    if (decision.message && !groundedMissingFactIds.includes(decision.missingFactId)) {
      throw new MentorAiError("La pregunta de IA no citó el dato pendiente; se usaron las reglas.");
    }
    return;
  }
  if (
    decision.kind === "explain_current_case" &&
    decision.message &&
    (recommendations[0] === undefined ||
      !groundedRecommendationIds.includes(recommendations[0].id))
  ) {
    throw new MentorAiError(
      "La explicación de IA no citó el caso actual; se usaron las reglas.",
    );
  }
  if (decision.recommendationId !== null || decision.missingFactId !== null) {
    throw new MentorAiError("La decisión de IA contenía ids inesperados; se usaron las reglas.");
  }
}

function meaningfulContextText(context: MentorAiContext): string {
  return JSON.stringify({
    character: context.character,
    goal: context.goal,
    budget: context.budget,
    activeAction: context.activeAction
      ? { title: context.activeAction.title, action: context.activeAction.action }
      : null,
    buildMemory: context.buildMemory.map(({ kind, label, reason }) => ({ kind, label, reason })),
    items: context.items.map(({ slot, name, baseType }) => ({ slot, name, baseType })),
    candidates: context.candidates.map(
      ({ priority, title, action, reason, confidence, actionKind }) => ({
        priority,
        title,
        action,
        reason,
        confidence,
        actionKind,
      }),
    ),
    missingFacts: context.missingFacts.map(({ text }) => text),
    envelope: context.envelope
      ? {
          activeArea: context.envelope.activeArea,
          character: context.envelope.character,
          targetBuild: context.envelope.targetBuild,
          selectedItem: context.envelope.selectedItem?.name ?? null,
          craftingState: context.envelope.craftingState,
          market: context.envelope.market,
          sessionActive: context.envelope.sessionActive,
        }
      : null,
  });
}

function numberTokens(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
}

/**
 * Permite prosa libre, pero no deja pasar ids, HTML, enlaces ni números que no
 * existan en los hechos canónicos. Ante la duda se conserva la respuesta de
 * reglas: nunca se «arregla» silenciosamente una alucinación.
 */
function generatedCopy(
  decision: MentorAiDecision,
  context: MentorAiContext,
): string | null {
  if (!decision.message) return null;
  const combined = [decision.message, decision.followUpQuestion].filter(Boolean).join("\n\n");
  const forbiddenIds = [
    ...context.candidates.map((candidate) => candidate.id),
    ...context.missingFacts.map((fact) => fact.id),
  ];
  if (
    forbiddenIds.some((id) => combined.toLowerCase().includes(id.toLowerCase())) ||
    /\b(?:rec|fact)(?::|-)[a-z0-9]/i.test(combined) ||
    /\b(?:recommendationId|missingFactId|inputFingerprint)\b/i.test(combined) ||
    /<\/?[a-z][^>]*>|https?:\/\//i.test(combined)
  ) {
    throw new MentorAiError("La IA intentó mostrar datos internos; se usaron las reglas.");
  }

  const allowedNumbers = new Set(["2", ...numberTokens(meaningfulContextText(context))]);
  const inventedNumber = numberTokens(combined).find((token) => !allowedNumbers.has(token));
  if (inventedNumber) {
    throw new MentorAiError("La IA añadió una cifra no verificada; se usaron las reglas.");
  }
  return combined.trim();
}

function withGeneratedCopy(answer: MentorAnswer, copy: string | null): MentorAnswer {
  return copy ? MentorAnswerSchema.parse({ ...answer, answer: copy }) : answer;
}

function conversationalAnswer(
  decision: MentorAiDecision,
  context: MentorAiContext,
  normalizedQuestion: string,
  result: EngineResult,
  selector: MentorDecisionSelector,
  missingById: Map<string, MissingFact>,
): MentorAnswer {
  const copy = generatedCopy(decision, context);
  if (!copy) {
    throw new MentorAiError("La IA no redactó una respuesta conversacional; se usaron las reglas.");
  }
  const usedRecommendationIds = decision.groundedRecommendationIds ?? [];
  const usedRecommendations = result.recommendations.filter((candidate) =>
    usedRecommendationIds.includes(candidate.id),
  );
  const groundedFacts = (decision.groundedMissingFactIds ?? [])
    .map((id) => missingById.get(id))
    .filter((fact): fact is MissingFact => fact !== undefined);
  return MentorAnswerSchema.parse({
    intent: "conversation",
    normalizedQuestion,
    answer: copy,
    nextAction: null,
    usedRecommendationIds,
    relatedItemIds: Array.from(
      new Set(usedRecommendations.flatMap((candidate) => candidate.relatedItemIds)),
    ),
    sources: usedRecommendations.flatMap((candidate) => candidate.sources),
    confidence: null,
    unverified: groundedFacts.map((fact) => fact.text),
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: null,
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...metadata("ai", selector.name),
  });
}

function noSafeAction(
  normalizedQuestion: string,
  result: EngineResult,
  selector: MentorDecisionSelector,
  copy: string | null = null,
  lang: AnswerLang = "es",
): MentorAnswer {
  return MentorAnswerSchema.parse({
    intent: "unsupported",
    normalizedQuestion,
    answer:
      copy ??
      (lang === "en"
        ? "I can't find a safe action among the verified options to answer that question. " +
          "I won't improvise a change outside the engine."
        : null) ??
      "No encuentro una acción segura entre las opciones verificadas para responder a esa pregunta. " +
        "No voy a improvisar un cambio fuera del motor.",
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: unsupportedInfo(lang),
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...metadata("ai", selector.name),
  });
}

export function answerMentorQuery(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies = {},
): Promise<MentorAnswer> {
  const selector = deps.selector ?? null;
  // Pregunta por una comparación de equipo abierta: su propio camino, sin
  // tocar nada del Mentor de siempre.
  if (options.gear !== undefined) return answerAboutGear(options, deps, options.gear);
  if (selector !== null && selector.write !== undefined && canConverse(options)) {
    return converse(options, deps, selector as WritingSelector);
  }
  return buildAnswer(options, deps);
}

// ---------------------------------------------------------------------------
// El Mentor conversa: las reglas ponen los datos y la IA redacta (tarea 13)
// ---------------------------------------------------------------------------

type RoutingSelector = MentorDecisionSelector & { route: NonNullable<MentorDecisionSelector["route"]> };
type WritingSelector = MentorDecisionSelector & { write: NonNullable<MentorDecisionSelector["write"]> };

/** Lo que sigue como estaba: botones de la web, áreas en revisión, Crafting y saludos. */
function canConverse(options: MentorQueryOptions): boolean {
  if (options.intentHint !== undefined || options.patchFeatureBlock !== undefined) return false;
  const envelope = options.contextEnvelope;
  // Un contrato de Crafting abierto se explica con su estado, no con la charla.
  if (envelope?.activeArea === "crafting" && envelope.craftingState !== null && envelope.craftingState !== undefined) {
    return false;
  }
  return classifyMentorQuestion(options.question).intent !== "conversation";
}

/**
 * Cuánto texto de fichas ve la IA como mucho. Groq gratis deja 8.000 tokens
 * por minuto: con 9.000 caracteres (unos 4.000 tokens por respuesta) la
 * tercera pregunta del minuto ya caía en el límite (medido el 25-11-2026).
 */
const MAX_WRITER_DATA_CHARS = 6000;
/** La guía de un acto no se lleva todo el sitio: lo más útil va primero. */
const MAX_WRITER_GUIDE_CHARS = 3000;
/** Turnos de la charla que ve la IA, y cuánto de cada uno. */
const WRITER_TURNS = 4;
const WRITER_TURN_CHARS = 400;
/** Frases de las reglas que no son un dato del juego y despistan a quien redacta. */
const NOT_A_FACT_RE = /Sale de los datos del juego y de reglas fijas, sin IA\.|This comes from the game's data and fixed rules, no AI\./g;

/**
 * La respuesta de las reglas, línea a línea, con su siguiente paso. Si la IA
 * enseña el siguiente paso de la pregunta de ahora, la tarjeta de la web se
 * quita para no decirlo dos veces (`converse`).
 */
function rulesLines(answer: MentorAnswer, tema: string, lang: AnswerLang): TopicLine[] {
  const next = answer.nextAction ? [nextStepLine(answer, lang)] : [];
  return [...answerLines(answer.answer.replace(NOT_A_FACT_RE, "")), ...next].map((texto) => ({ tema, texto }));
}

/**
 * El siguiente paso de una respuesta de las reglas, como frase. Ahí está lo
 * concreto del personaje («tu arma no tiene ni un mod»): si la IA no lo ve, la
 * respuesta se lo calla (tarea 14: «hace poco daño» solo daba asistencias).
 */
function nextStepLine(answer: MentorAnswer, lang: AnswerLang): string {
  return `${lang === "en" ? "Next step" : "Siguiente paso"}: ${answer.nextAction?.text ?? ""}`;
}

const vocabularies = new WeakMap<object, WriterVocabulary>();
function vocabularyFor(deps: MentorQueryDependencies): WriterVocabulary {
  const key = deps.gems?.data ?? deps.guides ?? null;
  if (key === null) return writerVocabulary(null, null);
  let vocabulary = vocabularies.get(key);
  if (!vocabulary) {
    vocabulary = writerVocabulary(deps.gems ?? null, deps.guides ?? null);
    vocabularies.set(key, vocabulary);
  }
  return vocabulary;
}

/**
 * Las reglas contestan como siempre y con eso, más lo que se venía hablando,
 * la IA escribe la respuesta. Si la IA falla, tarda, no hay cupo o escribe
 * algo que no está en los datos, sale lo que habría salido sin ella.
 */
async function converse(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies,
  selector: WritingSelector,
): Promise<MentorAnswer> {
  const lang = langOf(options);
  const rulesOnly: MentorQueryDependencies = { ...deps, selector: null };
  const { normalizedQuestion } = classifyMentorQuestion(options.question);
  const gems = deps.gems ?? null;
  const guides = deps.guides ?? null;

  /** Lo que sale si la IA no llega a redactar. */
  let base = await buildAnswer(options, rulesOnly);
  /** La respuesta de las reglas, sin el «Entiendo que…», como dato. */
  let rules = base;
  let understood = false;

  // Las preguntas anteriores del jugador se vuelven a contestar aquí: lo que
  // el navegador diga que respondió el Mentor no es un dato.
  const earlierQuestions = (options.conversation ?? [])
    .filter((turn) => turn.role === "player")
    .map((turn) => turn.text)
    .slice(-2);
  const earlier: Array<{ origen: FichaOrigin; lines: TopicLine[] }> = [];
  // «¿Cuál pongo primero?»: solo entonces se dice en una frase cuál es la primera.
  const firstPick = asksWhichFirst(options.question);
  // La más reciente primero: es de la que más se habla.
  for (const question of [...earlierQuestions].reverse()) {
    const asked = `«${question.slice(0, 120)}»`;
    const answer = await buildAnswer({ ...options, question, conversation: [] }, rulesOnly);
    earlier.push({
      origen: "anterior",
      lines: [
        ...(gems ? topicLines(gems, question, options.profile, lang, firstPick) : []).map((line) => ({
          ...line,
          tema: `${lang === "en" ? "earlier topic" : "tema anterior"} ${asked}: ${line.tema}`,
        })),
        ...(answer.intent === "unsupported"
          ? []
          : rulesLines(answer, `${lang === "en" ? "what the Mentor answered to" : "lo que el Mentor contestó a"} ${asked}`, lang)),
      ],
    });
  }
  const hasEarlier = earlier.some((part) => part.lines.length > 0);
  const guide = guides
    ? ([options.question, ...[...earlierQuestions].reverse()]
        .map((question) => guideInQuestion(guides, question, lang))
        .find((match) => match !== null) ?? null)
    : null;
  let topic = gems ? topicLines(gems, options.question, options.profile, lang, firstPick) : [];
  const lastMentorTurn = (options.conversation ?? []).filter((turn) => turn.role === "mentor").at(-1)?.text ?? "";

  // Sin nada con lo que redactar: primero, de qué tema es (tarea 12, paso 1).
  if (base.intent === "unsupported" && !hasEarlier && guide === null && topic.length === 0) {
    if (selector.route === undefined) return base;
    const result = await understand(options, deps, selector as WritingSelector & RoutingSelector, normalizedQuestion);
    if ("answer" in result) return result.answer;
    const routedRules = await buildAnswer({ ...options, question: result.routed.question }, rulesOnly, true);
    if (routedRules.intent === "unsupported") return understoodNothing(options, normalizedQuestion, selector);
    rules = routedRules;
    base = understoodAnswer(routedRules, result.routed, normalizedQuestion, selector, lang);
    topic = gems ? topicLines(gems, result.routed.question, options.profile, lang, firstPick) : [];
    understood = true;
  }

  // «Me falta daño» o «me matan» lo contesta la revisión del personaje: es lo
  // que le falla a ÉL, no una frase suelta. Lo demás («¿y qué hago?») sí lo es.
  const focus = classifyMentorQuestion(options.question).focus;
  const rulesTopic =
    focus === "damage"
      ? lang === "en"
        ? "review of this character: the first thing holding back its damage"
        : "revisión de este personaje: lo primero que le quita daño"
      : focus === "survival"
        ? lang === "en"
          ? "review of this character: the first thing getting it killed"
          : "revisión de este personaje: lo primero por lo que muere"
        : lang === "en"
          ? "loose sentence: what the rules answer without reading the chat"
          : "frase suelta: lo que contestan las reglas sin mirar la charla";
  const ask = guide ? guideAsk(options.question, earlierQuestions) : "fight";
  const rulesPart = { origen: "reglas" as const, lines: rules.intent === "unsupported" ? [] : rulesLines(rules, rulesTopic, lang) };
  const guidePart = {
    origen: "guia" as const,
    lines:
      guide && guides
        ? guideLines(guide.guide, lang, ask, ask === "where" ? stepsNamedIn(guides, guide.guide, lang, lastMentorTurn) : [])
        : [],
    maxChars: MAX_WRITER_GUIDE_CHARS,
  };
  // Con un jefe en la charla, «¿y qué hago en la pelea?» es de la guía: lo que
  // las reglas dicen de la frase suelta («rellena los huecos») va detrás.
  const fightAsk = guide !== null && asksAboutFight(options.question);
  const guideLeads = guide !== null && focus === null && (fightAsk || ask === "where");
  // Lo que el Mentor ya enseñó en la charla queda marcado; si se pide más
  // de lo mismo («dame otra», «¿y qué hago en la pelea?»), se quita mientras
  // quede algo nuevo que decir (tarea 15: repetía el primer turno).
  const mentorTurns = (options.conversation ?? []).filter((turn) => turn.role === "mentor").map((turn) => turn.text);
  const parts: Array<{ origen: FichaOrigin; lines: readonly TopicLine[]; maxChars?: number }> = guideLeads
    ? [guidePart, { origen: "tema", lines: topic }, ...earlier, rulesPart]
    : [rulesPart, { origen: "tema", lines: topic }, guidePart, ...earlier];
  const grouped = adoptSupportGroups(parts);
  // Las listas de asistencias que el Mentor enseñó en su último turno: de esas habla «dame otra».
  const listedLast = new Set(
    grouped
      .flatMap((part) => part.lines)
      .filter((line) => line.grupo?.startsWith(SUPPORT_GROUP) === true && alreadySaid(line.texto, [lastMentorTurn]))
      .map((line) => line.grupo as string),
  );
  const fichas = buildFichas(arrangeSaid(grouped, mentorTurns, fightAsk || asksForMore(options.question), lang), MAX_WRITER_DATA_CHARS);
  const personaje = characterFacts(gems, options.profile, lang);
  const charla = (options.conversation ?? []).slice(-WRITER_TURNS).map((turn) => ({
    quien: turn.role === "player" ? ("jugador" as const) : ("mentor" as const),
    texto: turn.text.slice(0, WRITER_TURN_CHARS),
  }));

  /** La IA no ha podido: lo de siempre. Sin tema aún, se pregunta primero de qué va. */
  const withoutWriter = (reason: string | null): Promise<MentorAnswer> | MentorAnswer => {
    if (base.intent === "unsupported" && !understood) return buildAnswer(options, deps);
    if (reason === null || base.responseMode === "ai") return base;
    return { ...base, ...metadata("rules_fallback", selector.name, reason) };
  };

  try {
    const decision = await selector.write(
      {
        pregunta: options.question.slice(0, 500),
        charla,
        personaje,
        fichas: fichas.map(({ id, tema, texto }) => ({ id, tema, texto })),
      },
      safetyIdentifier(options.safetyIdentifierSeed),
      lang,
    );
    const said = [
      options.question,
      ...(options.conversation ?? []).filter((turn) => turn.role === "player").map((turn) => turn.text),
    ];
    // Una sola asistencia nueva sabe a poco: se completa hasta tres con las
    // siguientes de la lista. No si pregunta cuál va primero (ahí es UNA), ni
    // si la respuesta es el fallo concreto del personaje y no una lista.
    const nextStep = lang === "en" ? "Next step:" : "Siguiente paso:";
    const chosenIds = new Set(decision.fichas.map((entry) => entry.trim()));
    const showsNextStep = fichas.some((ficha) => chosenIds.has(ficha.id) && ficha.texto.startsWith(nextStep));
    // «Dame otra» tras una lista de asistencias, quedan nuevas y la IA no
    // elige ninguna: salen las tres siguientes, con una entrada fija (la suya
    // decía que no había más).
    const another = !firstPick && asksForAnother(options.question) ? anotherSupports(decision.fichas, fichas, listedLast) : null;
    const completed =
      another !== null
        ? { ...decision, intro: lang === "en" ? "These I had not told you yet:" : "Estas no te las había dicho:", fichas: another }
        : firstPick || showsNextStep
          ? decision
          : { ...decision, fichas: topUpSupports(decision.fichas, fichas) };
    const written = composeWrittenAnswer(
      completed,
      fichas,
      [JSON.stringify(personaje), ...said].join("\n"),
      vocabularyFor(deps),
      mentorTurns,
    );
    // No hay datos y la IA lo confirma: el «no lo sé» de siempre, que además se apunta.
    // Pero en mitad de una charla, si dice «eso no lo tengo» y enseña lo más
    // cercano, vale más eso que volver a la lista de la frase suelta: «¿y si
    // esa no me ha salido?» recibía otra vez la misma lista (tarea 14).
    const nearestInChat = written.shown.length > 0 && (hasEarlier || guide !== null);
    if (!decision.enough && base.intent === "unsupported" && !nearestInChat) return withoutWriter(null);
    if (base.intent === "unsupported" || !written.origins.has("reglas")) {
      // Habla del tema de la charla o de la guía, no de lo que eligió el motor para la frase suelta.
      return { ...gemQuestionAnswer(options, normalizedQuestion, written.message), ...metadata("ai", selector.name) };
    }
    // El siguiente paso ya va escrito en la respuesta: la tarjeta lo repetiría.
    const saysNextStep = rules.nextAction !== null && written.shown.some((ficha) => ficha.texto === nextStepLine(rules, lang));
    return MentorAnswerSchema.parse({
      ...base,
      normalizedQuestion,
      answer: written.message,
      ...(saysNextStep ? { nextAction: null } : {}),
      ...metadata("ai", selector.name),
    });
  } catch (error) {
    if (error instanceof UnverifiedWriting) {
      console.warn(`[mentor-ai] redacción descartada: ${error.safeReason}${error.detail ? ` («${error.detail.slice(0, 60)}»)` : ""}`);
    }
    const reason =
      error instanceof MentorAiError || error instanceof UnverifiedWriting
        ? error.safeReason
        : "La IA no pudo redactar la respuesta; se usaron las reglas.";
    return withoutWriter(reason);
  }
}

// ---------------------------------------------------------------------------
// El Mentor de equipo: preguntas sobre una comparación de dos piezas (tarea 18)
// ---------------------------------------------------------------------------

/**
 * Las reglas comparan (`gearReading`) y de ahí salen las frases. Con IA, ella
 * elige cuáles contestan y escribe la entrada; sin IA, con cupo gastado o si
 * escribe algo que no está en las frases, contesta `gearRulesAnswer`.
 */
async function answerAboutGear(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies,
  gear: MentorGearAsk,
): Promise<MentorAnswer> {
  const lang = langOf(options);
  const { normalizedQuestion } = classifyMentorQuestion(options.question);
  const reading = gearReading(options.profile, gear, lang, deps.gems ?? null);
  const rules = gemQuestionAnswer(options, normalizedQuestion, gearRulesAnswer(reading, options.question, lang));
  const selector = deps.selector ?? null;
  if (selector === null || selector.write === undefined || options.gearRulesOnly) return rules;

  const mentorTurns = (options.conversation ?? []).filter((turn) => turn.role === "mentor").map((turn) => turn.text);
  const parts = [{ origen: "reglas" as const, lines: reading.lines }];
  const fichas = buildFichas(arrangeSaid(parts, mentorTurns, asksForMore(options.question), lang), MAX_WRITER_DATA_CHARS);
  const personaje = characterFacts(deps.gems ?? null, options.profile, lang);
  const charla = (options.conversation ?? []).slice(-WRITER_TURNS).map((turn) => ({
    quien: turn.role === "player" ? ("jugador" as const) : ("mentor" as const),
    texto: turn.text.slice(0, WRITER_TURN_CHARS),
  }));
  try {
    const decision = await selector.write(
      {
        pregunta: options.question.slice(0, 500),
        charla,
        personaje,
        fichas: fichas.map(({ id, tema, texto }) => ({ id, tema, texto })),
      },
      safetyIdentifier(options.safetyIdentifierSeed),
      lang,
    );
    const said = [
      options.question,
      ...(options.conversation ?? []).filter((turn) => turn.role === "player").map((turn) => turn.text),
    ];
    const written = composeWrittenAnswer(
      decision,
      fichas,
      [JSON.stringify(personaje), ...said].join("\n"),
      vocabularyFor(deps),
      mentorTurns,
    );
    // Sin ninguna frase de la comparación, la entrada sola no es una respuesta.
    if (written.shown.length === 0) return { ...rules, ...metadata("rules_fallback", selector.name, GEAR_NOTHING_CHOSEN[lang]) };
    return { ...gemQuestionAnswer(options, normalizedQuestion, written.message), ...metadata("ai", selector.name) };
  } catch (error) {
    if (error instanceof UnverifiedWriting) {
      console.warn(`[mentor-ai] redacción de equipo descartada: ${error.safeReason}${error.detail ? ` («${error.detail.slice(0, 60)}»)` : ""}`);
    }
    const reason =
      error instanceof MentorAiError || error instanceof UnverifiedWriting
        ? error.safeReason
        : "La IA no pudo redactar la respuesta; se usaron las reglas.";
    return { ...rules, ...metadata("rules_fallback", selector.name, reason) };
  }
}

const GEAR_NOTHING_CHOSEN = {
  es: "La IA no encontró en la comparación con qué contestar; se usaron las reglas.",
  en: "The AI found nothing in the comparison to answer with; the rules were used.",
} as const;

function understoodNothing(options: MentorQueryOptions, normalizedQuestion: string, selector: MentorDecisionSelector): MentorAnswer {
  return { ...unsupportedAnswer(options, normalizedQuestion), ...metadata("ai", selector.name) };
}

/** La respuesta de la regla del tema, con el «Entiendo que…» delante. */
function understoodAnswer(
  answer: MentorAnswer,
  routed: RoutedQuestion,
  normalizedQuestion: string,
  selector: MentorDecisionSelector,
  lang: AnswerLang,
): MentorAnswer {
  return {
    ...answer,
    normalizedQuestion,
    answer: `${understoodLine(routed.topic, lang)}

${answer.answer}`,
    // Si la respuesta ya cuenta un fallo de la IA al redactar, se deja como está.
    ...(answer.responseMode === "rules_fallback" ? {} : metadata("ai", selector.name)),
  };
}

/**
 * La IA dice de qué tema es una frase que ninguna regla reconoce. Devuelve la
 * pregunta ya con las palabras de la regla, o la respuesta «no lo sé» si la IA
 * falla, dice que no es de ningún tema o lo que dice no se sostiene.
 */
async function understand(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies,
  selector: RoutingSelector,
  normalizedQuestion: string,
): Promise<{ routed: RoutedQuestion } | { answer: MentorAnswer }> {
  const lang = langOf(options);
  let routed: ReturnType<typeof routedQuestion>;
  try {
    const decision = await selector.route(
      routeInputFor(options.question, options.profile, lang, options.conversation ?? []),
      safetyIdentifier(options.safetyIdentifierSeed),
    );
    routed = routedQuestion(decision, {
      gems: deps.gems ?? null,
      profile: options.profile,
      question: options.question,
    });
  } catch (error) {
    // Sin clave, sin cupo o sin red: como sin IA.
    const reason =
      error instanceof MentorAiError
        ? error.safeReason
        : "La IA no pudo entender la pregunta con seguridad; se usaron las reglas.";
    return { answer: unsupportedAnswer(options, normalizedQuestion, { model: selector.name, reason }) };
  }
  if (routed === null) return { answer: understoodNothing(options, normalizedQuestion, selector) };
  return { routed };
}

/**
 * Ninguna regla reconoce la frase: la IA dice de qué tema es y contesta la
 * regla de ese tema, con sus datos. Si dice que no es de ningún tema, o lo que
 * dice no se sostiene, «no lo sé».
 */
async function answerByUnderstanding(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies,
  selector: RoutingSelector,
  normalizedQuestion: string,
): Promise<MentorAnswer> {
  const result = await understand(options, deps, selector, normalizedQuestion);
  if ("answer" in result) return result.answer;
  const answer = await buildAnswer({ ...options, question: result.routed.question }, deps, true);
  // La regla del tema tampoco la reconoció (faltan los datos de gemas, por ejemplo).
  if (answer.intent === "unsupported") return understoodNothing(options, normalizedQuestion, selector);
  return understoodAnswer(answer, result.routed, normalizedQuestion, selector, langOf(options));
}

async function buildAnswer(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies,
  /** La pregunta ya viene de `answerByUnderstanding`: no se vuelve a preguntar a la IA qué es. */
  alreadyUnderstood = false,
): Promise<MentorAnswer> {
  const classified = classifyMentorQuestion(options.question);
  const intent = options.intentHint ?? classified.intent;
  const { normalizedQuestion, focus } = classified;
  const lang = langOf(options);
  // «¿Por qué muero?» se evalúa como supervivencia, sea cual sea el objetivo guardado.
  // «Me falta daño», igual con el objetivo daño.
  const engineGoal: Goal =
    focus === "survival" || focus === "damage" ? { ...options.goal, kind: focus } : options.goal;
  const selector = deps.selector ?? null;
  const readiness = assessMentorReadiness(options.profile);
  const hasStructuredCraftingContext =
    intent === "explain_priority" &&
    options.contextEnvelope?.activeArea === "crafting" &&
    options.contextEnvelope.craftingState !== null &&
    options.contextEnvelope.craftingState !== undefined;

  // La identidad del producto es fija y no depende del personaje ni de un
  // proveedor de IA. Así evitamos que una presentación básica se rechace o
  // adquiera capacidades inventadas.
  if (intent === "conversation" && isMentorIdentityQuestion(normalizedQuestion)) {
    return conversationFallback(options, normalizedQuestion);
  }

  // «¿Me cambio el arma única por una varita amarilla?» es comparar dos piezas:
  // la web tiene un comparador y el Mentor manda allí. Va antes que nada para
  // que un «daño» suelto en la frase no la lleve a «me falta daño».
  if (options.intentHint === undefined) {
    const compareAnswer = answerItemCompareQuestion(options.question, options.profile, lang);
    if (compareAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, compareAnswer);
  }

  // «¿Qué gema de asistencia le pongo a…?» se contesta con las reglas del
  // consejero de gemas: no depende del equipo, de la IA ni de la prioridad del
  // personaje. Un botón de la web (intentHint) nunca es una pregunta de gemas.
  if (deps.gems && options.intentHint === undefined) {
    // «¿Qué asistencia pongo, Encadenamiento 1 o 2?» compara dos grados: no pide una lista.
    if (isSupportTierQuestion(deps.gems, normalizedQuestion)) {
      const tierAnswer = answerSupportCompareQuestion(deps.gems, options.question, options.profile, lang);
      if (tierAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, tierAnswer);
    }
    const gemAnswer = answerSupportGemQuestion(deps.gems, options.question, options.profile, lang);
    if (gemAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, gemAnswer);
  }

  // «¿Por dónde sigo en el árbol?»: las mismas reglas que la tarjeta del árbol.
  if (deps.tree && options.intentHint === undefined) {
    const treeAnswer = answerPassiveTreeQuestion(deps.tree, options.question, options.profile, lang);
    if (treeAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, treeAnswer);
  }

  // «Necesito ayuda para mejorar Drenar esencia»: el nivel de su gema, el árbol
  // y sus asistencias. Va después de las dos anteriores: si la pregunta habla de
  // asistencias o del árbol, ya está contestada.
  if (deps.gems && options.intentHint === undefined) {
    const improveAnswer = answerImproveSkillQuestion(deps.gems, options.question, options.profile, lang);
    if (improveAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, improveAnswer);
  }

  // Dudas del juego («¿qué hechizo tallo con una gema de nivel 7?», «¿Encadenamiento
  // I o II?», maldiciones, esbirros, atributos): reglas y datos de gemas, sin IA.
  if (deps.gems && options.intentHint === undefined) {
    const gameAnswer =
      answerSkillChoiceQuestion(deps.gems, options.question, options.profile, lang) ??
      answerSupportCompareQuestion(deps.gems, options.question, options.profile, lang) ??
      answerCurseQuestion(deps.gems, options.question, options.profile, lang) ??
      answerMinionQuestion(deps.gems, options.question, options.profile, lang) ??
      answerAttributeQuestion(deps.gems, options.question, options.profile, lang);
    if (gameAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, gameAnswer);
  }

  // Lo básico de un novato (huecos de asistencia, gema en rojo, resistencias,
  // espíritu, ascendencia, orbe exaltado, escudo o dos manos): datos del
  // personaje, de las guías de la web y textos del propio juego. Sin IA.
  if (options.intentHint === undefined) {
    const basicsAnswer = answerBasicsQuestion(deps.gems ?? null, options.question, options.profile, lang);
    if (basicsAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, basicsAnswer);
  }

  // «¿Cómo mato al jefe del acto 3?»: la guía de ese acto, tal cual. Solo
  // cuando ninguna otra regla la ha reconocido.
  if (deps.guides && intent === "unsupported" && options.intentHint === undefined) {
    const guideAnswer = answerGuideQuestion(deps.guides, options.question, lang);
    if (guideAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, guideAnswer);
  }

  // Elegir habilidades («¿qué habilidad me cojo?», «¿me vale con mi mazo?»,
  // «¿por qué combina Furia con Terremoto?», «¿cómo monto mi build?»). Va
  // detrás de todas las reglas anteriores para no quitarles ninguna pregunta,
  // y delante del motor: un «¿por qué…?» suelto acababa en las resistencias.
  if (deps.gems && options.intentHint === undefined) {
    const choiceAnswer = answerSkillChoiceTopic(deps.gems, options.question, options.profile, lang);
    if (choiceAnswer !== null) return gemQuestionAnswer(options, normalizedQuestion, choiceAnswer);
  }

  // Ninguna regla la reconoce: si hay IA, dice de qué tema es y contesta la
  // regla de ese tema. Un área en revisión para este parche se respeta antes.
  if (
    intent === "unsupported" &&
    options.intentHint === undefined &&
    options.patchFeatureBlock === undefined &&
    !alreadyUnderstood &&
    selector !== null &&
    selector.route !== undefined
  ) {
    return answerByUnderstanding(
      options,
      deps,
      selector as RoutingSelector,
      normalizedQuestion,
    );
  }

  // Sin equipo, la web pregunta solo por lo que es del juego, y eso ya está
  // contestado arriba. Elegir una mejora lo hace allí la revisión rápida: aquí
  // no corre el motor (que apunta al 75 % de resistencias) ni se gasta IA.
  if (options.gameOnly && options.intentHint === undefined) {
    if (intent === "conversation") return conversationFallback(options, normalizedQuestion);
    if (intent === "unsupported") return unsupportedAnswer(options, normalizedQuestion);
    return quickReviewFirstAnswer(options, normalizedQuestion, intent);
  }

  // La conversación social nunca se convierte en una recomendación por
  // ausencia de IA. Con IA sí recibe el contexto canónico para responder.
  if (intent === "conversation" && selector === null) {
    return conversationFallback(options, normalizedQuestion);
  }

  // La compatibilidad por área se decide fuera de la IA y antes de ejecutar el
  // motor. Una pregunta libre o un cliente antiguo no pueden reabrir mediante
  // el Mentor una ruta que Crafting ya mantiene en revisión.
  if (options.patchFeatureBlock !== undefined) {
    return patchFeatureReviewAnswer(
      options,
      normalizedQuestion,
      options.patchFeatureBlock,
    );
  }

  // Sin IA se conserva la salida honesta original y no se ejecuta el motor.
  if (intent === "unsupported" && selector === null) {
    return unsupportedAnswer(options, normalizedQuestion);
  }

  // Un borrador de plan puede servir para completar el expediente, pero no es
  // evidencia suficiente para elegir una prioridad del personaje. Las
  // explicaciones de un contrato de Crafting sí siguen disponibles: descansan
  // en su estado estructurado y no necesitan fingir nivel, clase ni equipo.
  if (!readiness.ready && !hasStructuredCraftingContext) {
    if (intent === "conversation") {
      return conversationFallback(options, normalizedQuestion);
    }
    if (intent === "unsupported") {
      return unsupportedAnswer(options, normalizedQuestion);
    }
    return incompleteProfileAnswer(options, normalizedQuestion, intent, readiness);
  }

  const result = await generateRecommendations(
    options.profile,
    {
      budget: options.budget,
      goal: engineGoal,
      league: options.league,
      patch: options.patch,
      memory: options.memory,
      ...(options.target !== undefined ? { target: options.target } : {}),
      ...(options.lang !== undefined ? { lang: options.lang } : {}),
    },
    { ...(deps.priceService !== undefined ? { priceService: deps.priceService } : {}) },
  );

  // La acción activa es autoritativa: ni siquiera se consulta la IA.
  if (
    options.memory.primaryEntry !== null &&
    intent !== "conversation"
  ) {
    return recalledAnswer(options, normalizedQuestion, intent, result);
  }

  // «Me falta daño» y el motor no ve nada de daño: la IA no tiene de dónde
  // sacarlo. Contesta la revisión rápida con lo que sabe del personaje y, si
  // tampoco ve nada, se dice, señalando lo que sí se ve aunque sea de aguante.
  if (
    focus === "damage" &&
    options.intentHint === undefined &&
    !result.recommendations.some((candidate) => DAMAGE_RECOMMENDATION_IDS.has(candidate.id))
  ) {
    const reviewed = deps.gems ? answerDamageQuestion(deps.gems, options.profile, lang) : null;
    if (reviewed !== null) return gemQuestionAnswer(options, normalizedQuestion, reviewed);
    return focusNothingFoundAnswer(
      normalizedQuestion,
      result,
      metadata(),
      lang,
      "damage",
      result.recommendations.find((candidate) => SURVIVAL_RECOMMENDATION_IDS.has(candidate.id)),
    );
  }

  const sanitizedEnvelope = sanitizeEnvelope(
    options.contextEnvelope,
    options,
    result.recommendations,
  );
  const craftingState =
    intent === "explain_priority" && sanitizedEnvelope?.activeArea === "crafting"
      ? sanitizedEnvelope.craftingState
      : null;
  if (craftingState !== null && selector === null) {
    return craftingContextAnswer(
      craftingState,
      normalizedQuestion,
      result,
      metadata(),
    );
  }

  const top = result.recommendations[0];
  if (
    top === undefined &&
    (selector === null || intent === "next_improvement" || intent === "explain_priority") &&
    !(selector !== null && craftingState !== null)
  ) {
    return MentorAnswerSchema.parse({
      intent: intent === "unsupported" ? "next_improvement" : intent,
      normalizedQuestion,
      answer: lang === "en"
        ? "With the data I have right now I can't find a clear improvement to recommend. " +
          "Fill in your character's unknown data or adjust your target build and ask again."
        : "Con los datos que tengo ahora mismo no encuentro una mejora clara que recomendarte. " +
          "Completa los datos desconocidos de tu personaje o ajusta tu build objetivo y vuelve a preguntar.",
      nextAction: null,
      usedRecommendationIds: [],
      relatedItemIds: [],
      sources: [],
      confidence: null,
      unverified: [],
      memoryImpact: result.memoryImpact,
      inputFingerprint: result.inputFingerprint,
      unsupported: null,
      generatedAt: result.generatedAt,
      engineVersion: result.engineVersion,
      ...metadata(),
    });
  }

  /**
   * Respuesta por reglas, igual sin IA que cuando la IA falla: con foco
   * supervivencia solo vale una recomendación defensiva, y con foco daño una
   * de daño; si no la hay, se dice.
   */
  const answerByRules = (recommendation: Recommendation, answerMetadata: AnswerMetadata): MentorAnswer => {
    if (focus === "survival" || focus === "damage") {
      const allowed = focus === "survival" ? SURVIVAL_RECOMMENDATION_IDS : DAMAGE_RECOMMENDATION_IDS;
      const focused = result.recommendations.find((candidate) => allowed.has(candidate.id));
      return focused
        ? answerFromRecommendation(focused, "explain_priority", normalizedQuestion, result, answerMetadata, focus, lang)
        : focusNothingFoundAnswer(normalizedQuestion, result, answerMetadata, lang, focus);
    }
    return answerFromRecommendation(
      recommendation,
      intent === "explain_priority" ? "explain_priority" : "next_improvement",
      normalizedQuestion,
      result,
      answerMetadata,
      null,
      lang,
    );
  };

  if (selector === null && top !== undefined) {
    return answerByRules(top, metadata());
  }

  // Las ramas sin selector ya han devuelto arriba; esta guarda hace explícita
  // la invariancia para TypeScript y para futuros cambios del flujo.
  if (selector === null) {
    return unsupportedAnswer(options, normalizedQuestion);
  }

  const { context, missingById } = buildAiContext(options, intent, result.recommendations);
  try {
    const decision = await selector.select(
      context,
      safetyIdentifier(options.safetyIdentifierSeed),
      options.lang ?? "es",
    );
    validateDecision(decision, result.recommendations, missingById, intent, context);

    if (decision.kind === "explain_context") {
      return craftingContextAnswer(
        context.envelope!.craftingState!,
        normalizedQuestion,
        result,
        metadata("ai", selector.name),
      );
    }

    const copy = generatedCopy(decision, context);

    if (decision.kind === "conversation") {
      // La charla de cortesía se escribe libre, pero no nombra gemas, jefes ni
      // cifras que no estén en el contexto: «vale, ¿y de gemas qué le pongo?»
      // llegó aquí y la IA se inventó tres gemas (tarea 14). Ante la duda, el
      // saludo fijo.
      try {
        checkWrittenMessage(
          copy ?? "",
          [meaningfulContextText(context), options.question, "Path of Exile 2, PoE2"].join("\n"),
          vocabularyFor(deps),
        );
      } catch (error) {
        if (error instanceof UnverifiedWriting) throw new MentorAiError(error.safeReason);
        throw error;
      }
      return conversationalAnswer(
        decision,
        context,
        normalizedQuestion,
        result,
        selector,
        missingById,
      );
    }

    if (decision.kind === "choose_recommendation") {
      const chosen = result.recommendations.find(
        (candidate) => candidate.id === decision.recommendationId,
      )!;
      return withGeneratedCopy(
        answerFromRecommendation(
          chosen,
          intent === "explain_priority" ? "explain_priority" : "next_improvement",
          normalizedQuestion,
          result,
          metadata("ai", selector.name),
          null,
          lang,
        ),
        copy,
      );
    }

    if (decision.kind === "ask_missing_fact") {
      const fact = missingById.get(decision.missingFactId!)!;
      const relatedRecommendations = result.recommendations.filter((candidate) =>
        fact.recommendationIds.includes(candidate.id),
      );

      const canonical = MentorAnswerSchema.parse({
        intent: intent === "explain_priority" ? "explain_priority" : "next_improvement",
        normalizedQuestion,
        answer: lang === "en"
          ? `Before deciding I need to settle this: ${fact.text}`
          : `Antes de decidir necesito resolver este dato: ${fact.text}`,
        nextAction: null,
        usedRecommendationIds: [...fact.recommendationIds],
        relatedItemIds: Array.from(
          new Set(relatedRecommendations.flatMap((candidate) => candidate.relatedItemIds)),
        ),
        sources: relatedRecommendations.flatMap((candidate) => candidate.sources),
        confidence: null,
        unverified: [fact.text],
        memoryImpact: result.memoryImpact,
        inputFingerprint: result.inputFingerprint,
        unsupported: null,
        generatedAt: result.generatedAt,
        engineVersion: result.engineVersion,
        ...metadata("ai", selector.name),
      });
      return withGeneratedCopy(canonical, copy);
    }

    if (decision.kind === "explain_current_case") {
      if (top === undefined) return noSafeAction(normalizedQuestion, result, selector, copy, lang);
      return withGeneratedCopy(
        answerFromRecommendation(
          top,
          "explain_priority",
          normalizedQuestion,
          result,
          metadata("ai", selector.name),
          null,
          lang,
        ),
        copy,
      );
    }

    return noSafeAction(normalizedQuestion, result, selector, copy, lang);
  } catch (error) {
    const reason =
      error instanceof MentorAiError
        ? error.safeReason
        : "La IA no pudo decidir con seguridad; se usaron las reglas.";
    if (craftingState !== null) {
      return craftingContextAnswer(
        craftingState,
        normalizedQuestion,
        result,
        metadata("rules_fallback", selector.name, reason),
      );
    }
    if (intent === "conversation") {
      return conversationFallback(options, normalizedQuestion, { model: selector.name, reason });
    }
    if (intent === "unsupported") {
      return unsupportedAnswer(options, normalizedQuestion, { model: selector.name, reason });
    }
    if (top === undefined) {
      return unsupportedAnswer(options, normalizedQuestion, { model: selector.name, reason });
    }
    return answerByRules(top, metadata("rules_fallback", selector.name, reason));
  }
}
