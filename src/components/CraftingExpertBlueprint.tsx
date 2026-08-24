import type {
  ExpertCraftingBlueprint,
  ExpertCraftingRouteCandidate,
} from "@shared/craftingBlueprint.js";
import { Button } from "@/components/ui/button";

const RISK_STYLE: Record<ExpertCraftingRouteCandidate["risk"], string> = {
  controlled: "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100",
  "stage-change": "border-amber-500/35 bg-amber-500/[0.06] text-amber-100",
  replacement: "border-rose-500/35 bg-rose-500/[0.06] text-rose-100",
};

const RISK_LABEL: Record<ExpertCraftingRouteCandidate["risk"], string> = {
  controlled: "Añade",
  "stage-change": "Cambia etapa",
  replacement: "Reemplaza",
};

const STATUS_STYLE: Record<ExpertCraftingBlueprint["status"], string> = {
  "needs-item-data": "border-rose-500/40 bg-rose-500/[0.07] text-rose-50",
  "needs-objective": "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  "needs-stop": "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  "already-complete": "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-50",
  "needs-route-data": "border-rose-500/40 bg-rose-500/[0.07] text-rose-50",
  ready: "border-cyan-500/40 bg-cyan-500/[0.07] text-cyan-50",
};

function ContractCell({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty?: boolean;
}) {
  return (
    <div className="min-w-0 bg-background/65 px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/75">
        {label}
      </span>
      <p className={`mt-1 line-clamp-2 text-xs leading-relaxed ${empty ? "text-amber-200" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

export function CraftingExpertBlueprint({
  blueprint,
  disabled,
  onChooseRoute,
  showContract = true,
}: {
  blueprint: ExpertCraftingBlueprint;
  disabled: boolean;
  onChooseRoute: (route: ExpertCraftingRouteCandidate) => void;
  /** El laboratorio ya muestra el contrato paso a paso; evita repetirlo aquí. */
  showContract?: boolean;
}) {
  const protectedSummary =
    blueprint.protectedLines.length > 0
      ? blueprint.protectedLines.join(" · ")
      : "Ninguna línea marcada";
  const stopSummary =
    blueprint.stopConditions.length > 0
      ? blueprint.stopConditions.join(" · ")
      : "Sin condición de salida";

  return (
    <section
      className="overflow-hidden rounded-md border border-cyan-500/30 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_38%)]"
      data-testid="crafting-expert-blueprint"
      data-status={blueprint.status}
      aria-labelledby="crafting-expert-blueprint-title"
    >
      <div className={`border-b px-4 py-3 ${STATUS_STYLE[blueprint.status]}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-75">
          {blueprint.eyebrow}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <h4 id="crafting-expert-blueprint-title" className="text-lg font-semibold">
            {blueprint.headline}
          </h4>
          <span className="text-xs opacity-85">{blueprint.nextAction}</span>
        </div>
      </div>

      {showContract && (
        <div className="grid gap-px bg-border/50 sm:grid-cols-3" aria-label="Contrato del craft">
          <ContractCell
            label="Resultado buscado"
            value={blueprint.objective ?? "Objetivo pendiente"}
            empty={blueprint.objective === null}
          />
          <ContractCell
            label="No sacrificar"
            value={protectedSummary}
            empty={blueprint.protectedLines.length === 0}
          />
          <ContractCell
            label="Parar cuando"
            value={stopSummary}
            empty={blueprint.stopConditions.length === 0}
          />
        </div>
      )}

      {blueprint.routes.length > 0 && (
        <div className="p-3" data-testid="crafting-route-comparison">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">Rutas desde el estado actual</strong>
            <span className="text-[11px] text-muted-foreground">
              {blueprint.recommendedRouteId ? "Orden conservador" : "Sin ganador demostrable"}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {blueprint.routes.map((route) => (
              <article
                key={route.id}
                className={`rounded border p-3 ${RISK_STYLE[route.risk]}`}
                data-testid={`crafting-blueprint-route-${route.id}`}
                data-recommended={route.recommended ? "true" : "false"}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm text-foreground">{route.label}</strong>
                    {route.recommended && (
                      <span className="ml-2 rounded-full border border-cyan-400/35 bg-cyan-500/[0.1] px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                        Primero
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide">
                    {route.availability === "legal" ? RISK_LABEL[route.risk] : "Falta tooltip"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/90">{route.consequence}</p>
                <details className="mt-2 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium hover:text-foreground">
                    Qué conserva y qué arriesga
                  </summary>
                  <div className="mt-2 space-y-1 border-t border-current/15 pt-2">
                    <p>{route.preserves}</p>
                    <p>{route.uncertainty}</p>
                  </div>
                </details>
                <Button
                  className="mt-3"
                  type="button"
                  size="sm"
                  variant={route.recommended ? "default" : "outline"}
                  disabled={disabled || blueprint.status !== "ready"}
                  onClick={() => onChooseRoute(route)}
                >
                  {blueprint.status === "already-complete"
                    ? "Parada ya cumplida"
                    : route.availability === "legal"
                      ? `Preparar ${route.label}`
                      : `Evaluar ${route.label}`}
                </Button>
              </article>
            ))}
          </div>
        </div>
      )}

      <details className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium hover:text-foreground">
          Límites del plan
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {blueprint.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
