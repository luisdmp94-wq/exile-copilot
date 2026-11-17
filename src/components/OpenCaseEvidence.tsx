import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { JournalEntry, Recommendation, SourceEvidence } from "@shared/domain.js";
import { readJournalCharacterLevel } from "@shared/domain.js";
import { formatCost, formatDateTime } from "@/lib/format";
import { useFormatLabels } from "@/lib/formatLabels";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    reason: "Motivo",
    risk: "Riesgo",
    confidence: "Confianza",
    cost: "Coste",
    impact: "Impacto",
    patch: "Parche",
    dataUpdated: "Datos actualizados",
    toVerify: "Falta por verificar",
    nothingToVerify: "El motor no declaró datos pendientes de verificar para este caso.",
    noSnapshot:
      "Esta entrada no guarda el detalle de la recomendación original: solo quedan sus fuentes y el contexto en que se decidió.",
    savedContext: "Contexto guardado con la decisión",
    level: "Nivel",
    league: "Liga",
    goal: "Objetivo",
    budget: "Presupuesto",
    unknownMasc: "Desconocido",
    unknownFem: "Desconocida",
    sources: "Fuentes",
    newTab: "(se abre en una pestaña nueva)",
    noSources: "Sin fuentes declaradas.",
  },
  {
    reason: "Reason",
    risk: "Risk",
    confidence: "Confidence",
    cost: "Cost",
    impact: "Impact",
    patch: "Patch",
    dataUpdated: "Data updated",
    toVerify: "Still to verify",
    nothingToVerify: "The engine didn't list anything left to verify for this case.",
    noSnapshot:
      "This entry doesn't keep the details of the original recommendation: only its sources and the context it was decided in remain.",
    savedContext: "Context saved with the decision",
    level: "Level",
    league: "League",
    goal: "Goal",
    budget: "Budget",
    unknownMasc: "Unknown",
    unknownFem: "Unknown",
    sources: "Sources",
    newTab: "(opens in a new tab)",
    noSources: "No sources given.",
  },
);

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
  const t = useText(TEXT);
  const labels = useFormatLabels();
  const snapshot = recommendation ?? entry?.recommendationSnapshot ?? null;
  const storedLevel = entry === null ? null : readJournalCharacterLevel(entry.context);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {snapshot !== null ? (
        <>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <Row label={t.reason}>{snapshot.reason}</Row>
            <Row label={t.risk}>
              {labels.risk[snapshot.risk.level]} — {snapshot.risk.description}
            </Row>
            <Row label={t.confidence}>{labels.confidence[snapshot.confidence]}</Row>
            <Row label={t.cost}>
              {formatCost(
                snapshot.cost.min,
                snapshot.cost.max,
                snapshot.cost.currency,
                snapshot.cost.known,
              )}
            </Row>
            <Row label={t.impact}>
              {snapshot.impact.description} ({snapshot.impact.metric}:{" "}
              {labels.magnitude[snapshot.impact.magnitude]})
            </Row>
            <Row label={t.patch}>{snapshot.patch}</Row>
            <Row label={t.dataUpdated}>{formatDateTime(snapshot.dataUpdatedAt)}</Row>
          </dl>

          <SourceList sources={snapshot.sources} />

          <div>
            <p className="font-medium text-foreground">{t.toVerify}</p>
            {snapshot.unverified.length > 0 ? (
              <ul className="list-inside list-disc text-muted-foreground">
                {snapshot.unverified.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                {t.nothingToVerify}
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">
          {t.noSnapshot}
        </p>
      )}

      {entry !== null && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="font-medium text-foreground">{t.savedContext}</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <Row label={t.level}>{storedLevel ?? t.unknownMasc}</Row>
            <Row label={t.league}>{entry.context.league ?? t.unknownFem}</Row>
            <Row label={t.patch}>{entry.context.patch ?? t.unknownMasc}</Row>
            <Row label={t.goal}>
              {entry.context.goal === null
                ? t.unknownMasc
                : labels.goal[entry.context.goal]}
            </Row>
            <Row label={t.budget}>
              {entry.context.budget === null
                ? t.unknownMasc
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function SourceList({ sources }: { sources: SourceEvidence[] }) {
  const t = useText(TEXT);
  const labels = useFormatLabels();
  return (
    <div>
      <p className="font-medium text-foreground">{t.sources}</p>
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
                  <span className="sr-only">{t.newTab}</span>
                </a>
              ) : (
                source.label
              )}{" "}
              <span className="text-xs">({labels.sourceKind[source.kind]})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t.noSources}</p>
      )}
    </div>
  );
}
