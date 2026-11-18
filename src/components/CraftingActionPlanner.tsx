import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CraftingActionIdSchema,
  evaluateObservedCraftingActions,
  type CraftingCurrencyVariant,
  type StartCraftingDecision,
} from "@shared/craftingActions.js";
import type { StartAlloyDecision } from "@shared/craftingAlloys.js";
import { buildExpertCraftingBlueprint } from "@shared/craftingBlueprint.js";
import {
  craftingBuildIntentLabel,
  deriveCraftingBuildIntent,
  type CraftingBuildIntent,
} from "@shared/craftingBuildIntent.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import {
  buildCraftingRoute,
  type CraftingRouteAction,
} from "@shared/craftingRoute.js";
import {
  ESSENCE_MECHANIC_SOURCE,
  ESSENCE_TIER_LABELS,
  ESSENCE_TIER_LABELS_EN,
  evaluateEssencePlan,
  type EssencePlanInput,
  type EssenceTier,
  type StartEssenceDecision,
} from "@shared/craftingEssences.js";
import type { Budget, BuildTarget, CharacterProfile, GoalKind, Item } from "@shared/domain.js";
import { AlloyPlanner } from "@/components/AlloyPlanner";
import { CraftingBaseWorkbench } from "@/components/CraftingBaseWorkbench";
import { CraftingRepairBanner } from "@/components/CraftingRepairBanner";
import { CraftingExpertBlueprint } from "@/components/CraftingExpertBlueprint";
import { CraftingTargetEvidencePanel } from "@/components/CraftingTargetEvidencePanel";
import { CraftingGoalPicker } from "@/components/CraftingGoalPicker";
import { CraftingProtectionPicker } from "@/components/CraftingProtectionPicker";
import { CraftingSuccessCriteriaPicker } from "@/components/CraftingSuccessCriteriaPicker";
import {
  CRAFTING_GOAL_LABELS,
  craftingGoalLabel,
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";
import { evaluateCraftingProtection } from "@shared/craftingProtection.js";
import { assessCraftingAffixes } from "@shared/craftingAffixAssessment.js";
import {
  craftingSuccessCriterionLabel,
  evaluateCraftingSuccessCriteria,
  recommendCraftingSuccessCriterion,
  type CraftingSuccessCriterion,
} from "@shared/craftingSuccessCriteria.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCraftingKnowledge } from "@/hooks/useCraftingKnowledge";
import { buildCraftingMentorReading } from "@/lib/craftingMentorReading";
import { isCraftingExampleItem } from "@/lib/craftingSimulation";
import {
  CRAFTING_PROJECT_UPDATED_EVENT,
  craftingProjectStorageKey,
  emptyCraftingProject,
  readCraftingProject,
  saveCraftingProjectContract,
} from "@/lib/craftingProject";
import { craftingLaboratoryRouteLabel } from "@shared/craftingProjectRoute.js";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";
import type { MentorCraftingState } from "@shared/mentorContext.js";
import { buildCraftingTargetEvidence } from "@shared/craftingTargetEvidence.js";
import {
  craftingActionEffect,
  craftingActionEvidence,
  craftingActionLabel,
  craftingCurrencyLabelFor,
  craftingVariantLabel,
} from "@shared/craftingWorkshopText.js";
import { texts, useLang, useText, type Lang } from "@/i18n/lang";

const CRAFTING_STATE_STYLE = {
  complete: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  blocked: "border-rose-500/40 bg-rose-500/10 text-rose-300",
} as const;

const BUILD_ALIGNMENT_STYLE: Record<CraftingBuildIntent["alignment"], string> = {
  aligned: "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-100",
  "choice-required": "border-cyan-500/35 bg-cyan-500/[0.07] text-cyan-100",
  conflict: "border-amber-500/40 bg-amber-500/[0.08] text-amber-50",
  unknown: "border-border/80 bg-background/35 text-foreground",
};

function buildIntentCopy(
  intent: CraftingBuildIntent,
  currentGoal: CraftingGoalCategory,
  lang: Lang,
): { title: string; detail: string } {
  const t = TEXT[lang];
  const label = craftingBuildIntentLabel(intent, lang);
  if (intent.alignment === "aligned") {
    return {
      title: t.alignedTitle(label),
      detail:
        intent.source === "target"
          ? t.alignedTarget
          : intent.source === "resistances"
            ? t.alignedResistances
            : t.alignedProfile,
    };
  }
  if (intent.alignment === "choice-required") {
    return {
      title: t.choiceTitle(label),
      detail: t.choiceDetail,
    };
  }
  if (intent.alignment === "conflict") {
    return {
      title: t.conflictTitle(label),
      detail: t.conflictDetail(craftingGoalLabel(currentGoal, lang)),
    };
  }
  return {
    title: t.unknownTitle,
    detail: t.unknownDetail,
  };
}

const ACTION_STATUS = {
  compatible: {
    style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  blocked: {
    style: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  "needs-data": {
    style: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
} as const;

const AFFIX_ASSESSMENT_STYLE = {
  "protect-first": "border-emerald-500/40 bg-emerald-500/[0.09] text-emerald-200",
  "goal-aligned": "border-sky-500/40 bg-sky-500/[0.08] text-sky-200",
  "review-fit": "border-amber-500/40 bg-amber-500/[0.08] text-amber-200",
  contextual: "border-border bg-muted/20 text-muted-foreground",
} as const;

type CraftingTool = "currency" | "essence" | "alloy";
type LaboratoryStepId = "objective" | "base" | "protect" | "stop" | "route";

interface LaboratoryNavigation {
  itemId: string;
  active: LaboratoryStepId;
  completed: LaboratoryStepId[];
}

interface LaboratoryStep {
  id: LaboratoryStepId;
  label: string;
  value: string;
  state: "done" | "current" | "pending" | "blocked";
  reason?: string;
}

function useProtectedModifiers(item: Item, initialIds: string[] = []) {
  const [selection, setSelection] = useState<{ itemId: string; ids: string[] }>({
    itemId: item.id,
    ids: initialIds,
  });
  const currentIds = useMemo(
    () =>
      new Set(
        item.modifiers
          .filter((modifier) => modifier.kind === "explicit")
          .map((modifier) => modifier.id),
      ),
    [item.modifiers],
  );
  // Esta lista alimenta efectos que persisten el contrato del Taller. Si se
  // recrea en cada render, una actualización del historial puede volver a
  // guardar el mismo contrato y encadenar renders indefinidamente.
  const value = useMemo(
    () =>
      selection.itemId === item.id
        ? selection.ids.filter((id) => currentIds.has(id))
        : [],
    [currentIds, item.id, selection],
  );
  const update = useCallback(
    (ids: string[]) => setSelection({ itemId: item.id, ids }),
    [item.id],
  );

  return [value, update] as const;
}

const CRAFTING_TOOLS: CraftingTool[] = ["currency", "essence", "alloy"];

const TEXT = texts(
  {
    alignedTitle: (label: string) => `Alineado con ${label}`,
    alignedTarget: "Tu build objetivo declara esta prioridad; aún falta confirmar que esta base pueda cubrirla.",
    alignedResistances: "El personaje demuestra la carencia, pero no que esta pieza sea la mejor ranura para resolverla.",
    alignedProfile: "Coincide con el objetivo general que elegiste para el personaje.",
    choiceTitle: (label: string) => `El personaje apunta a ${label}`,
    choiceDetail: "Elige qué necesidad quieres trabajar primero; el Mentor no ordenará prioridades por ti.",
    conflictTitle: (label: string) => `Revisa el objetivo: el contexto apunta a ${label}`,
    conflictDetail: (goal: string) =>
      `Ahora has elegido ${goal}. Puedes mantenerlo, pero el personaje no demuestra esa prioridad.`,
    unknownTitle: "Sin prioridad demostrada por el personaje",
    unknownDetail: "Puedes diseñar el craft, pero la app no afirmará que resuelve una necesidad de tu personaje.",
    actionStatus: {
      compatible: "Compatible con la estructura",
      blocked: "Bloqueada",
      "needs-data": "Faltan datos",
    } as Record<keyof typeof ACTION_STATUS, string>,
    tools: {
      currency: {
        label: "Monedas",
        eyebrow: "Paso básico",
        description: "Transmutación, Aumento, Regio y Exaltado.",
      },
      essence: {
        label: "Essences",
        eyebrow: "Mod garantizado",
        description: "Añade un efecto conocido y comprueba el reemplazo.",
      },
      alloy: {
        label: "Alloys",
        eyebrow: "Fabricación",
        description: "Reemplaza un mod por uno fabricado del tooltip.",
      },
    } as Record<CraftingTool, { label: string; eyebrow: string; description: string }>,
    baseDecision: "Decisión sobre la base",
    dontSpendYet: "No gastes todavía",
    declaredNoEvidence: "Objetivo declarado, todavía sin evidencia observable",
    tellMeFirst: "Primero dime qué quieres conseguir",
    declaredDetail: (outcome: string) =>
      `Has definido «${outcome}», pero los datos disponibles no permiten comprobar qué afijos de esta base lo cumplen. No gastes hasta aportar una señal observable o una fuente de modificadores compatible.`,
    noGoalDetail: "Sin un objetivo observable no puedo separar una mejora de un mod que solo ocupa espacio.",
    stopCondition: "Condición de parada",
    goalMet: "Tu objetivo ya está cumplido",
    goalMetDetail: "La pieza actual ya cumple todas las condiciones observables que acabas de fijar. No gastes otra moneda para perseguir el mismo final.",
    dontReplace: "No reemplaces nada todavía",
    worthTest: "Sí: merece una prueba controlada",
    alsoProfile: " Además, este objetivo coincide con el plan general del personaje.",
    unprovenBase: "Base aún sin demostrar",
    doubtfulBase: "Base dudosa para este objetivo",
    normalDetail: "La estructura permite empezar, pero el objeto todavía no muestra afijos que justifiquen una inversión larga.",
    normalNoMods: "Objeto normal · sin modificadores explícitos",
    unclassified: (count: number) => `${count} modificador${count === 1 ? "" : "es"} sin clasificar`,
    structure: (prefixes: number, suffixes: number, open: number) =>
      `${prefixes} prefijo${prefixes === 1 ? "" : "s"} · ${suffixes} sufijo${suffixes === 1 ? "" : "s"} · ${open} hueco${open === 1 ? "" : "s"} total${open === 1 ? "" : "es"}`,
    missingData: "Faltan datos para leer esta pieza",
    promptObjective: "Define una sola mejora para esta pieza.",
    promptBase: "Comprueba si esta es la base correcta antes de gastar.",
    promptProtect: "Marca lo que no estás dispuesto a perder.",
    promptStop: "Decide qué resultado hará que dejes de gastar.",
    promptRouteDone: "La condición ya se cumple: conserva la pieza.",
    promptRouteReady: "Contrato listo: elige una ruta verificable.",
    stepObjective: "Objetivo",
    chooseOne: "Elige uno",
    stepBase: "Base",
    imported: (count: number) => `${count} importadas`,
    finishReading: "Completa la lectura de la pieza",
    stepProtect: "Protege",
    nothingMarked: "Nada marcado",
    markedCount: (count: number) => `${count} marcada${count === 1 ? "" : "s"}`,
    stepStop: "Parada",
    met: "Cumplida",
    definedCount: (count: number) => `${count} definida${count === 1 ? "" : "s"}`,
    pickOne: "Elige una",
    stepRoute: "Ruta",
    finishContract: "Completa el contrato",
    craftProject: "Proyecto de craft",
    currencyAvailable: (available: number, total: number) =>
      `Monedas · ${available} de ${total} disponibles`,
    autosave: "Autoguardado local",
    trackerAria: "Estado del plan avanzado",
    itemState: "Estado de la pieza",
    yourPlan: "Tu plan para esta pieza",
    yourContract: "Tu contrato",
    goalChip: (goal: string, count: number) => `${goal} · ${count} intocable${count === 1 ? "" : "s"}`,
    describeGoal: "Describe el objetivo",
    addNuance: "Añade un matiz (opcional)",
    goalPlaceholder: "Ej.: más daño sin perder velocidad ni +niveles",
    describeResult: "Describe qué resultado buscas.",
    emptyUses: (goal: string) => `Si lo dejas vacío, el plan usará «${goal}».`,
    protectReplace: "Antes de reemplazar: protege lo importante",
    protectOptional: "¿Hay algo que no quieres perder? (opcional)",
    characterSuggestion: "Sugerencia del personaje",
    useGoal: (goal: string) => `Usar ${goal}`,
    saveGoal: "Guardar objetivo y continuar",
    confirmBase: "Confirmar esta base",
    baseNeedsReading: "La base necesita una lectura completa. Puedes definir el objetivo y la parada sin gastar nada.",
    continueUnmarked: "Continuar sin marcar",
    saveProtections: "Guardar protecciones",
    saveStop: "Guardar parada y continuar",
    stopSaved: "Parada guardada. Completa la lectura para abrir la ruta.",
    whyPath: "Ver por qué el mentor propone este camino",
    alignedCount: (aligned: number, total: number) => `${aligned}/${total} alineados`,
    worthGoingOn: "¿Compensa seguir?",
    inFavour: "A favor",
    pickCategory: "Elige una categoría",
    noDirectTag: "Ningún tag directo",
    noDirectSignal: "Sin señal directa",
    pendingGoal: "Pendiente del objetivo",
    nothingFlagged: "Nada señalado",
    keepCandidates: "Candidatos a conservar",
    noTopTiers: "No hay grados 1–2 observados",
    affixCore: "Núcleo de afijos",
    mustKeepCount: (count: number) => `${count} intocable${count === 1 ? "" : "s"}`,
    highlightsAria: "Señales destacadas de los afijos",
    leadingAligned: (count: number) => `${count} alineado${count === 1 ? "" : "s"} de grado 1–2`,
    seeReading: (count: number) => `Ver lectura de ${count} afijos`,
    tierShort: (tier: number | undefined) => (tier ? `G${tier}` : "G?"),
    mustKeepForPlan: "Intocable para este plan",
    readingNote: "Lectura del texto observado: no estima DPS, precio, peso ni probabilidad.",
    demoOnly: "Solo demostración",
    defineGoal: "Define tu objetivo",
    chooseStop: "Elige cuándo parar",
    goalAlreadyMet: "Objetivo ya cumplido",
    prepareAction: (label: string, single: boolean) => `${single ? "Preparar " : "Elegir "}${label}`,
    reviewRisky: "Revisar opciones con riesgo",
    reviewEssence: "Revisar una Essence",
    reviewAlloy: "Revisar un Alloy",
    repaste: "Pegar el objeto de nuevo",
    demoProject: "Proyecto de demostración: sin gasto real",
    demoDetail: "Puedes estudiar la base, la parada y las rutas, pero esta pieza no existe en tu cuenta. El Taller no preparará monedas ni pedirá un resultado.",
    pasteMyOwn: "Pegar mi propia pieza",
    checkingKnowledge: "Verificando conocimiento…",
    knowledgeUnavailable: "Conocimiento no disponible",
    verifiedRules: (count: number) => `${count} reglas verificadas`,
    noChances: "Sin probabilidades verificables",
    noKnowledge: "Sin conocimiento cargado",
    evidenceLimits: (count: number) => `Ver evidencia y límites (${count})`,
    explicitSeen: "Explícitos registrados",
    prefixes: "Prefijos",
    suffixes: "Sufijos",
    undetermined: "Sin determinar",
    openSlots: "Huecos totales",
    unknown: "Desconocido",
    pending: "Pendiente",
    knowledgeUsed: (count: number, asOf: string) =>
      `Conocimiento utilizado: ${count} acciones · corte de datos ${asOf}.`,
    noFullData: "Sin datos completos para calcular probabilidades.",
    whatTool: "¿Con qué vas a intentarlo?",
    toolsAria: "Herramientas de crafting",
    advancedGate: "Essences y Alloys en revisión para este parche. Las monedas básicas siguen disponibles.",
    availableCurrency: "Monedas disponibles",
    onlyCompatible: "La app solo habilita acciones compatibles con los datos que has pegado.",
    noActions: "El registro no contiene acciones compatibles con este módulo.",
    hideUnavailable: "Ocultar acciones no aplicables",
    showUnavailable: (count: number) => `Ver acciones no aplicables (${count})`,
    evaluation: "Evaluación: ",
    variantMinimum: (label: string, minimum: number | null) =>
      `${label}: ${minimum === null ? "mínimo no mostrado" : `nivel mínimo de modificador ${minimum}`}`,
    exactVariant: "Variante exacta que vas a usar",
    noMinimum: "El tooltip observado no muestra un mínimo.",
    minimumSeen: (minimum: number) => `Nivel mínimo de modificador observado: ${minimum}.`,
    minimumNote: "Este mínimo reproduce el tooltip observado; no garantiza un afijo concreto ni su probabilidad.",
    preflightConfirm: "El objeto sigue igual, aún no gasté la moneda y acepto que el resultado es aleatorio.",
    preparing: "Preparando…",
    prepareCraft: "Preparar este craft",
    cancel: "Cancelar",
    chooseAction: "Elegir esta acción",
    essenceEyebrow: "Mecánica guiada P1",
    essenceIntro:
      "Introduce la Essence real que tienes delante. El asesor valida el tipo de operación y prepara una comparación antes/después; no adivina el efecto por su nombre.",
    essenceType: "Tipo de Essence",
    exactName: "Nombre exacto",
    namePlaceholder: "Ej.: Essence of…",
    guaranteedEffect: "Efecto garantizado exacto del tooltip",
    effectPlaceholder: "Copia únicamente lo que la Essence declara que añadirá a este tipo de objeto",
    plan: "Plan:",
    planMustKeep: (count: number) => ` · ${count} intocable${count === 1 ? "" : "s"}`,
    noneMustKeep: " · nada marcado como intocable",
    stopConditions: (count: number) => ` · ${count} condición${count === 1 ? "" : "es"} de parada`,
    editIntention: "Editar intención",
    protection: "Protección del snapshot",
    magicToRare: "Mágico → raro, conservando lo existente",
    rareToRare: "Raro → raro, reemplazando 1 modificador al azar",
    anyAtRisk: "No elijas qué modificador desaparece: cualquiera de los explícitos actuales está en riesgo.",
    confirmSnapshot: "Confirmo que el objeto sigue igual que el snapshot importado.",
    confirmEssenceTooltip: "He copiado el nombre y el efecto desde la Essence que voy a usar, no desde una guía antigua.",
    confirmRandomRemoval: "Acepto que se retirará al azar un modificador explícito actual.",
    confirmEssenceNotSpent: "Confirmo que todavía no he aplicado la Essence.",
    createEssence: "Crear comprobación de Essence",
    openCraftingTab: "Abre la pestaña Crafting para iniciar una comprobación persistente.",
    essenceSourceBefore: (patch: string) => `Regla estructural verificada desde el parche ${patch}: `,
    essenceSourceLink: "notas oficiales de GGG",
    essenceSourceAfter: ". La tabla exhaustiva de efectos por Essence y tipo de objeto no está incorporada.",
  },
  {
    alignedTitle: (label: string) => `In line with ${label}`,
    alignedTarget: "Your target build lists this priority; it still needs confirming that this base can cover it.",
    alignedResistances: "Your character shows the gap, but not that this item is the best slot to fix it.",
    alignedProfile: "It matches the overall goal you chose for the character.",
    choiceTitle: (label: string) => `Your character points to ${label}`,
    choiceDetail: "Choose which need to work on first; the Mentor won't rank priorities for you.",
    conflictTitle: (label: string) => `Check the goal: the context points to ${label}`,
    conflictDetail: (goal: string) =>
      `You've chosen ${goal}. You can keep it, but your character doesn't show that priority.`,
    unknownTitle: "No priority shown by your character file",
    unknownDetail: "You can plan the craft, but the app won't claim it fixes a need of your character.",
    actionStatus: {
      compatible: "Fits the item",
      blocked: "Blocked",
      "needs-data": "Data missing",
    },
    tools: {
      currency: {
        label: "Currency",
        eyebrow: "Basic step",
        description: "Transmutation, Augmentation, Regal and Exalted.",
      },
      essence: {
        label: "Essences",
        eyebrow: "Guaranteed modifier",
        description: "Adds a known effect and checks the replacement.",
      },
      alloy: {
        label: "Alloys",
        eyebrow: "Crafting",
        description: "Replaces a modifier with a crafted one from the tooltip.",
      },
    },
    baseDecision: "Decision on the base",
    dontSpendYet: "Don't spend yet",
    declaredNoEvidence: "Goal set, but no visible evidence yet",
    tellMeFirst: "First tell me what you want to get",
    declaredDetail: (outcome: string) =>
      `You set “${outcome}”, but the data available can't check which modifiers on this base meet it. Don't spend until you add a visible signal or a compatible modifier source.`,
    noGoalDetail: "Without a visible goal I can't tell an upgrade from a modifier that just takes up space.",
    stopCondition: "Stop condition",
    goalMet: "Your goal is already met",
    goalMetDetail: "This item already meets every condition you just set. Don't spend another currency chasing the same finish.",
    dontReplace: "Don't replace anything yet",
    worthTest: "Yes: worth a controlled test",
    alsoProfile: " This goal also matches the character's overall plan.",
    unprovenBase: "Base not proven yet",
    doubtfulBase: "Doubtful base for this goal",
    normalDetail: "The structure lets you start, but the item doesn't show modifiers yet that justify a long investment.",
    normalNoMods: "Normal item · no explicit modifiers",
    unclassified: (count: number) => `${count} unclassified modifier${count === 1 ? "" : "s"}`,
    structure: (prefixes: number, suffixes: number, open: number) =>
      `${prefixes} prefix${prefixes === 1 ? "" : "es"} · ${suffixes} suffix${suffixes === 1 ? "" : "es"} · ${open} open slot${open === 1 ? "" : "s"} in total`,
    missingData: "Not enough data to read this item",
    promptObjective: "Set one single upgrade for this item.",
    promptBase: "Check whether this is the right base before spending.",
    promptProtect: "Mark what you're not willing to lose.",
    promptStop: "Decide which result will make you stop spending.",
    promptRouteDone: "The condition is already met: keep the item.",
    promptRouteReady: "Plan ready: pick a route you can check.",
    stepObjective: "Goal",
    chooseOne: "Pick one",
    stepBase: "Base",
    imported: (count: number) => `${count} imported`,
    finishReading: "Finish reading the item",
    stepProtect: "Protect",
    nothingMarked: "Nothing marked",
    markedCount: (count: number) => `${count} marked`,
    stepStop: "Stop",
    met: "Met",
    definedCount: (count: number) => `${count} set`,
    pickOne: "Pick one",
    stepRoute: "Route",
    finishContract: "Finish the plan",
    craftProject: "Craft project",
    currencyAvailable: (available: number, total: number) =>
      `Currency · ${available} of ${total} available`,
    autosave: "Saved on this device",
    trackerAria: "Advanced plan status",
    itemState: "Item status",
    yourPlan: "Your plan for this item",
    yourContract: "Your terms",
    goalChip: (goal: string, count: number) => `${goal} · ${count} must-keep`,
    describeGoal: "Describe the goal",
    addNuance: "Add a detail (optional)",
    goalPlaceholder: "E.g. more damage without losing speed or +levels",
    describeResult: "Describe the result you want.",
    emptyUses: (goal: string) => `If you leave it empty, the plan will use “${goal}”.`,
    protectReplace: "Before replacing: protect what matters",
    protectOptional: "Anything you don't want to lose? (optional)",
    characterSuggestion: "Suggestion from your character",
    useGoal: (goal: string) => `Use ${goal}`,
    saveGoal: "Save goal and continue",
    confirmBase: "Confirm this base",
    baseNeedsReading: "The base needs a full reading. You can set the goal and the stop without spending anything.",
    continueUnmarked: "Continue without marking",
    saveProtections: "Save protections",
    saveStop: "Save stop and continue",
    stopSaved: "Stop saved. Finish the reading to open the route.",
    whyPath: "See why the mentor suggests this path",
    alignedCount: (aligned: number, total: number) => `${aligned}/${total} aligned`,
    worthGoingOn: "Worth going on?",
    inFavour: "In favour",
    pickCategory: "Pick a category",
    noDirectTag: "No direct tag",
    noDirectSignal: "No direct signal",
    pendingGoal: "Waiting for the goal",
    nothingFlagged: "Nothing flagged",
    keepCandidates: "Worth keeping",
    noTopTiers: "No tier 1–2 seen",
    affixCore: "Affix core",
    mustKeepCount: (count: number) => `${count} must-keep`,
    highlightsAria: "Key modifier signals",
    leadingAligned: (count: number) => `${count} aligned at tier 1–2`,
    seeReading: (count: number) => `See the reading of ${count} modifiers`,
    tierShort: (tier: number | undefined) => (tier ? `T${tier}` : "T?"),
    mustKeepForPlan: "Must-keep for this plan",
    readingNote: "Reading of the visible text: it doesn't estimate DPS, price, weight or chance.",
    demoOnly: "Demo only",
    defineGoal: "Set your goal",
    chooseStop: "Choose when to stop",
    goalAlreadyMet: "Goal already met",
    prepareAction: (label: string, single: boolean) => `${single ? "Prepare " : "Choose "}${label}`,
    reviewRisky: "Review risky options",
    reviewEssence: "Check an Essence",
    reviewAlloy: "Check an Alloy",
    repaste: "Paste the item again",
    demoProject: "Demo project: no real spending",
    demoDetail: "You can study the base, the stop and the routes, but this item isn't in your account. The workshop won't prepare currency or ask for a result.",
    pasteMyOwn: "Paste my own item",
    checkingKnowledge: "Checking knowledge…",
    knowledgeUnavailable: "Knowledge not available",
    verifiedRules: (count: number) => `${count} verified rules`,
    noChances: "No verifiable chances",
    noKnowledge: "No knowledge loaded",
    evidenceLimits: (count: number) => `See evidence and limits (${count})`,
    explicitSeen: "Explicit modifiers found",
    prefixes: "Prefixes",
    suffixes: "Suffixes",
    undetermined: "Unknown",
    openSlots: "Open slots in total",
    unknown: "Unknown",
    pending: "Pending",
    knowledgeUsed: (count: number, asOf: string) =>
      `Knowledge used: ${count} actions · data as of ${asOf}.`,
    noFullData: "Not enough data to work out chances.",
    whatTool: "What will you try it with?",
    toolsAria: "Crafting tools",
    advancedGate: "Essences and Alloys are under review for this patch. Basic currency is still available.",
    availableCurrency: "Available currency",
    onlyCompatible: "The app only enables actions that fit the data you pasted.",
    noActions: "The registry has no compatible actions for this module.",
    hideUnavailable: "Hide actions that don't apply",
    showUnavailable: (count: number) => `Show actions that don't apply (${count})`,
    evaluation: "Assessment: ",
    variantMinimum: (label: string, minimum: number | null) =>
      `${label}: ${minimum === null ? "no minimum shown" : `minimum modifier level ${minimum}`}`,
    exactVariant: "Exact version you'll use",
    noMinimum: "The tooltip you saw shows no minimum.",
    minimumSeen: (minimum: number) => `Minimum modifier level seen: ${minimum}.`,
    minimumNote: "This minimum copies the tooltip you saw; it doesn't guarantee a specific modifier or its chance.",
    preflightConfirm: "The item is unchanged, I haven't spent the currency yet, and I accept the result is random.",
    preparing: "Preparing…",
    prepareCraft: "Prepare this craft",
    cancel: "Cancel",
    chooseAction: "Choose this action",
    essenceEyebrow: "Guided mechanic P1",
    essenceIntro:
      "Enter the real Essence you have in front of you. The advisor checks the kind of operation and prepares a before/after comparison; it doesn't guess the effect from its name.",
    essenceType: "Essence type",
    exactName: "Exact name",
    namePlaceholder: "E.g. Essence of…",
    guaranteedEffect: "Exact guaranteed effect from the tooltip",
    effectPlaceholder: "Copy only what the Essence says it will add to this kind of item",
    plan: "Plan:",
    planMustKeep: (count: number) => ` · ${count} must-keep`,
    noneMustKeep: " · nothing marked as must-keep",
    stopConditions: (count: number) => ` · ${count} stop condition${count === 1 ? "" : "s"}`,
    editIntention: "Edit plan",
    protection: "Snapshot protection",
    magicToRare: "Magic → rare, keeping what's there",
    rareToRare: "Rare → rare, replacing 1 random modifier",
    anyAtRisk: "You don't choose which modifier goes: any current explicit modifier is at risk.",
    confirmSnapshot: "I confirm the item is still the same as the imported snapshot.",
    confirmEssenceTooltip: "I copied the name and effect from the Essence I'm going to use, not from an old guide.",
    confirmRandomRemoval: "I accept that one current explicit modifier will be removed at random.",
    confirmEssenceNotSpent: "I confirm I haven't applied the Essence yet.",
    createEssence: "Create Essence check",
    openCraftingTab: "Open the Crafting tab to start a saved check.",
    essenceSourceBefore: (patch: string) => `Structural rule confirmed since patch ${patch}: `,
    essenceSourceLink: "GGG's official notes",
    essenceSourceAfter: ". The full table of effects per Essence and item type isn't included.",
  },
);

export interface CraftingActionPlannerProps {
  item: Item;
  profile: CharacterProfile | null;
  target?: BuildTarget;
  /** Objetivo general del expediente; solo se usa como contexto, no como cálculo de build. */
  profileGoal: GoalKind;
  budget?: Budget;
  patch?: string;
  /** Essences y Alloys solo se habilitan con cobertura explícita del parche. */
  advancedCraftingAvailable: boolean;
  advancedCraftingNote: string;
  onStartCraftingDecision?: StartCraftingDecision;
  onStartEssenceDecision?: StartEssenceDecision;
  onStartAlloyDecision?: StartAlloyDecision;
  onUpdateItem?: () => void;
  showStatusLabel?: boolean;
  /** Se ejecuta únicamente cuando la sesión quedó creada. */
  onStarted?: () => void;
  onMentorContext?: (event: ContextualMentorEvent) => void;
  /** Presenta el mismo motor como un recorrido experto explícito. */
  experience?: "bank" | "laboratory";
  /**
   * Objetivo procedente de Ayuda en vivo. Solo inicia un proyecto vacío; un
   * contrato ya guardado para esta pieza siempre tiene prioridad.
   */
  initialDesiredOutcome?: string;
  /** Bases importadas que pueden contrastarse sin salir del proyecto avanzado. */
  candidateItems?: readonly Item[];
  onSelectCandidate?: (itemId: string) => void;
  onAddCandidate?: () => void;
}

/** Diagnóstico y preflight compartidos por el detalle y la pestaña Crafting. */
export function CraftingActionPlanner({
  item,
  profile,
  target,
  profileGoal,
  budget,
  patch = "",
  advancedCraftingAvailable,
  advancedCraftingNote,
  onStartCraftingDecision,
  onStartEssenceDecision,
  onStartAlloyDecision,
  onUpdateItem,
  showStatusLabel = true,
  onStarted,
  onMentorContext,
  experience = "bank",
  initialDesiredOutcome = "",
  candidateItems = [],
  onSelectCandidate,
  onAddCandidate,
}: CraftingActionPlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const laboratoryStorageKey = craftingProjectStorageKey(profile?.id ?? null, item.id);
  const laboratoryProject = useMemo(
    () => experience === "laboratory" ? readCraftingProject(laboratoryStorageKey) : emptyCraftingProject(),
    [experience, laboratoryStorageKey],
  );
  const crafting = diagnoseCraftingItem(item, lang);
  const isExampleItem = isCraftingExampleItem(item);
  const knowledge = useCraftingKnowledge(item, patch);
  const craftingActions = evaluateObservedCraftingActions(
    item,
    knowledge.data?.actions ?? [],
    lang,
  );
  const [preparedActionId, setPreparedActionId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] =
    useState<CraftingCurrencyVariant["id"]>("base");
  const seededDesiredOutcome =
    laboratoryProject.desiredOutcome.trim() || initialDesiredOutcome.trim();
  const [desiredOutcome, setDesiredOutcome] = useState(seededDesiredOutcome);
  const [goalCategory, setGoalCategory] = useState<CraftingGoalCategory>(laboratoryProject.goalCategory);
  const [protectedModifierIds, setProtectedModifierIds] = useProtectedModifiers(
    item,
    laboratoryProject.protectedModifierIds,
  );
  const [successCriteria, setSuccessCriteria] = useState<CraftingSuccessCriterion[]>(
    laboratoryProject.successCriteria,
  );
  const [projectAttempts, setProjectAttempts] = useState(laboratoryProject.attempts);
  const [preflightConfirmed, setPreflightConfirmed] = useState(false);
  const [startingDecision, setStartingDecision] = useState(false);
  const [activeTool, setActiveTool] = useState<CraftingTool>("currency");
  const availableActiveTool: CraftingTool = advancedCraftingAvailable ? activeTool : "currency";
  const [showUnavailableActions, setShowUnavailableActions] = useState(false);
  const [showReplacementRisk, setShowReplacementRisk] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  const initialLaboratoryObjective =
    (seededDesiredOutcome ||
      (laboratoryProject.goalCategory === "other"
        ? ""
        : CRAFTING_GOAL_LABELS[laboratoryProject.goalCategory])).length >= 3;
  const initialLaboratoryStop =
    laboratoryProject.successCriteria.length > 0 &&
    laboratoryProject.successCriteria.every(
      (criterion) => criterion.kind !== "exact-modifier-text" || criterion.text.trim().length >= 3,
    );
  const initialLaboratoryActive: LaboratoryStepId =
    crafting.state !== "complete" || !initialLaboratoryObjective
      ? "objective"
      : initialLaboratoryStop
        ? "route"
        : "base";
  const [laboratoryNavigation, setLaboratoryNavigation] = useState<LaboratoryNavigation>(() => ({
    itemId: item.id,
    active: initialLaboratoryActive,
    completed:
      initialLaboratoryActive === "route"
        ? ["objective", "base", "protect", "stop"]
        : initialLaboratoryActive === "base"
          ? ["objective"]
          : [],
  }));
  const currentLaboratoryNavigation =
    laboratoryNavigation.itemId === item.id
      ? laboratoryNavigation
      : {
          itemId: item.id,
          active: initialLaboratoryActive,
          completed:
            initialLaboratoryActive === "route"
              ? (["objective", "base", "protect", "stop"] as LaboratoryStepId[])
              : initialLaboratoryActive === "base"
                ? (["objective"] as LaboratoryStepId[])
                : [],
        };
  const laboratoryActiveStep = currentLaboratoryNavigation.active;
  const openLaboratoryStep = (step: LaboratoryStepId) => {
    setLaboratoryNavigation((current) => ({
      ...(current.itemId === item.id ? current : currentLaboratoryNavigation),
      itemId: item.id,
      active: step,
    }));
  };
  const completeLaboratoryStep = (
    completedStep: LaboratoryStepId,
    nextStep: LaboratoryStepId,
  ) => {
    setLaboratoryNavigation((current) => {
      const navigation = current.itemId === item.id ? current : currentLaboratoryNavigation;
      return {
        itemId: item.id,
        active: nextStep,
        completed: navigation.completed.includes(completedStep)
          ? navigation.completed
          : [...navigation.completed, completedStep],
      };
    });
  };
  useEffect(() => {
    if (experience !== "laboratory") return;
    saveCraftingProjectContract(laboratoryStorageKey, {
      desiredOutcome,
      goalCategory,
      protectedModifierIds,
      successCriteria,
    });
  }, [
    desiredOutcome,
    experience,
    goalCategory,
    laboratoryStorageKey,
    protectedModifierIds,
    successCriteria,
  ]);
  useEffect(() => {
    if (experience !== "laboratory" || typeof window === "undefined") return;
    const refreshAttempts = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey !== laboratoryStorageKey) return;
      setProjectAttempts(readCraftingProject(laboratoryStorageKey).attempts);
    };
    window.addEventListener(CRAFTING_PROJECT_UPDATED_EVENT, refreshAttempts);
    return () => window.removeEventListener(CRAFTING_PROJECT_UPDATED_EVENT, refreshAttempts);
  }, [experience, laboratoryStorageKey]);
  const compatibleActionCount = craftingActions.filter(
    (entry) => entry.status === "compatible",
  ).length;
  const unavailableActionCount = craftingActions.length - compatibleActionCount;
  const route = buildCraftingRoute(item, crafting, craftingActions, lang);
  const resetCurrencyPreflight = () => {
    setPreflightConfirmed(false);
  };
  const revealRouteTarget = (targetId: string) => {
    const reveal = () => {
      const target = document.getElementById(targetId);
      if (!target || target.closest("[hidden]")) return false;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      target.focus({ preventScroll: true });
      return true;
    };
    // Los objetivos ya visibles reciben foco en el mismo gesto. Los paneles
    // que React acaba de montar se resuelven en la siguiente trama.
    if (!reveal()) window.requestAnimationFrame(reveal);
  };
  const prepareCurrencyAction = (action: CraftingRouteAction) => {
    // El personaje de ejemplo sirve para estudiar una ruta, nunca para crear
    // una sesión de gasto sobre un objeto que el jugador no posee.
    if (isExampleItem) return;
    const evaluation = craftingActions.find((entry) => entry.action.id === action.id);
    if (!evaluation || evaluation.status !== "compatible") return;
    setActiveTool("currency");
    setPreparedActionId(action.id);
    setSelectedVariantId(evaluation.action.variants[0]?.id ?? "base");
    resetCurrencyPreflight();
    onMentorContext?.({
      type: "craftingAction",
      itemName: item.name,
      // El texto es el del catálogo español; el id deja rotularlo en inglés.
      actionLabel: evaluation.action.label,
      actionId: evaluation.action.id,
    });
    revealRouteTarget(`crafting-action-${item.id}-${action.id}`);
  };
  const openTool = (tool: "essence" | "alloy") => {
    setActiveTool(tool);
    revealRouteTarget(`crafting-tool-content-${item.id}-${tool}`);
  };
  const resolvedDesiredOutcome =
    desiredOutcome.trim() ||
    (goalCategory === "other" ? "" : craftingGoalLabel(goalCategory, lang));
  const successCriteriaReady =
    successCriteria.length > 0 &&
    successCriteria.every(
      (criterion) => criterion.kind !== "exact-modifier-text" || criterion.text.trim().length >= 3,
    );
  const currentSuccessAssessment = evaluateCraftingSuccessCriteria({
    criteria: successCriteria,
    resultItem: item,
  });
  const targetEvidence = useMemo(
    () => buildCraftingTargetEvidence({
      selectedItem: item,
      items: candidateItems.length > 0 ? candidateItems : [item],
      goalCategory,
      successCriteria,
      modPoolCoverage: knowledge.loading || knowledge.error
        ? "unknown"
        : knowledge.data?.modPool.status ?? "unknown",
    }, lang),
    [candidateItems, goalCategory, item, knowledge.data?.modPool.status, knowledge.error, knowledge.loading, lang, successCriteria],
  );
  const stopAlreadyReached = currentSuccessAssessment.status === "fulfilled";
  const objectiveReady = resolvedDesiredOutcome.length >= 3;
  const expertBlueprint = buildExpertCraftingBlueprint({
    item,
    diagnosis: crafting,
    evaluations: craftingActions,
    route,
    objective: resolvedDesiredOutcome,
    protectedModifierIds,
    successCriteria,
    budget,
  }, lang);
  const confirmationReady =
    !isExampleItem &&
    resolvedDesiredOutcome.length >= 3 &&
    successCriteriaReady &&
    !stopAlreadyReached &&
    preflightConfirmed;
  const buildIntent = useMemo(
    () =>
      deriveCraftingBuildIntent({
        profile,
        target,
        profileGoal,
        goalCategory,
      }),
    [goalCategory, profile, profileGoal, target],
  );
  const buildIntentPresentation = buildIntentCopy(buildIntent, goalCategory, lang);
  const projectPhase: Extract<MentorCraftingState, { mode: "advanced" }>["projectPhase"] =
    crafting.state !== "complete"
      ? "blocked"
      : currentSuccessAssessment.status === "fulfilled"
        ? "finished"
        : item.rarity === "normal"
          ? "base"
          : item.rarity === "magic"
            ? "foundation"
            : route.state === "replacement-tools"
              ? "recovery"
              : "finishing";
  const baseDecisionKind: Extract<MentorCraftingState, { mode: "advanced" }>["baseDecision"] =
    crafting.state !== "complete"
      ? "hold"
      : currentSuccessAssessment.status === "fulfilled"
        ? "stop"
        : compatibleActionCount === 0 && route.toolSuggestions.length === 0
          ? "change-base"
          : route.state === "replacement-tools"
            ? "recover"
            : "continue";
  const advancedMentorState = useMemo<
    Extract<MentorCraftingState, { mode: "advanced" }>
  >(
    () => {
      const parsedAction = CraftingActionIdSchema.safeParse(preparedActionId);
      const action = parsedAction.success ? parsedAction.data : null;
      return {
        mode: "advanced",
        goalCategory,
        buildIntent,
        protectedModifierCount: protectedModifierIds.length,
        stopCriteria: successCriteria.map((criterion) =>
          criterion.kind === "exact-modifier-text"
            ? {
                kind: criterion.kind,
                maximumTier: criterion.maximumTier ?? null,
              }
            : criterion,
        ),
        tool: availableActiveTool,
        action,
        variant: action === null ? null : selectedVariantId,
        preflightConfirmed,
        stopAlreadyReached,
        ready: confirmationReady,
        projectPhase,
        baseDecision: baseDecisionKind,
        attemptCount: projectAttempts.length,
        latestBranch: projectAttempts.at(-1)?.branch ?? null,
        targetEvidence: targetEvidence.status,
        localObservationCount: targetEvidence.observations.length,
        modPoolCoverage: targetEvidence.modPoolCoverage,
      };
    },
    [
      availableActiveTool,
      buildIntent,
      confirmationReady,
      baseDecisionKind,
      goalCategory,
      preflightConfirmed,
      projectAttempts,
      preparedActionId,
      projectPhase,
      protectedModifierIds.length,
      selectedVariantId,
      stopAlreadyReached,
      successCriteria,
      targetEvidence.modPoolCoverage,
      targetEvidence.observations.length,
      targetEvidence.status,
    ],
  );
  const publishedAdvancedMentorStateRef = useRef("");
  useEffect(() => {
    if (experience !== "laboratory") return;
    const signature = JSON.stringify({
      itemName: item.name || item.baseType,
      state: advancedMentorState,
    });
    if (publishedAdvancedMentorStateRef.current === signature) return;
    publishedAdvancedMentorStateRef.current = signature;
    onMentorContext?.({
      type: "craftingAdvancedPlan",
      itemName: item.name || item.baseType,
      state: advancedMentorState,
    });
  }, [advancedMentorState, experience, item.baseType, item.name, onMentorContext]);
  const changeGoalCategory = (next: CraftingGoalCategory) => {
    setGoalCategory(next);
    setSuccessCriteria((current) => {
      if (next === "other") {
        return current.filter((criterion) => criterion.kind !== "goal-affix-count");
      }
      return current.map((criterion) =>
        criterion.kind === "goal-affix-count"
          ? { ...criterion, category: next }
          : criterion,
      );
    });
    const recommended = recommendCraftingSuccessCriterion(item, next);
    const currentCount = next === "other"
      ? 0
      : item.modifiers.filter(
          (modifier) =>
            modifier.kind === "explicit" &&
            evaluateCraftingGoalSignal(next, [modifier]).status === "direct",
        ).length;
    onMentorContext?.({
      type: "craftingGoal",
      itemName: item.name,
      goal: next,
      currentCount,
      nextTarget: recommended?.minimumCount ?? null,
    });
  };
  const changeSuccessCriteria = (next: CraftingSuccessCriterion[]) => {
    const added = next.find(
      (criterion) => !successCriteria.some((current) => current.kind === criterion.kind),
    );
    setSuccessCriteria(next);
    if (experience === "laboratory") openLaboratoryStep("stop");
    if (added) {
      onMentorContext?.({
        type: "craftingStop",
        itemName: item.name,
        criterionLabel: craftingSuccessCriterionLabel(added),
        criterion: added,
      });
    }
  };
  const chooseCandidate = (itemId: string) => {
    if (itemId === item.id || !onSelectCandidate) return;
    // El objetivo y la parada pertenecen al proyecto; las protecciones, a los
    // modificadores concretos de la pieza actual y no deben cruzar de base.
    saveCraftingProjectContract(
      craftingProjectStorageKey(profile?.id ?? null, itemId),
      {
        desiredOutcome,
        goalCategory,
        protectedModifierIds: [],
        successCriteria,
      },
    );
    onSelectCandidate(itemId);
  };
  const mentorReading = buildCraftingMentorReading(item, crafting, goalCategory, lang);
  const affixAssessment = assessCraftingAffixes(item, goalCategory, protectedModifierIds, lang);
  const profileGoalAligned =
    (profileGoal === "damage" && goalCategory === "damage") ||
    (profileGoal === "survival" && goalCategory === "defence");
  const baseVerdict = (() => {
    if (crafting.state !== "complete") {
      return {
        tone: "danger" as const,
        eyebrow: t.baseDecision,
        title: t.dontSpendYet,
        detail: crafting.nextAction,
      };
    }
    if (goalCategory === "other") {
      const declaredOutcome = desiredOutcome.trim();
      return {
        tone: "neutral" as const,
        eyebrow: t.baseDecision,
        title: declaredOutcome
          ? t.declaredNoEvidence
          : t.tellMeFirst,
        detail: declaredOutcome
          ? t.declaredDetail(declaredOutcome)
          : t.noGoalDetail,
      };
    }
    if (stopAlreadyReached) {
      return {
        tone: "positive" as const,
        eyebrow: t.stopCondition,
        title: t.goalMet,
        detail: t.goalMetDetail,
      };
    }
    if (mentorReading.verdict === "protect") {
      return {
        tone: "caution" as const,
        eyebrow: t.baseDecision,
        title: t.dontReplace,
        detail: mentorReading.verdictDetail,
      };
    }
    if (mentorReading.verdict === "controlled-test") {
      return {
        tone: "positive" as const,
        eyebrow: t.baseDecision,
        title: t.worthTest,
        detail: `${mentorReading.verdictDetail}${
          profileGoalAligned ? t.alsoProfile : ""
        }`,
      };
    }
    return {
      tone: "caution" as const,
      eyebrow: t.baseDecision,
      title: item.rarity === "normal" ? t.unprovenBase : t.doubtfulBase,
      detail:
        item.rarity === "normal"
          ? t.normalDetail
          : mentorReading.verdictDetail,
    };
  })();
  const baseVerdictStyle =
    baseVerdict.tone === "positive"
      ? "border-emerald-500/45 bg-emerald-500/[0.09] text-emerald-50"
      : baseVerdict.tone === "danger"
        ? "border-rose-500/45 bg-rose-500/[0.09] text-rose-50"
        : baseVerdict.tone === "caution"
          ? "border-amber-500/45 bg-amber-500/[0.08] text-amber-50"
          : "border-sky-500/35 bg-sky-500/[0.06] text-sky-50";
  const replacementNeedsConsent =
    route.state === "replacement-tools" && mentorReading.protectCandidates.length > 0;
  const verdictTone =
    mentorReading.verdict === "controlled-test"
      ? "text-emerald-200"
      : mentorReading.verdict === "define"
        ? "text-sky-200"
        : "text-amber-200";
  const diagnosisHeadline =
    crafting.state === "complete" && item.rarity === "normal"
      ? t.normalNoMods
      : crafting.unclassifiedExplicitCount > 0
      ? t.unclassified(crafting.unclassifiedExplicitCount)
      : crafting.state === "complete"
        ? t.structure(crafting.prefixCount, crafting.suffixCount, crafting.observedOpenSlots ?? 0)
        : t.missingData;
  const evidenceCount =
    crafting.blockers.length +
    crafting.limitations.length +
    (knowledge.data?.modPool.reasons.length ?? 0) +
    (knowledge.data?.modPool.limitations.length ?? 0);
  const laboratoryPrompt: Record<LaboratoryStepId, string> = {
    objective: t.promptObjective,
    base: t.promptBase,
    protect: t.promptProtect,
    stop: t.promptStop,
    route: stopAlreadyReached
      ? t.promptRouteDone
      : t.promptRouteReady,
  };
  const laboratoryCompleted = currentLaboratoryNavigation.completed;
  const laboratoryStepDefinitions: Array<Omit<LaboratoryStep, "state">> = [
    {
      id: "objective",
      label: t.stepObjective,
      value: objectiveReady ? craftingGoalLabel(goalCategory, lang) : t.chooseOne,
    },
    {
      id: "base",
      label: t.stepBase,
      value: candidateItems.length > 1 ? t.imported(candidateItems.length) : item.baseType,
      reason: crafting.state !== "complete" ? t.finishReading : undefined,
    },
    {
      id: "protect",
      label: t.stepProtect,
      value:
        protectedModifierIds.length === 0
          ? t.nothingMarked
          : t.markedCount(protectedModifierIds.length),
    },
    {
      id: "stop",
      label: t.stepStop,
      value: stopAlreadyReached
        ? t.met
        : successCriteriaReady
          ? t.definedCount(successCriteria.length)
          : t.pickOne,
    },
    {
      id: "route",
      label: t.stepRoute,
      value: craftingLaboratoryRouteLabel({
        diagnosisState: crafting.state,
        objectiveReady,
        successCriteriaReady,
        stopAlreadyReached,
      }, lang),
      reason:
        crafting.state !== "complete"
          ? t.finishReading
          : !objectiveReady || !successCriteriaReady
            ? t.finishContract
            : undefined,
    },
  ];
  const laboratorySteps: LaboratoryStep[] = laboratoryStepDefinitions.map((step) => {
    if (step.id === laboratoryActiveStep) return { ...step, state: "current" as const };
    if (step.reason) return { ...step, state: "blocked" as const };
    if (laboratoryCompleted.includes(step.id)) return { ...step, state: "done" as const };
    return { ...step, state: "pending" as const };
  });

  if (crafting.state !== "complete" && experience !== "laboratory") {
    const availableActions = craftingActions.filter((action) => action.status === "compatible").length;
    return (
      <div className="flex flex-col gap-4" data-testid="crafting-planner-blocked">
        <CraftingRepairBanner
          onRepaste={onUpdateItem}
          reason={crafting.blockers[0] ?? crafting.limitations[0] ?? null}
          item={item}
          patch={patch}
        />
        <section className="pointer-events-none rounded-md border border-border/60 bg-background/30 p-4 opacity-55" aria-hidden="true">
          <p className="text-xs font-semibold text-cyan-300/70">{t.craftProject}</p>
          <h3 className="mt-1 text-lg font-semibold">{item.name || item.baseType}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.currencyAvailable(availableActions, craftingActions.length)}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {experience === "laboratory" && crafting.state !== "complete" && (
        <CraftingRepairBanner
          onRepaste={onUpdateItem}
          reason={crafting.blockers[0] ?? crafting.limitations[0] ?? null}
          item={item}
          patch={patch}
        />
      )}
      {experience === "laboratory" && (
        <section
          className="rounded-md border border-cyan-500/30 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.09),transparent_42%)]"
          data-testid="crafting-laboratory-status"
          aria-labelledby={`crafting-laboratory-title-${item.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan-500/20 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-cyan-300/80">{t.craftProject}</p>
              <h3 id={`crafting-laboratory-title-${item.id}`} className="mt-1 text-lg font-semibold">
                {laboratoryPrompt[laboratoryActiveStep]}
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="border-cyan-500/35 bg-cyan-500/[0.08] text-cyan-200">{crafting.label}</Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-200"
                data-testid="crafting-project-saved"
              >
                {t.autosave}
              </Badge>
            </div>
          </div>
          <ol
            className="sticky top-0 z-20 grid grid-cols-5 gap-px overflow-hidden rounded-b-md border-t border-cyan-500/20 bg-background/95 shadow-lg backdrop-blur"
            aria-label={t.trackerAria}
            data-testid="crafting-laboratory-tracker"
          >
            {laboratorySteps.map((step, index) => (
              <li
                key={step.id}
                className={`min-w-0 bg-background/85 ${step.state === "blocked" ? "border border-dashed border-rose-500/40" : ""}`}
                data-step-state={step.state}
              >
                <button
                  type="button"
                  aria-current={step.state === "current" ? "step" : undefined}
                  aria-disabled={
                    step.state === "blocked" ||
                    (step.state === "pending" && step.id !== "objective" && step.id !== "stop")
                      ? "true"
                      : undefined
                  }
                  title={step.reason}
                  onClick={() => {
                    if (
                      step.state === "blocked" ||
                      (step.state === "pending" && step.id !== "objective" && step.id !== "stop")
                    ) return;
                    openLaboratoryStep(step.id);
                    revealRouteTarget(`crafting-intention-${item.id}`);
                  }}
                  className={`min-h-11 w-full px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 sm:min-h-16 sm:px-3 ${
                    step.state === "current"
                      ? "border-l-[3px] border-cyan-300 bg-cyan-500/[0.09] font-semibold"
                      : step.state === "done"
                        ? "hover:bg-cyan-500/[0.05]"
                        : step.state === "blocked"
                          ? "cursor-not-allowed text-rose-200/70"
                          : step.id === "objective" || step.id === "stop"
                            ? "opacity-75 hover:bg-cyan-500/[0.05]"
                            : "cursor-not-allowed opacity-60"
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs font-semibold sm:text-xs">
                    <span aria-hidden="true">
                      {step.state === "done" ? "✓" : step.state === "current" ? "▸" : step.state === "blocked" ? "⛔" : "·"}
                    </span>
                    <span className="sm:hidden">{index + 1}</span>
                    <span className="hidden sm:inline">{index + 1}. {step.label}</span>
                  </span>
                  <span className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">{step.value}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section
        className="flex flex-col gap-3 rounded-md border border-border bg-muted/15 p-4"
        data-testid="crafting-diagnosis"
        aria-labelledby={`crafting-diagnosis-title-${item.id}`}
      >
        {showStatusLabel && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`crafting-diagnosis-title-${item.id}`} className="text-sm font-medium text-foreground">
              {t.itemState}
            </h3>
            <Badge variant="outline" className={CRAFTING_STATE_STYLE[crafting.state]}>
              {crafting.label}
            </Badge>
          </div>
        )}
        {!showStatusLabel && (
          <h3 id={`crafting-diagnosis-title-${item.id}`} className="sr-only">
            {t.itemState}
          </h3>
        )}
        <p className="text-lg font-semibold text-foreground">{diagnosisHeadline}</p>
        <section
          id={`crafting-intention-${item.id}`}
          tabIndex={-1}
          className="space-y-3 rounded-md border border-primary/25 bg-primary/[0.045] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="crafting-intention"
          aria-labelledby={`crafting-intention-title-${item.id}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-primary/75">
                {t.yourPlan}
              </p>
              <h4 id={`crafting-intention-title-${item.id}`} className="mt-1 text-base font-semibold text-foreground">{t.yourContract}</h4>
            </div>
            <span className={`rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 text-xs text-primary ${experience === "laboratory" ? "hidden sm:inline" : ""}`}>
              {t.goalChip(craftingGoalLabel(goalCategory, lang), protectedModifierIds.length)}
            </span>
          </div>
          {experience !== "laboratory" && <>
            <CraftingGoalPicker
              category={goalCategory}
              onCategoryChange={changeGoalCategory}
              outcome={desiredOutcome}
              onOutcomeChange={setDesiredOutcome}
              idPrefix={`crafting-goal-${item.id}`}
              label={goalCategory === "other" ? t.describeGoal : t.addNuance}
              placeholder={t.goalPlaceholder}
              helperText={goalCategory === "other" ? t.describeResult : t.emptyUses(craftingGoalLabel(goalCategory, lang))}
            />
            <details
              className="group rounded-md border border-border/70 bg-background/20"
              data-testid="crafting-protection-details"
              open={route.state === "replacement-tools" || protectionOpen}
              onToggle={(event) => {
                if (route.state === "replacement-tools" && !event.currentTarget.open) {
                  event.currentTarget.open = true;
                  return;
                }
                setProtectionOpen(event.currentTarget.open);
              }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-foreground">
                <span>{route.state === "replacement-tools" ? t.protectReplace : t.protectOptional}</span>
                <span className="text-xs font-normal text-muted-foreground">{protectedModifierIds.length === 0 ? t.nothingMarked : t.markedCount(protectedModifierIds.length)}</span>
              </summary>
              <div className="border-t border-border/60 p-2">
                <CraftingProtectionPicker item={item} value={protectedModifierIds} onChange={setProtectedModifierIds} idPrefix={`crafting-protected-${item.id}`} compact />
              </div>
            </details>
            <CraftingSuccessCriteriaPicker item={item} goalCategory={goalCategory} value={successCriteria} onChange={changeSuccessCriteria} observedTargets={targetEvidence.observations} />
          </>}

          {experience === "laboratory" && laboratoryActiveStep === "objective" && <>
            <CraftingGoalPicker
              category={goalCategory}
              onCategoryChange={changeGoalCategory}
              outcome={desiredOutcome}
              onOutcomeChange={setDesiredOutcome}
              idPrefix={`crafting-goal-${item.id}`}
              label={goalCategory === "other" ? t.describeGoal : t.addNuance}
              placeholder={t.goalPlaceholder}
              helperText={goalCategory === "other" ? t.describeResult : t.emptyUses(craftingGoalLabel(goalCategory, lang))}
            />
            <div className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${BUILD_ALIGNMENT_STYLE[buildIntent.alignment]}`} data-testid="crafting-build-intent" data-alignment={buildIntent.alignment} role="status">
              <div className="min-w-0">
                <span className="block text-xs font-semibold opacity-70">{t.characterSuggestion}</span>
                <strong className="mt-0.5 block text-sm">{buildIntentPresentation.title}</strong>
                <span className="mt-0.5 block text-xs leading-relaxed opacity-80">{buildIntentPresentation.detail}</span>
              </div>
              {(buildIntent.alignment === "choice-required" || buildIntent.alignment === "conflict") && buildIntent.suggestedCategories.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {buildIntent.suggestedCategories.map((category) => <Button key={category} type="button" size="sm" variant="outline" onClick={() => changeGoalCategory(category)} data-testid={`crafting-use-build-intent-${category}`}>{t.useGoal(craftingGoalLabel(category, lang))}</Button>)}
                </div>
              )}
            </div>
            <Button type="button" size="sm" className="min-h-11 self-start" disabled={!objectiveReady} onClick={() => completeLaboratoryStep(
              "objective",
              crafting.state !== "complete"
                ? "stop"
                : laboratoryCompleted.includes("base") && laboratoryCompleted.includes("protect") && laboratoryCompleted.includes("stop")
                  ? "route"
                  : "base",
            )}>
              {t.saveGoal}
            </Button>
          </>}

          {experience === "laboratory" && laboratoryActiveStep === "base" && (
            crafting.state === "complete" ? <>
              <div className="space-y-2">
                <CraftingBaseWorkbench selectedItem={item} items={candidateItems.length > 0 ? candidateItems : [item]} profile={profile} goalCategory={goalCategory} onChoose={chooseCandidate} onAdd={onAddCandidate} />
                <CraftingTargetEvidencePanel evidence={targetEvidence} />
              </div>
              <div className={`rounded-md border p-3 ${baseVerdictStyle}`} data-testid="crafting-base-verdict" data-base-verdict={baseVerdict.tone} aria-live="polite">
                <p className="text-xs font-semibold opacity-75">{baseVerdict.eyebrow}</p>
                <p className="mt-1 text-base font-semibold">{baseVerdict.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{baseVerdict.detail}</p>
              </div>
              <Button type="button" size="sm" className="min-h-11 self-start" onClick={() => completeLaboratoryStep(
                "base",
                laboratoryCompleted.includes("protect") && laboratoryCompleted.includes("stop") ? "route" : "protect",
              )}>{t.confirmBase}</Button>
            </> : <p className="rounded-md border border-dashed border-rose-500/40 bg-rose-500/[0.06] p-3 text-sm text-rose-100">{t.baseNeedsReading}</p>
          )}

          {experience === "laboratory" && laboratoryActiveStep === "protect" && <>
            <div className="rounded-md border border-border/70 bg-background/20 p-2" data-testid="crafting-protection-details">
              <CraftingProtectionPicker item={item} value={protectedModifierIds} onChange={setProtectedModifierIds} idPrefix={`crafting-protected-${item.id}`} compact />
            </div>
            <Button type="button" size="sm" className="min-h-11 self-start" onClick={() => completeLaboratoryStep(
              "protect",
              laboratoryCompleted.includes("stop") ? "route" : "stop",
            )}>{protectedModifierIds.length === 0 ? t.continueUnmarked : t.saveProtections}</Button>
          </>}

          {experience === "laboratory" && laboratoryActiveStep === "stop" && <>
            <div id={`crafting-success-${item.id}`}>
              <CraftingSuccessCriteriaPicker item={item} goalCategory={goalCategory} value={successCriteria} onChange={changeSuccessCriteria} observedTargets={targetEvidence.observations} />
            </div>
            {!laboratoryCompleted.includes("stop") && <Button type="button" size="sm" className="min-h-11 self-start" disabled={!successCriteriaReady} onClick={() => completeLaboratoryStep("stop", crafting.state === "complete" ? "route" : "stop")}>{t.saveStop}</Button>}
            {laboratoryCompleted.includes("stop") && crafting.state !== "complete" && <p className="text-sm font-medium text-emerald-200">{t.stopSaved}</p>}
          </>}

          {experience !== "laboratory" && <div
            className={`rounded-md border p-3 ${baseVerdictStyle}`}
            data-testid="crafting-base-verdict"
            data-base-verdict={baseVerdict.tone}
            aria-live="polite"
          >
            <p className="text-xs font-semibold opacity-75">
              {baseVerdict.eyebrow}
            </p>
            <p className="mt-1 text-base font-semibold">{baseVerdict.title}</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{baseVerdict.detail}</p>
          </div>}
        </section>
        {experience !== "laboratory" && <details
          className="group rounded-md border border-border/70 bg-background/25 p-3"
          data-testid="crafting-reading-details"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            <span>{t.whyPath}</span>
            <span className={verdictTone}>
              {mentorReading.verdictLabel} · {t.alignedCount(affixAssessment.alignedCount, affixAssessment.entries.length)}
            </span>
          </summary>
          <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="crafting-mentor-reading">
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">{t.worthGoingOn}</span>
            <strong className={verdictTone}>{mentorReading.verdictLabel}</strong>
            <span>{mentorReading.verdictDetail}</span>
          </div>
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">{t.inFavour}</span>
            <strong>{mentorReading.matchingModifiers.length}</strong>
            <span>
              {mentorReading.matchingModifiers[0]?.text ??
                (goalCategory === "other" ? t.pickCategory : t.noDirectTag)}
            </span>
          </div>
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">{t.noDirectSignal}</span>
            <strong>{mentorReading.unmatchedModifiers.length}</strong>
            <span>
              {mentorReading.unmatchedModifiers[0]?.text ??
                (goalCategory === "other" ? t.pendingGoal : t.nothingFlagged)}
            </span>
          </div>
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">{t.keepCandidates}</span>
            <strong>{mentorReading.protectCandidates.length}</strong>
            <span>{mentorReading.protectCandidates[0]?.text ?? t.noTopTiers}</span>
          </div>
          </div>
          {affixAssessment.entries.length > 0 && (
          <section
            className="rounded-md border border-border/80 bg-background/35 p-3"
            data-testid="crafting-affix-assessment"
            data-aligned-count={affixAssessment.alignedCount}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary/75">
                  {t.affixCore}
                </p>
                <h4 className="mt-1 text-base font-semibold text-foreground">
                  {affixAssessment.headline}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {affixAssessment.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {t.alignedCount(affixAssessment.alignedCount, affixAssessment.entries.length)}
                </span>
                {affixAssessment.protectedCount > 0 && (
                  <span className="rounded-full border border-emerald-500/35 bg-emerald-500/[0.08] px-2.5 py-1 text-xs text-emerald-200">
                    {t.mustKeepCount(affixAssessment.protectedCount)}
                  </span>
                )}
              </div>
            </div>
            {(affixAssessment.clusters.length > 0 || affixAssessment.leadingAlignedCount > 0) && (
              <div className="mt-3 flex flex-wrap gap-2" aria-label={t.highlightsAria}>
                {affixAssessment.clusters.map((cluster) => (
                  <span
                    key={cluster.tag}
                    className="rounded-full border border-sky-500/30 bg-sky-500/[0.07] px-2.5 py-1 text-xs text-sky-200"
                  >
                    {cluster.tag} ×{cluster.count}
                  </span>
                ))}
                {affixAssessment.leadingAlignedCount > 0 && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/[0.07] px-2.5 py-1 text-xs text-emerald-200">
                    {t.leadingAligned(affixAssessment.leadingAlignedCount)}
                  </span>
                )}
              </div>
            )}
            <details className="group mt-3 text-xs">
              <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
                {t.seeReading(affixAssessment.entries.length)}
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {affixAssessment.entries.map((entry) => (
                  <article
                    key={entry.modifier.id}
                    className={`rounded border px-3 py-2 ${
                      entry.protected
                        ? "border-emerald-400/60 bg-emerald-500/[0.11] text-emerald-100"
                        : AFFIX_ASSESSMENT_STYLE[entry.kind]
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground">{entry.modifier.text}</span>
                      <span className="shrink-0 font-mono text-[10px]">
                        {t.tierShort(entry.modifier.tier)}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold">
                      {entry.protected ? t.mustKeepForPlan : entry.label}
                    </p>
                    <p className="mt-1 leading-relaxed opacity-80">{entry.reason}</p>
                  </article>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {t.readingNote}
              </p>
            </details>
          </section>
          )}
        </details>}
        {experience !== "laboratory" && (
          <div
            className="rounded-sm border-l-2 border-primary bg-primary/[0.06] px-3 py-3"
            data-testid="crafting-route"
            data-route-state={route.state}
          >
          <p className="text-xs font-semibold text-primary/75">
            {route.eyebrow}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{route.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{route.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {route.currencyActions.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant={route.currencyActions.length === 1 ? "default" : "outline"}
                disabled={isExampleItem}
                onClick={() => {
                  if (resolvedDesiredOutcome.length < 3) {
                    revealRouteTarget(`crafting-intention-${item.id}`);
                    return;
                  }
                  if (!successCriteriaReady) {
                    revealRouteTarget(`crafting-success-${item.id}`);
                    return;
                  }
                  if (stopAlreadyReached) {
                    revealRouteTarget(`crafting-success-${item.id}`);
                    return;
                  }
                  prepareCurrencyAction(action);
                }}
              >
                {isExampleItem
                  ? t.demoOnly
                  : resolvedDesiredOutcome.length < 3
                  ? t.defineGoal
                  : !successCriteriaReady
                    ? t.chooseStop
                    : stopAlreadyReached
                      ? t.goalAlreadyMet
                    : t.prepareAction(action.label, route.currencyActions.length === 1)}
              </Button>
            ))}
            {replacementNeedsConsent && !showReplacementRisk && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowReplacementRisk(true)}
              >
                {t.reviewRisky}
              </Button>
            )}
            {!isExampleItem && advancedCraftingAvailable && route.toolSuggestions.includes("essence") &&
              (!replacementNeedsConsent || showReplacementRisk) && (
              <Button type="button" size="sm" variant="outline" onClick={() => openTool("essence")}>
                {t.reviewEssence}
              </Button>
            )}
            {!isExampleItem && advancedCraftingAvailable && route.toolSuggestions.includes("alloy") &&
              (!replacementNeedsConsent || showReplacementRisk) && (
              <Button type="button" size="sm" variant="outline" onClick={() => openTool("alloy")}>
                {t.reviewAlloy}
              </Button>
            )}
            {route.state === "needs-data" && onUpdateItem && (
              <Button type="button" size="sm" variant="outline" onClick={onUpdateItem}>
                {t.repaste}
              </Button>
            )}
          </div>
          </div>
        )}
        {experience === "laboratory" && laboratoryActiveStep === "route" && crafting.state === "complete" && objectiveReady && successCriteriaReady && (
          <div id={`crafting-blueprint-${item.id}`} tabIndex={-1} className="space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            {isExampleItem && (
              <section
                className="rounded-md border border-cyan-500/35 bg-cyan-500/[0.07] p-3 text-cyan-50"
                data-testid="crafting-example-simulation-gate"
                role="status"
              >
                <p className="text-sm font-semibold">{t.demoProject}</p>
                <p className="mt-1 text-xs leading-relaxed text-cyan-100/80">
                  {t.demoDetail}
                </p>
                {onUpdateItem && (
                  <Button className="mt-3" type="button" size="sm" variant="outline" onClick={onUpdateItem}>
                    {t.pasteMyOwn}
                  </Button>
                )}
              </section>
            )}
            <CraftingExpertBlueprint
            blueprint={expertBlueprint}
            attempts={projectAttempts}
            disabled={stopAlreadyReached}
            simulation={isExampleItem}
            unavailableRouteIds={advancedCraftingAvailable ? [] : ["essence", "alloy"]}
            showContract={false}
            onChooseRoute={(selectedRoute) => {
              if (selectedRoute.id === "essence" || selectedRoute.id === "alloy") {
                if (replacementNeedsConsent) setShowReplacementRisk(true);
                openTool(selectedRoute.id);
                return;
              }
              prepareCurrencyAction({ id: selectedRoute.id, label: selectedRoute.label });
            }}
            />
          </div>
        )}
        {experience !== "laboratory" && <div
          className="flex flex-wrap gap-2 text-[11px]"
          data-testid="crafting-knowledge-status"
          aria-live="polite"
        >
          {knowledge.loading ? (
            <span className="text-muted-foreground">{t.checkingKnowledge}</span>
          ) : knowledge.error ? (
            <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-rose-200">
              {t.knowledgeUnavailable}
            </span>
          ) : knowledge.data ? (
            <>
              <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                {t.verifiedRules(knowledge.data.actions.length)}
              </span>
              {knowledge.data.modPool.probabilityBasis === "insufficient" && (
                <span className="rounded-full border border-amber-500/35 bg-amber-500/[0.07] px-2 py-1 text-amber-200">
                  {t.noChances}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{t.noKnowledge}</span>
          )}
        </div>}
        {experience !== "laboratory" && <details className="group text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
            {t.evidenceLimits(evidenceCount)}
          </summary>
          <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
            <p>{crafting.summary}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div>
                <dt>{t.explicitSeen}</dt>
                <dd className="font-medium text-foreground">{crafting.explicitCount}</dd>
              </div>
              <div>
                <dt>{t.prefixes}</dt>
                <dd className="font-medium text-foreground">
                  {crafting.state === "complete" ? crafting.prefixCount : t.undetermined}
                </dd>
              </div>
              <div>
                <dt>{t.suffixes}</dt>
                <dd className="font-medium text-foreground">
                  {crafting.state === "complete" ? crafting.suffixCount : t.undetermined}
                </dd>
              </div>
              <div>
                <dt>{t.openSlots}</dt>
                <dd className="font-medium text-foreground">
                  {crafting.state === "complete"
                    ? (crafting.observedOpenSlots ?? t.unknown)
                    : t.pending}
                </dd>
              </div>
            </dl>
            {crafting.blockers.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-amber-200">
                {crafting.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
            <ul className="list-inside list-disc space-y-1">
            {crafting.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
            </ul>
            {knowledge.error && <p className="text-rose-200">{knowledge.error}</p>}
            {knowledge.data && (
              <div className="space-y-2 border-t border-border/70 pt-3">
                <p>
                  {t.knowledgeUsed(knowledge.data.actions.length, knowledge.data.asOf)}
                </p>
                {knowledge.data.modPool.probabilityBasis === "insufficient" && (
                  <>
                    <p className="font-medium text-amber-200">
                      {t.noFullData}
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      {[
                        ...knowledge.data.modPool.reasons,
                        ...knowledge.data.modPool.limitations,
                      ].slice(0, 4).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </details>}
      </section>

      {experience !== "laboratory" && <section aria-labelledby={`crafting-tools-title-${item.id}`}>
        <h3 id={`crafting-tools-title-${item.id}`} className="mb-2 text-sm font-semibold">
          {t.whatTool}
        </h3>
        <div
          className="grid gap-2 sm:grid-cols-3"
          role="tablist"
          aria-label={t.toolsAria}
        >
          {CRAFTING_TOOLS.map((toolId) => {
            const tool = { id: toolId, ...t.tools[toolId] };
            const selected = availableActiveTool === tool.id;
            const isAdvanced = tool.id !== "currency";
            const locked = isExampleItem || (isAdvanced && (
              !advancedCraftingAvailable || (replacementNeedsConsent && !showReplacementRisk)
            ));
            return (
              <button
                key={tool.id}
                type="button"
                role="tab"
                aria-selected={selected}
                title={isAdvanced && !advancedCraftingAvailable ? advancedCraftingNote : undefined}
                disabled={locked}
                data-testid={`crafting-tool-${tool.id}`}
                className={`group min-h-16 rounded-md border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? "border-primary/70 bg-primary/[0.11] shadow-[0_0_24px_-16px_hsl(var(--primary))]"
                    : "border-border/70 bg-muted/10 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/25"
                }`}
                onClick={() => setActiveTool(tool.id)}
              >
                <span className="block font-semibold text-foreground">{tool.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {tool.description}
                </span>
              </button>
            );
          })}
        </div>
        {!advancedCraftingAvailable && (
          <p
            className="mt-2 rounded-sm border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100/85"
            data-testid="crafting-advanced-patch-gate"
            role="status"
          >
            {t.advancedGate}
          </p>
        )}
      </section>}

      <div
        hidden={isExampleItem || availableActiveTool !== "currency" || route.state === "replacement-tools" || (experience === "laboratory" && laboratoryActiveStep !== "route")}
        style={
          isExampleItem || availableActiveTool !== "currency" || route.state === "replacement-tools" || (experience === "laboratory" && laboratoryActiveStep !== "route")
            ? { display: "none" }
            : undefined
        }
        className="flex flex-col gap-4"
        data-testid="crafting-tool-panel-currency"
      >
      <section
        hidden={route.currencyActions.length > 0 && preparedActionId === null}
        style={
          route.currencyActions.length > 0 && preparedActionId === null
            ? { display: "none" }
            : undefined
        }
        className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3"
        data-testid="crafting-actions"
        aria-labelledby={`crafting-actions-title-${item.id}`}
      >
        <div>
          <h3 id={`crafting-actions-title-${item.id}`} className="font-medium text-foreground">
            {t.availableCurrency}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.onlyCompatible}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {!knowledge.loading && !knowledge.error && craftingActions.length === 0 && (
            <p className="rounded border border-border p-3 text-xs text-muted-foreground">
              {t.noActions}
            </p>
          )}
          {compatibleActionCount > 0 && unavailableActionCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setShowUnavailableActions((visible) => !visible)}
            >
              {showUnavailableActions
                ? t.hideUnavailable
                : t.showUnavailable(unavailableActionCount)}
            </Button>
          )}
          {craftingActions.map((entry) => {
            const status = { ...ACTION_STATUS[entry.status], label: t.actionStatus[entry.status] };
            const unavailable = entry.status !== "compatible";
            const selectedVariant =
              entry.action.variants.find((variant) => variant.id === selectedVariantId) ??
              entry.action.variants[0];
            return (
              <details
                key={entry.action.id}
                id={`crafting-action-${item.id}-${entry.action.id}`}
                tabIndex={-1}
                hidden={compatibleActionCount > 0 && unavailable && !showUnavailableActions}
                open={
                  entry.status === "compatible" &&
                  (compatibleActionCount === 1 || preparedActionId === entry.action.id)
                    ? true
                    : undefined
                }
                className="rounded border border-border/70 p-2"
              >
                <summary className="cursor-pointer select-none list-none">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{craftingActionLabel(entry.action, lang)}</span>
                    <Badge variant="outline" className={status.style}>
                      {status.label}
                    </Badge>
                  </span>
                </summary>
                <div className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
                  <p>{craftingActionEffect(entry.action, lang)}</p>
                  <p>
                    <span className="font-medium text-foreground">{t.evaluation}</span>
                    {entry.reason}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {entry.action.variants.map((variant) => (
                      <span key={variant.id} className="rounded border border-border px-1.5 py-0.5">
                        {t.variantMinimum(craftingVariantLabel(variant, lang), variant.minimumModifierLevel)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px]">{craftingActionEvidence(entry.action, lang)}</p>
                  {entry.status === "compatible" && onStartCraftingDecision && !isExampleItem &&
                    (preparedActionId === entry.action.id ? (
                      <form
                        className="mt-1 flex flex-col gap-3 rounded border border-primary/30 bg-primary/5 p-3"
                        data-testid={`crafting-preflight-${entry.action.id}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!confirmationReady || startingDecision || !selectedVariant) return;
                          setStartingDecision(true);
                          void onStartCraftingDecision(
                            item,
                            entry.action,
                            selectedVariant,
                            {
                              desiredOutcome: resolvedDesiredOutcome,
                              goalCategory,
                              protectedModifierIds,
                              successCriteria,
                            },
                          )
                            .then((started) => {
                              if (started) onStarted?.();
                            })
                            .finally(() => setStartingDecision(false));
                        }}
                      >
                        <fieldset className="space-y-2">
                          <legend className="font-medium text-foreground">
                            {t.exactVariant}
                          </legend>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {entry.action.variants.map((variant) => {
                              const currencyName = craftingCurrencyLabelFor(entry.action, variant, lang);
                              return (
                                <label
                                  key={variant.id}
                                  className={`flex cursor-pointer flex-col gap-1 rounded border p-2 ${
                                    selectedVariant?.id === variant.id
                                      ? "border-primary/60 bg-primary/10"
                                      : "border-border bg-background/40"
                                  }`}
                                >
                                  <span className="flex items-center gap-2 font-medium text-foreground">
                                    <input
                                      type="radio"
                                      name={`crafting-variant-${item.id}-${entry.action.id}`}
                                      value={variant.id}
                                      checked={selectedVariant?.id === variant.id}
                                      onChange={() => setSelectedVariantId(variant.id)}
                                    />
                                    {craftingVariantLabel(variant, lang)}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {variant.minimumModifierLevel === null
                                      ? t.noMinimum
                                      : t.minimumSeen(variant.minimumModifierLevel)}
                                  </span>
                                  <span className="sr-only">{currencyName}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {t.minimumNote}
                          </p>
                        </fieldset>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={preflightConfirmed}
                            onChange={(event) => setPreflightConfirmed(event.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            {t.preflightConfirm}
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm" disabled={!confirmationReady || startingDecision}>
                            {startingDecision ? t.preparing : t.prepareCraft}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={startingDecision}
                            onClick={() => setPreparedActionId(null)}
                          >
                            {t.cancel}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPreparedActionId(entry.action.id);
                            setSelectedVariantId(entry.action.variants[0]?.id ?? "base");
                            resetCurrencyPreflight();
                          }}
                        >
                          {t.chooseAction}
                        </Button>
                      </div>
                    ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      </div>

      <div
        id={`crafting-tool-content-${item.id}-essence`}
        tabIndex={-1}
        hidden={isExampleItem || availableActiveTool !== "essence" || (experience === "laboratory" && laboratoryActiveStep !== "route")}
        style={isExampleItem || availableActiveTool !== "essence" || (experience === "laboratory" && laboratoryActiveStep !== "route") ? { display: "none" } : undefined}
        data-testid="crafting-tool-panel-essence"
      >
        <EssencePlanner
          item={item}
          onStart={isExampleItem ? undefined : onStartEssenceDecision}
          onStarted={onStarted}
          goalCategory={goalCategory}
          desiredOutcome={resolvedDesiredOutcome}
          protectedModifierIds={protectedModifierIds}
          successCriteria={successCriteria}
          onEditIntention={() => revealRouteTarget(`crafting-intention-${item.id}`)}
        />
      </div>
      <div
        id={`crafting-tool-content-${item.id}-alloy`}
        tabIndex={-1}
        hidden={isExampleItem || availableActiveTool !== "alloy" || (experience === "laboratory" && laboratoryActiveStep !== "route")}
        style={isExampleItem || availableActiveTool !== "alloy" || (experience === "laboratory" && laboratoryActiveStep !== "route") ? { display: "none" } : undefined}
        data-testid="crafting-tool-panel-alloy"
      >
        <AlloyPlanner
          item={item}
          onStart={isExampleItem ? undefined : onStartAlloyDecision}
          onStarted={onStarted}
          goalCategory={goalCategory}
          desiredOutcome={resolvedDesiredOutcome}
          protectedModifierIds={protectedModifierIds}
          successCriteria={successCriteria}
          onEditIntention={() => revealRouteTarget(`crafting-intention-${item.id}`)}
        />
      </div>
    </div>
  );
}

interface EssencePlannerProps {
  item: Item;
  onStart?: StartEssenceDecision;
  onStarted?: () => void;
  goalCategory: CraftingGoalCategory;
  desiredOutcome: string;
  protectedModifierIds: string[];
  successCriteria: CraftingSuccessCriterion[];
  onEditIntention: () => void;
}

function EssencePlanner({
  item,
  onStart,
  onStarted,
  goalCategory,
  desiredOutcome,
  protectedModifierIds,
  successCriteria,
  onEditIntention,
}: EssencePlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [tier, setTier] = useState<EssenceTier>(item.rarity === "magic" ? "normal" : "perfect");
  const [essenceName, setEssenceName] = useState("");
  const [guaranteedModifierText, setGuaranteedModifierText] = useState("");
  const [snapshotConfirmed, setSnapshotConfirmed] = useState(false);
  const [tooltipConfirmed, setTooltipConfirmed] = useState(false);
  const [randomRemovalConfirmed, setRandomRemovalConfirmed] = useState(false);
  const [notSpentConfirmed, setNotSpentConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const plan: EssencePlanInput = { tier, essenceName, guaranteedModifierText };
  const evaluation = evaluateEssencePlan(item, plan, lang);
  const protection = evaluateCraftingProtection({
    item,
    protectedModifierIds,
    removedModifierCount: evaluation.randomRemoval ? 1 : 0,
    removalSelection: evaluation.randomRemoval ? "random" : "none",
  }, lang);
  const status = { ...ACTION_STATUS[evaluation.status], label: t.actionStatus[evaluation.status] };
  const successCriteriaReady =
    successCriteria.length > 0 &&
    successCriteria.every(
      (criterion) => criterion.kind !== "exact-modifier-text" || criterion.text.trim().length >= 3,
    );
  const ready =
    evaluation.status === "compatible" &&
    desiredOutcome.trim().length >= 3 &&
    successCriteriaReady &&
    snapshotConfirmed &&
    tooltipConfirmed &&
    notSpentConfirmed &&
    protection.status !== "blocked" &&
    protection.status !== "needs-data" &&
    (!evaluation.randomRemoval || randomRemovalConfirmed);

  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-violet-500/25 bg-violet-500/[0.035] p-3"
      data-testid="crafting-essences"
      aria-labelledby={`crafting-essences-title-${item.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-violet-300/80">
            {t.essenceEyebrow}
          </p>
          <h3 id={`crafting-essences-title-${item.id}`} className="mt-1 font-medium text-foreground">
            Essences
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {t.essenceIntro}
          </p>
        </div>
        <Badge variant="outline" className={status.style}>{status.label}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`essence-tier-${item.id}`} className="text-xs font-medium text-foreground">
            {t.essenceType}
          </label>
          <select
            id={`essence-tier-${item.id}`}
            value={tier}
            onChange={(event) => {
              setTier(event.target.value as EssenceTier);
              setRandomRemovalConfirmed(false);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {(Object.entries(lang === "en" ? ESSENCE_TIER_LABELS_EN : ESSENCE_TIER_LABELS) as [EssenceTier, string][]).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`essence-name-${item.id}`} className="text-xs font-medium text-foreground">
            {t.exactName}
          </label>
          <input
            id={`essence-name-${item.id}`}
            value={essenceName}
            onChange={(event) => setEssenceName(event.target.value)}
            maxLength={120}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            placeholder={t.namePlaceholder}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`essence-effect-${item.id}`} className="text-xs font-medium text-foreground">
          {t.guaranteedEffect}
        </label>
        <textarea
          id={`essence-effect-${item.id}`}
          value={guaranteedModifierText}
          onChange={(event) => setGuaranteedModifierText(event.target.value)}
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          placeholder={t.effectPlaceholder}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {t.plan} <strong className="text-foreground">{craftingGoalLabel(goalCategory, lang)}</strong>
          {protectedModifierIds.length > 0
            ? t.planMustKeep(protectedModifierIds.length)
            : t.noneMustKeep}
          {t.stopConditions(successCriteria.length)}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onEditIntention}>
          {t.editIntention}
        </Button>
      </div>

      {evaluation.randomRemoval && protectedModifierIds.length > 0 && (
        <div
          className={`rounded border p-3 text-xs ${
            protection.status === "blocked"
              ? "border-rose-500/40 bg-rose-500/[0.08] text-rose-100"
              : protection.status === "warning"
                ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-100"
                : "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100"
          }`}
          data-protection-risk={protection.risk}
        >
          <p className="font-medium">{t.protection}</p>
          <p className="mt-1">{protection.reason}</p>
        </div>
      )}

      <div className={`rounded border p-3 text-xs ${
        evaluation.randomRemoval
          ? "border-rose-500/35 bg-rose-500/[0.07]"
          : "border-border bg-background/35"
      }`}>
        <p className="font-medium text-foreground">
          {evaluation.operation === "magic-to-rare"
            ? t.magicToRare
            : t.rareToRare}
        </p>
        <p className="mt-1 text-muted-foreground">{evaluation.reason}</p>
        {evaluation.randomRemoval && (
          <p className="mt-2 font-medium text-rose-200">
            {t.anyAtRisk}
          </p>
        )}
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={snapshotConfirmed} onChange={(event) => setSnapshotConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmSnapshot}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={tooltipConfirmed} onChange={(event) => setTooltipConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmEssenceTooltip}</span>
        </label>
        {evaluation.randomRemoval && (
          <label className="flex items-start gap-2 text-rose-100">
            <input type="checkbox" checked={randomRemovalConfirmed} onChange={(event) => setRandomRemovalConfirmed(event.target.checked)} className="mt-0.5" />
            <span>{t.confirmRandomRemoval}</span>
          </label>
        )}
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={notSpentConfirmed} onChange={(event) => setNotSpentConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmEssenceNotSpent}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!ready || starting || !onStart}
          onClick={() => {
            if (!ready || !onStart) return;
            setStarting(true);
            void onStart(item, plan, evaluation, {
              desiredOutcome: desiredOutcome.trim(),
              goalCategory,
              protectedModifierIds,
              successCriteria,
            })
              .then((started) => {
                if (started) onStarted?.();
              })
              .finally(() => setStarting(false));
          }}
        >
          {starting ? t.preparing : t.createEssence}
        </Button>
        {!onStart && (
          <span className="text-xs text-muted-foreground">
            {t.openCraftingTab}
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t.essenceSourceBefore(ESSENCE_MECHANIC_SOURCE.appliesFrom)}{" "}
        <a className="underline underline-offset-2" href={ESSENCE_MECHANIC_SOURCE.url} target="_blank" rel="noreferrer">
          {t.essenceSourceLink}
        </a>{t.essenceSourceAfter}
      </p>
    </section>
  );
}
