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
  type MentorConversationTurn,
  type MentorIntent,
  type MentorNextAction,
} from "../../shared/mentorQuery.js";
import {
  classifyMentorQuestion,
  isMentorIdentityQuestion,
} from "../../shared/mentorIntent.js";
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

/**
 * Mentor conversacional.
 *
 * El motor y la memoria siguen siendo la autoridad. Cuando Mentor v3 está
 * activo, la IA recibe un contexto compacto, redacta conversación natural y
 * debe fundamentarla con ids que el motor ya produjo. El servidor valida
 * estructura y texto; ante cualquier fallo vuelve a las reglas.
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
  contextEnvelope?: ContextEnvelope;
  /** Historial visible, compacto y NO autoritativo. */
  conversation?: MentorConversationTurn[];
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

function conversationFallback(
  options: MentorQueryOptions,
  normalizedQuestion: string,
  fallback?: { model: string; reason: string },
): MentorAnswer {
  const identity = isMentorIdentityQuestion(normalizedQuestion);
  const thanks = /\bgracias\b/.test(normalizedQuestion);
  const answer = identity
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

function metadata(
  mode: AnswerMetadata["responseMode"] = "rules",
  model: string | null = null,
  fallbackReason: string | null = null,
): AnswerMetadata {
  return { responseMode: mode, model, fallbackReason };
}

function answerFromRecommendation(
  recommendation: Recommendation,
  intent: "next_improvement" | "explain_priority",
  normalizedQuestion: string,
  result: EngineResult,
  answerMetadata: AnswerMetadata,
): MentorAnswer {
  const title = publicText(recommendation.title, [recommendation]);
  const reason = publicText(recommendation.reason, [recommendation]);
  const action = publicText(recommendation.action, [recommendation]);
  const impact = publicText(recommendation.impact.description, [recommendation]);
  const risk = publicText(recommendation.risk.description, [recommendation]);
  const answer =
    recommendation.actionKind === "session_gate"
      ? `${title}. ${reason} ${action}`
      : intent === "explain_priority"
        ? `Tu principal problema ahora es «${title}». ${reason} ` +
          `${impact} Riesgo ${RISK_LEVEL_ES[recommendation.risk.level]}: ${risk}`
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
                : "El expediente no demuestra una prioridad de crafting para esta pieza.";
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
  const answer =
    intent === "explain_priority"
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
      budgetAmount: options.budget.amount,
      budgetCurrency: options.budget.currency.slice(0, 50),
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
    envelope: sanitizeEnvelope(options.contextEnvelope, options, recommendations),
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
): MentorAnswer {
  return MentorAnswerSchema.parse({
    intent: "unsupported",
    normalizedQuestion,
    answer:
      copy ??
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

  // La identidad del producto es fija y no depende del personaje ni de un
  // proveedor de IA. Así evitamos que una presentación básica se rechace o
  // adquiera capacidades inventadas.
  if (intent === "conversation" && isMentorIdentityQuestion(normalizedQuestion)) {
    return conversationFallback(options, normalizedQuestion);
  }

  // La conversación social nunca se convierte en una recomendación por
  // ausencia de IA. Con IA sí recibe el contexto canónico para responder.
  if (intent === "conversation" && selector === null) {
    return conversationFallback(options, normalizedQuestion);
  }

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
  if (
    options.memory.primaryEntry !== null &&
    intent !== "conversation"
  ) {
    return recalledAnswer(options, normalizedQuestion, intent, result);
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

  if (selector === null && top !== undefined) {
    return answerFromRecommendation(
      top,
      intent === "explain_priority" ? "explain_priority" : "next_improvement",
      normalizedQuestion,
      result,
      metadata(),
    );
  }

  // Las ramas sin selector ya han devuelto arriba; esta guarda hace explícita
  // la invariancia para TypeScript y para futuros cambios del flujo.
  if (selector === null) {
    return unsupportedAnswer(options, normalizedQuestion);
  }

  const { context, missingById } = buildAiContext(options, intent, result.recommendations);
  try {
    const decision = await selector.select(context, safetyIdentifier(options.profile.id));
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
      return withGeneratedCopy(canonical, copy);
    }

    if (decision.kind === "explain_current_case") {
      if (top === undefined) return noSafeAction(normalizedQuestion, result, selector, copy);
      return withGeneratedCopy(
        answerFromRecommendation(
          top,
          "explain_priority",
          normalizedQuestion,
          result,
          metadata("ai", selector.name),
        ),
        copy,
      );
    }

    return noSafeAction(normalizedQuestion, result, selector, copy);
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
    return answerFromRecommendation(
      top,
      intent,
      normalizedQuestion,
      result,
      metadata("rules_fallback", selector.name, reason),
    );
  }
}
