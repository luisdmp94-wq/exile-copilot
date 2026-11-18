import { useState, type RefObject } from "react";
import type { Item, Recommendation } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemArtwork } from "@/components/ItemArtwork";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import {
  describeItemDataState,
  describeRequirements,
  formatOptionalInt,
  formatQuality,
  groupModifiersByKind,
  rarityStyle,
} from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { useFormatLabels } from "@/lib/formatLabels";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    itemLevel: "Nivel de objeto",
    quality: "Calidad",
    craft: "Analizar y trabajar esta pieza",
    requirements: "Requisitos",
    noRequirements: "Sin requisitos registrados (desconocido).",
    modifiers: (count: number) => `Modificadores (${count})`,
    prefix: "Prefijo",
    suffix: "Sufijo",
    tier: (tier: string | number) => `· Grado ${tier}`,
    crafted: "· Fabricado",
    desecrated: "· Profanado",
    unverified: "No verificado",
    unverifiedAll:
      "Leídos del texto que copiaste del juego. «Sin verificar» solo quiere decir que no los contrastamos con una base de datos oficial de GGG, porque no hay una pública; el texto es tal cual el del juego.",
    noModifiers: "Sin modificadores registrados (desconocido).",
    origin: "Procedencia",
    noSource: "Fuente no disponible.",
    related: "Recomendaciones que evalúan este objeto",
    seeRecommendations: "Ver recomendaciones",
  },
  {
    itemLevel: "Item level",
    quality: "Quality",
    craft: "Analyse and work on this item",
    requirements: "Requirements",
    noRequirements: "No requirements recorded (unknown).",
    modifiers: (count: number) => `Modifiers (${count})`,
    prefix: "Prefix",
    suffix: "Suffix",
    tier: (tier: string | number) => `· Tier ${tier}`,
    crafted: "· Crafted",
    desecrated: "· Desecrated",
    unverified: "Not verified",
    unverifiedAll:
      "Read from the text you copied from the game. «Unverified» only means we didn't check them against an official GGG database, because there isn't a public one; the text is exactly the game's.",
    noModifiers: "No modifiers recorded (unknown).",
    origin: "Origin",
    noSource: "Source not available.",
    related: "Recommendations that evaluate this item",
    seeRecommendations: "See recommendations",
  },
);

/**
 * Detalle de un objeto del personaje. Diálogo accesible (Radix): atrapa el
 * foco, se cierra con Escape y devuelve el foco al disparador.
 *
 * Muestra únicamente datos presentes en el `Item` del snapshot. Todo campo
 * ausente se declara «Desconocido»: no se rellena con ceros ni estimaciones.
 */

/** Clases por tono de procedencia; solo "oficial" es fuente oficial de GGG. */
const TONE_BADGE: Record<"oficial" | "interna" | "sin-verificar", string> = {
  oficial: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  interna: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  "sin-verificar": "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

interface ItemDetailDialogProps {
  item: Item | null;
  /**
   * Elemento que abrió el diálogo (hueco del paperdoll o botón «Ver el objeto
   * evaluado»). Al cerrar se le devuelve el foco.
   */
  triggerRef: RefObject<HTMLElement | null>;
  /** Recomendaciones vigentes que declaran este objeto en `relatedItemIds`. */
  relatedRecommendations: Recommendation[];
  onOpenChange: (open: boolean) => void;
  /** Navegación objeto → recomendación. */
  onGoToRecommendations: () => void;
  /** Lleva esta pieza al banco dedicado, donde vive el único preflight. */
  onGoToCrafting?: (itemId: string) => void;
  /**
   * Destino de foco ALTERNATIVO al cerrar, consultado antes que el disparador.
   * Devuelve null en un cierre normal (el foco vuelve al disparador); devuelve
   * un elemento cuando el cierre forma parte de una navegación que ocultó el
   * panel del disparador (objeto → recomendaciones) y el foco no debe quedar
   * dentro de un panel oculto.
   */
  getCloseFocusTarget?: () => HTMLElement | null;
}

export function ItemDetailDialog({
  item,
  triggerRef,
  relatedRecommendations,
  onOpenChange,
  onGoToRecommendations,
  onGoToCrafting,
  getCloseFocusTarget,
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
          key={shown.id}
          item={shown}
          triggerRef={triggerRef}
          relatedRecommendations={relatedRecommendations}
          onGoToRecommendations={onGoToRecommendations}
          onGoToCrafting={onGoToCrafting}
          getCloseFocusTarget={getCloseFocusTarget}
        />
      )}
    </Dialog>
  );
}

function ItemDetailContent({
  item,
  triggerRef,
  relatedRecommendations,
  onGoToRecommendations,
  onGoToCrafting,
  getCloseFocusTarget,
}: {
  item: Item;
  triggerRef: RefObject<HTMLElement | null>;
  relatedRecommendations: Recommendation[];
  onGoToRecommendations: () => void;
  onGoToCrafting?: ItemDetailDialogProps["onGoToCrafting"];
  getCloseFocusTarget?: (() => HTMLElement | null) | undefined;
}) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const labels = useFormatLabels();
  const rarity = rarityStyle(item.rarity);
  const dataState = describeItemDataState(item, lang);
  const requirements = describeRequirements(item, lang);
  const modifierGroups = groupModifiersByKind(item);
  // Todo lo pegado del juego llega sin verificar: se explica una vez, no en cada línea.
  const allUnverified = item.modifiers.length > 0 && item.modifiers.every((mod) => !mod.verified);
  return (
    <DialogContent
      className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
      // Al cerrar, el foco vuelve explícitamente al hueco que abrió el detalle
      // (o al del objeto mostrado si se llegó desde una recomendación), en
      // lugar de quedar suelto en <body>.
      // Cascada documentada para devolver el foco al cerrar:
      //  0) si el cierre forma parte de una navegación (objeto →
      //     recomendaciones), el foco va al destino que declare
      //     `getCloseFocusTarget`, nunca al disparador de un panel oculto;
      //  1) el elemento que ABRIÓ el diálogo (hueco del paperdoll o botón
      //     «Ver el objeto evaluado»), si sigue en el documento;
      //  2) si ya no existe, el hueco de ese objeto en el paperdoll;
      //  3) si tampoco existe, no se fuerza nada y Radix aplica su
      //     comportamiento por defecto.
      onCloseAutoFocus={(event) => {
        const navTarget = getCloseFocusTarget?.() ?? null;
        if (navTarget !== null) {
          event.preventDefault();
          // preventScroll: el desplazamiento (suave o inmediato según
          // prefers-reduced-motion) ya lo hizo quien activó el área.
          navTarget.focus({ preventScroll: true });
          return;
        }
        const trigger = triggerRef.current;
        if (trigger !== null && trigger.isConnected) {
          event.preventDefault();
          trigger.focus();
          return;
        }
        const cell = document.querySelector<HTMLElement>(
          `[data-item-id="${CSS.escape(item.id)}"]`,
        );
        if (cell !== null) {
          event.preventDefault();
          cell.focus();
        }
      }}
    >
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <ItemArtwork item={item} className="size-16 rounded-md" decorative={false} />
          <div>
            <DialogTitle className={cn("text-lg", rarity.text)}>{item.name}</DialogTitle>
            <DialogDescription>
              {item.baseType} · {labels.slot[item.slot]} · {labels.rarity[item.rarity]}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn(rarity.border, rarity.text)}>
              {labels.rarity[item.rarity]}
            </Badge>
            <Badge
              variant="outline"
              className={TONE_BADGE[dataState.tone]}
              title={dataState.detail}
            >
              {dataState.label}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t.itemLevel}</dt>
              <dd data-testid="detalle-ilvl">{formatOptionalInt(item.itemLevel, lang)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t.quality}</dt>
              <dd data-testid="detalle-calidad">{formatQuality(item.quality, lang)}</dd>
            </div>
          </dl>

          {onGoToCrafting && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onGoToCrafting(item.id)}
              data-testid="trabajar-en-crafting"
            >
              {t.craft}
            </Button>
          )}

          <section className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">{t.requirements}</h4>
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
                {t.noRequirements}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              {t.modifiers(item.modifiers.length)}
            </h4>
            {allUnverified && (
              <p className="text-[11px] leading-relaxed text-muted-foreground" data-testid="mods-sin-verificar-explicacion">
                {t.unverifiedAll}
              </p>
            )}
            {modifierGroups.length > 0 ? (
              modifierGroups.map((group) => (
                <div key={group.kind} className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    {labels.modifierKind[group.kind]}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {group.mods.map((mod) => (
                      <li key={mod.id} className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          {(mod.affix || mod.name || mod.tier || mod.crafted || mod.desecrated) && (
                            <span className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                              {mod.affix && (
                                <span>{mod.affix === "prefix" ? t.prefix : t.suffix}</span>
                              )}
                              {mod.name && <span>· «{mod.name}»</span>}
                              {mod.tier && <span>{t.tier(mod.tier)}</span>}
                              {mod.crafted && <span>{t.crafted}</span>}
                              {mod.desecrated && <span>{t.desecrated}</span>}
                            </span>
                          )}
                          <span className="whitespace-pre-line">{mod.text}</span>
                          {mod.tags && mod.tags.length > 0 && (
                            <span className="text-[11px] text-sky-300/80">
                              {mod.tags.join(" · ")}
                            </span>
                          )}
                        </div>
                        {!mod.verified && !allUnverified && (
                          <span className="shrink-0 text-[11px] text-amber-300">
                            {t.unverified}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                {t.noModifiers}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">{t.origin}</h4>
            {item.sources.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {item.sources.map((source, index) => (
                  <li key={`${source.kind}-${index}`}>
                    {source.label} ({labels.sourceKind[source.kind]}) ·{" "}
                    {formatDateTime(source.retrievedAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t.noSource}</p>
            )}
            <p className="text-xs text-muted-foreground">{dataState.detail}</p>
          </section>

          {relatedRecommendations.length > 0 && (
            <section className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
              <h4 className="text-xs font-medium text-foreground">
                {t.related}
              </h4>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {relatedRecommendations.map((rec) => (
                  <li key={rec.id}>{rec.title}</li>
                ))}
              </ul>
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={onGoToRecommendations}>
                  {t.seeRecommendations}
                </Button>
              </div>
            </section>
          )}
      </div>
    </DialogContent>
  );
}
