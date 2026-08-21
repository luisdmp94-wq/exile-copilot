import {
  AlertTriangle,
  BookMarked,
  FileWarning,
  FlaskConical,
  OctagonAlert,
  PackageSearch,
  Pencil,
  Undo2,
} from "lucide-react";
import type { Budget, Recommendation } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CONFIDENCE_BADGE_CLASSES,
  CONFIDENCE_LABELS,
  formatCost,
  MAGNITUDE_LABELS,
  RISK_BADGE_CLASSES,
  RISK_LABELS,
  SOURCE_KIND_LABELS,
} from "@/lib/format";
import { compactRecommendationReason } from "@/lib/journal";
import { observationMethodForRecommendation } from "@/lib/sessionOutcome";
import { cn } from "@/lib/utils";

interface OpenCaseRecommendationProps {
  recommendation: Recommendation;
  budget: Budget;
  applied: boolean;
  onAppliedChange: (applied: boolean) => void;
  onTrack: (recommendation: Recommendation) => void;
  tracking: boolean;
  onStartSession?: (recommendation: Recommendation) => void;
  startingSession?: boolean;
  /** Navegación caso → objeto; solo con vínculo estructurado (`relatedItemIds`). */
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
  /** Única vía visible para corregir el perfil (acciones `profile_sync`). */
  onEditExpediente: () => void;
}

/**
 * Recomendación como contenido dominante del Caso Abierto.
 *
 * Orden de lectura fijado por la Fase Visual 1 y por la auditoría:
 *
 *   prioridad → título → acción → ALERTAS CRÍTICAS → CTA → justificación
 *
 * Las tres alertas materiales (presupuesto superado, posible pérdida de mods y
 * acción irreversible) van SIEMPRE antes del CTA y nunca dentro de un
 * acordeón: son la información que evita una pérdida irreversible. Combinan
 * color, icono y texto, así que no dependen del color para entenderse.
 *
 * El detalle de evidencia (parche, fecha, fuentes completas y lista de datos no
 * verificados) sí vive plegado, en «Evidencia y limitaciones».
 */
export function OpenCaseRecommendation({
  recommendation: rec,
  budget,
  applied,
  onAppliedChange,
  onTrack,
  tracking,
  onStartSession,
  startingSession = false,
  onFocusItem,
  onEditExpediente,
}: OpenCaseRecommendationProps) {
  const overBudget =
    rec.cost.currency === budget.currency &&
    ((rec.cost.min !== null && rec.cost.min > budget.amount) ||
      (rec.cost.max !== null && rec.cost.max > budget.amount));

  const sourceKinds = [...new Set(rec.sources.map((source) => source.kind))];
  // El explicador conserva metadatos auditables dentro de `reason`, pero el
  // Caso Abierto ya los presenta de forma estructurada debajo. Repetir aquí
  // enums, timestamps, parche, coste y confianza convierte el motivo en un log.
  const visibleReason = compactRecommendationReason(rec.reason);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Prioridad {rec.priority}
          </span>
          {rec.actionKind === "profile_sync" && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-200">
              Acción de datos
            </Badge>
          )}
          {rec.actionKind === "session_gate" && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-200">
              Freno de seguridad
            </Badge>
          )}
        </div>
        <h3 className="font-serif text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          {rec.title}
        </h3>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Acción
        </p>
        <p className="mt-1 text-base leading-relaxed text-foreground">{rec.action}</p>
      </div>

      <div
        className="rounded-md border border-sky-500/30 bg-sky-500/[0.06] p-4"
        data-testid="caso-que-observar"
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          <FlaskConical className="size-4" aria-hidden="true" />
          Después del cambio, observa
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {observationMethodForRecommendation(rec)}
        </p>
      </div>

      {/* ---- Alertas críticas: antes del CTA, nunca plegadas ---------------- */}
      {(overBudget || rec.mayLoseValuableMods || rec.irreversible) && (
        <div className="flex flex-col gap-2" data-testid="caso-alertas">
          {overBudget && (
            <CriticalAlert
              tone="warning"
              icon={AlertTriangle}
              title="Supera tu presupuesto"
              text="Esta mejora supera tu presupuesto. Ahorra más moneda o considera una alternativa."
            />
          )}
          {rec.mayLoseValuableMods && (
            <CriticalAlert
              tone="warning"
              icon={AlertTriangle}
              title="Puede perder mods valiosos"
              text="Revisa el objeto actual antes de sustituirlo."
            />
          )}
          {rec.irreversible && (
            <CriticalAlert
              tone="danger"
              icon={OctagonAlert}
              title="Acción irreversible"
              text="Acción irreversible: no podrás deshacerla. Asegúrate antes de continuar."
            />
          )}
        </div>
      )}

      {/* ---- CTA según actionKind ------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {rec.actionKind !== "session_gate" && (
            <Button type="button" onClick={() => onTrack(rec)} disabled={tracking}>
              <BookMarked className="size-4" aria-hidden="true" />
              Guardar como próximo paso
            </Button>
          )}
          {onStartSession && rec.actionKind !== "session_gate" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onStartSession(rec)}
              disabled={startingSession}
            >
              Probar y volver
            </Button>
          )}
          {rec.actionKind === "profile_sync" && (
            <Button type="button" variant="outline" onClick={onEditExpediente}>
              <Pencil className="size-4" aria-hidden="true" />
              Editar expediente
            </Button>
          )}
          {rec.relatedItemIds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              data-testid={`ver-objeto-${rec.id}`}
              onClick={(event) => {
                const first = rec.relatedItemIds[0];
                if (first !== undefined) onFocusItem(first, event.currentTarget);
              }}
            >
              <PackageSearch className="size-4" aria-hidden="true" />
              Ver el objeto evaluado
              {rec.relatedItemIds.length > 1 && ` (${rec.relatedItemIds.length})`}
            </Button>
          )}
        </div>

        {rec.actionKind === "session_gate" ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
            El mentor frena este paso hasta resolver el conflicto o la evidencia.
            Continúa en «Comprobar una decisión», más abajo.
          </p>
        ) : rec.actionKind === "profile_sync" ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
            Acción de datos: no modifica el juego ni se incluye en el archivo .build.
          </p>
        ) : (
          <div className="flex items-center gap-2">
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
      </div>

      {/* ---- Justificación: visible, sin plegar ----------------------------- */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Justificación
        </p>
        <div>
          <p className="text-sm font-medium text-foreground">Motivo</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {visibleReason}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-foreground">Impacto esperado</p>
            <p className="text-sm text-muted-foreground">
              {rec.impact.description} ({rec.impact.metric}:{" "}
              {MAGNITUDE_LABELS[rec.impact.magnitude]})
            </p>
            {rec.impact.isPartialMetric && (
              <p className="text-xs italic text-muted-foreground">
                Métrica parcial: no es una estimación de DPS completa.
              </p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Coste</p>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                overBudget && "font-semibold text-amber-200",
              )}
            >
              {formatCost(rec.cost.min, rec.cost.max, rec.cost.currency, rec.cost.known)}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Riesgo</p>
          <p className="text-sm text-muted-foreground">{rec.risk.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={RISK_BADGE_CLASSES[rec.risk.level]}>
            Riesgo {RISK_LABELS[rec.risk.level]}
          </Badge>
          <Badge variant="outline" className={CONFIDENCE_BADGE_CLASSES[rec.confidence]}>
            Confianza {CONFIDENCE_LABELS[rec.confidence]}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {rec.sources.length === 0
              ? "Sin fuentes declaradas"
              : `Procedencia: ${sourceKinds
                  .map((kind) => SOURCE_KIND_LABELS[kind])
                  .join(", ")}`}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/**
 * Alerta material del caso. Color + icono + texto: quien no distinga el color
 * sigue leyendo el icono y el título.
 */
function CriticalAlert({
  tone,
  icon: Icon,
  title,
  text,
}: {
  tone: "warning" | "danger";
  icon: typeof AlertTriangle;
  title: string;
  text: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        tone === "danger"
          ? "border-red-500/60 bg-red-500/10 text-red-100"
          : "border-amber-500/60 bg-amber-500/10 text-amber-100",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">{title}.</strong> {text}
      </span>
    </div>
  );
}
