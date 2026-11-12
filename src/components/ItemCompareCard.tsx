import { useMemo, useState } from "react";
import { Loader2, Scale, Trophy, X } from "lucide-react";
import type { Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import { looksLikeItemText } from "@/lib/guideCheck";
import { COMPARE_STYLES, compareItems, type CompareSide, type CompareStyle } from "@/lib/itemCompare";
import { cn } from "@/lib/utils";

const STYLE_STORAGE_KEY = "exile-copilot:comparar-estilo";

function readStoredStyle(): CompareStyle {
  try {
    const stored = window.localStorage.getItem(STYLE_STORAGE_KEY);
    return COMPARE_STYLES.some((style) => style.id === stored) ? (stored as CompareStyle) : "caster";
  } catch {
    return "caster";
  }
}

interface SlotState {
  item: Item | null;
  draft: string;
  busy: boolean;
  error: string | null;
}

const EMPTY_SLOT: SlotState = { item: null, draft: "", busy: false, error: null };

interface ItemCompareCardProps {
  patch: string;
}

/**
 * «¿Cuál de estas dos es mejor?»: se pegan dos piezas copiadas del juego y la
 * tarjeta dice cuál conviene según el estilo de juego, fila a fila.
 */
export function ItemCompareCard({ patch }: ItemCompareCardProps) {
  const [slots, setSlots] = useState<Record<CompareSide, SlotState>>({ a: EMPTY_SLOT, b: EMPTY_SLOT });
  const [style, setStyle] = useState<CompareStyle>(readStoredStyle);

  const patchSlot = (side: CompareSide, next: Partial<SlotState>) =>
    setSlots((current) => ({ ...current, [side]: { ...current[side], ...next } }));

  const readItem = async (side: CompareSide, text: string) => {
    if (!text.trim()) {
      patchSlot(side, { error: "Pega primero el texto de una pieza." });
      return;
    }
    patchSlot(side, { busy: true, error: null });
    try {
      const { item } = await api.importItemText({ text, patch });
      if (item.slot === "other" || item.slot === "flask") {
        patchSlot(side, { busy: false, draft: text, error: `«${item.name}» no es una pieza de equipo (arma, armadura o joyería).` });
        return;
      }
      patchSlot(side, { item, draft: "", busy: false, error: null });
    } catch (err) {
      patchSlot(side, {
        busy: false,
        draft: text,
        error:
          err instanceof ApiRequestError && err.message === "texto-de-objeto-no-reconocido"
            ? "Eso no parece un objeto de PoE2. Pon el ratón encima de la pieza, pulsa Ctrl+C y pega aquí todo el texto."
            : getErrorMessage(err),
      });
    }
  };

  const chooseStyle = (next: CompareStyle) => {
    setStyle(next);
    try {
      window.localStorage.setItem(STYLE_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento la elección vale para esta visita.
    }
  };

  const { a, b } = slots;
  const result = useMemo(
    () => (a.item && b.item ? compareItems(a.item, b.item, style) : null),
    [a.item, b.item, style],
  );
  const names: Record<CompareSide, string> = { a: a.item?.name ?? "Pieza A", b: b.item?.name ?? "Pieza B" };

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="comparar-titulo"
      data-testid="comparar"
    >
      <h2 id="comparar-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Scale className="size-5 shrink-0 text-primary" aria-hidden="true" />
        ¿Cuál de estas dos es mejor?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Copia cada pieza en el juego con Ctrl+C y pégala en su casilla. Te digo cuál conviene y por qué.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["a", "b"] as const).map((side) => {
          const slot = slots[side];
          const label = side === "a" ? "Pieza A" : "Pieza B";
          return (
            <div key={side} data-testid={`comparar-${side}`}>
              {slot.item ? (
                <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted-foreground">{label} · </span>
                    {slot.item.name}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Quitar ${slot.item.name}`}
                    onClick={() => patchSlot(side, EMPTY_SLOT)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  <Textarea
                    value={slot.draft}
                    aria-label={`${label}: pega aquí el objeto`}
                    onChange={(event) => patchSlot(side, { draft: event.target.value, error: null })}
                    onPaste={(event) => {
                      // Un objeto copiado del juego se lee al pegarlo, sin botón.
                      if (slot.busy) return;
                      const text = event.clipboardData.getData("text");
                      if (!looksLikeItemText(text)) return;
                      event.preventDefault();
                      void readItem(side, text);
                    }}
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={`${label}: pega aquí con Ctrl+V`}
                    data-testid={`comparar-texto-${side}`}
                  />
                  {slot.draft.trim() !== "" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={slot.busy}
                      onClick={() => void readItem(side, slot.draft)}
                    >
                      {slot.busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                      Leer pieza
                    </Button>
                  )}
                </>
              )}
              {slot.error && (
                <p className="mt-2 text-sm text-rose-300" role="alert">
                  {slot.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Tu estilo de juego">
        <span className="text-sm text-muted-foreground">Juegas con:</span>
        {COMPARE_STYLES.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={style === option.id ? "secondary" : "outline"}
            aria-pressed={style === option.id}
            onClick={() => chooseStyle(option.id)}
            data-testid={`comparar-estilo-${option.id}`}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {result && (
        <div className="mt-4 border-t border-border pt-4" data-testid="comparar-resultado">
          <p className="flex items-start gap-2 text-base font-semibold text-foreground" data-testid="comparar-veredicto">
            <Trophy className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
            {result.winner === "tie" ? "Muy parejas: no hay una ganadora clara." : `Mejor para ti: ${names[result.winner]}`}
          </p>
          {result.slotWarning && <p className="mt-1 text-sm text-amber-200">{result.slotWarning}</p>}
          <ul className="mt-2 space-y-1 text-sm leading-relaxed text-foreground/90">
            {(result.winner === "tie" ? result.reasons.slice(1) : result.reasons).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-normal"> </th>
                <th className="py-1 pr-2 font-normal">A · {names.a}</th>
                <th className="py-1 font-normal">B · {names.b}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60 align-top">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  {(["a", "b"] as const).map((side) => (
                    <td
                      key={side}
                      className={cn(
                        "py-1.5 pr-2",
                        row.winner === side ? "font-semibold text-emerald-200" : "text-foreground/70",
                      )}
                    >
                      {row[side]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {(result.wasted.a.length > 0 || result.wasted.b.length > 0) && (
            <div className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="comparar-sobra">
              <p className="font-semibold text-foreground/80">No lo aprovechas con ese estilo:</p>
              {(["a", "b"] as const).map(
                (side) =>
                  result.wasted[side].length > 0 && (
                    <p key={side}>
                      {side.toUpperCase()} · {result.wasted[side].join(" · ")}
                    </p>
                  ),
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Comparo solo lo que pone en las dos piezas. No miro tu árbol de pasivas ni tus gemas: si tu personaje depende
            de algo muy concreto, manda eso.
          </p>
        </div>
      )}
    </section>
  );
}
