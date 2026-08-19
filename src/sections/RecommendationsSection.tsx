import { useState } from "react";
import { Download, Lightbulb, Loader2, Sparkles } from "lucide-react";
import type {
  BuildTarget,
  Budget,
  CharacterProfile,
  GoalKind,
} from "@shared/domain.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendationCard } from "@/components/RecommendationCard";
import type { RecommendationsState } from "@/hooks/useRecommendations";
import type { TargetDraft } from "@/sections/TargetSection";
import { formatDateTime } from "@/lib/format";

interface RecommendationsSectionProps {
  profile: CharacterProfile | null;
  targetDraft: TargetDraft;
  budget: Budget;
  goal: GoalKind;
  league: string;
  patch: string;
  recommendations: RecommendationsState;
  onLoadDemo: () => Promise<void>;
}

function buildTarget(draft: TargetDraft): BuildTarget | undefined {
  if (!draft.name.trim()) return undefined;
  return {
    name: draft.name.trim(),
    sourceUrl: draft.sourceUrl.trim() || undefined,
    summary: draft.summary.trim() || undefined,
    desiredMods: draft.desiredModsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
    referenceOnly: true,
  };
}

export function RecommendationsSection({
  profile,
  targetDraft,
  budget,
  goal,
  league,
  patch,
  recommendations,
  onLoadDemo,
}: RecommendationsSectionProps) {
  const { result, loading, exporting, error } = recommendations;
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});

  const canGenerate = !!profile && !!league && !!patch && !loading;
  const selectedCount = Object.values(appliedIds).filter(Boolean).length;

  const toggleApplied = (id: string, applied: boolean) =>
    setAppliedIds((prev) => ({ ...prev, [id]: applied }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl">4. Próximas mejoras</CardTitle>
          <Button
            type="button"
            onClick={() => {
              if (!profile) return;
              void recommendations.generate({
                profile,
                target: buildTarget(targetDraft),
                budget,
                goal: { kind: goal },
                league,
                patch,
              });
            }}
            disabled={!canGenerate}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Lightbulb className="size-4" aria-hidden="true" />
            )}
            Generar recomendaciones
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!profile ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyTitle>Necesitas un personaje primero</EmptyTitle>
              <EmptyDescription>
                Carga el ejemplo o importa tu build en la sección «Mi personaje» para
                poder generar recomendaciones.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void onLoadDemo()}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Cargar ejemplo
              </Button>
            </EmptyContent>
          </Empty>
        ) : loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error al generar recomendaciones</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !result ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyTitle>Sin recomendaciones todavía</EmptyTitle>
              <EmptyDescription>
                Pulsa «Generar recomendaciones» para recibir hasta 3 mejoras ordenadas
                por impacto, coste y riesgo según tu presupuesto y objetivo.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Generadas el {formatDateTime(result.generatedAt)} · motor{" "}
              {result.engineVersion}
            </p>
            {result.recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                applied={appliedIds[rec.id] ?? false}
                onAppliedChange={(applied) => toggleApplied(rec.id, applied)}
                budget={budget}
              />
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {selectedCount > 0
                  ? `${selectedCount} mejora(s) marcada(s) como aplicada(s)`
                  : "Marca las mejoras que ya aplicaste para incluirlas en el archivo"}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={exporting || !profile}
                onClick={() => {
                  if (!profile) return;
                  void recommendations.exportBuild(
                    profile,
                    Object.entries(appliedIds)
                      .filter(([, applied]) => applied)
                      .map(([id]) => id),
                  );
                }}
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Descargar .build
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
