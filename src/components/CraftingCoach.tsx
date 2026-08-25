import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Dices,
  Loader2,
  ShieldAlert,
  Sparkles,
  Swords,
  TriangleAlert,
} from "lucide-react";
import {
  COACH_DIRECTION_LABELS,
  COACH_DIRECTION_NOUNS,
  chooseNextStep,
  interpretCoachGoal,
  readPurposefulCraftResult,
  suggestDirectionFromCharacter,
  type CoachDirection,
  type CoachGoalInterpretation,
  type CoachNextStep,
} from "@shared/craftingCoach.js";
import { hasCraftingCharacterContext } from "@shared/craftingCharacterContext.js";
import {
  COACH_FOCUS_LABELS,
  DAMAGE_COACH_FOCUSES,
  DEFENCE_COACH_FOCUSES,
  type CoachFocus,
} from "@shared/craftingFocus.js";
import {
  compareCraftingResult,
  type CraftingComparison,
  type CraftingComparisonActionId,
} from "@shared/craftingComparison.js";
import type { Budget, CharacterProfile, GoalKind, Item } from "@shared/domain.js";
import { CoachItemCard } from "@/components/CoachItemCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { CURRENCY_LABELS, GOAL_LABELS } from "@/lib/format";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";

export type CoachPhase = "choose" | "recommend" | "hold" | "await-result" | "result";

interface PendingCraftAttempt {
  /** Fotografía exacta tomada antes de que el jugador gaste la moneda. */
  before: Item;
  /** La acción también se congela: no se recalcula desde una pieza que ya cambió. */
  actionId: CraftingComparisonActionId;
}

function snapshotItem(item: Item): Item {
  return {
    ...item,
    modifiers: item.modifiers.map((modifier) => ({
      ...modifier,
      values: [...modifier.values],
      ...(modifier.tags ? { tags: [...modifier.tags] } : {}),
    })),
    ...(item.requirements ? { requirements: { ...item.requirements } } : {}),
    ...(item.craftingState ? { craftingState: { ...item.craftingState } } : {}),
    sources: item.sources.map((source) => ({ ...source })),
  };
}

interface CraftingCoachProps {
  /** Único origen de evidencia sobre el personaje. `null` = todavía no hay. */
  profile: CharacterProfile | null;
  budget: Budget;
  goal: GoalKind;
  items: readonly Item[];
  selectedItem: Item | null;
  onSelectItem: (itemId: string) => void;
  /** Abre el pegado de objeto ya existente; el guía no duplica el formulario. */
  onPasteItem: () => void;
  /** Lleva al banco avanzado cuando la única vía exige reemplazar. */
  onOpenAdvanced: () => void;
  onMentorContext?: (event: ContextualMentorEvent) => void;
}

/** Cómo copiar el objeto, en una sola frase. */
const COPY_HINT =
  "En PoE2, pasa el ratón por el objeto y pulsa Ctrl+Alt+C; luego pégalo aquí.";

function DirectionButton({
  id,
  label,
  hint,
  icon: Icon,
  disabled,
  onChoose,
}: {
  id: string;
  label: string;
  hint: string;
  icon: typeof Swords;
  disabled?: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      data-testid={`coach-direccion-${id}`}
      className="flex min-h-14 w-full items-center gap-3 rounded-md border border-border bg-muted/10 px-3 py-2.5 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-px hover:border-primary/50 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:bg-muted/10 motion-reduce:transition-none"
    >
      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function Recommendation({
  step,
  onDone,
  onHold,
  onOther,
  onRepaste,
  onOpenAdvanced,
  headingRef,
}: {
  step: CoachNextStep;
  onDone: () => void;
  onHold: () => void;
  onOther: () => void;
  onRepaste: () => void;
  onOpenAdvanced: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  if (step.kind === "needs-data") {
    return (
      <div
        className="superficie-accion min-w-0 scroll-mb-[var(--mentor-inset,6rem)] p-4"
        data-testid="coach-recomendacion"
        data-kind="needs-data"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Antes de gastar
        </p>
        <h3 ref={headingRef} tabIndex={-1} className="dossier-title mt-1 text-xl font-semibold outline-none">
          {step.headline}
        </h3>
        <p className="mt-2 text-sm leading-relaxed">{step.instruction}</p>
        <div className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
          <p className="font-medium">Qué falta</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            {(step.missingEvidence.length > 0 ? step.missingEvidence : [step.why]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={onRepaste} data-testid="coach-volver-pegar">
            <ClipboardPaste className="size-4" aria-hidden="true" />
            Volver a pegar esta pieza
          </Button>
          <Button type="button" variant="outline" onClick={onOther} data-testid="coach-otro-camino">
            Elegir otra pieza
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "stop") {
    return (
      <div
        className="superficie-accion min-w-0 scroll-mb-[var(--mentor-inset,6rem)] p-4"
        data-testid="coach-recomendacion"
        data-kind="stop"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Mi consejo
        </p>
        <h3 ref={headingRef} tabIndex={-1} className="dossier-title mt-1 text-xl font-semibold outline-none">
          {step.headline}
        </h3>
        <p className="mt-2 text-sm leading-relaxed">{step.instruction}</p>
        <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
          <summary className="cursor-pointer font-medium">Por qué</summary>
          <p className="mt-2 text-muted-foreground">{step.why}</p>
        </details>
        <details className="mt-2 rounded border border-current/20 px-2.5 py-2 text-xs">
          <summary className="cursor-pointer font-medium">Evidencia técnica</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            {step.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOther} data-testid="coach-otro-camino">
            Elegir otra pieza
          </Button>
          {step.needsAdvancedTools && (
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={onOpenAdvanced}
              data-testid="coach-ir-avanzado"
            >
              Ver herramientas de reemplazo
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="superficie-accion min-w-0 scroll-mb-[var(--mentor-inset,6rem)] p-4"
      data-testid="coach-recomendacion"
      data-kind="use-currency"
      data-action={step.actionId}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
        Siguiente acción legal
      </p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="dossier-title mt-1 flex items-center gap-2 text-xl font-semibold outline-none sm:text-2xl"
      >
        <Sparkles className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {step.label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" data-testid="coach-instruccion">
        {step.instruction}
      </p>

      {/* Aleatoriedad y límite de dirección: SIEMPRE a la vista, nunca plegados. */}
      <p
        className="mt-3 flex items-start gap-2 rounded border border-border/70 bg-background/50 px-2.5 py-2 text-xs leading-relaxed"
        data-testid="coach-aleatoriedad"
        data-steering={step.steering}
        data-goal-fit={step.goalFit}
      >
        <Dices className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          {step.randomnessNotice}
          {step.directionNotice !== null && ` ${step.directionNotice}`}
        </span>
      </p>

      {step.warning !== null && (
        <p
          className="mt-3 flex items-start gap-2 rounded border border-amber-500/45 bg-amber-500/[0.09] px-2.5 py-2 text-xs leading-relaxed text-amber-100"
          data-testid="coach-aviso"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>{step.warning}</span>
        </p>
      )}

      <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
        <summary className="cursor-pointer font-medium">Por qué y qué puede ocurrir</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>{step.why}</li>
          {step.whatCanHappen.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <details className="mt-2 rounded border border-current/20 px-2.5 py-2 text-xs">
        <summary className="cursor-pointer font-medium">Evidencia técnica</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {step.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {step.alternatives.map((alternative) => (
            <li key={alternative.actionId}>
              Otra vía legal: {alternative.label}. {alternative.difference}
            </li>
          ))}
        </ul>
      </details>

      <div
        className="mt-4 flex flex-wrap gap-2 scroll-mb-[var(--mentor-inset,6rem)]"
        data-testid="coach-acciones"
      >
        <Button type="button" onClick={onDone} data-testid="coach-lo-hare">
          Aceptar el riesgo y usar {step.label.toLocaleLowerCase("es")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" onClick={onHold} data-testid="coach-no-gastar">
          No gastar todavía
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={onOpenAdvanced}
          data-testid="coach-explorar-avanzado"
        >
          Explorar herramientas avanzadas
        </Button>
      </div>
    </div>
  );
}

/**
 * «Ayúdame con mi objeto»: una pieza real, una decisión cada vez.
 *
 * Toda la lógica vive en `shared/craftingCoach.ts`; aquí solo hay presentación
 * y el pegado del resultado. Nunca ejecuta nada dentro del juego.
 */
export function CraftingCoach({
  profile,
  budget,
  goal,
  items,
  selectedItem,
  onSelectItem,
  onPasteItem,
  onOpenAdvanced,
  onMentorContext,
}: CraftingCoachProps) {
  const [direction, setDirection] = useState<CoachDirection | null>(null);
  const [focus, setFocus] = useState<CoachFocus | null>(null);
  const [goalText, setGoalText] = useState("");
  const [directionChosen, setDirectionChosen] = useState(false);
  const [directionNote, setDirectionNote] = useState<string | null>(null);
  const [protectedModifiers, setProtectedModifiers] = useState<
    CoachGoalInterpretation["protectedModifiers"]
  >([]);
  const [unresolvedProtections, setUnresolvedProtections] = useState<string[]>([]);
  /** El jugador pidió que decidiera yo y no hay evidencia con la que hacerlo. */
  const [noEvidence, setNoEvidence] = useState(false);
  const [phase, setPhase] = useState<CoachPhase>("choose");
  const [resultText, setResultText] = useState("");
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CraftingComparison | null>(null);
  const [resultItem, setResultItem] = useState<Item | null>(null);
  /**
   * Pieza sobre la que razona el guía. Empieza siendo la del expediente y, tras
   * confirmar un resultado, pasa a ser el objeto que el jugador acaba de pegar.
   * No escribe en el expediente: eso sigue siendo decisión del banco.
   */
  const [workingItem, setWorkingItem] = useState<Item | null>(null);
  /**
   * Snapshot inmutable del paso en curso. Mientras existe, ni un cambio de
   * selección ni un rerender puede sustituir el «antes» que se compara.
   */
  const [pendingAttempt, setPendingAttempt] = useState<PendingCraftAttempt | null>(null);

  const recommendationRef = useRef<HTMLHeadingElement>(null);
  const resultTextRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);

  /**
   * Sincronización de foco con el DOM (no de estado): cada fase lleva el foco a
   * lo que el jugador tiene que leer o rellenar ahora, y lo desplaza a la vista
   * respetando `scroll-margin-bottom`, que reserva la altura real del mentor.
   * Así lo que acaba de aparecer nunca queda debajo del panel flotante.
   */
  useEffect(() => {
    const target =
      phase === "recommend"
        ? recommendationRef.current
        : phase === "await-result"
          ? resultTextRef.current
          : phase === "result"
            ? resultRef.current
            : phase === "hold"
              ? holdRef.current
              : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [phase]);

  const resetFlow = () => {
    setDirection(null);
    setFocus(null);
    setGoalText("");
    setDirectionChosen(false);
    setDirectionNote(null);
    setProtectedModifiers([]);
    setUnresolvedProtections([]);
    setNoEvidence(false);
    setPhase("choose");
    setResultText("");
    setComparison(null);
    setResultItem(null);
    setPendingAttempt(null);
    setError(null);
  };

  const chooseDifferentItem = (itemId: string) => {
    setWorkingItem(null);
    resetFlow();
    onSelectItem(itemId);
  };

  // --- Sin pieza --------------------------------------------------------
  if (!selectedItem) {
    return (
      <section
        className="superficie-panel min-w-0 p-4 sm:p-6"
        data-testid="crafting-coach"
        data-phase="empty"
        aria-labelledby="coach-vacio-titulo"
      >
        <h2 id="coach-vacio-titulo" className="dossier-title text-2xl font-semibold">
          Enséñame la pieza
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {COPY_HINT}
        </p>
        <Button className="mt-4" type="button" onClick={onPasteItem} data-testid="coach-pegar-objeto">
          <ClipboardPaste className="size-4" aria-hidden="true" />
          Pegar un objeto del juego
        </Button>

        {items.length > 0 && (
          <div className="mt-6" data-testid="coach-piezas-importadas">
            <h3 className="text-sm font-semibold">O elige una que ya tienes</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`coach-elegir-${item.id}`}
                    onClick={() => onSelectItem(item.id)}
                    className="flex min-h-12 w-full items-center gap-2 rounded-md border border-border bg-muted/10 px-3 py-2 text-left text-sm transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // Si el jugador cambia de pieza en el expediente, el guía vuelve a ella.
  const activeItem =
    workingItem !== null && workingItem.id === selectedItem.id ? workingItem : selectedItem;
  const step = chooseNextStep(activeItem, direction);

  const chooseDirection = (
    next: CoachDirection,
    nextFocus: CoachFocus,
    note: string | null,
    playerGoal = goalText.trim(),
    protections = protectedModifiers,
    unresolved = unresolvedProtections,
  ) => {
    const nextStep = chooseNextStep(activeItem, next);
    setDirection(next);
    setFocus(nextFocus);
    setDirectionNote(note);
    setProtectedModifiers(protections);
    setUnresolvedProtections(unresolved);
    setNoEvidence(false);
    setDirectionChosen(true);
    setPhase("recommend");
    onMentorContext?.({
      type: "craftingCoachDirection",
      itemName: activeItem.name || activeItem.baseType,
      playerGoal: playerGoal || "decidir qué necesita esta pieza",
      directionLabel: next === null ? "objetivo sin determinar" : COACH_DIRECTION_LABELS[next],
      nextStepTitle: nextStep.kind === "use-currency" ? nextStep.label : nextStep.headline,
      stepKind: nextStep.kind,
      protectedLineCount: protections.length,
      unresolvedProtectionCount: unresolved.length,
    });
  };

  // La dirección solo se deduce del expediente, jamás de la propia pieza.
  const guess = suggestDirectionFromCharacter(profile);

  const submitGoal = () => {
    const interpretation = interpretCoachGoal(goalText, activeItem);
    if (interpretation.direction !== null && interpretation.focus !== null) {
      chooseDirection(
        interpretation.direction,
        interpretation.focus,
        interpretation.reason,
        goalText.trim(),
        interpretation.protectedModifiers,
        interpretation.unresolvedProtections,
      );
      return;
    }
    setDirection(interpretation.direction);
    setFocus(null);
    setDirectionNote(interpretation.reason);
    setProtectedModifiers(interpretation.protectedModifiers);
    setUnresolvedProtections(interpretation.unresolvedProtections);
    setNoEvidence(true);
  };

  const requestFocus = (next: CoachDirection, playerGoal: string, note: string) => {
    setGoalText(playerGoal);
    setDirection(next);
    setFocus(null);
    setDirectionNote(note);
    setNoEvidence(true);
  };

  const chooseFocus = (nextFocus: CoachFocus) => {
    const nextDirection: CoachDirection = DAMAGE_COACH_FOCUSES.includes(nextFocus)
      ? "damage"
      : "defence";
    const playerGoal = `Quiero mejorar ${COACH_FOCUS_LABELS[nextFocus]}`;
    setGoalText(playerGoal);
    chooseDirection(
      nextDirection,
      nextFocus,
      `Objetivo principal: ${COACH_FOCUS_LABELS[nextFocus]}.`,
      playerGoal,
    );
  };

  const compareResult = async () => {
    if (pendingAttempt === null || resultText.trim() === "") return;
    setComparing(true);
    setError(null);
    try {
      const imported = await api.importItemText({ text: resultText });
      // El importador genera un id nuevo en cada pegado; se conserva el de la
      // pieza seguida para que el guía siga hablando del mismo objeto.
      const pasted: Item = {
        ...imported.item,
        id: pendingAttempt.before.id,
        slot: pendingAttempt.before.slot,
      };
      const nextComparison = compareCraftingResult(
        pendingAttempt.before,
        pasted,
        pendingAttempt.actionId,
        {
        protectedModifierIds: protectedModifiers.map((modifier) => modifier.id),
        },
      );
      const nextReading = readPurposefulCraftResult({
        comparison: nextComparison,
        originalItem: pendingAttempt.before,
        resultItem: pasted,
        direction,
        focus,
        profile,
        profileGoal: goal,
      });
      // Los ids de modificadores cambian en cada importación. Vuelve a
      // vincular las protecciones contra el snapshot recién pegado para que
      // sigan siendo válidas si el jugador continúa con otro paso.
      const refreshedGoal = interpretCoachGoal(goalText, pasted);
      setComparison(nextComparison);
      setResultItem(pasted);
      if (nextComparison.status === "confirmed") {
        setProtectedModifiers(refreshedGoal.protectedModifiers);
        setUnresolvedProtections(refreshedGoal.unresolvedProtections);
        // Solo avanzamos el snapshot cuando la comparación se confirmó. Si el
        // pegado no cuadra, conservar la pieza anterior permite corregir el
        // texto sin perder el punto de partida de la sesión.
        setWorkingItem(pasted);
      }
      setPhase("result");
      onMentorContext?.({
        type: "craftingCoachResult",
        itemName: activeItem.name || activeItem.baseType,
        playerGoal: goalText.trim() || "decidir qué necesita esta pieza",
        headline: nextReading.headline,
        verdict: nextReading.verdict,
        nextStepTitle:
          nextReading.nextStep?.kind === "use-currency"
            ? nextReading.nextStep.label
            : nextReading.nextStep?.headline ?? null,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setComparing(false);
    }
  };

  const beginAttempt = () => {
    if (step.kind !== "use-currency") return;
    setPendingAttempt({ before: snapshotItem(activeItem), actionId: step.actionId });
    setResultText("");
    setComparison(null);
    setResultItem(null);
    setError(null);
    setPhase("await-result");
  };

  /**
   * Recuperación explícita: si el resultado es realmente el objeto actual pero
   * no coincide con una sola acción, se puede continuar DESDE él sin afirmar
   * qué moneda produjo la diferencia.
   */
  const continueFromObservedResult = () => {
    if (!resultItem) return;
    setWorkingItem(snapshotItem(resultItem));
    setPendingAttempt(null);
    setComparison(null);
    setResultItem(null);
    setResultText("");
    setError(null);
    setPhase("recommend");
  };

  const resultReading =
    comparison && resultItem
      ? readPurposefulCraftResult({
          comparison,
          originalItem: pendingAttempt?.before ?? activeItem,
          resultItem,
          direction,
          focus,
          profile,
          profileGoal: goal,
        })
      : null;

  return (
    <section
      className="superficie-panel min-w-0 p-4 sm:p-6"
      style={{ scrollMarginBottom: "var(--mentor-inset, 6rem)" }}
      data-testid="crafting-coach"
      data-phase={phase}
      aria-labelledby="coach-titulo"
    >
      <h2 id="coach-titulo" className="sr-only">
        Guía con tu objeto
      </h2>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-24">
          {/* En la elección solo hace falta saber qué es; el detalle llega con
              la recomendación, cuando toca decidir qué se conserva. */}
          <CoachItemCard item={activeItem} compact />
          {items.length > 1 && (
            <details className="rounded-md border border-border/70 px-2.5 py-2 text-xs">
              <summary className="cursor-pointer font-medium">Trabajar con otra pieza</summary>
              <ul className="mt-2 flex flex-col gap-1.5" data-testid="coach-piezas-importadas">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`coach-elegir-${item.id}`}
                      data-active={item.id === selectedItem.id ? "true" : "false"}
                      onClick={() => chooseDifferentItem(item.id)}
                      className="flex min-h-10 w-full items-center rounded-sm border border-border/70 px-2.5 py-1.5 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[active=true]:border-primary/60 data-[active=true]:bg-primary/[0.08] motion-reduce:transition-none"
                    >
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 self-start text-xs text-muted-foreground"
                onClick={onPasteItem}
                data-testid="coach-pegar-otro"
              >
                Pegar otro objeto
              </Button>
            </details>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Paso 1: hacia dónde quiere ir el jugador. */}
          {!directionChosen ? (
            <div className="min-w-0" data-testid="coach-eleccion">
              <h3 className="dossier-title text-xl font-semibold sm:text-2xl">
                ¿Qué quieres conseguir con esta pieza?
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Escríbelo como se lo dirías a otro jugador. Yo lo convertiré en una sola decisión.
              </p>
              <Textarea
                className="mt-3 min-h-24 resize-y"
                value={goalText}
                maxLength={240}
                onChange={(event) => {
                  setGoalText(event.target.value);
                  setDirection(null);
                  setFocus(null);
                  setNoEvidence(false);
                  setDirectionNote(null);
                  setProtectedModifiers([]);
                  setUnresolvedProtections([]);
                }}
                data-testid="coach-objetivo-texto"
                aria-label="Qué quieres conseguir con esta pieza"
                placeholder="p. ej. Quiero que esta ballesta haga más daño físico"
              />
              <Button
                className="mt-3 w-full sm:w-auto"
                type="button"
                disabled={goalText.trim() === ""}
                onClick={submitGoal}
                data-testid="coach-interpretar-objetivo"
              >
                Dime el siguiente paso
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                O elige una forma rápida
              </p>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-3">
                <DirectionButton
                  id="damage"
                  label="Más daño"
                  hint="Pegar más fuerte"
                  icon={Swords}
                  onChoose={() => {
                    const goal = "Quiero mejorar el daño";
                    requestFocus(
                      "damage",
                      goal,
                      "El daño puede ser físico, elemental, crítico o velocidad. Elige qué debe aportar el siguiente afijo.",
                    );
                  }}
                />
                <DirectionButton
                  id="defence"
                  label="Más defensa"
                  hint="Aguantar más"
                  icon={ShieldAlert}
                  onChoose={() => {
                    const goal = "Quiero mejorar la defensa";
                    requestFocus(
                      "defence",
                      goal,
                      "La defensa puede ser vida, resistencias, armadura, evasión o escudo de energía. Elige una prioridad.",
                    );
                  }}
                />
                <DirectionButton
                  id="unknown"
                  label="No lo sé"
                  hint={
                    guess.direction === null
                      ? "Te diré con qué cuento"
                      : "Lo miro en tu expediente"
                  }
                  icon={Sparkles}
                  onChoose={() => {
                    const goal = "No sé qué necesita esta pieza";
                    setGoalText(goal);
                    if (guess.direction === null) {
                      setDirection(null);
                      setFocus(null);
                      setDirectionNote(guess.reason);
                      setNoEvidence(true);
                      return;
                    }
                    requestFocus(guess.direction, goal, `${guess.reason} Ahora elige qué dato quieres corregir primero.`);
                  }}
                />
              </div>
              {noEvidence && (
                <div
                  className="mt-3 rounded-md border border-border bg-muted/[0.06] p-3"
                  data-testid="coach-sin-evidencia"
                  role="status"
                >
                  <p className="text-sm font-medium">{directionNote ?? guess.reason}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {direction === null ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => requestFocus("damage", "Quiero mejorar el daño", "Elige qué tipo de daño debe aportar el siguiente afijo.")}
                          data-testid="coach-elegir-damage"
                        >
                          Elegir daño
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => requestFocus("defence", "Quiero mejorar la defensa", "Elige qué defensa debe aportar el siguiente afijo.")}
                          data-testid="coach-elegir-defence"
                        >
                          Elegir defensa
                        </Button>
                      </>
                    ) : (
                      (direction === "damage" ? DAMAGE_COACH_FOCUSES : DEFENCE_COACH_FOCUSES).map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => chooseFocus(option)}
                          data-testid={`coach-focus-${option}`}
                        >
                          {COACH_FOCUS_LABELS[option]}
                        </Button>
                      ))
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNoEvidence(false);
                        setPhase("hold");
                      }}
                      data-testid="coach-no-gastar-sin-evidencia"
                    >
                      No gastar todavía
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="coach-direccion-elegida">
              Objetivo: «{goalText.trim()}». {direction === null
                ? "Sin dirección elegida."
                : `Prioridad: ${focus === null ? COACH_DIRECTION_NOUNS[direction] : COACH_FOCUS_LABELS[focus]}.`}{" "}
              {directionNote?.includes("expediente") ? directionNote : null}
              <button
                type="button"
                className="ml-1 underline underline-offset-2 hover:text-foreground"
                onClick={resetFlow}
                data-testid="coach-cambiar-direccion"
              >
                Cambiar
              </button>
            </p>
          )}

          {directionChosen && (
            <div
              className={`rounded-md border px-3 py-2 text-xs ${
                hasCraftingCharacterContext(profile)
                  ? "border-cyan-400/30 bg-cyan-500/[0.06] text-cyan-50"
                  : "border-amber-500/35 bg-amber-500/[0.07] text-amber-50"
              }`}
              data-testid="coach-contexto-personaje"
              data-context={hasCraftingCharacterContext(profile) ? "character" : "loose-item"}
            >
              {hasCraftingCharacterContext(profile) ? (
                <p>
                  <span className="font-semibold">Contexto activo:</span> {profile?.name} · objetivo general {GOAL_LABELS[goal].toLocaleLowerCase("es")} · presupuesto {budget.amount} {CURRENCY_LABELS[budget.currency].toLocaleLowerCase("es")}.
                </p>
              ) : (
                <p>
                  <span className="font-semibold">Objeto suelto:</span> puedo enseñarte qué acción es legal y comprobar el resultado, pero no afirmar que conviene a una build que todavía no conozco.
                </p>
              )}
            </div>
          )}

          {directionChosen && (protectedModifiers.length > 0 || unresolvedProtections.length > 0) && (
            <div
              className="rounded-md border border-border/70 bg-muted/[0.05] px-3 py-2 text-xs"
              data-testid="coach-protecciones"
            >
              {protectedModifiers.length > 0 && (
                <p>
                  <span className="font-semibold text-foreground">Protegido:</span>{" "}
                  {protectedModifiers.map((modifier) => modifier.text).join(" · ")}
                </p>
              )}
              {unresolvedProtections.length > 0 && (
                <p className="mt-1 text-amber-200" data-testid="coach-protecciones-no-vinculadas">
                  No encuentro en la pieza: {unresolvedProtections.join(" · ")}. No lo trataré como
                  protegido hasta que coincida con una línea real.
                </p>
              )}
            </div>
          )}

          {/* Paso 2: una sola recomendación. */}
          {directionChosen && phase === "recommend" && (
            <Recommendation
              step={step}
              headingRef={recommendationRef}
              onDone={beginAttempt}
              onHold={() => setPhase("hold")}
              onOther={resetFlow}
              onRepaste={onPasteItem}
              onOpenAdvanced={onOpenAdvanced}
            />
          )}

          {/* Parada voluntaria: ni fracaso ni callejón sin salida. */}
          {phase === "hold" && (
            <div
              ref={holdRef}
              tabIndex={-1}
              role="status"
              className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)] rounded-md border border-border bg-muted/[0.06] p-4 outline-none"
              data-testid="coach-espera"
            >
              <h3 className="dossier-title text-xl font-semibold">Guardado para más tarde</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                La pieza sigue como está. Puedes volver cuando quieras.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => setPhase("recommend")}
                  data-testid="coach-volver-accion"
                >
                  Ver otra vez la acción
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFlow}
                  data-testid="coach-otro-camino"
                >
                  Elegir otro camino
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3: qué salió en el juego. */}
          {phase === "await-result" && step.kind === "use-currency" && (
            <div className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)]" data-testid="coach-registro">
              <h3 className="dossier-title text-xl font-semibold">¿Qué te ha salido?</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{COPY_HINT}</p>
              <Textarea
                ref={resultTextRef}
                className="mt-2 min-h-32 font-mono text-xs"
                value={resultText}
                onChange={(event) => setResultText(event.target.value)}
                aria-label="Texto del objeto después del craft"
                data-testid="coach-resultado-texto"
                placeholder="Pega aquí el objeto tal y como está ahora…"
              />
              {error !== null && (
                <p className="mt-2 text-sm text-rose-200" role="alert" data-testid="coach-error">
                  {error}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={comparing || resultText.trim() === ""}
                  onClick={() => void compareResult()}
                  data-testid="coach-comparar"
                >
                  {comparing ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                  Ver qué ha cambiado
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhase("recommend")}
                  data-testid="coach-volver-recomendacion"
                >
                  Todavía no lo he hecho
                </Button>
              </div>
            </div>
          )}

          {/* Paso 4: antes y después. */}
          {phase === "result" && resultReading && (
            <div
              ref={resultRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)] rounded-md border border-border bg-muted/[0.06] p-4 outline-none"
              data-testid="coach-comparacion"
              data-verdict={resultReading.verdict}
            >
              <h3 className="dossier-title text-xl font-semibold">{resultReading.headline}</h3>
              {resultReading.changed.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5" data-testid="coach-cambios">
                  {resultReading.changed.map((text) => (
                    <li
                      key={text}
                      className="flex min-w-0 items-start gap-2 rounded-sm border border-emerald-400/45 bg-emerald-500/[0.08] px-2.5 py-1.5 text-xs text-emerald-100"
                    >
                      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-300" />
                      <span className="min-w-0 flex-1 break-words">{text}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm text-muted-foreground">{resultReading.kept}</p>
              {resultReading.directionNote !== null && (
                <p
                  className="mt-2 text-sm"
                  data-testid="coach-relacion-objetivo"
                  data-goal-fit={resultReading.goalFit}
                >
                  {resultReading.directionNote}
                </p>
              )}
              {resultReading.improvementCaveat !== null && (
                <p
                  className="mt-1.5 text-sm text-muted-foreground"
                  data-testid="coach-salvedad-mejora"
                >
                  {resultReading.improvementCaveat}
                </p>
              )}
              <p className="mt-3 text-sm font-medium" data-testid="coach-veredicto">
                {resultReading.verdictText}
              </p>
              {comparison && comparison.status !== "confirmed" && resultItem && (
                <details
                  className="mt-3 rounded-md border border-border/70 bg-background/35 px-3 py-2 text-xs"
                  open
                  data-testid="coach-diagnostico-comparacion"
                >
                  <summary className="cursor-pointer font-semibold">Qué estoy comparando</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-foreground">Antes:</span>{" "}
                      {(pendingAttempt?.before ?? activeItem).name ||
                        (pendingAttempt?.before ?? activeItem).baseType}{" "}
                      · {(pendingAttempt?.before ?? activeItem).rarity} ·{" "}
                      {(pendingAttempt?.before ?? activeItem).modifiers.filter(
                        (modifier) => modifier.kind === "explicit",
                      ).length}{" "}
                      explícitos
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">Después:</span>{" "}
                      {resultItem.name || resultItem.baseType} · {resultItem.rarity} ·{" "}
                      {resultItem.modifiers.filter((modifier) => modifier.kind === "explicit").length}{" "}
                      explícitos
                    </p>
                  </div>
                  {comparison.addedModifiers.length > 0 && (
                    <div className="mt-2" data-testid="coach-diagnostico-nuevos">
                      <p className="font-semibold text-foreground">Cuenta como nuevo:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {comparison.addedModifiers.map((modifier) => (
                          <li key={`added-${modifier.id}`} className="whitespace-pre-line break-words">
                            {modifier.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {comparison.removedModifiers.length > 0 && (
                    <div className="mt-2" data-testid="coach-diagnostico-perdidos">
                      <p className="font-semibold text-foreground">Ya no reconoce como la misma línea:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {comparison.removedModifiers.map((modifier) => (
                          <li key={`removed-${modifier.id}`} className="whitespace-pre-line break-words">
                            {modifier.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {resultReading.verdict === "continue" && resultItem && (
                  <Button
                    type="button"
                    onClick={() => {
                      setPhase("recommend");
                      setPendingAttempt(null);
                      setComparison(null);
                      setResultItem(null);
                      setResultText("");
                    }}
                    data-testid="coach-seguir"
                  >
                    Ver la siguiente acción
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                )}
                {comparison && comparison.status !== "confirmed" && (
                  <>
                    <Button
                      type="button"
                      onClick={() => {
                        setPhase("await-result");
                        setComparison(null);
                        setResultItem(null);
                      }}
                      data-testid="coach-corregir-resultado"
                    >
                      Revisar el texto pegado
                    </Button>
                    {comparison.identityMatches && comparison.itemLevelMatches && resultItem && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={continueFromObservedResult}
                        data-testid="coach-usar-resultado-base"
                      >
                        Este es mi objeto actual
                      </Button>
                    )}
                  </>
                )}
                <Button type="button" variant="outline" onClick={resetFlow} data-testid="coach-empezar-otra">
                  Empezar otra vez
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
