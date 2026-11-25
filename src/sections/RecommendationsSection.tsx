import { useState } from "react";
import { ClipboardCheck, Download, Lightbulb, Loader2, PencilLine, Plus, Sparkles } from "lucide-react";
import { OPEN_REVIEW_EVENT } from "@/components/QuickReviewCard";
import type { ExportBuildResponse } from "@shared/api.js";
import { assessCharacterReadiness } from "@shared/characterReadiness.js";
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
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    title: "Próximas mejoras",
    generate: "Generar recomendaciones",
    activeStepTitle: "El mentor ya te ha dado un siguiente paso",
    activeStepBody: (title: string) =>
      `Termina «${title}» e informa del resultado antes de generar tareas nuevas. Así evitamos recomendaciones paralelas o crafts encadenados a ciegas.`,
    versionIssueTitle: "La build pertenece a otra versión",
    incompleteTitle: (count: number) =>
      count === 1 ? "Me falta 1 dato para recomendarte" : `Me faltan ${count} datos para recomendarte`,
    versionIssueBody:
      "No generaremos recomendaciones hasta que el árbol pasivo coincida con el parche del personaje.",
    incompleteBody: "Con lo que hay todavía no puedo comparar tu personaje sin inventarme datos. Completa esto:",
    gearOnlyBody:
      "Para recomendarte equipo necesito ver al menos una pieza tuya. Mientras tanto, la revisión rápida ya te dice qué te frena.",
    addGear: "Pegar una pieza",
    openReview: "Ir a la revisión rápida",
    completeProfile: "Completar personaje",
    needCharacterTitle: "Necesitas un personaje primero",
    needCharacterBody:
      "Carga el ejemplo o importa tu build en «Editar personaje» para poder generar recomendaciones.",
    loadDemo: "Cargar ejemplo",
    errorTitle: "Error al generar recomendaciones",
    emptyTitle: "Sin recomendaciones todavía",
    emptyBody:
      "Pulsa «Generar recomendaciones» para recibir hasta 3 mejoras ordenadas por impacto, coste y riesgo según tu presupuesto y objetivo.",
    generatedAt: (date: string) => `Generadas el ${date} · motor `,
    journalInfluenceTitle: "El diario influyó en esta decisión",
    journalInfluenceUsed: (count: number) => `Se usaron ${count} entrada(s) del historial. `,
    journalInfluenceRepeated:
      "El perfil todavía activa una mejora ya intentada; primero se pide reconciliar el resultado guardado con los datos actuales.",
    journalInfluenceBlocked: "La memoria activa impidió generar tareas paralelas.",
    noMoreOptions:
      "No hay más posibilidades: el motor solo devolvió la que ya estás viendo en el caso abierto.",
    appliedCount: (count: number) => `${count} mejora(s) marcada(s) como aplicada(s)`,
    appliedHint: "Marca las mejoras que ya aplicaste para incluirlas en el archivo",
    download: "Descargar .build",
  },
  {
    title: "Next upgrades",
    generate: "Get recommendations",
    activeStepTitle: "Your mentor already gave you a next step",
    activeStepBody: (title: string) =>
      `Finish "${title}" and report how it went before asking for new tasks. That way you don't get parallel recommendations or blind chains of crafts.`,
    versionIssueTitle: "This build is from a different game version",
    incompleteTitle: (count: number) =>
      count === 1 ? "I need 1 more detail to recommend anything" : `I need ${count} more details to recommend anything`,
    versionIssueBody:
      "We won't make recommendations until the passive tree matches your character's patch.",
    incompleteBody: "With what's here I can't compare your character yet without making things up. Fill this in:",
    gearOnlyBody:
      "To recommend gear I need to see at least one of your items. Meanwhile, the quick review already tells you what's holding you back.",
    addGear: "Paste an item",
    openReview: "Go to the quick review",
    completeProfile: "Complete character file",
    needCharacterTitle: "You need a character first",
    needCharacterBody:
      "Load the example or import your build in “Edit character” to get recommendations.",
    loadDemo: "Load example",
    errorTitle: "Couldn't get recommendations",
    emptyTitle: "No recommendations yet",
    emptyBody:
      "Press “Get recommendations” to receive up to 3 upgrades, sorted by impact, cost and risk for your budget and goal.",
    generatedAt: (date: string) => `Generated on ${date} · engine `,
    journalInfluenceTitle: "Your journal shaped this decision",
    journalInfluenceUsed: (count: number) =>
      `${count} past journal ${count === 1 ? "entry was" : "entries were"} used. `,
    journalInfluenceRepeated:
      "Your character still triggers an upgrade you already tried; first, match the saved result with your current data.",
    journalInfluenceBlocked: "Active memory stopped parallel tasks from being created.",
    noMoreOptions:
      "No other options: the engine only returned the one you're already seeing in the open case.",
    appliedCount: (count: number) => `${count} ${count === 1 ? "upgrade" : "upgrades"} marked as applied`,
    appliedHint: "Mark the upgrades you've already applied to include them in the file",
    download: "Download .build",
  },
);

const EXPORT_TEXT = texts(
  {
    buildName: "Nombre de la build",
    ascendancy: "Ascendencia",
    passives: (count: number) => `${count} pasiva(s)`,
    skills: (count: number) => `${count} habilidad(es)`,
    inventorySlots: (count: number) => `${count} hueco(s) de inventario`,
    summary: "Ver informe de exportación de ",
    validSchema: "Archivo válido contra el esquema GGG Build Planner v1.",
    contains: "Qué contiene el archivo",
    emptyFile: "El archivo se generó vacío de contenido exportable.",
    plannedIncluded: (count: number) => `Mejoras planificadas incluidas en el archivo: ${count}`,
    notExportable: "Lo que el formato oficial NO puede guardar",
    skipped: "Omitido por falta de id oficial",
  },
  {
    buildName: "Build name",
    ascendancy: "Ascendancy",
    passives: (count: number) => `${count} ${count === 1 ? "passive" : "passives"}`,
    skills: (count: number) => `${count} ${count === 1 ? "skill" : "skills"}`,
    inventorySlots: (count: number) => `${count} inventory ${count === 1 ? "slot" : "slots"}`,
    summary: "See export report for ",
    validSchema: "File is valid against the GGG Build Planner v1 schema.",
    contains: "What the file contains",
    emptyFile: "The file was created with no exportable content.",
    plannedIncluded: (count: number) => `Planned upgrades included in the file: ${count}`,
    notExportable: "What the official format CAN'T save",
    skipped: "Skipped: no official id",
  },
);

interface RecommendationsSectionProps {
  /** Identificador único del bloque; permite convivir a las vistas generar y otras. */
  sectionId?: string;
  profile: CharacterProfile | null;
  targetDraft: TargetDraft;
  budget: Budget | null;
  goal: GoalKind;
  league: string;
  patch: string;
  journal: CharacterJournal | null;
  journalLoading: boolean;
  onJournalStale: () => Promise<void>;
  recommendations: RecommendationsState;
  onLoadDemo: () => Promise<void>;
  /** Abre el editor completo cuando el perfil todavía es solo un borrador. */
  onEditProfile: () => void;
  /** Abre «Añadir equipo». Con esto, si solo falta el equipo, es el botón principal. */
  onAddGear?: () => void;
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
  sectionId = "seccion-recomendaciones",
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
  onEditProfile,
  onAddGear,
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
  const t = useText(TEXT);
  const { lang } = useLang();
  const { result, exportResult, loading, exporting, error } = recommendations;

  const activeJournalEntry = journal?.primaryEntry ?? null;
  const readiness = assessCharacterReadiness(profile);
  const versionIssue = readiness.issues.find((issue) => issue.id === "version") ?? null;
  const gearOnly = readiness.issues.length === 1 && readiness.issues[0]?.id === "equipment";
  const canGenerate =
    !!profile &&
    readiness.ready &&
    !!league &&
    !!patch &&
    !loading &&
    !journalLoading &&
    activeJournalEntry === null;
  const selectedCount = Object.values(appliedIds).filter(Boolean).length;

  const showGenerate = showGenerateProp ?? view !== "otras";
  const showList = view !== "generar";
  const compactGenerate = view === "generar";
  const listed = (result?.recommendations ?? []).filter(
    (rec) => rec.id !== excludeRecommendationId,
  );
  const [expandedAlternativeId, setExpandedAlternativeId] = useState<string | null>(
    null,
  );

  return (
    // tabIndex={-1}: destino programático de la navegación objeto →
    // recomendaciones (patrón «skip link»); no entra en el orden de tabulación.
    <Card
      id={sectionId}
      tabIndex={-1}
      className={`scroll-mt-16 outline-none ${
        compactGenerate ? "gap-0 border-0 bg-transparent py-0 shadow-none" : ""
      }`}
    >
      <CardHeader className={compactGenerate ? "px-0 pb-3 pt-0" : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!compactGenerate && <CardTitle className="text-xl">{t.title}</CardTitle>}
          {/* Mientras falten datos no se enseña un botón apagado: abajo se dice
              qué falta y cómo darlo. */}
          {showGenerate && !(profile && !readiness.ready) && (
          <Button
            type="button"
            className={compactGenerate ? "min-h-12 px-5 text-base shadow-[0_0_28px_hsl(var(--primary)/0.12)]" : undefined}
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
            {t.generate}
          </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={`flex flex-col gap-4 ${compactGenerate ? "px-0 pb-0" : ""}`}>
        {showGenerate && activeJournalEntry && (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertTitle>{t.activeStepTitle}</AlertTitle>
            <AlertDescription>{t.activeStepBody(activeJournalEntry.title)}</AlertDescription>
          </Alert>
        )}
        {showGenerate && profile && !readiness.ready && (
          <Alert
            // Dentro de «tu siguiente paso» ya hay una tarjeta: sin caja propia.
            className={compactGenerate ? "border-0 bg-transparent p-0" : "border-amber-500/45 bg-amber-500/8"}
            data-testid="recommendations-readiness"
          >
            {/* Solo falta el equipo y la tarjeta de arriba ya lo explica: aquí, solo los botones. */}
            {!(gearOnly && compactGenerate) && (
              <AlertTitle>
                {versionIssue
                  ? t.versionIssueTitle
                  : t.incompleteTitle(readiness.issues.length)}
              </AlertTitle>
            )}
            <AlertDescription className="space-y-3">
              {!(gearOnly && compactGenerate) && (
                <p>
                  {versionIssue ? t.versionIssueBody : gearOnly ? t.gearOnlyBody : t.incompleteBody}
                </p>
              )}
              {/* Si solo falta el equipo, el párrafo de arriba ya lo dice todo. */}
              <ul className={gearOnly && onAddGear ? "hidden" : "space-y-1 text-sm"}>
                {readiness.issues.map((issue) => (
                  <li key={issue.id}>
                    <span className="font-medium text-foreground">{lang === "en" ? issue.labelEn : issue.label}:</span>{" "}
                    {lang === "en" ? issue.detailEn : issue.detail}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {/* La revisión rápida va primero: es lo que contesta sin pegar nada. */}
                {gearOnly && (
                  <Button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new Event(OPEN_REVIEW_EVENT));
                      document.getElementById("revision-rapida")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    data-testid="recommendations-open-review"
                  >
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    {t.openReview}
                  </Button>
                )}
                {gearOnly && onAddGear && (
                  <Button type="button" variant="secondary" onClick={onAddGear} data-testid="recommendations-add-gear">
                    <Plus className="size-4" aria-hidden="true" />
                    {t.addGear}
                  </Button>
                )}
                {!(gearOnly && onAddGear) && (
                  <Button type="button" variant="secondary" onClick={onEditProfile}>
                    <PencilLine className="size-4" aria-hidden="true" />
                    {t.completeProfile}
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        {!profile ? (
          showGenerate ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyTitle>{t.needCharacterTitle}</EmptyTitle>
                <EmptyDescription>{t.needCharacterBody}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void onLoadDemo()}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {t.loadDemo}
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
            <AlertTitle>{t.errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !result ? (
          showGenerate ? (
            compactGenerate ? null : (
              <Empty className="border border-dashed border-border">
                <EmptyHeader>
                  <EmptyTitle>{t.emptyTitle}</EmptyTitle>
                  <EmptyDescription>{t.emptyBody}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          ) : null
        ) : !showList ? null : (
          <>
            <p className="text-sm text-muted-foreground">
              {t.generatedAt(formatDateTime(result.generatedAt))}
              {result.engineVersion}
            </p>
            {result.memoryImpact.usedEntryIds.length > 0 && (
              <Alert className="border-primary/40 bg-primary/5">
                <AlertTitle>{t.journalInfluenceTitle}</AlertTitle>
                <AlertDescription>
                  {t.journalInfluenceUsed(result.memoryImpact.usedEntryIds.length)}
                  {result.memoryImpact.repeatedRecommendationIds.length > 0
                    ? t.journalInfluenceRepeated
                    : t.journalInfluenceBlocked}
                </AlertDescription>
              </Alert>
            )}
            {listed.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noMoreOptions}</p>
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
                  presentation="alternative"
                  expanded={expandedAlternativeId === rec.id}
                  onExpandedChange={(expanded) =>
                    setExpandedAlternativeId(expanded ? rec.id : null)
                  }
                />
              ))
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {selectedCount > 0 ? t.appliedCount(selectedCount) : t.appliedHint}
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
                {t.download}
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
  const t = useText(EXPORT_TEXT);
  const { report, fileName } = exportResult;
  const exportedItems: string[] = [
    report.exported.name ? t.buildName : "",
    report.exported.ascendancy ? t.ascendancy : "",
    report.exported.passives > 0 ? t.passives(report.exported.passives) : "",
    report.exported.skills > 0 ? t.skills(report.exported.skills) : "",
    report.exported.inventorySlots > 0
      ? t.inventorySlots(report.exported.inventorySlots)
      : "",
  ].filter((item) => item.length > 0);

  return (
    <details
      className="rounded-md border border-primary/40 bg-primary/5"
      data-testid="informe-exportacion"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        {t.summary}<span className="font-mono">{fileName}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-primary/30 p-4">
        <p className="text-xs text-muted-foreground">
          {t.validSchema}
        </p>

      <div>
        <p className="text-sm font-medium text-foreground">{t.contains}</p>
        {exportedItems.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {exportedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t.emptyFile}
          </p>
        )}
        {appliedCount > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t.plannedIncluded(appliedCount)}
          </p>
        )}
      </div>

      {report.notExportable.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300">
          <AlertTitle>{t.notExportable}</AlertTitle>
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
          <AlertTitle>{t.skipped}</AlertTitle>
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
