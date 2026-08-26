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
  COACH_ROLL_MINIMUM_LABELS,
  assessPurposefulCraftBase,
  chooseNextStep,
  interpretCoachGoal,
  readPurposefulCraftResult,
  suggestCraftingFocusFromContext,
  type CoachDirection,
  type CoachGoalInterpretation,
  type CoachNextStep,
  type CoachRollMinimum,
} from "@shared/craftingCoach.js";
import { hasCraftingCharacterContext } from "@shared/craftingCharacterContext.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
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
import type { Budget, BuildTarget, CharacterProfile, GoalKind, Item } from "@shared/domain.js";
import { CoachItemCard } from "@/components/CoachItemCard";
import { CraftingRepairBanner } from "@/components/CraftingRepairBanner";
import { ItemArtwork } from "@/components/ItemArtwork";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { rarityStyle } from "@/lib/equipment";
import { CURRENCY_LABELS, RARITY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";

export type CoachPhase = "choose" | "recommend" | "hold" | "await-result" | "result";

function CoachItemChoice({ item }: { item: Item }) {
  const rarity = rarityStyle(item.rarity);
  return (
    <>
      <ItemArtwork item={item} className={cn("size-9 rounded-sm border", rarity.border)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">{item.name}</span>
        <span className={cn("block truncate text-xs", rarity.text)}>
          {item.baseType} · {RARITY_LABELS[item.rarity]}
        </span>
      </span>
    </>
  );
}

interface PendingCraftAttempt {
  /** Fotografía exacta tomada antes de que el jugador gaste la moneda. */
  before: Item;
  /** La acción también se congela: no se recalcula desde una pieza que ya cambió. */
  actionId: CraftingComparisonActionId;
  /** Contrato congelado antes de gastar. */
  rollMinimum: CoachRollMinimum;
  attemptNumber: number;
  attemptLimit: number;
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
    ...(item.weaponStats
      ? {
          weaponStats: {
            ...item.weaponStats,
            ...(item.weaponStats.physical ? { physical: { ...item.weaponStats.physical } } : {}),
            ...(item.weaponStats.fire ? { fire: { ...item.weaponStats.fire } } : {}),
            ...(item.weaponStats.cold ? { cold: { ...item.weaponStats.cold } } : {}),
            ...(item.weaponStats.lightning ? { lightning: { ...item.weaponStats.lightning } } : {}),
            ...(item.weaponStats.chaos ? { chaos: { ...item.weaponStats.chaos } } : {}),
          },
        }
      : {}),
    ...(item.craftingState ? { craftingState: { ...item.craftingState } } : {}),
    sources: item.sources.map((source) => ({ ...source })),
  };
}

interface CraftingCoachProps {
  /** Único origen de evidencia sobre el personaje. `null` = todavía no hay. */
  profile: CharacterProfile | null;
  patch: string;
  budget: Budget;
  goal: GoalKind;
  /** Plan declarado por el jugador; es referencia, nunca una verdad de la build. */
  target?: BuildTarget;
  items: readonly Item[];
  selectedItem: Item | null;
  onSelectItem: (itemId: string) => void;
  /** Abre el pegado de objeto ya existente; el guía no duplica el formulario. */
  onPasteItem: () => void;
  /** Lleva al banco avanzado cuando la única vía exige reemplazar. */
  onOpenAdvanced: () => void;
  /** El banco abierto ya muestra este mismo aviso junto a los controles bloqueados. */
  showInitialRepairBanner?: boolean;
  onMentorContext?: (event: ContextualMentorEvent) => void;
}

/** Cómo copiar el objeto, en una sola frase. */
const COPY_HINT =
  "En PoE2, pasa el ratón por el objeto y pulsa Ctrl+Alt+C; luego pégalo aquí.";
const DAMAGE_TYPE_FOCUSES = DAMAGE_COACH_FOCUSES.slice(0, 5);
const DAMAGE_OTHER_FOCUSES = DAMAGE_COACH_FOCUSES.slice(5);

/**
 * Pieza observada durante las pruebas manuales del cliente en español.
 *
 * No representa un objeto ideal ni una receta recomendada: solo permite
 * recorrer el guía con prefijos y sufijos que el importador sí puede demostrar.
 * Se analiza por la misma API que cualquier pegado del jugador y nunca se
 * guarda en su expediente.
 */
const PRACTICE_ITEM_TEXT = [
  "Clase de objeto: Mazas a una mano",
  "Rareza: Mágico",
  "Maza de procesión  de victoria",
  "------------------------------",
  "Daño físico: 33-69",
  "Probabilidad de impacto crítico: 5.00%",
  "Ataques por segundo: 1.40",
  "-------------------------",
  "## Requiere: Nivel 54, 96 (unmet) Fue",
  "## Nivel de objeto: 64",
  '{ Mod. de prefijo "" (Grado: 4) — Ataque }',
  "+233(168-236) a la precisión",
  '{ Mod. de sufijo "de victoria" (Grado: 7) — Vida }',
  "Ganas 8(7-9) de vida por cada enemigo asesinado",
].join("\n");

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
  exampleSummary,
  onDone,
  onHold,
  onOther,
  onRepaste,
  onPractice,
  practiceLoading,
  onOpenAdvanced,
  headingRef,
}: {
  step: CoachNextStep;
  exampleSummary: boolean;
  onDone: () => void;
  onHold: () => void;
  onOther: () => void;
  onRepaste: () => void;
  onPractice: () => void;
  practiceLoading: boolean;
  onOpenAdvanced: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  if (step.kind === "needs-data") {
    if (exampleSummary) {
      return (
        <div
          className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)]"
          data-testid="coach-recomendacion"
          data-kind="needs-data"
        >
          <section
            className="rounded-md border border-cyan-500/35 bg-cyan-500/[0.07] p-3 text-cyan-50"
            data-testid="coach-example-summary"
            role="status"
          >
            <p className="text-sm font-semibold">Esta pieza pertenece al personaje de ejemplo.</p>
            <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">
              Resume su equipo, pero no conserva el tooltip avanzado necesario para decidir un craft.
            </p>
          </section>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={onPractice} disabled={practiceLoading} data-testid="coach-probar-practica">
              {practiceLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              Abrir una pieza de práctica
            </Button>
            <Button type="button" variant="outline" onClick={onRepaste}>
              <ClipboardPaste className="size-4" aria-hidden="true" />
              Pegar mi propia pieza
            </Button>
            <Button type="button" variant="ghost" onClick={onOther} data-testid="coach-otro-camino">
              Cambiar objetivo
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div
        className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)]"
        data-testid="coach-recomendacion"
        data-kind="needs-data"
      >
        <h3 ref={headingRef} tabIndex={-1} className="sr-only outline-none">{step.headline}</h3>
        <CraftingRepairBanner
          onRepaste={onRepaste}
          reason={step.missingEvidence[0] ?? step.why}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOther} data-testid="coach-otro-camino">
            Cambiar objetivo
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onPractice}
            disabled={practiceLoading}
            data-testid="coach-probar-practica"
          >
            {practiceLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            Probar con una pieza de práctica
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
      <p
        className="mt-2 scroll-mb-[var(--mentor-inset,6rem)] text-sm leading-relaxed"
        data-testid="coach-instruccion"
      >
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
          Aceptar riesgo y usar {step.label.toLocaleLowerCase("es")}
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
          Explorar avanzadas
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
  patch,
  budget,
  goal,
  target,
  items,
  selectedItem,
  onSelectItem,
  onPasteItem,
  onOpenAdvanced,
  showInitialRepairBanner = true,
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
  const [rollMinimum, setRollMinimum] = useState<CoachRollMinimum>("middle");
  const [attemptLimit, setAttemptLimit] = useState<1 | 2 | 3>(1);
  const [confirmedAttemptCount, setConfirmedAttemptCount] = useState(0);
  /** El jugador pidió que decidiera yo y no hay evidencia con la que hacerlo. */
  const [noEvidence, setNoEvidence] = useState(false);
  const [phase, setPhase] = useState<CoachPhase>("choose");
  const [resultText, setResultText] = useState("");
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CraftingComparison | null>(null);
  const [resultItem, setResultItem] = useState<Item | null>(null);
  const [practiceActive, setPracticeActive] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
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
    setRollMinimum("middle");
    setAttemptLimit(1);
    setConfirmedAttemptCount(0);
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
    setPracticeActive(false);
    setPracticeError(null);
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
                    className="flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-muted/10 px-3 py-2 text-left text-sm transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <CoachItemChoice item={item} />
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
  const activeDiagnosis = diagnoseCraftingItem(activeItem);
  const activeNeedsRepair = activeDiagnosis.state !== "complete";
  const activeIsExampleSummary =
    activeNeedsRepair &&
    activeItem.sources.some((source) => source.label.toLocaleLowerCase("es").includes("demostración"));
  const structuralStep = chooseNextStep(activeItem, direction);
  const baseAssessment = assessPurposefulCraftBase({
    item: activeItem,
    direction,
    focus,
    profile,
    rollMinimum,
  });
  const step = directionChosen && focus !== null
    ? baseAssessment.nextStep
    : structuralStep;

  const loadPracticeItem = async () => {
    setPracticeLoading(true);
    setPracticeError(null);
    try {
      const imported = await api.importItemText({ text: PRACTICE_ITEM_TEXT, patch });
      setWorkingItem({
        ...imported.item,
        // El id enlaza el snapshot temporal con el flujo que ya está abierto;
        // la pieza no se escribe ni sustituye nada en el expediente.
        id: selectedItem.id,
      });
      setPracticeActive(true);
      setPendingAttempt(null);
      setComparison(null);
      setResultItem(null);
      setResultText("");
      setPhase("recommend");
    } catch (err) {
      setPracticeError(getErrorMessage(err));
    } finally {
      setPracticeLoading(false);
    }
  };

  const returnToMyItem = () => {
    setWorkingItem(null);
    setPracticeActive(false);
    setPracticeError(null);
    resetFlow();
  };

  const chooseDirection = (
    next: CoachDirection,
    nextFocus: CoachFocus,
    note: string | null,
    playerGoal = goalText.trim(),
    protections = protectedModifiers,
    unresolved = unresolvedProtections,
  ) => {
    const nextAssessment = assessPurposefulCraftBase({
      item: activeItem,
      direction: next,
      focus: nextFocus,
      profile,
      rollMinimum,
    });
    const nextStep = nextAssessment.nextStep;
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
      focus: nextFocus,
      rollMinimum,
      rollMinimumLabel: COACH_ROLL_MINIMUM_LABELS[rollMinimum],
      attemptLimit,
      nextAction: nextStep.kind === "use-currency" ? nextStep.actionId : null,
      protectedLineCount: protections.length,
      unresolvedProtectionCount: unresolved.length,
      baseStatus: nextAssessment.status,
      baseVerdictTitle: nextAssessment.title,
      baseVerdictSummary: nextAssessment.summary,
    });
  };

  // La sugerencia solo usa el plan declarado y carencias medibles del
  // expediente. Nunca deduce lo que falta mirando los mods de esta pieza.
  const contextSuggestion = suggestCraftingFocusFromContext(profile, target);
  const usingContextSuggestion = goalText === "No sé qué necesita esta pieza";
  const targetFocuses =
    contextSuggestion.source === "target" ? contextSuggestion.focuses : [];

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

  const updateContract = (
    nextRollMinimum: CoachRollMinimum,
    nextAttemptLimit: 1 | 2 | 3,
  ) => {
    setRollMinimum(nextRollMinimum);
    setAttemptLimit(nextAttemptLimit);
    if (focus === null) return;
    onMentorContext?.({
      type: "craftingCoachContract",
      itemName: activeItem.name || activeItem.baseType,
      playerGoal: goalText.trim() || `mejorar ${COACH_FOCUS_LABELS[focus]}`,
      focus,
      focusLabel: COACH_FOCUS_LABELS[focus],
      rollMinimum: nextRollMinimum,
      rollMinimumLabel: COACH_ROLL_MINIMUM_LABELS[nextRollMinimum],
      attemptLimit: nextAttemptLimit,
      nextAction: step.kind === "use-currency" ? step.actionId : null,
    });
  };

  const compareResult = async () => {
    if (pendingAttempt === null || resultText.trim() === "") return;
    setComparing(true);
    setError(null);
    try {
      const imported = await api.importItemText({ text: resultText, patch });
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
        rollMinimum: pendingAttempt.rollMinimum,
        attemptNumber: pendingAttempt.attemptNumber,
        attemptLimit: pendingAttempt.attemptLimit,
      });
      // Los ids de modificadores cambian en cada importación. Vuelve a
      // vincular las protecciones contra el snapshot recién pegado para que
      // sigan siendo válidas si el jugador continúa con otro paso.
      const refreshedGoal = interpretCoachGoal(goalText, pasted);
      setComparison(nextComparison);
      setResultItem(pasted);
      if (nextComparison.status === "confirmed") {
        setConfirmedAttemptCount((current) =>
          Math.max(current, pendingAttempt.attemptNumber),
        );
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
        decisionKind: nextReading.decisionKind,
        verdictText: nextReading.verdictText,
        nextStepTitle:
          nextReading.nextStep?.kind === "use-currency"
            ? nextReading.nextStep.label
            : nextReading.nextStep?.headline ?? null,
        focus,
        rollMinimum: pendingAttempt.rollMinimum,
        rollMinimumLabel: COACH_ROLL_MINIMUM_LABELS[pendingAttempt.rollMinimum],
        attemptCurrent:
          nextReading.attemptProgress?.current ?? pendingAttempt.attemptNumber,
        attemptLimit:
          nextReading.attemptProgress?.limit ?? pendingAttempt.attemptLimit,
        attemptsRemaining:
          nextReading.attemptProgress?.remaining ??
          Math.max(0, pendingAttempt.attemptLimit - pendingAttempt.attemptNumber),
        nextAction:
          nextReading.nextStep?.kind === "use-currency"
            ? nextReading.nextStep.actionId
            : null,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setComparing(false);
    }
  };

  const beginAttempt = () => {
    if (step.kind !== "use-currency") return;
    setPendingAttempt({
      before: snapshotItem(activeItem),
      actionId: step.actionId,
      rollMinimum,
      attemptNumber: confirmedAttemptCount + 1,
      attemptLimit,
    });
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
          rollMinimum: pendingAttempt?.rollMinimum ?? rollMinimum,
          attemptNumber: pendingAttempt?.attemptNumber ?? confirmedAttemptCount + 1,
          attemptLimit: pendingAttempt?.attemptLimit ?? attemptLimit,
        })
      : null;
  const baseShouldBeReplaced = Boolean(
    comparison?.status === "confirmed" &&
      resultReading?.goalFit !== "confirmed" &&
      (resultReading?.decisionKind === "restart" || resultReading?.attemptProgress?.remaining === 0),
  );
  const resultState = resultReading
    ? comparison?.status !== "confirmed"
      ? "mismatch"
      : resultReading.verdict
    : null;
  const resultStatusLabel =
    resultState === "mismatch"
      ? "NO CUADRA"
      : resultState === "continue"
        ? "PUEDES SEGUIR"
        : resultState === "stop"
          ? "PARA"
          : "REVISA";
  const resultSummary = !resultReading
    ? ""
    : resultState === "mismatch"
      ? comparison?.summary ?? "Revisa el texto pegado antes de gastar otra moneda."
      : resultReading.verdict === "continue"
        ? resultReading.attemptProgress
          ? `${resultReading.attemptProgress.remaining === 1 ? "Queda 1 paso" : `Quedan ${resultReading.attemptProgress.remaining} pasos`} dentro del límite que elegiste.`
          : "Queda una acción legal dentro del límite que elegiste."
        : resultReading.decisionKind === "restart"
          ? "Este intento ha llegado a su límite."
          : resultReading.goalFit === "confirmed"
            ? /requisit/i.test(resultReading.verdictText)
              ? "El objeto no cumple los requisitos de tu personaje."
              : "El objetivo aparece, pero el contrato indica detenerse."
            : resultReading.goalFit === "not-evaluable"
              ? "Falta concretar el objetivo antes de gastar otra moneda."
              : "El resultado no cumple el objetivo actual.";

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

      {showInitialRepairBanner && activeNeedsRepair && !directionChosen && (
        <div className="mb-4">
          <CraftingRepairBanner
            onRepaste={onPasteItem}
            reason={activeDiagnosis.blockers[0] ?? activeDiagnosis.limitations[0] ?? null}
          />
        </div>
      )}

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
                      onClick={(event) => {
                        // Tras elegir, la lista deja paso a la decisión. Mantener
                        // las demás piezas abiertas convertía el coach en un catálogo.
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        chooseDifferentItem(item.id);
                      }}
                      className="flex min-h-12 w-full items-center gap-2.5 rounded-sm border border-border/70 px-2.5 py-1.5 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[active=true]:border-primary/60 data-[active=true]:bg-primary/[0.08] motion-reduce:transition-none"
                    >
                      <CoachItemChoice item={item} />
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
          {practiceActive && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cyan-400/35 bg-cyan-500/[0.07] px-3 py-2 text-xs text-cyan-50"
              data-testid="coach-practica-activa"
              role="status"
            >
              <p>
                <span className="font-semibold">Modo práctica:</span> esta pieza sirve para aprender el recorrido y no se guardará en tu expediente.
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={returnToMyItem}>
                Volver a mi pieza
              </Button>
            </div>
          )}

          {practiceError && (
            <p
              className="rounded-md border border-destructive/45 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
              role="alert"
              data-testid="coach-practica-error"
            >
              No pude preparar la pieza de práctica: {practiceError}
            </p>
          )}

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
                variant={activeNeedsRepair || (noEvidence && focus === null) ? "secondary" : "default"}
                disabled={activeNeedsRepair || goalText.trim() === "" || (noEvidence && focus === null)}
                onClick={submitGoal}
                data-testid="coach-interpretar-objetivo"
              >
                Dime el siguiente paso
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              {(activeNeedsRepair || (noEvidence && focus === null)) && (
                <span className="mt-2 block text-xs font-medium text-amber-300" role="status">
                  {activeNeedsRepair ? "Repara primero la lectura de la pieza." : "Elige un objetivo exacto."}
                </span>
              )}
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
                    contextSuggestion.source === "target"
                      ? "Lo miro en tu plan"
                      : contextSuggestion.source === "resistances"
                        ? "Lo miro en tu expediente"
                        : "Te diré qué información falta"
                  }
                  icon={Sparkles}
                  onChoose={() => {
                    const goal = "No sé qué necesita esta pieza";
                    setGoalText(goal);
                    if (contextSuggestion.focuses.length === 0) {
                      setDirection(null);
                      setFocus(null);
                      setDirectionNote(contextSuggestion.reason);
                      setNoEvidence(true);
                      return;
                    }
                    const directions = new Set(
                      contextSuggestion.focuses.map((option) =>
                        DAMAGE_COACH_FOCUSES.includes(option) ? "damage" : "defence",
                      ),
                    );
                    setDirection(directions.size === 1 ? [...directions][0]! : null);
                    setFocus(null);
                    setDirectionNote(contextSuggestion.reason);
                    setNoEvidence(true);
                  }}
                />
              </div>
              {noEvidence && (
                <div
                  className="mt-3 rounded-md border border-border bg-muted/[0.06] p-3"
                  data-testid="coach-sin-evidencia"
                  role="status"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                    {usingContextSuggestion && contextSuggestion.focuses.length > 0
                      ? "1. Lo que necesita tu personaje"
                      : "Antes de gastar"}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {directionNote ?? contextSuggestion.reason}
                  </p>
                  {usingContextSuggestion &&
                    contextSuggestion.source === "target" &&
                    contextSuggestion.evidence.length > 0 && (
                      <ul
                        className="mt-2 space-y-1 text-xs text-muted-foreground"
                        data-testid="coach-contexto-evidencia"
                      >
                        {contextSuggestion.evidence.map((line) => (
                          <li key={line}>«{line}»</li>
                        ))}
                      </ul>
                    )}
                  {usingContextSuggestion && contextSuggestion.focuses.length > 0 && (
                    <div
                      className="mt-3 rounded border border-amber-500/35 bg-amber-500/[0.07] px-2.5 py-2 text-xs leading-relaxed text-amber-50"
                      data-testid="coach-contexto-encaje-pieza"
                    >
                      <p className="font-semibold">2. ¿Encaja esta pieza?</p>
                      <p className="mt-1 text-amber-100/80">
                        {contextSuggestion.source === "target"
                          ? `El plan marca una prioridad, pero no la vincula a ${activeItem.name || activeItem.baseType} ni demuestra que esta pieza pueda recibir ese modificador.`
                          : `El expediente demuestra una carencia del personaje, no que ${activeItem.name || activeItem.baseType} sea la pieza adecuada para cubrirla.`}
                      </p>
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {usingContextSuggestion && contextSuggestion.focuses.length > 0 ? (
                      contextSuggestion.focuses.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => chooseFocus(option)}
                          data-testid={`coach-context-focus-${option}`}
                        >
                          Buscar {COACH_FOCUS_LABELS[option]} en esta pieza
                        </Button>
                      ))
                    ) : direction === null ? (
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
                    ) : direction === "damage" ? (
                      <div className="w-full space-y-3" data-testid="coach-focus-grupos">
                        <div className="grid gap-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
                          <p className="text-xs font-semibold text-muted-foreground">Tipo de daño</p>
                          <div className="flex min-h-11 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                            {DAMAGE_TYPE_FOCUSES.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-11 shrink-0"
                                onClick={() => chooseFocus(option)}
                                data-testid={`coach-focus-${option}`}
                              >
                                {COACH_FOCUS_LABELS[option]}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
                          <p className="text-xs font-semibold text-muted-foreground">Otra vía</p>
                          <div className="flex min-h-11 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                            {DAMAGE_OTHER_FOCUSES.map((option) => (
                              <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-11 shrink-0"
                                onClick={() => chooseFocus(option)}
                                data-testid={`coach-focus-${option}`}
                              >
                                {COACH_FOCUS_LABELS[option]}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-11 w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                        {DEFENCE_COACH_FOCUSES.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 shrink-0"
                            onClick={() => chooseFocus(option)}
                            data-testid={`coach-focus-${option}`}
                          >
                            {COACH_FOCUS_LABELS[option]}
                          </Button>
                        ))}
                      </div>
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
                    {usingContextSuggestion && contextSuggestion.focuses.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={onPasteItem}
                        data-testid="coach-cambiar-pieza-contexto"
                      >
                        Cambiar de pieza
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p
              className="text-xs text-muted-foreground"
              data-testid="coach-direccion-elegida"
              data-player-goal={goalText.trim()}
            >
              <span className="font-semibold text-foreground">Objetivo ·</span>{" "}
              {direction === null
                ? "sin dirección"
                : focus === null
                  ? COACH_DIRECTION_NOUNS[direction]
                  : COACH_FOCUS_LABELS[focus]}
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
              className={`rounded-md border px-3 py-1.5 text-xs ${
                hasCraftingCharacterContext(profile)
                  ? "border-cyan-400/30 bg-cyan-500/[0.06] text-cyan-50"
                  : "border-amber-500/35 bg-amber-500/[0.07] text-amber-50"
              }`}
              data-testid="coach-contexto-personaje"
              data-context={hasCraftingCharacterContext(profile) ? "character" : "loose-item"}
            >
              {hasCraftingCharacterContext(profile) ? (
                <p>
                  <span className="font-semibold">Personaje:</span> {profile?.name} · expediente activo
                  {target ? ` · plan ${target.name}` : ""} · límite {budget.amount} {CURRENCY_LABELS[budget.currency].toLocaleLowerCase("es")}.
                </p>
              ) : (
                <p>
                  <span className="font-semibold">Sin expediente:</span> usaré tu objetivo sin comparar la build.
                </p>
              )}
            </div>
          )}

          {directionChosen && focus !== null && (
            <section
              className={`rounded-md border px-3 py-3 ${
                baseAssessment.status === "already-satisfied" || baseAssessment.status === "aligned"
                  ? "border-emerald-400/35 bg-emerald-500/[0.06]"
                  : baseAssessment.status === "controlled-attempt" || baseAssessment.status === "review-current"
                    ? "border-amber-400/35 bg-amber-500/[0.06]"
                    : baseAssessment.status === "change-base"
                      ? "border-rose-400/35 bg-rose-500/[0.06]"
                      : "border-border bg-muted/[0.05]"
              }`}
              data-testid="coach-evaluacion-base"
              data-status={baseAssessment.status}
              aria-labelledby="coach-evaluacion-base-titulo"
            >
              <h3 id="coach-evaluacion-base-titulo" className="text-base font-semibold text-foreground">
                {baseAssessment.title}
              </h3>
              <p className="mt-1.5 text-sm font-medium text-foreground" data-testid="coach-base-decision">
                {baseAssessment.decisionLabel}
              </p>
              <details className="mt-2 rounded border border-border/70 px-2.5 py-2 text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground">Ver análisis</summary>
                <p className="mt-2 leading-relaxed text-muted-foreground">{baseAssessment.summary}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-foreground">Personaje</dt>
                    <dd className="mt-0.5 text-muted-foreground" data-testid="coach-base-personaje">{baseAssessment.characterLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Base</dt>
                    <dd className="mt-0.5 text-muted-foreground" data-testid="coach-base-objetivo">{baseAssessment.targetLabel}</dd>
                  </div>
                </dl>
              </details>
            </section>
          )}

          {directionChosen && focus !== null && targetFocuses.length > 0 && (
            <p
              className={`rounded-md border px-3 py-2 text-xs ${
                targetFocuses.includes(focus)
                  ? "border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-100"
                  : "border-amber-500/35 bg-amber-500/[0.07] text-amber-100"
              }`}
              data-testid="coach-ajuste-plan"
              data-fit={targetFocuses.includes(focus) ? "matched" : "different"}
            >
              {targetFocuses.includes(focus)
                ? `Esta prioridad aparece en tu plan: ${COACH_FOCUS_LABELS[focus]}.`
                : `Esta prioridad no aparece entre los mods deseados del plan. Puedes trabajarla, pero no la trataré como objetivo de la build.`}
            </p>
          )}

          {directionChosen && focus !== null && step.kind === "use-currency" && (
            <div
              className="rounded-md border border-primary/30 bg-primary/[0.05] px-3 py-2.5 text-xs leading-relaxed"
              data-testid="coach-condicion-parada"
            >
              <p>
                <span className="font-semibold text-primary">Parada:</span>{" "}
                {COACH_FOCUS_LABELS[focus]} · {rollMinimum === "any" ? "cualquiera" : rollMinimum === "middle" ? "media+" : "alta"} · {attemptLimit}{" "}
                {attemptLimit === 1 ? "paso" : "pasos"}.
              </p>
              {phase === "recommend" && confirmedAttemptCount === 0 && (
                <details className="mt-1.5" data-testid="coach-contrato-controles">
                  <summary className="w-fit cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    Ajustar
                  </summary>
                  <div className="mt-2 grid gap-2 border-t border-primary/15 pt-2 sm:grid-cols-2">
                    <fieldset className="min-w-0">
                      <legend className="font-semibold text-foreground">Tirada mínima</legend>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(["any", "middle", "high"] as const).map((minimum) => (
                          <button
                            key={minimum}
                            type="button"
                            aria-pressed={rollMinimum === minimum}
                            data-testid={`coach-roll-minimum-${minimum}`}
                            onClick={() => updateContract(minimum, attemptLimit)}
                            className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                          >
                            {minimum === "any" ? "Cualquiera" : minimum === "middle" ? "Media+" : "Alta"}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="min-w-0">
                      <legend className="font-semibold text-foreground">Máximo de pasos</legend>
                      <div className="mt-1 flex gap-1">
                        {([1, 2, 3] as const).map((limit) => (
                          <button
                            key={limit}
                            type="button"
                            aria-pressed={attemptLimit === limit}
                            data-testid={`coach-attempt-limit-${limit}`}
                            onClick={() => updateContract(rollMinimum, limit)}
                            className="min-w-8 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                          >
                            {limit}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                      Rango visible del tooltip; no es una probabilidad.
                    </p>
                  </div>
                </details>
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
              exampleSummary={activeIsExampleSummary}
              headingRef={recommendationRef}
              onDone={beginAttempt}
              onHold={() => setPhase("hold")}
              onOther={resetFlow}
              onRepaste={onPasteItem}
              onPractice={() => void loadPracticeItem()}
              practiceLoading={practiceLoading}
              onOpenAdvanced={onOpenAdvanced}
            />
          )}

          {/* Parada voluntaria: ni fracaso ni callejón sin salida. */}
          {phase === "hold" && (
            <div
              ref={holdRef}
              tabIndex={-1}
              role="status"
              className="min-w-0 scroll-mb-[var(--mentor-inset,6rem)] rounded-md border border-border bg-muted/[0.06] p-2 outline-none sm:p-4"
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
              {comparing && (
                <div
                  className="mt-4 rounded-md border border-border bg-muted/[0.06] p-4"
                  role="status"
                  aria-label="Leyendo el resultado"
                  data-testid="coach-resultado-cargando"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Resultado
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      LEYENDO
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="rounded-sm border border-border/60 p-2.5">
                        <div className="mx-auto h-2 w-12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                        <div className="mx-auto mt-2 h-6 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              data-decision-kind={resultReading.decisionKind ?? "none"}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Resultado
                  </p>
                <div
                  className={cn(
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide",
                    resultState === "continue"
                      ? "border-cyan-400/45 bg-cyan-500/[0.10] text-cyan-100"
                      : resultState === "mismatch" || resultState === "stop"
                        ? "border-rose-400/45 bg-rose-500/[0.10] text-rose-100"
                        : "border-amber-400/45 bg-amber-500/[0.10] text-amber-100",
                  )}
                  data-testid="coach-estado-resultado"
                >
                  {resultState === "continue" ? (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  ) : resultState === "stop" ? (
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  ) : (
                    <TriangleAlert className="size-4" aria-hidden="true" />
                  )}
                  {resultStatusLabel}
                </div>
                </div>
                <h3 className="dossier-title mt-2 text-lg font-semibold sm:text-xl">
                  <span className="sm:hidden">
                    {comparison?.status !== "confirmed"
                      ? "Resultado no confirmado"
                      : resultReading.observedAffixes.length === 1
                        ? "Modificador nuevo"
                        : resultReading.headline}
                  </span>
                  <span className="hidden sm:inline">{resultReading.headline}</span>
                </h3>
              </div>
              <p className="mt-1.5 text-sm font-medium text-foreground sm:mt-2" data-testid="coach-veredicto-resumen">
                {resultSummary}
              </p>
              {resultReading.observedAffixes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5" data-testid="coach-cambios">
                  {resultReading.observedAffixes.map((affix) => (
                    <li
                      key={affix.id}
                      className={`min-w-0 rounded-sm border px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 ${
                        affix.goalFit === "confirmed"
                          ? "border-cyan-400/35 bg-cyan-500/[0.07] text-cyan-50"
                          : affix.goalFit === "not-confirmed"
                            ? "border-rose-400/35 bg-rose-500/[0.06] text-rose-50"
                            : "border-border bg-background/35 text-foreground"
                      }`}
                      data-testid="coach-calidad-afijo"
                      data-roll-band={affix.rollBand}
                      data-goal-fit={affix.goalFit}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                            affix.goalFit === "confirmed"
                              ? "bg-cyan-300"
                              : affix.goalFit === "not-confirmed"
                                ? "bg-rose-300"
                                : "bg-muted-foreground"
                          }`}
                        />
                        <span className="min-w-0 flex-1 break-words">{affix.text}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-3.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-medium ${
                            affix.goalFit === "confirmed"
                              ? "border-cyan-400/40 bg-cyan-500/[0.09] text-cyan-100"
                              : affix.goalFit === "not-confirmed"
                                ? "border-rose-400/35 bg-rose-500/[0.08] text-rose-100"
                                : "border-border bg-background/40 text-muted-foreground"
                          }`}
                        >
                          {affix.goalFit === "confirmed"
                            ? "Encaja"
                            : affix.goalFit === "not-confirmed"
                              ? "No encaja"
                              : "Sin confirmar"}
                        </span>
                        <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-muted-foreground">
                          {affix.tier === null ? "Grado no visible" : `Grado ${affix.tier}`}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 ${
                            affix.rollBand === "high"
                              ? "border-emerald-400/40 bg-emerald-500/[0.09] text-emerald-100"
                              : affix.rollBand === "middle"
                                ? "border-amber-400/40 bg-amber-500/[0.09] text-amber-100"
                                : affix.rollBand === "low"
                                  ? "border-rose-400/40 bg-rose-500/[0.09] text-rose-100"
                                  : "border-border bg-background/40 text-muted-foreground"
                          }`}
                        >
                          {affix.rollBand === "middle" && affix.rollPositionPercent !== null
                            ? `Media · ${affix.rollPositionPercent}%`
                            : affix.rollBand === "high"
                              ? "Alta"
                              : affix.rollBand === "low"
                                ? "Baja"
                                : affix.rollLabel}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {resultReading.weaponPerformance && (
                <section
                  className="mt-3 rounded-md border border-cyan-400/25 bg-cyan-500/[0.05] p-3"
                  data-testid="coach-rendimiento-arma"
                  title="Calculado únicamente desde las cifras visibles del tooltip"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold text-cyan-50">Rendimiento del arma</h4>
                    <span className="rounded-full border border-cyan-400/20 bg-background/30 px-2 py-0.5 text-xs text-cyan-100">
                      {resultReading.weaponPerformance.craftDelta.delta > 0 ? "+" : ""}
                      {resultReading.weaponPerformance.craftDelta.delta} DPS
                      {resultReading.weaponPerformance.craftDelta.percent === null
                        ? ""
                        : ` · ${resultReading.weaponPerformance.craftDelta.percent > 0 ? "+" : ""}${resultReading.weaponPerformance.craftDelta.percent}%`}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-sm border border-border/60 bg-background/35 px-1 py-2 sm:px-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Físico</p>
                      <p className="mt-0.5 text-xl font-semibold leading-none sm:text-2xl">{resultReading.weaponPerformance.candidate.physicalDps}</p>
                    </div>
                    <div className="rounded-sm border border-border/60 bg-background/35 px-1 py-2 sm:px-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Elemental</p>
                      <p className="mt-0.5 text-xl font-semibold leading-none sm:text-2xl">{resultReading.weaponPerformance.candidate.elementalDps}</p>
                    </div>
                    <div className="rounded-sm border border-cyan-400/25 bg-cyan-500/[0.06] px-1 py-2 sm:px-2">
                      <p className="text-[11px] uppercase tracking-wide text-cyan-100/70">Total</p>
                      <p className="mt-0.5 text-xl font-semibold leading-none text-cyan-50 sm:text-2xl">{resultReading.weaponPerformance.candidate.totalDps}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs">
                    <p className="sr-only" data-testid="coach-delta-dps-total">
                      Desde el paso anterior: {resultReading.weaponPerformance.craftDelta.delta > 0 ? "+" : ""}{resultReading.weaponPerformance.craftDelta.delta} DPS visible total{resultReading.weaponPerformance.craftDelta.percent === null ? "" : ` (${resultReading.weaponPerformance.craftDelta.percent > 0 ? "+" : ""}${resultReading.weaponPerformance.craftDelta.percent}%)`}.
                    </p>
                    {resultReading.weaponPerformance.focusComparison && (
                      <p
                        className={
                          resultReading.weaponPerformance.focusComparison.outcome === "higher"
                            ? "text-emerald-200"
                            : resultReading.weaponPerformance.focusComparison.outcome === "lower"
                              ? "text-rose-200"
                              : "text-amber-200"
                        }
                        data-testid="coach-comparacion-objetivo-arma"
                      >
                        {resultReading.weaponPerformance.focusComparison.label.replace(" visible", "")}: {resultReading.weaponPerformance.focusComparison.before} → {resultReading.weaponPerformance.focusComparison.after}
                      </p>
                    )}
                  </div>
                </section>
              )}
              <p
                className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground sm:mt-3"
                data-testid="coach-hechos-resultado"
              >
                <span>{resultReading.kept.startsWith("No se ha perdido") ? "Nada perdido" : resultReading.kept}</span>
                {resultReading.directionNote !== null && (
                  <span
                    className="before:mr-2 before:text-muted-foreground/50 before:content-['·']"
                    data-testid="coach-relacion-objetivo"
                    data-goal-fit={resultReading.goalFit}
                    title={resultReading.directionNote}
                  >
                    {resultReading.goalFit === "confirmed"
                      ? "Encaja con el objetivo"
                      : resultReading.goalFit === "not-confirmed"
                        ? "No encaja con el objetivo"
                        : "Encaje sin confirmar"}
                  </span>
                )}
              </p>
              <details className="mt-2 rounded-md border border-border/70 bg-background/35 px-3 py-2 text-xs sm:mt-3">
                <summary className="min-h-7 cursor-pointer py-1 font-semibold text-muted-foreground">
                  Límites y detalle
                </summary>
                <div className="mt-2 space-y-2 text-muted-foreground">
                  <p className="font-medium text-foreground" data-testid="coach-veredicto">
                    {resultReading.verdictText}
                  </p>
                  {resultReading.improvementCaveat !== null && (
                    <p data-testid="coach-salvedad-mejora">{resultReading.improvementCaveat}</p>
                  )}
                  {resultReading.weaponPerformance && (
                    <p>{resultReading.weaponPerformance.limitation}</p>
                  )}
                </div>
              </details>
              {comparison && comparison.status !== "confirmed" && resultItem && (
                <details
                  className="mt-3 rounded-md border border-border/70 bg-background/35 px-3 py-2 text-xs"
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
              <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:flex-wrap">
                {comparison?.status === "confirmed" && resultReading.verdict === "continue" && resultItem && (
                  <Button
                    type="button"
                    className="col-span-2 min-h-11 w-full sm:w-auto"
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
                      className="col-span-2 min-h-11 w-full sm:w-auto"
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
                        className="min-h-11 w-full sm:w-auto"
                        onClick={continueFromObservedResult}
                        data-testid="coach-usar-resultado-base"
                      >
                        Este es mi objeto actual
                      </Button>
                    )}
                  </>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict !== "continue" && resultReading.goalFit !== "confirmed" && (
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={resetFlow}
                    data-testid="coach-empezar-otra"
                  >
                    {resultReading.goalFit === "not-evaluable" ? "Concretar objetivo" : "Cambiar objetivo"}
                  </Button>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict !== "continue" && resultReading.goalFit === "confirmed" && (
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => setPhase("hold")}
                    data-testid="coach-terminar-resultado"
                  >
                    Terminar por ahora
                  </Button>
                )}
                {baseShouldBeReplaced && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={onPasteItem}
                    data-testid="coach-probar-otra-base"
                  >
                    Probar otra base
                  </Button>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict === "continue" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={resetFlow}
                    data-testid="coach-empezar-otra"
                  >
                    Replantear el objetivo
                  </Button>
                )}
                {comparison?.status === "confirmed" && !baseShouldBeReplaced && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={onPasteItem}
                    data-testid="coach-cambiar-pieza-resultado"
                  >
                    Cambiar de pieza
                  </Button>
                )}
                {comparison?.status === "confirmed" && resultReading.verdict === "continue" && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => setPhase("hold")}
                    data-testid="coach-terminar-resultado"
                  >
                    Terminar por ahora
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </section>
  );
}
