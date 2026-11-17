import {
  AlertTriangle,
  BookMarked,
  ChevronDown,
  ExternalLink,
  FileWarning,
  OctagonAlert,
  PackageSearch,
  Undo2,
} from "lucide-react";
import { useId } from "react";
import type { Budget, Recommendation } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CONFIDENCE_BADGE_CLASSES,
  formatCost,
  formatDateTime,
  RISK_BADGE_CLASSES,
} from "@/lib/format";
import { useFormatLabels } from "@/lib/formatLabels";
import { compactRecommendationReason } from "@/lib/journal";
import { cn } from "@/lib/utils";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    priority: (priority: number) => `Prioridad ${priority}`,
    risk: (risk: string) => `Riesgo ${risk}`,
    confidence: (confidence: string) => `Confianza ${confidence}`,
    patch: (patch: string) => `Parche ${patch}`,
    hasIrreversible: "Incluye una acción irreversible",
    mayAffectMods: "Puede afectar modificadores valiosos",
    overBudgetShort: "Supera el presupuesto indicado",
    hideDetails: "Ocultar detalles",
    showDetails: "Ver detalles",
    action: "Acción",
    reason: "Motivo",
    cost: "Coste",
    expectedImpact: "Impacto esperado",
    partialMetric: "Métrica parcial: no es una estimación de DPS completa.",
    riskTitle: "Riesgo",
    overBudget: "Esta mejora supera tu presupuesto. Ahorra más moneda o considera una alternativa.",
    loseMods: "Puede perder mods valiosos del objeto actual.",
    irreversible: "Acción irreversible: no podrás deshacerla. Asegúrate antes de continuar.",
    sources: "Fuentes",
    newTab: "(se abre en una pestaña nueva)",
    toVerify: "Falta por verificar",
    dataUpdated: (date: string) => `Datos actualizados: ${date}`,
    saveNextStep: "Guardar como próximo paso",
    tryAndReturn: "Probar y volver",
    seeItem: "Ver el objeto evaluado",
    gateNote: "El mentor frena este paso hasta resolver el conflicto o la evidencia.",
    dataActionNote: "Acción de datos: no modifica el juego ni se incluye en el archivo .build.",
    appliedLabel: "Ya la apliqué — incluir al exportar el .build",
  },
  {
    priority: (priority: number) => `Priority ${priority}`,
    risk: (risk: string) => `Risk ${risk}`,
    confidence: (confidence: string) => `Confidence ${confidence}`,
    patch: (patch: string) => `Patch ${patch}`,
    hasIrreversible: "Includes an action that can't be undone",
    mayAffectMods: "May affect valuable modifiers",
    overBudgetShort: "Over the budget you set",
    hideDetails: "Hide details",
    showDetails: "See details",
    action: "Action",
    reason: "Reason",
    cost: "Cost",
    expectedImpact: "Expected impact",
    partialMetric: "Partial metric: not a full DPS estimate.",
    riskTitle: "Risk",
    overBudget: "This upgrade costs more than your budget. Save up more currency or look at another option.",
    loseMods: "You may lose valuable mods from your current item.",
    irreversible: "This action can't be undone. Make sure before you go ahead.",
    sources: "Sources",
    newTab: "(opens in a new tab)",
    toVerify: "Still to verify",
    dataUpdated: (date: string) => `Data updated: ${date}`,
    saveNextStep: "Save as next step",
    tryAndReturn: "Try it and come back",
    seeItem: "See the item checked",
    gateNote: "The mentor holds this step until the conflict or the evidence is sorted out.",
    dataActionNote: "Data action: it doesn't change the game and isn't included in the .build file.",
    appliedLabel: "I've done it — include it when exporting the .build",
  },
);

interface RecommendationCardProps {
  recommendation: Recommendation;
  applied: boolean;
  onAppliedChange: (applied: boolean) => void;
  budget: Budget | null;
  /**
   * Abre el objeto que la regla evaluó. Solo se ofrece cuando el motor declara
   * `relatedItemIds`: sin vínculo estructurado no se muestra el botón ni se
   * deduce el hueco a partir del texto de la recomendación.
   */
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
  /** Guarda la decisión y la convierte en la única próxima acción del mentor. */
  onTrack: (recommendation: Recommendation) => void;
  tracking: boolean;
  onStartSession?: (recommendation: Recommendation) => void;
  startingSession?: boolean;
  /**
   * La recomendación principal se explica completa. Las alternativas empiezan
   * como una comparación breve y solo enseñan el expediente técnico cuando el
   * jugador lo pide.
   */
  presentation?: "full" | "alternative";
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

const PRIORITY_CLASSES: Record<number, string> = {
  1: "border-primary/60 bg-primary/15 text-primary",
  2: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  3: "border-border bg-muted text-muted-foreground",
};

export function RecommendationCard({
  recommendation: rec,
  applied,
  onAppliedChange,
  budget,
  onFocusItem,
  onTrack,
  tracking,
  onStartSession,
  startingSession = false,
  presentation = "full",
  expanded = false,
  onExpandedChange,
}: RecommendationCardProps) {
  const t = useText(TEXT);
  const labels = useFormatLabels();
  const detailsId = useId();
  const isAlternative = presentation === "alternative";
  const overBudget =
    budget !== null &&
    rec.cost.currency === budget.currency &&
    ((rec.cost.min !== null && rec.cost.min > budget.amount) ||
      (rec.cost.max !== null && rec.cost.max > budget.amount));

  return (
    <Card
      className={cn(
        "gap-3",
        overBudget && "border-amber-500/50",
        isAlternative && "gap-0 py-0",
      )}
      data-testid={isAlternative ? `alternativa-${rec.id}` : undefined}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={PRIORITY_CLASSES[rec.priority] ?? PRIORITY_CLASSES[3]}
          >
            {t.priority(rec.priority)}
          </Badge>
          <Badge
            variant="outline"
            className={RISK_BADGE_CLASSES[rec.risk.level]}
            title={rec.risk.description}
          >
            {t.risk(labels.risk[rec.risk.level])}
          </Badge>
          <Badge
            variant="outline"
            className={CONFIDENCE_BADGE_CLASSES[rec.confidence]}
          >
            {t.confidence(labels.confidence[rec.confidence])}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {t.patch(rec.patch)}
          </Badge>
        </div>
        <CardTitle className="text-lg">{rec.title}</CardTitle>
        {isAlternative && (
          <>
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {rec.action}
            </p>
            {(overBudget || rec.mayLoseValuableMods || rec.irreversible) && (
              <p className="flex items-center gap-2 text-xs font-medium text-amber-300">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                {rec.irreversible
                  ? t.hasIrreversible
                  : rec.mayLoseValuableMods
                    ? t.mayAffectMods
                    : t.overBudgetShort}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit px-0 text-primary hover:bg-transparent hover:text-primary/80"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => onExpandedChange?.(!expanded)}
            >
              {expanded ? t.hideDetails : t.showDetails}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  expanded && "rotate-180",
                )}
                aria-hidden="true"
              />
            </Button>
          </>
        )}
      </CardHeader>
      {(!isAlternative || expanded) && (
      <CardContent
        id={isAlternative ? detailsId : undefined}
        className={cn(
          "flex flex-col gap-3 text-sm",
          isAlternative && "border-t border-border/70 pt-4",
        )}
      >
        <div>
          <p className="font-medium text-foreground">{t.action}</p>
          <p className="text-muted-foreground">{rec.action}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">{t.reason}</p>
          <p className="text-muted-foreground">
            {compactRecommendationReason(rec.reason)}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">{t.cost}</p>
            <p
              className={cn(
                "text-muted-foreground",
                overBudget && "font-semibold text-amber-300",
              )}
            >
              {formatCost(rec.cost.min, rec.cost.max, rec.cost.currency, rec.cost.known)}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t.expectedImpact}</p>
            <p className="text-muted-foreground">
              {rec.impact.description} ({rec.impact.metric}:{" "}
              {labels.magnitude[rec.impact.magnitude]})
            </p>
            {rec.impact.isPartialMetric && (
              <p className="text-xs italic text-muted-foreground/80">
                {t.partialMetric}
              </p>
            )}
          </div>
        </div>
        <div>
          <p className="font-medium text-foreground">{t.riskTitle}</p>
          <p className="text-muted-foreground">{rec.risk.description}</p>
        </div>

        {(rec.mayLoseValuableMods || rec.irreversible || overBudget) && (
          <div className="flex flex-col gap-2">
            {overBudget && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5 text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t.overBudget}</span>
              </div>
            )}
            {rec.mayLoseValuableMods && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5 text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t.loseMods}</span>
              </div>
            )}
            {rec.irreversible && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-2.5 text-red-200"
              >
                <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t.irreversible}</span>
              </div>
            )}
          </div>
        )}

        {rec.sources.length > 0 && (
          <div>
            <p className="font-medium text-foreground">{t.sources}</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {rec.sources.map((source, i) => (
                <li key={`${source.label}-${i}`}>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                    >
                      {source.label}
                      <ExternalLink className="size-3" aria-hidden="true" />
                      <span className="sr-only">{t.newTab}</span>
                    </a>
                  ) : (
                    source.label
                  )}{" "}
                  <span className="text-xs">({labels.sourceKind[source.kind]})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rec.unverified.length > 0 && (
          <div>
            <p className="font-medium text-foreground">{t.toVerify}</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {rec.unverified.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground/80">
          {t.dataUpdated(formatDateTime(rec.dataUpdatedAt))}
        </p>

        {/* Solo con vínculo estructurado del motor (relatedItemIds). Sin él no
            se ofrece navegación ni se adivina el hueco por el texto. */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onTrack(rec)}
            disabled={tracking || rec.actionKind === "session_gate"}
          >
            <BookMarked className="size-3.5" aria-hidden="true" />
            {t.saveNextStep}
          </Button>
          {onStartSession && rec.actionKind !== "session_gate" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onStartSession(rec)}
              disabled={startingSession}
            >
              {t.tryAndReturn}
            </Button>
          )}
          {rec.relatedItemIds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={`ver-objeto-${rec.id}`}
              onClick={(event) => {
                const first = rec.relatedItemIds[0];
                if (first !== undefined) onFocusItem(first, event.currentTarget);
              }}
            >
              <PackageSearch className="size-3.5" aria-hidden="true" />
              {t.seeItem}
              {rec.relatedItemIds.length > 1 && ` (${rec.relatedItemIds.length})`}
            </Button>
          )}
        </div>

        {rec.actionKind === "session_gate" ? (
          <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
            <FileWarning className="size-4 text-sky-300" aria-hidden="true" />
            {t.gateNote}
          </div>
        ) : rec.actionKind === "profile_sync" ? (
          <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
            <FileWarning className="size-4 text-sky-300" aria-hidden="true" />
            {t.dataActionNote}
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Checkbox
              id={`applied-${rec.id}`}
              checked={applied}
              onCheckedChange={(checked) => onAppliedChange(checked === true)}
            />
            <Label
              htmlFor={`applied-${rec.id}`}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-normal"
            >
              <Undo2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {t.appliedLabel}
            </Label>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}
