import {
  CRAFTING_GOAL_LABELS,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";

interface CraftingGoalPickerProps {
  category: CraftingGoalCategory;
  onCategoryChange: (category: CraftingGoalCategory) => void;
  outcome: string;
  onOutcomeChange: (outcome: string) => void;
  idPrefix: string;
  label: string;
  placeholder: string;
  helperText?: string;
}

const GOAL_OPTIONS = Object.entries(CRAFTING_GOAL_LABELS) as Array<
  [CraftingGoalCategory, string]
>;

/**
 * Captura una categoría comparable sin sustituir el objetivo libre del jugador.
 * La categoría solo se usa después con las etiquetas literales del tooltip.
 */
export function CraftingGoalPicker({
  category,
  onCategoryChange,
  outcome,
  onOutcomeChange,
  idPrefix,
  label,
  placeholder,
  helperText = "Ejemplo: “más daño sin perder velocidad ni +niveles”.",
}: CraftingGoalPickerProps) {
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">¿Qué quieres mejorar primero?</legend>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Tipo de mejora que buscas"
        >
          {GOAL_OPTIONS.map(([value, optionLabel]) => {
            const selected = category === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary/70 bg-primary/[0.12] text-primary shadow-[0_0_18px_-14px_hsl(var(--primary))]"
                    : "border-border/70 bg-background/25 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
                }`}
                onClick={() => onCategoryChange(value)}
              >
                {optionLabel}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-outcome`} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <input
          id={`${idPrefix}-outcome`}
          value={outcome}
          onChange={(event) => onOutcomeChange(event.target.value)}
          maxLength={300}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary/60"
          placeholder={placeholder}
        />
        <p className="text-[11px] text-muted-foreground">
          {helperText}
        </p>
      </div>
    </div>
  );
}
