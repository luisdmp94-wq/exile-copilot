import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Compass, MessageCircleQuestion, UserRound } from "lucide-react";
import type { Budget, GoalKind } from "@shared/domain.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import {
  GGG_AFFILIATION_NOTICE,
  type PlanResolution,
} from "@shared/passiveRegistry.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
import { WelcomePanel } from "@/components/WelcomePanel";
import { CharacterSection } from "@/sections/CharacterSection";
import { MarketSection } from "@/sections/MarketSection";
import { RecommendationsSection } from "@/sections/RecommendationsSection";
import { TargetSection, type TargetDraft } from "@/sections/TargetSection";
import { useCharacter } from "@/hooks/useCharacter";
import { useMarket } from "@/hooks/useMarket";
import { useMeta } from "@/hooks/useMeta";
import { useRecommendations } from "@/hooks/useRecommendations";
import { buildRecommendationsRequest } from "@/lib/recommendationsRequest";
import { journalEntryFromRecommendation } from "@/lib/journal";
import { MentorChatSection } from "@/sections/MentorChatSection";
import { useMentor } from "@/hooks/useMentor";
import { buildMentorRequest } from "@/lib/mentorRequest";
import { mentorInputsKey } from "@shared/mentorQuery.js";
import { useJournal } from "@/hooks/useJournal";
import { JournalSection } from "@/sections/JournalSection";

const EMPTY_TARGET: TargetDraft = {
  name: "",
  sourceUrl: "",
  summary: "",
  desiredModsText: "",
  plan: null,
};

/** Las tres áreas del espacio de trabajo. */
type WorkspaceTab = "mentor" | "personaje" | "plan";

/**
 * Los tres paneles se mantienen MONTADOS (`forceMount`) y se ocultan con CSS.
 * Cambiar de pestaña no puede perder campos sin guardar, resultados generados ni
 * la conversación: buena parte de ese estado es local de cada sección
 * (borradores de objetos, texto del chat, recomendaciones aplicadas…).
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
  // Navegación recomendación → objeto (solo con vínculo estructurado del motor).
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  // Elemento que abrió el detalle: puede ser un hueco del paperdoll o el botón
  // «Ver el objeto evaluado» de una recomendación. Al cerrar se le devuelve el foco.
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  // Área visible. `null` solo mientras se decide la de entrada (ver más abajo).
  const [tab, setTab] = useState<WorkspaceTab | null>(null);
  const entryTabDecided = useRef(false);

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

  const hasProfile = character.profile !== null;
  const activeTab: WorkspaceTab = tab ?? "personaje";

  /**
   * El área de entrada se decide UNA sola vez, cuando termina la restauración:
   * con personaje se entra por «Mentor»; sin personaje, por «Personaje», que es
   * donde viven la bienvenida y la importación.
   *
   * Después no se cambia sola nunca más: cargar el ejemplo o importar no debe
   * arrancar al jugador de la pantalla en la que está trabajando.
   */
  useEffect(() => {
    if (entryTabDecided.current || character.restoring) return;
    entryTabDecided.current = true;
    setTab(character.profile !== null ? "mentor" : "personaje");
  }, [character.restoring, character.profile]);

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
  const { threadInputsKey: mentorThreadKey, clear: clearMentor } = mentor;
  useEffect(() => {
    if (mentorThreadKey && mentorThreadKey !== currentMentorInputsKey) {
      clearMentor();
      toast.info("Los datos han cambiado — la conversación con el mentor se ha reiniciado");
    }
  }, [currentMentorInputsKey, mentorThreadKey, clearMentor]);

  const focusItem = (itemId: string, trigger: HTMLElement) => {
    dialogTriggerRef.current = trigger;
    setFocusedItemId(itemId);
  };

  // La bienvenida sustituye a los paneles vacíos, pero no debe aparecer mientras
  // se restaura un personaje guardado (si no, parpadearía antes de cargarlo).
  const showWelcome = !hasProfile && !character.restoring;

  return (
    <div className="min-h-screen text-foreground">
      <AppHeader health={health} loading={metaLoading} profile={character.profile} />

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-4">
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
          value={activeTab}
          onValueChange={(value) => setTab(value as WorkspaceTab)}
          className="gap-0"
        >
          {/* Navegación segmentada: se queda a la vista al desplazarse, pero
              ocupa poco. El propio Radix aporta teclado (flechas, Home/End). */}
          <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-border bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <TabsList
              aria-label="Áreas de Exile Copilot"
              className="h-auto w-full gap-1 bg-muted/50 p-1 sm:w-auto"
            >
              <TabsTrigger
                value="mentor"
                data-testid="tab-mentor"
                className="min-w-0 flex-1 gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary sm:flex-none"
              >
                <MessageCircleQuestion className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Mentor</span>
              </TabsTrigger>
              <TabsTrigger
                value="personaje"
                data-testid="tab-personaje"
                className="min-w-0 flex-1 gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary sm:flex-none"
              >
                <UserRound className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Personaje</span>
              </TabsTrigger>
              <TabsTrigger
                value="plan"
                data-testid="tab-plan"
                className="min-w-0 flex-1 gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary sm:flex-none"
              >
                <Compass className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate sm:hidden">Plan</span>
                <span className="hidden truncate sm:inline">Plan y mercado</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- Área 1: Mentor -------------------------------------------- */}
          {/* Orden: acción actual → conversación → recomendaciones → historial.
              El historial reciente vive dentro de JournalSection, junto a la
              acción activa que documenta. */}
          <TabsContent value="mentor" forceMount className={PANEL_CLASSES}>
            <JournalSection
              profile={character.profile}
              budget={budget}
              goal={goal}
              journal={journal}
            />

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
                  if (!character.profile || recommendation === null) return;
                  void journal.createEntry(
                    journalEntryFromRecommendation(
                      recommendation,
                      character.profile,
                      budget,
                      goal,
                    ),
                  );
                }}
                onFocusItem={focusItem}
              />

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
                onTrackRecommendation={(recommendation) => {
                  if (!character.profile) return;
                  void journal.createEntry(
                    journalEntryFromRecommendation(
                      recommendation,
                      character.profile,
                      budget,
                      goal,
                    ),
                  );
                }}
                trackingRecommendation={journal.saving}
              />
            </div>
          </TabsContent>

          {/* --- Área 2: Personaje ----------------------------------------- */}
          <TabsContent value="personaje" forceMount className={PANEL_CLASSES}>
            {showWelcome && (
              <WelcomePanel
                loadingDemo={character.busy === "demo"}
                onLoadDemo={() => void character.loadDemo()}
                onGoToImport={() => {
                  const panel = document.getElementById("panel-importacion");
                  panel?.scrollIntoView({ block: "center", behavior: "auto" });
                  panel?.focus();
                }}
              />
            )}
            <CharacterSection
              character={character}
              meta={meta}
              recommendations={recommendations.result?.recommendations ?? []}
              focusedItemId={focusedItemId}
              onFocusHandled={() => setFocusedItemId(null)}
              dialogTriggerRef={dialogTriggerRef}
            />
          </TabsContent>

          {/* --- Área 3: Plan y mercado ------------------------------------ */}
          {/* Dos columnas en escritorio, una sola en móvil. */}
          <TabsContent value="plan" forceMount className={PANEL_CLASSES}>
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
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
