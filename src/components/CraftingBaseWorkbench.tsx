import { GitCompareArrows, Plus } from "lucide-react";
import {
  compareCraftingBases,
  type CraftingBaseCandidate,
} from "@shared/craftingBaseComparison.js";
import { craftingGoalLabel, type CraftingGoalCategory } from "@shared/craftingGoal.js";
import type { CharacterProfile, Item } from "@shared/domain.js";
import {
  craftingBaseCandidateText,
  craftingBaseComparisonLabel,
} from "@shared/craftingWorkshopText.js";
import { Button } from "@/components/ui/button";
import { ItemArtwork } from "@/components/ItemArtwork";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    eyebrow: "Comparar piezas",
    title: "¿Con cuál de tus piezas trabajas?",
    addBase: "Pegar otra pieza",
    currentBase: "La que estás usando",
    goal: "Para tu objetivo",
    signals: (count: number) => `${count} línea${count === 1 ? "" : "s"} que ayuda${count === 1 ? "" : "n"}`,
    structure: "Huecos",
    character: "¿Puedes llevarla?",
    mostSignals: "Es la que más líneas útiles tiene para este objetivo.",
    wouldLose: "No tiene (y la tuya sí)",
    noLostLine: "Tiene todas las líneas de la tuya.",
    appearsHere: "Tiene (y la tuya no)",
    noNewLine: "Ninguna línea que la tuya no tenga.",
    useBase: "Trabajar con esta",
    onlyOne: "Solo tienes una pieza de esta clase. Pega otra para compararlas antes de gastar.",
    footnote: "Compara las líneas tal como están escritas. No recalcula tu build ni dice cuál pega más: confírmalo dentro del juego.",
  },
  {
    eyebrow: "Compare items",
    title: "Which of your items do you work on?",
    addBase: "Paste another item",
    currentBase: "The one you're using",
    goal: "For your goal",
    signals: (count: number) => `${count} line${count === 1 ? "" : "s"} that help${count === 1 ? "s" : ""}`,
    structure: "Slots",
    character: "Can you wear it?",
    mostSignals: "It has the most useful lines for this goal.",
    wouldLose: "Doesn't have (yours does)",
    noLostLine: "It has every line yours has.",
    appearsHere: "Has (yours doesn't)",
    noNewLine: "No line yours doesn't have.",
    useBase: "Work on this one",
    onlyOne: "You only have one item of this class. Paste another to compare them before spending.",
    footnote: "It compares the lines as written. It doesn't recalculate your build or say which hits harder: confirm it in the game.",
  },
);

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
  const t = useText(TEXT);
  const { lang } = useLang();
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
          <p className="text-xs font-semibold text-cyan-300/75">
            {t.eyebrow} · {craftingGoalLabel(goalCategory, lang)}
          </p>
          <h4 id={`crafting-base-workbench-title-${selectedItem.id}`} className="mt-1 flex items-center gap-2 text-base font-semibold">
            <GitCompareArrows className="size-4 text-cyan-300" aria-hidden="true" />
            {t.title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {craftingBaseComparisonLabel(comparison, selectedItem, lang)}
          </p>
        </div>
        {onAdd && (
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            {t.addBase}
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-2" role="list">
        {comparison.candidates.map((candidate) => {
          const active = candidate.item.id === selectedItem.id;
          const candidateText = craftingBaseCandidateText(candidate, profile, lang);
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
                      {active ? t.currentBase : candidateText.statusLabel}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                    <div className="rounded bg-background/55 p-2">
                      <dt className="text-muted-foreground">{t.goal}</dt>
                      <dd className="mt-0.5 font-semibold">
                        {t.signals(candidate.directGoalModifierCount)}
                      </dd>
                    </div>
                    <div className="rounded bg-background/55 p-2">
                      <dt className="text-muted-foreground">{t.structure}</dt>
                      <dd className="mt-0.5 font-semibold">{candidateText.structuralLabel}</dd>
                    </div>
                    <div className="rounded bg-background/55 p-2">
                      <dt className="text-muted-foreground">{t.character}</dt>
                      <dd className="mt-0.5 font-semibold">{candidateText.requirementLabel}</dd>
                    </div>
                  </dl>
                  {candidate.hasMostDirectSignals && comparison.candidates.length > 1 && (
                    <p className="mt-2 text-[11px] font-medium text-emerald-200">
                      {t.mostSignals}
                    </p>
                  )}
                  {!active && (
                    <div className="mt-2 grid gap-2 lg:grid-cols-2" data-testid={`crafting-base-delta-${candidate.item.id}`}>
                      <div className="rounded border border-rose-500/25 bg-rose-500/[0.04] p-2">
                        <p className="text-xs font-semibold text-rose-200">
                          {t.wouldLose}
                        </p>
                        {candidate.missingComparedModifierTexts.length > 0 ? (
                          <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                            {candidate.missingComparedModifierTexts.map((text, index) => (
                              <li key={`${candidate.item.id}-missing-${index}`}>− {text}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">{t.noLostLine}</p>
                        )}
                      </div>
                      <div className="rounded border border-emerald-500/25 bg-emerald-500/[0.04] p-2">
                        <p className="text-xs font-semibold text-emerald-200">
                          {t.appearsHere}
                        </p>
                        {candidate.newComparedModifierTexts.length > 0 ? (
                          <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                            {candidate.newComparedModifierTexts.map((text, index) => (
                              <li key={`${candidate.item.id}-new-${index}`}>+ {text}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">{t.noNewLine}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {!active && (
                    <Button
                      className="mt-2"
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onChoose(candidate.item.id)}
                    >
                      {t.useBase}
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
          {t.onlyOne}
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        {t.footnote}
      </p>
    </section>
  );
}
