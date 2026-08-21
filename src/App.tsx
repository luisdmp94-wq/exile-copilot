import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Compass, FolderOpen } from "lucide-react";
import type { Budget, GoalKind, Recommendation } from "@shared/domain.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import {
  GGG_AFFILIATION_NOTICE,
  type PlanResolution,
} from "@shared/passiveRegistry.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { WelcomePanel } from "@/components/WelcomePanel";
import { OpenCase, OpenCaseSecondary } from "@/components/OpenCase";
import { OpenCaseEvidence } from "@/components/OpenCaseEvidence";
import { OpenCaseRecommendation } from "@/components/OpenCaseRecommendation";
import { CharacterSection } from "@/sections/CharacterSection";
import { ExpedienteSection } from "@/sections/ExpedienteSection";
import { MarketSection } from "@/sections/MarketSection";
import { RecommendationsSection } from "@/sections/RecommendationsSection";
import { TargetSection, type TargetDraft } from "@/sections/TargetSection";
import { useCharacter } from "@/hooks/useCharacter";
import { useEditorDrafts } from "@/hooks/useEditorDrafts";
import { useMarket } from "@/hooks/useMarket";
import { useMeta } from "@/hooks/useMeta";
import { useRecommendations } from "@/hooks/useRecommendations";
import { buildRecommendationsRequest } from "@/lib/recommendationsRequest";
import {
  compactRecommendationReason,
  journalEntryFromRecommendation,
} from "@/lib/journal";
import { openCaseLimitations, selectOpenCase } from "@/lib/openCase";
import { observationMethodForRecommendation } from "@/lib/sessionOutcome";
import { MentorChatSection } from "@/sections/MentorChatSection";
import { useMentor } from "@/hooks/useMentor";
import { buildMentorRequest } from "@/lib/mentorRequest";
import { mentorInputsKey } from "@shared/mentorQuery.js";
import { useJournal } from "@/hooks/useJournal";
import { JournalSection } from "@/sections/JournalSection";
import { DecisionSessionSection } from "@/sections/DecisionSessionSection";
import { buildRecommendationMemory } from "@shared/journalMemory.js";

const EMPTY_TARGET: TargetDraft = {
  name: "",
  sourceUrl: "",
  summary: "",
  desiredModsText: "",
  plan: null,
};

/**
 * Las DOS áreas del espacio de trabajo (Fase Visual 1, §2).
 *
 * «Personaje» ya no es un área: su editor completo sigue existiendo una sola
 * vez, dentro del panel lateral «Editar expediente».
 */
type WorkspaceTab = "expediente" | "plan";
type EditorPrompt = "memory" | null;

/**
 * Los paneles se mantienen MONTADOS (`forceMount`) y se ocultan con CSS.
 * Cambiar de área no puede perder campos sin guardar, resultados generados ni
 * la conversación: buena parte de ese estado es local de cada sección.
 */
const PANEL_CLASSES =
  "flex flex-col gap-6 focus-visible:outline-none data-[state=inactive]:hidden";

export default function App() {
  const { health, meta, loading: metaLoading, error: metaError } = useMeta();

  const [league, setLeague] = useState("");
  const [patch, setPatch] = useState("");
  const [budget, setBudget] = useState<Budget>({ amount: 50, currency: "exalted" });
  const [goal, setGoal] = useState<GoalKind>("balanced");
  const [targetDraft, setTargetDraft] = useState<TargetDraft>(EMPTY_TARGET);
  const [targetWarnings, setTargetWarnings] = useState<string[]>([]);
  // Resolución de ids del plan contra el registro oficial: se guarda APARTE del
  // plan para no alterar nunca el `.build` crudo que se reexporta.
  const [targetResolution, setTargetResolution] = useState<PlanResolution | null>(null);
  // Navegación caso → objeto (solo con vínculo estructurado del motor).
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  // Elemento que abrió el detalle: puede ser un hueco del paperdoll o el botón
  // «Ver el objeto evaluado» del caso. Al cerrar se le devuelve el foco.
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("expediente");
  // Panel lateral con el editor completo del personaje.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPrompt, setEditorPrompt] = useState<EditorPrompt>(null);
  // La bienvenida pide «Importar mi personaje»: abre el editor Y lleva el foco
  // al panel de importación en lugar de al primer control del panel.
  const focusImportOnOpen = useRef(false);
  // Borradores del editor: viven fuera del panel para sobrevivir a su cierre.
  const editorDrafts = useEditorDrafts();

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
      },
    }),
    [],
  );
  const character = useCharacter(characterOptions);
  const journal = useJournal(character.profile?.id ?? null);
  const mentor = useMentor();
  const characterJournal =
    character.profile && journal.journal?.characterId === character.profile.id
      ? journal.journal
      : null;
  const characterJournalLoading =
    character.profile !== null && (journal.loading || characterJournal === null);
  const market = useMarket();
  const recommendations = useRecommendations();
  const { resultInputsKey, clear } = recommendations;
  const { threadInputsKey: mentorThreadKey, clear: clearMentor } = mentor;

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
  const toggleApplied = (id: string, applied: boolean) =>
    setAppliedIds((prev) => ({ ...prev, [id]: applied }));

  // Recuperación del 409: si el diario quedó obsoleto (otra pestaña escribió),
  // las recomendaciones y la conversación que se veían ya no corresponden a la
  // memoria vigente y se retiran en lugar de quedar en pantalla.
  useEffect(() => {
    if (journal.stale) {
      clear();
      clearMentor();
    }
  }, [journal.stale, clear, clearMentor]);

  const hasProfile = character.profile !== null;

  // Valores por defecto en cuanto llegan /api/meta y /api/health.
  useEffect(() => {
    if (meta && !league && meta.leagues.length > 0) {
      setLeague(meta.leagues[0]);
    }
    if (!patch) {
      if (meta && meta.patches.length > 0) {
        setPatch(meta.patches[0].id);
      } else if (health) {
        setPatch(health.patch.content);
      }
    }
  }, [meta, health, league, patch]);

  // Si el perfil importado/restaurado trae liga y parche propios, respetarlos.
  useEffect(() => {
    const profile = character.profile;
    if (profile) {
      setLeague(profile.league || league);
      setPatch(profile.patch || patch);
    }
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
    if (resultInputsKey && resultInputsKey !== currentInputsKey) {
      clear();
      toast.info("Los datos han cambiado — vuelve a generar las recomendaciones");
    }
  }, [currentInputsKey, resultInputsKey, clear]);

  // La conversación NO se persiste y se descarta en cuanto cambian los inputs
  // relevantes: así el hilo nunca muestra respuestas obsoletas.
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
        ),
      )
    : null;
  useEffect(() => {
    if (mentorThreadKey && mentorThreadKey !== currentMentorInputsKey) {
      clearMentor();
      toast.info("Los datos han cambiado — la conversación con el mentor se ha reiniciado");
    }
  }, [currentMentorInputsKey, mentorThreadKey, clearMentor]);

  /**
   * Jerarquía del Caso Abierto: sesión abierta → acción activa del diario →
   * recomendación vigente → generar. La decide una función pura para poder
   * probarla sin montar la interfaz.
   */
  const resultRecommendations = useMemo(
    () => recommendations.result?.recommendations ?? [],
    [recommendations.result],
  );
  const selection = useMemo(
    () =>
      selectOpenCase({
        hasProfile,
        journal: characterJournal,
        recommendations: resultRecommendations,
      }),
    [hasProfile, characterJournal, resultRecommendations],
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

  const focusItem = (itemId: string, trigger: HTMLElement) => {
    dialogTriggerRef.current = trigger;
    setFocusedItemId(itemId);
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
    focusImportOnOpen.current = focusImport;
    setEditorPrompt(prompt);
    setEditorOpen(true);
  };

  const trackRecommendation = (recommendation: Recommendation) => {
    if (!character.profile) return;
    if (!character.persisted || !characterJournal) {
      openEditor(false, "memory");
      return;
    }
    void journal.createEntry({
      ...journalEntryFromRecommendation(recommendation, character.profile, budget, goal),
      journalRevision: buildRecommendationMemory(characterJournal).revision,
    });
  };

  const startSession = (recommendation: Recommendation) => {
    if (!character.profile) return;
    if (!character.persisted || !characterJournal) {
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
          document.getElementById("caso-abierto")?.scrollIntoView({ block: "start" });
        }
      });
  };

  // La bienvenida sustituye a los paneles vacíos, pero no debe aparecer mientras
  // se restaura un personaje guardado (si no, parpadearía antes de cargarlo).
  const showWelcome = !hasProfile && !character.restoring;

  const evidenceSlot =
    selection.kind === "recommendation" || selection.kind === "journal" ? (
      <OpenCaseEvidence
        recommendation={selection.recommendation}
        entry={selection.journalEntry}
      />
    ) : null;

  return (
    <div className="min-h-screen text-foreground">
      <AppHeader health={health} loading={metaLoading} profile={character.profile} />

      <main className="mx-auto max-w-[92rem] px-4 pb-12 pt-0 sm:px-6">
        {metaError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>No se pudo cargar la configuración del servidor</AlertTitle>
            <AlertDescription>
              {metaError}. La interfaz sigue disponible, pero algunas listas (ligas,
              objetivos) pueden estar incompletas.
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as WorkspaceTab)}
          className="gap-0"
        >
          {/* Navegación segmentada: se queda a la vista al desplazarse, pero
              ocupa poco. El propio Radix aporta teclado (flechas, Home/End). */}
          <div className="workspace-nav sticky top-0 z-30 -mx-4 mb-8 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6">
            <TabsList
              aria-label="Áreas de Exile Copilot"
              className="h-auto w-full justify-start gap-7 bg-transparent p-0 sm:w-auto"
            >
              <TabsTrigger
                value="expediente"
                data-testid="tab-expediente"
                className="min-w-0 flex-1 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 text-xs uppercase tracking-[0.13em] shadow-none sm:flex-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate sm:hidden">Expediente</span>
                <span className="hidden truncate sm:inline">Expediente y mentor</span>
              </TabsTrigger>
              <TabsTrigger
                value="plan"
                data-testid="tab-plan"
                className="min-w-0 flex-1 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 text-xs uppercase tracking-[0.13em] shadow-none sm:flex-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Compass className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate sm:hidden">Plan</span>
                <span className="hidden truncate sm:inline">Plan y mercado</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- Área 1: Expediente y mentor -------------------------------- */}
          <TabsContent value="expediente" forceMount className={PANEL_CLASSES}>
            {showWelcome ? (
              // Sin personaje: solo la bienvenida. Ni expediente ni caso vacíos.
              <WelcomePanel
                loadingDemo={character.busy === "demo"}
                onLoadDemo={() => void character.loadDemo()}
                onGoToImport={() => openEditor(true)}
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
                onEditExpediente={() => openEditor()}
              />
            ) : (
              <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[minmax(23rem,26rem)_minmax(0,1fr)] lg:items-start">
                {/* En móvil el caso abierto va PRIMERO: el jugador conoce el
                    contexto antes de inspeccionar la pieza (§8). */}
                <div className="order-1 flex flex-col gap-6 lg:order-2 lg:col-start-2">
                  <OpenCase
                    selection={selection}
                    sessionSlot={
                      <DecisionSessionSection
                        profile={character.profile}
                        budget={budget}
                        goal={goal}
                        journal={journal}
                        pendingRecommendation={dominantRecommendation}
                        onEditExpediente={() => openEditor()}
                      />
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
                        profile={character.profile}
                        targetDraft={targetDraft}
                        budget={budget}
                        goal={goal}
                        league={league}
                        patch={patch}
                        journal={characterJournal}
                        journalLoading={characterJournalLoading}
                        onJournalStale={journal.reload}
                        recommendations={recommendations}
                        onLoadDemo={character.loadDemo}
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
                    mentorSlot={
                      <MentorChatSection
                        profile={character.profile}
                        mentor={mentor}
                        savingNextAction={journal.saving}
                        onAsk={(question) => {
                          if (!character.profile) return;
                          void mentor
                            .ask(
                              buildMentorRequest(
                                question,
                                character.profile,
                                targetDraft,
                                budget,
                                goal,
                                league,
                                patch,
                                characterJournal,
                              ),
                            )
                            .then((outcome) => {
                              if (outcome === "journal-stale") void journal.reload();
                            });
                        }}
                        onSaveNextAction={(answer) => {
                          const recommendation = answer.nextAction?.recommendation ?? null;
                          if (recommendation === null) return;
                          trackRecommendation(recommendation);
                        }}
                        onFocusItem={focusItem}
                      />
                    }
                  />
                </div>

                {/* Expediente: identidad, paperdoll y acceso al editor. */}
                <div className="order-2 lg:order-1 lg:col-start-1 lg:row-start-1">
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
                    onEditExpediente={() => openEditor()}
                  />
                </div>

                {/* Memoria y alternativas: tras el equipo en móvil (§8). */}
                <div className="order-3 lg:col-start-2 lg:row-start-2">
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
                        profile={character.profile}
                        targetDraft={targetDraft}
                        budget={budget}
                        goal={goal}
                        league={league}
                        patch={patch}
                        journal={characterJournal}
                        journalLoading={characterJournalLoading}
                        onJournalStale={journal.reload}
                        recommendations={recommendations}
                        onLoadDemo={character.loadDemo}
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
            <section className="operations-intro mb-7 px-6 py-7" aria-labelledby="operaciones-titulo">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/75">
                Mesa de operaciones
              </p>
              <h2 id="operaciones-titulo" className="dossier-title mt-2 text-4xl font-semibold text-foreground">
                Decide el rumbo antes de gastar
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Tu objetivo marca la dirección. El mercado solo acota lo que es posible
                comprobar hoy; no sustituye el diagnóstico del mentor.
              </p>
            </section>
            <div className="grid grid-cols-1 items-start gap-7 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
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
              />
              <MarketSection
                meta={meta}
                metaLoading={metaLoading}
                profile={character.profile}
                league={league}
                onLeagueChange={setLeague}
                budget={budget}
                onBudgetChange={setBudget}
                goal={goal}
                onGoalChange={setGoal}
                market={market}
              />
            </div>
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
            if (!open) setEditorPrompt(null);
          }}
        >
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-y-auto sm:max-w-2xl"
            onOpenAutoFocus={(event) => {
              if (!focusImportOnOpen.current) return;
              focusImportOnOpen.current = false;
              event.preventDefault();
              document.getElementById("panel-importacion")?.focus();
            }}
          >
            <SheetHeader>
              <SheetTitle>Editar expediente</SheetTitle>
              <SheetDescription>
                {editorPrompt === "memory"
                  ? "Guarda este personaje para que el mentor pueda recordar próximos pasos y sesiones."
                  : "Importa, corrige o completa los datos de tu personaje. Los cambios se guardan con «Guardar correcciones»."}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8">
              <CharacterSection
                character={character}
                meta={meta}
                drafts={editorDrafts}
                // La bienvenida ya ofrece importar y cargar el ejemplo: la
                // sección no repite ni su vacío ni su botón de ejemplo.
                hideEmptyState={showWelcome}
              />
            </div>
          </SheetContent>
        </Sheet>

        <footer className="mt-10 flex flex-col gap-1 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          <p>{GGG_AFFILIATION_NOTICE}</p>
          <p>
            Los precios proceden de poe.ninja y las referencias de builds de la comunidad
            no están verificadas.
          </p>
        </footer>
      </main>

      <Toaster theme="dark" richColors closeButton position="bottom-right" />
    </div>
  );
}
