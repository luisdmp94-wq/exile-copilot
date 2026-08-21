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
  /**
   * Marcas «ya la apliqué». Viven en `App` porque la recomendación dominante se
   * pinta en el Caso Abierto y el resto aquí: si el estado se quedara dentro de
   * esta sección, la principal no podría marcarse para la exportación.
   */
  appliedIds: Record<string, boolean>;
  onAppliedChange: (recommendationId: string, applied: boolean) => void;
  /**
   * Recomendación que ya domina el Caso Abierto: se excluye de la lista para no
   * duplicar la acción principal (§11.5).
   */
  excludeRecommendationId?: string | null;
  /**
   * Presentación:
   * - `generar`: solo la cabecera con «Generar recomendaciones» y los estados
   *   previos al resultado. Es el contenido dominante del Caso Abierto cuando
   *   no hay sesión, ni acción activa, ni recomendaciones.
   * - `otras`: solo la lista (sin la dominante) y la exportación. Vive plegada
   *   en «Otras posibilidades».
   * - `completo`: ambas cosas, como antes de la Fase Visual 1.
   */
  view?: "generar" | "otras" | "completo";
  /**
   * Si se ofrece «Generar recomendaciones» (con su aviso de acción activa).
   * Por defecto va con la vista, pero el Caso Abierto necesita decidirlo: el
   * control debe existir UNA sola vez, ya sea como contenido dominante o dentro
   * de «Otras posibilidades», nunca en los dos sitios a la vez.
   */
  showGenerate?: boolean;
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
  appliedIds,
  onAppliedChange,
  excludeRecommendationId = null,
  view = "completo",
  showGenerate: showGenerateProp,
}: RecommendationsSectionProps) {
  const { result, exportResult, loading, exporting, error } = recommendations;

  const activeJournalEntry = journal?.primaryEntry ?? null;
  const canGenerate =
    !!profile &&
    !!league &&
    !!patch &&
    !loading &&
    !journalLoading &&
    activeJournalEntry === null;
  const selectedCount = Object.values(appliedIds).filter(Boolean).length;

  const showGenerate = showGenerateProp ?? view !== "otras";
  const showList = view !== "generar";
  const listed = (result?.recommendations ?? []).filter(
    (rec) => rec.id !== excludeRecommendationId,
  );

  return (
    // tabIndex={-1}: destino programático de la navegación objeto →
    // recomendaciones (patrón «skip link»); no entra en el orden de tabulación.
    <Card id="seccion-recomendaciones" tabIndex={-1} className="scroll-mt-16 outline-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl">Próximas mejoras</CardTitle>
          {showGenerate && (
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
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showGenerate && activeJournalEntry && (
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
          showGenerate ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyTitle>Necesitas un personaje primero</EmptyTitle>
                <EmptyDescription>
                  Carga el ejemplo o importa tu build en «Editar expediente» para poder
                  generar recomendaciones.
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
          ) : null
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
          showGenerate ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyTitle>Sin recomendaciones todavía</EmptyTitle>
                <EmptyDescription>
                  Pulsa «Generar recomendaciones» para recibir hasta 3 mejoras ordenadas
                  por impacto, coste y riesgo según tu presupuesto y objetivo.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null
        ) : !showList ? null : (
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
            {listed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay más posibilidades: el motor solo devolvió la que ya estás viendo
                en el caso abierto.
              </p>
            ) : (
              listed.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  applied={appliedIds[rec.id] ?? false}
                  onAppliedChange={(applied) => onAppliedChange(rec.id, applied)}
                  budget={budget}
                  onFocusItem={onFocusItem}
                  onTrack={onTrackRecommendation}
                  tracking={trackingRecommendation}
                  onStartSession={onStartSession}
                  startingSession={startingSession}
                />
              ))
            )}
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

        {showList && exportResult && (
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
    <details
      className="rounded-md border border-primary/40 bg-primary/5"
      data-testid="informe-exportacion"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        Ver informe de exportación de <span className="font-mono">{fileName}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-primary/30 p-4">
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
    </details>
  );
}
