import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { toast } from "sonner";
import { BookOpen, Compass, FolderOpen, Hammer, RefreshCw } from "lucide-react";
import {
  craftingCurrencyLabel,
  type CraftingCurrencyVariant,
  type ObservedCraftingAction,
} from "@shared/craftingActions.js";
import { CRAFTING_RESULT_UNKNOWN_LABEL } from "@shared/craftingComparison.js";
import type { CraftingObjective } from "@shared/craftingProtection.js";
import {
  ALLOY_RESULT_UNKNOWN_LABEL,
  type AlloyEvaluation,
  type AlloyPlanInput,
} from "@shared/craftingAlloys.js";
import {
  ESSENCE_RESULT_UNKNOWN_LABEL,
  ESSENCE_TIER_LABELS,
  ESSENCE_TIER_LABELS_EN,
  type EssenceEvaluation,
  type EssencePlanInput,
} from "@shared/craftingEssences.js";
import type {
  Budget,
  CharacterProfile,
  GoalKind,
  Item,
  Recommendation,
} from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import {
  assessCharacterReadiness,
  assessMentorReadiness,
} from "@shared/characterReadiness.js";
import { hasCraftingCharacterContext } from "@shared/craftingCharacterContext.js";
import type { MentorAnswer } from "@shared/mentorQuery.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import type { FeaturedBuild } from "@shared/featuredBuilds.js";
import {
  GGG_AFFILIATION_NOTICE,
  GGG_AFFILIATION_NOTICE_ES,
  type PlanResolution,
} from "@shared/passiveRegistry.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
import { ContextualMentor } from "@/components/ContextualMentor";
import { DataPrivacyDialog } from "@/components/DataPrivacyDialog";
import { ReportProblemDialog, ReportProblemLink } from "@/components/ReportProblemDialog";
import { QuickCharacterDialog } from "@/components/QuickCharacterDialog";
import { WelcomePanel } from "@/components/WelcomePanel";
import { MentorBriefing, OpenCase, OpenCaseSecondary } from "@/components/OpenCase";
import { OpenCaseEvidence } from "@/components/OpenCaseEvidence";
import { OpenCaseRecommendation } from "@/components/OpenCaseRecommendation";
import { ExpedienteSection } from "@/sections/ExpedienteSection";
import { PassiveTreeCard } from "@/components/PassiveTreeCard";
import { ResumeBanner } from "@/components/ResumeBanner";
import { CharacterStrip } from "@/components/CharacterStrip";
import { MentorQuickAsk } from "@/components/MentorQuickAsk";
import { RecommendationsSection } from "@/sections/RecommendationsSection";
import { OPEN_REVIEW_EVENT, QuickReviewCard } from "@/components/QuickReviewCard";
import { SkillGemTeaser } from "@/components/SkillGemTeaser";
import { mascotNextStep, reviewKnowsBasics } from "@/lib/mascotNextStep";
import { useQuickReviewForm } from "@/hooks/useQuickReviewForm";
import { cn } from "@/lib/utils";
import { profileWithQuickReview, toInput as quickReviewInput } from "@/lib/quickReviewForm";
import type { TargetDraft } from "@/sections/TargetSection";
import { useCharacter } from "@/hooks/useCharacter";
import { useEditorDrafts } from "@/hooks/useEditorDrafts";
import { useMarket } from "@/hooks/useMarket";
import { useFeaturedBuilds } from "@/hooks/useFeaturedBuilds";
import { useMeta } from "@/hooks/useMeta";
import { useRecommendations } from "@/hooks/useRecommendations";
import { buildRecommendationsRequest } from "@/lib/recommendationsRequest";
import { journalNowTracksVisibleRecommendation } from "@shared/recommendationInvalidation.js";
import {
  compactRecommendationReason,
  journalEntryFromRecommendation,
} from "@/lib/journal";
import { openCaseLimitations, selectOpenCase } from "@/lib/openCase";
import { observationMethodForRecommendation } from "@/lib/sessionOutcome";
import { MentorChatSection } from "@/sections/MentorChatSection";
import { useMentor } from "@/hooks/useMentor";
import { buildMentorRequest } from "@/lib/mentorRequest";
import { buildTargetFromDraft } from "@/lib/buildTarget";
import {
  loadPlanningWorkspaceProgress,
  savePlanningWorkspaceProgress,
} from "@/lib/planningWorkspaceProgress";
import { mentorInputsKey } from "@shared/mentorQuery.js";
import { useJournal } from "@/hooks/useJournal";
import { JournalSection } from "@/sections/JournalSection";
import {
  DEFAULT_GUIDE_SLUG,
  DIRECT_TOOL_TEST_ID,
  directToolFromSearch,
  guidePageTitleFor,
  guidePath,
  guideSlugFromPath,
} from "@/guides/routes";

const CraftingSection = lazy(() =>
  import("@/sections/CraftingSection").then((module) => ({
    default: module.CraftingSection,
  })),
);
const CharacterSection = lazy(() =>
  import("@/sections/CharacterSection").then((module) => ({
    default: module.CharacterSection,
  })),
);
const TargetSection = lazy(() =>
  import("@/sections/TargetSection").then((module) => ({
    default: module.TargetSection,
  })),
);
const MarketSection = lazy(() =>
  import("@/sections/MarketSection").then((module) => ({
    default: module.MarketSection,
  })),
);
const FeaturedBuildsSection = lazy(() =>
  import("@/sections/FeaturedBuildsSection").then((module) => ({
    default: module.FeaturedBuildsSection,
  })),
);

/*
 * Las guías y la sesión de decisión pesan mucho y no hacen falta para pintar
 * la portada: van en archivos aparte. Se piden en cuanto el navegador queda
 * libre (o al momento, si se entra por una guía), así que cuando el jugador
 * llega a ellas ya suelen estar descargadas.
 */
const loadGuidesSection = () => import("@/sections/GuidesSection");
const loadDecisionSessionSection = () => import("@/sections/DecisionSessionSection");
const LazyGuidesSection = lazy(() =>
  loadGuidesSection().then((module) => ({ default: module.GuidesSection })),
);
const LazyDecisionSessionSection = lazy(() =>
  loadDecisionSessionSection().then((module) => ({ default: module.DecisionSessionSection })),
);

function GuidesSection(props: ComponentProps<typeof LazyGuidesSection>) {
  const t = useText(APP_TEXT);
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] p-6 text-sm text-muted-foreground" role="status">
          {t.guidesLoading}
        </div>
      }
    >
      <LazyGuidesSection {...props} />
    </Suspense>
  );
}

function DecisionSessionSection(props: ComponentProps<typeof LazyDecisionSessionSection>) {
  return (
    <Suspense fallback={null}>
      <LazyDecisionSessionSection {...props} />
    </Suspense>
  );
}

function preloadHeavySections(): void {
  void loadGuidesSection();
  void loadDecisionSessionSection();
}
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import { pageLang, texts, useLang, useText } from "@/i18n/lang";
import { CRAFTING_DECISION_TEXT } from "@/lib/craftingDecisionText";
import { noCountChange, sendAreaBeacon } from "@/lib/visitBeacon";
import { englishMentorCue } from "@/lib/contextualMentorEn";
import {
  contextualMentorCue,
  type ContextualMentorAsk,
  type ContextualMentorEvent,
} from "@/lib/contextualMentor";
import {
  allowsPatchGuidance,
  compatibilityForPatch,
  localizePatchCompatibility,
  type PatchCompatibilityRecord,
} from "@shared/patchCompatibility.js";

const EMPTY_TARGET: TargetDraft = {
  name: "",
  sourceUrl: "",
  summary: "",
  desiredModsText: "",
  plan: null,
};

/**
 * Las tres áreas principales del espacio de trabajo.
 *
 * «Personaje» ya no es un área: su editor completo sigue existiendo una sola
 * vez, dentro del panel lateral «Editar expediente».
 */
type WorkspaceTab = "expediente" | "plan" | "crafting" | "guias";
type EditorPrompt = "memory" | "new" | "item" | "gear" | "import" | "pob" | null;

const APP_TITLE = typeof document === "undefined" ? "" : document.title;
/** El título de la portada para quien la ve en inglés (el del HTML es el español). */
const APP_TITLE_EN = "Exile Copilot · Path of Exile 2 guides and mentor for new players";

function openedFromGuideUrl(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/guias");
}

/**
 * `?open=gems` o `?open=compare` en la dirección de entrada: la web abre esa
 * herramienta directamente. Se lee una vez, al cargar, antes de que la web
 * cambie la dirección.
 */
const REQUESTED_TOOL = typeof window === "undefined" ? null : directToolFromSearch(window.location.search);

/**
 * Baja hasta un elemento en cuanto está pintado y a la vista. Las áreas se
 * descargan aparte y pueden tardar un momento: se reintenta unos segundos.
 * Devuelve cómo cancelarlo.
 */
function scrollToWhenPainted(selector: string): () => void {
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    const target = document.querySelector<HTMLElement>(selector);
    if (target && target.offsetParent !== null) {
      // Deja a la vista el título bajo la cabecera y la barra de áreas, que son fijas.
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 132 });
      window.clearInterval(timer);
    } else if (tries >= 40) {
      window.clearInterval(timer);
    }
  }, 150);
  return () => window.clearInterval(timer);
}

/**
 * Los paneles se mantienen MONTADOS (`forceMount`) y se ocultan con CSS.
 * Cambiar de área no puede perder campos sin guardar, resultados generados ni
 * la conversación: buena parte de ese estado es local de cada sección.
 */
const PANEL_CLASSES =
  // La altura mínima deja el pie fuera de la primera pantalla: sin ella, el pie
  // se veía un instante al cargar y saltaba hacia abajo al entrar el contenido.
  "flex min-h-[calc(100svh-7rem)] flex-col gap-6 focus-visible:outline-none data-[state=inactive]:hidden xl:col-start-2 xl:row-start-2";

function deferEffect(task: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) task();
  });
  return () => {
    cancelled = true;
  };
}

const APP_TEXT = texts(
  {
    backArea: "Volver al área anterior",
    backCharacters: "Volver a personajes",
    metaErrorTitle: "No se pudo cargar una parte de la web",
    metaErrorText: " Puedes seguir usándola; algunas listas (ligas, objetivos) pueden salir incompletas.",
    reconnecting: "Reconectando…",
    retry: "Reintentar conexión",
    areas: "Áreas de Exile Copilot",
    dossierShort: "Personaje",
    dossier: "Personaje y mentor",
    dossierHint: "Tu personaje y qué mejorar primero",
    planShort: "Plan",
    plan: "Plan y mercado",
    planHint: "Objetivo, presupuesto y precios",
    crafting: "Crafting",
    craftingHint: "Mejorar un objeto paso a paso",
    guidesTitle: "Guías por acto",
    guides: "Guías",
    guidesHint: "Cómo pasar cada acto sin morir",
    pricesNote: "Los precios proceden de poe.ninja y las referencias de builds de la comunidad no están verificadas.",
    patchBlocked: (patch: string) =>
      `El parche ${patch} aún no está revisado. No analizaré mejoras ni acciones mecánicas con datos anteriores.`,
    completeFirst: (what: string) => `Completa ${what} antes de pedirme una prioridad del personaje.`,
    journalChanged: "El diario cambió en otra pestaña. He retirado el diagnóstico anterior.",
    targetAdded: "Build añadida como objetivo",
    targetAddedDetail: "Tu personaje actual no se ha modificado.",
    regenerate: "Los datos han cambiado — vuelve a generar las recomendaciones",
    mentorReset: "Los datos han cambiado — la conversación con el mentor se ha reiniciado",
    completeToSave: "Completa tu personaje antes de guardar esta acción",
    completeToCheck: "Completa tu personaje antes de comprobar esta mejora",
    missing: (what: string) => `Faltan ${what}.`,
    memoryError: "El personaje se guardó, pero no pude abrir su memoria",
    memoryErrorDetail: "La acción elegida no se ha ejecutado. Vuelve a intentarlo desde el caso abierto.",
    restoreTitle: "No pudimos abrir tu personaje guardado",
    restoreKeep: " No crees otro personaje todavía: tus datos no se han descartado.",
    restoring: "Recuperando…",
    restoreRetry: "Reintentar recuperación",
    noCountOn: "Este navegador ya no cuenta en las estadísticas.",
    noCountOff: "Este navegador vuelve a contar en las estadísticas.",
    craftingRunning: "Crafting en curso",
    craftingChecking: (action: string, item: string) =>
      `Estás comprobando ${action} en ${item}. El preflight y el resultado viven en el banco de Crafting para no duplicar la sesión.`,
    craftingContinue: "Continuar en Crafting",
    planLoading: "Preparando el plan y el mercado…",
    guidesLoading: "Abriendo las guías…",
    planTitle: "Decide el rumbo antes de gastar",
    savedStep: "Siguiente paso guardado",
    openFollowUp: "Abrir seguimiento",
    unknownPatch: "Desconocido",
    sheetMemoryTitle: "Guardar y continuar",
    sheetItemTitle: "Evaluar un objeto",
    sheetGearTitle: "Añadir equipo",
    sheetGearText: "En el juego, pon el ratón sobre una pieza y pulsa Ctrl+Alt+C. Pégala aquí: se guarda sola y puedes pegar otra. Si la ranura ya está ocupada, te pregunto cuál sustituir.",
    sheetNewTitle: "Crear personaje",
    sheetImportTitle: "Añadir tu personaje",
    sheetEditTitle: "Editar personaje",
    sheetMemoryText: "Guarda este personaje para que el mentor pueda recordar próximos pasos y sesiones.",
    sheetItemText: "Pega el texto del objeto copiado en PoE2. Al analizarlo pasarás directamente al banco de Crafting.",
    sheetNewText: "Completa únicamente lo que sabes. Los datos desconocidos pueden quedarse vacíos.",
    sheetImportText: "Trae tu personaje actual desde Path of Building 2. Los archivos .build de objetivo se importan en Plan y mercado.",
    sheetEditText: "Corrige o completa los datos de tu personaje. Los cambios se guardan con «Guardar correcciones».",
    editorLoading: "Preparando el editor…",
    affiliation: GGG_AFFILIATION_NOTICE_ES,
  },
  {
    backArea: "Back to the previous area",
    backCharacters: "Back to characters",
    metaErrorTitle: "Part of the site didn't load",
    metaErrorText: " You can keep using it; some lists (leagues, goals) may be incomplete.",
    reconnecting: "Reconnecting…",
    retry: "Retry connection",
    areas: "Exile Copilot areas",
    dossierShort: "Character",
    dossier: "Character & mentor",
    dossierHint: "Your character and what to improve first",
    planShort: "Plan",
    plan: "Plan & market",
    planHint: "Goal, budget and prices",
    crafting: "Crafting",
    craftingHint: "Improve an item step by step",
    guidesTitle: "Act guides",
    guides: "Guides",
    guidesHint: "How to get through each act alive",
    pricesNote: "Prices come from poe.ninja, and community build references are not verified.",
    patchBlocked: (patch: string) =>
      `Patch ${patch} hasn't been reviewed yet. I won't analyse upgrades or mechanical actions with older data.`,
    completeFirst: (what: string) => `Fill in ${what} before asking me for a character priority.`,
    journalChanged: "Your journal changed in another tab. I removed the previous diagnosis.",
    targetAdded: "Build added as your target",
    targetAddedDetail: "Your current character hasn't changed.",
    regenerate: "Your data changed — generate the recommendations again",
    mentorReset: "Your data changed — the mentor conversation was restarted",
    completeToSave: "Complete your character before saving this action",
    completeToCheck: "Complete your character before checking this upgrade",
    missing: (what: string) => `Missing: ${what}.`,
    memoryError: "Your character was saved, but I couldn't open its memory",
    memoryErrorDetail: "The chosen action didn't run. Try again from the open case.",
    restoreTitle: "We couldn't open your saved character",
    restoreKeep: " Don't create another character yet: your data hasn't been thrown away.",
    restoring: "Recovering…",
    restoreRetry: "Retry recovery",
    noCountOn: "This browser no longer counts in the stats.",
    noCountOff: "This browser counts in the stats again.",
    craftingRunning: "Crafting in progress",
    craftingChecking: (action: string, item: string) =>
      `You're checking ${action} on ${item}. The preflight and the result live in the Crafting bench so the session isn't duplicated.`,
    craftingContinue: "Continue in Crafting",
    planLoading: "Getting the plan and market ready…",
    guidesLoading: "Opening the guides…",
    planTitle: "Pick your direction before spending",
    savedStep: "Saved next step",
    openFollowUp: "Open follow-up",
    unknownPatch: "Unknown",
    sheetMemoryTitle: "Save and continue",
    sheetItemTitle: "Check an item",
    sheetGearTitle: "Add gear",
    sheetGearText: "In game, hover an item and press Ctrl+Alt+C. Paste it here: it saves by itself and you can paste another. If the slot is taken, I'll ask which one to replace.",
    sheetNewTitle: "Create a character",
    sheetImportTitle: "Add your character",
    sheetEditTitle: "Edit your character",
    sheetMemoryText: "Save this character so the mentor can remember your next steps and sessions.",
    sheetItemText: "Paste the item text you copied in PoE2. Once it's analysed you'll go straight to the Crafting bench.",
    sheetNewText: "Fill in only what you know. Anything you don't know can stay empty.",
    sheetImportText: "Bring your current character over from Path of Building 2. Target .build files are imported in Plan & market.",
    sheetEditText: "Correct or complete your character's details. Changes are saved with “Save changes”.",
    editorLoading: "Getting the editor ready…",
    affiliation: GGG_AFFILIATION_NOTICE,
  },
);

export default function App() {
  const t = useText(APP_TEXT);
  const { lang } = useLang();
  useEffect(() => {
    // Quien entra por una guía la necesita ya; el resto, cuando haya un hueco.
    if (openedFromGuideUrl()) {
      preloadHeavySections();
      return;
    }
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(preloadHeavySections, { timeout: 2500 })
      : window.setTimeout(preloadHeavySections, 1200);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);
  const {
    health,
    meta,
    loading: metaLoading,
    error: metaError,
    reload: reloadMeta,
  } = useMeta();

  // Plan, objetivo y presupuesto pertenecen al espacio de trabajo del jugador,
  // no a un render concreto. Se restauran de forma síncrona para que una
  // recarga nunca pinte primero un plan vacío y lo sobrescriba después.
  const initialPlanningWorkspace = useMemo(
    () => loadPlanningWorkspaceProgress(),
    [],
  );

  const [league, setLeague] = useState("");
  const [patch, setPatch] = useState("");
  const [budget, setBudget] = useState<Budget | null>(
    initialPlanningWorkspace?.budget ?? null,
  );
  const [goal, setGoal] = useState<GoalKind>(
    initialPlanningWorkspace?.goal ?? "balanced",
  );
  const [targetDraft, setTargetDraft] = useState<TargetDraft>(
    initialPlanningWorkspace?.targetDraft ?? EMPTY_TARGET,
  );
  const [targetWarnings, setTargetWarnings] = useState<string[]>(
    initialPlanningWorkspace?.targetWarnings ?? [],
  );
  // Resolución de ids del plan contra el registro oficial: se guarda APARTE del
  // plan para no alterar nunca el `.build` crudo que se reexporta.
  const [targetResolution, setTargetResolution] = useState<PlanResolution | null>(
    initialPlanningWorkspace?.targetResolution ?? null,
  );
  // Navegación caso → objeto (solo con vínculo estructurado del motor).
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  // Elemento que abrió el detalle: puede ser un hueco del paperdoll o el botón
  // «Ver el objeto evaluado» del caso. Al cerrar se le devuelve el foco.
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  // Guía abierta en «Guías». Cada una tiene su dirección (/guias/acto-2) para
  // poder enlazarla y abrirla directamente.
  const [guideSlug, setGuideSlug] = useState(
    () =>
      (typeof window === "undefined" ? null : guideSlugFromPath(window.location.pathname)) ??
      DEFAULT_GUIDE_SLUG,
  );
  const [tab, setTab] = useState<WorkspaceTab>(() =>
    openedFromGuideUrl() || REQUESTED_TOOL !== null
      ? "guias"
      : (initialPlanningWorkspace?.activeWorkspace ?? "expediente"),
  );
  // Contador anónimo: qué áreas abre cada visita (una vez cada una), en la web publicada.
  useEffect(() => {
    if (import.meta.env.PROD) sendAreaBeacon(tab);
  }, [tab]);
  // Las áreas pesadas se descargan al visitarlas por primera vez y después
  // permanecen montadas para no perder formularios, selección ni sesiones.
  const [mountedWorkspaces, setMountedWorkspaces] = useState<Set<WorkspaceTab>>(
    () =>
      new Set([
        "expediente",
        openedFromGuideUrl() ? "guias" : (initialPlanningWorkspace?.activeWorkspace ?? "expediente"),
      ]),
  );
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceTab[]>(
    initialPlanningWorkspace?.activeWorkspace &&
      initialPlanningWorkspace.activeWorkspace !== "expediente"
      ? ["expediente"]
      : [],
  );
  const [craftingRequestedItemId, setCraftingRequestedItemId] = useState<string | null>(null);
  // Panel lateral con el editor completo del personaje.
  const [editorOpen, setEditorOpen] = useState(false);
  // Alta corta de personaje: clase, build en una frase y habilidades.
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  /** true = el alta corta completa el personaje cargado en vez de crear otro. */
  const [quickCompleting, setQuickCompleting] = useState(false);
  const [editorPrompt, setEditorPrompt] = useState<EditorPrompt>(null);
  const [mentorBriefingOpen, setMentorBriefingOpen] = useState(false);
  const [mentorQuickQuestion, setMentorQuickQuestion] = useState<{
    text: string;
    seq: number;
  } | null>(null);
  // «Avisar de un problema»: se abre desde el pie de página y desde la mascota.
  const [reportOpen, setReportOpen] = useState(false);
  // «¿Te has atascado?» de la mascota: qué vista de la guía abrir.
  const [guideViewRequest, setGuideViewRequest] = useState<{
    view: "guia" | "comprobar" | "herramientas";
    seq: number;
  } | null>(() => (REQUESTED_TOOL === null ? null : { view: "herramientas", seq: 1 }));
  // `?nocount=1`: se confirma una vez, para que quien lo abre sepa que funcionó.
  useEffect(() => {
    const change = noCountChange();
    if (change === "on") toast.success(t.noCountOn);
    else if (change === "off") toast.info(t.noCountOff);
    // Solo al cargar: el idioma del aviso es el de ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Un enlace directo a una herramienta baja hasta ella en cuanto está pintada
  // (el área de guías se descarga aparte y puede tardar un momento).
  useEffect(() => {
    if (REQUESTED_TOOL === null) return;
    return scrollToWhenPainted(`[data-testid="${DIRECT_TOOL_TEST_ID[REQUESTED_TOOL]}"]`);
  }, []);
  // «Compararla con otra» desde Crafting: la pieza que viaja a la comparación.
  const [compareRequest, setCompareRequest] = useState<{ item: Item; seq: number } | null>(null);
  // Se guarda el último aviso y no su texto: así, al cambiar de idioma, la
  // mascota repite el mismo aviso en el idioma nuevo.
  const [contextualEvent, setContextualEvent] = useState<ContextualMentorEvent>({ type: "welcome" });
  const contextualCue = useMemo(
    () => (lang === "en" ? englishMentorCue(contextualEvent) : contextualMentorCue(contextualEvent)),
    [contextualEvent, lang],
  );
  const [contextualAnswer, setContextualAnswer] = useState<MentorAnswer | null>(null);
  const [contextualError, setContextualError] = useState<string | null>(null);
  const [contextualLoadingSeq, setContextualLoadingSeq] = useState<number | null>(null);
  // El mentor reacciona siempre en su cabecera, pero empieza plegado: así no
  // tapa acciones del expediente ni obliga al jugador a cerrar un overlay nada
  // más entrar. Desplegarlo es una decisión explícita que luego se conserva.
  const [contextualCollapsed, setContextualCollapsed] = useState(true);
  const contextualSeqRef = useRef(0);
  const budgetCueTimerRef = useRef<number | null>(null);
  const announcedPlanRef = useRef<BuildTargetPlan | null>(null);
  const pendingMemoryActionRef = useRef<{
    kind: "track" | "session";
    recommendation: Recommendation;
  } | null>(null);
  // Borradores del editor: viven fuera del panel para sobrevivir a su cierre.
  const editorDrafts = useEditorDrafts();

  useEffect(() => {
    savePlanningWorkspaceProgress({
      schemaVersion: 1,
      targetDraft,
      targetWarnings,
      targetResolution,
      budget,
      goal,
      activeWorkspace: tab,
    });
  }, [targetDraft, targetWarnings, targetResolution, budget, goal, tab]);

  // Un `.build` oficial importado es un PLAN: rellena la sección Build objetivo.
  const characterOptions = useMemo(
    () => ({
      onPlanImported: (
        plan: BuildTargetPlan,
        warns: string[],
        resolution: PlanResolution | null,
      ) => {
        setTargetDraft({
          name: plan.build.name,
          sourceUrl: plan.build.link ?? plan.sourceUrl ?? "",
          summary: plan.build.description ?? "",
          desiredModsText: "",
          plan,
        });
        setTargetWarnings(warns);
        setTargetResolution(resolution);
        // Un `.build` termina siempre en su mesa correcta y deja intacto el
        // personaje actual. Si llegó desde el alta, cerramos ese panel.
        setEditorOpen(false);
        setEditorPrompt(null);
        setMountedWorkspaces((current) => new Set(current).add("plan"));
        setTab("plan");
      },
    }),
    [],
  );
  const character = useCharacter(characterOptions);
  // El borrador conserva su id para poder guardarlo y comenzar una sesión en el
  // mismo gesto. El diario privado, sin embargo, no se consulta automáticamente
  // hasta que el perfil ya ha sido persistido para este visitante.
  const journal = useJournal(character.profile?.id ?? null, character.persisted);
  const mentor = useMentor();
  // Lo que el jugador ya contestó en la revisión rápida (se relee al cambiar).
  const quickReviewForm = useQuickReviewForm(character.profile);
  // El personaje que ven el motor y el Mentor: el guardado más esas respuestas
  // (nivel, habilidad principal, resistencias). Ver `profileWithQuickReview`.
  const engineProfile = useMemo(
    () => (character.profile ? profileWithQuickReview(character.profile, quickReviewForm) : null),
    [character.profile, quickReviewForm],
  );
  const characterJournal =
    character.profile && journal.journal?.characterId === character.profile.id
      ? journal.journal
      : null;
  const characterJournalLoading =
    character.persisted &&
    character.profile !== null &&
    (journal.loading || characterJournal === null);
  const market = useMarket();
  const recommendations = useRecommendations();
  const { resultInputsKey, clear } = recommendations;
  const {
    threadInputsKey: mentorThreadKey,
    clear: clearMentor,
    hydrate: hydrateMentor,
  } = mentor;

  const announceMentor = useCallback((event: ContextualMentorEvent) => {
    contextualSeqRef.current += 1;
    setContextualEvent(event);
    setContextualAnswer(null);
    setContextualError(null);
    setContextualLoadingSeq(null);
  }, []);

  /**
   * Marcas «ya la apliqué». Viven aquí porque la recomendación dominante se
   * pinta en el Caso Abierto y las demás en «Otras posibilidades»: si el estado
   * siguiera dentro de `RecommendationsSection`, la principal no podría
   * marcarse para la exportación.
   *
   * Cada generación (o invalidación) parte de cero: una marca de una generación
   * anterior nunca sobrevive como «mejora aplicada». (Ajuste de estado durante
   * el render, patrón recomendado por React.)
   */
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  const [lastResult, setLastResult] = useState(recommendations.result);
  if (recommendations.result !== lastResult) {
    setLastResult(recommendations.result);
    setAppliedIds({});
  }
  // Recuperación del 409: si el diario quedó obsoleto (otra pestaña escribió),
  // las recomendaciones y la conversación que se veían ya no corresponden a la
  // memoria vigente y se retiran en lugar de quedar en pantalla.
  useEffect(() => {
    return deferEffect(() => {
      if (journal.stale) {
        clear();
        clearMentor();
        announceMentor({
          type: "error",
          area: "diario",
          message: APP_TEXT[pageLang()].journalChanged,
        });
      }
    });
  }, [journal.stale, clear, clearMentor, announceMentor]);

  const hasProfile = character.profile !== null;
  const activePatchId = character.profile?.patch || patch || health?.patch.id || "";
  // La selección es de la temporada en curso: su liga principal y el parche
  // real del juego, no la liga que el jugador tenga elegida para precios ni el
  // parche que la web tiene revisado.
  // Hasta saber cuáles son, no se pide nada (así no hay una petición de más).
  const featuredBuilds = useFeaturedBuilds(
    meta ? (meta.leagues[0] ?? league) : "",
    health ? (health.livePatch?.id ?? activePatchId) : "",
  );
  const activePatchCompatibility = useMemo<PatchCompatibilityRecord | null>(() => {
    // Resumen y notas en el idioma de la página; los estados no cambian.
    if (meta && activePatchId) {
      return localizePatchCompatibility(compatibilityForPatch(meta.compatibility, activePatchId), lang);
    }
    if (health && activePatchId === health.patch.id) return localizePatchCompatibility(health.compatibility, lang);
    return null;
  }, [activePatchId, health, lang, meta]);
  const patchGuidanceBlocked =
    activePatchCompatibility !== null && !allowsPatchGuidance(activePatchCompatibility);

  const useFeaturedBuildAsTarget = useCallback((build: FeaturedBuild) => {
    setTargetDraft({
      name: build.title,
      sourceUrl: build.source.url,
      summary:
        pageLang() === "en"
          ? `${build.summary}\n\nWhy it was picked: ${build.whyFeatured}\nMain limit: ${build.caveats[0]}`
          : `${build.summary}\n\nMotivo de la selección: ${build.whyFeatured}\nLímite principal: ${build.caveats[0]}`,
      desiredModsText: build.desiredMods.join("\n"),
      plan: null,
    });
    setTargetWarnings([]);
    setTargetResolution(null);
    announceMentor({ type: "planImported", name: build.title });
    toast.success(APP_TEXT[pageLang()].targetAdded, {
      description: APP_TEXT[pageLang()].targetAddedDetail,
    });
  }, [announceMentor]);

  // Valores por defecto en cuanto llegan /api/meta y /api/health.
  useEffect(() => {
    return deferEffect(() => {
      if (meta && !league && meta.leagues.length > 0) {
        setLeague(meta.leagues[0]);
      }
      if (!patch) {
        // /health identifica el parche operativo configurado. El orden de
        // patches.json también contiene versiones anunciadas y nunca debe
        // adelantar el producto a una versión todavía bloqueada.
        if (health) {
          setPatch(health.patch.id);
        } else if (meta && meta.patches.length > 0) {
          setPatch(
            meta.patches.find((candidate) => candidate.status !== "announced")?.id ??
              meta.patches[0].id,
          );
        }
      }
    });
  }, [meta, health, league, patch]);

  // Si el perfil importado/restaurado trae liga y parche propios, respetarlos.
  useEffect(() => {
    return deferEffect(() => {
      const profile = character.profile;
      if (profile) {
        setLeague(profile.league || league);
        setPatch(profile.patch || patch);
      }
    });
    // Solo reacciona al cambio de perfil cargado, no a cada edición de campos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.profile?.id]);

  // El parche del personaje manda: si el jugador lo corrige en el expediente,
  // las peticiones dejan de usar el anterior (el servidor rechaza mezclarlos).
  const profilePatch = character.profile?.patch;
  useEffect(() => {
    return deferEffect(() => {
      if (profilePatch) setPatch(profilePatch);
    });
  }, [profilePatch]);

  // Invalidación: si los inputs cambian tras generar, las recomendaciones quedan obsoletas.
  const currentInputsKey = engineProfile
    ? JSON.stringify(
        buildRecommendationsRequest(
          engineProfile,
          targetDraft,
          budget,
          goal,
          league,
          patch,
          characterJournal,
        ),
      )
    : null;
  useEffect(() => {
    return deferEffect(() => {
      if (resultInputsKey && resultInputsKey !== currentInputsKey) {
        if (budgetCueTimerRef.current !== null) {
          window.clearTimeout(budgetCueTimerRef.current);
          budgetCueTimerRef.current = null;
        }
        if (
          journalNowTracksVisibleRecommendation(
            recommendations.result,
            characterJournal,
          )
        ) {
          // El propio consejo acaba de convertirse en el paso activo. El lote
          // anterior ya no debe seguir accionable, pero no ha cambiado ningún
          // dato del personaje: retirar en silencio evita un falso aviso de
          // invalidación justo después de confirmar el guardado.
          clear();
          return;
        }
        clear();
        toast.info(APP_TEXT[pageLang()].regenerate);
        announceMentor({ type: "invalidated" });
      }
    });
  }, [
    currentInputsKey,
    resultInputsKey,
    recommendations.result,
    characterJournal,
    clear,
    announceMentor,
  ]);

  // Mentor v4 conserva el hilo durante la sesión, pero lo descarta en cuanto
  // cambian los inputs relevantes: nunca restaura respuestas obsoletas.
  const currentMentorContextItemId =
    tab === "crafting" ? craftingRequestedItemId : focusedItemId;
  const currentMentorContextItem = character.profile?.items.find(
    (item) => item.id === currentMentorContextItemId,
  );
  const currentMentorEnvelope: import("@shared/mentorContext.js").ContextEnvelope | undefined =
    character.profile
      ? {
          version: "1.0",
          activeArea: tab === "guias" ? "expediente" : tab,
          character: {
            level: character.profile.level,
            characterClass: character.profile.characterClass,
          },
          targetBuild: targetDraft.name || null,
          selectedItem: currentMentorContextItem
            ? {
                id: currentMentorContextItem.id,
                name: currentMentorContextItem.name || currentMentorContextItem.baseType,
              }
            : null,
          craftingState:
            tab === "crafting" ? (contextualCue.ask?.craftingState ?? null) : null,
          activeRecommendationId: null,
          market: {
            budgetAmount: budget?.amount ?? null,
            budgetCurrency: budget?.currency ?? null,
            league: league || "Desconocida",
          },
          sessionActive:
            characterJournal?.session !== null && characterJournal?.session !== undefined,
          lastAction: null,
        }
      : undefined;
  const currentMentorInputsKey = engineProfile
    ? mentorInputsKey(
        buildMentorRequest(
          "",
          engineProfile,
          targetDraft,
          budget,
          goal,
          league,
          patch,
          characterJournal,
          undefined,
          currentMentorEnvelope,
        ),
      )
    : null;
  useEffect(() => {
    // Durante la restauración inicial el perfil todavía puede ser null durante
    // un render. Esperamos a disponer de la clave canónica antes de comparar;
    // de lo contrario borraríamos un hilo válido justo al recargar la página.
    if (
      mentorThreadKey &&
      currentMentorInputsKey !== null &&
      !character.restoring &&
      !characterJournalLoading &&
      league.length > 0 &&
      patch.length > 0 &&
      mentorThreadKey !== currentMentorInputsKey
    ) {
      clearMentor();
      toast.info(APP_TEXT[pageLang()].mentorReset);
      return;
    }
    if (
      character.persisted &&
      character.profile !== null &&
      currentMentorInputsKey !== null &&
      !character.restoring &&
      !characterJournalLoading &&
      league.length > 0 &&
      patch.length > 0
    ) {
      void hydrateMentor(character.profile.id, currentMentorInputsKey);
    }
  }, [
    currentMentorInputsKey,
    mentorThreadKey,
    character.restoring,
    characterJournalLoading,
    league,
    patch,
    character.persisted,
    character.profile,
    clearMentor,
    hydrateMentor,
  ]);

  useEffect(() => {
    const plan = targetDraft.plan;
    if (plan !== null && plan !== announcedPlanRef.current) {
      announcedPlanRef.current = plan;
      announceMentor({ type: "planImported", name: plan.build.name });
    }
  }, [targetDraft.plan, announceMentor]);

  /**
   * Jerarquía del Caso Abierto: sesión abierta → acción activa del diario →
   * recomendación vigente → generar. La decide una función pura para poder
   * probarla sin montar la interfaz.
   */
  const resultRecommendations = useMemo(
    () => recommendations.result?.recommendations ?? [],
    [recommendations.result],
  );
  const toggleApplied = (id: string, applied: boolean) => {
    setAppliedIds((prev) => ({ ...prev, [id]: applied }));
    if (applied) {
      const recommendation = resultRecommendations.find((candidate) => candidate.id === id);
      if (recommendation) announceMentor({ type: "applied", title: recommendation.title });
    }
  };
  const selection = useMemo(
    () =>
      selectOpenCase({
        hasProfile,
        journal: characterJournal,
        recommendations: resultRecommendations,
      }),
    [hasProfile, characterJournal, resultRecommendations],
  );
  const savedNextAction = characterJournal?.primaryEntry ?? null;
  const profileReadiness = useMemo(
    () => assessCharacterReadiness(character.profile),
    [character.profile],
  );
  const mentorReadiness = useMemo(
    () => assessMentorReadiness(character.profile),
    [character.profile],
  );
  /**
   * Ids del paperdoll: SOLO los del contenido dominante. Al cambiar de caso se
   * sustituyen por los del nuevo o por un conjunto vacío; ninguna celda queda
   * marcada por un caso que ya no manda.
   */
  const highlightedItemIds = useMemo(
    () => new Set(selection.relatedItemIds),
    [selection],
  );
  const limitations = openCaseLimitations(selection);
  const dominantRecommendation = selection.recommendation;
  const activeCraftingExperiment =
    selection.kind === "session"
      ? characterJournal?.session?.craftingExperiment ?? null
      : null;

  const navigateWorkspace = useCallback(
    (workspace: WorkspaceTab) => {
      setMountedWorkspaces((mounted) => {
        if (mounted.has(workspace)) return mounted;
        const next = new Set(mounted);
        next.add(workspace);
        return next;
      });
      setTab((current) => {
        if (current === workspace) return current;
        setWorkspaceHistory((history) => [...history, current].slice(-12));
        return workspace;
      });
      // Sin personaje no hay «vuelta al personaje»: la mascota saluda.
      announceMentor(workspace === "expediente" && !hasProfile ? { type: "welcome" } : { type: "workspace", workspace });
    },
    [announceMentor, hasProfile],
  );

  // Cada guía tiene su propia dirección para poder compartirla; las demás
  // áreas siguen en la raíz. replaceState: cambiar de área no llena el historial.
  useEffect(() => {
    const path = window.location.pathname;
    if (tab === "guias") {
      const target = guidePath(guideSlug);
      if (path !== target) window.history.replaceState(window.history.state, "", target);
      document.title = guidePageTitleFor(guideSlug, lang);
    } else {
      if (path.startsWith("/guias")) window.history.replaceState(window.history.state, "", "/");
      document.title = lang === "en" ? APP_TITLE_EN : APP_TITLE;
    }
  }, [tab, guideSlug, lang]);

  const goBackWorkspace = () => {
    const previous = workspaceHistory.at(-1);
    if (!previous) {
      if (!character.profile) return;
      character.reset();
      setWorkspaceHistory([]);
      setTab("expediente");
      announceMentor({ type: "welcome" });
      return;
    }
    setWorkspaceHistory((history) => history.slice(0, -1));
    setTab(previous);
    announceMentor(previous === "expediente" && !hasProfile ? { type: "welcome" } : { type: "workspace", workspace: previous });
  };

  const goHome = () => {
    if (tab === "expediente") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigateWorkspace("expediente");
  };

  const openCraftingForItem = (itemId: string) => {
    setCraftingRequestedItemId(itemId);
    navigateWorkspace("crafting");
  };

  const restoreMentorBaseContext = () => {
    if (!character.profile) {
      announceMentor({ type: "welcome" });
    } else if (tab === "crafting" && !hasCraftingCharacterContext(character.profile)) {
      announceMentor({ type: "workspace", workspace: "crafting" });
    } else if (!mentorReadiness.ready) {
      announceMentor({
        type: "profileIncomplete",
        profileName: character.profile.name,
        missing: mentorReadiness.issues.map((issue) => (pageLang() === "en" ? issue.labelEn : issue.label).toLowerCase()),
      });
    } else if (tab === "plan") {
      announceMentor({ type: "workspace", workspace: "plan" });
    } else {
      announceMentor({ type: "ready", profileName: character.profile.name });
    }
  };

  const handleSessionMentorEvent = (event: {
    type: "started" | "result" | "paused" | "reopened" | "reconciled";
    title: string;
  }) => {
    if (event.type === "result") {
      announceMentor({ type: "sessionResult", title: event.title });
    } else if (event.type === "paused") {
      announceMentor({ type: "sessionPaused", title: event.title });
    } else {
      announceMentor({ type: "session", title: event.title });
    }
  };

  const saveProfileWithMentor = async () => {
    const saved = await character.saveCorrections();
    if (saved) announceMentor({ type: "profileSaved" });
  };

  /**
   * Crafting puede empezar desde una pieza suelta. Si el perfil mínimo aún no
   * existe en SQLite, se guarda y se carga su diario en el mismo gesto: nunca
   * se abre el editor completo ni se obliga al jugador a pulsar dos veces.
   */
  const ensureCraftingJournal = async () => {
    if (!character.profile) return null;
    if (!character.persisted) {
      const saved = await character.saveCorrections();
      if (!saved) return null;
      announceMentor({ type: "profileSaved" });
    }
    return characterJournal ?? journal.reload();
  };

  const updateBudgetWithMentor = (nextBudget: Budget | null) => {
    // Volver a escribir tras vaciar el campo no es un cambio de moneda: si lo
    // fuera, la primera tecla («1» de «1500») se anunciaría sin esperar.
    const currencyChanged =
      budget !== null && nextBudget !== null && nextBudget.currency !== budget.currency;
    setBudget(nextBudget);
    if (budgetCueTimerRef.current !== null) window.clearTimeout(budgetCueTimerRef.current);
    if (nextBudget === null) {
      restoreMentorBaseContext();
      return;
    }
    if (currencyChanged) {
      announceMentor({
        type: "budget",
        amount: nextBudget.amount,
        currency: nextBudget.currency,
      });
      return;
    }
    budgetCueTimerRef.current = window.setTimeout(() => {
      announceMentor({
        type: "budget",
        amount: nextBudget.amount,
        currency: nextBudget.currency,
      });
      budgetCueTimerRef.current = null;
    }, 600);
  };

  const focusItem = (itemId: string, trigger: HTMLElement) => {
    dialogTriggerRef.current = trigger;
    setFocusedItemId(itemId);
    const item = character.profile?.items.find((candidate) => candidate.id === itemId);
    if (item) announceMentor({ type: "item", item });
  };

  /**
   * Navegación inversa objeto → caso. Ahora el caso vive en la MISMA área que
   * el paperdoll, así que basta con desplazarse. El foco lo pone el cierre del
   * diálogo de objeto (`getCloseFocusTarget`), único momento en que Radix
   * garantiza no pisarlo.
   */
  const showOpenCase = () => {
    const target = document.getElementById("caso-abierto");
    if (target === null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const openEditor = (focusImport = false, prompt: EditorPrompt = null) => {
    setEditorPrompt(focusImport && prompt === null ? "import" : prompt);
    setEditorOpen(true);
    announceMentor({ type: "editor" });
  };

  /**
   * «Completar expediente»: si al personaje le faltan los datos básicos, se
   * piden en el alta corta; si ya los tiene, se abre el formulario completo.
   */
  const completeProfile = () => {
    if (character.profile && !profileReadiness.ready) {
      setQuickCompleting(true);
      setQuickCreateOpen(true);
      return;
    }
    openEditor();
  };
  const quickInitial = character.profile
    ? {
        // Los nombres de relleno no se proponen: el alta pone «Mi bruja».
        name: /^(?:expediente provisional|nuevo personaje)$/i.test(character.profile.name.trim())
          ? ""
          : character.profile.name,
        characterClass: character.profile.characterClass,
        // Si el nivel ya lo dijo en la revisión rápida, no se le pide otra vez:
        // viene escrito y él lo confirma al guardar.
        level: readCharacterLevel(character.profile).known
          ? character.profile.level
          : quickReviewInput({ ...quickReviewForm }).level,
        archetype: character.profile.archetype ?? "",
        skills: character.profile.skills.map((setup) => setup.mainSkill.trim()).filter(Boolean),
      }
    : null;

  /**
   * Lleva al jugador a la revisión rápida del expediente y la despliega. Recién
   * creado el personaje se baja antes a «gemas para tu habilidad», si ha salido:
   * es lo primero que la web le puede dar con lo que acaba de escribir.
   */
  const openQuickReview = (startAtGems = false) => {
    navigateWorkspace("expediente");
    window.setTimeout(() => {
      window.dispatchEvent(new Event(OPEN_REVIEW_EVENT));
      const gems = startAtGems ? document.getElementById("gemas-habilidad") : null;
      if (gems) {
        // Con margen para que el título no quede bajo la cabecera fija.
        window.scrollTo({ top: gems.getBoundingClientRect().top + window.scrollY - 132, behavior: "smooth" });
        return;
      }
      document.getElementById("revision-rapida")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  /** «Sigues por aquí»: abre la guía de ese acto en la zona que toca. */
  const continueGuide = (slug: string, step: number | null) => {
    setGuideSlug(slug);
    setGuideViewRequest((current) => ({ view: "guia", seq: (current?.seq ?? 0) + 1 }));
    navigateWorkspace("guias");
    scrollToWhenPainted(step === null ? '[data-testid="guia-ruta"]' : `#guia-ruta-${slug}-${step - 1}`);
  };

  /** Abre el consejero completo de gemas, en Guías. */
  const openGemAdvisor = () => {
    setGuideViewRequest((current) => ({ view: "herramientas", seq: (current?.seq ?? 0) + 1 }));
    navigateWorkspace("guias");
    scrollToWhenPainted('[data-testid="asistencia"]');
  };

  const startManualJourney = (intent: "new" | "item") => {
    // Pegar un objeto no crea antes un «Nuevo personaje» vacío: al analizarlo
    // nace su expediente provisional, igual que desde Crafting. Antes quedaba
    // un personaje fantasma en la lista de guardados (y en pantalla, si se
    // cerraba el panel sin pegar nada).
    if (!character.profile && intent === "new") {
      character.startManual({
        league: league || meta?.leagues[0] || "Desconocida",
        patch: patch || health?.patch.content || "Desconocido",
      });
    }
    openEditor(false, intent);
  };

  const trackRecommendation = (recommendation: Recommendation) => {
    if (!character.profile) return;
    if (!profileReadiness.ready) {
      toast.warning(t.completeToSave, {
        description: t.missing(
          profileReadiness.issues
            .map((issue) => (lang === "en" ? issue.labelEn : issue.label).toLowerCase())
            .join(", "),
        ),
      });
      openEditor();
      return;
    }
    if (!character.persisted || !characterJournal) {
      pendingMemoryActionRef.current = { kind: "track", recommendation };
      openEditor(false, "memory");
      return;
    }
    void journal
      .createEntry({
        ...journalEntryFromRecommendation(recommendation, character.profile, budget, goal),
        journalRevision: buildRecommendationMemory(characterJournal).revision,
      })
      .then((entry) => {
        if (entry) announceMentor({ type: "tracked", title: recommendation.title });
      });
  };

  const startSession = (recommendation: Recommendation) => {
    if (!character.profile) return;
    if (!profileReadiness.ready) {
      toast.warning(t.completeToCheck, {
        description: t.missing(
          profileReadiness.issues
            .map((issue) => (lang === "en" ? issue.labelEn : issue.label).toLowerCase())
            .join(", "),
        ),
      });
      openEditor();
      return;
    }
    if (!character.persisted || !characterJournal) {
      pendingMemoryActionRef.current = { kind: "session", recommendation };
      openEditor(false, "memory");
      return;
    }
    const profile = character.profile;
    void journal
      .startSession({
        journalRevision: buildRecommendationMemory(characterJournal).revision,
        idempotencyKey: crypto.randomUUID(),
        kind: "guided_decision",
        objective: recommendation.title,
        hypothesis: compactRecommendationReason(recommendation.reason),
        expectedResult: recommendation.impact.description,
        observationMethod: observationMethodForRecommendation(recommendation),
        unknowns: [],
        constraints: [],
        soonReplacedItemIds: [],
        protectedResources: [],
        recommendation,
        profile,
        budget,
        goal,
      })
      .then((next) => {
        // La sesión pasa a ser el contenido dominante del Caso Abierto: basta
        // con desplazarse hasta él, sin cambiar de área ni animar.
        if (next) {
          announceMentor({ type: "session", title: recommendation.title });
          document.getElementById("caso-abierto")?.scrollIntoView({ block: "start" });
        }
      });
  };

  // Guardar el personaje es un prerrequisito, no el final del gesto. Esta
  // continuación recibe el perfil que realmente devolvió el servidor, carga
  // su diario y retoma exactamente la acción elegida antes de abrir el editor.
  const resumePendingMemoryAction = async (savedProfile: CharacterProfile) => {
    const pending = pendingMemoryActionRef.current;
    pendingMemoryActionRef.current = null;
    if (pending === null) return;
    const currentJournal = await journal.reload();
    if (currentJournal === null) {
      toast.error(t.memoryError, {
        description: t.memoryErrorDetail,
      });
      return;
    }
    if (pending.kind === "track") {
      const entry = await journal.createEntry({
        ...journalEntryFromRecommendation(
          pending.recommendation,
          savedProfile,
          budget,
          goal,
        ),
        journalRevision: buildRecommendationMemory(currentJournal).revision,
      });
      if (entry) announceMentor({ type: "tracked", title: pending.recommendation.title });
      return;
    }
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: pending.recommendation.title,
      hypothesis: compactRecommendationReason(pending.recommendation.reason),
      expectedResult: pending.recommendation.impact.description,
      observationMethod: observationMethodForRecommendation(pending.recommendation),
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: pending.recommendation,
      profile: savedProfile,
      budget,
      goal,
    });
    if (next) {
      announceMentor({ type: "session", title: pending.recommendation.title });
      document.getElementById("caso-abierto")?.scrollIntoView({ block: "start" });
    }
  };

  const startCraftingDecision = async (
    item: Item,
    action: ObservedCraftingAction,
    variant: CraftingCurrencyVariant,
    objective: CraftingObjective,
  ): Promise<boolean> => {
    const profile = character.profile;
    if (!profile) return false;
    const currentJournal = await ensureCraftingJournal();
    if (!currentJournal) return false;
    const currencyLabel = craftingCurrencyLabel(action, variant);
    const dt = CRAFTING_DECISION_TEXT[pageLang()];
    const title = dt.check(currencyLabel, item.name);
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: `${title}: ${objective.desiredOutcome}`,
      hypothesis: dt.currency.hypothesis,
      expectedResult: action.effect,
      observationMethod: dt.currency.observation,
      unknowns: [
        {
          label: CRAFTING_RESULT_UNKNOWN_LABEL,
          blockingIrreversible: false,
        },
        {
          label: dt.currency.noWeights,
          blockingIrreversible: false,
        },
      ],
      constraints: [
        {
          label: dt.currency.noOtherAction,
          relatedItemIds: [item.id],
        },
        {
          label: dt.sameSnapshot,
          relatedItemIds: [item.id],
        },
        ...(objective.protectedModifierIds.length > 0
          ? [{
              label: dt.currency.protectedStay,
              relatedItemIds: [item.id],
            }]
          : []),
      ],
      soonReplacedItemIds: [],
      protectedResources: [`1 × ${currencyLabel}`],
      craftingExperiment: {
        actionId: action.id,
        actionLabel: currencyLabel,
        variantId: variant.id,
        variantLabel: variant.label,
        minimumModifierLevel: variant.minimumModifierLevel,
        desiredOutcome: objective.desiredOutcome,
        goalCategory: objective.goalCategory,
        protectedModifierIds: objective.protectedModifierIds,
        successCriteria: objective.successCriteria,
        originalItem: item,
      },
      recommendation: null,
      profile,
      budget,
      goal,
    });
    if (!next) return false;
    announceMentor({ type: "session", title });
    document.getElementById("caso-abierto")?.scrollIntoView({ block: "start" });
    return true;
  };

  const startEssenceDecision = async (
    item: Item,
    plan: EssencePlanInput,
    evaluation: EssenceEvaluation,
    objective: CraftingObjective,
  ): Promise<boolean> => {
    const profile = character.profile;
    if (!profile) return false;
    const currentJournal = await ensureCraftingJournal();
    if (!currentJournal) return false;
    const essenceLabel = plan.essenceName.trim();
    const lang = pageLang();
    const dt = CRAFTING_DECISION_TEXT[lang];
    const tierLabel = (lang === "en" ? ESSENCE_TIER_LABELS_EN : ESSENCE_TIER_LABELS)[plan.tier];
    const title = dt.check(essenceLabel, item.name);
    const randomRemovalConstraint = evaluation.randomRemoval
      ? dt.essence.randomRemoval(item.modifiers.filter((modifier) => modifier.kind === "explicit").length)
      : dt.essence.keepMods;
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: `${title}: ${objective.desiredOutcome}`,
      hypothesis: evaluation.randomRemoval ? dt.essence.hypothesisRemoval : dt.essence.hypothesisUpgrade,
      expectedResult: dt.essence.expected(plan.guaranteedModifierText),
      observationMethod: dt.essence.observation,
      unknowns: [
        {
          label: ESSENCE_RESULT_UNKNOWN_LABEL,
          blockingIrreversible: false,
        },
        {
          label: dt.essence.noPool,
          blockingIrreversible: false,
        },
      ],
      constraints: [
        { label: randomRemovalConstraint, relatedItemIds: [item.id] },
        {
          label: dt.essence.matchTooltip,
          relatedItemIds: [item.id],
        },
        {
          label: dt.sameSnapshot,
          relatedItemIds: [item.id],
        },
        ...(objective.protectedModifierIds.length > 0
          ? [{
              label: dt.essence.checkProtected,
              relatedItemIds: [item.id],
            }]
          : []),
      ],
      soonReplacedItemIds: [],
      protectedResources: [`1 × ${essenceLabel}`],
      craftingExperiment: {
        actionId: "essence",
        actionLabel: `${essenceLabel} (${tierLabel})`,
        variantId: plan.tier,
        variantLabel: tierLabel,
        resultRarity: evaluation.resultRarity,
        expectedRemovedModifierCount: evaluation.randomRemoval ? 1 : 0,
        guaranteedModifierText: plan.guaranteedModifierText,
        resultUnknownLabel: ESSENCE_RESULT_UNKNOWN_LABEL,
        desiredOutcome: objective.desiredOutcome,
        goalCategory: objective.goalCategory,
        protectedModifierIds: objective.protectedModifierIds,
        successCriteria: objective.successCriteria,
        originalItem: item,
      },
      recommendation: null,
      profile,
      budget,
      goal,
    });
    if (!next) return false;
    announceMentor({ type: "session", title });
    document.getElementById("caso-abierto")?.scrollIntoView({ block: "start" });
    return true;
  };

  const startAlloyDecision = async (
    item: Item,
    plan: AlloyPlanInput,
    evaluation: AlloyEvaluation,
    objective: CraftingObjective,
  ): Promise<boolean> => {
    const profile = character.profile;
    if (!profile) return false;
    const currentJournal = await ensureCraftingJournal();
    if (!currentJournal) return false;
    const alloyLabel = plan.alloyName.trim();
    const dt = CRAFTING_DECISION_TEXT[pageLang()];
    const title = dt.check(alloyLabel, item.name);
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: `${title}: ${objective.desiredOutcome}`,
      hypothesis: dt.alloy.hypothesis,
      expectedResult: dt.alloy.expected(plan.guaranteedModifierText),
      observationMethod: dt.alloy.observation,
      unknowns: [
        { label: ALLOY_RESULT_UNKNOWN_LABEL, blockingIrreversible: false },
        {
          label: dt.alloy.noMatrix,
          blockingIrreversible: false,
        },
        ...(plan.removalSelection === "unspecified"
          ? [{
              label: dt.alloy.selectionUnverified,
              blockingIrreversible: false,
            }]
          : []),
      ],
      constraints: [
        {
          label:
            plan.removalSelection === "random"
              ? dt.alloy.anyReplaced(item.modifiers.filter((modifier) => modifier.kind === "explicit").length)
              : plan.removalSelection === "player-selected"
                ? dt.alloy.playerSelected
                : dt.alloy.criterionUnverified,
          relatedItemIds: [item.id],
        },
        {
          label: dt.alloy.classes(plan.declaredItemClasses.join(", ")),
          relatedItemIds: [item.id],
        },
        {
          label: dt.alloy.matchTooltip,
          relatedItemIds: [item.id],
        },
        {
          label: dt.alloy.sameSnapshotNoCrafted,
          relatedItemIds: [item.id],
        },
        ...(objective.protectedModifierIds.length > 0
          ? [{
              label: dt.alloy.protectedFlagged,
              relatedItemIds: [item.id],
            }]
          : []),
      ],
      soonReplacedItemIds: [],
      protectedResources: [`1 × ${alloyLabel}`],
      craftingExperiment: {
        actionId: "alloy",
        actionLabel: alloyLabel,
        resultRarity: evaluation.resultRarity,
        expectedRemovedModifierCount: evaluation.expectedRemovedModifierCount,
        expectedAddedCrafted: evaluation.expectedAddedCrafted,
        maximumCraftedModifierCount: evaluation.maximumCraftedModifierCount,
        guaranteedModifierText: plan.guaranteedModifierText,
        resultUnknownLabel: ALLOY_RESULT_UNKNOWN_LABEL,
        desiredOutcome: objective.desiredOutcome,
        goalCategory: objective.goalCategory,
        protectedModifierIds: objective.protectedModifierIds,
        successCriteria: objective.successCriteria,
        originalItem: item,
      },
      recommendation: null,
      profile,
      budget,
      goal,
    });
    if (!next) return false;
    announceMentor({ type: "session", title });
    document.getElementById("caso-abierto")?.scrollIntoView({ block: "start" });
    return true;
  };

  const askMentor = async (
    question: string,
    intentHint?: ContextualMentorAsk["intent"],
    contextualCraftingState?: import("@shared/mentorContext.js").MentorCraftingState,
  ) => {
    if (!character.profile) return null;

    const activeItemId = tab === "crafting" ? craftingRequestedItemId : focusedItemId;
    const activeItem = character.profile.items.find((i) => i.id === activeItemId);
    const envelope: import("@shared/mentorContext.js").ContextEnvelope = {
      version: "1.0",
      activeArea: tab === "guias" ? "expediente" : tab,
      character: {
        level: character.profile.level,
        characterClass: character.profile.characterClass,
      },
      targetBuild: targetDraft.name || null,
      selectedItem: activeItem ? { id: activeItem.id, name: activeItem.name || activeItem.baseType } : null,
      craftingState:
        tab === "crafting"
          ? (contextualCraftingState ?? contextualCue.ask?.craftingState ?? null)
          : null,
      activeRecommendationId: dominantRecommendation?.id ?? null,
      market: {
        budgetAmount: budget?.amount ?? null,
        budgetCurrency: budget?.currency ?? null,
        league: league || "Desconocida",
      },
      sessionActive: characterJournal?.session !== null && characterJournal?.session !== undefined,
      lastAction: characterJournal?.primaryEntry?.nextAction ?? null,
    };

    const outcome = await mentor.ask(
      buildMentorRequest(
        question,
        engineProfile ?? character.profile,
        targetDraft,
        budget,
        goal,
        league,
        patch,
        characterJournal,
        intentHint,
        envelope,
        mentor.turns.slice(-8).map((turn) => ({
          role: turn.role,
          text: turn.text.slice(0, 800),
        })),
      ),
      { persist: character.persisted },
    );
    if (outcome.status === "journal-stale") void journal.reload();
    return outcome;
  };

  const askContextualMentor = async (ask: ContextualMentorAsk) => {
    const requestedSeq = contextualSeqRef.current;
    setContextualAnswer(null);
    setContextualError(null);
    setContextualLoadingSeq(requestedSeq);
    const outcome = await askMentor(ask.question, ask.intent, ask.craftingState);
    // La respuesta conserva su turno en la conversación, pero nunca pisa un
    // objeto, área o decisión que el jugador abrió mientras esperaba.
    if (requestedSeq !== contextualSeqRef.current) return;
    setContextualLoadingSeq(null);
    if (outcome?.status === "ok") {
      setContextualAnswer(outcome.answer);
    } else if (outcome?.status === "error") {
      setContextualError(outcome.message);
    }
  };

  // «Tu siguiente paso» de la mascota: una regla sobre lo que ya se sabe del personaje.
  const mascotStepKind = mascotNextStep({
    hasProfile: character.profile !== null,
    itemCount: character.profile?.items.length ?? 0,
    reviewKnowsBasics: character.profile !== null && reviewKnowsBasics({ ...quickReviewForm }),
  });

  const askMentorQuickQuestion = (text: string) => {
    setMentorQuickQuestion((current) => ({ text, seq: (current?.seq ?? 0) + 1 }));
    openMentorConversation();
  };

  // Cada petición de abrir la conversación la trae a la vista, aunque ya
  // estuviera abierta: en el móvil queda bajo el equipo, y la segunda pregunta
  // de ejemplo no se veía contestar.
  const [mentorScrollSeq, setMentorScrollSeq] = useState(0);
  const openMentorConversation = () => {
    setMentorBriefingOpen(true);
    setMentorScrollSeq((seq) => seq + 1);
    navigateWorkspace("expediente");
  };

  useEffect(() => {
    if (tab !== "expediente" || !mentorBriefingOpen) return;
    const timeout = window.setTimeout(() => {
      const briefing = document.querySelector<HTMLDetailsElement>(
        "[data-testid='mentor-briefing']",
      );
      briefing?.scrollIntoView({ behavior: "smooth", block: "start" });
      briefing?.querySelector<HTMLElement>("#mentor-pregunta")?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [tab, mentorBriefingOpen, mentorScrollSeq]);

  const contextualProfileId = character.profile?.id ?? null;
  const contextualProfileName = character.profile?.name ?? null;
  const contextualReadinessKey = mentorReadiness.issues
    .map((issue) => issue.id)
    .join("|");
  useEffect(() => {
    return deferEffect(() => {
      if (contextualProfileId && contextualProfileName) {
        if (mentorReadiness.ready) {
          announceMentor({ type: "ready", profileName: contextualProfileName });
        } else if (tab === "crafting" && !hasCraftingCharacterContext(character.profile)) {
          announceMentor({ type: "workspace", workspace: "crafting" });
        } else {
          announceMentor({
            type: "profileIncomplete",
            profileName: contextualProfileName,
            missing: mentorReadiness.issues.map((issue) => (pageLang() === "en" ? issue.labelEn : issue.label).toLowerCase()),
          });
        }
      } else if (!character.restoring) {
        announceMentor({ type: "welcome" });
      }
    });
    // Solo anuncia una carga real de perfil; renombrarlo no equivale a cargarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contextualProfileId,
    contextualReadinessKey,
    character.restoring,
    announceMentor,
  ]);

  useEffect(() => {
    return deferEffect(() => {
      if (recommendations.result) {
        announceMentor({
          type: "recommendations",
          recommendations: recommendations.result.recommendations,
        });
      }
    });
  }, [recommendations.result, announceMentor]);

  useEffect(() => {
    return deferEffect(() => {
      if (market.prices) {
        announceMentor({
          type: "market",
          quoteCount: market.prices.quotes.length,
          verifiedCount: market.prices.quotes.filter((quote) => quote.verified).length,
          degraded: market.prices.degraded,
        });
      }
    });
  }, [market.prices, announceMentor]);

  useEffect(() => {
    return deferEffect(() => {
      if (market.error) {
        announceMentor({ type: "error", area: "mercado", message: market.error });
      }
    });
  }, [market.error, announceMentor]);

  useEffect(() => {
    return deferEffect(() => {
      if (recommendations.error) {
        announceMentor({
          type: "error",
          area: "recomendaciones",
          message: recommendations.error,
        });
      }
    });
  }, [recommendations.error, announceMentor]);

  useEffect(
    () => () => {
      if (budgetCueTimerRef.current !== null) window.clearTimeout(budgetCueTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const collapseOnMobile = (event: MediaQueryListEvent) => {
      if (event.matches) setContextualCollapsed(true);
    };
    media.addEventListener("change", collapseOnMobile);
    return () => media.removeEventListener("change", collapseOnMobile);
  }, []);

  // La bienvenida sustituye a los paneles vacíos, pero no debe aparecer mientras
  // se restaura un personaje guardado (si no, parpadearía antes de cargarlo).
  const showWelcome =
    !hasProfile && !character.restoring && character.restorationError === null;

  const evidenceSlot =
    selection.kind === "recommendation" || selection.kind === "journal" ? (
      <OpenCaseEvidence
        recommendation={selection.recommendation}
        entry={selection.journalEntry}
      />
    ) : null;

  return (
    <div className="min-h-screen text-foreground">
      <AppHeader
        health={health}
        loading={metaLoading}
        profile={character.profile}
        onHome={goHome}
        onBack={goBackWorkspace}
        canGoBack={workspaceHistory.length > 0 || hasProfile}
        backLabel={workspaceHistory.length > 0 ? t.backArea : t.backCharacters}
        onAddCharacter={() => {
          // Igual que la portada: el alta corta, que no pide Path of Building.
          setQuickCompleting(false);
          setQuickCreateOpen(true);
        }}
        onOpenMentor={openMentorConversation}
      />

      <main
        className="mx-auto max-w-[92rem] px-4 pt-0 sm:px-6"
        /* El mentor flota fijo abajo: se reserva su altura real para que
           jamás tape una pregunta, un botón ni los datos del objeto. */
        style={{ paddingBottom: "calc(var(--mentor-inset, 6rem) + 1rem)" }}
      >
        {metaError && (
          <Alert className="mb-6 border-amber-500/45 bg-amber-500/8" data-testid="meta-error">
            <AlertTitle>{t.metaErrorTitle}</AlertTitle>
            <AlertDescription>
              <p>
                {metaError}
                {t.metaErrorText}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={metaLoading}
                onClick={reloadMeta}
                data-testid="meta-reintentar"
              >
                <RefreshCw
                  className={`size-4 ${metaLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {metaLoading ? t.reconnecting : t.retry}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          value={tab}
          onValueChange={(value) => {
            const workspace = value as WorkspaceTab;
            navigateWorkspace(workspace);
          }}
          className="gap-0 xl:grid xl:grid-cols-[4rem_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-x-6 xl:pt-6"
        >
          {/* Por debajo de xl las áreas son pestañas fijas arriba. En xl pasan a
              un carril lateral de iconos (deja anchura al expediente y al caso)
              y desde 2xl a una barra con una línea que explica cada área.
              La nueva distribución vive en el mismo TabsList para no duplicar
              estado ni foco. Música sigue en la cabecera principal. */}
          <div className="workspace-nav sticky top-16 z-30 -mx-4 mb-6 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 xl:top-20 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:mx-0 xl:mb-0 xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none">
            <div className="mx-auto flex max-w-[92rem] items-center justify-center xl:block">
              <TabsList
                aria-label={t.areas}
                className="grid h-auto min-w-0 flex-1 grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1 lg:flex lg:w-auto lg:flex-none xl:flex xl:w-full xl:flex-col xl:items-stretch xl:gap-1 xl:p-1.5"
              >
              <TabsTrigger
                value="expediente"
                data-testid="tab-expediente"
                title={t.dossier}
                className="min-w-0 flex-col gap-1 rounded-lg border-0 px-1.5 py-2 text-xs font-medium sm:flex-row text-muted-foreground shadow-none transition-colors hover:text-foreground sm:gap-2 sm:px-4 sm:text-sm lg:flex-none xl:h-11 xl:w-full xl:flex-none xl:justify-center xl:px-0 2xl:grid 2xl:h-auto 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:gap-x-3 2xl:gap-y-0.5 2xl:px-3 2xl:py-2.5 2xl:text-left data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none [&[data-state=active]>svg]:text-primary"
              >
                <FolderOpen className="size-4 shrink-0 2xl:row-span-2 2xl:mt-0.5" aria-hidden="true" />
                <span className="truncate lg:hidden">{t.dossierShort}</span>
                <span className="hidden truncate lg:inline xl:sr-only 2xl:not-sr-only">{t.dossier}</span>
                <span className="hidden whitespace-normal text-xs font-normal leading-snug text-muted-foreground 2xl:col-start-2 2xl:block">
                  {t.dossierHint}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="plan"
                data-testid="tab-plan"
                title={t.plan}
                className="min-w-0 flex-col gap-1 rounded-lg border-0 px-1.5 py-2 text-xs font-medium sm:flex-row text-muted-foreground shadow-none transition-colors hover:text-foreground sm:gap-2 sm:px-4 sm:text-sm lg:flex-none xl:h-11 xl:w-full xl:flex-none xl:justify-center xl:px-0 2xl:grid 2xl:h-auto 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:gap-x-3 2xl:gap-y-0.5 2xl:px-3 2xl:py-2.5 2xl:text-left data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none [&[data-state=active]>svg]:text-primary"
              >
                <Compass className="size-4 shrink-0 2xl:row-span-2 2xl:mt-0.5" aria-hidden="true" />
                <span className="truncate lg:hidden">{t.planShort}</span>
                <span className="hidden truncate lg:inline xl:sr-only 2xl:not-sr-only">{t.plan}</span>
                <span className="hidden whitespace-normal text-xs font-normal leading-snug text-muted-foreground 2xl:col-start-2 2xl:block">
                  {t.planHint}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="crafting"
                data-testid="tab-crafting"
                title={t.crafting}
                className="min-w-0 flex-col gap-1 rounded-lg border-0 px-1.5 py-2 text-xs font-medium sm:flex-row text-muted-foreground shadow-none transition-colors hover:text-foreground sm:gap-2 sm:px-4 sm:text-sm lg:flex-none xl:h-11 xl:w-full xl:flex-none xl:justify-center xl:px-0 2xl:grid 2xl:h-auto 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:gap-x-3 2xl:gap-y-0.5 2xl:px-3 2xl:py-2.5 2xl:text-left data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none [&[data-state=active]>svg]:text-primary"
              >
                <Hammer className="size-4 shrink-0 2xl:row-span-2 2xl:mt-0.5" aria-hidden="true" />
                <span className="truncate xl:sr-only 2xl:not-sr-only">{t.crafting}</span>
                <span className="hidden whitespace-normal text-xs font-normal leading-snug text-muted-foreground 2xl:col-start-2 2xl:block">
                  {t.craftingHint}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="guias"
                data-testid="tab-guias"
                title={t.guidesTitle}
                className="min-w-0 flex-col gap-1 rounded-lg border-0 px-1.5 py-2 text-xs font-medium sm:flex-row text-muted-foreground shadow-none transition-colors hover:text-foreground sm:gap-2 sm:px-4 sm:text-sm lg:flex-none xl:h-11 xl:w-full xl:flex-none xl:justify-center xl:px-0 2xl:grid 2xl:h-auto 2xl:grid-cols-[auto_minmax(0,1fr)] 2xl:gap-x-3 2xl:gap-y-0.5 2xl:px-3 2xl:py-2.5 2xl:text-left data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none [&[data-state=active]>svg]:text-primary"
              >
                <BookOpen className="size-4 shrink-0 2xl:row-span-2 2xl:mt-0.5" aria-hidden="true" />
                <span className="truncate xl:sr-only 2xl:not-sr-only">{t.guides}</span>
                <span className="hidden whitespace-normal text-xs font-normal leading-snug text-muted-foreground 2xl:col-start-2 2xl:block">
                  {t.guidesHint}
                </span>
              </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {character.profile !== null && character.restorationError === null && (
            <div className="xl:col-start-2 xl:row-start-1">
              <CharacterStrip
                profile={character.profile}
                persisted={character.persisted}
                reviewResistances={quickReviewInput({ ...quickReviewForm }).resistances}
              />
            </div>
          )}
          {/* Mientras se recupera un personaje guardado se reserva el hueco de su
              franja: si no, al llegar empujaba todo el contenido hacia abajo. */}
          {character.profile === null &&
            character.restoring &&
            character.persisted &&
            character.restorationError === null && (
              <div className="xl:col-start-2 xl:row-start-1" aria-hidden="true" data-testid="franja-personaje-hueco">
                <div className="mb-6 h-[7.5rem] rounded-xl border border-border bg-card md:h-[4.75rem]" />
              </div>
            )}

          {/* --- Área 1: Expediente y mentor -------------------------------- */}
          <TabsContent value="expediente" forceMount className={PANEL_CLASSES}>
            {character.restorationError !== null ? (
              <Alert variant="destructive" data-testid="character-restore-error">
                <AlertTitle>{t.restoreTitle}</AlertTitle>
                <AlertDescription>
                  <p>
                    {character.restorationError}
                    {t.restoreKeep}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={character.retryRestore}
                    disabled={character.restoring}
                    data-testid="character-restore-retry"
                  >
                    <RefreshCw
                      className={`size-4 ${character.restoring ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    {character.restoring ? t.restoring : t.restoreRetry}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : showWelcome ? (
              // Sin personaje: solo la bienvenida. Ni expediente ni caso vacíos.
              <div className="flex flex-col gap-6">
                <ResumeBanner onContinue={continueGuide} />
                <WelcomePanel
                  loadingDemo={character.busy === "demo"}
                  onLoadDemo={() => void character.loadDemo()}
                  onOpenGuides={() => {
                    setGuideSlug(DEFAULT_GUIDE_SLUG);
                    navigateWorkspace("guias");
                  }}
                  onGoToImport={() => openEditor(true)}
                  onStartNew={() => {
                    setQuickCompleting(false);
                    setQuickCreateOpen(true);
                  }}
                  onStartItem={() => startManualJourney("item")}
                  previousCharacterName={character.previousCharacter?.name ?? null}
                  onRestorePrevious={() => void character.restorePrevious()}
                  restoringPrevious={character.busy === "restore"}
                  savedCharacters={character.savedCharacters}
                  savedCharactersTotal={character.savedCharactersTotal}
                  loadingSavedCharacters={character.loadingSavedCharacters}
                  onRestoreCharacter={(characterId) =>
                    void character.restoreCharacter(characterId)
                  }
                  onLoadMoreSavedCharacters={() =>
                    void character.loadMoreSavedCharacters()
                  }
                />
                <QuickReviewCard profile={null} />
              </div>
            ) : !hasProfile ? (
              // Restaurando el personaje guardado: ni bienvenida ni caso vacíos.
              <ExpedienteSection
                profile={null}
                restoring={character.restoring}
                highlightedItemIds={highlightedItemIds}
                recommendations={resultRecommendations}
                limitations={limitations}
                focusedItemId={focusedItemId}
                onFocusHandled={() => setFocusedItemId(null)}
                dialogTriggerRef={dialogTriggerRef}
                onShowOpenCase={showOpenCase}
                onInspectItem={(item) => announceMentor({ type: "item", item })}
                onInspectionEnd={restoreMentorBaseContext}
                onEditExpediente={() => openEditor()}
                journal={journal}
                profilePersisted={character.persisted}
                savingProfile={character.busy === "save"}
                onSaveProfile={() => void saveProfileWithMentor()}
                onOpenCrafting={openCraftingForItem}
              />
            ) : (
              <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(24rem,30rem)_minmax(0,1fr)] lg:items-start">
                {/* Orden de lectura: «tu siguiente paso» arriba y a todo lo
                    ancho, la conversación justo debajo (ahí se abre al
                    preguntar), después el equipo junto a lo que frena al
                    personaje, y al final lo avanzado. En móvil el equipo va
                    antes que la conversación: sigue en la primera pantalla. */}
                <ResumeBanner onContinue={continueGuide} className="order-0 lg:col-span-2" />
                <div className="order-1 lg:col-span-2">
                  <OpenCase
                    selection={selection}
                    profileReadiness={profileReadiness}
                    sessionSlot={
                      activeCraftingExperiment ? (
                        <div className="space-y-3" data-testid="crafting-session-redirect">
                          <h3 className="text-xl font-semibold">{t.craftingRunning}</h3>
                          <p className="text-sm text-muted-foreground">
                            {t.craftingChecking(
                              activeCraftingExperiment.actionLabel,
                              activeCraftingExperiment.originalItem.name,
                            )}
                          </p>
                          <Button type="button" onClick={() => navigateWorkspace("crafting")}>
                            {t.craftingContinue}
                          </Button>
                        </div>
                      ) : (
                        <DecisionSessionSection
                          profile={character.profile}
                          budget={budget}
                          goal={goal}
                          journal={journal}
                          pendingRecommendation={dominantRecommendation}
                          onEditExpediente={() => openEditor()}
                          onMentorEvent={handleSessionMentorEvent}
                          onApplyCraftingResult={character.replaceItemAndSave}
                        />
                      )
                    }
                    journalSlot={
                      <JournalSection
                        profile={character.profile}
                        budget={budget}
                        goal={goal}
                        journal={journal}
                        view="accion"
                      />
                    }
                    recommendationSlot={
                      dominantRecommendation && (
                        <OpenCaseRecommendation
                          recommendation={dominantRecommendation}
                          budget={budget}
                          applied={appliedIds[dominantRecommendation.id] ?? false}
                          onAppliedChange={(applied) =>
                            toggleApplied(dominantRecommendation.id, applied)
                          }
                          onTrack={trackRecommendation}
                          tracking={journal.saving}
                          onStartSession={startSession}
                          startingSession={journal.saving}
                          onFocusItem={focusItem}
                          onEditExpediente={() => openEditor()}
                        />
                      )
                    }
                    generateSlot={
                      <RecommendationsSection
                        sectionId="seccion-recomendaciones"
                        onAddGear={() => openEditor(false, "gear")}
                        profile={engineProfile}
                        targetDraft={targetDraft}
                        budget={budget}
                        goal={goal}
                        league={league}
                        patch={patch}
                        journal={characterJournal}
                        journalLoading={characterJournalLoading}
                        onJournalStale={async () => {
                          await journal.reload();
                        }}
                        recommendations={recommendations}
                        onLoadDemo={character.loadDemo}
                        onEditProfile={completeProfile}
                        onFocusItem={focusItem}
                        onTrackRecommendation={trackRecommendation}
                        trackingRecommendation={journal.saving}
                        onStartSession={startSession}
                        startingSession={journal.saving}
                        appliedIds={appliedIds}
                        onAppliedChange={toggleApplied}
                        view="generar"
                      />
                    }
                    evidenceSlot={evidenceSlot}
                    mentorAskSlot={
                      <MentorQuickAsk
                        onAsk={(text) => {
                          setMentorQuickQuestion((current) => ({
                            text,
                            seq: (current?.seq ?? 0) + 1,
                          }));
                          openMentorConversation();
                        }}
                      />
                    }
                  />
                </div>

                {/* Expediente: equipo, memoria de la build y acceso al editor. */}
                {/* Sin equipo, en móvil va antes lo que ya puede decirle la web
                    que una cuadrícula de ranuras vacías. */}
                <div
                  className={cn(
                    character.profile && character.profile.items.length === 0 ? "order-3" : "order-2",
                    "lg:order-3 lg:col-start-1",
                  )}
                >
                  <ExpedienteSection
                    profile={character.profile}
                    restoring={character.restoring}
                    highlightedItemIds={highlightedItemIds}
                    recommendations={resultRecommendations}
                    limitations={limitations}
                    focusedItemId={focusedItemId}
                    onFocusHandled={() => setFocusedItemId(null)}
                    onAddGear={() => openEditor(false, "gear")}
                    onRemoveItem={character.removeItemAndSave}
                    dialogTriggerRef={dialogTriggerRef}
                    onShowOpenCase={showOpenCase}
                    onInspectItem={(item) => announceMentor({ type: "item", item })}
                    onInspectionEnd={restoreMentorBaseContext}
                    onEditExpediente={() => openEditor()}
                    journal={journal}
                    profilePersisted={character.persisted}
                    savingProfile={character.busy === "save"}
                    onSaveProfile={() => void saveProfileWithMentor()}
                    onOpenCrafting={openCraftingForItem}
                    mentorContextId={contextualCue.id}
                  />
                </div>

                {/* Lo que frena al personaje y, mientras no hay equipo, las
                    gemas para su habilidad: es lo único que la web puede
                    darle con lo que ha escrito. */}
                <div
                  className={cn(
                    character.profile && character.profile.items.length === 0 ? "order-2" : "order-3",
                    "flex flex-col gap-6 lg:order-4 lg:col-start-2",
                  )}
                >
                  <QuickReviewCard
                    key={character.profile?.id ?? "sin-personaje"}
                    profile={character.profile}
                    onAskMentor={askMentorQuickQuestion}
                  />
                  {character.profile && character.profile.items.length === 0 && (
                    <SkillGemTeaser profile={character.profile} onOpenAdvisor={openGemAdvisor} />
                  )}
                  {engineProfile && (
                    <PassiveTreeCard
                      profile={engineProfile}
                      onPasteCode={() => openEditor(false, "pob")}
                      onSetSkill={() => openQuickReview()}
                    />
                  )}
                </div>

                {/* La conversación completa: en ordenador justo bajo «tu
                    siguiente paso»; en móvil, después del equipo. */}
                <div className="order-4 lg:order-2 lg:col-span-2">
                  <MentorBriefing
                    open={mentorBriefingOpen}
                    onOpenChange={setMentorBriefingOpen}
                  >
                    <MentorChatSection
                      profile={character.profile}
                      patchCompatibility={activePatchCompatibility}
                      mentor={mentor}
                      savingNextAction={journal.saving}
                      onAsk={askMentor}
                      onSaveNextAction={(answer) => {
                        const recommendation = answer.nextAction?.recommendation ?? null;
                        if (recommendation === null) return;
                        trackRecommendation(recommendation);
                      }}
                      onFocusItem={focusItem}
                      onEditProfile={completeProfile}
                      onOpenQuickReview={() => openQuickReview()}
                      pendingQuestion={mentorQuickQuestion}
                    />
                  </MentorBriefing>
                </div>

                {/* Memoria y alternativas: al final, a todo lo ancho. */}
                <div className="order-5 lg:col-span-2">
                  <OpenCaseSecondary
                    selection={selection}
                    sessionSlot={
                      selection.kind === "session" ? null : (
                        <DecisionSessionSection
                          profile={character.profile}
                          budget={budget}
                          goal={goal}
                          journal={journal}
                          pendingRecommendation={dominantRecommendation}
                          onEditExpediente={() => openEditor()}
                          onMentorEvent={handleSessionMentorEvent}
                          onApplyCraftingResult={character.replaceItemAndSave}
                        />
                      )
                    }
                    historySlot={
                      <JournalSection
                        profile={character.profile}
                        budget={budget}
                        goal={goal}
                        journal={journal}
                        view="historial"
                      />
                    }
                    othersSlot={
                      <RecommendationsSection
                        sectionId="seccion-recomendaciones-otras"
                        profile={engineProfile}
                        targetDraft={targetDraft}
                        budget={budget}
                        goal={goal}
                        league={league}
                        patch={patch}
                        journal={characterJournal}
                        journalLoading={characterJournalLoading}
                        onJournalStale={async () => {
                          await journal.reload();
                        }}
                        recommendations={recommendations}
                        onLoadDemo={character.loadDemo}
                        onEditProfile={completeProfile}
                        onFocusItem={focusItem}
                        onTrackRecommendation={trackRecommendation}
                        trackingRecommendation={journal.saving}
                        onStartSession={startSession}
                        startingSession={journal.saving}
                        appliedIds={appliedIds}
                        onAppliedChange={toggleApplied}
                        excludeRecommendationId={dominantRecommendation?.id ?? null}
                        view="otras"
                        // «Generar recomendaciones» existe UNA sola vez: como
                        // contenido dominante cuando no hay nada que mostrar, y
                        // si no, aquí, con su aviso de acción activa.
                        showGenerate={selection.kind !== "generate"}
                      />
                    }
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* --- Área 2: Plan y mercado ------------------------------------ */}
          {/* Dos columnas en escritorio, una sola en móvil. NUNCA se mezcla con
              el expediente: el plan objetivo es un plan, no el personaje real. */}
          <TabsContent value="plan" forceMount className={PANEL_CLASSES}>
            {mountedWorkspaces.has("plan") && (
              <Suspense
                fallback={
                  <section className="superficie-panel p-6 text-sm text-muted-foreground" role="status">
                    {t.planLoading}
                  </section>
                }
              >
                {/* Encabezado del área, no una caja aparte: antes era un panel
                    de 85 px de alto que solo contenía su propio título. */}
                <header
                  className="mb-6 flex items-center gap-3 border-b border-border/70 pb-4"
                  aria-labelledby="operaciones-titulo"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
                    <Compass className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="rotulo-seccion text-primary/70">Plan</p>
                    <h2
                      id="operaciones-titulo"
                      className="dossier-title text-2xl font-semibold text-foreground"
                    >
                      {t.planTitle}
                    </h2>
                  </div>
                </header>
                {savedNextAction && (
                  <section
                    className="mb-6 flex flex-col gap-3 rounded-md border border-primary/35 bg-primary/[0.04] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    aria-labelledby="plan-siguiente-paso-titulo"
                    data-testid="plan-siguiente-paso"
                  >
                    <div className="min-w-0">
                      <p className="rotulo-seccion text-primary/75">{t.savedStep}</p>
                      <h3
                        id="plan-siguiente-paso-titulo"
                        className="mt-1 text-lg font-semibold text-foreground"
                      >
                        {savedNextAction.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {savedNextAction.nextAction ?? savedNextAction.summary}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => navigateWorkspace("expediente")}
                    >
                      {t.openFollowUp}
                    </Button>
                  </section>
                )}
                <div className="mb-7">
                  <FeaturedBuildsSection
                    result={featuredBuilds.result}
                    loading={featuredBuilds.loading}
                    error={featuredBuilds.error}
                    onReload={featuredBuilds.reload}
                    onUseAsTarget={useFeaturedBuildAsTarget}
                  />
                </div>
                <div className="grid grid-cols-1 items-start gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <MarketSection
                    meta={meta}
                    metaLoading={metaLoading}
                    profile={character.profile}
                    league={league}
                    patch={activePatchId || "Desconocido"}
                    onLeagueChange={(nextLeague) => {
                      setLeague(nextLeague);
                      announceMentor({ type: "league", league: nextLeague });
                    }}
                    budget={budget}
                    onBudgetChange={updateBudgetWithMentor}
                    goal={goal}
                    onGoalChange={(nextGoal) => {
                      setGoal(nextGoal);
                      announceMentor({ type: "goal", goal: nextGoal });
                    }}
                    market={market}
                  />
                  <TargetSection
                    draft={targetDraft}
                    warnings={targetWarnings}
                    resolution={targetResolution}
                    onChange={(draft) => {
                      setTargetDraft(draft);
                      if (draft.plan !== targetDraft.plan) {
                        setTargetWarnings([]);
                        setTargetResolution(null);
                      }
                    }}
                    importBusy={character.busy === "build"}
                    importText={editorDrafts.pastedBuild}
                    onImportTextChange={editorDrafts.setPastedBuild}
                    onImportPlan={(content) => character.importBuild(content, activePatchId || "Desconocido", "target")}
                  />
                </div>
              </Suspense>
            )}
          </TabsContent>

          {/* --- Área 3: Crafting ----------------------------------------- */}
          <TabsContent value="crafting" forceMount className={PANEL_CLASSES}>
            {mountedWorkspaces.has("crafting") && (
              <Suspense
                fallback={
                  <section
                    className="superficie-panel p-6 text-sm text-muted-foreground"
                    role="status"
                    data-testid="crafting-loading"
                  >
                    Preparando el banco de Crafting…
                  </section>
                }
              >
                <CraftingSection
                  profile={character.profile}
                  patchCompatibility={activePatchCompatibility}
                  budget={budget}
                  goal={goal}
                  target={buildTargetFromDraft(targetDraft)}
                  journal={journal}
                  requestedItemId={craftingRequestedItemId}
                  onSelectedItemChange={setCraftingRequestedItemId}
                  onEditExpediente={() => openEditor(false, "item")}
                  onOpenCharacter={() => openEditor()}
                  onOpenEquipmentItem={(itemId) => {
                    const item = character.profile?.items.find(
                      (candidate) => candidate.id === itemId,
                    );
                    dialogTriggerRef.current = null;
                    navigateWorkspace("expediente");
                    window.requestAnimationFrame(() => {
                      setFocusedItemId(itemId);
                      if (item) announceMentor({ type: "item", item });
                    });
                  }}
                  onOpenPlanMarket={() => navigateWorkspace("plan")}
                  onStartCraftingDecision={startCraftingDecision}
                  onStartEssenceDecision={startEssenceDecision}
                  onStartAlloyDecision={startAlloyDecision}
                  onApplyCraftingResult={character.replaceItemAndSave}
                  onMentorEvent={handleSessionMentorEvent}
                  onMentorContext={announceMentor}
                  onCompareItem={(item) => {
                    setCompareRequest((current) => ({ item, seq: (current?.seq ?? 0) + 1 }));
                    setGuideViewRequest((current) => ({
                      view: "herramientas",
                      seq: (current?.seq ?? 0) + 1,
                    }));
                    navigateWorkspace("guias");
                  }}
                  onCheckResistances={() => {
                    setGuideViewRequest((current) => ({
                      view: "comprobar",
                      seq: (current?.seq ?? 0) + 1,
                    }));
                    navigateWorkspace("guias");
                    window.scrollTo({ top: 0 });
                  }}
                  onAskMentor={
                    character.profile
                      ? (text) => {
                          setMentorQuickQuestion((current) => ({
                            text,
                            seq: (current?.seq ?? 0) + 1,
                          }));
                          openMentorConversation();
                        }
                      : undefined
                  }
                />
              </Suspense>
            )}
          </TabsContent>

          {/* --- Área 4: Guías por acto ------------------------------------ */}
          <TabsContent value="guias" forceMount className={PANEL_CLASSES}>
            {mountedWorkspaces.has("guias") && (
              <GuidesSection
                guideSlug={guideSlug}
                viewRequest={guideViewRequest}
                compareRequest={compareRequest}
                onSelectGuide={(slug) => {
                  setGuideSlug(slug);
                  window.scrollTo({ top: 0 });
                }}
                profile={character.profile}
                buildMemory={journal.journal?.buildMemory ?? []}
                onCreateCharacter={() => {
                  setQuickCompleting(false);
                  setQuickCreateOpen(true);
                }}
                onOwnSupport={(skillName, supportName) => void character.rememberSupport(skillName, supportName)}
                patch={character.profile?.patch || activePatchId || "desconocido"}
                onAskMentor={
                  character.profile
                    ? (text) => {
                        setMentorQuickQuestion((current) => ({
                          text,
                          seq: (current?.seq ?? 0) + 1,
                        }));
                        openMentorConversation();
                      }
                    : undefined
                }
              />
            )}
          </TabsContent>
        </Tabs>

        {/*
          Editor completo del personaje: ÚNICA instancia de `CharacterSection`.

          El panel se monta y desmonta con normalidad —forzar el montaje de un
          modal de Radix deja `pointer-events: none` en el `body` y bloquea toda
          la aplicación— y lo que se conserva es el ESTADO: los borradores viven
          en `useEditorDrafts`, aquí arriba, así que cerrar y volver a abrir no
          borra el `.build` pegado, el texto del objeto ni los supports en
          edición. Radix aporta el confinamiento del foco y su devolución.
        */}
        <Sheet
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open);
            if (!open) {
              pendingMemoryActionRef.current = null;
              // Conservamos el contenido durante la animación de salida. Si
              // se borra aquí, el panel de «Evaluar un objeto» se transforma
              // durante unos instantes en el editor del personaje que acaba
              // de crear, aunque el destino ya sea Crafting.
              if (contextualCue.id !== "profile:saved") restoreMentorBaseContext();
            }
          }}
        >
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-y-auto sm:max-w-2xl"
            onOpenAutoFocus={(event) => {
              const guidedTarget =
                editorPrompt === "item" || editorPrompt === "gear"
                  ? "item-text"
                  : editorPrompt === "new"
                    ? "char-name"
                    : editorPrompt === "import"
                      ? "panel-importacion"
                      : null;
              if (guidedTarget !== null) {
                event.preventDefault();
              }
            }}
          >
            <SheetHeader>
              <SheetTitle>
                {editorPrompt === "memory"
                  ? t.sheetMemoryTitle
                  : editorPrompt === "gear"
                    ? t.sheetGearTitle
                  : editorPrompt === "item"
                    ? t.sheetItemTitle
                    : editorPrompt === "new"
                      ? t.sheetNewTitle
                      : editorPrompt === "import"
                        ? t.sheetImportTitle
                        : t.sheetEditTitle}
              </SheetTitle>
              <SheetDescription>
                {editorPrompt === "memory"
                  ? t.sheetMemoryText
                  : editorPrompt === "gear"
                    ? t.sheetGearText
                  : editorPrompt === "item"
                    ? t.sheetItemText
                    : editorPrompt === "new"
                      ? t.sheetNewText
                      : editorPrompt === "import"
                        ? t.sheetImportText
                        : t.sheetEditText}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8">
              <Suspense
                fallback={
                  <div className="p-6 text-sm text-muted-foreground" role="status">
                    {t.editorLoading}
                  </div>
                }
              >
                <CharacterSection
                  character={character}
                  meta={meta}
                  activePatch={activePatchId || "Desconocido"}
                  drafts={editorDrafts}
                  editorMode={
                    editorPrompt === "item" || editorPrompt === "gear"
                      ? "item"
                      : editorPrompt === "new"
                        ? "new"
                        : editorPrompt === "import"
                          ? "import"
                          : editorPrompt === "memory"
                            ? "memory"
                        : "full"
                  }
                  // La bienvenida ya ofrece importar y cargar el ejemplo: la
                  // sección no repite ni su vacío ni su botón de ejemplo.
                  hideEmptyState={showWelcome}
                  initialFocus={
                    editorPrompt === "item" || editorPrompt === "gear"
                      ? "item"
                      : editorPrompt === "new"
                        ? "character"
                        : editorPrompt === "import"
                          ? "import"
                          : editorPrompt === "pob"
                            ? "pob"
                            : null
                  }
                  onProfileSaved={(savedProfile) => {
                    announceMentor({ type: "profileSaved" });
                    const hasPendingAction = pendingMemoryActionRef.current !== null;
                    if (editorPrompt === "new" || hasPendingAction) {
                      setEditorOpen(false);
                      setEditorPrompt(null);
                    }
                    if (hasPendingAction) void resumePendingMemoryAction(savedProfile);
                  }}
                  onStartOver={() => {
                    setEditorOpen(false);
                    setEditorPrompt(null);
                    restoreMentorBaseContext();
                  }}
                  onItemImported={(item) => {
                    // "Analizar un objeto" desde la portada sí es una entrada
                    // directa a Crafting. Dentro de "Editar expediente", en
                    // cambio, el jugador está completando su personaje: debe
                    // poder añadir varias piezas y guardar las correcciones sin
                    // que la aplicación lo expulse del formulario.
                    if (editorPrompt === "item") {
                      setEditorOpen(false);
                      openCraftingForItem(item.id);
                    }
                  }}
                  onProfileImported={() => {
                    setEditorOpen(false);
                    setEditorPrompt(null);
                    navigateWorkspace("expediente");
                  }}
                  onIncompleteProfileImported={() => {
                    // Un .build oficial es un plan y puede carecer de clase,
                    // nivel y equipo. No cerramos el panel fingiendo que el
                    // alta terminó: lo convertimos en el editor completo para
                    // que el siguiente paso esté delante del jugador.
                    setEditorPrompt(null);
                    window.requestAnimationFrame(() => {
                      document.getElementById("char-class")?.focus();
                    });
                  }}
                  onGoToTargetImport={() => {
                    setEditorOpen(false);
                    setEditorPrompt(null);
                    navigateWorkspace("plan");
                    window.requestAnimationFrame(() => {
                      document.getElementById("panel-importacion-objetivo")?.focus();
                    });
                  }}
                />
              </Suspense>
            </div>
          </SheetContent>
        </Sheet>

        <footer className="mt-10 flex flex-col gap-1 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <p>{t.affiliation}</p>
          <p>{t.pricesNote}</p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <DataPrivacyDialog health={health} />
            <ReportProblemLink onOpen={() => setReportOpen(true)} />
          </p>
        </footer>
        <ReportProblemDialog open={reportOpen} onOpenChange={setReportOpen} area={tab} />
      </main>

      <ContextualMentor
        placement="floating"
        cue={contextualCue}
        answer={contextualAnswer}
        error={contextualError}
        loading={contextualLoadingSeq !== null}
        canAsk={
          character.profile !== null &&
          !patchGuidanceBlocked &&
          (mentorReadiness.ready || contextualCue.ask?.craftingState !== undefined)
        }
        blockedReason={
          patchGuidanceBlocked
            ? t.patchBlocked(activePatchCompatibility?.patchId ?? "")
            : character.profile !== null &&
                !mentorReadiness.ready &&
                contextualCue.ask !== null &&
                contextualCue.ask.craftingState === undefined
              ? t.completeFirst(mentorReadiness.issues.map((issue) => (lang === "en" ? issue.labelEn : issue.label).toLowerCase()).join(", "))
              : null
        }
        collapsed={contextualCollapsed}
        onCollapsedChange={setContextualCollapsed}
        onAsk={askContextualMentor}
        onOpenMentor={openMentorConversation}
        onReportProblem={() => {
          setContextualCollapsed(true);
          setReportOpen(true);
        }}
        nextStep={{
          kind: mascotStepKind,
          onGo: () => {
            setContextualCollapsed(true);
            if (mascotStepKind === "create") {
              setQuickCompleting(false);
              setQuickCreateOpen(true);
            } else if (mascotStepKind === "review") {
              openQuickReview();
            } else if (mascotStepKind === "gear") {
              navigateWorkspace("expediente");
              openEditor(false, "gear");
            } else {
              navigateWorkspace("expediente");
              window.setTimeout(showOpenCase, 150);
            }
          },
        }}
        // Sin personaje el Mentor no puede contestar: no se ofrece el cuadro.
        onQuickQuestion={
          character.profile !== null
            ? (question) => {
                setContextualCollapsed(true);
                askMentorQuickQuestion(question);
              }
            : undefined
        }
        onStuck={(kind) => {
          setContextualCollapsed(true);
          if (kind === "damage") {
            // La revisión rápida mira lo que más frena el daño de un novato.
            openQuickReview();
            return;
          }
          // «Me matan» → comprobación del acto (resistencias y recompensas);
          // «No sé adónde ir» → la ruta del acto.
          setGuideViewRequest((current) => ({
            view: kind === "dying" ? "comprobar" : "guia",
            seq: (current?.seq ?? 0) + 1,
          }));
          navigateWorkspace("guias");
          window.scrollTo({ top: 0 });
        }}
      />
      <QuickCharacterDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        initial={quickCompleting ? quickInitial : null}
        saving={character.busy === "save"}
        onCreate={async (input) => {
          const created =
            (quickCompleting
              ? await character.completeQuick(input)
              : await character.createQuick(input, {
                  league: league || meta?.leagues[0] || "Desconocida",
                  patch: patch || health?.patch.content || "Desconocido",
                })) !== null;
          // Sin equipo todavía no hay recomendaciones de equipo, pero la
          // revisión rápida ya sabe qué le frena: se abre rellena.
          if (created && !quickCompleting) openQuickReview(true);
          return created;
        }}
        onOpenFullEditor={() => {
          setQuickCreateOpen(false);
          if (quickCompleting) openEditor();
          else startManualJourney("new");
        }}
      />
      <Toaster theme="dark" richColors closeButton position="top-right" />
    </div>
  );
}
