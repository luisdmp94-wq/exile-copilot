import type {
  ExpertCraftingBlueprint,
  ExpertCraftingRouteCandidate,
} from "@shared/craftingBlueprint.js";
import type { CraftingProjectAttempt } from "@/lib/craftingProject";
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

const PHASE_LABEL: Record<ExpertCraftingBlueprint["projectPhase"], string> = {
  blocked: "Bloqueado",
  base: "Base",
  foundation: "Fundación",
  finishing: "Cierre",
  recovery: "Recuperación",
  finished: "Terminado",
};

const BASE_DECISION_STYLE: Record<ExpertCraftingBlueprint["baseDecision"]["kind"], string> = {
  hold: "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  continue: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-50",
  recover: "border-violet-500/40 bg-violet-500/[0.07] text-violet-50",
  "change-base": "border-rose-500/40 bg-rose-500/[0.07] text-rose-50",
  stop: "border-cyan-500/40 bg-cyan-500/[0.07] text-cyan-50",
};

const BRANCH_STYLE = {
  success: "border-emerald-500/30 bg-emerald-500/[0.055]",
  salvage: "border-cyan-500/30 bg-cyan-500/[0.055]",
  failure: "border-rose-500/30 bg-rose-500/[0.055]",
} as const;

const ATTEMPT_LABEL: Record<CraftingProjectAttempt["branch"], string> = {
  success: "Objetivo alcanzado",
  salvage: "Resultado aprovechable",
  failure: "Ruta agotada",
};

const ATTEMPT_STYLE: Record<CraftingProjectAttempt["branch"], string> = {
  success: "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100",
  salvage: "border-cyan-500/35 bg-cyan-500/[0.06] text-cyan-100",
  failure: "border-rose-500/35 bg-rose-500/[0.06] text-rose-100",
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
  attempts = [],
  disabled,
  onChooseRoute,
  showContract = true,
}: {
  blueprint: ExpertCraftingBlueprint;
  attempts?: CraftingProjectAttempt[];
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
          <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px]">
            <span className="rounded-full border border-current/25 px-2 py-0.5">
              Fase · {PHASE_LABEL[blueprint.projectPhase]}
            </span>
            {blueprint.budgetLabel && (
              <span className="rounded-full border border-current/25 px-2 py-0.5">
                Tope · {blueprint.budgetLabel}
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs opacity-85">{blueprint.nextAction}</p>
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

      <div className="grid gap-2 border-b border-border/70 p-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)]">
        <section
          className={`rounded border p-3 ${BASE_DECISION_STYLE[blueprint.baseDecision.kind]}`}
          data-testid="crafting-project-base-decision"
          data-decision={blueprint.baseDecision.kind}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
            Decisión sobre la base
          </span>
          <strong className="mt-1 block text-sm">{blueprint.baseDecision.label}</strong>
          <p className="mt-1 text-xs leading-relaxed opacity-85">{blueprint.baseDecision.detail}</p>
        </section>

        <section data-testid="crafting-project-branches" aria-labelledby="crafting-project-branches-title">
          <div className="flex items-center justify-between gap-2">
            <strong id="crafting-project-branches-title" className="text-sm">Mapa del resultado</strong>
            <span className="text-[11px] text-muted-foreground">Se recalcula al pegar la pieza</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {blueprint.branches.map((branch) => (
              <article key={branch.id} className={`rounded border p-2.5 ${BRANCH_STYLE[branch.id]}`}>
                <strong className="text-xs text-foreground">{branch.label}</strong>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground" title={branch.trigger}>
                  {branch.trigger}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-foreground/90">
                  {branch.response}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {attempts.length > 0 && (
        <section
          className="border-b border-border/70 p-3"
          data-testid="crafting-project-history"
          data-attempt-count={attempts.length}
          aria-labelledby="crafting-project-history-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75">
                Memoria del proyecto
              </p>
              <strong id="crafting-project-history-title" className="text-sm">
                {attempts.length} {attempts.length === 1 ? "intento registrado" : "intentos registrados"}
              </strong>
            </div>
            <span className="text-[11px] text-muted-foreground">Últimos 4</span>
          </div>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {attempts.slice(-4).reverse().map((attempt, reversedIndex) => {
              const attemptNumber = attempts.length - reversedIndex;
              return (
                <li
                  key={attempt.sessionId}
                  className={`rounded border p-3 ${ATTEMPT_STYLE[attempt.branch]}`}
                  data-project-branch={attempt.branch}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-70">
                        Intento {attemptNumber} · {attempt.actionLabel}
                      </span>
                      <strong className="mt-1 block text-sm text-foreground">
                        {ATTEMPT_LABEL[attempt.branch]}
                      </strong>
                    </div>
                    <span className="shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px]">
                      +{attempt.addedModifiers.length} / −{attempt.removedModifiers.length}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-85">
                    {attempt.decisionTitle}
                  </p>
                  {attempt.protectedStatus === "lost" && (
                    <p className="mt-2 text-[11px] font-semibold">Se perdió una línea protegida.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
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
