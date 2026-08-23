import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import { CRAFTING_ACADEMY_EXERCISE_NOTICE } from "@shared/craftingAcademy.js";
import type { Item, ItemRarity } from "@shared/domain.js";
import { ItemArtwork } from "@/components/ItemArtwork";
import { cn } from "@/lib/utils";

const RARITY_LABEL: Partial<Record<ItemRarity, string>> = {
  normal: "Normal",
  magic: "Mágico",
  rare: "Raro",
};

const RARITY_CLASS: Partial<Record<ItemRarity, string>> = {
  normal: "border-slate-400/45 bg-slate-400/10 text-slate-200",
  magic: "border-sky-400/50 bg-sky-400/10 text-sky-200",
  rare: "border-amber-300/50 bg-amber-300/10 text-amber-200",
};

/** Casilla de un afijo: ocupada (con su texto) o libre (hueco disponible). */
function AffixSlot({ text, family }: { text: string | null; family: "Prefijo" | "Sufijo" }) {
  const filled = text !== null;
  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-sm border px-2.5 py-1.5 text-xs ${
        filled
          ? "border-border bg-background/60 text-foreground"
          : "border-dashed border-border/60 bg-transparent text-muted-foreground"
      }`}
      data-slot-state={filled ? "ocupado" : "libre"}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${filled ? "bg-primary" : "bg-muted-foreground/45"}`}
      />
      <span className="sr-only">{family}: </span>
      <span className="min-w-0 flex-1 break-words">{filled ? text : "Hueco disponible"}</span>
    </li>
  );
}

/**
 * Objeto protagonista de la Academia.
 *
 * Dibuja rareza, prefijos, sufijos y huecos con la MISMA lectura estructural
 * que usa el banco (`diagnoseCraftingItem`). No añade grados, valor ni
 * probabilidad, y deja siempre visible que es un ejercicio.
 */
export function AcademyItemBoard({
  item,
  concealCounters = false,
  className,
}: {
  item: Item;
  /**
   * Oculta los contadores YA calculados (rareza, totales, huecos) mientras la
   * pregunta trata justamente de leerlos. Los modificadores siguen a la vista:
   * el ejercicio es contarlos, no que la tarjeta los cuente por ti.
   */
  concealCounters?: boolean;
  className?: string;
}) {
  const diagnosis = diagnoseCraftingItem(item);
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const prefixes = explicit.filter((modifier) => modifier.affix === "prefix");
  const suffixes = explicit.filter((modifier) => modifier.affix === "suffix");
  const limit = diagnosis.observedTotalLimit;
  const open = diagnosis.observedOpenSlots;
  // Los huecos libres se reparten visualmente detrás de cada familia sin
  // afirmar en cuál caerá el próximo modificador: el límite observado es TOTAL.
  const freeSlots = open ?? 0;

  return (
    <div
      className={cn("superficie-panel min-w-0 overflow-hidden", className)}
      data-testid="academia-objeto"
      data-rarity={concealCounters ? "oculta" : item.rarity}
      data-open-slots={concealCounters || open === null ? "desconocido" : String(open)}
    >
      <p className="border-b border-border/70 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
        Ejercicio de aprendizaje
      </p>

      <div className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
        <ItemArtwork item={item} className="size-16 rounded-md sm:size-20" decorative={false} />
        <div className="min-w-0 flex-1">
          <h3 className="dossier-title text-lg font-semibold leading-tight sm:text-xl">{item.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.baseType} · nivel de objeto {item.itemLevel ?? "desconocido"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {concealCounters ? (
              <span
                data-testid="academia-rareza"
                className="rounded-sm border border-dashed border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                Rareza: léela tú
              </span>
            ) : (
              <>
                <span
                  data-testid="academia-rareza"
                  className={`rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${RARITY_CLASS[item.rarity] ?? "border-border text-muted-foreground"}`}
                >
                  {RARITY_LABEL[item.rarity] ?? item.rarity}
                </span>
                <span className="rounded-sm border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {explicit.length}
                  {limit === null ? "" : `/${limit}`} modificador{explicit.length === 1 ? "" : "es"}
                </span>
                {open !== null && (
                  <span
                    data-testid="academia-huecos"
                    className="rounded-sm border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {open === 0
                      ? "Sin huecos"
                      : `${open} hueco${open === 1 ? "" : "s"} libre${open === 1 ? "" : "s"}`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {item.rarity === "normal" ? (
        <p className="border-t border-border/70 px-3 py-3 text-xs text-muted-foreground sm:px-4">
          Un objeto normal no tiene modificadores explícitos: no hay prefijos ni sufijos que leer todavía.
        </p>
      ) : (
        <div className="grid gap-3 border-t border-border/70 p-3 sm:p-4">
          <section className="min-w-0" aria-labelledby={`prefijos-${item.id}`}>
            <h4
              id={`prefijos-${item.id}`}
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Prefijos{concealCounters ? "" : ` · ${prefixes.length}`}
            </h4>
            <ul className="flex min-w-0 flex-col gap-1.5" data-testid="academia-prefijos">
              {prefixes.map((modifier) => (
                <AffixSlot key={modifier.id} text={modifier.text} family="Prefijo" />
              ))}
              {prefixes.length === 0 && <AffixSlot text={null} family="Prefijo" />}
            </ul>
          </section>
          <section className="min-w-0" aria-labelledby={`sufijos-${item.id}`}>
            <h4
              id={`sufijos-${item.id}`}
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Sufijos{concealCounters ? "" : ` · ${suffixes.length}`}
            </h4>
            <ul className="flex min-w-0 flex-col gap-1.5" data-testid="academia-sufijos">
              {suffixes.map((modifier) => (
                <AffixSlot key={modifier.id} text={modifier.text} family="Sufijo" />
              ))}
              {suffixes.length === 0 && <AffixSlot text={null} family="Sufijo" />}
            </ul>
          </section>
          {!concealCounters && freeSlots > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Quedan {freeSlots} hueco{freeSlots === 1 ? "" : "s"} en total. Un hueco dice que cabe algo
              más, no que vaya a servirte.
            </p>
          )}
        </div>
      )}

      <p className="border-t border-border/70 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground sm:px-4">
        {CRAFTING_ACADEMY_EXERCISE_NOTICE}
      </p>
    </div>
  );
}
