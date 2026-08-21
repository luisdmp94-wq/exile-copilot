import { useState } from "react";
import { Download, Lightbulb, Loader2, Sparkles } from "lucide-react";
import type { ExportBuildResponse } from "@shared/api.js";
import type {
  Budget,
  CharacterJournal,
  CharacterProfile,
  GoalKind,
  Recommendation,
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
import { buildTargetFromDraft } from "@/lib/buildTarget";
import { buildRecommendationsRequest } from "@/lib/recommendationsRequest";
import { selectAppliedRecommendationIds } from "@/lib/appliedRecommendations";
import { formatDateTime } from "@/lib/format";

interface RecommendationsSectionProps {
  profile: CharacterProfile | null;
  targetDraft: TargetDraft;
  budget: Budget;
  goal: GoalKind;
  league: string;
  patch: string;
  journal: CharacterJournal | null;
  journalLoading: boolean;
  onJournalStale: () => Promise<void>;
  recommendations: RecommendationsState;
  onLoadDemo: () => Promise<void>;
  /** Navegación recomendación → objeto; solo se usa con vínculo estructurado. */
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
  onTrackRecommendation: (recommendation: Recommendation) => void;
  trackingRecommendation: boolean;
  onStartSession?: (recommendation: Recommendation) => void;
  startingSession?: boolean;
}

export function RecommendationsSection({
  profile,
  targetDraft,
  budget,
  goal,
  league,
  patch,
  journal,
  journalLoading,
  onJournalStale,
  recommendations,
  onLoadDemo,
  onFocusItem,
  onTrackRecommendation,
  trackingRecommendation,
  onStartSession,
  startingSession = false,
}: RecommendationsSectionProps) {
  const { result, exportResult, loading, exporting, error } = recommendations;
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});

  // Cada generación (o invalidación) parte de cero: una marca de una
  // generación anterior nunca sobrevive como "mejora aplicada".
  // (Ajuste de estado durante el render, patrón recomendado por React.)
  const [lastResult, setLastResult] = useState(result);
  if (result !== lastResult) {
    setLastResult(result);
    setAppliedIds({});
  }

  const activeJournalEntry = journal?.primaryEntry ?? null;
  const canGenerate =
    !!profile &&
    !!league &&
    !!patch &&
    !loading &&
    !journalLoading &&
    activeJournalEntry === null;
  const selectedCount = Object.values(appliedIds).filter(Boolean).length;

  const toggleApplied = (id: string, applied: boolean) =>
    setAppliedIds((prev) => ({ ...prev, [id]: applied }));

  return (
    <Card id="seccion-recomendaciones">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl">4. Próximas mejoras</CardTitle>
          <Button
            type="button"
            onClick={() => {
              if (!profile) return;
              void (async () => {
                const outcome = await recommendations.generate(
                  buildRecommendationsRequest(
                    profile,
                    targetDraft,
                    budget,
                    goal,
                    league,
                    patch,
                    journal,
                  ),
                );
                if (outcome === "journal-stale") await onJournalStale();
              })();
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
        {activeJournalEntry && (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertTitle>El mentor ya te ha dado un siguiente paso</AlertTitle>
            <AlertDescription>
              Termina «{activeJournalEntry.title}» e informa del resultado antes de
              generar tareas nuevas. Así evitamos recomendaciones paralelas o crafts
              encadenados a ciegas.
            </AlertDescription>
          </Alert>
        )}
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
            {result.memoryImpact.usedEntryIds.length > 0 && (
              <Alert className="border-sky-500/40 bg-sky-500/5 text-sky-100">
                <AlertTitle>El diario influyó en esta decisión</AlertTitle>
                <AlertDescription>
                  Se usaron {result.memoryImpact.usedEntryIds.length} entrada(s) del
                  historial. {result.memoryImpact.repeatedRecommendationIds.length > 0
                    ? "El perfil todavía activa una mejora ya intentada; primero se pide reconciliar el resultado guardado con los datos actuales."
                    : "La memoria activa impidió generar tareas paralelas."}
                </AlertDescription>
              </Alert>
            )}
            {result.recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                applied={appliedIds[rec.id] ?? false}
                onAppliedChange={(applied) => toggleApplied(rec.id, applied)}
                budget={budget}
                onFocusItem={onFocusItem}
                onTrack={onTrackRecommendation}
                tracking={trackingRecommendation}
                onStartSession={onStartSession}
                startingSession={startingSession}
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
                  void recommendations.exportBuild({
                    profile,
                    target: buildTargetFromDraft(targetDraft),
                    // Solo ids marcados que existen en el resultado VIGENTE.
                    appliedRecommendations: selectAppliedRecommendationIds(
                      appliedIds,
                      result.recommendations,
                    ),
                  });
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

        {exportResult && (
          <ExportReportView
            exportResult={exportResult}
            appliedCount={recommendations.exportAppliedCount}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Informe honesto de exportación: qué contiene el archivo y qué se perdió. */
function ExportReportView({
  exportResult,
  appliedCount,
}: {
  exportResult: ExportBuildResponse;
  appliedCount: number;
}) {
  const { report, fileName } = exportResult;
  const exportedItems: string[] = [
    report.exported.name ? "Nombre de la build" : "",
    report.exported.ascendancy ? "Ascendencia" : "",
    report.exported.passives > 0 ? `${report.exported.passives} pasiva(s)` : "",
    report.exported.skills > 0 ? `${report.exported.skills} habilidad(es)` : "",
    report.exported.inventorySlots > 0
      ? `${report.exported.inventorySlots} hueco(s) de inventario`
      : "",
  ].filter((item) => item.length > 0);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/5 p-4">
      <p className="text-sm font-medium text-foreground">
        Informe de exportación de <span className="font-mono">{fileName}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Archivo válido contra el esquema GGG Build Planner v1.
      </p>

      <div>
        <p className="text-sm font-medium text-foreground">Qué contiene el archivo</p>
        {exportedItems.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {exportedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            El archivo se generó vacío de contenido exportable.
          </p>
        )}
        {appliedCount > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Mejoras planificadas incluidas en el archivo: {appliedCount}
          </p>
        )}
      </div>

      {report.notExportable.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300">
          <AlertTitle>Lo que el formato oficial NO puede guardar</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {report.notExportable.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {report.skippedUnverified.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300">
          <AlertTitle>Omitido por falta de id oficial</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {report.skippedUnverified.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
