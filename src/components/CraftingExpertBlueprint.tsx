import type { ReactNode } from "react";
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
      controlled: "Solo añade",
      "stage-change": "Cambia la rareza",
      replacement: "Quita una línea",
    } as Record<ExpertCraftingRouteCandidate["risk"], string>,
    attempt: {
      success: "Objetivo alcanzado",
      salvage: "Resultado aprovechable",
      failure: "Ruta agotada",
    } as Record<CraftingProjectAttempt["branch"], string>,
    noDate: "Fecha no disponible",
    attemptHeader: (number: number, action: string) => `Intento ${number} · ${action}`,
    protectedLost: "Se perdió una línea protegida.",
    capChip: (budget: string) => `Tope · ${budget}`,
    nextStep: "Siguiente paso",
    ifYouGoOn: "Si decides seguir",
    nothingNowEyebrow: "Por ahora, nada",
    nothingNowTitle: "Ahora mismo no hay nada que hacerle a esta pieza",
    nothingNowDetail: "Lo único que podría cambiarla está en revisión para este parche. Mejor guárdala como está.",
    lastSaidStop: (title: string) =>
      `En tu último intento te recomendé parar («${title}»). Si aun así sigues, este es el paso.`,
    moreDetails: "Más detalles",
    notApplicable: "Monedas que esta pieza no admite ahora",
    insideGame: "Dentro de PoE2:",
    useOn: (label: string, item: string) => `usa un ${label} sobre «${item}».`,
    whatCanHappen: "Qué puede pasar después",
    projectMemory: "Lo que llevas hecho",
    attemptsSaved: (count: number) => `${count} ${count === 1 ? "intento registrado" : "intentos registrados"}`,
    recentFour: "4 recientes",
    allVisible: "Todos visibles",
    seeOlder: (count: number) => `Ver ${count} ${count === 1 ? "intento anterior" : "intentos anteriores"}`,
    otherOptions: (count: number) => `Otras opciones (${count})`,
    yourOptions: "Tus opciones",
    recommended: "Recomendada",
    underReview: "En revisión",
    needsReading: "Hay que leerla antes",
    keepsAndRisks: "Qué conserva y qué arriesga",
    demoOnly: "Solo demostración",
    waitingPatch: "Esperando revisión del parche",
    useInstead: (label: string) => `Usar ${label}`,
    lookAt: (label: string) => `Mirar ${label}`,
    planLimits: "Lo que no calculo",
  },
  {
    risk: {
      controlled: "Only adds",
      "stage-change": "Changes rarity",
      replacement: "Removes a line",
    },
    attempt: {
      success: "Goal reached",
      salvage: "Usable result",
      failure: "Route used up",
    },
    noDate: "Date not available",
    attemptHeader: (number: number, action: string) => `Attempt ${number} · ${action}`,
    protectedLost: "A protected line was lost.",
    capChip: (budget: string) => `Cap · ${budget}`,
    nextStep: "Next step",
    ifYouGoOn: "If you decide to go on",
    nothingNowEyebrow: "Nothing for now",
    nothingNowTitle: "Right now there's nothing to do to this item",
    nothingNowDetail: "The only things that could change it are under review for this patch. Better keep it as it is.",
    lastSaidStop: (title: string) =>
      `On your last attempt I advised you to stop (“${title}”). If you go on anyway, this is the step.`,
    moreDetails: "More details",
    notApplicable: "Currencies this item doesn't take right now",
    insideGame: "In PoE2:",
    useOn: (label: string, item: string) => `use one ${label} on “${item}”.`,
    whatCanHappen: "What can happen next",
    projectMemory: "What you've done so far",
    attemptsSaved: (count: number) => `${count} ${count === 1 ? "attempt saved" : "attempts saved"}`,
    recentFour: "4 most recent",
    allVisible: "All shown",
    seeOlder: (count: number) => `See ${count} ${count === 1 ? "earlier attempt" : "earlier attempts"}`,
    otherOptions: (count: number) => `Other options (${count})`,
    yourOptions: "Your options",
    recommended: "Recommended",
    underReview: "Under review",
    needsReading: "Needs reading first",
    keepsAndRisks: "What it keeps and what it risks",
    demoOnly: "Demo only",
    waitingPatch: "Waiting for the patch review",
    useInstead: (label: string) => `Use ${label}`,
    lookAt: (label: string) => `Look at ${label}`,
    planLimits: "What I don't work out",
  },
);

const ATTEMPT_STYLE: Record<CraftingProjectAttempt["branch"], string> = {
  success: "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100",
  salvage: "border-primary/35 bg-primary/[0.07] text-primary",
  failure: "border-rose-500/35 bg-rose-500/[0.06] text-rose-100",
};

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

/**
 * La respuesta del Taller avanzado: la siguiente moneda y qué hacer con ella
 * dentro del juego. Todo lo demás (qué puede pasar, otras opciones, lo que no
 * se calcula) queda plegado debajo para no competir con esa respuesta.
 */
export function CraftingExpertBlueprint({
  blueprint,
  itemName,
  attempts = [],
  simulation = false,
  unavailableRouteIds = [],
  selectedRouteId = null,
  unavailableActions = [],
  onChooseRoute,
  children,
}: {
  blueprint: ExpertCraftingBlueprint;
  /** Nombre que el jugador ve en el juego: la instrucción lo cita. */
  itemName: string;
  attempts?: CraftingProjectAttempt[];
  /** Enseña la lectura sin ofrecer preparar una acción sobre un objeto ficticio. */
  simulation?: boolean;
  /** Rutas conocidas cuya mecánica aún no está autorizada para el parche. */
  unavailableRouteIds?: readonly ExpertCraftingRouteCandidate["id"][];
  /** Moneda que el jugador eligió en vez de la recomendada. */
  selectedRouteId?: ExpertCraftingRouteCandidate["id"] | null;
  /** Monedas que esta pieza no admite ahora, con su motivo. */
  unavailableActions?: ReadonlyArray<{ label: string; reason: string }>;
  onChooseRoute: (route: ExpertCraftingRouteCandidate) => void;
  /** Confirmación para empezar con la moneda de la respuesta. */
  children?: ReactNode;
}) {
  const t = useText(TEXT);
  const unavailableRoutes = new Set(unavailableRouteIds);
  const attemptHistory = splitCraftingProjectAttemptHistory(attempts);
  const ready = blueprint.status === "ready";
  // Solo una moneda puede ser «la respuesta»: Essence y Alloy abren su propio
  // panel porque antes hay que leer su descripción en el juego.
  const currencyRoutes = ready
    ? blueprint.routes.filter((route) => route.availability === "legal")
    : [];
  const answer =
    currencyRoutes.find((route) => route.id === selectedRouteId) ??
    currencyRoutes.find((route) => route.recommended) ??
    null;
  const otherRoutes = ready ? blueprint.routes.filter((route) => route !== answer) : [];
  // La comparación del último resultado pudo aconsejar parar. La tarjeta sigue
  // diciendo cuál sería el paso, pero no lo presenta como si nada.
  const lastAttempt = attempts.at(-1) ?? null;
  const lastSaidStop =
    answer !== null && lastAttempt !== null && lastAttempt.decisionKind === "stop";
  // Si todo lo que queda está pendiente de revisar para el parche, no hay
  // nada que elegir: se dice así en vez de ofrecer opciones apagadas.
  const allBlocked =
    !answer && otherRoutes.length > 0 && otherRoutes.every((route) => unavailableRoutes.has(route.id));
  // Con la pieza llena o sin salida hay algo más que decir que «elige»; en el
  // resto de estados la cabecera ya lo cuenta todo.
  const showBaseDecision =
    ready &&
    (blueprint.baseDecision.kind === "recover" || blueprint.baseDecision.kind === "change-base");

  const routeCards = (
    <div className="grid gap-2 sm:grid-cols-2">
      {otherRoutes.map((route) => {
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
                    {t.recommended}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs font-semibold">
                {patchBlocked
                  ? t.underReview
                  : route.availability === "legal"
                    ? t.risk[route.risk]
                    : t.needsReading}
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
              variant="outline"
              disabled={simulation || patchBlocked}
              onClick={() => onChooseRoute(route)}
            >
              {simulation
                ? t.demoOnly
                : patchBlocked
                  ? t.waitingPatch
                  : route.availability === "legal"
                    ? t.useInstead(route.label)
                    : t.lookAt(route.label)}
            </Button>
          </article>
        );
      })}
    </div>
  );

  return (
    <section
      className="overflow-hidden rounded-md border border-primary/30 bg-[radial-gradient(circle_at_top_left,hsl(42 92% 55% / 0.08),transparent_38%)]"
      data-testid="crafting-expert-blueprint"
      data-status={blueprint.status}
      data-decision={blueprint.baseDecision.kind}
      data-answer={answer?.id ?? ""}
      data-all-blocked={allBlocked ? "true" : "false"}
      aria-labelledby="crafting-expert-blueprint-title"
    >
      <div className={`px-4 py-3 ${STATUS_STYLE[blueprint.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold opacity-75">
              {answer
                ? lastSaidStop ? t.ifYouGoOn : t.nextStep
                : allBlocked ? t.nothingNowEyebrow : blueprint.eyebrow}
            </p>
            <h4 id="crafting-expert-blueprint-title" className="mt-1 text-xl font-semibold">
              {answer ? answer.label : allBlocked ? t.nothingNowTitle : blueprint.headline}
            </h4>
          </div>
          {blueprint.budgetLabel && (
            <span className="rounded-full border border-current/25 px-2 py-0.5 text-[11px]">
              {t.capChip(blueprint.budgetLabel)}
            </span>
          )}
        </div>
        {answer ? (
          <div className="mt-2 space-y-2 text-sm" data-testid="crafting-answer">
            {lastSaidStop && lastAttempt && (
              <p
                className="rounded border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-50"
                data-testid="crafting-answer-last-stop"
              >
                {t.lastSaidStop(lastAttempt.decisionTitle)}
              </p>
            )}
            <p>
              <strong>{t.insideGame}</strong> {t.useOn(answer.label, itemName)}
            </p>
            {answer.recommended && answer.recommendationReason && (
              <p className="text-xs opacity-85">{answer.recommendationReason}</p>
            )}
            {/* Con motivo ya explicado, la consecuencia solo se repite si avisa de algo. */}
            {(answer.risk !== "controlled" || !(answer.recommended && answer.recommendationReason)) && (
              <p
                className={`rounded border px-3 py-2 text-xs ${
                  answer.risk === "stage-change"
                    ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-50"
                    : "border-border/70 bg-background/40 text-foreground/90"
                }`}
              >
                {answer.consequence}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{answer.uncertainty}</p>
            {simulation ? (
              <Button type="button" size="sm" disabled>
                {t.demoOnly}
              </Button>
            ) : (
              children
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm opacity-90">
            {allBlocked ? t.nothingNowDetail : blueprint.nextAction}
          </p>
        )}
      </div>

      {showBaseDecision && !allBlocked && (
        <div className="border-t border-border/70 p-3">
          <section
            className={`rounded border p-3 ${BASE_DECISION_STYLE[blueprint.baseDecision.kind]}`}
            data-testid="crafting-project-base-decision"
          >
            <strong className="block text-sm">{blueprint.baseDecision.label}</strong>
            <p className="mt-1 text-xs leading-relaxed opacity-85">{blueprint.baseDecision.detail}</p>
          </section>
        </div>
      )}

      {!answer && otherRoutes.length > 0 && !allBlocked && (
        <div className="border-t border-border/70 p-3" data-testid="crafting-route-comparison">
          <strong className="text-sm">{t.yourOptions}</strong>
          <div className="mt-2">{routeCards}</div>
        </div>
      )}

      {attempts.length > 0 && (
        <section
          className="border-t border-border/70 p-3"
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

      {ready && (
        <details
          className="border-t border-border/70 px-3 py-2 text-xs"
          data-testid="crafting-project-branches"
        >
          <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
            {t.whatCanHappen}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {blueprint.branches.map((branch) => (
              <article key={branch.id} className={`rounded border p-2.5 ${BRANCH_STYLE[branch.id]}`}>
                <strong className="text-xs text-foreground">{branch.label}</strong>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {branch.trigger}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-foreground/90">
                  {branch.response}
                </p>
              </article>
            ))}
          </div>
        </details>
      )}

      {answer && otherRoutes.length > 0 && (
        <details
          className="border-t border-border/70 px-3 py-2 text-xs"
          data-testid="crafting-route-comparison"
        >
          <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
            {t.otherOptions(otherRoutes.length)}
          </summary>
          <div className="mt-2">{routeCards}</div>
        </details>
      )}

      <details
        className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground"
        data-testid="crafting-plan-details"
      >
        <summary className="cursor-pointer select-none text-xs font-medium hover:text-foreground">
          {t.moreDetails}
        </summary>
        {unavailableActions.length > 0 && (
          <div className="mt-2" data-testid="crafting-unavailable-actions">
            <p className="font-medium text-foreground/90">{t.notApplicable}</p>
            <ul className="mt-1 space-y-1">
              {unavailableActions.map((entry) => (
                <li key={entry.label}>
                  <strong className="text-foreground/90">{entry.label}:</strong> {entry.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-2 font-medium text-foreground/90">{t.planLimits}</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          {blueprint.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
