import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  CirclePause,
  CircleX,
  FlaskConical,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import type { Budget, CharacterProfile, GoalKind, Item, Recommendation } from "@shared/domain.js";
import {
  CRAFTING_RESULT_UNKNOWN_LABEL,
  CRAFTING_RESULT_UNKNOWN_LABEL_EN,
  compareCraftingResult,
  craftingComparisonEvidence,
  requireCompleteCraftingResult,
  type CraftingComparison,
} from "@shared/craftingComparison.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import { evaluateCraftingCharacterContext } from "@shared/craftingCharacterContext.js";
import { evaluateCraftingGoalSignal } from "@shared/craftingGoal.js";
import { decideCraftingNextStep } from "@shared/craftingNextDecision.js";
import {
  craftingSuccessCriterionLabel,
  evaluateCraftingSuccessCriteria,
} from "@shared/craftingSuccessCriteria.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import {
  CONCLUSION_LABELS,
  DECISION_OUTCOME_LABELS,
  EVIDENCE_KIND_LABELS,
  SESSION_KIND_LABELS,
  SESSION_STATUS_LABELS,
  characterSessionFingerprint,
  sessionIsOpen,
  type CraftingExperiment,
  type DecisionOutcome,
} from "@shared/decisionSession.js";
import type { JournalState } from "@/hooks/useJournal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CraftingRepairBanner } from "@/components/CraftingRepairBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { compactRecommendationReason } from "@/lib/journal";
import {
  appendCraftingProjectAttempt,
  classifyCraftingProjectBranch,
  craftingProjectStorageKey,
} from "@/lib/craftingProject";
import {
  clearCraftingSessionDraft,
  loadCraftingSessionDraft,
  saveCraftingSessionDraft,
} from "@/lib/craftingSessionDraft";
import {
  decisionOutcomeOptions,
  observationMethodForRecommendation,
  outcomeResultText,
} from "@/lib/sessionOutcome";
import { useFormatLabels } from "@/lib/formatLabels";
import { pageLang, texts, useLang, useText } from "@/i18n/lang";
import { ALLOY_RESULT_UNKNOWN_LABEL, ALLOY_RESULT_UNKNOWN_LABEL_EN } from "@shared/craftingAlloys.js";
import { ESSENCE_RESULT_UNKNOWN_LABEL, ESSENCE_RESULT_UNKNOWN_LABEL_EN } from "@shared/craftingEssences.js";

const TEXT = texts(
  {
    titleCraftingOpen: "Paso preparado para PoE2",
    titleOpen: "Prueba en curso",
    titleIdle: "Comprobar una decisión",
    introCraftingOpen:
      "Exile Copilot no modifica el objeto: haz la acción dentro de PoE2, copia el resultado completo y vuelve para compararlo.",
    introOpen:
      "Haz una sola prueba, vuelve con lo que ocurrió y el mentor decidirá si cerramos o mantenemos el caso.",
    introIdle: "El mentor recuerda qué estamos intentando, qué falta por ver y una sola acción.",
    staleTitle: "La decisión anterior ya no vale",
    staleBody:
      "Otra pestaña cambió la memoria. Los botones viejos se han desactivado. Revisa el estado actual antes de seguir.",
    pausedEyebrow: "Aparcadas",
    pausedCount: (count: number) =>
      count === 1 ? "1 comprobación guardada" : `${count} comprobaciones guardadas`,
    pausedHint: "Cierra o pausa la actual para reanudar otra.",
    pausedFallback: "Guardada para continuar después.",
    resumeNote: "Reanudamos esta comprobación pausada.",
    resume: "Reanudar",
    objectiveLabel: "Qué quieres conseguir",
    objectivePlaceholder: "Por ejemplo: subir supervivencia sin tocar mi habilidad core",
    hypothesisLabel: "Qué vamos a comprobar",
    methodLabel: "Cómo lo comprobarás en PoE2",
    methodPlaceholder:
      "Ej.: compara el objeto antes y después; o anota cuántos golpes sobrevives al mismo ataque.",
    methodHint:
      "Describe una observación que responda a esta decisión. El Copiloto no asumirá que siempre debes jugar un mapa.",
    unknownLabel: "Dato que aún no tenemos (opcional)",
    unknownPlaceholder: "Tooltip exacto de una herramienta, un mod, un coste…",
    coreLabel: "Pieza o habilidad intocable (opcional)",
    corePlaceholder: "Barrera voltaica",
    replaceLabel: "Pieza que vas a sustituir pronto (opcional)",
    none: "Ninguna",
    startButton: "Empezar a comprobar",
    startFromRecommendation: "Comprobar la recomendación actual",
    manualExpectedResult: "El cambio que quieres comprobar.",
    pauseReason: "Pausa para conservar el recurso o esperar un mejor momento.",
    abandonCraftReason: "Craft cerrado sin actualizar el expediente con el resultado de PoE2.",
    abandonReason: "Comprobación cerrada por decisión del jugador.",
    importWarnings: (warnings: string) => `Importación con avisos: ${warnings}`,
    characterNotUpdated:
      "No se actualizó el expediente. La sesión sigue abierta: puedes reintentar sin volver a gastar ninguna moneda.",
    craftUseful: (outcome: string) => `El jugador indica que el resultado sirve para «${outcome}».`,
    craftNotUseful: (outcome: string) =>
      `El jugador indica que el resultado no sirve para «${outcome}».`,
    resultAccepted: "Resultado aceptado",
    resultDiscarded: "Resultado descartado",
    notClosed: (message: string) =>
      `${message} La sesión no se ha dado por cerrada; revisa el expediente y reintenta.`,
    kindLabels: SESSION_KIND_LABELS,
    statusLabels: SESSION_STATUS_LABELS,
    conclusionLabels: CONCLUSION_LABELS,
    outcomeLabels: DECISION_OUTCOME_LABELS,
    evidenceKindLabels: EVIDENCE_KIND_LABELS,
    reconcileTitle: "El personaje ya no es el mismo",
    reconcileBody:
      "Cambió el nivel, la liga, el parche o el equipo desde que empezó esta decisión. Confirma si sigue aplicando o empieza otra.",
    reconcileButton: "Sigue aplicando a este personaje",
    whatWeTry: "Qué intentamos",
    whyHelp: "Por qué creemos que ayudará",
    untouchable: "Intocable",
    stillUnknown: "Aún no sabemos",
    craftStepsAria: "Dónde ocurre cada paso del crafting",
    step1: "1. Aquí: paso preparado ✓",
    step2: "2. En PoE2: ejecuta y copia",
    step3: "3. Aquí: compara y guarda",
    closeLoop: "Cerrar el ciclo",
    pasteTitle: "Pega lo que salió en PoE2",
    pasteBody: (action: string) =>
      `Usa ${action} dentro del juego y copia allí el objeto completo con Ctrl+Alt+C. Al volver, Exile Copilot solo comparará ese texto con el snapshot guardado; nunca ejecuta la moneda por ti.`,
    summaryItem: "Objeto",
    summaryCurrency: "Moneda registrada",
    summaryGoal: "Objetivo",
    guaranteedEffect: "Efecto garantizado declarado",
    minimumTooltip: "Mínimo mostrado en su tooltip",
    notRecorded: "No registrado",
    variantNotRecorded: "Variante no registrada en esta sesión antigua",
    noMinimum: "El tooltip observado no muestra un mínimo",
    modifierLevel: (level: number) => `Nivel de modificador ${level}`,
    declaredProtection: "Protección declarada",
    protectedCount: (count: number) => `${count} modificador${count === 1 ? "" : "es"}`,
    stopWhen: "Pararé cuando",
    pastedLabel: "Objeto actual copiado desde PoE2",
    pastePlaceholder: "Pega aquí el texto copiado con Ctrl+Alt+C desde PoE2",
    compareButton: "Comparar con el snapshot anterior",
    importReviewTitle: "La importación necesita revisión",
    protectedKept: (count: number) => `Los ${count} modificadores protegidos siguen presentes.`,
    appearsNow: "Aparece ahora",
    noLongerAppears: "Ya no aparece",
    stopPoint: "Tu punto de parada",
    criterionFulfilled: "Cumplida",
    criterionNotSeen: "No aparece",
    criterionUnknown: "No comprobable",
    recommendedDecision: "Decisión recomendada",
    characterReading: "Lectura del personaje",
    whySays: "Por qué dice esto",
    closeWithDecision: "Cierra este paso con la decisión delante",
    doesItWork: (outcome: string) => `¿El cambio resultante sirve para «${outcome}»?`,
    saveContinue: "Guardar y preparar el siguiente paso",
    saveRestart: "Guardar y replantear",
    saveStop: "Guardar y parar",
    yesWorks: "Sí, me sirve",
    notWhatIWanted: "No era lo que buscaba",
    saveForLater: "Guardar para seguir más tarde",
    discardNoUpdate: "Descartar sin actualizar el expediente",
    confirmNote:
      "Al confirmar solo se guarda la comparación y se actualiza tu copia del expediente. El objeto de PoE2 ya cambió dentro del juego.",
    discardCheck: "Descartar esta comprobación",
    nextAction: "Próxima acción",
    thenObserve: "Después, observa",
    beforeContinue: "Antes de continuar:",
    backFromPlaying: "Volví de jugar",
    reopensIf: (when: string) => ` Se reabre si: ${when}`,
    lastResult: "Último resultado",
    subjectiveNote: " (experiencia del jugador, no medición)",
    protectedItems: "Piezas protegidas",
    releaseProtection: "Retirar esta protección",
    closedTitle: "Esta decisión está cerrada",
    closedBody:
      "Ya no admite resultado, evidencia ni pausa. Puedes reabrirla como candidata o empezar otra decisión desde cero.",
    startAnother: "Empezar otra decisión",
    returnEyebrow: "Regreso de la prueba",
    whatHappened: "¿Qué ocurrió?",
    returnBody:
      "Elige una respuesta. Puedes terminar en unos segundos y añadir detalles solo si hacen falta.",
    keepPlaying: "Seguir jugando",
    testResultLegend: "Resultado de la prueba",
    tellMe: "Cuéntame lo importante (opcional)",
    tellMePlaceholder:
      "Por ejemplo: aguanto mejor, pero los bosses siguen acercándose demasiado.",
    subjectiveCheckbox:
      "Es mi experiencia al jugar, no una medición. Desmárcalo solo si has actualizado el expediente con datos comprobados.",
    updateCharacter: "Actualizar expediente antes de cerrar",
    unexpectedSummary: "Resultado inesperado o condición de reapertura",
    valuablePlaceholder: "Si salió otra cosa valiosa, nómbrala para protegerla",
    reopenPlaceholder: "Reevaluar si esa condición pasa a ser consistente",
    saveResult: "Guardar resultado",
    advancedSummary: "Protecciones y evidencia avanzada",
    addProtected: "Añadir pieza protegida",
    protect: "Proteger",
    addEvidence: "Añadir evidencia (sin cerrar el paso)",
    whichUnknown: "¿Qué dato pendiente resuelve?",
    noneInParticular: "Ninguno en concreto",
    saveEvidence: "Guardar evidencia",
    pause: "Pausar",
    reopenNote: "Reabrimos como candidata.",
    reopenAsCandidate: "Reabrir como candidata",
    evidence: "Evidencia",
    whyChanged: "Por qué hemos cambiado de plan",
    discardDialogTitle: "¿Descartar esta comprobación?",
    discardDialogBody:
      "Se cerrará el proyecto sin actualizar tu expediente con el resultado de PoE2. Si solo quieres continuar otro día, vuelve y elige «Guardar para seguir más tarde».",
    keepChecking: "Seguir con la comprobación",
    yesDiscard: "Sí, descartar",
  },
  {
    titleCraftingOpen: "Step ready for PoE2",
    titleOpen: "Test in progress",
    titleIdle: "Check a decision",
    introCraftingOpen:
      "Exile Copilot doesn't change the item: do the action inside PoE2, copy the full result and come back to compare it.",
    introOpen:
      "Do one test, come back with what happened and the mentor will decide whether to close the case or keep it open.",
    introIdle: "The mentor remembers what we're trying, what we still need to see and one single action.",
    staleTitle: "The previous decision is out of date",
    staleBody:
      "Another tab changed the memory. The old buttons have been turned off. Check the current state before you go on.",
    pausedEyebrow: "Parked",
    pausedCount: (count: number) => (count === 1 ? "1 saved check" : `${count} saved checks`),
    pausedHint: "Close or pause the current one to resume another.",
    pausedFallback: "Saved to continue later.",
    resumeNote: "Resuming this paused check.",
    resume: "Resume",
    objectiveLabel: "What you want to achieve",
    objectivePlaceholder: "For example: more survivability without touching my main skill",
    hypothesisLabel: "What we're going to check",
    methodLabel: "How you'll check it in PoE2",
    methodPlaceholder:
      "E.g. compare the item before and after; or count how many hits of the same attack you survive.",
    methodHint:
      "Describe something you can observe that answers this decision. The Copilot won't assume you always have to run a map.",
    unknownLabel: "Something we don't know yet (optional)",
    unknownPlaceholder: "The exact tooltip of a currency item, a mod, a cost…",
    coreLabel: "Item or skill you won't touch (optional)",
    corePlaceholder: "Spark",
    replaceLabel: "Item you'll replace soon (optional)",
    none: "None",
    startButton: "Start checking",
    startFromRecommendation: "Check the current recommendation",
    manualExpectedResult: "The change you want to check.",
    pauseReason: "Paused to save the resource or wait for a better moment.",
    abandonCraftReason: "Craft closed without updating the character with the PoE2 result.",
    abandonReason: "Check closed by the player's choice.",
    importWarnings: (warnings: string) => `Imported with warnings: ${warnings}`,
    characterNotUpdated:
      "Your character wasn't updated. The session is still open: you can try again without spending any more currency.",
    craftUseful: (outcome: string) => `The player says the result works for "${outcome}".`,
    craftNotUseful: (outcome: string) => `The player says the result doesn't work for "${outcome}".`,
    resultAccepted: "Result accepted",
    resultDiscarded: "Result discarded",
    notClosed: (message: string) =>
      `${message} The session hasn't been closed; check your character and try again.`,
    kindLabels: {
      skill_experiment: "Skill experiment",
      equipment_investment: "Gear investment",
      guided_decision: "Guided decision",
    },
    statusLabels: {
      active: "In progress",
      waiting_result: "Waiting for what you see",
      paused: "Paused",
      completed: "Completed",
      discarded: "Discarded",
      reopening: "Candidate to review",
    },
    conclusionLabels: {
      continue: "We keep checking the same thing",
      change_strategy: "We change the plan",
      pause: "Paused: we keep the resource",
      discard: "Discarded, with a reason",
      complete: "This step is done",
      reopen: "A candidate again",
    },
    outcomeLabels: {
      resolved: "Problem solved",
      improved: "Better, but not fixed",
      unchanged: "No change",
      worse: "Got worse",
      different: "Something different happened",
    },
    evidenceKindLabels: {
      confirmed: "Something you confirmed",
      inferred: "A hint, not measured",
      unverified: "Not verified yet",
      player_subjective: "Your feeling, not a measurement",
    },
    reconcileTitle: "Your character has changed",
    reconcileBody:
      "The level, league, patch or gear changed since this decision started. Confirm it still applies or start a new one.",
    reconcileButton: "It still applies to this character",
    whatWeTry: "What we're trying",
    whyHelp: "Why we think it will help",
    untouchable: "Don't touch",
    stillUnknown: "We don't know yet",
    craftStepsAria: "Where each crafting step happens",
    step1: "1. Here: step ready ✓",
    step2: "2. In PoE2: do it and copy",
    step3: "3. Here: compare and save",
    closeLoop: "Close the loop",
    pasteTitle: "Paste what you got in PoE2",
    pasteBody: (action: string) =>
      `Use ${action} in the game and copy the full item there with Ctrl+Alt+C. When you're back, Exile Copilot will only compare that text with the saved snapshot; it never uses the currency for you.`,
    summaryItem: "Item",
    summaryCurrency: "Currency recorded",
    summaryGoal: "Goal",
    guaranteedEffect: "Declared guaranteed effect",
    minimumTooltip: "Minimum shown on its tooltip",
    notRecorded: "Not recorded",
    variantNotRecorded: "Variant not recorded in this older session",
    noMinimum: "The tooltip you saw shows no minimum",
    modifierLevel: (level: number) => `Modifier level ${level}`,
    declaredProtection: "Declared protection",
    protectedCount: (count: number) => `${count} modifier${count === 1 ? "" : "s"}`,
    stopWhen: "I'll stop when",
    pastedLabel: "Current item copied from PoE2",
    pastePlaceholder: "Paste the text you copied with Ctrl+Alt+C in PoE2 here",
    compareButton: "Compare with the previous snapshot",
    importReviewTitle: "The import needs a look",
    protectedKept: (count: number) => `All ${count} protected modifiers are still there.`,
    appearsNow: "New now",
    noLongerAppears: "Gone now",
    stopPoint: "Your stopping point",
    criterionFulfilled: "Met",
    criterionNotSeen: "Not there",
    criterionUnknown: "Can't be checked",
    recommendedDecision: "Recommended decision",
    characterReading: "What it means for your character",
    whySays: "Why it says this",
    closeWithDecision: "Close this step with the decision in front of you",
    doesItWork: (outcome: string) => `Does the resulting change work for "${outcome}"?`,
    saveContinue: "Save and prepare the next step",
    saveRestart: "Save and rethink",
    saveStop: "Save and stop",
    yesWorks: "Yes, it works for me",
    notWhatIWanted: "Not what I was looking for",
    saveForLater: "Save to continue later",
    discardNoUpdate: "Discard without updating the character",
    confirmNote:
      "Confirming only saves the comparison and updates your copy of the character. The item has already changed inside PoE2.",
    discardCheck: "Discard this check",
    nextAction: "Next action",
    thenObserve: "Then, watch for",
    beforeContinue: "Before you go on:",
    backFromPlaying: "I'm back from playing",
    reopensIf: (when: string) => ` Reopens if: ${when}`,
    lastResult: "Last result",
    subjectiveNote: " (player experience, not a measurement)",
    protectedItems: "Protected items",
    releaseProtection: "Remove this protection",
    closedTitle: "This decision is closed",
    closedBody:
      "It no longer takes results, evidence or pauses. You can reopen it as a candidate or start a new decision from scratch.",
    startAnother: "Start another decision",
    returnEyebrow: "Back from the test",
    whatHappened: "What happened?",
    returnBody: "Pick an answer. You can finish in a few seconds and add details only if needed.",
    keepPlaying: "Keep playing",
    testResultLegend: "Test result",
    tellMe: "Tell me what matters (optional)",
    tellMePlaceholder: "For example: I survive better, but bosses still get too close.",
    subjectiveCheckbox:
      "This is how it felt while playing, not a measurement. Untick it only if you updated your character with checked data.",
    updateCharacter: "Update the character before closing",
    unexpectedSummary: "Unexpected result or reopen condition",
    valuablePlaceholder: "If something else valuable came up, name it to protect it",
    reopenPlaceholder: "Re-check if that condition becomes consistent",
    saveResult: "Save result",
    advancedSummary: "Protections and advanced evidence",
    addProtected: "Add a protected item",
    protect: "Protect",
    addEvidence: "Add evidence (without closing the step)",
    whichUnknown: "Which open question does it answer?",
    noneInParticular: "None in particular",
    saveEvidence: "Save evidence",
    pause: "Pause",
    reopenNote: "Reopened as a candidate.",
    reopenAsCandidate: "Reopen as a candidate",
    evidence: "Evidence",
    whyChanged: "Why we changed the plan",
    discardDialogTitle: "Discard this check?",
    discardDialogBody:
      "The project will close without updating your character with the PoE2 result. If you just want to continue another day, go back and choose \"Save to continue later\".",
    keepChecking: "Keep checking",
    yesDiscard: "Yes, discard",
  },
);

type DecisionText = (typeof TEXT)["es"];

interface DecisionSessionSectionProps {
  /** Identificador único cuando la sesión se presenta en más de un workspace montado. */
  instanceId?: string;
  profile: CharacterProfile | null;
  budget: Budget | null;
  /**
   * Objetivo REAL elegido por el jugador en «Plan y mercado». La sesión debe
   * abrirse con él: antes se enviaba «balanced» fijo y además el servidor lo
   * descartaba, así que la decisión perdía ese contexto.
   */
  goal: GoalKind;
  journal: JournalState;
  pendingRecommendation: Recommendation | null;
  onEditExpediente?: () => void;
  onMentorEvent?: (event: {
    type: "started" | "result" | "paused" | "reopened" | "reconciled";
    title: string;
  }) => void;
  onApplyCraftingResult?: (originalItemId: string, resultItem: Item) => Promise<boolean>;
}

function newKey(): string {
  return crypto.randomUUID();
}

async function inspectCraftingResult(
  resultText: string,
  patch: string,
  experiment: CraftingExperiment,
  t: DecisionText,
): Promise<{
  item: Item;
  comparison: CraftingComparison;
  warning: string | null;
}> {
  const imported = await api.importItemText({ text: resultText, patch });
  const comparison = requireCompleteCraftingResult(
    imported.item,
    compareCraftingResult(
      experiment.originalItem,
      imported.item,
      experiment.actionId,
      {
        expectedRarity: experiment.resultRarity,
        expectedRemovedModifierCount: experiment.expectedRemovedModifierCount,
        expectedAddedCrafted: experiment.expectedAddedCrafted,
        maximumCraftedModifierCount: experiment.maximumCraftedModifierCount,
        expectedAddedModifierText: experiment.guaranteedModifierText,
        protectedModifierIds: experiment.protectedModifierIds,
      },
      pageLang(),
    ),
    pageLang(),
  );
  return {
    item: imported.item,
    comparison,
    warning:
      imported.warnings.length > 0
        ? t.importWarnings(imported.warnings.join(" "))
        : null,
  };
}


/**
 * Las tres incógnitas «resultado desconocido» se guardan en español porque el
 * servidor las usa como clave. Solo se traducen al enseñarlas.
 */
const RESULT_UNKNOWN_LABELS_EN: Record<string, string> = {
  [CRAFTING_RESULT_UNKNOWN_LABEL]: CRAFTING_RESULT_UNKNOWN_LABEL_EN,
  [ESSENCE_RESULT_UNKNOWN_LABEL]: ESSENCE_RESULT_UNKNOWN_LABEL_EN,
  [ALLOY_RESULT_UNKNOWN_LABEL]: ALLOY_RESULT_UNKNOWN_LABEL_EN,
};

export function DecisionSessionSection({
  instanceId = "seccion-decision-adaptativa",
  profile,
  budget,
  goal,
  journal,
  pendingRecommendation,
  onEditExpediente,
  onMentorEvent,
  onApplyCraftingResult,
}: DecisionSessionSectionProps) {
  const session = journal.journal?.session ?? null;
  const pausedSessions = journal.journal?.pausedSessions ?? [];
  const events = journal.journal?.sessionEvents ?? [];
  const revision = journal.journal
    ? buildRecommendationMemory(journal.journal, journal.journal.session).revision
    : null;
  const fingerprintMismatch =
    session !== null && profile !== null
      ? characterSessionFingerprint(profile) !== session.characterFingerprint
      : false;
  const needsReconcile = Boolean(session?.needsReconciliation || fingerprintMismatch);

  const [objective, setObjective] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [manualObservationMethod, setManualObservationMethod] = useState("");
  const [unknown, setUnknown] = useState("");
  const [constraint, setConstraint] = useState("");
  const [soonReplaced, setSoonReplaced] = useState("");
  const [resultText, setResultText] = useState("");
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [valuable, setValuable] = useState("");
  const [subjective, setSubjective] = useState(true);
  const [reopenWhen, setReopenWhen] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  /** Incógnita que resuelve la evidencia: elegida en la lista, no en un estado oculto. */
  const [resolvesUnknownId, setResolvesUnknownId] = useState("");
  /** El jugador pidió explícitamente empezar otra decisión tras cerrar la anterior. */
  const [startingNew, setStartingNew] = useState(false);
  const [craftingResultText, setCraftingResultText] = useState("");
  const [craftingComparison, setCraftingComparison] = useState<CraftingComparison | null>(null);
  const [craftingResultItem, setCraftingResultItem] = useState<Item | null>(null);
  const [craftingError, setCraftingError] = useState<string | null>(null);
  const [comparingCrafting, setComparingCrafting] = useState(false);
  const [savingCrafting, setSavingCrafting] = useState(false);
  const [confirmingCraftingDiscard, setConfirmingCraftingDiscard] = useState(false);
  const savingCraftingRef = useRef(false);
  const t = useText(TEXT);
  const { lang } = useLang();
  const labels = useFormatLabels();
  /**
   * La incógnita canónica del craft se guarda en español (el servidor la
   * compara al resolverla); solo se traduce al enseñarla.
   */
  const unknownLabel = (label: string) =>
    lang === "en" ? (RESULT_UNKNOWN_LABELS_EN[label] ?? label) : label;

  /** Una sesión cerrada ya no admite resultados ni borradores pendientes. */
  const isOpen = session !== null && sessionIsOpen(session.status);
  const craftingDraftProfileId = profile?.id ?? null;
  const craftingDraftPatch = profile?.patch ?? null;
  const craftingDraftSessionId = session?.id ?? null;
  // El diario sustituye el objeto `session` cada vez que añade evidencia. Una
  // representación estable del experimento evita confundir esas actualizaciones
  // con la apertura de otra sesión y borrar errores que el jugador aún debe ver.
  const craftingDraftExperimentJson = session?.craftingExperiment
    ? JSON.stringify(session.craftingExperiment)
    : null;

  // El contrato de la sesión ya sobrevive en el diario; el texto observado
  // también debe sobrevivir. Al restaurarlo recalculamos el veredicto contra
  // el snapshot autoritativo, en vez de guardar una conclusión derivada como
  // si el jugador ya la hubiese confirmado.
  useEffect(() => {
    const experiment = craftingDraftExperimentJson
      ? (JSON.parse(craftingDraftExperimentJson) as CraftingExperiment)
      : null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (
        !craftingDraftProfileId ||
        !craftingDraftPatch ||
        !craftingDraftSessionId ||
        !experiment ||
        !isOpen
      ) {
        setCraftingResultText("");
        setCraftingComparison(null);
        setCraftingResultItem(null);
        setCraftingError(null);
        setComparingCrafting(false);
        return;
      }

      const restoredText = loadCraftingSessionDraft({
        profileId: craftingDraftProfileId,
        sessionId: craftingDraftSessionId,
      });
      setCraftingResultText(restoredText);
      setCraftingComparison(null);
      setCraftingResultItem(null);
      setCraftingError(null);
      if (restoredText.trim() === "") {
        setComparingCrafting(false);
        return;
      }

      setComparingCrafting(true);
      void inspectCraftingResult(restoredText, craftingDraftPatch, experiment, t)
        .then((inspected) => {
          if (cancelled) return;
          setCraftingResultItem(inspected.item);
          setCraftingComparison(inspected.comparison);
          setCraftingError(inspected.warning);
        })
        .catch((error) => {
          if (!cancelled) setCraftingError(getErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setComparingCrafting(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    craftingDraftExperimentJson,
    craftingDraftPatch,
    craftingDraftProfileId,
    craftingDraftSessionId,
    isOpen,
    t,
  ]);

  if (!profile) return null;
  const craftingResultDiagnosis = craftingResultItem
    ? diagnoseCraftingItem(craftingResultItem, lang)
    : null;

  /**
   * Una sesión cerrada (completada, descartada) no admite resultado, evidencia
   * ni pausa: el servidor los rechaza. La interfaz deja de ofrecerlos y expone
   * en su lugar una vía clara para empezar otra decisión.
   */
  const isCraftingSession = session?.craftingExperiment != null;
  const craftingGoalSignal =
    session?.craftingExperiment?.goalCategory !== undefined &&
    craftingComparison?.status === "confirmed"
      ? evaluateCraftingGoalSignal(
          session.craftingExperiment.goalCategory,
          craftingComparison.addedModifiers,
        )
      : null;
  const craftingCharacterContext =
    session?.craftingExperiment &&
    craftingComparison?.status === "confirmed" &&
    craftingResultItem
      ? evaluateCraftingCharacterContext({
          profile,
          profileGoal: goal,
          originalItem: session.craftingExperiment.originalItem,
          resultItem: craftingResultItem,
          comparison: craftingComparison,
          goalCategory: session.craftingExperiment.goalCategory,
          goalSignal: craftingGoalSignal,
        }, lang)
      : null;
  const craftingSuccessAssessment =
    session?.craftingExperiment &&
    craftingComparison?.status === "confirmed" &&
    craftingResultItem
      ? evaluateCraftingSuccessCriteria({
          criteria: session.craftingExperiment.successCriteria,
          resultItem: craftingResultItem,
        }, lang)
      : null;
  const craftingNextDecision =
    session?.craftingExperiment &&
    craftingComparison?.status === "confirmed" &&
    craftingResultItem &&
    craftingGoalSignal &&
    craftingCharacterContext
      ? decideCraftingNextStep({
          resultItem: craftingResultItem,
          comparison: craftingComparison,
          characterContext: craftingCharacterContext,
          addedGoalSignal: craftingGoalSignal,
          goalCategory: session.craftingExperiment.goalCategory,
          successAssessment: craftingSuccessAssessment,
        }, lang)
      : null;
  const showStartForm = session === null || (!isOpen && startingNew);
  const unresolvedUnknowns = (session?.unknowns ?? []).filter(
    (item) => !item.resolved,
  );
  const activeConstraints = (session?.constraints ?? []).filter(
    (item) => item.protected,
  );

  const guard = {
    journalRevision: revision ?? "missing",
    profile,
  };

  const startFromRecommendation = async () => {
    if (!pendingRecommendation || !revision) return;
    const next = await journal.startSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      kind: "guided_decision",
      objective: pendingRecommendation.title,
      hypothesis: compactRecommendationReason(pendingRecommendation.reason),
      expectedResult: pendingRecommendation.impact.description,
      observationMethod: observationMethodForRecommendation(pendingRecommendation),
      unknowns: unknown.trim()
        ? [{ label: unknown.trim(), blockingIrreversible: true }]
        : [],
      constraints: constraint.trim()
        ? [{ label: constraint.trim(), relatedItemIds: pendingRecommendation.relatedItemIds }]
        : [],
      soonReplacedItemIds: soonReplaced.trim() ? [soonReplaced.trim()] : [],
      protectedResources: [],
      recommendation: pendingRecommendation,
      budget,
      goal,
    });
    if (next) onMentorEvent?.({ type: "started", title: pendingRecommendation.title });
  };

  const startManual = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !revision ||
      objective.trim() === "" ||
      hypothesis.trim() === "" ||
      manualObservationMethod.trim() === ""
    ) return;
    const next = await journal.startSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      kind: "guided_decision",
      objective: objective.trim(),
      hypothesis: hypothesis.trim(),
      expectedResult: t.manualExpectedResult,
      // Una decisión manual puede tratar de crafting, mercado, equipo o
      // combate. El jugador declara la comprobación concreta; la app no la
      // sustituye por el consejo genérico de «juega un encuentro».
      observationMethod: manualObservationMethod.trim(),
      unknowns: unknown.trim()
        ? [{ label: unknown.trim(), blockingIrreversible: true }]
        : [],
      constraints: constraint.trim()
        ? [{ label: constraint.trim(), relatedItemIds: [] }]
        : [],
      soonReplacedItemIds: soonReplaced.trim() ? [soonReplaced.trim()] : [],
      protectedResources: [],
      recommendation: null,
      budget,
      goal,
    });
    if (next) onMentorEvent?.({ type: "started", title: objective.trim() });
    setObjective("");
    setHypothesis("");
    setManualObservationMethod("");
  };

  const pauseCurrentSession = async () => {
    if (!session || !revision) return;
    const next = await journal.pauseSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      reason: t.pauseReason,
    });
    if (next) onMentorEvent?.({ type: "paused", title: session.objective });
  };

  const abandonCurrentSession = async () => {
    if (!session || !revision) return;
    const next = await journal.abandonSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      reason: session.craftingExperiment
        ? t.abandonCraftReason
        : t.abandonReason,
    });
    if (next && session.craftingExperiment) {
      clearCraftingSessionDraft({ profileId: profile.id, sessionId: session.id });
    }
    if (next) onMentorEvent?.({ type: "result", title: session.objective });
  };

  const comparePastedCrafting = async () => {
    const experiment = session?.craftingExperiment ?? null;
    if (!experiment || craftingResultText.trim() === "") return;
    setComparingCrafting(true);
    setCraftingError(null);
    setCraftingComparison(null);
    setCraftingResultItem(null);
    try {
      const inspected = await inspectCraftingResult(
        craftingResultText,
        profile.patch,
        experiment,
        t,
      );
      setCraftingResultItem(inspected.item);
      setCraftingComparison(inspected.comparison);
      setCraftingError(inspected.warning);
    } catch (error) {
      setCraftingError(getErrorMessage(error));
    } finally {
      setComparingCrafting(false);
    }
  };

  const finishCraftingResult = async (useful: boolean) => {
    // El estado de React deshabilita la UI, pero no es un cerrojo síncrono:
    // dos eventos en el mismo frame podrían entrar antes del siguiente render.
    // Este guard evita dos cierres concurrentes y resultados que se pisen.
    if (savingCraftingRef.current) return;
    const experiment = session?.craftingExperiment ?? null;
    if (
      !session ||
      !experiment ||
      !craftingComparison ||
      craftingComparison.status !== "confirmed" ||
      !craftingResultItem ||
      !revision ||
      !profile ||
      !onApplyCraftingResult
    ) {
      return;
    }
    savingCraftingRef.current = true;
    setSavingCrafting(true);
    setCraftingError(null);
    try {
      const factualEvidence = craftingComparisonEvidence(craftingComparison, pageLang());
      // La etiqueta viaja en español: el servidor la compara con la incógnita
      // guardada al abrir la sesión.
      const resultUnknownLabel =
        experiment.resultUnknownLabel ?? CRAFTING_RESULT_UNKNOWN_LABEL;
      // Si el jugador cambió de idioma entre dos intentos, la nota ya guardada
      // puede estar en el otro: se reconoce en los dos para no duplicarla.
      const evidenceInEitherLanguage = new Set([
        craftingComparisonEvidence(craftingComparison, "es"),
        craftingComparisonEvidence(craftingComparison, "en"),
      ]);
      const evidenceAlreadySaved = session.evidence.some(
        (entry) => entry.kind === "confirmed" && evidenceInEitherLanguage.has(entry.text),
      );
      if (!evidenceAlreadySaved) {
        const afterEvidence = await journal.addEvidence({
          journalRevision: revision,
          idempotencyKey: newKey(),
          kind: "confirmed",
          text: factualEvidence,
          resolvesUnknownLabel: resultUnknownLabel,
          profile,
        });
        if (!afterEvidence) return;
      }

      // El expediente se actualiza ANTES de cerrar la sesión. Si este guardado
      // falla, el caso permanece abierto y el jugador puede reintentar.
      const applied = await onApplyCraftingResult(
        experiment.originalItem.id,
        craftingResultItem,
      );
      if (!applied) {
        setCraftingError(t.characterNotUpdated);
        return;
      }

      // Guardar el objeto cambia la huella autoritativa del personaje. Se lee
      // la revisión nueva y se reconcilia la MISMA sesión antes de cerrarla.
      const refreshed = await api.journal(profile.id);
      const reconciled = await api.reconcileSession(profile.id, {
        journalRevision: buildRecommendationMemory(refreshed, refreshed.session).revision,
        idempotencyKey: newKey(),
        profile,
      });
      const result = useful
        ? t.craftUseful(experiment.desiredOutcome)
        : t.craftNotUseful(experiment.desiredOutcome);
      await api.recordSessionResult(profile.id, {
        journalRevision: buildRecommendationMemory(reconciled, reconciled.session).revision,
        idempotencyKey: newKey(),
        result,
        subjective: true,
        outcome: useful ? "resolved" : "different",
        unexpectedValuable: null,
        conclusion: "complete",
        reopenWhen: null,
        profile,
      });
      clearCraftingSessionDraft({ profileId: profile.id, sessionId: session.id });
      const successStatus = craftingSuccessAssessment?.status ?? "not-defined";
      const decisionKind = craftingNextDecision?.kind ?? "stop";
      appendCraftingProjectAttempt(
        craftingProjectStorageKey(profile.id, experiment.originalItem.id),
        {
          sessionId: session.id,
          recordedAt: new Date().toISOString(),
          actionLabel: experiment.actionLabel,
          resultName: craftingResultItem.name || craftingResultItem.baseType,
          branch: classifyCraftingProjectBranch({
            successStatus,
            decisionKind,
            protectedStatus: craftingComparison.protectionStatus,
          }),
          decisionKind,
          decisionTitle: craftingNextDecision?.title ?? (useful ? t.resultAccepted : t.resultDiscarded),
          addedModifiers: craftingComparison.addedModifiers.map((modifier) => modifier.text),
          removedModifiers: craftingComparison.removedModifiers.map((modifier) => modifier.text),
          protectedStatus: craftingComparison.protectionStatus,
          successStatus,
        },
      );
      await journal.reload();
      onMentorEvent?.({ type: "result", title: experiment.actionLabel });
    } catch (error) {
      setCraftingError(t.notClosed(getErrorMessage(error)));
    } finally {
      savingCraftingRef.current = false;
      setSavingCrafting(false);
    }
  };

  return (
    <>
    <Card
      id={instanceId}
      tabIndex={-1}
      className="mb-6 min-w-0 max-w-full scroll-mt-20 overflow-hidden border-primary/40 outline-none"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FlaskConical className="size-5 text-primary" aria-hidden="true" />
          {isCraftingSession && isOpen
            ? t.titleCraftingOpen
            : isOpen
              ? t.titleOpen
              : t.titleIdle}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isCraftingSession && isOpen
            ? t.introCraftingOpen
            : isOpen
            ? t.introOpen
            : t.introIdle}
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 break-words">
        {journal.stale && (
          <Alert>
            <AlertTitle>{t.staleTitle}</AlertTitle>
            <AlertDescription>{t.staleBody}</AlertDescription>
          </Alert>
        )}

        {pausedSessions.length > 0 && (
          <section
            className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-3"
            data-testid="decision-paused-sessions"
            aria-labelledby={`${instanceId}-paused-title`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-200/80">
                  {t.pausedEyebrow}
                </p>
                <h3 id={`${instanceId}-paused-title`} className="font-semibold">
                  {t.pausedCount(pausedSessions.length)}
                </h3>
              </div>
              {session !== null && (
                <span className="text-xs text-muted-foreground">{t.pausedHint}</span>
              )}
            </div>
            <ul className="mt-3 grid gap-2">
              {pausedSessions.map((paused) => (
                <li
                  key={paused.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-border/70 bg-background/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{paused.objective}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {paused.craftingExperiment
                        ? `${paused.craftingExperiment.originalItem.name} · ${paused.craftingExperiment.actionLabel}`
                        : paused.conclusion?.reason ?? t.pausedFallback}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`decision-resume-${paused.id}`}
                    disabled={journal.saving || journal.stale || !revision || session !== null}
                    onClick={() => {
                      void journal.reopenSession({
                        ...guard,
                        journalRevision: revision!,
                        idempotencyKey: newKey(),
                        sessionId: paused.id,
                        note: t.resumeNote,
                      }).then((next) => {
                        if (next) onMentorEvent?.({ type: "reopened", title: paused.objective });
                      });
                    }}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t.resume}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showStartForm && (
          <form className="space-y-3" onSubmit={startManual} data-testid="decision-form-inicio">
            <div className="space-y-1">
              <Label htmlFor="decision-objetivo">{t.objectiveLabel}</Label>
              <Input
                id="decision-objetivo"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                maxLength={500}
                placeholder={t.objectivePlaceholder}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-hipotesis">{t.hypothesisLabel}</Label>
              <Textarea
                id="decision-hipotesis"
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-metodo">{t.methodLabel}</Label>
              <Textarea
                id="decision-metodo"
                value={manualObservationMethod}
                onChange={(event) => setManualObservationMethod(event.target.value)}
                maxLength={1000}
                rows={2}
                required
                placeholder={t.methodPlaceholder}
              />
              <p className="text-xs text-muted-foreground">{t.methodHint}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-incognita">{t.unknownLabel}</Label>
              <Input
                id="decision-incognita"
                value={unknown}
                onChange={(event) => setUnknown(event.target.value)}
                maxLength={400}
                placeholder={t.unknownPlaceholder}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-core">{t.coreLabel}</Label>
              <Input
                id="decision-core"
                value={constraint}
                onChange={(event) => setConstraint(event.target.value)}
                maxLength={200}
                placeholder={t.corePlaceholder}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-reemplazo">{t.replaceLabel}</Label>
              <select
                id="decision-reemplazo"
                className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={soonReplaced}
                onChange={(event) => setSoonReplaced(event.target.value)}
              >
                <option value="">{t.none}</option>
                {profile.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({labels.slot[item.slot]})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={
                  journal.saving ||
                  journal.stale ||
                  !revision ||
                  objective.trim() === "" ||
                  hypothesis.trim() === "" ||
                  manualObservationMethod.trim() === ""
                }
              >
                {journal.saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {t.startButton}
              </Button>
              {pendingRecommendation && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={journal.saving || journal.stale || !revision}
                  onClick={() => void startFromRecommendation()}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {t.startFromRecommendation}
                </Button>
              )}
            </div>
          </form>
        )}
        {session !== null && (
          <div className="space-y-4">
            {!isCraftingSession && <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{t.kindLabels[session.kind]}</Badge>
              <Badge>{t.statusLabels[session.status]}</Badge>
              {session.conclusion && (
                <Badge variant="outline">{t.conclusionLabels[session.conclusion.kind]}</Badge>
              )}
            </div>}
            {needsReconcile && (
              <Alert>
                <AlertTitle>{t.reconcileTitle}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{t.reconcileBody}</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={journal.saving || !revision}
                    onClick={() => {
                      void journal.reconcileSession({
                        ...guard,
                        journalRevision: revision!,
                        idempotencyKey: newKey(),
                      }).then((next) => {
                        if (next) onMentorEvent?.({ type: "reconciled", title: session.objective });
                      });
                    }}
                  >
                    {t.reconcileButton}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!isCraftingSession && <div>
              <h3 className="font-medium">{t.whatWeTry}</h3>
              <p>{session.objective}</p>
            </div>}
            {!isCraftingSession && <div>
              <h3 className="font-medium">{t.whyHelp}</h3>
              <p>{compactRecommendationReason(session.hypothesis)}</p>
            </div>}
            {!isCraftingSession && session.constraints.length > 0 && (
              <div>
                <h3 className="font-medium">{t.untouchable}</h3>
                <ul className="list-disc pl-5">
                  {session.constraints.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {!isCraftingSession && session.unknowns.some((item) => !item.resolved) && (
              <div>
                <h3 className="font-medium">{t.stillUnknown}</h3>
                <ul className="list-disc pl-5">
                  {session.unknowns
                    .filter((item) => !item.resolved)
                    .map((item) => (
                      <li key={item.id}>{unknownLabel(item.label)}</li>
                    ))}
                </ul>
              </div>
            )}
            {session.craftingExperiment && (
              <section
                className="space-y-4 rounded-md border border-sky-500/30 bg-sky-500/[0.05] p-4 sm:p-5"
                aria-labelledby={`${instanceId}-crafting-resultado-titulo`}
                data-testid="crafting-result-check"
              >
                <ol
                  className="grid gap-2 text-xs sm:grid-cols-3"
                  aria-label={t.craftStepsAria}
                  data-testid="crafting-location-steps"
                >
                  <li className="rounded border border-emerald-500/35 bg-emerald-500/[0.07] px-3 py-2 text-emerald-100">
                    {t.step1}
                  </li>
                  <li className={`rounded border px-3 py-2 ${
                    craftingComparison?.status === "confirmed"
                      ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-100"
                      : "border-sky-500/45 bg-sky-500/[0.08] text-sky-100"
                  }`}>
                    {t.step2}{craftingComparison?.status === "confirmed" ? " ✓" : ""}
                  </li>
                  <li className={`rounded border px-3 py-2 ${
                    craftingComparison?.status === "confirmed"
                      ? "border-primary/50 bg-primary/[0.08] text-foreground"
                      : "border-border text-muted-foreground"
                  }`}>
                    {t.step3}
                  </li>
                </ol>
                {craftingComparison?.status !== "confirmed" && <div>
                  <p className="text-xs font-semibold text-sky-200">
                    {t.closeLoop}
                  </p>
                  <h3
                    id={`${instanceId}-crafting-resultado-titulo`}
                    className="mt-1 text-lg font-semibold"
                  >
                    {t.pasteTitle}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.pasteBody(session.craftingExperiment.actionLabel)}
                  </p>
                </div>}
                {craftingComparison?.status !== "confirmed" && <dl
                  className="grid gap-2 rounded border border-sky-500/20 bg-background/30 p-3 sm:grid-cols-2"
                  data-testid="crafting-experiment-summary"
                >
                  <div>
                    <dt className="text-[11px] text-muted-foreground">{t.summaryItem}</dt>
                    <dd className="font-medium">{session.craftingExperiment.originalItem.name}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">{t.summaryCurrency}</dt>
                    <dd className="font-medium">{session.craftingExperiment.actionLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">{t.summaryGoal}</dt>
                    <dd className="font-medium">{session.craftingExperiment.desiredOutcome}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {session.craftingExperiment.actionId === "essence" ||
                      session.craftingExperiment.actionId === "alloy"
                        ? t.guaranteedEffect
                        : t.minimumTooltip}
                    </dt>
                    <dd className="font-medium">
                      {session.craftingExperiment.actionId === "essence" ||
                      session.craftingExperiment.actionId === "alloy"
                        ? session.craftingExperiment.guaranteedModifierText ?? t.notRecorded
                        : session.craftingExperiment.minimumModifierLevel === undefined
                          ? t.variantNotRecorded
                          : session.craftingExperiment.minimumModifierLevel === null
                            ? t.noMinimum
                            : t.modifierLevel(session.craftingExperiment.minimumModifierLevel)}
                    </dd>
                  </div>
                  {session.craftingExperiment.protectedModifierIds.length > 0 && (
                    <div>
                      <dt className="text-[11px] text-muted-foreground">{t.declaredProtection}</dt>
                      <dd className="font-medium">
                        {t.protectedCount(session.craftingExperiment.protectedModifierIds.length)}
                      </dd>
                    </div>
                  )}
                  {session.craftingExperiment.successCriteria.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] text-muted-foreground">{t.stopWhen}</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {session.craftingExperiment.successCriteria.map((criterion) => (
                          <span
                            key={criterion.kind}
                            className="rounded border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-1 text-xs text-emerald-100"
                          >
                            {craftingSuccessCriterionLabel(criterion, lang)}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>}
                {craftingComparison?.status !== "confirmed" && <div className="space-y-1">
                  <Label htmlFor={`${instanceId}-crafting-result-${session.id}`}>
                    {t.pastedLabel}
                  </Label>
                  <Textarea
                    id={`${instanceId}-crafting-result-${session.id}`}
                    value={craftingResultText}
                    onChange={(event) => {
                      const nextText = event.target.value;
                      setCraftingResultText(nextText);
                      saveCraftingSessionDraft(
                        { profileId: profile.id, sessionId: session.id },
                        nextText,
                      );
                      setCraftingComparison(null);
                      setCraftingResultItem(null);
                      setCraftingError(null);
                    }}
                    rows={7}
                    maxLength={50_000}
                    placeholder={t.pastePlaceholder}
                  />
                </div>}
                {craftingComparison?.status !== "confirmed" && <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void comparePastedCrafting()}
                  disabled={
                    comparingCrafting ||
                    savingCrafting ||
                    craftingResultText.trim() === ""
                  }
                >
                  {comparingCrafting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                  )}
                  {t.compareButton}
                </Button>}

                {craftingError && (
                  <Alert>
                    <AlertTitle>{t.importReviewTitle}</AlertTitle>
                    <AlertDescription>{craftingError}</AlertDescription>
                  </Alert>
                )}

                {craftingResultItem &&
                  craftingResultDiagnosis &&
                  craftingResultDiagnosis.state !== "complete" && (
                    <CraftingRepairBanner
                      item={craftingResultItem}
                      patch={profile.patch}
                      reason={
                        craftingResultDiagnosis.blockers[0] ??
                        craftingResultDiagnosis.limitations[0] ??
                        null
                      }
                      onRepaste={() => {
                        setCraftingComparison(null);
                        setCraftingResultItem(null);
                        window.requestAnimationFrame(() => {
                          document
                            .getElementById(`${instanceId}-crafting-result-${session.id}`)
                            ?.focus();
                        });
                      }}
                    />
                  )}

                {craftingComparison && (
                  <div
                    className={
                      craftingComparison.protectionStatus === "lost"
                        ? "rounded-md border border-rose-500/45 bg-rose-500/[0.09] p-4"
                        : craftingComparison.status === "confirmed"
                        ? "rounded-md border border-emerald-500/35 bg-emerald-500/[0.07] p-4"
                        : "rounded-md border border-amber-500/35 bg-amber-500/[0.07] p-4"
                    }
                    data-comparison-status={craftingComparison.status}
                  >
                    <h4 className="font-semibold">{craftingComparison.title}</h4>
                    <p className="mt-1 text-sm">{craftingComparison.summary}</p>
                    {craftingComparison.protectionStatus === "preserved" && (
                      <p className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/[0.06] p-2 text-sm text-emerald-100">
                        {t.protectedKept(craftingComparison.protectedModifiers.length)}
                      </p>
                    )}
                    {craftingComparison.addedModifiers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t.appearsNow}
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {craftingComparison.addedModifiers.map((modifier) => (
                            <li key={`${modifier.kind}-${modifier.text}`}>{modifier.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {craftingComparison.removedModifiers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t.noLongerAppears}
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {craftingComparison.removedModifiers.map((modifier) => (
                            <li key={`${modifier.kind}-${modifier.text}`}>{modifier.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {craftingComparison.warnings.length > 0 && (
                      <ul className="mt-3 list-disc pl-5 text-sm text-amber-100">
                        {craftingComparison.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                    {craftingComparison.status === "confirmed" && (
                      <div className="mt-4 space-y-2">
                        {craftingSuccessAssessment &&
                          craftingSuccessAssessment.status !== "not-defined" && (
                          <section
                            className={`rounded-md border p-3 ${
                              craftingSuccessAssessment.status === "fulfilled"
                                ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                                : craftingSuccessAssessment.status === "unknown"
                                  ? "border-amber-500/40 bg-amber-500/[0.07]"
                                  : "border-border bg-background/30"
                            }`}
                            data-testid="crafting-success-assessment"
                            data-success-status={craftingSuccessAssessment.status}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-emerald-200/80">
                                  {t.stopPoint}
                                </p>
                                <h4 className="mt-1 font-semibold">{craftingSuccessAssessment.title}</h4>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {craftingSuccessAssessment.entries.filter((entry) => entry.status === "fulfilled").length}/
                                {craftingSuccessAssessment.entries.length}
                              </span>
                            </div>
                            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                              {craftingSuccessAssessment.entries.map((entry) => (
                                <li
                                  key={entry.criterion.kind}
                                  className="rounded border border-current/15 bg-black/10 px-3 py-2 text-xs"
                                  data-criterion-status={entry.status}
                                >
                                  <span className="font-medium">
                                    {entry.status === "fulfilled"
                                      ? t.criterionFulfilled
                                      : entry.status === "not-seen"
                                        ? t.criterionNotSeen
                                        : t.criterionUnknown}
                                  </span>
                                  <span className="mt-0.5 block text-muted-foreground">{entry.label}</span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {craftingNextDecision && (
                          <div
                            className={`rounded-md border p-4 ${
                              craftingNextDecision.tone === "positive"
                                ? "border-emerald-500/45 bg-emerald-500/[0.09] text-emerald-50"
                                : craftingNextDecision.tone === "danger"
                                  ? "border-rose-500/50 bg-rose-500/[0.1] text-rose-50"
                                  : "border-amber-500/45 bg-amber-500/[0.08] text-amber-50"
                            }`}
                            data-testid="crafting-next-decision"
                            data-next-decision={craftingNextDecision.kind}
                            aria-live="polite"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="mt-0.5 rounded border border-current/25 p-2"
                                aria-hidden="true"
                              >
                                {craftingNextDecision.kind === "continue" ? (
                                  <Sparkles className="size-4" />
                                ) : craftingNextDecision.kind === "restart" ? (
                                  <RotateCcw className="size-4" />
                                ) : (
                                  <CirclePause className="size-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold opacity-75">
                                  {t.recommendedDecision}
                                </p>
                                <h4 className="mt-1 text-lg font-semibold">
                                  {craftingNextDecision.title}
                                </h4>
                                <p className="mt-1 text-sm leading-relaxed opacity-90">
                                  {craftingNextDecision.summary}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 rounded border border-current/20 bg-black/10 px-3 py-2 text-sm font-medium">
                              {craftingNextDecision.nextAction}
                            </p>
                          </div>
                        )}
                        {craftingCharacterContext && (
                          <div
                            className={`rounded border p-3 text-sm ${
                              craftingCharacterContext.verdict === "candidate"
                                ? "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100"
                                : craftingCharacterContext.verdict === "stop"
                                  ? "border-rose-500/45 bg-rose-500/[0.08] text-rose-100"
                                  : "border-amber-500/35 bg-amber-500/[0.06] text-amber-100"
                            }`}
                            data-testid="crafting-character-context"
                            data-context-verdict={craftingCharacterContext.verdict}
                          >
                            <p className="text-xs font-semibold opacity-75">
                              {t.characterReading}
                            </p>
                            <p className="mt-1 font-semibold">{craftingCharacterContext.title}</p>
                            <p className="mt-1 leading-relaxed">{craftingCharacterContext.summary}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                              <span className="rounded border border-current/25 px-2 py-1">
                                {craftingCharacterContext.requirementLabel}
                              </span>
                              <span className="rounded border border-current/25 px-2 py-1">
                                {craftingCharacterContext.protectionLabel}
                              </span>
                              {craftingGoalSignal && (
                                <span
                                  className="rounded border border-current/25 px-2 py-1"
                                  data-testid="crafting-goal-signal"
                                  data-signal-status={craftingGoalSignal.status}
                                >
                                  {craftingGoalSignal.title}
                                </span>
                              )}
                            </div>
                            {(craftingCharacterContext.facts.length > 0 ||
                              craftingCharacterContext.limitations.length > 0) && (
                              <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
                                <summary className="cursor-pointer font-medium">{t.whySays}</summary>
                                <ul className="mt-2 list-disc space-y-1 pl-4">
                                  {craftingCharacterContext.facts.map((fact) => (
                                    <li key={fact}>{fact}</li>
                                  ))}
                                  {craftingCharacterContext.limitations.map((limitation) => (
                                    <li key={limitation}>{limitation}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}
                        <p className="text-sm font-medium">
                          {craftingNextDecision
                            ? t.closeWithDecision
                            : t.doesItWork(session.craftingExperiment.desiredOutcome)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() =>
                              void finishCraftingResult(craftingNextDecision?.kind !== "restart")
                            }
                            disabled={savingCrafting || journal.saving}
                          >
                            {craftingNextDecision?.kind === "continue"
                              ? t.saveContinue
                              : craftingNextDecision?.kind === "restart"
                                ? t.saveRestart
                                : craftingNextDecision
                                  ? t.saveStop
                                  : t.yesWorks}
                          </Button>
                          {!craftingNextDecision && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void finishCraftingResult(false)}
                              disabled={savingCrafting || journal.saving}
                            >
                              {t.notWhatIWanted}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void pauseCurrentSession()}
                            disabled={savingCrafting || journal.saving}
                          >
                            {t.saveForLater}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setConfirmingCraftingDiscard(true)}
                            disabled={savingCrafting || journal.saving}
                          >
                            <CircleX className="size-4" aria-hidden="true" />
                            {t.discardNoUpdate}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t.confirmNote}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {craftingComparison?.status !== "confirmed" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void pauseCurrentSession()}
                      disabled={journal.saving || journal.stale || !revision}
                    >
                      <CirclePause className="size-4" aria-hidden="true" />
                      {t.saveForLater}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingCraftingDiscard(true)}
                      disabled={journal.saving || journal.stale || !revision}
                    >
                      <CircleX className="size-4" aria-hidden="true" />
                      {t.discardCheck}
                    </Button>
                  </div>
                )}
              </section>
            )}
            {!isCraftingSession && session.activeAction && (
              <section
                className="rounded-md border border-primary/40 bg-primary/[0.06] p-4 sm:p-5"
                aria-labelledby="prueba-activa-titulo"
                data-testid="prueba-activa"
              >
                <p className="text-xs font-semibold text-primary/75">
                  {t.nextAction}
                </p>
                <h3 id="prueba-activa-titulo" className="mt-2 text-lg font-semibold">
                  {session.activeAction.summary}
                </h3>
                <div className="mt-4 rounded-md border border-sky-500/30 bg-sky-500/[0.06] p-3">
                  <p className="text-xs font-semibold text-sky-200">
                    {t.thenObserve}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {session.activeAction.observationMethod}
                  </p>
                </div>
                {session.activeAction.blockedReason && (
                  <p className="mt-3 text-sm text-amber-200">
                    <strong>{t.beforeContinue}</strong>{" "}
                    {session.activeAction.blockedReason}
                  </p>
                )}
                {!showReturnForm && (
                  <Button
                    type="button"
                    className="mt-4"
                    data-testid="decision-volvi"
                    onClick={() => setShowReturnForm(true)}
                    disabled={journal.saving || journal.stale || needsReconcile}
                  >
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    {t.backFromPlaying}
                  </Button>
                )}
              </section>
            )}
            {!isCraftingSession && session.conclusion && (
              <p className="text-sm">
                {session.conclusion.reason}
                {session.conclusion.reopenWhen
                  ? t.reopensIf(session.conclusion.reopenWhen)
                  : ""}
              </p>
            )}
            {!isCraftingSession && session.lastResult && (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {t.lastResult}
                  {session.lastResult.outcome
                    ? ` · ${t.outcomeLabels[session.lastResult.outcome]}`
                    : ""}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {session.lastResult.text}
                  {session.lastResult.subjective
                    ? t.subjectiveNote
                    : ""}
                </p>
              </div>
            )}

            {/* Protecciones vigentes: cada una se puede retirar A CONCIENCIA, que
                es justo lo que propone el texto del conflicto. */}
            {!isCraftingSession && activeConstraints.length > 0 && (
              <div className="space-y-1" data-testid="decision-protecciones">
                <h3 className="font-medium">{t.protectedItems}</h3>
                <ul className="space-y-1 text-sm">
                  {activeConstraints.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2">
                      <span className="break-words">{item.label}</span>
                      {isOpen && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`decision-retirar-${item.id}`}
                          disabled={journal.saving || journal.stale || !revision}
                          onClick={() =>
                            void journal.releaseConstraint({
                              ...guard,
                              journalRevision: revision!,
                              idempotencyKey: newKey(),
                              constraintId: item.id,
                            })
                          }
                        >
                          {t.releaseProtection}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isOpen && (
              <Alert data-testid="decision-cerrada">
                <AlertTitle>{t.closedTitle}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{t.closedBody}</p>
                  {!startingNew && (
                    <Button
                      type="button"
                      data-testid="decision-nueva"
                      onClick={() => setStartingNew(true)}
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                      {t.startAnother}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isOpen && !isCraftingSession && (
            <>
            {showReturnForm && (
              <form
                className="space-y-4 rounded-md border border-primary/40 bg-background/60 p-4 sm:p-5"
                data-testid="decision-form-regreso"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!revision || outcome === null) return;
                  void journal
                    .recordResult({
                      ...guard,
                      journalRevision: revision,
                      idempotencyKey: newKey(),
                      result: outcomeResultText(outcome, resultText),
                      subjective,
                      outcome,
                      unexpectedValuable: valuable.trim() || null,
                      reopenWhen: reopenWhen.trim() || null,
                      conclusion: valuable.trim()
                        ? "change_strategy"
                        : reopenWhen.trim()
                          ? "discard"
                          : undefined,
                    })
                    .then((next) => {
                      if (!next) return;
                      onMentorEvent?.({ type: "result", title: session.objective });
                      setResultText("");
                      setOutcome(null);
                      setValuable("");
                      setReopenWhen("");
                      setShowReturnForm(false);
                    });
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-primary/75">
                      {t.returnEyebrow}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{t.whatHappened}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t.returnBody}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReturnForm(false)}
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {t.keepPlaying}
                  </Button>
                </div>

                <fieldset className="grid gap-2 sm:grid-cols-2">
                  <legend className="sr-only">{t.testResultLegend}</legend>
                  {decisionOutcomeOptions().map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-md border p-3 transition-colors ${
                        outcome === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/10 hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision-outcome"
                        value={option.value}
                        checked={outcome === option.value}
                        onChange={() => setOutcome(option.value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="space-y-1">
                  <Label htmlFor="session-result">{t.tellMe}</Label>
                  <Textarea
                    id="session-result"
                    value={resultText}
                    onChange={(event) => setResultText(event.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder={t.tellMePlaceholder}
                  />
                </div>

                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={subjective}
                    onChange={(event) => setSubjective(event.target.checked)}
                    className="mt-0.5"
                  />
                  {t.subjectiveCheckbox}
                </label>
                {onEditExpediente && (
                  <Button type="button" variant="outline" size="sm" onClick={onEditExpediente}>
                    {t.updateCharacter}
                  </Button>
                )}

                <details className="rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    {t.unexpectedSummary}
                  </summary>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={valuable}
                      onChange={(event) => setValuable(event.target.value)}
                      maxLength={400}
                      placeholder={t.valuablePlaceholder}
                    />
                    <Input
                      value={reopenWhen}
                      onChange={(event) => setReopenWhen(event.target.value)}
                      maxLength={1000}
                      placeholder={t.reopenPlaceholder}
                    />
                  </div>
                </details>

                <Button
                  type="submit"
                  disabled={journal.saving || journal.stale || !revision || outcome === null}
                >
                  {journal.saving && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {t.saveResult}
                </Button>
              </form>
            )}

            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                {t.advancedSummary}
              </summary>
              <div className="mt-3 space-y-4">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!revision || constraint.trim() === "") return;
                void journal.addConstraint({
                  ...guard,
                  journalRevision: revision,
                  idempotencyKey: newKey(),
                  label: constraint.trim(),
                  relatedItemIds: [],
                });
                setConstraint("");
              }}
            >
              <Label htmlFor="add-core">{t.addProtected}</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="add-core"
                  value={constraint}
                  onChange={(event) => setConstraint(event.target.value)}
                  maxLength={200}
                />
                <Button type="submit" variant="outline" disabled={journal.saving || journal.stale}>
                  <Shield className="size-4" aria-hidden="true" />
                  {t.protect}
                </Button>
              </div>
            </form>

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!revision || evidenceText.trim() === "") return;
                const chosen = unresolvedUnknowns.find(
                  (item) => item.id === resolvesUnknownId,
                );
                void journal.addEvidence({
                  ...guard,
                  journalRevision: revision,
                  idempotencyKey: newKey(),
                  kind: "confirmed",
                  text: evidenceText.trim(),
                  resolvesUnknownLabel: chosen?.label ?? null,
                });
                setEvidenceText("");
                setResolvesUnknownId("");
              }}
            >
              <Label htmlFor="session-evidence">{t.addEvidence}</Label>
              <Input
                id="session-evidence"
                value={evidenceText}
                onChange={(event) => setEvidenceText(event.target.value)}
                maxLength={2000}
              />
              {/* La incógnita que resuelve la evidencia se ELIGE aquí: antes
                  dependía del campo del formulario de inicio, que tras recargar
                  la página estaba vacío y no se podía volver a indicar. */}
              {unresolvedUnknowns.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="session-evidence-unknown">
                    {t.whichUnknown}
                  </Label>
                  <select
                    id="session-evidence-unknown"
                    data-testid="decision-selector-incognita"
                    className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={resolvesUnknownId}
                    onChange={(event) => setResolvesUnknownId(event.target.value)}
                  >
                    <option value="">{t.noneInParticular}</option>
                    {unresolvedUnknowns.map((item) => (
                      <option key={item.id} value={item.id}>
                        {unknownLabel(item.label)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button type="submit" variant="outline" disabled={journal.saving || journal.stale}>
                {t.saveEvidence}
              </Button>
            </form>
              </div>
            </details>
            </>
            )}

            {!isCraftingSession && <div className="flex flex-wrap gap-2">
              {isOpen && !isCraftingSession && (
              <Button
                type="button"
                variant="outline"
                data-testid="decision-pausar"
                disabled={journal.saving || journal.stale || !revision}
                onClick={() => {
                  void pauseCurrentSession();
                }}
              >
                <CirclePause className="size-4" aria-hidden="true" />
                {t.pause}
              </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={
                  journal.saving ||
                  journal.stale ||
                  !revision ||
                  (session.status !== "paused" &&
                    session.status !== "completed" &&
                    session.status !== "discarded")
                }
                onClick={() => {
                  void journal.reopenSession({
                    ...guard,
                    journalRevision: revision!,
                    idempotencyKey: newKey(),
                    sessionId: session.id,
                    note: t.reopenNote,
                  }).then((next) => {
                    if (next) onMentorEvent?.({ type: "reopened", title: session.objective });
                  });
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {t.reopenAsCandidate}
              </Button>
            </div>}

            {!isCraftingSession && session.evidence.length > 0 && (
              <div>
                <h3 className="font-medium">{t.evidence}</h3>
                <ul className="space-y-1 text-sm">
                  {session.evidence.map((item) => (
                    <li key={item.id}>
                      {t.evidenceKindLabels[item.kind]}: {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isCraftingSession && events.length > 0 && (
              <div>
                <h3 className="font-medium">{t.whyChanged}</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {events.map((event) => (
                    <li key={event.id}>{compactRecommendationReason(event.summary)}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    <AlertDialog open={confirmingCraftingDiscard} onOpenChange={setConfirmingCraftingDiscard}>
      <AlertDialogContent data-testid="crafting-discard-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t.discardDialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.discardDialogBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="crafting-discard-cancel">
            {t.keepChecking}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="crafting-discard-confirm"
            disabled={journal.saving || journal.stale || !revision}
            onClick={() => void abandonCurrentSession()}
          >
            {t.yesDiscard}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
