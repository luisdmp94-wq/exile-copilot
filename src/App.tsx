import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Budget, GoalKind } from "@shared/domain.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import {
  GGG_AFFILIATION_NOTICE,
  type PlanResolution,
} from "@shared/passiveRegistry.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
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
import { DecisionSessionSection } from "@/sections/DecisionSessionSection";
import { buildRecommendationMemory } from "@shared/journalMemory.js";

const EMPTY_TARGET: TargetDraft = {
  name: "",
  sourceUrl: "",
  summary: "",
  desiredModsText: "",
  plan: null,
};

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

  useEffect(() => {
    if (journal.stale) {
      clear();
      clearMentor();
    }
  }, [journal.stale, clear, clearMentor]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader health={health} loading={metaLoading} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {metaError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>No se pudo cargar la configuración del servidor</AlertTitle>
            <AlertDescription>
              {metaError}. La interfaz sigue disponible, pero algunas listas (ligas,
              objetivos) pueden estar incompletas.
            </AlertDescription>
          </Alert>
        )}

        <JournalSection
          profile={character.profile}
          budget={budget}
          goal={goal}
          journal={journal}
        />

        <DecisionSessionSection
          profile={character.profile}
          budget={budget}
          journal={journal}
          pendingRecommendation={recommendations.result?.recommendations[0] ?? null}
        />

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <div className="flex flex-col gap-6">
            <CharacterSection
              character={character}
              meta={meta}
              recommendations={recommendations.result?.recommendations ?? []}
              focusedItemId={focusedItemId}
              onFocusHandled={() => setFocusedItemId(null)}
              dialogTriggerRef={dialogTriggerRef}
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
            />
          </div>
          <div className="flex flex-col gap-6">
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
              onFocusItem={(itemId, trigger) => {
                dialogTriggerRef.current = trigger;
                setFocusedItemId(itemId);
              }}
              onTrackRecommendation={(recommendation) => {
                if (!character.profile) return;
                void journal.createEntry({
                  ...journalEntryFromRecommendation(
                    recommendation,
                    character.profile,
                    budget,
                    goal,
                  ),
                  ...(characterJournal
                    ? {
                        journalRevision: buildRecommendationMemory(characterJournal)
                          .revision,
                      }
                    : {}),
                });
              }}
              trackingRecommendation={journal.saving}
              onStartSession={(recommendation) => {
                if (!character.profile || !characterJournal) return;
                void journal.startSession({
                  journalRevision: buildRecommendationMemory(characterJournal).revision,
                  idempotencyKey: crypto.randomUUID(),
                  kind: "guided_decision",
                  objective: recommendation.title,
                  hypothesis: recommendation.reason.slice(0, 2000),
                  expectedResult: recommendation.impact.description,
                  observationMethod: "Anota lo que cambió en el juego, con tus palabras.",
                  unknowns: [],
                  constraints: [],
                  soonReplacedItemIds: [],
                  protectedResources: [],
                  recommendation,
                  profile: character.profile,
                  budget,
                  goal,
                }).then((next) => {
                  if (next) {
                    document
                      .getElementById("seccion-decision-adaptativa")
                      ?.scrollIntoView({ block: "start" });
                  }
                });
              }}
              startingSession={journal.saving}
            />

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
                void journal.createEntry({
                  ...journalEntryFromRecommendation(
                    recommendation,
                    character.profile,
                    budget,
                    goal,
                  ),
                  ...(characterJournal
                    ? {
                        journalRevision: buildRecommendationMemory(characterJournal)
                          .revision,
                      }
                    : {}),
                });
              }}
              onFocusItem={(itemId, trigger) => {
                dialogTriggerRef.current = trigger;
                setFocusedItemId(itemId);
              }}
            />
          </div>
        </div>

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
