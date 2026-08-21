import type {
  Budget,
  BuildTarget,
  CharacterProfile,
  Goal,
  Recommendation,
  RecommendationMemory,
  RecommendationMemoryImpact,
} from "../../shared/domain.js";
import {
  MentorAnswerSchema,
  MENTOR_SUGGESTIONS,
  type MentorAnswer,
  type MentorNextAction,
} from "../../shared/mentorQuery.js";
import { classifyMentorQuestion } from "../../shared/mentorIntent.js";
import {
  computeInputFingerprint,
  generateRecommendations,
  type PriceLookup,
} from "../engine/engine.js";
import { ENGINE_VERSION } from "../engine/rules.js";

/**
 * Mentor conversacional (Hito 6A) — vertical slice basado en reglas, sin IA
 * generativa.
 *
 * NO es un segundo sistema de consejos: clasifica la intención y delega en el
 * motor existente (`generateRecommendations`), que ya aplica las reglas del
 * Character Journal:
 *  - con una acción principal activa devuelve cero recomendaciones y no
 *    consulta precios: el mentor RECUERDA ese paso en lugar de crear otro;
 *  - con memoria completada pendiente antepone la reconciliación
 *    (`profile_sync`);
 *  - el resultado libre del diario es evidencia, nunca se interpreta.
 *
 * Todo lo que se responde procede del perfil, la build objetivo, el
 * presupuesto/objetivo, el diario y el motor. No se inventan estadísticas,
 * DPS, precios, mods ni conocimiento del juego.
 */

export interface MentorQueryOptions {
  question: string;
  profile: CharacterProfile;
  target?: BuildTarget;
  budget: Budget;
  goal: Goal;
  league: string;
  patch: string;
  /** Memoria AUTORITATIVA leída por el servidor; el cliente nunca la construye. */
  memory: RecommendationMemory;
}

/**
 * Niveles del dominio en español: la respuesta la lee una persona, así que
 * nunca se le muestra el identificador interno (`low`/`medium`/`high`).
 */
const RISK_LEVEL_ES: Record<Recommendation["risk"]["level"], string> = {
  low: "bajo",
  medium: "medio",
  high: "alto",
};

const UNSUPPORTED_REASON =
  "Todavía no sé responder esa pregunta con seguridad. Solo respondo a partir de tu " +
  "personaje, tu build objetivo, tu presupuesto y tu diario: no invento estadísticas, " +
  "precios ni conocimiento del juego.";

/** Impacto de memoria cuando no llegamos a ejecutar el motor. */
function memoryImpactWithoutEngine(memory: RecommendationMemory): RecommendationMemoryImpact {
  return {
    revision: memory.revision,
    blockedByPrimaryEntryId: memory.primaryEntry?.entryId ?? null,
    usedEntryIds: [],
    repeatedRecommendationIds: [],
  };
}

/** Próxima acción derivada de una recomendación del motor (nueva, guardable). */
function nextActionFromRecommendation(recommendation: Recommendation): MentorNextAction {
  return {
    text: recommendation.action,
    recommendationId: recommendation.id,
    relatedItemIds: [...recommendation.relatedItemIds],
    canSaveToJournal: recommendation.actionKind !== "session_gate",
    recommendation,
    recalledFromEntryId: null,
  };
}

export function answerMentorQuery(
  options: MentorQueryOptions,
  deps: { priceService?: PriceLookup | null } = {},
): Promise<MentorAnswer> {
  return buildAnswer(options, deps);
}

async function buildAnswer(
  options: MentorQueryOptions,
  deps: { priceService?: PriceLookup | null },
): Promise<MentorAnswer> {
  const generatedAt = new Date().toISOString();
  const { intent, normalizedQuestion } = classifyMentorQuestion(options.question);

  const fingerprintInput = {
    profile: options.profile,
    budget: options.budget,
    goal: options.goal,
    league: options.league,
    patch: options.patch,
    memory: options.memory,
    ...(options.target !== undefined ? { target: options.target } : {}),
  };

  // --- Intención no soportada -------------------------------------------
  // No se ejecuta el motor ni se consultan precios: se contesta honestamente.
  if (intent === "unsupported") {
    return MentorAnswerSchema.parse({
      intent,
      normalizedQuestion,
      answer:
        "No he entendido esa pregunta como una consulta que pueda responder con datos tuyos. " +
        "Prueba con una de las preguntas de ejemplo.",
      nextAction: null,
      usedRecommendationIds: [],
      relatedItemIds: [],
      sources: [],
      confidence: null,
      unverified: [],
      memoryImpact: memoryImpactWithoutEngine(options.memory),
      inputFingerprint: computeInputFingerprint(fingerprintInput),
      unsupported: { reason: UNSUPPORTED_REASON, examples: [...MENTOR_SUGGESTIONS] },
      generatedAt,
      engineVersion: ENGINE_VERSION,
    });
  }

  // --- Se delega en el motor existente ----------------------------------
  const result = await generateRecommendations(
    options.profile,
    {
      budget: options.budget,
      goal: options.goal,
      league: options.league,
      patch: options.patch,
      memory: options.memory,
      ...(options.target !== undefined ? { target: options.target } : {}),
    },
    { ...(deps.priceService !== undefined ? { priceService: deps.priceService } : {}) },
  );

  const base = {
    intent,
    normalizedQuestion,
    memoryImpact: result.memoryImpact,
    inputFingerprint: result.inputFingerprint,
    unsupported: null,
    generatedAt,
    engineVersion: result.engineVersion,
  };

  // (a) El diario bloquea con una acción principal activa: se RECUERDA.
  const primaryEntry = options.memory.primaryEntry;
  if (primaryEntry !== null) {
    const recalled: MentorNextAction | null =
      primaryEntry.nextAction !== null
        ? {
            text: primaryEntry.nextAction,
            recommendationId: primaryEntry.recommendationId,
            relatedItemIds: [...primaryEntry.relatedItemIds],
            // Ya está en el diario: no se vuelve a guardar.
            canSaveToJournal: false,
            recommendation: null,
            recalledFromEntryId: primaryEntry.entryId,
          }
        : null;

    const answer =
      intent === "explain_priority"
        ? `Tu prioridad sigue siendo «${primaryEntry.title}», que anotaste en el diario y aún está ` +
          "en curso. No propongo otra decisión hasta que registres su resultado: una sola acción a la vez."
        : `Ya tienes una acción en marcha: «${primaryEntry.title}». Termínala y anota el resultado en ` +
          "el diario; entonces calcularé el siguiente paso.";

    return MentorAnswerSchema.parse({
      ...base,
      answer,
      nextAction: recalled,
      usedRecommendationIds: [],
      relatedItemIds: recalled?.relatedItemIds ?? [],
      sources: [],
      confidence: null,
      unverified: [],
    });
  }

  // (b) Sin decisiones que ofrecer con los datos actuales.
  const top = result.recommendations[0];
  if (top === undefined) {
    return MentorAnswerSchema.parse({
      ...base,
      answer:
        "Con los datos que tengo ahora mismo no encuentro una mejora clara que recomendarte. " +
        "Completa los datos desconocidos de tu personaje o ajusta tu build objetivo y vuelve a preguntar.",
      nextAction: null,
      usedRecommendationIds: [],
      relatedItemIds: [],
      sources: [],
      confidence: null,
      unverified: [],
    });
  }

  // (c) Decisión del motor: la misma para ambas intenciones, contada distinto.
  //     `explain_priority` explica POR QUÉ es la primera; `next_improvement`
  //     va directo al paso. En ambos casos hay UNA sola próxima acción.
  const answer =
    top.actionKind === "session_gate"
      ? `${top.title}. ${top.reason} ${top.action}`
      : intent === "explain_priority"
        ? `Tu principal problema ahora es «${top.title}». ${top.reason} ` +
          `${top.impact.description} Riesgo ${RISK_LEVEL_ES[top.risk.level]}: ${top.risk.description}`
        : `Lo siguiente que haría: ${top.title}. ${top.reason}`;

  return MentorAnswerSchema.parse({
    ...base,
    answer,
    nextAction: nextActionFromRecommendation(top),
    usedRecommendationIds: [top.id],
    relatedItemIds: [...top.relatedItemIds],
    sources: top.sources,
    confidence: top.confidence,
    unverified: [...top.unverified],
  });
}
