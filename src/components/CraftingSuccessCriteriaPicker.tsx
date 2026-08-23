import { Check, Flag } from "lucide-react";
import type { Item } from "@shared/domain.js";
import {
  CRAFTING_GOAL_LABELS,
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";
import type { CraftingSuccessCriterion } from "@shared/craftingSuccessCriteria.js";

interface CraftingSuccessCriteriaPickerProps {
  item: Item;
  goalCategory: CraftingGoalCategory;
  value: CraftingSuccessCriterion[];
  onChange: (value: CraftingSuccessCriterion[]) => void;
}

function criterionButton(active: boolean): string {
  return `flex w-full items-start gap-2 rounded border px-3 py-1.5 text-left text-xs transition-colors ${
    active
      ? "border-emerald-500/45 bg-emerald-500/[0.09] text-emerald-100"
      : "border-border bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground"
  }`;
}

/** Tres condiciones máximas, todas verificables contra el resultado pegado. */
export function CraftingSuccessCriteriaPicker({
  item,
  goalCategory,
  value,
  onChange,
}: CraftingSuccessCriteriaPickerProps) {
  const explicitCount = item.modifiers.filter((modifier) => modifier.kind === "explicit").length;
  const currentGoalCount =
    goalCategory === "other"
      ? 0
      : item.modifiers.filter(
          (modifier) =>
            modifier.kind === "explicit" &&
            evaluateCraftingGoalSignal(goalCategory, [modifier]).status === "direct",
        ).length;
  const goalCriterion = value.find((criterion) => criterion.kind === "goal-affix-count");
  const exactCriterion = value.find((criterion) => criterion.kind === "exact-modifier-text");
  const countCriterion = value.find((criterion) => criterion.kind === "explicit-count");
  const countOptions = Array.from(
    { length: Math.max(0, 6 - Math.min(explicitCount, 6)) },
    (_, index) => explicitCount + index + 1,
  );
  const goalCountOptions = Array.from(
    { length: Math.max(0, 6 - Math.min(currentGoalCount, 6)) },
    (_, index) => currentGoalCount + index + 1,
  );

  const replace = (criterion: CraftingSuccessCriterion) => {
    onChange([...value.filter((entry) => entry.kind !== criterion.kind), criterion]);
  };
  const toggle = (criterion: CraftingSuccessCriterion) => {
    onChange(
      value.some((entry) => entry.kind === criterion.kind)
        ? value.filter((entry) => entry.kind !== criterion.kind)
        : [...value, criterion],
    );
  };

  return (
    <section
      className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.035] px-3 py-2"
      data-testid="crafting-success-criteria"
      aria-labelledby={`crafting-success-title-${item.id}`}
      aria-description="Las condiciones se comprueban con el texto avanzado; el objetivo libre no se interpreta como evidencia."
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag className="size-4 text-emerald-300" aria-hidden="true" />
          <h5 id={`crafting-success-title-${item.id}`} className="text-sm font-semibold text-foreground">
            ¿Cuándo paras?
          </h5>
        </div>
        <span className="text-xs text-emerald-200" data-testid="crafting-success-count">
          {value.length}/3 condiciones
        </span>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {goalCategory !== "other" && goalCountOptions.length > 0 && (
          <div className={`${criterionButton(Boolean(goalCriterion))} min-w-44 sm:min-w-0`}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
              aria-pressed={Boolean(goalCriterion)}
              data-testid="crafting-success-goal-toggle"
              onClick={() =>
                toggle({
                  kind: "goal-affix-count",
                  category: goalCategory,
                  minimumCount: goalCountOptions[0] ?? 6,
                })
              }
            >
              <Check className={`mt-0.5 size-3.5 shrink-0 ${goalCriterion ? "opacity-100" : "opacity-25"}`} aria-hidden="true" />
              <span>
                <strong className="block text-foreground">
                  Señal de {CRAFTING_GOAL_LABELS[goalCategory].toLocaleLowerCase("es")}
                </strong>
              </span>
            </button>
            {goalCriterion?.kind === "goal-affix-count" && (
              <select
                aria-label="Cantidad mínima de afijos del objetivo"
                value={goalCriterion.minimumCount}
                onChange={(event) =>
                  replace({
                    ...goalCriterion,
                    category: goalCategory,
                    minimumCount: Number(event.target.value),
                  })
                }
                className="h-7 rounded border border-emerald-500/35 bg-background px-1 text-xs text-foreground"
              >
                {goalCountOptions.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            )}
          </div>
        )}

        <div className={`${criterionButton(Boolean(exactCriterion))} min-w-44 sm:min-w-0`}>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            aria-pressed={Boolean(exactCriterion)}
            data-testid="crafting-success-exact-toggle"
            onClick={() => toggle({ kind: "exact-modifier-text", text: "" })}
          >
            <Check className={`mt-0.5 size-3.5 shrink-0 ${exactCriterion ? "opacity-100" : "opacity-25"}`} aria-hidden="true" />
            <span><strong className="block text-foreground">Línea exacta</strong></span>
          </button>
        </div>

        {countOptions.length > 0 && (
          <div className={`${criterionButton(Boolean(countCriterion))} min-w-44 sm:min-w-0`}>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
              aria-pressed={Boolean(countCriterion)}
              data-testid="crafting-success-count-toggle"
              onClick={() => toggle({ kind: "explicit-count", minimumCount: countOptions[0] ?? 6 })}
            >
              <Check className={`mt-0.5 size-3.5 shrink-0 ${countCriterion ? "opacity-100" : "opacity-25"}`} aria-hidden="true" />
              <span>
                <strong className="block text-foreground">Número de afijos</strong>
              </span>
            </button>
            {countCriterion?.kind === "explicit-count" && (
              <select
                aria-label="Cantidad mínima de afijos explícitos"
                value={countCriterion.minimumCount}
                onChange={(event) =>
                  replace({ ...countCriterion, minimumCount: Number(event.target.value) })
                }
                className="h-7 rounded border border-emerald-500/35 bg-background px-1 text-xs text-foreground"
              >
                {countOptions.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {exactCriterion?.kind === "exact-modifier-text" && (
        <label className="mt-2 block text-xs font-medium text-foreground">
          Línea que debe aparecer exactamente
          <input
            value={exactCriterion.text}
            maxLength={500}
            onChange={(event) => replace({ ...exactCriterion, text: event.target.value })}
            placeholder="Pega el texto exacto del modificador"
            className="mt-1 h-8 w-full rounded border border-emerald-500/35 bg-background px-2 text-xs"
          />
        </label>
      )}
    </section>
  );
}
