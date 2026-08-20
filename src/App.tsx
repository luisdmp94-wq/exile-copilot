import { useEffect, useMemo, useState } from "react";
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
  const market = useMarket();
  const recommendations = useRecommendations();
  const { resultInputsKey, clear } = recommendations;

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
        ),
      )
    : null;
  useEffect(() => {
    if (resultInputsKey && resultInputsKey !== currentInputsKey) {
      clear();
      toast.info("Los datos han cambiado — vuelve a generar las recomendaciones");
    }
  }, [currentInputsKey, resultInputsKey, clear]);

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

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <div className="flex flex-col gap-6">
            <CharacterSection
              character={character}
              meta={meta}
              recommendations={recommendations.result?.recommendations ?? []}
              focusedItemId={focusedItemId}
              onFocusHandled={() => setFocusedItemId(null)}
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
              recommendations={recommendations}
              onLoadDemo={character.loadDemo}
              onFocusItem={setFocusedItemId}
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
