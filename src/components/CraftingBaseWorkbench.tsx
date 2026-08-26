import { GitCompareArrows, Plus } from "lucide-react";
import {
  compareCraftingBases,
  type CraftingBaseCandidate,
} from "@shared/craftingBaseComparison.js";
import { CRAFTING_GOAL_LABELS, type CraftingGoalCategory } from "@shared/craftingGoal.js";
import type { CharacterProfile, Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { ItemArtwork } from "@/components/ItemArtwork";

const STATUS_STYLE: Record<CraftingBaseCandidate["status"], string> = {
  ready: "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100",
  review: "border-amber-500/35 bg-amber-500/[0.06] text-amber-100",
  hold: "border-rose-500/35 bg-rose-500/[0.06] text-rose-100",
};

export function CraftingBaseWorkbench({
  selectedItem,
  items,
  profile,
  goalCategory,
  onChoose,
  onAdd,
}: {
  selectedItem: Item;
  items: readonly Item[];
  profile: CharacterProfile | null;
  goalCategory: CraftingGoalCategory;
  onChoose: (itemId: string) => void;
  onAdd?: () => void;
}) {
  const comparison = compareCraftingBases({ selectedItem, items, profile, goalCategory });

  return (
    <section
      id={`crafting-base-workbench-${selectedItem.id}`}
      tabIndex={-1}
      className="rounded-md border border-cyan-500/30 bg-cyan-500/[0.035] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      data-testid="crafting-base-workbench"
      data-comparable-by={comparison.comparableBy}
      aria-labelledby={`crafting-base-workbench-title-${selectedItem.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Banco de bases · {CRAFTING_GOAL_LABELS[goalCategory]}
          </p>
          <h4 id={`crafting-base-workbench-title-${selectedItem.id}`} className="mt-1 flex items-center gap-2 text-base font-semibold">
            <GitCompareArrows className="size-4 text-cyan-300" aria-hidden="true" />
            ¿Qué base merece el siguiente intento?
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">{comparison.comparisonLabel}</p>
        </div>
        {onAdd && (
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            Añadir otra base
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-2" role="list">
        {comparison.candidates.map((candidate) => {
          const active = candidate.item.id === selectedItem.id;
          return (
            <article
              key={candidate.item.id}
              className={`rounded border p-3 ${active ? "border-cyan-400/55 bg-cyan-500/[0.08]" : "border-border/80 bg-background/45"}`}
              data-testid={`crafting-base-candidate-${candidate.item.id}`}
              data-active={active ? "true" : "false"}
              role="listitem"
            >
              <div className="flex items-start gap-3">
                <ItemArtwork item={candidate.item} className="size-11 shrink-0 rounded-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{candidate.item.name}</strong>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {candidate.item.baseType} · ilvl {candidate.item.itemLevel ?? "?"}
                      </span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[candidate.status]}`}>
                      {active ? "Base actual" : candidate.statusLabel}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                    <div className="rounded bg-background/55 p-2">
                      <dt className="text-muted-foreground">Objetivo</dt>
                      <dd className="mt-0.5 font-semibold">
                        {candidate.directGoalModifierCount} señal{candidate.directGoalModifierCount === 1 ? "" : "es"}
                      </dd>
                    </div>
                    <div className="rounded bg-background/55 p-2">
                      <dt className="text-muted-foreground">Estructura</dt>
                      <dd className="mt-0.5 font-semibold">{candidate.structuralLabel}</dd>
                    </div>
                    <div className="rounded bg-background/55 p-2">
                      <dt className="text-muted-foreground">Personaje</dt>
                      <dd className="mt-0.5 font-semibold">{candidate.requirementLabel}</dd>
                    </div>
                  </dl>
                  {candidate.hasMostDirectSignals && comparison.candidates.length > 1 && (
                    <p className="mt-2 text-[11px] font-medium text-emerald-200">
                      Conserva el mayor número de señales directas entre estas bases.
                    </p>
                  )}
                  {!active && (
                    <Button
                      className="mt-2"
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onChoose(candidate.item.id)}
                    >
                      Trabajar con esta base
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {comparison.candidates.length === 1 && (
        <p className="mt-3 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Solo hay una pieza comparable. Añade otra de la misma clase para contrastar hechos antes de invertir.
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Compara lectura, huecos, requisitos y etiquetas visibles. No estima pools, probabilidades ni potencia final.
      </p>
    </section>
  );
}
