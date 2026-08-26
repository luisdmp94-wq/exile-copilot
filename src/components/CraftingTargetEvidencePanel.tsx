import { Eye, ShieldQuestion } from "lucide-react";
import type { CraftingTargetEvidence } from "@shared/craftingTargetEvidence.js";

const STATUS_STYLE: Record<CraftingTargetEvidence["status"], string> = {
  "target-on-current": "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-50",
  "target-observed-locally": "border-cyan-500/40 bg-cyan-500/[0.07] text-cyan-50",
  "partial-local-evidence": "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  unobserved: "border-border/80 bg-background/35 text-foreground",
};

const POOL_LABEL: Record<CraftingTargetEvidence["modPoolCoverage"], string> = {
  "available-complete": "Pool completo disponible",
  "available-partial": "Pool parcial",
  unavailable: "Pool no disponible",
  unknown: "Consultando cobertura",
};

export function CraftingTargetEvidencePanel({
  evidence,
}: {
  evidence: CraftingTargetEvidence;
}) {
  return (
    <section
      className={`rounded-md border p-3 ${STATUS_STYLE[evidence.status]}`}
      data-testid="crafting-target-evidence"
      data-status={evidence.status}
      data-pool-coverage={evidence.modPoolCoverage}
      aria-labelledby="crafting-target-evidence-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
            <Eye className="size-3.5" aria-hidden="true" />
            Evidencia del objetivo
          </p>
          <h4 id="crafting-target-evidence-title" className="mt-1 text-base font-semibold">
            {evidence.headline}
          </h4>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed opacity-85">{evidence.summary}</p>
        </div>
        <span className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold">
          {POOL_LABEL[evidence.modPoolCoverage]}
        </span>
      </div>

      {evidence.observations.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Observaciones locales del objetivo">
          {evidence.observations.slice(0, 4).map((observation) => (
            <li
              key={`${observation.itemId}:${observation.modifierText}`}
              className="rounded border border-current/20 bg-background/45 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <strong className="text-xs text-foreground">{observation.itemName}</strong>
                <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-65">
                  {observation.source === "current" ? "Actual" : "Otra base"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-foreground/90">{observation.modifierText}</p>
              <p className="mt-1 text-[10px] opacity-70">
                ilvl {observation.itemLevel ?? "?"} · {observation.tier === null ? "grado no visible" : `grado ${observation.tier}`} · {observation.relation === "exact" ? "línea exacta" : "misma categoría"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-2 text-[11px] opacity-75">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 font-medium hover:opacity-100">
          <ShieldQuestion className="size-3.5" aria-hidden="true" />
          Qué demuestra y qué no
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1 border-t border-current/15 pt-2">
          {evidence.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
      </details>
    </section>
  );
}
