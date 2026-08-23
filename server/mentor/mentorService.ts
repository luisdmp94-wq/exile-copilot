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
  MentorAnswerSchema,
  MENTOR_SUGGESTIONS,
  type MentorAnswer,
  type MentorIntent,
  type MentorNextAction,
} from "../../shared/mentorQuery.js";
import { classifyMentorQuestion } from "../../shared/mentorIntent.js";
import {
  computeInputFingerprint,
  generateRecommendations,
  type EngineResult,
  type PriceLookup,
} from "../engine/engine.js";
import { ENGINE_VERSION } from "../engine/rules.js";
import {
  MentorAiError,
  type MentorAiContext,
  type MentorAiDecision,
  type MentorDecisionSelector,
} from "./mentorAi.js";

/**
 * Mentor conversacional.
 *
 * El motor y la memoria siguen siendo la autoridad. Cuando Hito 6E está
 * activo, la IA recibe un contexto compacto y solo puede escoger ids que el
 * motor ya produjo. El servidor valida esa elección y redacta la respuesta
 * canónica; ante cualquier fallo vuelve a las reglas.
 */

export interface MentorQueryOptions {
  question: string;
  /** Intención explícita de un control semántico de la interfaz. */
  intentHint?: Exclude<MentorIntent, "unsupported">;
  profile: CharacterProfile;
  target?: BuildTarget;
  budget: Budget;
  goal: Goal;
  league: string;
  patch: string;
  /** Memoria AUTORITATIVA leída por el servidor; el cliente nunca la construye. */
  memory: RecommendationMemory;
}

export interface MentorQueryDependencies {
  priceService?: PriceLookup | null;
  /** null/undefined conserva exactamente el comportamiento por reglas. */
  selector?: MentorDecisionSelector | null;
}

const RISK_LEVEL_ES: Record<Recommendation["risk"]["level"], string> = {
  low: "bajo",
  medium: "medio",
  high: "alto",
};

const UNSUPPORTED_REASON =
  "Todavía no sé responder esa pregunta con seguridad. Solo respondo a partir de tu " +
  "personaje, tu build objetivo, tu presupuesto y tu diario: no invento estadísticas, " +
  "precios ni conocimiento del juego.";

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
    text: recommendation.action,
    recommendationId: recommendation.id,
    relatedItemIds: [...recommendation.relatedItemIds],
    canSaveToJournal: recommendation.actionKind !== "session_gate",
    recommendation,
    recalledFromEntryId: null,
  };
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
      "No he entendido esa pregunta como una consulta que pueda responder con datos tuyos. " +
      "Prueba con una de las preguntas de ejemplo.",
    nextAction: null,
    usedRecommendationIds: [],
    relatedItemIds: [],
    sources: [],
    confidence: null,
    unverified: [],
    memoryImpact: memoryImpactWithoutEngine(options.memory),
    inputFingerprint: computeInputFingerprint(fingerprintInput(options)),
    unsupported: { reason: UNSUPPORTED_REASON, examples: [...MENTOR_SUGGESTIONS] },
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

function metadata(
  mode: AnswerMetadata["responseMode"] = "rules",
  model: string | null = null,
  fallbackReason: string | null = null,
): AnswerMetadata {
  return { responseMode: mode, model, fallbackReason };
}

function answerFromRecommendation(
  recommendation: Recommendation,
  intent: Exclude<MentorIntent, "unsupported">,
  normalizedQuestion: string,
  result: EngineResult,
  answerMetadata: AnswerMetadata,
): MentorAnswer {
  const answer =
    recommendation.actionKind === "session_gate"
      ? `${recommendation.title}. ${recommendation.reason} ${recommendation.action}`
      : intent === "explain_priority"
        ? `Tu principal problema ahora es «${recommendation.title}». ${recommendation.reason} ` +
          `${recommendation.impact.description} Riesgo ${RISK_LEVEL_ES[recommendation.risk.level]}: ${recommendation.risk.description}`
        : `Lo siguiente que haría: ${recommendation.title}. ${recommendation.reason}`;

  return MentorAnswerSchema.parse({
    intent,
    normalizedQuestion,
    answer,
    nextAction: nextActionFromRecommendation(recommendation),
    usedRecommendationIds: [recommendation.id],
    relatedItemIds: [...recommendation.relatedItemIds],
    sources: recommendation.sources,
    confidence: recommendation.confidence,
    unverified: [...recommendation.unverified],
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
          text: primaryEntry.nextAction,
          recommendationId: primaryEntry.recommendationId,
          relatedItemIds: [...primaryEntry.relatedItemIds],
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

function buildAiContext(
  options: MentorQueryOptions,
  heuristicIntent: MentorIntent,
  recommendations: Recommendation[],
): { context: MentorAiContext; missingById: Map<string, MissingFact> } {
  const missingByText = new Map<string, MissingFact>();
  for (const recommendation of recommendations) {
    for (const rawFact of recommendation.unverified) {
      const text = compact(rawFact, 400);
      if (!text) continue;
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
    budget: { ...options.budget },
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
  };
  return { context, missingById };
}

function safetyIdentifier(characterId: string): string {
  return `ec_${createHash("sha256").update(characterId).digest("hex").slice(0, 32)}`;
}

function validateDecision(
  decision: MentorAiDecision,
  recommendations: Recommendation[],
  missingById: Map<string, MissingFact>,
): void {
  if (decision.kind === "choose_recommendation") {
    if (
      decision.recommendationId === null ||
      !recommendations.some((candidate) => candidate.id === decision.recommendationId) ||
      decision.missingFactId !== null
    ) {
      throw new MentorAiError("La IA eligió una recomendación inexistente; se usaron las reglas.");
    }
    return;
  }
  if (decision.kind === "ask_missing_fact") {
    if (
      decision.missingFactId === null ||
      !missingById.has(decision.missingFactId) ||
      decision.recommendationId !== null
    ) {
      throw new MentorAiError("La IA pidió un dato inexistente; se usaron las reglas.");
    }
    return;
  }
  if (decision.recommendationId !== null || decision.missingFactId !== null) {
    throw new MentorAiError("La decisión de IA contenía ids inesperados; se usaron las reglas.");
  }
}

function noSafeAction(
  normalizedQuestion: string,
  result: EngineResult,
  selector: MentorDecisionSelector,
): MentorAnswer {
  return MentorAnswerSchema.parse({
    intent: "unsupported",
    normalizedQuestion,
    answer:
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
    unsupported: { reason: UNSUPPORTED_REASON, examples: [...MENTOR_SUGGESTIONS] },
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    ...metadata("ai", selector.name),
  });
}

export function answerMentorQuery(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies = {},
): Promise<MentorAnswer> {
  return buildAnswer(options, deps);
}

async function buildAnswer(
  options: MentorQueryOptions,
  deps: MentorQueryDependencies,
): Promise<MentorAnswer> {
  const classified = classifyMentorQuestion(options.question);
  const intent = options.intentHint ?? classified.intent;
  const { normalizedQuestion } = classified;
  const selector = deps.selector ?? null;

  // Sin IA se conserva la salida honesta original y no se ejecuta el motor.
  if (intent === "unsupported" && selector === null) {
    return unsupportedAnswer(options, normalizedQuestion);
  }

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

  // La acción activa es autoritativa: ni siquiera se consulta la IA.
  if (options.memory.primaryEntry !== null) {
    return recalledAnswer(options, normalizedQuestion, intent, result);
  }

  const top = result.recommendations[0];
  if (top === undefined) {
    return MentorAnswerSchema.parse({
      intent: intent === "unsupported" ? "next_improvement" : intent,
      normalizedQuestion,
      answer:
        "Con los datos que tengo ahora mismo no encuentro una mejora clara que recomendarte. " +
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

  if (selector === null) {
    return answerFromRecommendation(
      top,
      intent === "unsupported" ? "next_improvement" : intent,
      normalizedQuestion,
      result,
      metadata(),
    );
  }

  const { context, missingById } = buildAiContext(options, intent, result.recommendations);
  try {
    const decision = await selector.select(context, safetyIdentifier(options.profile.id));
    validateDecision(decision, result.recommendations, missingById);

    if (decision.kind === "choose_recommendation") {
      const chosen = result.recommendations.find(
        (candidate) => candidate.id === decision.recommendationId,
      )!;
      return answerFromRecommendation(
        chosen,
        intent === "explain_priority" ? "explain_priority" : "next_improvement",
        normalizedQuestion,
        result,
        metadata("ai", selector.name),
      );
    }

    if (decision.kind === "ask_missing_fact") {
      const fact = missingById.get(decision.missingFactId!)!;
      const relatedRecommendations = result.recommendations.filter((candidate) =>
        fact.recommendationIds.includes(candidate.id),
      );
      return MentorAnswerSchema.parse({
        intent: intent === "unsupported" ? "next_improvement" : intent,
        normalizedQuestion,
        answer: `Antes de decidir necesito resolver este dato: ${fact.text}`,
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
    }

    if (decision.kind === "explain_current_case") {
      return answerFromRecommendation(
        top,
        "explain_priority",
        normalizedQuestion,
        result,
        metadata("ai", selector.name),
      );
    }

    return noSafeAction(normalizedQuestion, result, selector);
  } catch (error) {
    const reason =
      error instanceof MentorAiError
        ? error.safeReason
        : "La IA no pudo decidir con seguridad; se usaron las reglas.";
    if (intent === "unsupported") {
      return unsupportedAnswer(options, normalizedQuestion, { model: selector.name, reason });
    }
    return answerFromRecommendation(
      top,
      intent,
      normalizedQuestion,
      result,
      metadata("rules_fallback", selector.name, reason),
    );
  }
}
