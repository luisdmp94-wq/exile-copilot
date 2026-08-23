import type { Item } from "@shared/domain.js";

interface CraftingProtectionPickerProps {
  item: Item;
  value: string[];
  onChange: (modifierIds: string[]) => void;
  idPrefix: string;
  compact?: boolean;
}
/** Selección literal: el jugador decide qué líneas del snapshot son intocables. */
export function CraftingProtectionPicker({
  item,
  value,
  onChange,
  idPrefix,
  compact = false,
}: CraftingProtectionPickerProps) {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  if (explicit.length === 0) return null;

  const leadingIds = explicit
    .filter((modifier) => modifier.tier !== undefined && modifier.tier <= 2)
    .map((modifier) => modifier.id);
  const selectedCount = value.filter((id) =>
    explicit.some((modifier) => modifier.id === id),
  ).length;

  return (
    <fieldset
      className="space-y-3 rounded-md border border-border/70 bg-background/30 p-3"
      data-testid="crafting-protection-picker"
    >
      <legend className="sr-only">¿Qué no quieres perder?</legend>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "justify-end" : "justify-between"}`}>
        {!compact && (
          <div>
            <p className="text-sm font-semibold text-foreground">¿Qué no quieres perder?</p>
            <p className="text-[11px] text-muted-foreground">
              Toca las líneas que deben sobrevivir al craft.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
              selectedCount > 0
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-border text-muted-foreground"
            }`}
            aria-live="polite"
          >
            {selectedCount === 0
              ? "Nada marcado"
              : `${selectedCount} intocable${selectedCount === 1 ? "" : "s"}`}
          </span>
          {leadingIds.length > 0 && (
            <button
              type="button"
              className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground"
              onClick={() => onChange([...new Set([...value, ...leadingIds])])}
            >
              Marcar grados 1–2
            </button>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-200"
              onClick={() => onChange([])}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {explicit.map((modifier) => {
          const id = `${idPrefix}-${modifier.id}`;
          const checked = value.includes(modifier.id);
          return (
            <label
              key={modifier.id}
              htmlFor={id}
              className={`group flex min-h-16 cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 text-xs transition-all focus-within:ring-2 focus-within:ring-primary ${
                checked
                  ? "border-emerald-500/55 bg-emerald-500/[0.09] shadow-[0_0_18px_-14px_rgb(52_211_153)]"
                  : "border-border/60 bg-background/25 hover:-translate-y-0.5 hover:border-primary/40"
              }`}
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
                className="mt-0.5 size-4 shrink-0 accent-emerald-400"
              />
              <span className="min-w-0">
                <span className="line-clamp-2 block text-foreground">{modifier.text}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  {modifier.affix === "prefix"
                    ? "Prefijo"
                    : modifier.affix === "suffix"
                      ? "Sufijo"
                      : "Tipo sin determinar"}
                  {modifier.tier ? ` · grado ${modifier.tier}` : ""}
                  {checked ? " · intocable" : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
