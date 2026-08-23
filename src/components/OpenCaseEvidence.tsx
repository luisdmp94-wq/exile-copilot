import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { JournalEntry, Recommendation, SourceEvidence } from "@shared/domain.js";
import { readJournalCharacterLevel } from "@shared/domain.js";
import {
  CONFIDENCE_LABELS,
  GOAL_LABELS,
  formatCost,
  formatDateTime,
  MAGNITUDE_LABELS,
  RISK_LABELS,
  SOURCE_KIND_LABELS,
} from "@/lib/format";

/**
 * Evidencia y limitaciones del Caso Abierto (nivel 2 de la evidencia
 * progresiva). Aquí vive el DETALLE: parche, fecha de los datos, fuentes
 * completas y lista de datos no verificados.
 *
 * Lo que nunca baja a este nivel son las alertas materiales (irreversible,
 * posible pérdida de mods, presupuesto superado): esas se muestran arriba,
 * antes del CTA, sin plegar.
 *
 * Para una entrada del diario se usa su `recommendationSnapshot` cuando existe;
 * sin snapshot solo hay `sources` y `context`, y se dice así.
 */
interface OpenCaseEvidenceProps {
  recommendation: Recommendation | null;
  entry: JournalEntry | null;
}

export function OpenCaseEvidence({ recommendation, entry }: OpenCaseEvidenceProps) {
  const snapshot = recommendation ?? entry?.recommendationSnapshot ?? null;
  const storedLevel = entry === null ? null : readJournalCharacterLevel(entry.context);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {snapshot !== null ? (
        <>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <Row label="Motivo">{snapshot.reason}</Row>
            <Row label="Riesgo">
              {RISK_LABELS[snapshot.risk.level]} — {snapshot.risk.description}
            </Row>
            <Row label="Confianza">{CONFIDENCE_LABELS[snapshot.confidence]}</Row>
            <Row label="Coste">
              {formatCost(
                snapshot.cost.min,
                snapshot.cost.max,
                snapshot.cost.currency,
                snapshot.cost.known,
              )}
            </Row>
            <Row label="Impacto">
              {snapshot.impact.description} ({snapshot.impact.metric}:{" "}
              {MAGNITUDE_LABELS[snapshot.impact.magnitude]})
            </Row>
            <Row label="Parche">{snapshot.patch}</Row>
            <Row label="Datos actualizados">{formatDateTime(snapshot.dataUpdatedAt)}</Row>
          </dl>

          <SourceList sources={snapshot.sources} />

          <div>
            <p className="font-medium text-foreground">Falta por verificar</p>
            {snapshot.unverified.length > 0 ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {snapshot.unverified.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                El motor no declaró datos pendientes de verificar para este caso.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">
          Esta entrada no guarda el detalle de la recomendación original: solo
          quedan sus fuentes y el contexto en que se decidió.
        </p>
      )}

      {entry !== null && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="font-medium text-foreground">Contexto guardado con la decisión</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <Row label="Nivel">{storedLevel ?? "Desconocido"}</Row>
            <Row label="Liga">{entry.context.league ?? "Desconocida"}</Row>
            <Row label="Parche">{entry.context.patch ?? "Desconocido"}</Row>
            <Row label="Objetivo">
              {entry.context.goal === null
                ? "Desconocido"
                : GOAL_LABELS[entry.context.goal]}
            </Row>
            <Row label="Presupuesto">
              {entry.context.budget === null
                ? "Desconocido"
                : `${entry.context.budget.amount} ${entry.context.budget.currency}`}
            </Row>
          </dl>
          {recommendation === null && <SourceList sources={entry.sources} />}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function SourceList({ sources }: { sources: SourceEvidence[] }) {
  return (
    <div>
      <p className="font-medium text-foreground">Fuentes</p>
      {sources.length > 0 ? (
        <ul className="list-inside list-disc text-muted-foreground">
          {sources.map((source, index) => (
            <li key={`${source.label}-${index}`}>
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {source.label}
                  <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only">(se abre en una pestaña nueva)</span>
                </a>
              ) : (
                source.label
              )}{" "}
              <span className="text-xs">({SOURCE_KIND_LABELS[source.kind]})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Sin fuentes declaradas.</p>
      )}
    </div>
  );
}
