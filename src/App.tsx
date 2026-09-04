import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Compass, FolderOpen, Hammer, RefreshCw } from "lucide-react";
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
import { WelcomePanel } from "@/components/WelcomePanel";
import { MentorBriefing, OpenCase, OpenCaseSecondary } from "@/components/OpenCase";
import { OpenCaseEvidence } from "@/components/OpenCaseEvidence";
import { OpenCaseRecommendation } from "@/components/OpenCaseRecommendation";
import { ExpedienteSection } from "@/sections/ExpedienteSection";
import { RecommendationsSection } from "@/sections/RecommendationsSection";
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
import { DecisionSessionSection } from "@/sections/DecisionSessionSection";

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
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import {
  contextualMentorCue,
  type ContextualMentorAsk,
  type ContextualMentorEvent,
} from "@/lib/contextualMentor";
import {
  allowsPatchGuidance,
  compatibilityForPatch,
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
type WorkspaceTab = "expediente" | "plan" | "crafting";
type EditorPrompt = "memory" | "new" | "item" | "import" | null;

/**
 * Los paneles se mantienen MONTADOS (`forceMount`) y se ocultan con CSS.
 * Cambiar de área no puede perder campos sin guardar, resultados generados ni
 * la conversación: buena parte de ese estado es local de cada sección.
 */
const PANEL_CLASSES =
  "flex flex-col gap-6 focus-visible:outline-none data-[state=inactive]:hidden";

function deferEffect(task: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) task();
  });
  return () => {
    cancelled = true;
  };
}

export default function App() {
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
  const [tab, setTab] = useState<WorkspaceTab>(
    initialPlanningWorkspace?.activeWorkspace ?? "expediente",
  );
  // Las áreas pesadas se descargan al visitarlas por primera vez y después
  // permanecen montadas para no perder formularios, selección ni sesiones.
  const [mountedWorkspaces, setMountedWorkspaces] = useState<Set<WorkspaceTab>>(
    () =>
      new Set([
        "expediente",
        initialPlanningWorkspace?.activeWorkspace ?? "expediente",
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
  const [editorPrompt, setEditorPrompt] = useState<EditorPrompt>(null);
  const [mentorBriefingOpen, setMentorBriefingOpen] = useState(false);
  const [contextualCue, setContextualCue] = useState(() =>
    contextualMentorCue({ type: "welcome" }),
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
    setContextualCue(contextualMentorCue(event));
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
          message: "El diario cambió en otra pestaña. He retirado el diagnóstico anterior.",
        });
      }
    });
  }, [journal.stale, clear, clearMentor, announceMentor]);

  const hasProfile = character.profile !== null;
  const activePatchId = character.profile?.patch || patch || health?.patch.id || "";
  const featuredBuilds = useFeaturedBuilds(league, activePatchId);
  const activePatchCompatibility = useMemo<PatchCompatibilityRecord | null>(() => {
    if (meta && activePatchId) {
      return compatibilityForPatch(meta.compatibility, activePatchId);
    }
    if (health && activePatchId === health.patch.id) return health.compatibility;
    return null;
  }, [activePatchId, health, meta]);
  const patchGuidanceBlocked =
    activePatchCompatibility !== null && !allowsPatchGuidance(activePatchCompatibility);

  const useFeaturedBuildAsTarget = useCallback((build: FeaturedBuild) => {
    setTargetDraft({
      name: build.title,
      sourceUrl: build.source.url,
      summary: `${build.summary}\n\nMotivo de la selección: ${build.whyFeatured}\nLímite principal: ${build.caveats[0]}`,
      desiredModsText: build.desiredMods.join("\n"),
      plan: null,
    });
    setTargetWarnings([]);
    setTargetResolution(null);
    announceMentor({ type: "planImported", name: build.title });
    toast.success("Build añadida como objetivo", {
      description: "Tu personaje actual no se ha modificado.",
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

  // Invalidación: si los inputs cambian tras generar, las recomendaciones quedan obsoletas.
  const currentInputsKey = character.profile
    ? JSON.stringify(
        buildRecommendationsRequest(
          character.profile,
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
        toast.info("Los datos han cambiado — vuelve a generar las recomendaciones");
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
          activeArea: tab,
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
  const currentMentorInputsKey = character.profile
    ? mentorInputsKey(
        buildMentorRequest(
          "",
          character.profile,
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
      toast.info("Los datos han cambiado — la conversación con el mentor se ha reiniciado");
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
      announceMentor({ type: "workspace", workspace });
    },
    [announceMentor],
  );

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
    announceMentor({ type: "workspace", workspace: previous });
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
        missing: mentorReadiness.issues.map((issue) => issue.label.toLowerCase()),
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
    const currencyChanged =
      nextBudget !== null && nextBudget.currency !== budget?.currency;
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

  const startManualJourney = (intent: "new" | "item") => {
    if (!character.profile) {
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
      toast.warning("Completa el expediente antes de guardar esta acción", {
        description: `Faltan ${profileReadiness.issues
          .map((issue) => issue.label.toLowerCase())
          .join(", ")}.`,
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
      toast.warning("Completa el expediente antes de comprobar esta mejora", {
        description: `Faltan ${profileReadiness.issues
          .map((issue) => issue.label.toLowerCase())
          .join(", ")}.`,
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
      toast.error("El personaje se guardó, pero no pude abrir su memoria", {
        description: "La acción elegida no se ha ejecutado. Vuelve a intentarlo desde el caso abierto.",
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
    const title = `Comprobar ${currencyLabel} en ${item.name}`;
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: `${title}: ${objective.desiredOutcome}`,
      hypothesis:
        "La acción es compatible con la estructura observada; se comprobará una sola vez sin asumir el modificador resultante.",
      expectedResult: action.effect,
      observationMethod:
        "Conserva el texto actual. Si decides aplicar la moneda, no realices otra acción: copia inmediatamente el objeto resultante y vuelve a importarlo.",
      unknowns: [
        {
          label: CRAFTING_RESULT_UNKNOWN_LABEL,
          blockingIrreversible: false,
        },
        {
          label: "No hay pesos ni probabilidades verificadas para estimar el resultado.",
          blockingIrreversible: false,
        },
      ],
      constraints: [
        {
          label: "No realizar otra acción de crafting antes de copiar el resultado.",
          relatedItemIds: [item.id],
        },
        {
          label: "El objeto debe seguir coincidiendo con el snapshot importado.",
          relatedItemIds: [item.id],
        },
        ...(objective.protectedModifierIds.length > 0
          ? [{
              label: "Los modificadores marcados como imprescindibles deben seguir presentes en el resultado.",
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
    const tierLabel = ESSENCE_TIER_LABELS[plan.tier];
    const title = `Comprobar ${essenceLabel} en ${item.name}`;
    const randomRemovalConstraint = evaluation.randomRemoval
      ? `Se retirará al azar 1 de los ${item.modifiers.filter((modifier) => modifier.kind === "explicit").length} modificadores explícitos observados.`
      : "Los modificadores actuales deberían conservarse durante la mejora de mágico a raro.";
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: `${title}: ${objective.desiredOutcome}`,
      hypothesis: evaluation.randomRemoval
        ? "La Essence retirará un modificador explícito al azar y añadirá el efecto garantizado copiado de su tooltip."
        : "La Essence elevará el objeto mágico a raro y añadirá el efecto garantizado copiado de su tooltip.",
      expectedResult: `Efecto garantizado declarado: ${plan.guaranteedModifierText}`,
      observationMethod:
        "Conserva este snapshot. Si aplicas la Essence, no realices ninguna otra acción: copia inmediatamente el objeto resultante y vuelve a importarlo.",
      unknowns: [
        {
          label: ESSENCE_RESULT_UNKNOWN_LABEL,
          blockingIrreversible: false,
        },
        {
          label: "No existe un pool completo y redistribuible para estimar probabilidades de afijos.",
          blockingIrreversible: false,
        },
      ],
      constraints: [
        { label: randomRemovalConstraint, relatedItemIds: [item.id] },
        {
          label: "El nombre y el efecto deben coincidir con el tooltip de la Essence que vas a gastar.",
          relatedItemIds: [item.id],
        },
        {
          label: "El objeto debe seguir coincidiendo con el snapshot importado.",
          relatedItemIds: [item.id],
        },
        ...(objective.protectedModifierIds.length > 0
          ? [{
              label: "La comparación debe comprobar uno por uno los modificadores protegidos.",
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
    const title = `Comprobar ${alloyLabel} en ${item.name}`;
    const next = await journal.startSession({
      journalRevision: buildRecommendationMemory(currentJournal).revision,
      idempotencyKey: crypto.randomUUID(),
      kind: "guided_decision",
      objective: `${title}: ${objective.desiredOutcome}`,
      hypothesis:
        "El Alloy reemplazará un modificador explícito y añadirá el modificador fabricado garantizado copiado del tooltip.",
      expectedResult: `Modificador fabricado garantizado declarado: ${plan.guaranteedModifierText}`,
      observationMethod:
        "Conserva este snapshot. Si aplicas el Alloy, no realices ninguna otra acción: copia inmediatamente el objeto resultante y vuelve a importarlo.",
      unknowns: [
        { label: ALLOY_RESULT_UNKNOWN_LABEL, blockingIrreversible: false },
        {
          label: "No existe una matriz pública completa Alloy × tipo de objeto para validar el efecto por nombre.",
          blockingIrreversible: false,
        },
        ...(plan.removalSelection === "unspecified"
          ? [{
              label: "No está verificado cómo se elige el modificador reemplazado.",
              blockingIrreversible: false,
            }]
          : []),
      ],
      constraints: [
        {
          label:
            plan.removalSelection === "random"
              ? `Cualquiera de los ${item.modifiers.filter((modifier) => modifier.kind === "explicit").length} modificadores explícitos observados puede ser reemplazado.`
              : plan.removalSelection === "player-selected"
                ? "Elige dentro del juego únicamente el modificador que aceptaste reemplazar."
                : "GGG confirma el reemplazo de un modificador, pero el criterio de selección no está verificado.",
          relatedItemIds: [item.id],
        },
        {
          label: `El tooltip declara estas clases: ${plan.declaredItemClasses.join(", ")}. El jugador confirmó que la pieza seleccionada pertenece a una de ellas.`,
          relatedItemIds: [item.id],
        },
        {
          label: "El Alloy y su efecto deben coincidir con el tooltip completo registrado en esta sesión.",
          relatedItemIds: [item.id],
        },
        {
          label: "El objeto debe seguir coincidiendo con el snapshot importado y no contener otro modificador fabricado.",
          relatedItemIds: [item.id],
        },
        ...(objective.protectedModifierIds.length > 0
          ? [{
              label: "Ningún modificador marcado como imprescindible puede desaparecer sin quedar señalado.",
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
      activeArea: tab,
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
        character.profile,
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

  const openMentorConversation = () => {
    setMentorBriefingOpen(true);
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
  }, [tab, mentorBriefingOpen]);

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
            missing: mentorReadiness.issues.map((issue) => issue.label.toLowerCase()),
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
        backLabel={
          workspaceHistory.length > 0
            ? "Volver al área anterior"
            : "Volver a personajes"
        }
        onAddCharacter={() => openEditor(true)}
        onOpenMentor={openMentorConversation}
      />

      <main
        className="mx-auto max-w-[92rem] px-4 pt-0 sm:px-6"
        /* El mentor flota fijo abajo: se reserva su altura real para que
           jamás tape una pregunta, un botón ni los datos del objeto. */
        style={{ paddingBottom: "calc(var(--mentor-inset, 6rem) + 1rem)" }}
      >
        {metaError && (
          <Alert variant="destructive" className="mb-6" data-testid="meta-error">
            <AlertTitle>No se pudo cargar la configuración del servidor</AlertTitle>
            <AlertDescription>
              <p>
                {metaError}. La interfaz sigue disponible, pero algunas listas (ligas,
                objetivos) pueden estar incompletas.
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
                {metaLoading ? "Reconectando…" : "Reintentar conexión"}
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
          className="gap-0"
        >
          {/* La navegación conserva su propia jerarquía. Música vive en la
              cabecera principal para no parecer una cuarta área de trabajo. */}
          <div className="workspace-nav sticky top-16 z-30 -mx-4 mb-8 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6">
            <div className="mx-auto flex max-w-[92rem] items-center justify-center">
              <TabsList
                aria-label="Áreas de Exile Copilot"
                className="grid h-auto min-w-0 flex-1 grid-cols-3 gap-1.5 bg-transparent p-0 lg:flex lg:w-auto lg:flex-none lg:gap-2"
              >
              <TabsTrigger
                value="expediente"
                data-testid="tab-expediente"
                className="min-w-0 flex-col gap-1 rounded-sm border border-border/70 bg-card/55 px-1.5 py-2.5 text-[10px] uppercase tracking-[0.06em] shadow-none transition-all hover:border-primary/45 hover:bg-card lg:flex-none lg:flex-row lg:gap-2 lg:px-3 lg:py-3 lg:text-xs lg:tracking-[0.11em] data-[state=active]:border-primary/65 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]"
              >
                <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate lg:hidden">Expediente</span>
                <span className="hidden truncate lg:inline">Expediente y mentor</span>
              </TabsTrigger>
              <TabsTrigger
                value="plan"
                data-testid="tab-plan"
                className="min-w-0 flex-col gap-1 rounded-sm border border-border/70 bg-card/55 px-1.5 py-2.5 text-[10px] uppercase tracking-[0.06em] shadow-none transition-all hover:border-primary/45 hover:bg-card lg:flex-none lg:flex-row lg:gap-2 lg:px-3 lg:py-3 lg:text-xs lg:tracking-[0.11em] data-[state=active]:border-primary/65 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]"
              >
                <Compass className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate lg:hidden">Plan</span>
                <span className="hidden truncate lg:inline">Plan y mercado</span>
              </TabsTrigger>
              <TabsTrigger
                value="crafting"
                data-testid="tab-crafting"
                className="min-w-0 flex-col gap-1 rounded-sm border border-border/70 bg-card/55 px-1.5 py-2.5 text-[10px] uppercase tracking-[0.06em] shadow-none transition-all hover:border-primary/45 hover:bg-card lg:flex-none lg:flex-row lg:gap-2 lg:px-3 lg:py-3 lg:text-xs lg:tracking-[0.11em] data-[state=active]:border-primary/65 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]"
              >
                <Hammer className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Crafting</span>
              </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* --- Área 1: Expediente y mentor -------------------------------- */}
          <TabsContent value="expediente" forceMount className={PANEL_CLASSES}>
            {character.restorationError !== null ? (
              <Alert variant="destructive" data-testid="character-restore-error">
                <AlertTitle>No pudimos abrir tu expediente guardado</AlertTitle>
                <AlertDescription>
                  <p>
                    {character.restorationError} No crees otro personaje todavía: tus
                    datos no se han descartado.
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
                    {character.restoring ? "Recuperando…" : "Reintentar recuperación"}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : showWelcome ? (
              // Sin personaje: solo la bienvenida. Ni expediente ni caso vacíos.
              <WelcomePanel
                loadingDemo={character.busy === "demo"}
                onLoadDemo={() => void character.loadDemo()}
                onGoToImport={() => openEditor(true)}
                onStartNew={() => startManualJourney("new")}
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
              <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[minmax(28rem,32rem)_minmax(0,1fr)] lg:items-start">
                {/* En móvil el caso abierto va PRIMERO: el jugador conoce el
                    contexto antes de inspeccionar la pieza (§8). */}
                <div className="order-1 flex flex-col gap-6 lg:order-2 lg:col-start-2 lg:row-start-1">
                  <OpenCase
                    selection={selection}
                    profileReadiness={profileReadiness}
                    sessionSlot={
                      activeCraftingExperiment ? (
                        <div className="space-y-3" data-testid="crafting-session-redirect">
                          <h3 className="text-xl font-semibold">Crafting en curso</h3>
                          <p className="text-sm text-muted-foreground">
                            Estás comprobando {activeCraftingExperiment.actionLabel} en {activeCraftingExperiment.originalItem.name}.
                            El preflight y el resultado viven en el banco de Crafting para no duplicar la sesión.
                          </p>
                          <Button type="button" onClick={() => navigateWorkspace("crafting")}>
                            Continuar en Crafting
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
                        profile={character.profile}
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
                        onEditProfile={() => openEditor()}
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
                  />
                </div>

                {/* Expediente: identidad, paperdoll y acceso al editor. */}
                <div className="order-2 lg:order-1 lg:col-start-1 lg:row-span-3 lg:row-start-1">
                  <ExpedienteSection
                    profile={character.profile}
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
                    mentorContextId={contextualCue.id}
                  />
                </div>

                {/* La cabecera ya ofrece el acceso global al Mentor. La
                    conversación completa aparece después del equipo para no
                    duplicar la misma decisión en la primera pantalla. */}
                <div className="order-3 lg:col-start-2 lg:row-start-2">
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
                      onEditProfile={() => openEditor()}
                    />
                  </MentorBriefing>
                </div>

                {/* Memoria y alternativas: tras el equipo y Mentor en móvil. */}
                <div className="order-4 lg:col-start-2 lg:row-start-3">
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
                        profile={character.profile}
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
                        onEditProfile={() => openEditor()}
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
                    Preparando el plan y el mercado…
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
                    <p className="rotulo-seccion text-primary/70">Mesa de operaciones</p>
                    <h2
                      id="operaciones-titulo"
                      className="dossier-title text-2xl font-semibold text-foreground"
                    >
                      Decide el rumbo antes de gastar
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
                      <p className="rotulo-seccion text-primary/75">Siguiente paso guardado</p>
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
                      Abrir seguimiento
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
                />
              </Suspense>
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
                editorPrompt === "item"
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
                  ? "Guardar y continuar"
                  : editorPrompt === "item"
                  ? "Evaluar un objeto"
                  : editorPrompt === "new"
                    ? "Crear personaje"
                    : editorPrompt === "import"
                      ? "Añadir tu personaje"
                    : "Editar expediente"}
              </SheetTitle>
              <SheetDescription>
                {editorPrompt === "memory"
                  ? "Guarda este personaje para que el mentor pueda recordar próximos pasos y sesiones."
                  : editorPrompt === "item"
                    ? "Pega el texto del objeto copiado en PoE2. Al analizarlo pasarás directamente al banco de Crafting."
                    : editorPrompt === "new"
                      ? "Completa únicamente lo que sabes. Los datos desconocidos pueden quedarse vacíos."
                    : editorPrompt === "import"
                      ? "Trae tu personaje actual desde Path of Building 2. Los archivos .build de objetivo se importan en Plan y mercado."
                  : "Corrige o completa los datos de tu personaje. Los cambios se guardan con «Guardar correcciones»."}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8">
              <Suspense
                fallback={
                  <div className="p-6 text-sm text-muted-foreground" role="status">
                    Preparando el editor…
                  </div>
                }
              >
                <CharacterSection
                  character={character}
                  meta={meta}
                  activePatch={activePatchId || "Desconocido"}
                  drafts={editorDrafts}
                  editorMode={
                    editorPrompt === "item"
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
                    editorPrompt === "item"
                      ? "item"
                      : editorPrompt === "new"
                        ? "character"
                        : editorPrompt === "import"
                          ? "import"
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
          <p>{GGG_AFFILIATION_NOTICE}</p>
          <p>
            Los precios proceden de poe.ninja y las referencias de builds de la comunidad
            no están verificadas.
          </p>
          <p className="mt-1">
            <DataPrivacyDialog health={health} />
          </p>
        </footer>
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
            ? `El parche ${activePatchCompatibility?.patchId} aún no está revisado. No analizaré mejoras ni acciones mecánicas con datos anteriores.`
            : character.profile !== null &&
                !mentorReadiness.ready &&
                contextualCue.ask !== null &&
                contextualCue.ask.craftingState === undefined
              ? `Completa ${mentorReadiness.issues
                  .map((issue) => issue.label.toLowerCase())
                  .join(", ")} antes de pedirme una prioridad del personaje.`
              : null
        }
        collapsed={contextualCollapsed}
        onCollapsedChange={setContextualCollapsed}
        onAsk={askContextualMentor}
        onOpenMentor={openMentorConversation}
      />
      <Toaster theme="dark" richColors closeButton position="top-right" />
    </div>
  );
}
