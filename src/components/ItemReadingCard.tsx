import { BookOpenText } from "lucide-react";
import type { Item } from "@shared/domain.js";
import { readItemForPlayer, type ItemReadingLine } from "@/lib/itemReading";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    title: "Lo que tiene esta pieza",
    rolls: (high: number, middle: number, low: number) =>
      `Sus números: ${[
        high > 0 ? `${high} ${high === 1 ? "alto" : "altos"}` : null,
        middle > 0 ? `${middle} ${middle === 1 ? "medio" : "medios"}` : null,
        low > 0 ? `${low} ${low === 1 ? "bajo" : "bajos"}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}.`,
    roll: { high: "Número alto", middle: "Número medio", low: "Número bajo" },
    lines: (count: number) => `Qué hace cada línea (${count})`,
    compare: "Compararla con otra",
    resistances: "Ver mis resistencias",
    improve: "Mejorarla",
    actions: "Qué hacer con esta pieza",
  },
  {
    title: "What this item has",
    rolls: (high: number, middle: number, low: number) =>
      `Rolls: ${[high > 0 ? `${high} high` : null, middle > 0 ? `${middle} mid` : null, low > 0 ? `${low} low` : null]
        .filter(Boolean)
        .join(" · ")}.`,
    roll: { high: "High roll", middle: "Mid roll", low: "Low roll" },
    lines: (count: number) => `What each line does (${count})`,
    compare: "Compare with another",
    resistances: "Check my resistances",
    improve: "Improve it",
    actions: "What to do with this item",
  },
);

const ROLL_CLASS: Record<NonNullable<ItemReadingLine["roll"]>, string> = {
  high: "border-emerald-400/45 bg-emerald-400/10 text-emerald-200",
  middle: "border-border bg-secondary/60 text-muted-foreground",
  low: "border-amber-400/45 bg-amber-400/10 text-amber-200",
};

/** Huecos que la comparación de piezas no sabe puntuar. */
const NOT_COMPARABLE: ReadonlySet<Item["slot"]> = new Set(["other", "flask", "charm"]);

interface ItemReadingCardProps {
  item: Item;
  className?: string;
  /** El consejo de Ctrl+Alt+C sobra si quien la pinta ya avisa de la copia incompleta. */
  hideCopyTip?: boolean;
  /** Lleva la pieza a «¿Cuál de estas dos es mejor?». */
  onCompare?: (item: Item) => void;
  /** Abre la comprobación de resistencias del personaje. */
  onCheckResistances?: () => void;
  /** Lleva a la pregunta «¿qué quieres mejorar?». */
  onImprove?: () => void;
}

/**
 * «Lo que tiene esta pieza»: la respuesta inmediata al pegar un objeto.
 *
 * A la vista, una frase y como mucho dos avisos; el detalle línea a línea va
 * plegado. Termina en tres salidas hacia lo que la web ya sabe hacer.
 */
export function ItemReadingCard({
  item,
  className,
  hideCopyTip = false,
  onCompare,
  onCheckResistances,
  onImprove,
}: ItemReadingCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const reading = readItemForPlayer(item, lang);
  const notes = reading.copyTip && !hideCopyTip ? [...reading.notes, reading.copyTip] : reading.notes;
  const count = (band: NonNullable<ItemReadingLine["roll"]>) => reading.lines.filter((line) => line.roll === band).length;
  const actionClass =
    "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none";

  return (
    <section
      className={cn("min-w-0 rounded-md border border-border/70 px-3 py-2.5 text-sm", className)}
      aria-labelledby="lectura-pieza-titulo"
      data-testid="lectura-pieza"
    >
      <h3 id="lectura-pieza-titulo" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpenText className="size-3.5 shrink-0" aria-hidden="true" />
        {t.title}
      </h3>
      <p className="mt-1.5 font-medium text-foreground" data-testid="lectura-pieza-frase">
        {reading.headline}
      </p>
      {reading.hasRolls && (
        <p className="mt-1 text-muted-foreground" data-testid="lectura-pieza-tiradas">
          {t.rolls(count("high"), count("middle"), count("low"))}
        </p>
      )}
      {notes.map((note) => (
        <p key={note} className="mt-1 text-muted-foreground" data-testid="lectura-pieza-aviso">
          {note}
        </p>
      ))}

      {reading.lines.length > 0 && (
        <details className="mt-2" data-testid="lectura-pieza-lineas">
          <summary className="cursor-pointer text-xs font-medium text-primary">{t.lines(reading.lines.length)}</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {reading.lines.map((line) => (
              <li key={line.id} className="min-w-0" data-family={line.family}>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 break-words text-foreground">{line.text}</span>
                  {line.roll && (
                    <span className={cn("inline-block whitespace-nowrap rounded-full border px-2 py-px text-[0.6875rem]", ROLL_CLASS[line.roll])}>
                      {t.roll[line.roll]}
                    </span>
                  )}
                </p>
                {line.meaning && <p className="text-xs text-muted-foreground">{line.meaning}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={t.actions}>
        {onCompare && !NOT_COMPARABLE.has(item.slot) && (
          <button type="button" className={actionClass} onClick={() => onCompare(item)} data-testid="lectura-pieza-comparar">
            {t.compare}
          </button>
        )}
        {onCheckResistances && (
          <button type="button" className={actionClass} onClick={onCheckResistances} data-testid="lectura-pieza-resistencias">
            {t.resistances}
          </button>
        )}
        {onImprove && (
          <button type="button" className={actionClass} onClick={onImprove} data-testid="lectura-pieza-mejorar">
            {t.improve}
          </button>
        )}
      </div>
    </section>
  );
}
