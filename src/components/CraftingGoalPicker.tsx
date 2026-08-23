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
}: CraftingGoalPickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(11rem,0.42fr)_minmax(0,1fr)]">
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-category`} className="text-xs font-medium text-foreground">
          Tipo de mejora que buscas
        </label>
        <select
          id={`${idPrefix}-category`}
          value={category}
          onChange={(event) => onCategoryChange(event.target.value as CraftingGoalCategory)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {GOAL_OPTIONS.map(([value, optionLabel]) => (
            <option key={value} value={value}>{optionLabel}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-outcome`} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <input
          id={`${idPrefix}-outcome`}
          value={outcome}
          onChange={(event) => onOutcomeChange(event.target.value)}
          maxLength={300}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
