import { useState } from "react";
import {
  craftingCurrencyLabel,
  evaluateObservedCraftingActions,
  type CraftingCurrencyVariant,
  type StartCraftingDecision,
} from "@shared/craftingActions.js";
import type { StartAlloyDecision } from "@shared/craftingAlloys.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import {
  buildCraftingRoute,
  type CraftingRouteAction,
} from "@shared/craftingRoute.js";
import {
  ESSENCE_MECHANIC_SOURCE,
  ESSENCE_TIER_LABELS,
  evaluateEssencePlan,
  type EssencePlanInput,
  type EssenceTier,
  type StartEssenceDecision,
} from "@shared/craftingEssences.js";
import type { Item } from "@shared/domain.js";
import { AlloyPlanner } from "@/components/AlloyPlanner";
import { CraftingGoalPicker } from "@/components/CraftingGoalPicker";
import { CraftingProtectionPicker } from "@/components/CraftingProtectionPicker";
import type { CraftingGoalCategory } from "@shared/craftingGoal.js";
import { evaluateCraftingProtection } from "@shared/craftingProtection.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCraftingKnowledge } from "@/hooks/useCraftingKnowledge";
import { buildCraftingMentorReading } from "@/lib/craftingMentorReading";

const CRAFTING_STATE_STYLE = {
  complete: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  blocked: "border-rose-500/40 bg-rose-500/10 text-rose-300",
} as const;

const ACTION_STATUS = {
  compatible: {
    label: "Compatible con la estructura",
    style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  blocked: {
    label: "Bloqueada",
    style: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  "needs-data": {
    label: "Faltan datos",
    style: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
} as const;

type CraftingTool = "currency" | "essence" | "alloy";

function useProtectedModifiers(item: Item) {
  const [selection, setSelection] = useState<{ itemId: string; ids: string[] }>({
    itemId: item.id,
    ids: [],
  });
  const currentIds = new Set(
    item.modifiers
      .filter((modifier) => modifier.kind === "explicit")
      .map((modifier) => modifier.id),
  );
  const value =
    selection.itemId === item.id
      ? selection.ids.filter((id) => currentIds.has(id))
      : [];

  return [
    value,
    (ids: string[]) => setSelection({ itemId: item.id, ids }),
  ] as const;
}

const CRAFTING_TOOLS: Array<{
  id: CraftingTool;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: "currency",
    label: "Monedas",
    eyebrow: "Paso básico",
    description: "Transmutación, Aumento, Regio y Exaltado.",
  },
  {
    id: "essence",
    label: "Essences",
    eyebrow: "Mod garantizado",
    description: "Añade un efecto conocido y comprueba el reemplazo.",
  },
  {
    id: "alloy",
    label: "Alloys",
    eyebrow: "Fabricación",
    description: "Reemplaza un mod por uno fabricado del tooltip.",
  },
];

export interface CraftingActionPlannerProps {
  item: Item;
  patch?: string;
  onStartCraftingDecision?: StartCraftingDecision;
  onStartEssenceDecision?: StartEssenceDecision;
  onStartAlloyDecision?: StartAlloyDecision;
  onUpdateItem?: () => void;
  showStatusLabel?: boolean;
  /** Se ejecuta únicamente cuando la sesión quedó creada. */
  onStarted?: () => void;
}

/** Diagnóstico y preflight compartidos por el detalle y la pestaña Crafting. */
export function CraftingActionPlanner({
  item,
  patch = "",
  onStartCraftingDecision,
  onStartEssenceDecision,
  onStartAlloyDecision,
  onUpdateItem,
  showStatusLabel = true,
  onStarted,
}: CraftingActionPlannerProps) {
  const crafting = diagnoseCraftingItem(item);
  const knowledge = useCraftingKnowledge(item, patch);
  const craftingActions = evaluateObservedCraftingActions(
    item,
    knowledge.data?.actions ?? [],
  );
  const [preparedActionId, setPreparedActionId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] =
    useState<CraftingCurrencyVariant["id"]>("base");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [goalCategory, setGoalCategory] = useState<CraftingGoalCategory>("other");
  const [preflightConfirmed, setPreflightConfirmed] = useState(false);
  const [startingDecision, setStartingDecision] = useState(false);
  const [activeTool, setActiveTool] = useState<CraftingTool>("currency");
  const [showUnavailableActions, setShowUnavailableActions] = useState(false);
  const compatibleActionCount = craftingActions.filter(
    (entry) => entry.status === "compatible",
  ).length;
  const unavailableActionCount = craftingActions.length - compatibleActionCount;
  const route = buildCraftingRoute(item, crafting, craftingActions);
  const resetCurrencyPreflight = () => {
    setPreflightConfirmed(false);
  };
  const revealRouteTarget = (targetId: string) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      target.focus({ preventScroll: true });
    });
  };
  const prepareCurrencyAction = (action: CraftingRouteAction) => {
    const evaluation = craftingActions.find((entry) => entry.action.id === action.id);
    if (!evaluation || evaluation.status !== "compatible") return;
    setActiveTool("currency");
    setPreparedActionId(action.id);
    setSelectedVariantId(evaluation.action.variants[0]?.id ?? "base");
    resetCurrencyPreflight();
    revealRouteTarget(`crafting-action-${item.id}-${action.id}`);
  };
  const openTool = (tool: "essence" | "alloy") => {
    setActiveTool(tool);
    revealRouteTarget(`crafting-tool-content-${item.id}-${tool}`);
  };
  const confirmationReady =
    desiredOutcome.trim().length >= 3 &&
    preflightConfirmed;
  const mentorReading = buildCraftingMentorReading(item, crafting, goalCategory);
  const verdictTone =
    mentorReading.verdict === "controlled-test"
      ? "text-emerald-200"
      : mentorReading.verdict === "define"
        ? "text-sky-200"
        : "text-amber-200";
  const diagnosisHeadline =
    crafting.state === "complete" && item.rarity === "normal"
      ? "Objeto normal · sin modificadores explícitos"
      : crafting.unclassifiedExplicitCount > 0
      ? `${crafting.unclassifiedExplicitCount} modificador${
          crafting.unclassifiedExplicitCount === 1 ? "" : "es"
        } sin clasificar`
      : crafting.state === "complete"
        ? `${crafting.prefixCount} prefijo${crafting.prefixCount === 1 ? "" : "s"} · ${
            crafting.suffixCount
          } sufijo${crafting.suffixCount === 1 ? "" : "s"} · ${
            crafting.observedOpenSlots ?? 0
          } hueco${crafting.observedOpenSlots === 1 ? "" : "s"} total${
            crafting.observedOpenSlots === 1 ? "" : "es"
          }`
        : "Faltan datos para leer esta pieza";
  const evidenceCount =
    crafting.blockers.length +
    crafting.limitations.length +
    (knowledge.data?.modPool.reasons.length ?? 0) +
    (knowledge.data?.modPool.limitations.length ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <section
        className="flex flex-col gap-3 rounded-md border border-border bg-muted/15 p-4"
        data-testid="crafting-diagnosis"
        aria-labelledby={`crafting-diagnosis-title-${item.id}`}
      >
        {showStatusLabel && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`crafting-diagnosis-title-${item.id}`} className="text-sm font-medium text-foreground">
              Estado de la pieza
            </h3>
            <Badge variant="outline" className={CRAFTING_STATE_STYLE[crafting.state]}>
              {crafting.label}
            </Badge>
          </div>
        )}
        {!showStatusLabel && (
          <h3 id={`crafting-diagnosis-title-${item.id}`} className="sr-only">
            Estado de la pieza
          </h3>
        )}
        <p className="text-lg font-semibold text-foreground">{diagnosisHeadline}</p>
        <CraftingGoalPicker
          category={goalCategory}
          onCategoryChange={setGoalCategory}
          outcome={desiredOutcome}
          onOutcomeChange={setDesiredOutcome}
          idPrefix={`crafting-goal-${item.id}`}
          label="¿Qué quieres conseguir?"
          placeholder="Ej.: más daño físico sin perder velocidad"
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="crafting-mentor-reading">
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">¿Compensa seguir?</span>
            <strong className={verdictTone}>{mentorReading.verdictLabel}</strong>
            <span>{mentorReading.verdictDetail}</span>
          </div>
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">A favor</span>
            <strong>{mentorReading.matchingModifiers.length}</strong>
            <span>
              {mentorReading.matchingModifiers[0]?.text ??
                (goalCategory === "other" ? "Elige una categoría" : "Ningún tag directo")}
            </span>
          </div>
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">Sin señal directa</span>
            <strong>{mentorReading.unmatchedModifiers.length}</strong>
            <span>
              {mentorReading.unmatchedModifiers[0]?.text ??
                (goalCategory === "other" ? "Pendiente del objetivo" : "Nada señalado")}
            </span>
          </div>
          <div className="crafting-signal-card">
            <span className="crafting-signal-label">Candidatos a conservar</span>
            <strong>{mentorReading.protectCandidates.length}</strong>
            <span>{mentorReading.protectCandidates[0]?.text ?? "No hay grados 1–2 observados"}</span>
          </div>
        </div>
        <div
          className="rounded-sm border-l-2 border-primary bg-primary/[0.06] px-3 py-3"
          data-testid="crafting-route"
          data-route-state={route.state}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75">
            {route.eyebrow}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{route.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{route.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {route.currencyActions.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant={route.currencyActions.length === 1 ? "default" : "outline"}
                onClick={() => prepareCurrencyAction(action)}
              >
                {route.currencyActions.length === 1 ? "Preparar " : "Elegir "}
                {action.label}
              </Button>
            ))}
            {route.toolSuggestions.includes("essence") && (
              <Button type="button" size="sm" variant="outline" onClick={() => openTool("essence")}>
                Revisar una Essence
              </Button>
            )}
            {route.toolSuggestions.includes("alloy") && (
              <Button type="button" size="sm" variant="outline" onClick={() => openTool("alloy")}>
                Revisar un Alloy
              </Button>
            )}
            {route.state === "needs-data" && onUpdateItem && (
              <Button type="button" size="sm" variant="outline" onClick={onUpdateItem}>
                Pegar el objeto de nuevo
              </Button>
            )}
          </div>
        </div>
        <div
          className="flex flex-wrap gap-2 text-[11px]"
          data-testid="crafting-knowledge-status"
          aria-live="polite"
        >
          {knowledge.loading ? (
            <span className="text-muted-foreground">Verificando conocimiento…</span>
          ) : knowledge.error ? (
            <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-rose-200">
              Conocimiento no disponible
            </span>
          ) : knowledge.data ? (
            <>
              <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                {knowledge.data.actions.length} reglas verificadas
              </span>
              {knowledge.data.modPool.probabilityBasis === "insufficient" && (
                <span className="rounded-full border border-amber-500/35 bg-amber-500/[0.07] px-2 py-1 text-amber-200">
                  Sin probabilidades verificables
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Sin conocimiento cargado</span>
          )}
        </div>
        <details className="group text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
            Ver evidencia y límites ({evidenceCount})
          </summary>
          <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
            <p>{crafting.summary}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div>
                <dt>Explícitos registrados</dt>
                <dd className="font-medium text-foreground">{crafting.explicitCount}</dd>
              </div>
              <div>
                <dt>Prefijos</dt>
                <dd className="font-medium text-foreground">
                  {crafting.state === "complete" ? crafting.prefixCount : "Sin determinar"}
                </dd>
              </div>
              <div>
                <dt>Sufijos</dt>
                <dd className="font-medium text-foreground">
                  {crafting.state === "complete" ? crafting.suffixCount : "Sin determinar"}
                </dd>
              </div>
              <div>
                <dt>Huecos totales</dt>
                <dd className="font-medium text-foreground">
                  {crafting.state === "complete"
                    ? (crafting.observedOpenSlots ?? "Desconocido")
                    : "Pendiente"}
                </dd>
              </div>
            </dl>
            {crafting.blockers.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-amber-200">
                {crafting.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
            <ul className="list-inside list-disc space-y-1">
            {crafting.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
            </ul>
            {knowledge.error && <p className="text-rose-200">{knowledge.error}</p>}
            {knowledge.data && (
              <div className="space-y-2 border-t border-border/70 pt-3">
                <p>
                  Conocimiento utilizado: {knowledge.data.actions.length} acciones · corte de
                  datos {knowledge.data.asOf}.
                </p>
                {knowledge.data.modPool.probabilityBasis === "insufficient" && (
                  <>
                    <p className="font-medium text-amber-200">
                      Sin datos completos para calcular probabilidades.
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      {[
                        ...knowledge.data.modPool.reasons,
                        ...knowledge.data.modPool.limitations,
                      ].slice(0, 4).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </details>
      </section>

      <section aria-labelledby={`crafting-tools-title-${item.id}`}>
        <h3 id={`crafting-tools-title-${item.id}`} className="mb-2 text-sm font-semibold">
          ¿Con qué vas a intentarlo?
        </h3>
        <div
          className="grid gap-2 sm:grid-cols-3"
          role="tablist"
          aria-label="Herramientas de crafting"
        >
          {CRAFTING_TOOLS.map((tool) => {
            const selected = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`crafting-tool-${tool.id}`}
                className={`group min-h-16 rounded-md border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary/70 bg-primary/[0.11] shadow-[0_0_24px_-16px_hsl(var(--primary))]"
                    : "border-border/70 bg-muted/10 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/25"
                }`}
                onClick={() => setActiveTool(tool.id)}
              >
                <span className="block font-semibold text-foreground">{tool.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {tool.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        hidden={activeTool !== "currency"}
        style={activeTool !== "currency" ? { display: "none" } : undefined}
        className="flex flex-col gap-4"
        data-testid="crafting-tool-panel-currency"
      >
      <section
        hidden={route.currencyActions.length > 0 && preparedActionId === null}
        style={
          route.currencyActions.length > 0 && preparedActionId === null
            ? { display: "none" }
            : undefined
        }
        className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3"
        data-testid="crafting-actions"
        aria-labelledby={`crafting-actions-title-${item.id}`}
      >
        <div>
          <h3 id={`crafting-actions-title-${item.id}`} className="font-medium text-foreground">
            Monedas disponibles
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            La app solo habilita acciones compatibles con los datos que has pegado.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {!knowledge.loading && !knowledge.error && craftingActions.length === 0 && (
            <p className="rounded border border-border p-3 text-xs text-muted-foreground">
              El registro no contiene acciones compatibles con este módulo.
            </p>
          )}
          {compatibleActionCount > 0 && unavailableActionCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setShowUnavailableActions((visible) => !visible)}
            >
              {showUnavailableActions
                ? "Ocultar acciones no aplicables"
                : `Ver acciones no aplicables (${unavailableActionCount})`}
            </Button>
          )}
          {craftingActions.map((entry) => {
            const status = ACTION_STATUS[entry.status];
            const unavailable = entry.status !== "compatible";
            const selectedVariant =
              entry.action.variants.find((variant) => variant.id === selectedVariantId) ??
              entry.action.variants[0];
            return (
              <details
                key={entry.action.id}
                id={`crafting-action-${item.id}-${entry.action.id}`}
                tabIndex={-1}
                hidden={compatibleActionCount > 0 && unavailable && !showUnavailableActions}
                open={
                  entry.status === "compatible" &&
                  (compatibleActionCount === 1 || preparedActionId === entry.action.id)
                    ? true
                    : undefined
                }
                className="rounded border border-border/70 p-2"
              >
                <summary className="cursor-pointer select-none list-none">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{entry.action.label}</span>
                    <Badge variant="outline" className={status.style}>
                      {status.label}
                    </Badge>
                  </span>
                </summary>
                <div className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
                  <p>{entry.action.effect}</p>
                  <p>
                    <span className="font-medium text-foreground">Evaluación: </span>
                    {entry.reason}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {entry.action.variants.map((variant) => (
                      <span key={variant.id} className="rounded border border-border px-1.5 py-0.5">
                        {variant.label}: {variant.minimumModifierLevel === null
                          ? "mínimo no mostrado"
                          : `nivel mínimo de modificador ${variant.minimumModifierLevel}`}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px]">{entry.action.evidence}</p>
                  {entry.status === "compatible" && onStartCraftingDecision &&
                    (preparedActionId === entry.action.id ? (
                      <form
                        className="mt-1 flex flex-col gap-3 rounded border border-primary/30 bg-primary/5 p-3"
                        data-testid={`crafting-preflight-${entry.action.id}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!confirmationReady || startingDecision || !selectedVariant) return;
                          setStartingDecision(true);
                          void onStartCraftingDecision(
                            item,
                            entry.action,
                            selectedVariant,
                            {
                              desiredOutcome: desiredOutcome.trim(),
                              goalCategory,
                              protectedModifierIds: [],
                            },
                          )
                            .then((started) => {
                              if (started) onStarted?.();
                            })
                            .finally(() => setStartingDecision(false));
                        }}
                      >
                        <fieldset className="space-y-2">
                          <legend className="font-medium text-foreground">
                            Variante exacta que vas a usar
                          </legend>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {entry.action.variants.map((variant) => {
                              const currencyName = craftingCurrencyLabel(entry.action, variant);
                              return (
                                <label
                                  key={variant.id}
                                  className={`flex cursor-pointer flex-col gap-1 rounded border p-2 ${
                                    selectedVariant?.id === variant.id
                                      ? "border-primary/60 bg-primary/10"
                                      : "border-border bg-background/40"
                                  }`}
                                >
                                  <span className="flex items-center gap-2 font-medium text-foreground">
                                    <input
                                      type="radio"
                                      name={`crafting-variant-${item.id}-${entry.action.id}`}
                                      value={variant.id}
                                      checked={selectedVariant?.id === variant.id}
                                      onChange={() => setSelectedVariantId(variant.id)}
                                    />
                                    {variant.label}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {variant.minimumModifierLevel === null
                                      ? "El tooltip observado no muestra un mínimo."
                                      : `Nivel mínimo de modificador observado: ${variant.minimumModifierLevel}.`}
                                  </span>
                                  <span className="sr-only">{currencyName}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Este mínimo reproduce el tooltip observado; no garantiza un afijo concreto ni su probabilidad.
                          </p>
                        </fieldset>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={preflightConfirmed}
                            onChange={(event) => setPreflightConfirmed(event.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            El objeto sigue igual, aún no gasté la moneda y acepto que el resultado es aleatorio.
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm" disabled={!confirmationReady || startingDecision}>
                            {startingDecision ? "Preparando…" : "Preparar este craft"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={startingDecision}
                            onClick={() => setPreparedActionId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPreparedActionId(entry.action.id);
                            setSelectedVariantId(entry.action.variants[0]?.id ?? "base");
                            resetCurrencyPreflight();
                          }}
                        >
                          Elegir esta acción
                        </Button>
                      </div>
                    ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      </div>

      <div
        id={`crafting-tool-content-${item.id}-essence`}
        tabIndex={-1}
        hidden={activeTool !== "essence"}
        style={activeTool !== "essence" ? { display: "none" } : undefined}
        data-testid="crafting-tool-panel-essence"
      >
        <EssencePlanner
          item={item}
          onStart={onStartEssenceDecision}
          onStarted={onStarted}
        />
      </div>
      <div
        id={`crafting-tool-content-${item.id}-alloy`}
        tabIndex={-1}
        hidden={activeTool !== "alloy"}
        style={activeTool !== "alloy" ? { display: "none" } : undefined}
        data-testid="crafting-tool-panel-alloy"
      >
        <AlloyPlanner
          item={item}
          onStart={onStartAlloyDecision}
          onStarted={onStarted}
        />
      </div>
    </div>
  );
}

interface EssencePlannerProps {
  item: Item;
  onStart?: StartEssenceDecision;
  onStarted?: () => void;
}

function EssencePlanner({ item, onStart, onStarted }: EssencePlannerProps) {
  const [tier, setTier] = useState<EssenceTier>(item.rarity === "magic" ? "normal" : "perfect");
  const [essenceName, setEssenceName] = useState("");
  const [guaranteedModifierText, setGuaranteedModifierText] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [goalCategory, setGoalCategory] = useState<CraftingGoalCategory>("other");
  const [protectedModifierIds, setProtectedModifierIds] = useProtectedModifiers(item);
  const [snapshotConfirmed, setSnapshotConfirmed] = useState(false);
  const [tooltipConfirmed, setTooltipConfirmed] = useState(false);
  const [randomRemovalConfirmed, setRandomRemovalConfirmed] = useState(false);
  const [notSpentConfirmed, setNotSpentConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const plan: EssencePlanInput = { tier, essenceName, guaranteedModifierText };
  const evaluation = evaluateEssencePlan(item, plan);
  const protection = evaluateCraftingProtection({
    item,
    protectedModifierIds,
    removedModifierCount: evaluation.randomRemoval ? 1 : 0,
    removalSelection: evaluation.randomRemoval ? "random" : "none",
  });
  const status = ACTION_STATUS[evaluation.status];
  const ready =
    evaluation.status === "compatible" &&
    desiredOutcome.trim().length >= 3 &&
    snapshotConfirmed &&
    tooltipConfirmed &&
    notSpentConfirmed &&
    protection.status !== "blocked" &&
    protection.status !== "needs-data" &&
    (!evaluation.randomRemoval || randomRemovalConfirmed);

  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-violet-500/25 bg-violet-500/[0.035] p-3"
      data-testid="crafting-essences"
      aria-labelledby={`crafting-essences-title-${item.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
            Mecánica guiada P1
          </p>
          <h3 id={`crafting-essences-title-${item.id}`} className="mt-1 font-medium text-foreground">
            Essences
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Introduce la Essence real que tienes delante. El asesor valida el tipo de operación y
            prepara una comparación antes/después; no adivina el efecto por su nombre.
          </p>
        </div>
        <Badge variant="outline" className={status.style}>{status.label}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`essence-tier-${item.id}`} className="text-xs font-medium text-foreground">
            Tipo de Essence
          </label>
          <select
            id={`essence-tier-${item.id}`}
            value={tier}
            onChange={(event) => {
              setTier(event.target.value as EssenceTier);
              setRandomRemovalConfirmed(false);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {(Object.entries(ESSENCE_TIER_LABELS) as [EssenceTier, string][]).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`essence-name-${item.id}`} className="text-xs font-medium text-foreground">
            Nombre exacto
          </label>
          <input
            id={`essence-name-${item.id}`}
            value={essenceName}
            onChange={(event) => setEssenceName(event.target.value)}
            maxLength={120}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            placeholder="Ej.: Essence of…"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`essence-effect-${item.id}`} className="text-xs font-medium text-foreground">
          Efecto garantizado exacto del tooltip
        </label>
        <textarea
          id={`essence-effect-${item.id}`}
          value={guaranteedModifierText}
          onChange={(event) => setGuaranteedModifierText(event.target.value)}
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          placeholder="Copia únicamente lo que la Essence declara que añadirá a este tipo de objeto"
        />
      </div>

      {evaluation.randomRemoval && (
        <CraftingProtectionPicker
          item={item}
          value={protectedModifierIds}
          onChange={setProtectedModifierIds}
          idPrefix={`essence-protected-${item.id}`}
        />
      )}

      {evaluation.randomRemoval && protectedModifierIds.length > 0 && (
        <div
          className={`rounded border p-3 text-xs ${
            protection.status === "blocked"
              ? "border-rose-500/40 bg-rose-500/[0.08] text-rose-100"
              : protection.status === "warning"
                ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-100"
                : "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100"
          }`}
          data-protection-risk={protection.risk}
        >
          <p className="font-medium">Protección del snapshot</p>
          <p className="mt-1">{protection.reason}</p>
        </div>
      )}

      <div className={`rounded border p-3 text-xs ${
        evaluation.randomRemoval
          ? "border-rose-500/35 bg-rose-500/[0.07]"
          : "border-border bg-background/35"
      }`}>
        <p className="font-medium text-foreground">
          {evaluation.operation === "magic-to-rare"
            ? "Mágico → raro, conservando lo existente"
            : "Raro → raro, reemplazando 1 modificador al azar"}
        </p>
        <p className="mt-1 text-muted-foreground">{evaluation.reason}</p>
        {evaluation.randomRemoval && (
          <p className="mt-2 font-medium text-rose-200">
            No elijas qué modificador desaparece: cualquiera de los explícitos actuales está en riesgo.
          </p>
        )}
      </div>

      <CraftingGoalPicker
        category={goalCategory}
        onCategoryChange={setGoalCategory}
        outcome={desiredOutcome}
        onOutcomeChange={setDesiredOutcome}
        idPrefix={`essence-goal-${item.id}`}
        label="¿Qué quieres conseguir con este paso?"
        placeholder="Ej.: añadir el mod garantizado sin perder mi prefijo principal"
      />

      <div className="space-y-2 text-xs text-muted-foreground">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={snapshotConfirmed} onChange={(event) => setSnapshotConfirmed(event.target.checked)} className="mt-0.5" />
          <span>Confirmo que el objeto sigue igual que el snapshot importado.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={tooltipConfirmed} onChange={(event) => setTooltipConfirmed(event.target.checked)} className="mt-0.5" />
          <span>He copiado el nombre y el efecto desde la Essence que voy a usar, no desde una guía antigua.</span>
        </label>
        {evaluation.randomRemoval && (
          <label className="flex items-start gap-2 text-rose-100">
            <input type="checkbox" checked={randomRemovalConfirmed} onChange={(event) => setRandomRemovalConfirmed(event.target.checked)} className="mt-0.5" />
            <span>Acepto que se retirará al azar un modificador explícito actual.</span>
          </label>
        )}
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={notSpentConfirmed} onChange={(event) => setNotSpentConfirmed(event.target.checked)} className="mt-0.5" />
          <span>Confirmo que todavía no he aplicado la Essence.</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!ready || starting || !onStart}
          onClick={() => {
            if (!ready || !onStart) return;
            setStarting(true);
            void onStart(item, plan, evaluation, {
              desiredOutcome: desiredOutcome.trim(),
              goalCategory,
              protectedModifierIds: evaluation.randomRemoval ? protectedModifierIds : [],
            })
              .then((started) => {
                if (started) onStarted?.();
              })
              .finally(() => setStarting(false));
          }}
        >
          {starting ? "Preparando…" : "Crear comprobación de Essence"}
        </Button>
        {!onStart && (
          <span className="text-xs text-muted-foreground">
            Abre la pestaña Crafting para iniciar una comprobación persistente.
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Regla estructural verificada desde el parche {ESSENCE_MECHANIC_SOURCE.appliesFrom}: {" "}
        <a className="underline underline-offset-2" href={ESSENCE_MECHANIC_SOURCE.url} target="_blank" rel="noreferrer">
          notas oficiales de GGG
        </a>. La tabla exhaustiva de efectos por Essence y tipo de objeto no está incorporada.
      </p>
    </section>
  );
}
