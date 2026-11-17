import type {
  ExpertCraftingBlueprint,
  ExpertCraftingRouteCandidate,
} from "@shared/craftingBlueprint.js";
import {
  splitCraftingProjectAttemptHistory,
  type CraftingProjectAttempt,
  type NumberedCraftingProjectAttempt,
} from "@/lib/craftingProject";
import { Button } from "@/components/ui/button";
import { texts, useLang, useText, type Lang } from "@/i18n/lang";

const RISK_STYLE: Record<ExpertCraftingRouteCandidate["risk"], string> = {
  controlled: "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100",
  "stage-change": "border-amber-500/35 bg-amber-500/[0.06] text-amber-100",
  replacement: "border-rose-500/35 bg-rose-500/[0.06] text-rose-100",
};


const STATUS_STYLE: Record<ExpertCraftingBlueprint["status"], string> = {
  "needs-item-data": "border-rose-500/40 bg-rose-500/[0.07] text-rose-50",
  "needs-objective": "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  "needs-stop": "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  "already-complete": "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-50",
  "needs-route-data": "border-rose-500/40 bg-rose-500/[0.07] text-rose-50",
  ready: "border-primary/40 bg-primary/[0.07] text-foreground",
};


const BASE_DECISION_STYLE: Record<ExpertCraftingBlueprint["baseDecision"]["kind"], string> = {
  hold: "border-amber-500/40 bg-amber-500/[0.07] text-amber-50",
  continue: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-50",
  recover: "border-violet-500/40 bg-violet-500/[0.07] text-violet-50",
  "change-base": "border-rose-500/40 bg-rose-500/[0.07] text-rose-50",
  stop: "border-primary/40 bg-primary/[0.07] text-foreground",
};

const BRANCH_STYLE = {
  success: "border-emerald-500/30 bg-emerald-500/[0.055]",
  salvage: "border-primary/30 bg-muted/[0.04]",
  failure: "border-rose-500/30 bg-rose-500/[0.055]",
} as const;

const TEXT = texts(
  {
    risk: {
      controlled: "Añade",
      "stage-change": "Cambia etapa",
      replacement: "Reemplaza",
    } as Record<ExpertCraftingRouteCandidate["risk"], string>,
    phase: {
      blocked: "Bloqueado",
      base: "Base",
      foundation: "Fundación",
      finishing: "Cierre",
      recovery: "Recuperación",
      finished: "Terminado",
    } as Record<ExpertCraftingBlueprint["projectPhase"], string>,
    attempt: {
      success: "Objetivo alcanzado",
      salvage: "Resultado aprovechable",
      failure: "Ruta agotada",
    } as Record<CraftingProjectAttempt["branch"], string>,
    noDate: "Fecha no disponible",
    attemptHeader: (number: number, action: string) => `Intento ${number} · ${action}`,
    protectedLost: "Se perdió una línea protegida.",
    noLineMarked: "Ninguna línea marcada",
    noExit: "Sin condición de salida",
    phaseChip: (phase: string) => `Fase · ${phase}`,
    capChip: (budget: string) => `Tope · ${budget}`,
    contractAria: "Contrato del craft",
    wantedResult: "Resultado buscado",
    pendingGoal: "Objetivo pendiente",
    dontSacrifice: "No sacrificar",
    stopWhen: "Parar cuando",
    baseDecision: "Decisión sobre la base",
    resultMap: "Mapa del resultado",
    recalculates: "Se recalcula al pegar la pieza",
    projectMemory: "Memoria del proyecto",
    attemptsSaved: (count: number) => `${count} ${count === 1 ? "intento registrado" : "intentos registrados"}`,
    recentFour: "4 recientes",
    allVisible: "Todos visibles",
    seeOlder: (count: number) => `Ver ${count} ${count === 1 ? "intento anterior" : "intentos anteriores"}`,
    routesTitle: "Rutas desde el estado actual",
    safeOrder: "Orden conservador",
    noWinner: "Sin ganador demostrable",
    first: "Primero",
    underReview: "En revisión",
    tooltipMissing: "Falta tooltip",
    keepsAndRisks: "Qué conserva y qué arriesga",
    demoOnly: "Solo demostración",
    waitingPatch: "Esperando revisión del parche",
    stopReached: "Parada ya cumplida",
    prepare: (label: string) => `Preparar ${label}`,
    evaluate: (label: string) => `Evaluar ${label}`,
    planLimits: "Límites del plan",
  },
  {
    risk: {
      controlled: "Adds",
      "stage-change": "Changes stage",
      replacement: "Replaces",
    },
    phase: {
      blocked: "Blocked",
      base: "Base",
      foundation: "Foundation",
      finishing: "Finishing",
      recovery: "Recovery",
      finished: "Finished",
    },
    attempt: {
      success: "Goal reached",
      salvage: "Usable result",
      failure: "Route used up",
    },
    noDate: "Date not available",
    attemptHeader: (number: number, action: string) => `Attempt ${number} · ${action}`,
    protectedLost: "A protected line was lost.",
    noLineMarked: "No line marked",
    noExit: "No exit condition",
    phaseChip: (phase: string) => `Stage · ${phase}`,
    capChip: (budget: string) => `Cap · ${budget}`,
    contractAria: "Craft plan",
    wantedResult: "Result you want",
    pendingGoal: "Goal pending",
    dontSacrifice: "Don't sacrifice",
    stopWhen: "Stop when",
    baseDecision: "Decision on the base",
    resultMap: "Result map",
    recalculates: "Updates when you paste the item",
    projectMemory: "Project history",
    attemptsSaved: (count: number) => `${count} ${count === 1 ? "attempt saved" : "attempts saved"}`,
    recentFour: "4 most recent",
    allVisible: "All shown",
    seeOlder: (count: number) => `See ${count} ${count === 1 ? "earlier attempt" : "earlier attempts"}`,
    routesTitle: "Routes from the current state",
    safeOrder: "Safe order",
    noWinner: "No clear winner",
    first: "First",
    underReview: "Under review",
    tooltipMissing: "Tooltip missing",
    keepsAndRisks: "What it keeps and what it risks",
    demoOnly: "Demo only",
    waitingPatch: "Waiting for the patch review",
    stopReached: "Stop already reached",
    prepare: (label: string) => `Prepare ${label}`,
    evaluate: (label: string) => `Check ${label}`,
    planLimits: "Plan limits",
  },
);

const ATTEMPT_STYLE: Record<CraftingProjectAttempt["branch"], string> = {
  success: "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100",
  salvage: "border-primary/35 bg-primary/[0.07] text-primary",
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
      <span className="text-xs font-semibold text-primary/70">
        {label}
      </span>
      <p className={`mt-1 line-clamp-2 text-xs leading-relaxed ${empty ? "text-amber-200" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function attemptDate(value: string, lang: Lang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return TEXT[lang].noDate;
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ProjectAttemptCard({
  entry,
}: {
  entry: NumberedCraftingProjectAttempt;
}) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const { attempt, number } = entry;
  return (
    <li
      className={`rounded border p-3 ${ATTEMPT_STYLE[attempt.branch]}`}
      data-testid="crafting-project-attempt"
      data-project-branch={attempt.branch}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold opacity-70">
            {t.attemptHeader(number, attempt.actionLabel)}
          </span>
          <strong className="mt-1 block text-sm text-foreground">
            {t.attempt[attempt.branch]}
          </strong>
        </div>
        <span className="shrink-0 rounded-full border border-current/25 px-2 py-0.5 text-[10px]">
          +{attempt.addedModifiers.length} / −{attempt.removedModifiers.length}
        </span>
      </div>
      <p className="mt-1 truncate text-[11px] opacity-70" title={attempt.resultName}>
        {attempt.resultName} · {attemptDate(attempt.recordedAt, lang)}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-85">
        {attempt.decisionTitle}
      </p>
      {attempt.protectedStatus === "lost" && (
        <p className="mt-2 text-[11px] font-semibold">{t.protectedLost}</p>
      )}
    </li>
  );
}

export function CraftingExpertBlueprint({
  blueprint,
  attempts = [],
  disabled,
  simulation = false,
  unavailableRouteIds = [],
  onChooseRoute,
  showContract = true,
}: {
  blueprint: ExpertCraftingBlueprint;
  attempts?: CraftingProjectAttempt[];
  disabled: boolean;
  /** Enseña la lectura sin ofrecer preparar una acción sobre un objeto ficticio. */
  simulation?: boolean;
  /** Rutas conocidas cuya mecánica aún no está autorizada para el parche. */
  unavailableRouteIds?: readonly ExpertCraftingRouteCandidate["id"][];
  onChooseRoute: (route: ExpertCraftingRouteCandidate) => void;
  /** El laboratorio ya muestra el contrato paso a paso; evita repetirlo aquí. */
  showContract?: boolean;
}) {
  const t = useText(TEXT);
  const protectedSummary =
    blueprint.protectedLines.length > 0
      ? blueprint.protectedLines.join(" · ")
      : t.noLineMarked;
  const stopSummary =
    blueprint.stopConditions.length > 0
      ? blueprint.stopConditions.join(" · ")
      : t.noExit;
  const unavailableRoutes = new Set(unavailableRouteIds);
  const attemptHistory = splitCraftingProjectAttemptHistory(attempts);

  return (
    <section
      className="overflow-hidden rounded-md border border-primary/30 bg-[radial-gradient(circle_at_top_left,hsl(42 92% 55% / 0.08),transparent_38%)]"
      data-testid="crafting-expert-blueprint"
      data-status={blueprint.status}
      aria-labelledby="crafting-expert-blueprint-title"
    >
      <div className={`border-b px-4 py-3 ${STATUS_STYLE[blueprint.status]}`}>
        <p className="text-xs font-semibold opacity-75">
          {blueprint.eyebrow}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <h4 id="crafting-expert-blueprint-title" className="text-lg font-semibold">
            {blueprint.headline}
          </h4>
          <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px]">
            <span className="rounded-full border border-current/25 px-2 py-0.5">
              {t.phaseChip(t.phase[blueprint.projectPhase])}
            </span>
            {blueprint.budgetLabel && (
              <span className="rounded-full border border-current/25 px-2 py-0.5">
                {t.capChip(blueprint.budgetLabel)}
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs opacity-85">{blueprint.nextAction}</p>
      </div>

      {showContract && (
        <div className="grid gap-px bg-border/50 sm:grid-cols-3" aria-label={t.contractAria}>
          <ContractCell
            label={t.wantedResult}
            value={blueprint.objective ?? t.pendingGoal}
            empty={blueprint.objective === null}
          />
          <ContractCell
            label={t.dontSacrifice}
            value={protectedSummary}
            empty={blueprint.protectedLines.length === 0}
          />
          <ContractCell
            label={t.stopWhen}
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
          <span className="text-xs font-semibold opacity-70">
            {t.baseDecision}
          </span>
          <strong className="mt-1 block text-sm">{blueprint.baseDecision.label}</strong>
          <p className="mt-1 text-xs leading-relaxed opacity-85">{blueprint.baseDecision.detail}</p>
        </section>

        <section data-testid="crafting-project-branches" aria-labelledby="crafting-project-branches-title">
          <div className="flex items-center justify-between gap-2">
            <strong id="crafting-project-branches-title" className="text-sm">{t.resultMap}</strong>
            <span className="text-[11px] text-muted-foreground">{t.recalculates}</span>
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
              <p className="text-xs font-semibold text-primary/75">
                {t.projectMemory}
              </p>
              <strong id="crafting-project-history-title" className="text-sm">
                {t.attemptsSaved(attempts.length)}
              </strong>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {attemptHistory.previous.length > 0 ? t.recentFour : t.allVisible}
            </span>
          </div>
          <ol
            className="mt-2 grid gap-2 sm:grid-cols-2"
            data-testid="crafting-project-recent-attempts"
          >
            {attemptHistory.recent.map((entry) => (
              <ProjectAttemptCard key={entry.attempt.sessionId} entry={entry} />
            ))}
          </ol>
          {attemptHistory.previous.length > 0 && (
            <details
              className="mt-2 rounded border border-border/70 bg-background/35 px-3 py-2"
              data-testid="crafting-project-older-attempts"
            >
              <summary className="cursor-pointer select-none text-xs font-medium text-foreground hover:text-primary">
                {t.seeOlder(attemptHistory.previous.length)}
              </summary>
              <ol
                className="mt-2 grid gap-2 border-t border-border/60 pt-2 sm:grid-cols-2"
                data-testid="crafting-project-previous-attempts"
              >
                {attemptHistory.previous.map((entry) => (
                  <ProjectAttemptCard key={entry.attempt.sessionId} entry={entry} />
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

      {blueprint.routes.length > 0 && (
        <div className="p-3" data-testid="crafting-route-comparison">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">{t.routesTitle}</strong>
            <span className="text-[11px] text-muted-foreground">
              {blueprint.recommendedRouteId ? t.safeOrder : t.noWinner}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {blueprint.routes.map((route) => {
              const patchBlocked = unavailableRoutes.has(route.id);
              return (
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
                      <span className="ml-2 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {t.first}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-semibold">
                    {patchBlocked
                      ? t.underReview
                      : route.availability === "legal"
                        ? t.risk[route.risk]
                        : t.tooltipMissing}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/90">{route.consequence}</p>
                <details className="mt-2 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium hover:text-foreground">
                    {t.keepsAndRisks}
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
                  disabled={simulation || patchBlocked || disabled || blueprint.status !== "ready"}
                  onClick={() => onChooseRoute(route)}
                >
                  {simulation
                    ? t.demoOnly
                    : patchBlocked
                    ? t.waitingPatch
                    : blueprint.status === "already-complete"
                    ? t.stopReached
                    : route.availability === "legal"
                      ? t.prepare(route.label)
                      : t.evaluate(route.label)}
                </Button>
              </article>
              );
            })}
          </div>
        </div>
      )}

      <details className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium hover:text-foreground">
          {t.planLimits}
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
