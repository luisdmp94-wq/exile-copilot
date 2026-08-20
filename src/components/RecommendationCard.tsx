import {
  AlertTriangle,
  BookMarked,
  ExternalLink,
  FileWarning,
  OctagonAlert,
  PackageSearch,
  Undo2,
} from "lucide-react";
import type { Budget, Recommendation } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CONFIDENCE_LABELS,
  formatCost,
  formatDateTime,
  LEVEL_BADGE_CLASSES,
  MAGNITUDE_LABELS,
  RISK_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface RecommendationCardProps {
  recommendation: Recommendation;
  applied: boolean;
  onAppliedChange: (applied: boolean) => void;
  budget: Budget;
  /**
   * Abre el objeto que la regla evaluó. Solo se ofrece cuando el motor declara
   * `relatedItemIds`: sin vínculo estructurado no se muestra el botón ni se
   * deduce el hueco a partir del texto de la recomendación.
   */
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
  /** Guarda la decisión y la convierte en la única próxima acción del mentor. */
  onTrack: (recommendation: Recommendation) => void;
  tracking: boolean;
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
}: RecommendationCardProps) {
  const overBudget =
    rec.cost.currency === budget.currency &&
    ((rec.cost.min !== null && rec.cost.min > budget.amount) ||
      (rec.cost.max !== null && rec.cost.max > budget.amount));

  return (
    <Card className={cn("gap-3", overBudget && "border-amber-500/50")}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={PRIORITY_CLASSES[rec.priority] ?? PRIORITY_CLASSES[3]}
          >
            Prioridad {rec.priority}
          </Badge>
          <Badge
            variant="outline"
            className={LEVEL_BADGE_CLASSES[rec.risk.level]}
            title={rec.risk.description}
          >
            Riesgo {RISK_LABELS[rec.risk.level]}
          </Badge>
          <Badge
            variant="outline"
            className={LEVEL_BADGE_CLASSES[rec.confidence]}
          >
            Confianza {CONFIDENCE_LABELS[rec.confidence]}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            Parche {rec.patch}
          </Badge>
        </div>
        <CardTitle className="text-lg">{rec.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div>
          <p className="font-medium text-foreground">Acción</p>
          <p className="text-muted-foreground">{rec.action}</p>
        </div>
        <div>
          <p className="font-medium text-foreground">Motivo</p>
          <p className="text-muted-foreground">{rec.reason}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Coste</p>
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
            <p className="font-medium text-foreground">Impacto esperado</p>
            <p className="text-muted-foreground">
              {rec.impact.description} ({rec.impact.metric}:{" "}
              {MAGNITUDE_LABELS[rec.impact.magnitude]})
            </p>
            {rec.impact.isPartialMetric && (
              <p className="text-xs italic text-muted-foreground/80">
                Métrica parcial: no es una estimación de DPS completa.
              </p>
            )}
          </div>
        </div>
        <div>
          <p className="font-medium text-foreground">Riesgo</p>
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
                <span>
                  Esta mejora supera tu presupuesto. Ahorra más moneda o considera una
                  alternativa.
                </span>
              </div>
            )}
            {rec.mayLoseValuableMods && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5 text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Puede perder mods valiosos del objeto actual.</span>
              </div>
            )}
            {rec.irreversible && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-2.5 text-red-200"
              >
                <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Acción irreversible: no podrás deshacerla. Asegúrate antes de
                  continuar.
                </span>
              </div>
            )}
          </div>
        )}

        {rec.sources.length > 0 && (
          <div>
            <p className="font-medium text-foreground">Fuentes</p>
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
                      <span className="sr-only">(se abre en una pestaña nueva)</span>
                    </a>
                  ) : (
                    source.label
                  )}{" "}
                  <span className="text-xs">({source.kind})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rec.unverified.length > 0 && (
          <div>
            <p className="font-medium text-foreground">Falta por verificar</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {rec.unverified.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground/80">
          Datos actualizados: {formatDateTime(rec.dataUpdatedAt)}
        </p>

        {/* Solo con vínculo estructurado del motor (relatedItemIds). Sin él no
            se ofrece navegación ni se adivina el hueco por el texto. */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onTrack(rec)}
            disabled={tracking}
          >
            <BookMarked className="size-3.5" aria-hidden="true" />
            Guardar como próximo paso
          </Button>
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
              Ver el objeto evaluado
              {rec.relatedItemIds.length > 1 && ` (${rec.relatedItemIds.length})`}
            </Button>
          )}
        </div>

        {rec.actionKind === "profile_sync" ? (
          <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
            <FileWarning className="size-4 text-sky-300" aria-hidden="true" />
            Acción de datos: no modifica el juego ni se incluye en el archivo .build.
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
              Ya la apliqué — incluir al exportar el .build
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
