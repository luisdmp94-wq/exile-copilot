import { useEffect, useState } from "react";
import type { Budget, GoalKind } from "@shared/domain.js";
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

const EMPTY_TARGET: TargetDraft = {
  name: "",
  sourceUrl: "",
  summary: "",
  desiredModsText: "",
};

export default function App() {
  const { health, meta, loading: metaLoading, error: metaError } = useMeta();
  const character = useCharacter();
  const market = useMarket();
  const recommendations = useRecommendations();

  const [league, setLeague] = useState("");
  const [patch, setPatch] = useState("");
  const [budget, setBudget] = useState<Budget>({ amount: 50, currency: "exalted" });
  const [goal, setGoal] = useState<GoalKind>("balanced");
  const [targetDraft, setTargetDraft] = useState<TargetDraft>(EMPTY_TARGET);

  // Valores por defecto en cuanto llegan /api/meta y /api/health.
  useEffect(() => {
    if (meta && !league && meta.leagues.length > 0) {
      setLeague(meta.leagues[0]);
    }
    if (health && !patch) {
      setPatch(health.patch);
    } else if (meta && !patch && meta.patches.length > 0) {
      setPatch(meta.patches[0].id);
    }
  }, [meta, health, league, patch]);

  // Si el perfil importado trae liga/parche propios, respetarlos.
  useEffect(() => {
    const profile = character.profile;
    if (profile) {
      setLeague(profile.league || league);
      setPatch(profile.patch || patch);
    }
    // Solo reacciona al cambio de perfil importado, no a cada edición de campos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.profile?.id]);

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
            <CharacterSection character={character} meta={meta} />
            <TargetSection draft={targetDraft} onChange={setTargetDraft} />
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
            />
          </div>
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Exile Copilot no está afiliado a Grinding Gear Games. Los precios proceden de
          poe.ninja y las referencias de builds de la comunidad no están verificadas.
        </footer>
      </main>

      <Toaster theme="dark" richColors closeButton position="bottom-right" />
    </div>
  );
}
