import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import { readItemInPlainWords } from "@shared/craftingCoach.js";
import type { Item, ItemRarity } from "@shared/domain.js";
import { ItemArtwork } from "@/components/ItemArtwork";
import { cn } from "@/lib/utils";

const RARITY_CLASS: Partial<Record<ItemRarity, string>> = {
  normal: "border-slate-400/45 bg-slate-400/10 text-slate-200",
  magic: "border-sky-400/50 bg-sky-400/10 text-sky-200",
  rare: "border-amber-300/50 bg-amber-300/10 text-amber-200",
};

const RARITY_WORD: Partial<Record<ItemRarity, string>> = {
  normal: "Normal",
  magic: "Mágico",
  rare: "Raro",
};

/**
 * La pieza real del jugador, como protagonista.
 *
 * Responde «¿qué objeto estamos mirando?» y «¿qué tiene ahora?» en una frase,
 * con los modificadores tal y como el juego los muestra. No enseña estados
 * internos, ni enums, ni contadores sueltos sin explicar.
 */
export function CoachItemCard({
  item,
  className,
  compact = false,
}: {
  item: Item;
  className?: string;
  compact?: boolean;
}) {
  const reading = readItemInPlainWords(item);
  const diagnosis = diagnoseCraftingItem(item);
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const openSlots = reading.openSlots ?? 0;

  return (
    <div
      className={cn("superficie-panel min-w-0 overflow-hidden", className)}
      data-testid="coach-objeto"
      data-rarity={item.rarity}
      data-open-slots={reading.openSlots === null ? "desconocido" : String(reading.openSlots)}
    >
      <div className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
        <ItemArtwork item={item} className="size-14 rounded-md sm:size-16" decorative={false} />
        <div className="min-w-0 flex-1">
          <h3 className="dossier-title text-lg font-semibold leading-tight sm:text-xl">
            {item.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.baseType}</p>
          <span
            className={cn(
              "mt-1.5 inline-block rounded-sm border px-2 py-0.5 text-[11px] font-semibold",
              RARITY_CLASS[item.rarity] ?? "border-border text-muted-foreground",
            )}
          >
            {RARITY_WORD[item.rarity] ?? item.rarity}
          </span>
        </div>
      </div>

      {(!compact || reading.readable) && (
        <p
          className="border-t border-border/70 px-3 py-2.5 text-sm leading-relaxed sm:px-4"
          data-testid="coach-objeto-resumen"
        >
          {reading.sentence}
        </p>
      )}

      {!compact && explicit.length > 0 && (
        <details className="border-t border-border/70 p-3 sm:p-4">
          <summary className="cursor-pointer text-xs font-medium">
            Lo que ya tiene y se conserva ({explicit.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5" data-testid="coach-modificadores">
          {explicit.map((modifier) => (
            <li
              key={modifier.id}
              className="flex min-w-0 items-start gap-2 rounded-sm border border-border bg-background/60 px-2.5 py-1.5 text-xs"
            >
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 break-words">{modifier.text}</span>
            </li>
          ))}
          {openSlots > 0 &&
            Array.from({ length: openSlots }, (_, index) => (
              <li
                key={`hueco-${index}`}
                className="flex min-w-0 items-start gap-2 rounded-sm border border-dashed border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground"
                data-testid="coach-hueco-libre"
              >
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/45" />
                <span className="min-w-0 flex-1">Sitio libre</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!compact && !reading.readable && (
        <p
          className="border-t border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-amber-100 sm:px-4"
          data-testid="coach-objeto-incompleto"
        >
          {diagnosis.blockers[0] ?? "Falta información del texto copiado."}
        </p>
      )}
    </div>
  );
}
