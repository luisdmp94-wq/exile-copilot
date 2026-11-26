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
  formatCost,
  RISK_BADGE_CLASSES,
} from "@/lib/format";
import { useFormatLabels } from "@/lib/formatLabels";
import { compactRecommendationReason } from "@/lib/journal";
import { observationMethodForRecommendation } from "@/lib/sessionOutcome";
import { cn } from "@/lib/utils";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    priority: (priority: number) => `Prioridad ${priority}`,
    dataAction: "Acción de datos",
    safetyStop: "Freno de seguridad",
    action: "Acción",
    whatToCheck: "Qué comprobar después",
    overBudgetTitle: "Supera tu presupuesto",
    overBudgetText: "Esta mejora supera tu presupuesto. Ahorra más moneda o considera una alternativa.",
    loseModsTitle: "Puede perder mods valiosos",
    loseModsText: "Revisa el objeto actual antes de sustituirlo.",
    irreversibleTitle: "Acción irreversible",
    irreversibleText: "Acción irreversible: no podrás deshacerla. Asegúrate antes de continuar.",
    saveNextStep: "Guardar como próximo paso",
    tryAndReturn: "Probar y volver",
    editFile: "Editar personaje",
    seeItem: "Ver el objeto evaluado",
    gateNote:
      "El mentor frena este paso hasta resolver el conflicto o la evidencia. Continúa en «Comprobar una decisión», más abajo.",
    dataActionNote: "Acción de datos: no modifica el juego ni se incluye en el archivo .build.",
    appliedLabel: "Ya la apliqué",
    data: "Datos",
    cost: (cost: string) => `Coste ${cost}`,
    risk: (risk: string) => `Riesgo ${risk}`,
    confidence: (confidence: string) => `Confianza ${confidence}`,
    impact: (impact: string) => `Impacto ${impact}`,
    partialMetric: ". Métrica parcial: no es una estimación de DPS completa.",
    noSources: "Sin fuentes declaradas",
    origin: (kinds: string) => `Sale de: ${kinds}`,
  },
  {
    priority: (priority: number) => `Priority ${priority}`,
    dataAction: "Data action",
    safetyStop: "Safety stop",
    action: "Action",
    whatToCheck: "What to check afterwards",
    overBudgetTitle: "Over your budget",
    overBudgetText: "This upgrade costs more than your budget. Save up more currency or look at another option.",
    loseModsTitle: "You may lose valuable modifiers",
    loseModsText: "Check your current item before you replace it.",
    irreversibleTitle: "Can't be undone",
    irreversibleText: "This action can't be undone. Make sure before you go ahead.",
    saveNextStep: "Save as next step",
    tryAndReturn: "Try it and come back",
    editFile: "Edit character",
    seeItem: "See the item checked",
    gateNote:
      "The mentor holds this step until the conflict or the evidence is sorted out. Carry on in “Check a decision”, further down.",
    dataActionNote: "Data action: it doesn't change the game and isn't included in the .build file.",
    appliedLabel: "I've done it",
    data: "Data",
    cost: (cost: string) => `Cost ${cost}`,
    risk: (risk: string) => `Risk ${risk}`,
    confidence: (confidence: string) => `Confidence ${confidence}`,
    impact: (impact: string) => `Impact ${impact}`,
    partialMetric: ". Partial metric: not a full DPS estimate.",
    noSources: "No sources given",
    origin: (kinds: string) => `Based on: ${kinds}`,
  },
);

interface OpenCaseRecommendationProps {
  recommendation: Recommendation;
  budget: Budget | null;
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

/** Pie de datos del caso: legible, pero sin el peso de un control. */
const CASE_DATA_BADGE = "px-1.5 py-0 text-[10px] font-normal";

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
  const t = useText(TEXT);
  const labels = useFormatLabels();
  const overBudget =
    budget !== null &&
    rec.cost.currency === budget.currency &&
    ((rec.cost.min !== null && rec.cost.min > budget.amount) ||
      (rec.cost.max !== null && rec.cost.max > budget.amount));

  const sourceKinds = [...new Set(rec.sources.map((source) => source.kind))];
  // El explicador conserva metadatos auditables dentro de `reason`, pero el
  // Caso Abierto ya los presenta de forma estructurada debajo. Repetir aquí
  // enums, timestamps, parche, coste y confianza convierte el motivo en un log.
  const visibleReason = compactRecommendationReason(rec.reason);
  const compactAction = compactCaseAction(rec.action);
  const compactReason = compactCaseText(visibleReason);
  const observationMethod = observationMethodForRecommendation(rec);
  const compactObservationMethod = compactCaseText(observationMethod, 150);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-primary">
            {t.priority(rec.priority)}
          </span>
          {rec.actionKind === "profile_sync" && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-200">
              {t.dataAction}
            </Badge>
          )}
          {rec.actionKind === "session_gate" && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-200">
              {t.safetyStop}
            </Badge>
          )}
        </div>
        <h3 className="text-2xl font-semibold leading-tight text-foreground">
          {rec.title}
        </h3>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          {t.action}
        </p>
        <p
          className="mt-1 text-base leading-relaxed text-foreground"
          aria-label={rec.action}
          title={rec.action}
        >
          {compactAction}
        </p>
      </div>

      {/* Esta es la salida de la web hacia PoE2, no evidencia técnica. Empieza
          visible para que el jugador sepa qué observar antes de guardar o
          probar la acción; puede plegarla si ya la ha leído. */}
      <details
        open
        className="group rounded-md border border-border/70 bg-background/40 px-4 py-2.5"
        data-testid="caso-que-observar"
      >
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rotulo-seccion text-muted-foreground marker:content-none hover:text-foreground">
          <FlaskConical className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
          {t.whatToCheck}
          <span className="ml-auto text-base leading-none transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true">
            +
          </span>
        </summary>
        <p
          className="mt-3 border-t border-border/60 pt-3 text-sm leading-relaxed text-foreground"
          aria-label={observationMethod}
          title={observationMethod}
        >
          {compactObservationMethod}
        </p>
      </details>

      {/* ---- Alertas críticas: antes del CTA, nunca plegadas ---------------- */}
      {(overBudget || rec.mayLoseValuableMods || rec.irreversible) && (
        <div className="flex flex-col gap-2" data-testid="caso-alertas">
          {overBudget && (
            <CriticalAlert
              tone="warning"
              icon={AlertTriangle}
              title={t.overBudgetTitle}
              text={t.overBudgetText}
            />
          )}
          {rec.mayLoseValuableMods && (
            <CriticalAlert
              tone="warning"
              icon={AlertTriangle}
              title={t.loseModsTitle}
              text={t.loseModsText}
            />
          )}
          {rec.irreversible && (
            <CriticalAlert
              tone="danger"
              icon={OctagonAlert}
              title={t.irreversibleTitle}
              text={t.irreversibleText}
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
              {t.saveNextStep}
            </Button>
          )}
          {onStartSession && rec.actionKind !== "session_gate" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onStartSession(rec)}
              disabled={startingSession}
            >
              {t.tryAndReturn}
            </Button>
          )}
          {rec.actionKind === "profile_sync" && (
            <Button type="button" variant="outline" onClick={onEditExpediente}>
              <Pencil className="size-4" aria-hidden="true" />
              {t.editFile}
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
              {t.seeItem}
              {rec.relatedItemIds.length > 1 && ` (${rec.relatedItemIds.length})`}
            </Button>
          )}
        </div>

        {rec.actionKind === "session_gate" ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
            {t.gateNote}
          </p>
        ) : rec.actionKind === "profile_sync" ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
            {t.dataActionNote}
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
              {t.appliedLabel}
            </Label>
          </div>
        )}
      </div>

      {/* Resumen de cinco segundos: la explicación extensa vive en Evidencia. */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p
          className="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
          aria-label={visibleReason}
          title={visibleReason}
        >
          {compactReason}
        </p>
        {/* Estas cinco insignias NO pueden plegarse: `equipment-smoke` exige que
            coste, riesgo, confianza, impacto y procedencia sigan fuera de un
            `<details>`. Lo que sí se reduce es su peso visual: eran cinco
            contornos del mismo tamaño que los botones, y ahora leen como el
            pie de datos que son. */}
        <div className="flex flex-wrap items-center gap-1.5" data-testid="caso-datos-clave">
          <span className="rotulo-seccion mr-0.5 text-muted-foreground/70">{t.data}</span>
          <Badge
            variant="outline"
            className={cn(
              CASE_DATA_BADGE,
              "border-border/60 text-muted-foreground",
              overBudget && "border-amber-500/50 bg-amber-500/10 text-amber-200",
            )}
          >
            {t.cost(formatCost(rec.cost.min, rec.cost.max, rec.cost.currency, rec.cost.known))}
          </Badge>
          <Badge variant="outline" className={cn(CASE_DATA_BADGE, RISK_BADGE_CLASSES[rec.risk.level])}>
            {t.risk(labels.risk[rec.risk.level])}
          </Badge>
          <Badge variant="outline" className={cn(CASE_DATA_BADGE, CONFIDENCE_BADGE_CLASSES[rec.confidence])}>
            {t.confidence(labels.confidence[rec.confidence])}
          </Badge>
          <Badge
            variant="outline"
            className={cn(CASE_DATA_BADGE, "border-border/60 text-muted-foreground")}
            title={`${rec.impact.description} (${rec.impact.metric})${
              rec.impact.isPartialMetric
                ? t.partialMetric
                : ""
            }`}
          >
            {t.impact(labels.magnitude[rec.impact.magnitude])}
          </Badge>
          <Badge variant="outline" className={cn(CASE_DATA_BADGE, "border-border/60 text-muted-foreground")}>
            {rec.sources.length === 0
              ? t.noSources
              : t.origin(sourceKinds.map((kind) => labels.sourceKind[kind]).join(", "))}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/** Límite visual seguro por puntos de código; el texto completo queda accesible. */
function compactCaseAction(text: string): string {
  return compactCaseText(text.replace(/;\s*después\s+/i, " y "));
}

function compactCaseText(text: string, maxLength = 160): string {
  const characters = Array.from(text.trim());
  if (characters.length <= maxLength) return text.trim();
  const candidate = characters.slice(0, maxLength - 1).join("").trimEnd();
  const lastWordBoundary = candidate.lastIndexOf(" ");
  const compacted =
    lastWordBoundary >= Math.floor(maxLength * 0.72)
      ? candidate.slice(0, lastWordBoundary)
      : candidate;
  return `${compacted.trimEnd()}…`;
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
