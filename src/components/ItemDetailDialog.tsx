import { useState } from "react";
import type { Item, Recommendation } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MODIFIER_KIND_LABELS, RARITY_LABELS, SLOT_LABELS, formatDateTime } from "@/lib/format";
import {
  describeItemDataState,
  describeRequirements,
  formatOptionalInt,
  formatQuality,
  groupModifiersByKind,
  rarityStyle,
} from "@/lib/equipment";
import { cn } from "@/lib/utils";

/**
 * Detalle de un objeto del personaje. Diálogo accesible (Radix): atrapa el
 * foco, se cierra con Escape y devuelve el foco al disparador.
 *
 * Muestra únicamente datos presentes en el `Item` del snapshot. Todo campo
 * ausente se declara «Desconocido»: no se rellena con ceros ni estimaciones.
 */

interface ItemDetailDialogProps {
  item: Item | null;
  /** Recomendaciones vigentes que declaran este objeto en `relatedItemIds`. */
  relatedRecommendations: Recommendation[];
  onOpenChange: (open: boolean) => void;
  /** Navegación objeto → recomendación. */
  onGoToRecommendations: () => void;
}

export function ItemDetailDialog({
  item,
  relatedRecommendations,
  onOpenChange,
  onGoToRecommendations,
}: ItemDetailDialogProps) {
  // Accesibilidad del cierre: Radix devuelve el foco al elemento que abrió el
  // diálogo, pero necesita que el contenido siga montado mientras se cierra.
  // Por eso se conserva el último objeto mostrado y el desmontaje lo decide
  // `open`, no una condición nuestra. (Ajuste de estado durante el render del
  // propio componente, patrón recomendado por React.)
  const [lastItem, setLastItem] = useState<Item | null>(item);
  if (item !== null && item !== lastItem) setLastItem(item);
  const shown = item ?? lastItem;

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      {shown !== null && (
        <ItemDetailContent
          item={shown}
          relatedRecommendations={relatedRecommendations}
          onGoToRecommendations={onGoToRecommendations}
        />
      )}
    </Dialog>
  );
}

function ItemDetailContent({
  item,
  relatedRecommendations,
  onGoToRecommendations,
}: {
  item: Item;
  relatedRecommendations: Recommendation[];
  onGoToRecommendations: () => void;
}) {
  const rarity = rarityStyle(item.rarity);
  const dataState = describeItemDataState(item);
  const requirements = describeRequirements(item);
  const modifierGroups = groupModifiersByKind(item);

  return (
    <DialogContent
      className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
      // Al cerrar, el foco vuelve explícitamente al hueco que abrió el detalle
      // (o al del objeto mostrado si se llegó desde una recomendación), en
      // lugar de quedar suelto en <body>.
      onCloseAutoFocus={(event) => {
        const selector = `[data-item-id="${CSS.escape(item.id)}"]`;
        const trigger = document.querySelector<HTMLElement>(selector);
        if (trigger !== null) {
          event.preventDefault();
          trigger.focus();
        }
      }}
    >
        <DialogHeader>
          <DialogTitle className={cn("text-lg", rarity.text)}>{item.name}</DialogTitle>
          <DialogDescription>
            {item.baseType} · {SLOT_LABELS[item.slot]} · {RARITY_LABELS[item.rarity]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn(rarity.border, rarity.text)}>
              {RARITY_LABELS[item.rarity]}
            </Badge>
            <Badge
              variant="outline"
              className={
                dataState.origin === "oficial"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              }
              title={dataState.detail}
            >
              {dataState.label}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Nivel de objeto</dt>
              <dd data-testid="detalle-ilvl">{formatOptionalInt(item.itemLevel)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Calidad</dt>
              <dd data-testid="detalle-calidad">{formatQuality(item.quality)}</dd>
            </div>
          </dl>

          <section className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">Requisitos</h4>
            {requirements.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {requirements.map((req) => (
                  <li key={req} className="rounded border border-border px-1.5 py-0.5 text-xs">
                    {req}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin requisitos registrados (desconocido).
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              Modificadores ({item.modifiers.length})
            </h4>
            {modifierGroups.length > 0 ? (
              modifierGroups.map((group) => (
                <div key={group.kind} className="flex flex-col gap-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {MODIFIER_KIND_LABELS[group.kind]}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {group.mods.map((mod) => (
                      <li key={mod.id} className="flex items-start justify-between gap-2">
                        <span>{mod.text}</span>
                        {!mod.verified && (
                          <span className="shrink-0 text-[11px] text-amber-300">
                            No verificado
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin modificadores registrados (desconocido).
              </p>
            )}
          </section>

          <section className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">Procedencia</h4>
            {item.sources.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {item.sources.map((source, index) => (
                  <li key={`${source.kind}-${index}`}>
                    {source.label} ({source.kind}) · {formatDateTime(source.retrievedAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Fuente no disponible.</p>
            )}
            <p className="text-xs text-muted-foreground">{dataState.detail}</p>
          </section>

          {relatedRecommendations.length > 0 && (
            <section className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
              <h4 className="text-xs font-medium text-foreground">
                Recomendaciones que evalúan este objeto
              </h4>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {relatedRecommendations.map((rec) => (
                  <li key={rec.id}>{rec.title}</li>
                ))}
              </ul>
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={onGoToRecommendations}>
                  Ver recomendaciones
                </Button>
              </div>
            </section>
          )}
      </div>
    </DialogContent>
  );
}
