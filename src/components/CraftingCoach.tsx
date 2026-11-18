import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Dices,
  Loader2,
  ShieldAlert,
  Sparkles,
  Swords,
  TriangleAlert,
} from "lucide-react";
import {
  COACH_DIRECTION_LABELS,
  COACH_ROLL_MINIMUM_LABELS,
  coachRollMinimumLabel,
  assessPurposefulCraftBase,
  chooseNextStep,
  coachDirectionNoun,
  interpretCoachGoal,
  looksLikeCharacterQuestion,
  readPurposefulCraftResult,
  suggestCraftingFocusFromContext,
  type CoachDirection,
  type CoachGoalInterpretation,
  type CoachGoalIntent,
  type CoachGoalSource,
  type CoachNextStep,
  type CoachRollMinimum,
} from "@shared/craftingCoach.js";
import { hasCraftingCharacterContext } from "@shared/craftingCharacterContext.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import {
  COACH_FOCUS_LABELS,
  COACH_FOCUS_LABELS_EN,
  DAMAGE_COACH_FOCUSES,
  DEFENCE_COACH_FOCUSES,
  type CoachFocus,
} from "@shared/craftingFocus.js";
import {
  assessCraftingBudget,
  type CraftingBudgetAssessment,
} from "@shared/craftingBudget.js";
import {
  compareCraftingResult,
  requireCompleteCraftingResult,
  type CraftingComparison,
  type CraftingComparisonActionId,
} from "@shared/craftingComparison.js";
import type { Budget, BuildTarget, CharacterProfile, GoalKind, Item } from "@shared/domain.js";
import { CoachItemCard } from "@/components/CoachItemCard";
import { ItemReadingCard } from "@/components/ItemReadingCard";
import { CraftingRepairBanner } from "@/components/CraftingRepairBanner";
import { ItemArtwork } from "@/components/ItemArtwork";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { rarityStyle } from "@/lib/equipment";
import { useFormatLabels } from "@/lib/formatLabels";
import { displayProfileValue } from "@/lib/format";
import { isCraftingExampleItem } from "@/lib/craftingSimulation";
import {
  CRAFTING_COACH_PROGRESS_VERSION,
  discardCraftingCoachProgress,
  emptyCraftingCoachProgress,
  loadCraftingCoachProgress,
  phaseAfterObservedResult,
  protectSimulatedCraftingProgress,
  saveCraftingCoachProgress,
} from "@/lib/craftingCoachProgress";
import { cn } from "@/lib/utils";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";
import { quoted, texts, useLang, useText } from "@/i18n/lang";

export type CoachPhase = "choose" | "recommend" | "hold" | "await-result" | "result";

const TEXT = texts(
  {
    copyHint: "En PoE2, pasa el ratón por el objeto y pulsa Ctrl+Alt+C; luego pégalo aquí.",
    // Recomendación
    practiceTitle: "Esta es una pieza de práctica.",
    exampleTitle: "Esta pieza pertenece al personaje de ejemplo.",
    practiceBody:
      "Puedes aprender qué recomendaría el guía, pero esta pieza tampoco existe en tu cuenta. No gastes moneda ni pegues un resultado real.",
    exampleBody:
      "Es una simulación: no existe en tu cuenta. Aquí nunca te pediré gastar una moneda ni pegar un resultado real.",
    backToMyItem: "Volver a mi pieza",
    tryAnotherPractice: "Probar otra pieza de práctica",
    openPractice: "Abrir una pieza de práctica",
    pasteMyOwn: "Pegar mi propia pieza",
    changeGoal: "Cambiar objetivo",
    tryPractice: "Probar con una pieza de práctica",
    myAdvice: "Mi consejo",
    why: "Por qué",
    technicalEvidence: "Ver detalles",
    viewInCharacter: "Ver la pieza en mi personaje",
    pasteAnother: "Pegar otra pieza",
    replacementTools: "Ver herramientas de reemplazo",
    nextLegalAction: "Siguiente paso",
    insidePoe2: "Dentro de PoE2:",
    whatCanHappen: "Qué puede ocurrir",
    otherLegalRoute: (label: string, difference: string) => `Otra opción: ${label}. ${difference}`,
    changeLimit: "Cambiar límite",
    overLimitAria: "No puedes confirmar este paso porque supera el límite declarado",
    confirmDoneAria: (label: string) => `Confirmar que ya hiciste este paso en PoE2: ${label}`,
    overLimit: "Fuera del límite declarado",
    doneInPoe2: "Ya lo hice en PoE2",
    dontSpendYet: "No gastar todavía",
    exploreAdvanced: "Explorar avanzadas",
    // Guía
    showMeItem: "Enséñame la pieza",
    pasteGameItem: "Pegar un objeto del juego",
    orPickOwned: "O elige una que ya tienes",
    mentorDefaultGoal: "decidir qué necesita esta pieza",
    mentorNoDirection: "objetivo sin determinar",
    mentorImproveFocus: (label: string) => `mejorar ${label}`,
    unknownGoal: "No sé qué necesita esta pieza",
    improveFocusGoal: (label: string) => `Quiero mejorar ${label}`,
    mainGoalNote: (label: string) => `Objetivo principal: ${label}.`,
    improveThisItemGoal: "Quiero mejorar esta pieza",
    incrementalNote: "Perfecto: ahora elige una sola mejora observable para esta pieza.",
    statusMismatch: "NO CUADRA",
    statusContinue: "PUEDES SEGUIR",
    statusStop: "PARA",
    statusReview: "REVISA",
    mismatchFallback: "Revisa el texto pegado antes de gastar otra moneda.",
    stepsLeft: (remaining: number) =>
      `${remaining === 1 ? "Queda 1 paso" : `Quedan ${remaining} pasos`} dentro del límite que elegiste.`,
    oneActionLeft: "Te queda un paso dentro del límite que elegiste.",
    attemptAtLimit: "Este intento ha llegado a su límite.",
    failsRequirements: "El objeto no cumple los requisitos de tu personaje.",
    goalPresentStop: "El objetivo aparece, pero tu límite dice que pares aquí.",
    goalNotEvaluable: "Falta concretar el objetivo antes de gastar otra moneda.",
    goalNotMet: "El resultado no cumple el objetivo actual.",
    srTitle: "Guía con tu objeto",
    workWithAnother: "Trabajar con otra pieza",
    pasteAnotherObject: "Pegar otro objeto",
    practiceError: (error: string) => `No pude preparar la pieza de práctica: ${error}`,
    goalQuestion: "¿Qué quieres conseguir con esta pieza?",
    goalIntro: "Escríbelo como se lo dirías a otro jugador. Yo lo convertiré en una sola decisión.",
    goalAria: "Qué quieres conseguir con esta pieza",
    goalPlaceholderWeapon: "p. ej. Quiero que esta arma haga más daño",
    goalPlaceholderArmour: "p. ej. Quiero más vida o resistencias en esta pieza",
    goalPlaceholderJewel: "p. ej. Quiero más resistencias en esta joya",
    tellNextStep: "Dime el siguiente paso",
    repairFirst: "Repara primero la lectura de la pieza.",
    pickExactGoal: "Elige un objetivo exacto.",
    quickOption: "O elige una forma rápida",
    moreDamage: "Más daño",
    hitHarder: "Pegar más fuerte",
    improveDamageGoal: "Quiero mejorar el daño",
    damageNote:
      "El daño puede ser físico, elemental, crítico o velocidad. Elige qué debe aportar el siguiente afijo.",
    moreDefence: "Más defensa",
    surviveMore: "Aguantar más",
    improveDefenceGoal: "Quiero mejorar la defensa",
    defenceNote:
      "La defensa puede ser vida, resistencias, armadura, evasión o escudo de energía. Elige una prioridad.",
    dontKnow: "No lo sé",
    hintPlan: "Lo miro en tu plan",
    hintCharacter: "Lo miro en tu personaje",
    hintMissing: "Te diré qué información falta",
    characterQuestionEyebrow: "Pregunta sobre tu personaje",
    characterQuestionTitle: "Eso no se arregla con esta pieza",
    characterQuestionBody:
      "Crafting solo mejora un objeto con monedas. Para saber por qué no haces daño o por qué te matan, el Mentor mira tu personaje entero: gemas, objetos y nivel.",
    askMentorThis: "Preguntárselo al Mentor",
    addCharacterFirst: "Añade tu personaje primero",
    detectedUnique: "Objetivo detectado · objeto único",
    detectedEndgame: "Objetivo detectado · proyecto endgame",
    dontSpendHereYet: "No gastes en esta pieza todavía",
    oneAffixNotEndgame: "Un afijo no define una pieza de endgame",
    goToPlanMarket: "Ir a Plan y mercado",
    endgameRareGoal: "Quiero crear una pieza rara de endgame",
    endgameRareNote:
      "Perfecto: una rara de endgame necesita el personaje, la pieza equipada, presupuesto y requisitos completos antes de elegir monedas.",
    craftEndgameRare: "Crear una rara de endgame",
    openLaboratory: "Abrir Taller avanzado",
    addCharacterGear: "Añadir personaje y equipo",
    reviewPlanMarket: "Revisar plan y mercado",
    onlyImproveItem: "Solo mejorar esta pieza",
    characterNeeds: "1. Lo que necesita tu personaje",
    beforeSpending: "Antes de gastar",
    doesItFit: "2. ¿Encaja esta pieza?",
    planFit: (name: string) =>
      `El plan marca una prioridad, pero no la vincula a ${name} ni demuestra que esta pieza pueda recibir ese modificador.`,
    characterFit: (name: string) =>
      `A tu personaje le falta algo, pero eso no demuestra que ${name} sea la pieza adecuada para cubrirlo.`,
    lookForFocus: (label: string) => `Buscar ${label} en esta pieza`,
    damageFocusNote: "Elige qué tipo de daño debe aportar el siguiente afijo.",
    defenceFocusNote: "Elige qué defensa debe aportar el siguiente afijo.",
    chooseDamage: "Elegir daño",
    chooseDefence: "Elegir defensa",
    damageType: "Tipo de daño",
    otherRoute: "Otra vía",
    changeItem: "Cambiar de pieza",
    goalLabel: "Objetivo ·",
    noDirection: "sin dirección",
    change: "Cambiar",
    characterLabel: "Personaje:",
    activeCharacter: "activo",
    planName: (name: string) => ` · plan ${name}`,
    noBudget: " · presupuesto sin declarar.",
    budgetLimit: (amount: number, currency: string) => ` · límite ${amount} ${currency}.`,
    noCharacterLabel: "Sin personaje cargado:",
    noCharacterBody: "me guío solo por tu objetivo, sin mirar tu build.",
    seeAnalysis: "Ver análisis",
    character: "Personaje",
    base: "Base",
    planHasPriority: (label: string) => `Esta prioridad aparece en tu plan: ${label}.`,
    planLacksPriority:
      "Esta prioridad no aparece entre los mods deseados del plan. Puedes trabajarla, pero no la trataré como objetivo de la build.",
    stopLabel: "Meta:",
    stopSummary: (focus: string, roll: string, steps: number): string =>
      `${focus}, ${roll}. Máximo ${steps} ${steps === 1 ? "paso" : "pasos"}.`,
    adjust: "Ajustar",
    minimumRoll: "Tirada mínima",
    rollAny: "Cualquiera",
    rollMiddle: "Media+",
    rollHigh: "Alta",
    maxSteps: "Máximo de pasos",
    tooltipRange: "Rango visible del tooltip; no es una probabilidad.",
    protectedLabel: "Protegido:",
    unresolvedProtections: (lines: string) =>
      `No encuentro en la pieza: ${lines}. No lo trataré como protegido hasta que coincida con una línea real.`,
    savedForLater: "Guardado para más tarde",
    itemUnchanged: "La pieza sigue como está. Puedes volver cuando quieras.",
    limitUsed: (limit: number) =>
      `Has agotado el límite de ${limit} ${limit === 1 ? "paso" : "pasos"}. Con ese límite ya no toca gastar otra moneda.`,
    seeActionAgain: "Ver otra vez la acción",
    otherPath: "Elegir otro camino",
    whatDidYouGet: "¿Qué te ha salido?",
    resultAria: "Texto del objeto después del craft",
    resultPlaceholder: "Pega aquí el objeto tal y como está ahora…",
    seeChanges: "Ver qué ha cambiado",
    notDoneYet: "Todavía no lo he hecho",
    readingResult: "Leyendo el resultado",
    result: "Resultado",
    reading: "LEYENDO",
    unconfirmedResult: "Resultado no confirmado",
    newModifier: "Modificador nuevo",
    fits: "Encaja",
    doesntFit: "No encaja",
    notConfirmed: "Sin confirmar",
    tierHidden: "Grado no visible",
    tier: (tier: number) => `Grado ${tier}`,
    rollMiddlePercent: (percent: number) => `Media · ${percent}%`,
    rollLow: "Baja",
    weaponTitleAttr: "Calculado únicamente desde las cifras visibles del tooltip",
    weaponPerformance: "Rendimiento del arma",
    physical: "Físico",
    elemental: "Elemental",
    total: "Total",
    sinceLastStep: (delta: number, percent: number | null) =>
      `Desde el paso anterior: ${delta > 0 ? "+" : ""}${delta} DPS visible total${percent === null ? "" : ` (${percent > 0 ? "+" : ""}${percent}%)`}.`,
    nothingLost: "Nada perdido",
    fitsGoal: "Encaja con el objetivo",
    doesntFitGoal: "No encaja con el objetivo",
    fitUnconfirmed: "Encaje sin confirmar",
    limitsDetail: "Límites y detalle",
    whatImComparing: "Qué estoy comparando",
    before: "Antes:",
    after: "Después:",
    explicitMods: "explícitos",
    countsAsNew: "Cuenta como nuevo:",
    noLongerSameLine: "Ya no reconoce como la misma línea:",
    seeNextAction: "Ver la siguiente acción",
    reviewPasted: "Revisar el texto pegado",
    thisIsMyItem: "Este es mi objeto actual",
    refineGoal: "Concretar objetivo",
    finishForNow: "Terminar por ahora",
    tryAnotherBase: "Probar otra base",
    rethinkGoal: "Replantear el objetivo",
  },
  {
    copyHint: "In PoE2, hover over the item and press Ctrl+Alt+C, then paste it here.",
    // Recommendation
    practiceTitle: "This is a practice item.",
    exampleTitle: "This item belongs to the example character.",
    practiceBody:
      "You can learn what the guide would suggest, but this item isn't in your account either. Don't spend currency or paste a real result.",
    exampleBody:
      "It's a simulation: it isn't in your account. Here I'll never ask you to spend currency or paste a real result.",
    backToMyItem: "Back to my item",
    tryAnotherPractice: "Try another practice item",
    openPractice: "Open a practice item",
    pasteMyOwn: "Paste my own item",
    changeGoal: "Change goal",
    tryPractice: "Try with a practice item",
    myAdvice: "My advice",
    why: "Why",
    technicalEvidence: "See details",
    viewInCharacter: "See the item in my character",
    pasteAnother: "Paste another item",
    replacementTools: "See replacement tools",
    nextLegalAction: "Next step",
    insidePoe2: "In PoE2:",
    whatCanHappen: "What can happen",
    otherLegalRoute: (label: string, difference: string) => `Another option: ${label}. ${difference}`,
    changeLimit: "Change limit",
    overLimitAria: "You can't confirm this step because it goes over your set limit",
    confirmDoneAria: (label: string) => `Confirm you already did this step in PoE2: ${label}`,
    overLimit: "Over your set limit",
    doneInPoe2: "I did it in PoE2",
    dontSpendYet: "Don't spend yet",
    exploreAdvanced: "Explore advanced options",
    // Guide
    showMeItem: "Show me the item",
    pasteGameItem: "Paste an item from the game",
    orPickOwned: "Or pick one you already have",
    mentorDefaultGoal: "work out what this item needs",
    mentorNoDirection: "goal not decided yet",
    mentorImproveFocus: (label: string) => `improve ${label}`,
    unknownGoal: "I don't know what this item needs",
    improveFocusGoal: (label: string) => `I want to improve ${label}`,
    mainGoalNote: (label: string) => `Main goal: ${label}.`,
    improveThisItemGoal: "I want to improve this item",
    incrementalNote: "Great: now pick one improvement you can see on this item.",
    statusMismatch: "DOESN'T MATCH",
    statusContinue: "YOU CAN GO ON",
    statusStop: "STOP",
    statusReview: "CHECK",
    mismatchFallback: "Check the pasted text before spending another orb.",
    stepsLeft: (remaining: number) =>
      `${remaining === 1 ? "1 step left" : `${remaining} steps left`} within the limit you chose.`,
    oneActionLeft: "You have one step left within the limit you chose.",
    attemptAtLimit: "This attempt has reached its limit.",
    failsRequirements: "Your character doesn't meet this item's requirements.",
    goalPresentStop: "The goal is there, but your stop rule says to stop here.",
    goalNotEvaluable: "Pin down the goal before spending another orb.",
    goalNotMet: "The result doesn't meet the current goal.",
    srTitle: "Guide for your item",
    workWithAnother: "Work on another item",
    pasteAnotherObject: "Paste another item",
    practiceError: (error: string) => `I couldn't set up the practice item: ${error}`,
    goalQuestion: "What do you want from this item?",
    goalIntro: "Write it the way you'd tell another player. I'll turn it into one decision.",
    goalAria: "What you want from this item",
    goalPlaceholderWeapon: "e.g. I want this weapon to deal more damage",
    goalPlaceholderArmour: "e.g. I want more life or resistances on this item",
    goalPlaceholderJewel: "e.g. I want more resistances on this jewellery",
    tellNextStep: "Tell me the next step",
    repairFirst: "Fix the item reading first.",
    pickExactGoal: "Pick an exact goal.",
    quickOption: "Or pick a quick option",
    moreDamage: "More damage",
    hitHarder: "Hit harder",
    improveDamageGoal: "I want to improve damage",
    damageNote:
      "Damage can be physical, elemental, critical or speed. Pick what the next modifier should add.",
    moreDefence: "More defence",
    surviveMore: "Survive more",
    improveDefenceGoal: "I want to improve defence",
    defenceNote:
      "Defence can be life, resistances, armour, evasion or energy shield. Pick one priority.",
    dontKnow: "I don't know",
    hintPlan: "I'll check your plan",
    hintCharacter: "I'll check your character",
    hintMissing: "I'll tell you what info is missing",
    characterQuestionEyebrow: "A question about your character",
    characterQuestionTitle: "This item won't fix that",
    characterQuestionBody:
      "Crafting only improves one item with orbs. To find out why you lack damage or keep dying, the Mentor looks at your whole character: gems, items and level.",
    askMentorThis: "Ask the Mentor",
    addCharacterFirst: "Add your character first",
    detectedUnique: "Goal detected · unique item",
    detectedEndgame: "Goal detected · endgame project",
    dontSpendHereYet: "Don't spend on this item yet",
    oneAffixNotEndgame: "One modifier doesn't make an endgame item",
    goToPlanMarket: "Go to Plan & market",
    endgameRareGoal: "I want to craft an endgame rare item",
    endgameRareNote:
      "Great: an endgame rare needs your character, the equipped item, a budget and full requirements before you pick any orbs.",
    craftEndgameRare: "Craft an endgame rare",
    openLaboratory: "Open the Advanced workshop",
    addCharacterGear: "Add character and gear",
    reviewPlanMarket: "Review Plan & market",
    onlyImproveItem: "Just improve this item",
    characterNeeds: "1. What your character needs",
    beforeSpending: "Before spending",
    doesItFit: "2. Does this item fit?",
    planFit: (name: string) =>
      `Your plan sets a priority, but doesn't tie it to ${name} or show that this item can roll that modifier.`,
    characterFit: (name: string) =>
      `Your character shows a gap, not that ${name} is the right item to fill it.`,
    lookForFocus: (label: string) => `Look for ${label} on this item`,
    damageFocusNote: "Pick which type of damage the next modifier should add.",
    defenceFocusNote: "Pick which defence the next modifier should add.",
    chooseDamage: "Choose damage",
    chooseDefence: "Choose defence",
    damageType: "Damage type",
    otherRoute: "Other route",
    changeItem: "Change item",
    goalLabel: "Goal ·",
    noDirection: "no direction",
    change: "Change",
    characterLabel: "Character:",
    activeCharacter: "character loaded",
    planName: (name: string) => ` · plan ${name}`,
    noBudget: " · no budget set.",
    budgetLimit: (amount: number, currency: string) => ` · limit ${amount} ${currency}.`,
    noCharacterLabel: "No character loaded:",
    noCharacterBody: "I'll use your goal without checking it against a build.",
    seeAnalysis: "See analysis",
    character: "Character",
    base: "Base",
    planHasPriority: (label: string) => `This priority is in your plan: ${label}.`,
    planLacksPriority:
      "This priority isn't among your plan's wanted modifiers. You can work on it, but I won't treat it as a build goal.",
    stopLabel: "Target:",
    stopSummary: (focus: string, roll: string, steps: number) =>
      `${focus}, ${roll}. At most ${steps} ${steps === 1 ? "step" : "steps"}.`,
    adjust: "Adjust",
    minimumRoll: "Minimum roll",
    rollAny: "Any",
    rollMiddle: "Mid+",
    rollHigh: "High",
    maxSteps: "Max steps",
    tooltipRange: "The range shown in the tooltip; it's not a chance.",
    protectedLabel: "Protected:",
    unresolvedProtections: (lines: string) =>
      `I can't find this on the item: ${lines}. I won't treat it as protected until it matches a real line.`,
    savedForLater: "Saved for later",
    itemUnchanged: "The item stays as it is. Come back whenever you like.",
    limitUsed: (limit: number) =>
      `You've used up your limit of ${limit} ${limit === 1 ? "step" : "steps"}. With that limit, it's not time to spend another orb.`,
    seeActionAgain: "See the action again",
    otherPath: "Choose another path",
    whatDidYouGet: "What did you get?",
    resultAria: "Item text after the craft",
    resultPlaceholder: "Paste the item here as it is now…",
    seeChanges: "See what changed",
    notDoneYet: "I haven't done it yet",
    readingResult: "Reading the result",
    result: "Result",
    reading: "READING",
    unconfirmedResult: "Result not confirmed",
    newModifier: "New modifier",
    fits: "Fits",
    doesntFit: "Doesn't fit",
    notConfirmed: "Not confirmed",
    tierHidden: "Tier not shown",
    tier: (tier: number) => `Tier ${tier}`,
    rollMiddlePercent: (percent: number) => `Mid · ${percent}%`,
    rollLow: "Low",
    weaponTitleAttr: "Worked out only from the numbers shown in the tooltip",
    weaponPerformance: "Weapon performance",
    physical: "Physical",
    elemental: "Elemental",
    total: "Total",
    sinceLastStep: (delta: number, percent: number | null) =>
      `Since the last step: ${delta > 0 ? "+" : ""}${delta} total visible DPS${percent === null ? "" : ` (${percent > 0 ? "+" : ""}${percent}%)`}.`,
    nothingLost: "Nothing lost",
    fitsGoal: "Fits the goal",
    doesntFitGoal: "Doesn't fit the goal",
    fitUnconfirmed: "Fit not confirmed",
    limitsDetail: "Limits and details",
    whatImComparing: "What I'm comparing",
    before: "Before:",
    after: "After:",
    explicitMods: "explicit mods",
    countsAsNew: "Counts as new:",
    noLongerSameLine: "No longer read as the same line:",
    seeNextAction: "See the next action",
    reviewPasted: "Check the pasted text",
    thisIsMyItem: "This is my current item",
    refineGoal: "Pin down the goal",
    finishForNow: "Stop for now",
    tryAnotherBase: "Try another base",
    rethinkGoal: "Rethink the goal",
  },
);

function CoachItemChoice({ item }: { item: Item }) {
  const labels = useFormatLabels();
  const rarity = rarityStyle(item.rarity);
  return (
    <>
      <ItemArtwork item={item} className={cn("size-9 rounded-sm border", rarity.border)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">{item.name}</span>
        <span className={cn("block truncate text-xs", rarity.text)}>
          {item.baseType} · {labels.rarity[item.rarity]}
        </span>
      </span>
    </>
  );
}

interface PendingCraftAttempt {
  /** Fotografía exacta tomada antes de que el jugador gaste la moneda. */
  before: Item;
  /** La acción también se congela: no se recalcula desde una pieza que ya cambió. */
  actionId: CraftingComparisonActionId;
  /** Contrato congelado antes de gastar. */
  rollMinimum: CoachRollMinimum;
  attemptNumber: number;
  attemptLimit: number;
}

function snapshotItem(item: Item): Item {
  return {
    ...item,
    modifiers: item.modifiers.map((modifier) => ({
      ...modifier,
      values: [...modifier.values],
      ...(modifier.tags ? { tags: [...modifier.tags] } : {}),
    })),
    ...(item.requirements ? { requirements: { ...item.requirements } } : {}),
    ...(item.weaponStats
      ? {
          weaponStats: {
            ...item.weaponStats,
            ...(item.weaponStats.physical ? { physical: { ...item.weaponStats.physical } } : {}),
            ...(item.weaponStats.fire ? { fire: { ...item.weaponStats.fire } } : {}),
            ...(item.weaponStats.cold ? { cold: { ...item.weaponStats.cold } } : {}),
            ...(item.weaponStats.lightning ? { lightning: { ...item.weaponStats.lightning } } : {}),
            ...(item.weaponStats.chaos ? { chaos: { ...item.weaponStats.chaos } } : {}),
          },
        }
      : {}),
    ...(item.craftingState ? { craftingState: { ...item.craftingState } } : {}),
    sources: item.sources.map((source) => ({ ...source })),
  };
}

interface CraftingCoachProps {
  /** Único origen de evidencia sobre el personaje. `null` = todavía no hay. */
  profile: CharacterProfile | null;
  patch: string;
  budget: Budget | null;
  goal: GoalKind;
  /** Plan declarado por el jugador; es referencia, nunca una verdad de la build. */
  target?: BuildTarget;
  items: readonly Item[];
  selectedItem: Item | null;
  onSelectItem: (itemId: string) => void;
  /** Abre el pegado de objeto ya existente; el guía no duplica el formulario. */
  onPasteItem: () => void;
  /** Despliega las herramientas técnicas sin abandonar Ayuda en vivo. */
  onOpenAdvanced: () => void;
  /**
   * Abre el Taller avanzado. Si el jugador ya explicó su objetivo, lo entrega
   * como borrador para no obligarle a escribirlo otra vez.
   */
  onOpenLaboratory: (draftObjective?: string) => void;
  /** Abre el expediente completo cuando falta contexto del personaje. */
  onOpenCharacter: () => void;
  /** Abre en el expediente el detalle de la pieza que el guía pide comparar. */
  onOpenEquipmentItem: (itemId: string) => void;
  /** Lleva a búsqueda y comparación cuando el objetivo real es un único. */
  onOpenPlanMarket: () => void;
  /** El banco abierto ya muestra este mismo aviso junto a los controles bloqueados. */
  showInitialRepairBanner?: boolean;
  onMentorContext?: (event: ContextualMentorEvent) => void;
  /**
   * Lleva una pregunta sobre el personaje («¿por qué no hago daño?») al
   * Mentor. Sin personaje no existe: entonces se ofrece crearlo.
   */
  onAskMentor?: (question: string) => void;
  /** «Compararla con otra»: lleva la pieza a la comparación de Guías. */
  onCompareItem?: (item: Item) => void;
  /** «Ver mis resistencias»: abre la comprobación del personaje. */
  onCheckResistances?: () => void;
}

const DAMAGE_TYPE_FOCUSES = DAMAGE_COACH_FOCUSES.slice(0, 5);
const DAMAGE_OTHER_FOCUSES = DAMAGE_COACH_FOCUSES.slice(5);

/**
 * Pieza observada durante las pruebas manuales del cliente en español.
 *
 * No representa un objeto ideal ni una receta recomendada: solo permite
 * recorrer el guía con prefijos y sufijos que el importador sí puede demostrar.
 * Se analiza por la misma API que cualquier pegado del jugador y nunca se
 * guarda en su expediente.
 */
const PRACTICE_ITEM_TEXT = [
  "Clase de objeto: Mazas a una mano",
  "Rareza: Mágico",
  "Maza de procesión  de victoria",
  "------------------------------",
  "Daño físico: 33-69",
  "Probabilidad de impacto crítico: 5.00%",
  "Ataques por segundo: 1.40",
  "-------------------------",
  "## Requiere: Nivel 54, 96 (unmet) Fue",
  "## Nivel de objeto: 64",
  '{ Mod. de prefijo "" (Grado: 4) — Ataque }',
  "+233(168-236) a la precisión",
  '{ Mod. de sufijo "de victoria" (Grado: 7) — Vida }',
  "Ganas 8(7-9) de vida por cada enemigo asesinado",
].join("\n");

/** La misma pieza tal como la copia el juego en inglés (Marching Mace). */
const PRACTICE_ITEM_TEXT_EN = [
  "Item Class: One Hand Maces",
  "Rarity: Magic",
  "Marching Mace of Victory",
  "--------",
  "Physical Damage: 33-69",
  "Critical Hit Chance: 5.00%",
  "Attacks per Second: 1.40",
  "--------",
  "Requires: Level 54, 96 (unmet) Str",
  "--------",
  "Item Level: 64",
  "--------",
  '{ Prefix Modifier "" (Tier: 4) — Attack }',
  "+233(168-236) to Accuracy Rating",
  '{ Suffix Modifier "of Victory" (Tier: 7) — Life }',
  "Gain 8(7-9) Life per Enemy Killed",
].join("\n");

function DirectionButton({
  id,
  label,
  hint,
  icon: Icon,
  disabled,
  onChoose,
}: {
  id: string;
  label: string;
  hint: string;
  icon: typeof Swords;
  disabled?: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      data-testid={`coach-direccion-${id}`}
      className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border bg-muted/10 px-3 py-2.5 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-px hover:border-primary/50 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:bg-muted/10 motion-reduce:transition-none"
    >
      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function Recommendation({
  step,
  simulationMode,
  onDone,
  onHold,
  onOther,
  onReturnToItem,
  onReviewInExpediente,
  onRepaste,
  onPractice,
  practiceLoading,
  onOpenAdvanced,
  budgetAssessment,
  onOpenPlanMarket,
  item,
  patch,
  headingRef,
}: {
  step: CoachNextStep;
  simulationMode: "example" | "practice" | null;
  onDone: () => void;
  onHold: () => void;
  onOther: () => void;
  onReturnToItem: () => void;
  onReviewInExpediente: (() => void) | null;
  onRepaste: () => void;
  onPractice: () => void;
  practiceLoading: boolean;
  onOpenAdvanced: () => void;
  budgetAssessment: CraftingBudgetAssessment | null;
  onOpenPlanMarket: () => void;
  item: Item;
  patch: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const t = useText(TEXT);
  if (simulationMode !== null) {
    const practice = simulationMode === "practice";
    return (
      <div
        className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)]"
        data-testid="coach-recomendacion"
        data-kind={simulationMode}
      >
        <section
          className="rounded-md border border-cyan-500/35 bg-cyan-500/[0.07] p-3 text-cyan-50"
          data-testid={practice ? "coach-practice-summary" : "coach-example-summary"}
          role="status"
        >
          <p className="text-sm font-semibold">
            {practice ? t.practiceTitle : t.exampleTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">
            {practice ? t.practiceBody : t.exampleBody}
          </p>
        </section>
        <div className="mt-3 flex flex-wrap gap-2">
          {practice && (
            <Button type="button" onClick={onReturnToItem} data-testid="coach-practice-return">
              {t.backToMyItem}
            </Button>
          )}
          <Button type="button" onClick={onPractice} disabled={practiceLoading} data-testid="coach-probar-practica">
            {practiceLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
            {practice ? t.tryAnotherPractice : t.openPractice}
          </Button>
          <Button type="button" variant="outline" onClick={onRepaste}>
            <ClipboardPaste className="size-4" aria-hidden="true" />
            {t.pasteMyOwn}
          </Button>
          {!practice && (
            <Button type="button" variant="ghost" onClick={onOther} data-testid="coach-otro-camino">
              {t.changeGoal}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (step.kind === "needs-data") {
    return (
      <div
        className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)]"
        data-testid="coach-recomendacion"
        data-kind="needs-data"
      >
        {/* Visible, no `sr-only`: con la lectura bloqueada este es el ÚNICO
            titular del bloque, y además es el destino del foco. */}
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 text-base font-semibold text-foreground outline-none"
        >
          {step.headline}
        </h3>
        <CraftingRepairBanner
          onRepaste={onRepaste}
          reason={step.missingEvidence[0] ?? step.why}
          item={item}
          patch={patch}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOther} data-testid="coach-otro-camino">
            {t.changeGoal}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onPractice}
            disabled={practiceLoading}
            data-testid="coach-probar-practica"
          >
            {practiceLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {t.tryPractice}
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "stop") {
    return (
      <div
        className="superficie-accion min-w-0 scroll-mb-[var(--mentor-inset,6rem)] p-4"
        data-testid="coach-recomendacion"
        data-kind="stop"
      >
        <p className="text-xs font-semibold text-primary/80">
          {t.myAdvice}
        </p>
        <h3 ref={headingRef} tabIndex={-1} className="dossier-title mt-1 text-xl font-semibold outline-none">
          {step.headline}
        </h3>
        <p className="mt-2 text-sm leading-relaxed">{step.instruction}</p>
        <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
          <summary className="cursor-pointer font-medium">{t.why}</summary>
          <p className="mt-2 text-muted-foreground">{step.why}</p>
        </details>
        <details className="mt-2 rounded border border-current/20 px-2.5 py-2 text-xs">
          <summary className="cursor-pointer font-medium">{t.technicalEvidence}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            {step.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          {onReviewInExpediente !== null && (
            <Button
              type="button"
              onClick={onReviewInExpediente}
              data-testid="coach-revisar-expediente"
            >
              {t.viewInCharacter}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onOther} data-testid="coach-otro-camino">
            {t.changeGoal}
          </Button>
          <Button type="button" variant="ghost" onClick={onRepaste} data-testid="coach-otra-pieza">
            <ClipboardPaste className="size-4" aria-hidden="true" />
            {t.pasteAnother}
          </Button>
          {step.needsAdvancedTools && (
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={onOpenAdvanced}
              data-testid="coach-ir-avanzado"
            >
              {t.replacementTools}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="superficie-accion min-w-0 scroll-mb-[var(--mentor-inset,6rem)] p-4"
      data-testid="coach-recomendacion"
      data-kind="use-currency"
      data-action={step.actionId}
    >
      <p className="text-xs font-semibold text-primary/80">
        {t.nextLegalAction}
      </p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="dossier-title mt-1 flex items-center gap-2 text-xl font-semibold outline-none sm:text-2xl"
      >
        <Sparkles className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {step.label}
      </h3>
      <p
        className="mt-2 scroll-mb-[var(--mentor-inset,6rem)] text-sm leading-relaxed"
        data-testid="coach-instruccion"
      >
        <strong>{t.insidePoe2}</strong> {step.instruction}
      </p>

      {/* Aleatoriedad y límite de dirección: SIEMPRE a la vista, nunca plegados. */}
      <p
        className="mt-3 flex items-start gap-2 rounded border border-border/70 bg-background/50 px-2.5 py-2 text-xs leading-relaxed"
        data-testid="coach-aleatoriedad"
        data-steering={step.steering}
        data-goal-fit={step.goalFit}
      >
        <Dices className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          {step.randomnessNotice}
          {step.directionNotice !== null && ` ${step.directionNotice}`}
        </span>
      </p>

      {step.warning !== null && (
        <p
          className="mt-3 flex items-start gap-2 rounded border border-amber-500/45 bg-amber-500/[0.09] px-2.5 py-2 text-xs leading-relaxed text-amber-100"
          data-testid="coach-aviso"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>{step.warning}</span>
        </p>
      )}

      <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
        <summary className="cursor-pointer font-medium">{t.whatCanHappen}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>{step.why}</li>
          {step.whatCanHappen.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <details className="mt-2 rounded border border-current/20 px-2.5 py-2 text-xs">
        <summary className="cursor-pointer font-medium">{t.technicalEvidence}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {step.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {step.alternatives.map((alternative) => (
            <li key={alternative.actionId}>
              {t.otherLegalRoute(alternative.label, alternative.difference)}
            </li>
          ))}
        </ul>
      </details>

      {budgetAssessment && (
        <section
          className={`mt-3 rounded border px-2.5 py-2 text-xs leading-relaxed ${
            budgetAssessment.status === "within-budget"
              ? "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-50"
              : budgetAssessment.status === "over-budget"
                ? "border-rose-500/45 bg-rose-500/[0.09] text-rose-50"
                : "border-amber-500/40 bg-amber-500/[0.07] text-amber-50"
          }`}
          data-testid="coach-presupuesto"
          data-status={budgetAssessment.status}
          role={budgetAssessment.blocksAction ? "alert" : "status"}
        >
          <strong className="block">{budgetAssessment.title}</strong>
          <p className="mt-1 opacity-85">{budgetAssessment.detail}</p>
          {budgetAssessment.blocksAction && (
            <Button
              className="mt-2"
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenPlanMarket}
              data-testid="coach-presupuesto-cambiar"
            >
              {t.changeLimit}
            </Button>
          )}
        </section>
      )}

      <div
        className="mt-4 flex flex-wrap gap-2 scroll-mb-[var(--mentor-inset,6rem)]"
        data-testid="coach-acciones"
      >
        <Button
          type="button"
          onClick={onDone}
          disabled={budgetAssessment?.blocksAction === true}
          data-testid="coach-lo-hare"
          aria-label={
            budgetAssessment?.blocksAction
              ? t.overLimitAria
              : t.confirmDoneAria(step.label)
          }
        >
          {budgetAssessment?.blocksAction ? t.overLimit : t.doneInPoe2}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" onClick={onHold} data-testid="coach-no-gastar">
          {t.dontSpendYet}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={onOpenAdvanced}
          data-testid="coach-explorar-avanzado"
        >
          {t.exploreAdvanced}
        </Button>
      </div>
    </div>
  );
}

/**
 * «Ayúdame con mi objeto»: una pieza real, una decisión cada vez.
 *
 * Toda la lógica vive en `shared/craftingCoach.ts`; aquí solo hay presentación
 * y el pegado del resultado. Nunca ejecuta nada dentro del juego.
 */
export function CraftingCoach({
  profile,
  patch,
  budget,
  goal,
  target,
  items,
  selectedItem,
  onSelectItem,
  onPasteItem,
  onOpenAdvanced,
  onOpenLaboratory,
  onOpenCharacter,
  onOpenEquipmentItem,
  onOpenPlanMarket,
  showInitialRepairBanner = true,
  onMentorContext,
  onAskMentor,
  onCompareItem,
  onCheckResistances,
}: CraftingCoachProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const labels = useFormatLabels();
  const selectedItemSimulationMode = selectedItem && isCraftingExampleItem(selectedItem)
    ? "example" as const
    : null;
  const [initialProgress] = useState(() => {
    if (!selectedItem) return null;
    const identity = {
      profileId: profile?.id ?? null,
      itemId: selectedItem.id,
      baseType: selectedItem.baseType,
    };
    const restored = loadCraftingCoachProgress(identity) ?? emptyCraftingCoachProgress(identity);
    return protectSimulatedCraftingProgress(restored, selectedItemSimulationMode);
  });
  const [direction, setDirection] = useState<CoachDirection | null>(initialProgress?.direction ?? null);
  const [focus, setFocus] = useState<CoachFocus | null>(initialProgress?.focus ?? null);
  const [goalText, setGoalText] = useState(initialProgress?.goalText ?? "");
  /** Pregunta sobre el personaje detectada al pulsar; no se guarda en el progreso. */
  const [characterQuestion, setCharacterQuestion] = useState<string | null>(null);
  const [goalIntent, setGoalIntent] = useState<CoachGoalIntent>(initialProgress?.goalIntent ?? "incremental");
  const [goalSource, setGoalSource] = useState<CoachGoalSource>(initialProgress?.goalSource ?? "player");
  const [directionChosen, setDirectionChosen] = useState(initialProgress?.directionChosen ?? false);
  const [directionNote, setDirectionNote] = useState<string | null>(initialProgress?.directionNote ?? null);
  const [protectedModifiers, setProtectedModifiers] = useState<
    CoachGoalInterpretation["protectedModifiers"]
  >(initialProgress?.protectedModifiers ?? []);
  const [unresolvedProtections, setUnresolvedProtections] = useState<string[]>(initialProgress?.unresolvedProtections ?? []);
  const [rollMinimum, setRollMinimum] = useState<CoachRollMinimum>(initialProgress?.rollMinimum ?? "middle");
  const [attemptLimit, setAttemptLimit] = useState<1 | 2 | 3>(initialProgress?.attemptLimit ?? 1);
  const [confirmedAttemptCount, setConfirmedAttemptCount] = useState(initialProgress?.confirmedAttemptCount ?? 0);
  /** El jugador pidió que decidiera yo y no hay evidencia con la que hacerlo. */
  const [noEvidence, setNoEvidence] = useState(initialProgress?.noEvidence ?? false);
  const [phase, setPhase] = useState<CoachPhase>(
    initialProgress?.phase ?? (initialProgress?.directionChosen ? "recommend" : "choose"),
  );
  const [resultText, setResultText] = useState(initialProgress?.resultText ?? "");
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CraftingComparison | null>(() => {
    if (
      initialProgress?.phase !== "result" ||
      initialProgress.pendingAttempt === null ||
      initialProgress.resultItem === null
    ) {
      return null;
    }
    return requireCompleteCraftingResult(
      initialProgress.resultItem,
      compareCraftingResult(
        initialProgress.pendingAttempt.before,
        initialProgress.resultItem,
        initialProgress.pendingAttempt.actionId,
        {
          protectedModifierIds: initialProgress.protectedModifiers.map(
            (modifier) => modifier.id,
          ),
        },
        lang,
      ),
      lang,
    );
  });
  const [resultItem, setResultItem] = useState<Item | null>(
    initialProgress?.phase === "result" ? initialProgress.resultItem : null,
  );
  const [practiceActive, setPracticeActive] = useState(
    initialProgress?.simulationMode === "practice",
  );
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  /**
   * Pieza sobre la que razona el guía. Empieza siendo la del expediente y, tras
   * confirmar un resultado, pasa a ser el objeto que el jugador acaba de pegar.
   * No escribe en el expediente: eso sigue siendo decisión del banco.
   */
  const [workingItem, setWorkingItem] = useState<Item | null>(() => {
    if (initialProgress?.workingItem) return snapshotItem(initialProgress.workingItem);
    return initialProgress?.phase === "result" &&
      initialProgress.resultItem !== null &&
      comparison?.status === "confirmed"
      ? snapshotItem(initialProgress.resultItem)
      : null;
  });
  /**
   * Snapshot inmutable del paso en curso. Mientras existe, ni un cambio de
   * selección ni un rerender puede sustituir el «antes» que se compara.
   */
  const [pendingAttempt, setPendingAttempt] = useState<PendingCraftAttempt | null>(
    initialProgress?.pendingAttempt ?? null,
  );

  const recommendationRef = useRef<HTMLHeadingElement>(null);
  const resultTextRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedItem) return;
    const identity = {
      profileId: profile?.id ?? null,
      itemId: selectedItem.id,
      baseType: selectedItem.baseType,
    };
    const hasContract =
      goalText.trim() !== "" ||
      directionChosen ||
      noEvidence ||
      protectedModifiers.length > 0 ||
      unresolvedProtections.length > 0;
    if (!hasContract) {
      discardCraftingCoachProgress(identity);
      return;
    }
    saveCraftingCoachProgress({
      schemaVersion: 1,
      contentVersion: CRAFTING_COACH_PROGRESS_VERSION,
      identity,
      direction,
      focus,
      goalText,
      goalIntent,
      goalSource,
      directionChosen,
      directionNote,
      protectedModifiers,
      unresolvedProtections,
      rollMinimum,
      attemptLimit,
      confirmedAttemptCount,
      noEvidence,
      simulationMode: practiceActive ? "practice" : selectedItemSimulationMode,
      phase:
        phase === "result" && pendingAttempt !== null && resultItem !== null
          ? "result"
          : phase === "await-result" && pendingAttempt !== null
          ? "await-result"
          : phase === "hold"
            ? "hold"
            : directionChosen
              ? "recommend"
              : "choose",
      pendingAttempt:
        (phase === "await-result" || phase === "result") && pendingAttempt !== null
          ? pendingAttempt
          : null,
      workingItem,
      resultItem: phase === "result" ? resultItem : null,
      resultText:
        phase === "await-result" || phase === "result" ? resultText : "",
    });
  }, [
    attemptLimit,
    confirmedAttemptCount,
    direction,
    directionChosen,
    directionNote,
    focus,
    goalIntent,
    goalSource,
    goalText,
    noEvidence,
    pendingAttempt,
    phase,
    practiceActive,
    protectedModifiers,
    resultItem,
    resultText,
    rollMinimum,
    profile?.id,
    selectedItem,
    selectedItemSimulationMode,
    unresolvedProtections,
    workingItem,
  ]);

  /**
   * Sincronización de foco con el DOM (no de estado): cada fase lleva el foco a
   * lo que el jugador tiene que leer o rellenar ahora, y lo desplaza a la vista
   * respetando `scroll-margin-bottom`, que reserva la altura real del mentor.
   * Así lo que acaba de aparecer nunca queda debajo del panel flotante.
   */
  useEffect(() => {
    const target =
      phase === "recommend"
        ? recommendationRef.current
        : phase === "await-result"
          ? resultTextRef.current
          : phase === "result"
            ? resultRef.current
            : phase === "hold"
              ? holdRef.current
              : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [phase]);

  const resetFlow = () => {
    if (selectedItem) {
      discardCraftingCoachProgress({
        profileId: profile?.id ?? null,
        itemId: selectedItem.id,
        baseType: selectedItem.baseType,
      });
    }
    setDirection(null);
    setFocus(null);
    setGoalText("");
    setGoalIntent("incremental");
    setGoalSource("player");
    setDirectionChosen(false);
    setDirectionNote(null);
    setProtectedModifiers([]);
    setUnresolvedProtections([]);
    setRollMinimum("middle");
    setAttemptLimit(1);
    setConfirmedAttemptCount(0);
    setNoEvidence(false);
    setPhase("choose");
    setResultText("");
    setComparison(null);
    setResultItem(null);
    setPendingAttempt(null);
    setError(null);
  };

  const chooseDifferentItem = (itemId: string) => {
    setWorkingItem(null);
    setPracticeActive(false);
    setPracticeError(null);
    resetFlow();
    onSelectItem(itemId);
  };

  // --- Sin pieza --------------------------------------------------------
  if (!selectedItem) {
    return (
      <section
        className="superficie-panel min-w-0 p-4 sm:p-6"
        data-testid="crafting-coach"
        data-phase="empty"
        aria-labelledby="coach-vacio-titulo"
      >
        <h2 id="coach-vacio-titulo" className="dossier-title text-2xl font-semibold">
          {t.showMeItem}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {t.copyHint}
        </p>
        <Button className="mt-4" type="button" onClick={onPasteItem} data-testid="coach-pegar-objeto">
          <ClipboardPaste className="size-4" aria-hidden="true" />
          {t.pasteGameItem}
        </Button>

        {items.length > 0 && (
          <div className="mt-6" data-testid="coach-piezas-importadas">
            <h3 className="text-sm font-semibold">{t.orPickOwned}</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`coach-elegir-${item.id}`}
                    onClick={() => onSelectItem(item.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-muted/10 px-3 py-2 text-left text-sm transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <CoachItemChoice item={item} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // Si el jugador cambia de pieza en el expediente, el guía vuelve a ella.
  const activeItem =
    workingItem !== null && workingItem.id === selectedItem.id ? workingItem : selectedItem;
  const activeDiagnosis = diagnoseCraftingItem(activeItem, lang);
  const focusLabel = (value: CoachFocus) =>
    (lang === "en" ? COACH_FOCUS_LABELS_EN : COACH_FOCUS_LABELS)[value];
  const activeNeedsRepair = activeDiagnosis.state !== "complete";
  const activeIsExampleSummary = isCraftingExampleItem(activeItem);
  const simulationMode = practiceActive
    ? "practice" as const
    : activeIsExampleSummary
      ? "example" as const
      : null;
  const structuralStep = chooseNextStep(activeItem, direction, lang);
  const baseAssessment = assessPurposefulCraftBase({
    item: activeItem,
    direction,
    focus,
    profile,
    rollMinimum,
    goalIntent,
    goalSource,
  }, lang);
  const step = directionChosen && focus !== null
    ? baseAssessment.nextStep
    : structuralStep;
  const budgetAssessment = step.kind === "use-currency" && budget !== null
    ? assessCraftingBudget({
        budget,
        actionId: step.actionId,
        plannedAttempts: Math.max(1, attemptLimit - confirmedAttemptCount),
      }, lang)
    : null;

  const loadPracticeItem = async () => {
    setPracticeLoading(true);
    setPracticeError(null);
    try {
      const imported = await api.importItemText({
        text: lang === "en" ? PRACTICE_ITEM_TEXT_EN : PRACTICE_ITEM_TEXT,
        patch,
      });
      setWorkingItem({
        ...imported.item,
        // El id enlaza el snapshot temporal con el flujo que ya está abierto;
        // la pieza no se escribe ni sustituye nada en el expediente.
        id: selectedItem.id,
      });
      setPracticeActive(true);
      setPendingAttempt(null);
      setComparison(null);
      setResultItem(null);
      setResultText("");
      setPhase("recommend");
      onMentorContext?.({
        type: "craftingCoachExample",
        itemName: imported.item.name || imported.item.baseType,
        origin: "practice",
      });
    } catch (err) {
      setPracticeError(getErrorMessage(err));
    } finally {
      setPracticeLoading(false);
    }
  };

  const returnToMyItem = () => {
    setWorkingItem(null);
    setPracticeActive(false);
    setPracticeError(null);
    resetFlow();
  };

  const chooseDirection = (
    next: CoachDirection,
    nextFocus: CoachFocus,
    note: string | null,
    playerGoal = goalText.trim(),
    protections = protectedModifiers,
    unresolved = unresolvedProtections,
    nextGoalIntent: CoachGoalIntent = "incremental",
    nextGoalSource: CoachGoalSource = goalSource,
  ) => {
    const nextAssessment = assessPurposefulCraftBase({
      item: activeItem,
      direction: next,
      focus: nextFocus,
      profile,
      rollMinimum,
      goalIntent: nextGoalIntent,
      goalSource: nextGoalSource,
    }, lang);
    const nextStep = nextAssessment.nextStep;
    const nextBudgetAssessment = nextStep.kind === "use-currency" && budget !== null
      ? assessCraftingBudget({
          budget,
          actionId: nextStep.actionId,
          plannedAttempts: attemptLimit,
        }, lang)
      : null;
    setDirection(next);
    setFocus(nextFocus);
    setGoalIntent(nextGoalIntent);
    setGoalSource(nextGoalSource);
    setDirectionNote(note);
    setProtectedModifiers(protections);
    setUnresolvedProtections(unresolved);
    setNoEvidence(false);
    setDirectionChosen(true);
    setPhase("recommend");
    if (simulationMode !== null) {
      onMentorContext?.({
        type: "craftingCoachExample",
        itemName: activeItem.name || activeItem.baseType,
        origin: simulationMode,
      });
      return;
    }
    onMentorContext?.({
      type: "craftingCoachDirection",
      itemName: activeItem.name || activeItem.baseType,
      playerGoal: playerGoal || t.mentorDefaultGoal,
      directionLabel: next === null ? t.mentorNoDirection : COACH_DIRECTION_LABELS[next],
      direction: next,
      nextStepTitle: nextStep.kind === "use-currency" ? nextStep.label : nextStep.headline,
      stepKind: nextStep.kind,
      focus: nextFocus,
      rollMinimum,
      rollMinimumLabel: COACH_ROLL_MINIMUM_LABELS[rollMinimum],
      attemptLimit,
      nextAction: nextStep.kind === "use-currency" ? nextStep.actionId : null,
      protectedLineCount: protections.length,
      unresolvedProtectionCount: unresolved.length,
      baseStatus: nextAssessment.status,
      baseVerdictTitle: nextAssessment.title,
      baseVerdictSummary: nextAssessment.summary,
      budgetStatus: nextBudgetAssessment?.status ?? null,
      budgetSummary: nextBudgetAssessment?.detail ?? null,
    });
  };

  // La sugerencia solo usa el plan declarado y carencias medibles del
  // expediente. Nunca deduce lo que falta mirando los mods de esta pieza.
  const contextSuggestion = suggestCraftingFocusFromContext(profile, target, lang);
  // Vale en los dos idiomas: el progreso guardado conserva el texto con el que se eligió.
  const usingContextSuggestion = goalText === TEXT.es.unknownGoal || goalText === TEXT.en.unknownGoal;
  const targetFocuses =
    contextSuggestion.source === "target" ? contextSuggestion.focuses : [];

  const goalIsCharacterQuestion = looksLikeCharacterQuestion(goalText);
  const submitGoal = () => {
    if (goalIsCharacterQuestion) {
      setCharacterQuestion(goalText.trim());
      return;
    }
    setCharacterQuestion(null);
    setGoalSource("player");
    const interpretation = interpretCoachGoal(goalText, activeItem, lang);
    setGoalIntent(interpretation.intent);
    if (interpretation.intent !== "incremental") {
      setDirection(interpretation.direction);
      setFocus(interpretation.focus);
      setDirectionNote(interpretation.reason);
      setProtectedModifiers(interpretation.protectedModifiers);
      setUnresolvedProtections(interpretation.unresolvedProtections);
      setNoEvidence(true);
      onMentorContext?.({
        type: "craftingCoachProject",
        itemName: activeItem.name || activeItem.baseType,
        playerGoal: goalText.trim(),
        intent: interpretation.intent,
        reason: interpretation.reason,
      });
      return;
    }
    if (interpretation.direction !== null && interpretation.focus !== null) {
      chooseDirection(
        interpretation.direction,
        interpretation.focus,
        interpretation.reason,
        goalText.trim(),
        interpretation.protectedModifiers,
        interpretation.unresolvedProtections,
        "incremental",
        "player",
      );
      return;
    }
    setDirection(interpretation.direction);
    setFocus(null);
    setDirectionNote(interpretation.reason);
    setProtectedModifiers(interpretation.protectedModifiers);
    setUnresolvedProtections(interpretation.unresolvedProtections);
    setNoEvidence(true);
  };

  const requestFocus = (next: CoachDirection, playerGoal: string, note: string) => {
    setGoalText(playerGoal);
    setGoalIntent("incremental");
    setGoalSource("player");
    setDirection(next);
    setFocus(null);
    setDirectionNote(note);
    setNoEvidence(true);
  };

  const chooseFocus = (nextFocus: CoachFocus, source: CoachGoalSource = "player") => {
    const nextDirection: CoachDirection = DAMAGE_COACH_FOCUSES.includes(nextFocus)
      ? "damage"
      : "defence";
    const playerGoal = t.improveFocusGoal(focusLabel(nextFocus));
    setGoalText(playerGoal);
    setGoalIntent("incremental");
    setGoalSource(source);
    chooseDirection(
      nextDirection,
      nextFocus,
      t.mainGoalNote(focusLabel(nextFocus)),
      playerGoal,
      protectedModifiers,
      unresolvedProtections,
      "incremental",
      source,
    );
  };

  const switchToIncremental = () => {
    setGoalText(t.improveThisItemGoal);
    setGoalIntent("incremental");
    setGoalSource("player");
    setDirection(null);
    setFocus(null);
    setDirectionNote(t.incrementalNote);
    setNoEvidence(true);
  };

  const updateContract = (
    nextRollMinimum: CoachRollMinimum,
    nextAttemptLimit: 1 | 2 | 3,
  ) => {
    setRollMinimum(nextRollMinimum);
    setAttemptLimit(nextAttemptLimit);
    if (focus === null) return;
    onMentorContext?.({
      type: "craftingCoachContract",
      itemName: activeItem.name || activeItem.baseType,
      playerGoal: goalText.trim() || t.mentorImproveFocus(focusLabel(focus)),
      focus,
      focusLabel: COACH_FOCUS_LABELS[focus],
      rollMinimum: nextRollMinimum,
      rollMinimumLabel: COACH_ROLL_MINIMUM_LABELS[nextRollMinimum],
      attemptLimit: nextAttemptLimit,
      nextAction: step.kind === "use-currency" ? step.actionId : null,
    });
  };

  const compareResult = async () => {
    if (pendingAttempt === null || resultText.trim() === "") return;
    setComparing(true);
    setError(null);
    try {
      const imported = await api.importItemText({ text: resultText, patch });
      // El importador genera un id nuevo en cada pegado; se conserva el de la
      // pieza seguida para que el guía siga hablando del mismo objeto.
      const pasted: Item = {
        ...imported.item,
        id: pendingAttempt.before.id,
        slot: pendingAttempt.before.slot,
      };
      const nextComparison = requireCompleteCraftingResult(
        pasted,
        compareCraftingResult(
          pendingAttempt.before,
          pasted,
          pendingAttempt.actionId,
          {
            protectedModifierIds: protectedModifiers.map((modifier) => modifier.id),
          },
          lang,
        ),
        lang,
      );
      const nextReading = readPurposefulCraftResult({
        comparison: nextComparison,
        originalItem: pendingAttempt.before,
        resultItem: pasted,
        direction,
        focus,
        profile,
        profileGoal: goal,
        rollMinimum: pendingAttempt.rollMinimum,
        attemptNumber: pendingAttempt.attemptNumber,
        attemptLimit: pendingAttempt.attemptLimit,
      }, lang);
      // Los ids de modificadores cambian en cada importación. Vuelve a
      // vincular las protecciones contra el snapshot recién pegado para que
      // sigan siendo válidas si el jugador continúa con otro paso.
      const refreshedGoal = interpretCoachGoal(goalText, pasted, lang);
      setComparison(nextComparison);
      setResultItem(pasted);
      if (nextComparison.status === "confirmed") {
        setConfirmedAttemptCount((current) =>
          Math.max(current, pendingAttempt.attemptNumber),
        );
        setProtectedModifiers(refreshedGoal.protectedModifiers);
        setUnresolvedProtections(refreshedGoal.unresolvedProtections);
        // Solo avanzamos el snapshot cuando la comparación se confirmó. Si el
        // pegado no cuadra, conservar la pieza anterior permite corregir el
        // texto sin perder el punto de partida de la sesión.
        setWorkingItem(pasted);
      }
      setPhase("result");
      onMentorContext?.({
        type: "craftingCoachResult",
        itemName: activeItem.name || activeItem.baseType,
        playerGoal: goalText.trim() || t.mentorDefaultGoal,
        headline: nextReading.headline,
        verdict: nextReading.verdict,
        decisionKind: nextReading.decisionKind,
        verdictText: nextReading.verdictText,
        nextStepTitle:
          nextReading.nextStep?.kind === "use-currency"
            ? nextReading.nextStep.label
            : nextReading.nextStep?.headline ?? null,
        focus,
        rollMinimum: pendingAttempt.rollMinimum,
        rollMinimumLabel: COACH_ROLL_MINIMUM_LABELS[pendingAttempt.rollMinimum],
        attemptCurrent:
          nextReading.attemptProgress?.current ?? pendingAttempt.attemptNumber,
        attemptLimit:
          nextReading.attemptProgress?.limit ?? pendingAttempt.attemptLimit,
        attemptsRemaining:
          nextReading.attemptProgress?.remaining ??
          Math.max(0, pendingAttempt.attemptLimit - pendingAttempt.attemptNumber),
        nextAction:
          nextReading.nextStep?.kind === "use-currency"
            ? nextReading.nextStep.actionId
            : null,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setComparing(false);
    }
  };

  const beginAttempt = () => {
    if (step.kind !== "use-currency") return;
    // Defensa en profundidad: una regresión visual no puede convertir una
    // pieza didáctica en un intento que espere un resultado real.
    if (simulationMode !== null) return;
    if (confirmedAttemptCount >= attemptLimit) {
      setPhase("hold");
      return;
    }
    setPendingAttempt({
      before: snapshotItem(activeItem),
      actionId: step.actionId,
      rollMinimum,
      attemptNumber: Math.min(confirmedAttemptCount + 1, attemptLimit),
      attemptLimit,
    });
    setResultText("");
    setComparison(null);
    setResultItem(null);
    setError(null);
    setPhase("await-result");
  };

  /**
   * Recuperación explícita: si el resultado es realmente el objeto actual pero
   * no coincide con una sola acción, se puede continuar DESDE él sin afirmar
   * qué moneda produjo la diferencia.
   */
  const continueFromObservedResult = () => {
    if (!resultItem || !pendingAttempt) return;
    const nextPhase = phaseAfterObservedResult(
      pendingAttempt.attemptNumber,
      pendingAttempt.attemptLimit,
    );
    setWorkingItem(snapshotItem(resultItem));
    setConfirmedAttemptCount((current) =>
      Math.max(current, pendingAttempt.attemptNumber),
    );
    setPendingAttempt(null);
    setComparison(null);
    setResultItem(null);
    setResultText("");
    setError(null);
    setPhase(nextPhase);
  };

  const resultDiagnosis = resultItem ? diagnoseCraftingItem(resultItem, lang) : null;
  const resultNeedsRepair = resultDiagnosis !== null && resultDiagnosis.state !== "complete";
  const resultReading =
    comparison && resultItem
      ? readPurposefulCraftResult({
          comparison,
          originalItem: pendingAttempt?.before ?? activeItem,
          resultItem,
          direction,
          focus,
          profile,
          profileGoal: goal,
          rollMinimum: pendingAttempt?.rollMinimum ?? rollMinimum,
          attemptNumber: pendingAttempt?.attemptNumber ?? confirmedAttemptCount + 1,
          attemptLimit: pendingAttempt?.attemptLimit ?? attemptLimit,
        }, lang)
      : null;
  const baseShouldBeReplaced = Boolean(
    comparison?.status === "confirmed" &&
      resultReading?.goalFit !== "confirmed" &&
      (resultReading?.decisionKind === "restart" || resultReading?.attemptProgress?.remaining === 0),
  );
  const resultState = resultReading
    ? comparison?.status !== "confirmed"
      ? "mismatch"
      : resultReading.verdict
    : null;
  const resultStatusLabel =
    resultState === "mismatch"
      ? t.statusMismatch
      : resultState === "continue"
        ? t.statusContinue
        : resultState === "stop"
          ? t.statusStop
          : t.statusReview;
  const resultSummary = !resultReading
    ? ""
    : resultState === "mismatch"
      ? comparison?.summary ?? t.mismatchFallback
      : resultReading.verdict === "continue"
        ? resultReading.attemptProgress
          ? t.stepsLeft(resultReading.attemptProgress.remaining)
          : t.oneActionLeft
        : resultReading.decisionKind === "restart"
          ? t.attemptAtLimit
          : resultReading.goalFit === "confirmed"
            ? /requisit|requirement/i.test(resultReading.verdictText)
              ? t.failsRequirements
              : t.goalPresentStop
            : resultReading.goalFit === "not-evaluable"
              ? t.goalNotEvaluable
              : t.goalNotMet;

  return (
    <section
      className="superficie-panel min-w-0 p-4 sm:p-6"
      style={{ scrollMarginBottom: "var(--mentor-inset, 6rem)" }}
      data-testid="crafting-coach"
      data-phase={phase}
      aria-labelledby="coach-titulo"
    >
      <h2 id="coach-titulo" className="sr-only">
        {t.srTitle}
      </h2>

      {showInitialRepairBanner && activeNeedsRepair && !directionChosen && (
        <div className="mb-4">
          <CraftingRepairBanner
            onRepaste={onPasteItem}
            reason={activeDiagnosis.blockers[0] ?? activeDiagnosis.limitations[0] ?? null}
            item={activeItem}
            patch={patch}
          />
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-24">
          {/* En la elección solo hace falta saber qué es; el detalle llega con
              la recomendación, cuando toca decidir qué se conserva. */}
          <CoachItemCard item={activeItem} compact />
          {/* La respuesta inmediata al pegar: qué da la pieza, antes de preguntar nada. */}
          {!directionChosen && (
            <ItemReadingCard
              item={activeItem}
              hideCopyTip={showInitialRepairBanner && activeNeedsRepair}
              onCompare={onCompareItem}
              onCheckResistances={onCheckResistances}
              onImprove={() => {
                const goal = document.querySelector<HTMLTextAreaElement>('[data-testid="coach-objetivo-texto"]');
                if (!goal) return;
                const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                goal.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
                goal.focus({ preventScroll: true });
              }}
            />
          )}
          {items.length > 1 && (
            <details className="rounded-md border border-border/70 px-2.5 py-2 text-xs">
              <summary className="cursor-pointer font-medium">{t.workWithAnother}</summary>
              <ul className="mt-2 flex flex-col gap-1.5" data-testid="coach-piezas-importadas">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`coach-elegir-${item.id}`}
                      data-active={item.id === selectedItem.id ? "true" : "false"}
                      onClick={(event) => {
                        // Tras elegir, la lista deja paso a la decisión. Mantener
                        // las demás piezas abiertas convertía el coach en un catálogo.
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        chooseDifferentItem(item.id);
                      }}
                      className="flex min-h-12 w-full items-center gap-2.5 rounded-sm border border-border/70 px-2.5 py-1.5 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[active=true]:border-primary/60 data-[active=true]:bg-primary/[0.08] motion-reduce:transition-none"
                    >
                      <CoachItemChoice item={item} />
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 self-start text-xs text-muted-foreground"
                onClick={onPasteItem}
                data-testid="coach-pegar-otro"
              >
                {t.pasteAnotherObject}
              </Button>
            </details>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {practiceError && (
            <p
              className="rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
              role="alert"
              data-testid="coach-practica-error"
            >
              {t.practiceError(practiceError)}
            </p>
          )}

          {/* Paso 1: hacia dónde quiere ir el jugador. */}
          {!directionChosen ? (
            <div className="min-w-0" data-testid="coach-eleccion">
              <h3 className="dossier-title text-xl font-semibold sm:text-2xl">
                {t.goalQuestion}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t.goalIntro}
              </p>
              <Textarea
                className="mt-3 min-h-24 resize-y"
                value={goalText}
                maxLength={240}
                onChange={(event) => {
                  setGoalText(event.target.value);
                  setCharacterQuestion(null);
                  setGoalIntent("incremental");
                  setDirection(null);
                  setFocus(null);
                  setNoEvidence(false);
                  setDirectionNote(null);
                  setProtectedModifiers([]);
                  setUnresolvedProtections([]);
                }}
                data-testid="coach-objetivo-texto"
                aria-label={t.goalAria}
                placeholder={
                  activeItem.slot === "weapon" || activeItem.slot === "offhand"
                    ? t.goalPlaceholderWeapon
                    : ["amulet", "ring1", "ring2", "belt"].includes(activeItem.slot)
                      ? t.goalPlaceholderJewel
                      : t.goalPlaceholderArmour
                }
              />
              <Button
                className="mt-3 w-full sm:w-auto"
                type="button"
                variant={
                  !goalIsCharacterQuestion && (activeNeedsRepair || (noEvidence && focus === null))
                    ? "secondary"
                    : "default"
                }
                disabled={
                  goalText.trim() === "" ||
                  // Una pregunta sobre el personaje siempre puede pasar al Mentor,
                  // aunque la pieza necesite reparación.
                  (!goalIsCharacterQuestion && (activeNeedsRepair || (noEvidence && focus === null)))
                }
                onClick={submitGoal}
                data-testid="coach-interpretar-objetivo"
              >
                {t.tellNextStep}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              {!goalIsCharacterQuestion && (activeNeedsRepair || (noEvidence && focus === null)) && (
                <span className="mt-2 block text-xs font-medium text-amber-300" role="status">
                  {activeNeedsRepair ? t.repairFirst : t.pickExactGoal}
                </span>
              )}
              <p className="mt-4 text-xs font-semibold text-muted-foreground">
                {t.quickOption}
              </p>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-3">
                <DirectionButton
                  id="damage"
                  label={t.moreDamage}
                  hint={t.hitHarder}
                  icon={Swords}
                  onChoose={() => {
                    const goal = t.improveDamageGoal;
                    requestFocus(
                      "damage",
                      goal,
                      t.damageNote,
                    );
                  }}
                />
                <DirectionButton
                  id="defence"
                  label={t.moreDefence}
                  hint={t.surviveMore}
                  icon={ShieldAlert}
                  onChoose={() => {
                    const goal = t.improveDefenceGoal;
                    requestFocus(
                      "defence",
                      goal,
                      t.defenceNote,
                    );
                  }}
                />
                <DirectionButton
                  id="unknown"
                  label={t.dontKnow}
                  hint={
                    contextSuggestion.source === "target"
                      ? t.hintPlan
                      : contextSuggestion.source === "resistances"
                        ? t.hintCharacter
                        : t.hintMissing
                  }
                  icon={Sparkles}
                  onChoose={() => {
                    const goal = t.unknownGoal;
                    setGoalText(goal);
                    setGoalSource("context");
                    if (contextSuggestion.focuses.length === 0) {
                      setDirection(null);
                      setFocus(null);
                      setDirectionNote(contextSuggestion.reason);
                      setNoEvidence(true);
                      return;
                    }
                    const directions = new Set(
                      contextSuggestion.focuses.map((option) =>
                        DAMAGE_COACH_FOCUSES.includes(option) ? "damage" : "defence",
                      ),
                    );
                    setDirection(directions.size === 1 ? [...directions][0]! : null);
                    setFocus(null);
                    setDirectionNote(contextSuggestion.reason);
                    setNoEvidence(true);
                  }}
                />
              </div>
              {characterQuestion !== null && (
                <div
                  className="mt-3 rounded-md border border-sky-500/40 bg-sky-500/[0.07] p-3"
                  data-testid="coach-pregunta-personaje"
                  role="status"
                >
                  <p className="text-xs font-semibold text-sky-300">{t.characterQuestionEyebrow}</p>
                  <h4 className="mt-1 text-base font-semibold text-foreground">
                    {t.characterQuestionTitle}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t.characterQuestionBody}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onAskMentor ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onAskMentor(characterQuestion)}
                        data-testid="coach-pregunta-al-mentor"
                      >
                        {t.askMentorThis}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button type="button" size="sm" onClick={onOpenCharacter}>
                        {t.addCharacterFirst}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {noEvidence && goalIntent !== "incremental" && (
                <div
                  className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/[0.07] p-3"
                  data-testid="coach-intencion-proyecto"
                  data-intent={goalIntent}
                  role="status"
                >
                  <p className="text-xs font-semibold text-amber-300">
                    {goalIntent === "unique-acquisition" ? t.detectedUnique : t.detectedEndgame}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-foreground">
                    {goalIntent === "unique-acquisition" ? t.dontSpendHereYet : t.oneAffixNotEndgame}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {directionNote}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {goalIntent === "unique-acquisition" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={onOpenPlanMarket}
                          data-testid="coach-unico-ir-mercado"
                        >
                          {t.goToPlanMarket}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGoalText(t.endgameRareGoal);
                            setGoalIntent("endgame-project");
                            setDirection(null);
                            setFocus(null);
                            setDirectionNote(t.endgameRareNote);
                          }}
                          data-testid="coach-unico-cambiar-rara"
                        >
                          {t.craftEndgameRare}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onOpenLaboratory(goalText.trim());
                          }}
                          data-testid="coach-endgame-preparar"
                        >
                          {t.openLaboratory}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                        {!hasCraftingCharacterContext(profile) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={onOpenCharacter}
                          >
                            {t.addCharacterGear}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant={hasCraftingCharacterContext(profile) ? "outline" : "ghost"}
                          onClick={onOpenPlanMarket}
                          data-testid="coach-endgame-revisar-plan"
                        >
                          {t.reviewPlanMarket}
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={switchToIncremental}
                      data-testid="coach-cambiar-incremental"
                    >
                      {t.onlyImproveItem}
                    </Button>
                  </div>
                </div>
              )}
              {noEvidence && goalIntent === "incremental" && (
                <div
                  className="mt-3 rounded-md border border-border bg-muted/[0.06] p-3"
                  data-testid="coach-sin-evidencia"
                  role="status"
                >
                  <p className="text-xs font-semibold text-primary/80">
                    {usingContextSuggestion && contextSuggestion.focuses.length > 0
                      ? t.characterNeeds
                      : t.beforeSpending}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {directionNote ?? contextSuggestion.reason}
                  </p>
                  {usingContextSuggestion &&
                    contextSuggestion.source === "target" &&
                    contextSuggestion.evidence.length > 0 && (
                      <ul
                        className="mt-2 space-y-1 text-xs text-muted-foreground"
                        data-testid="coach-contexto-evidencia"
                      >
                        {contextSuggestion.evidence.map((line) => (
                          <li key={line}>{quoted(line, lang)}</li>
                        ))}
                      </ul>
                    )}
                  {usingContextSuggestion && contextSuggestion.focuses.length > 0 && (
                    <div
                      className="mt-3 rounded border border-amber-500/35 bg-amber-500/[0.07] px-2.5 py-2 text-xs leading-relaxed text-amber-50"
                      data-testid="coach-contexto-encaje-pieza"
                    >
                      <p className="font-semibold">{t.doesItFit}</p>
                      <p className="mt-1 text-amber-100/80">
                        {contextSuggestion.source === "target"
                          ? t.planFit(activeItem.name || activeItem.baseType)
                          : t.characterFit(activeItem.name || activeItem.baseType)}
                      </p>
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {usingContextSuggestion && contextSuggestion.focuses.length > 0 ? (
                      contextSuggestion.focuses.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => chooseFocus(option, "context")}
                          data-testid={`coach-context-focus-${option}`}
                        >
                          {t.lookForFocus(focusLabel(option))}
                        </Button>
                      ))
                    ) : direction === null ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => requestFocus("damage", t.improveDamageGoal, t.damageFocusNote)}
                          data-testid="coach-elegir-damage"
                        >
                          {t.chooseDamage}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => requestFocus("defence", t.improveDefenceGoal, t.defenceFocusNote)}
                          data-testid="coach-elegir-defence"
                        >
                          {t.chooseDefence}
                        </Button>
                      </>
                    ) : direction === "damage" ? (
                      <div className="w-full space-y-3" data-testid="coach-focus-grupos">
                        <div className="grid gap-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
                          <p className="text-xs font-semibold text-muted-foreground">{t.damageType}</p>
                          <div className="flex min-h-11 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                            {DAMAGE_TYPE_FOCUSES.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-11 shrink-0"
                                onClick={() => chooseFocus(option)}
                                data-testid={`coach-focus-${option}`}
                              >
                                {focusLabel(option)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
                          <p className="text-xs font-semibold text-muted-foreground">{t.otherRoute}</p>
                          <div className="flex min-h-11 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                            {DAMAGE_OTHER_FOCUSES.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-11 shrink-0"
                                onClick={() => chooseFocus(option)}
                                data-testid={`coach-focus-${option}`}
                              >
                                {focusLabel(option)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-11 w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                        {DEFENCE_COACH_FOCUSES.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 shrink-0"
                            onClick={() => chooseFocus(option)}
                            data-testid={`coach-focus-${option}`}
                          >
                            {focusLabel(option)}
                          </Button>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNoEvidence(false);
                        setPhase("hold");
                      }}
                      data-testid="coach-no-gastar-sin-evidencia"
                    >
                      {t.dontSpendYet}
                    </Button>
                    {usingContextSuggestion && contextSuggestion.focuses.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onPasteItem}
                        data-testid="coach-cambiar-pieza-contexto"
                      >
                        {t.changeItem}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p
              className="text-xs text-muted-foreground"
              data-testid="coach-direccion-elegida"
              data-player-goal={goalText.trim()}
            >
              <span className="font-semibold text-foreground">{t.goalLabel}</span>{" "}
              {direction === null
                ? t.noDirection
                : focus === null
                  ? coachDirectionNoun(direction, lang)
                  : focusLabel(focus)}
              <button
                type="button"
                className="ml-1 underline underline-offset-2 hover:text-foreground"
                onClick={resetFlow}
                data-testid="coach-cambiar-direccion"
              >
                {t.change}
              </button>
            </p>
          )}

          {directionChosen && (
            <div
              className={`rounded-md border px-3 py-1.5 text-xs ${
                hasCraftingCharacterContext(profile)
                  ? "border-cyan-400/30 bg-cyan-500/[0.06] text-cyan-50"
                  : "border-amber-500/35 bg-amber-500/[0.07] text-amber-50"
              }`}
              data-testid="coach-contexto-personaje"
              data-context={hasCraftingCharacterContext(profile) ? "character" : "loose-item"}
            >
              {hasCraftingCharacterContext(profile) ? (
                <p>
                  <span className="font-semibold">{t.characterLabel}</span> {profile ? displayProfileValue(profile.name) : null} · {t.activeCharacter}
                  {target ? t.planName(target.name) : ""}
                  {budget === null
                    ? t.noBudget
                    : t.budgetLimit(
                        budget.amount,
                        lang === "es"
                          ? labels.currency[budget.currency].toLocaleLowerCase("es")
                          : labels.currency[budget.currency],
                      )}
                </p>
              ) : (
                <p>
                  <span className="font-semibold">{t.noCharacterLabel}</span> {t.noCharacterBody}
                </p>
              )}
            </div>
          )}

          {/*
            * UN SOLO BLOQUE POR BLOQUEO.
            *
            * Con `needs-data` esta caja decía «Aún no puedo juzgar esta base ·
            * Volver a copiar con Ctrl+Alt+C» justo encima del aviso del
            * importador, que nombra la causa concreta y ofrece el arreglo. Eran
            * dos cajas para un mismo hecho y, según el caso, con consejos que se
            * contradecían. El aviso, más específico, se queda solo.
            */}
          {directionChosen &&
            focus !== null &&
            simulationMode === null &&
            baseAssessment.status !== "needs-data" && (
            <section
              className={`rounded-md border px-3 py-3 ${
                baseAssessment.status === "already-satisfied" || baseAssessment.status === "aligned"
                  ? "border-emerald-400/35 bg-emerald-500/[0.06]"
                  : baseAssessment.status === "controlled-attempt" || baseAssessment.status === "review-current"
                    ? "border-amber-400/35 bg-amber-500/[0.06]"
                    : baseAssessment.status === "change-base"
                      ? "border-rose-400/35 bg-rose-500/[0.06]"
                      : "border-border bg-muted/[0.05]"
              }`}
              data-testid="coach-evaluacion-base"
              data-status={baseAssessment.status}
              aria-labelledby="coach-evaluacion-base-titulo"
            >
              <h3 id="coach-evaluacion-base-titulo" className="text-base font-semibold text-foreground">
                {baseAssessment.title}
              </h3>
              <p className="mt-1.5 text-sm font-medium text-foreground" data-testid="coach-base-decision">
                {baseAssessment.decisionLabel}
              </p>
              <details className="mt-2 rounded border border-border/70 px-2.5 py-2 text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground">{t.seeAnalysis}</summary>
                <p className="mt-2 leading-relaxed text-muted-foreground">{baseAssessment.summary}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-foreground">{t.character}</dt>
                    <dd className="mt-0.5 text-muted-foreground" data-testid="coach-base-personaje">{baseAssessment.characterLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">{t.base}</dt>
                    <dd className="mt-0.5 text-muted-foreground" data-testid="coach-base-objetivo">{baseAssessment.targetLabel}</dd>
                  </div>
                </dl>
              </details>
            </section>
          )}

          {directionChosen && focus !== null && targetFocuses.length > 0 && (
            <p
              className={`rounded-md border px-3 py-2 text-xs ${
                targetFocuses.includes(focus)
                  ? "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-100"
                  : "border-amber-500/35 bg-amber-500/[0.07] text-amber-100"
              }`}
              data-testid="coach-ajuste-plan"
              data-fit={targetFocuses.includes(focus) ? "matched" : "different"}
            >
              {targetFocuses.includes(focus)
                ? t.planHasPriority(focusLabel(focus))
                : t.planLacksPriority}
            </p>
          )}

          {directionChosen &&
            focus !== null &&
            simulationMode === null &&
            step.kind === "use-currency" && (
            <div
              className="rounded-md border border-primary/30 bg-primary/[0.05] px-3 py-2.5 text-xs leading-relaxed"
              data-testid="coach-condicion-parada"
            >
              <p>
                <span className="font-semibold text-primary">{t.stopLabel}</span>{" "}
                {t.stopSummary(focusLabel(focus), coachRollMinimumLabel(rollMinimum, lang), attemptLimit)}
              </p>
              {phase === "recommend" && confirmedAttemptCount === 0 && (
                <details className="mt-1.5" data-testid="coach-contrato-controles">
                  <summary className="w-fit cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    {t.adjust}
                  </summary>
                  <div className="mt-2 grid gap-2 border-t border-primary/15 pt-2 sm:grid-cols-2">
                    <fieldset className="min-w-0">
                      <legend className="font-semibold text-foreground">{t.minimumRoll}</legend>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(["any", "middle", "high"] as const).map((minimum) => (
                          <button
                            key={minimum}
                            type="button"
                            aria-pressed={rollMinimum === minimum}
                            data-testid={`coach-roll-minimum-${minimum}`}
                            onClick={() => updateContract(minimum, attemptLimit)}
                            className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                          >
                            {minimum === "any" ? t.rollAny : minimum === "middle" ? t.rollMiddle : t.rollHigh}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="min-w-0">
                      <legend className="font-semibold text-foreground">{t.maxSteps}</legend>
                      <div className="mt-1 flex gap-1">
                        {([1, 2, 3] as const).map((limit) => (
                          <button
                            key={limit}
                            type="button"
                            aria-pressed={attemptLimit === limit}
                            data-testid={`coach-attempt-limit-${limit}`}
                            onClick={() => updateContract(rollMinimum, limit)}
                            className="min-w-8 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                          >
                            {limit}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                      {t.tooltipRange}
                    </p>
                  </div>
                </details>
              )}
            </div>
          )}

          {directionChosen && (protectedModifiers.length > 0 || unresolvedProtections.length > 0) && (
            <div
              className="rounded-md border border-border/70 bg-muted/[0.05] px-3 py-2 text-xs"
              data-testid="coach-protecciones"
            >
              {protectedModifiers.length > 0 && (
                <p>
                  <span className="font-semibold text-foreground">{t.protectedLabel}</span>{" "}
                  {protectedModifiers.map((modifier) => modifier.text).join(" · ")}
                </p>
              )}
              {unresolvedProtections.length > 0 && (
                <p className="mt-1 text-amber-200" data-testid="coach-protecciones-no-vinculadas">
                  {t.unresolvedProtections(unresolvedProtections.join(" · "))}
                </p>
              )}
            </div>
          )}

          {/* Paso 2: una sola recomendación. */}
          {directionChosen && phase === "recommend" && (
            <Recommendation
              step={step}
              simulationMode={simulationMode}
              headingRef={recommendationRef}
              onDone={beginAttempt}
              onHold={() => setPhase("hold")}
              onOther={resetFlow}
              onReturnToItem={returnToMyItem}
              onReviewInExpediente={
                step.kind === "stop" &&
                step.reviewInExpediente &&
                !practiceActive &&
                profile?.items.some((candidate) => candidate.id === activeItem.id)
                  ? () => onOpenEquipmentItem(activeItem.id)
                  : null
              }
              onRepaste={onPasteItem}
              onPractice={() => void loadPracticeItem()}
              practiceLoading={practiceLoading}
              onOpenAdvanced={onOpenAdvanced}
              budgetAssessment={budgetAssessment}
              onOpenPlanMarket={onOpenPlanMarket}
              item={activeItem}
              patch={patch}
            />
          )}

          {/* Parada voluntaria: ni fracaso ni callejón sin salida. */}
          {phase === "hold" && (
            <div
              ref={holdRef}
              tabIndex={-1}
              role="status"
              className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)] rounded-md border border-border bg-muted/[0.06] p-2 outline-none sm:p-4"
              data-testid="coach-espera"
            >
              <h3 className="dossier-title text-xl font-semibold">{t.savedForLater}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t.itemUnchanged}
              </p>
              {confirmedAttemptCount >= attemptLimit && (
                <p
                  className="mt-2 rounded border border-amber-500/35 bg-amber-500/[0.07] px-2.5 py-2 text-xs text-amber-100"
                  data-testid="coach-limite-agotado"
                >
                  {t.limitUsed(attemptLimit)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {confirmedAttemptCount < attemptLimit && (
                  <Button
                    type="button"
                    onClick={() => setPhase("recommend")}
                    data-testid="coach-volver-accion"
                  >
                    {t.seeActionAgain}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFlow}
                  data-testid="coach-otro-camino"
                >
                  {t.otherPath}
                </Button>
                {confirmedAttemptCount >= attemptLimit && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onPasteItem}
                    data-testid="coach-otra-pieza"
                  >
                    <ClipboardPaste className="size-4" aria-hidden="true" />
                    {t.pasteAnother}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Paso 3: qué salió en el juego. */}
          {phase === "await-result" && step.kind === "use-currency" && (
            <div className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)]" data-testid="coach-registro">
              <h3 className="dossier-title text-xl font-semibold">{t.whatDidYouGet}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t.copyHint}</p>
              <Textarea
                ref={resultTextRef}
                className="mt-2 min-h-32 font-mono text-xs"
                value={resultText}
                onChange={(event) => setResultText(event.target.value)}
                aria-label={t.resultAria}
                data-testid="coach-resultado-texto"
                placeholder={t.resultPlaceholder}
              />
              {error !== null && (
                <p className="mt-2 text-sm text-rose-200" role="alert" data-testid="coach-error">
                  {error}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={comparing || resultText.trim() === ""}
                  onClick={() => void compareResult()}
                  data-testid="coach-comparar"
                >
                  {comparing ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                  {t.seeChanges}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhase("recommend")}
                  data-testid="coach-volver-recomendacion"
                >
                  {t.notDoneYet}
                </Button>
              </div>
              {comparing && (
                <div
                  className="mt-4 rounded-md border border-border bg-muted/[0.06] p-4"
                  role="status"
                  aria-label={t.readingResult}
                  data-testid="coach-resultado-cargando"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.result}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {t.reading}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="rounded-sm border border-border/60 p-2.5">
                        <div className="mx-auto h-2 w-12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                        <div className="mx-auto mt-2 h-6 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paso 4: antes y después. */}
          {phase === "result" && resultReading && (
            <div
              ref={resultRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)] rounded-md border border-border bg-muted/[0.06] p-3 outline-none sm:p-4"
              data-testid="coach-comparacion"
              data-verdict={resultReading.verdict}
              data-decision-kind={resultReading.decisionKind ?? "none"}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t.result}
                  </p>
                <div
                  className={cn(
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide",
                    resultState === "continue"
                      ? "border-cyan-400/45 bg-cyan-500/[0.10] text-cyan-100"
                      : resultState === "mismatch" || resultState === "stop"
                        ? "border-rose-400/45 bg-rose-500/[0.10] text-rose-100"
                        : "border-amber-400/45 bg-amber-500/[0.10] text-amber-100",
                  )}
                  data-testid="coach-estado-resultado"
                >
                  {resultState === "continue" ? (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  ) : resultState === "stop" ? (
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="size-4" aria-hidden="true" />
                  )}
                  {resultStatusLabel}
                </div>
                </div>
                <h3 className="dossier-title mt-2 text-lg font-semibold sm:text-xl">
                  <span className="sm:hidden">
                    {comparison?.status !== "confirmed"
                      ? t.unconfirmedResult
                      : resultReading.observedAffixes.length === 1
                        ? t.newModifier
                        : resultReading.headline}
                  </span>
                  <span className="hidden sm:inline">{resultReading.headline}</span>
                </h3>
              </div>
              <p className="mt-1.5 text-sm font-medium text-foreground sm:mt-2" data-testid="coach-veredicto-resumen">
                {resultSummary}
              </p>
              {resultNeedsRepair && resultItem && resultDiagnosis && (
                <div className="mt-3">
                  <CraftingRepairBanner
                    item={resultItem}
                    patch={patch}
                    reason={resultDiagnosis.blockers[0] ?? resultDiagnosis.limitations[0] ?? null}
                    onRepaste={() => {
                      setComparison(null);
                      setResultItem(null);
                      setPhase("await-result");
                    }}
                  />
                </div>
              )}
              {resultReading.observedAffixes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5" data-testid="coach-cambios">
                  {resultReading.observedAffixes.map((affix) => (
                    <li
                      key={affix.id}
                      className={`min-w-0 rounded-sm border px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 ${
                        affix.goalFit === "confirmed"
                          ? "border-cyan-400/35 bg-cyan-500/[0.07] text-cyan-50"
                          : affix.goalFit === "not-confirmed"
                            ? "border-rose-400/35 bg-rose-500/[0.06] text-rose-50"
                            : "border-border bg-background/35 text-foreground"
                      }`}
                      data-testid="coach-calidad-afijo"
                      data-roll-band={affix.rollBand}
                      data-goal-fit={affix.goalFit}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                            affix.goalFit === "confirmed"
                              ? "bg-cyan-300"
                              : affix.goalFit === "not-confirmed"
                                ? "bg-rose-300"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <span className="min-w-0 flex-1 break-words">{affix.text}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-3.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-medium ${
                            affix.goalFit === "confirmed"
                              ? "border-cyan-400/40 bg-cyan-500/[0.09] text-cyan-100"
                              : affix.goalFit === "not-confirmed"
                                ? "border-rose-400/35 bg-rose-500/[0.08] text-rose-100"
                                : "border-border bg-background/40 text-muted-foreground"
                          }`}
                        >
                          {affix.goalFit === "confirmed"
                            ? t.fits
                            : affix.goalFit === "not-confirmed"
                              ? t.doesntFit
                              : t.notConfirmed}
                        </span>
                        <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-muted-foreground">
                          {affix.tier === null ? t.tierHidden : t.tier(affix.tier)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 ${
                            affix.rollBand === "high"
                              ? "border-emerald-400/40 bg-emerald-500/[0.09] text-emerald-100"
                              : affix.rollBand === "middle"
                                ? "border-amber-400/40 bg-amber-500/[0.09] text-amber-100"
                                : affix.rollBand === "low"
                                  ? "border-rose-400/40 bg-rose-500/[0.09] text-rose-100"
                                  : "border-border bg-background/40 text-muted-foreground"
                          }`}
                        >
                          {affix.rollBand === "middle" && affix.rollPositionPercent !== null
                            ? t.rollMiddlePercent(affix.rollPositionPercent)
                            : affix.rollBand === "high"
                              ? t.rollHigh
                              : affix.rollBand === "low"
                                ? t.rollLow
                                : affix.rollLabel}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {resultReading.weaponPerformance && (
                <section
                  className="mt-3 rounded-md border border-cyan-400/25 bg-cyan-500/[0.05] p-3"
                  data-testid="coach-rendimiento-arma"
                  title={t.weaponTitleAttr}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold text-cyan-50">{t.weaponPerformance}</h4>
                    <span className="rounded-full border border-cyan-400/20 bg-background/30 px-2 py-0.5 text-xs text-cyan-100">
                      {resultReading.weaponPerformance.craftDelta.delta > 0 ? "+" : ""}
                      {resultReading.weaponPerformance.craftDelta.delta} DPS
                      {resultReading.weaponPerformance.craftDelta.percent === null
                        ? ""
                        : ` · ${resultReading.weaponPerformance.craftDelta.percent > 0 ? "+" : ""}${resultReading.weaponPerformance.craftDelta.percent}%`}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-sm border border-border/60 bg-background/35 px-1 py-2 sm:px-2">
                      <p className="text-xs text-muted-foreground">{t.physical}</p>
                      <p className="mt-0.5 text-xl font-semibold leading-none sm:text-2xl">{resultReading.weaponPerformance.candidate.physicalDps}</p>
                    </div>
                    <div className="rounded-sm border border-border/60 bg-background/35 px-1 py-2 sm:px-2">
                      <p className="text-xs text-muted-foreground">{t.elemental}</p>
                      <p className="mt-0.5 text-xl font-semibold leading-none sm:text-2xl">{resultReading.weaponPerformance.candidate.elementalDps}</p>
                    </div>
                    <div className="rounded-sm border border-cyan-400/25 bg-cyan-500/[0.06] px-1 py-2 sm:px-2">
                      <p className="text-xs text-cyan-100/70">{t.total}</p>
                      <p className="mt-0.5 text-xl font-semibold leading-none text-cyan-50 sm:text-2xl">{resultReading.weaponPerformance.candidate.totalDps}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs">
                    <p className="sr-only" data-testid="coach-delta-dps-total">
                      {t.sinceLastStep(
                        resultReading.weaponPerformance.craftDelta.delta,
                        resultReading.weaponPerformance.craftDelta.percent,
                      )}
                    </p>
                    {resultReading.weaponPerformance.focusComparison && (
                      <p
                        className={
                          resultReading.weaponPerformance.focusComparison.outcome === "higher"
                            ? "text-emerald-200"
                            : resultReading.weaponPerformance.focusComparison.outcome === "lower"
                              ? "text-rose-200"
                              : "text-amber-200"
                        }
                        data-testid="coach-comparacion-objetivo-arma"
                      >
                        {resultReading.weaponPerformance.focusComparison.shortLabel}: {resultReading.weaponPerformance.focusComparison.before} → {resultReading.weaponPerformance.focusComparison.after}
                      </p>
                    )}
                  </div>
                </section>
              )}
              <p
                className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground sm:mt-3"
                data-testid="coach-hechos-resultado"
              >
                <span>{/^(No se ha perdido|Nothing you already had was lost)/.test(resultReading.kept) ? t.nothingLost : resultReading.kept}</span>
                {resultReading.directionNote !== null && (
                  <span
                    className="before:mr-2 before:text-muted-foreground/50 before:content-['·']"
                    data-testid="coach-relacion-objetivo"
                    data-goal-fit={resultReading.goalFit}
                    title={resultReading.directionNote}
                  >
                    {resultReading.goalFit === "confirmed"
                      ? t.fitsGoal
                      : resultReading.goalFit === "not-confirmed"
                        ? t.doesntFitGoal
                        : t.fitUnconfirmed}
                  </span>
                )}
              </p>
              <details className="mt-2 rounded-md border border-border/70 bg-background/35 px-3 py-2 text-xs sm:mt-3">
                <summary className="min-h-7 cursor-pointer py-1 font-semibold text-muted-foreground">
                  {t.limitsDetail}
                </summary>
                <div className="mt-2 space-y-2 text-muted-foreground">
                  <p className="font-medium text-foreground" data-testid="coach-veredicto">
                    {resultReading.verdictText}
                  </p>
                  {resultReading.improvementCaveat !== null && (
                    <p data-testid="coach-salvedad-mejora">{resultReading.improvementCaveat}</p>
                  )}
                  {resultReading.weaponPerformance && (
                    <p>{resultReading.weaponPerformance.limitation}</p>
                  )}
                </div>
              </details>
              {comparison && comparison.status !== "confirmed" && resultItem && (
                <details
                  className="mt-3 rounded-md border border-border/70 bg-background/35 px-3 py-2 text-xs"
                  data-testid="coach-diagnostico-comparacion"
                >
                  <summary className="cursor-pointer font-semibold">{t.whatImComparing}</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-foreground">{t.before}</span>{" "}
                      {(pendingAttempt?.before ?? activeItem).name ||
                        (pendingAttempt?.before ?? activeItem).baseType}{" "}
                      · {(pendingAttempt?.before ?? activeItem).rarity} ·{" "}
                      {(pendingAttempt?.before ?? activeItem).modifiers.filter(
                        (modifier) => modifier.kind === "explicit",
                      ).length}{" "}
                      {t.explicitMods}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">{t.after}</span>{" "}
                      {resultItem.name || resultItem.baseType} · {resultItem.rarity} ·{" "}
                      {resultItem.modifiers.filter((modifier) => modifier.kind === "explicit").length}{" "}
                      {t.explicitMods}
                    </p>
                  </div>
                  {comparison.addedModifiers.length > 0 && (
                    <div className="mt-2" data-testid="coach-diagnostico-nuevos">
                      <p className="font-semibold text-foreground">{t.countsAsNew}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {comparison.addedModifiers.map((modifier) => (
                          <li key={`added-${modifier.id}`} className="whitespace-pre-line break-words">
                            {modifier.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {comparison.removedModifiers.length > 0 && (
                    <div className="mt-2" data-testid="coach-diagnostico-perdidos">
                      <p className="font-semibold text-foreground">{t.noLongerSameLine}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {comparison.removedModifiers.map((modifier) => (
                          <li key={`removed-${modifier.id}`} className="whitespace-pre-line break-words">
                            {modifier.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:flex-wrap">
                {comparison?.status === "confirmed" && resultReading.verdict === "continue" && resultItem && (
                  <Button
                    type="button"
                    className="col-span-2 min-h-11 w-full sm:w-auto"
                    onClick={() => {
                      setPhase("recommend");
                      setPendingAttempt(null);
                      setComparison(null);
                      setResultItem(null);
                      setResultText("");
                    }}
                    data-testid="coach-seguir"
                  >
                    {t.seeNextAction}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {comparison && comparison.status !== "confirmed" && (
                  <>
                    <Button
                      type="button"
                      className="col-span-2 min-h-11 w-full sm:w-auto"
                      onClick={() => {
                        setPhase("await-result");
                        setComparison(null);
                        setResultItem(null);
                      }}
                      data-testid="coach-corregir-resultado"
                    >
                      {t.reviewPasted}
                    </Button>
                    {!resultNeedsRepair && comparison.identityMatches && comparison.itemLevelMatches && resultItem && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                        onClick={continueFromObservedResult}
                        data-testid="coach-usar-resultado-base"
                      >
                        {t.thisIsMyItem}
                      </Button>
                    )}
                  </>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict !== "continue" && resultReading.goalFit !== "confirmed" && (
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={resetFlow}
                    data-testid="coach-empezar-otra"
                  >
                    {resultReading.goalFit === "not-evaluable" ? t.refineGoal : t.changeGoal}
                  </Button>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict !== "continue" && resultReading.goalFit === "confirmed" && (
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => setPhase("hold")}
                    data-testid="coach-terminar-resultado"
                  >
                    {t.finishForNow}
                  </Button>
                )}
                {baseShouldBeReplaced && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={onPasteItem}
                    data-testid="coach-probar-otra-base"
                  >
                    {t.tryAnotherBase}
                  </Button>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict === "continue" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={resetFlow}
                    data-testid="coach-empezar-otra"
                  >
                    {t.rethinkGoal}
                  </Button>
                )}
                {comparison?.status === "confirmed" && !baseShouldBeReplaced && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={onPasteItem}
                    data-testid="coach-cambiar-pieza-resultado"
                  >
                    {t.changeItem}
                  </Button>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict === "continue" && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => setPhase("hold")}
                    data-testid="coach-terminar-resultado"
                  >
                    {t.finishForNow}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
