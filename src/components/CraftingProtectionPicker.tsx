import type { Item } from "@shared/domain.js";

interface CraftingProtectionPickerProps {
  item: Item;
  value: string[];
  onChange: (modifierIds: string[]) => void;
  idPrefix: string;
}
/** Selección literal: el jugador decide qué líneas del snapshot son intocables. */
export function CraftingProtectionPicker({
  item,
  value,
  onChange,
  idPrefix,
}: CraftingProtectionPickerProps) {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  if (explicit.length === 0) return null;

  return (
    <fieldset
      className="space-y-2 rounded-md border border-border/70 bg-background/30 p-3"
      data-testid="crafting-protection-picker"
    >
      <legend className="px-1 text-xs font-medium text-foreground">
        ¿Qué modificadores no estás dispuesto a perder?
      </legend>
      <p className="text-[11px] text-muted-foreground">
        Marca solo los imprescindibles. El asesor comprobará el riesgo antes y el resultado después.
      </p>
      <div className="space-y-1.5">
        {explicit.map((modifier) => {
          const id = `${idPrefix}-${modifier.id}`;
          const checked = value.includes(modifier.id);
          return (
            <label
              key={modifier.id}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-2 rounded border border-border/60 px-2.5 py-2 text-xs hover:border-primary/35"
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, modifier.id]
                      : value.filter((candidate) => candidate !== modifier.id),
                  )
                }
                className="mt-0.5"
              />
              <span>
                <span className="block text-foreground">{modifier.text}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {modifier.affix === "prefix"
                    ? "Prefijo"
                    : modifier.affix === "suffix"
                      ? "Sufijo"
                      : "Tipo sin determinar"}
                  {modifier.tier ? ` · grado ${modifier.tier}` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
