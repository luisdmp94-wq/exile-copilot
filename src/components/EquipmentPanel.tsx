import {
  Circle,
  Crosshair,
  FlaskConical,
  Footprints,
  Gem,
  HardHat,
  Hand,
  Package,
  Plus,
  RectangleHorizontal,
  Shield,
  Shirt,
  Sword,
  type LucideIcon,
} from "lucide-react";
import type { Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { useFormatLabels } from "@/lib/formatLabels";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    title: "Equipo de tu personaje",
    counts: (equipped: number, empty: number) => `${equipped} equipado(s) · ${empty} vacío(s)`,
    flasks: (count: number) => `Frascos y viales (${count})`,
    noFlasks: "Sin información de frascos.",
    diagnosis: "Diagnóstico",
    diagnosisSummary: (items: number, empty: number, unverified: number) =>
      ` · ${items} objetos · ${empty} huecos · ${unverified} mods sin verificar`,
    registered: "Objetos registrados",
    emptySlots: "Ranuras vacías",
    byYou: "Objetos indicados por ti",
    noSource: "Objetos sin fuente",
    unverifiedMods: "Modificadores sin verificar",
    highlighted: "Señalados por recomendaciones",
    scope: "Solo tu equipo real; sin puntuaciones, comparación con el meta ni objetos de una build objetivo.",
    others: (count: number) => `Otros objetos (${count})`,
    emptySlot: "Ranura vacía",
    addPiece: "Añadir pieza",
    pasteHere: "Pegar pieza",
    addToSlot: (slot: string) => `${slot}: ranura vacía. Pegar una pieza`,
    pointedOut: ". Señalado por una recomendación",
  },
  {
    title: "Your character's gear",
    counts: (equipped: number, empty: number) => `${equipped} equipped · ${empty} empty`,
    flasks: (count: number) => `Flasks and charms (${count})`,
    noFlasks: "No flask information.",
    diagnosis: "Diagnosis",
    diagnosisSummary: (items: number, empty: number, unverified: number) =>
      ` · ${items} items · ${empty} empty slots · ${unverified} unverified modifiers`,
    registered: "Recorded items",
    emptySlots: "Empty slots",
    byYou: "Items you entered",
    noSource: "Items without a source",
    unverifiedMods: "Unverified modifiers",
    highlighted: "Pointed out by recommendations",
    scope: "Only your real gear; no scores, no meta comparison and no items from a target build.",
    others: (count: number) => `Other items (${count})`,
    emptySlot: "Empty slot",
    addPiece: "Add an item",
    pasteHere: "Paste an item",
    addToSlot: (slot: string) => `${slot}: empty slot. Paste an item`,
    pointedOut: ". Pointed out by a recommendation",
  },
);
import {
  buildEquipmentLayout,
  computeEquipmentDiagnostics,
  describeItemDataState,
  rarityStyle,
  type EquipmentSlot,
} from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { ItemArtwork } from "@/components/ItemArtwork";

/**
 * Paperdoll táctica con diagnóstico contextual — equipo del PERSONAJE ACTUAL.
 *
 * Fuente de datos: exclusivamente `profile.items` (CharacterProfileSnapshot).
 * Las pistas `inventory_slots` de un plan `.build` importado NO llegan aquí:
 * son un plan, no equipo, y viven en la sección «Build objetivo».
 *
 * Composición abstracta propia (sin silueta humana ni copia de la interfaz del
 * juego). Iconos: formas genéricas de lucide-react, ya presente en el
 * proyecto. Sin imágenes externas, arte oficial ni marcadores que simulen un
 * objeto real. Sin tipografías ni recursos remotos.
 */

/** Icono abstracto por tipo de hueco. Genérico a propósito: no es arte del juego. */
const SLOT_ICONS: Record<EquipmentSlot, LucideIcon> = {
  weapon: Sword,
  offhand: Shield,
  helmet: HardHat,
  body: Shirt,
  gloves: Hand,
  boots: Footprints,
  belt: RectangleHorizontal,
  amulet: Gem,
  ring1: Circle,
  ring2: Circle,
};

/**
 * Posición en la paperdoll abstracta (solo a partir de `lg`).
 * Armadura en la columna central, armas a los lados, accesorios a la derecha.
 * Por debajo de `lg` se ignora y las celdas fluyen como cuadrícula legible,
 * utilizable desde 360 px con dos columnas.
 */
const SLOT_POSITION: Record<EquipmentSlot, string> = {
  weapon: "lg:col-start-1 lg:row-start-1 lg:row-span-2",
  helmet: "lg:col-start-2 lg:row-start-1",
  offhand: "lg:col-start-3 lg:row-start-1 lg:row-span-2",
  body: "lg:col-start-2 lg:row-start-2",
  gloves: "lg:col-start-1 lg:row-start-3",
  belt: "lg:col-start-2 lg:row-start-3",
  boots: "lg:col-start-3 lg:row-start-3",
  amulet: "lg:col-start-1 lg:row-start-4",
  ring1: "lg:col-start-2 lg:row-start-4",
  ring2: "lg:col-start-3 lg:row-start-4",
};

/** Tono por procedencia: solo "oficial" corresponde a una fuente oficial de GGG. */
const TONE_CLASSES: Record<"oficial" | "interna" | "sin-verificar", string> = {
  oficial: "text-emerald-300",
  interna: "text-sky-300",
  "sin-verificar": "text-amber-300",
};

/** Superficie oscura diferenciada con sombra interior muy sutil (profundidad). */
const SURFACE = "bg-background/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]";

/**
 * Selección por vínculo estructurado (`relatedItemIds`).
 *
 * Violeta a propósito: el ámbar ya significa «sin verificar» en la procedencia
 * del objeto (y es el color de acción de la aplicación), el esmeralda «oficial»
 * y el azul «interna». Reutilizar cualquiera de ellos haría que una celda
 * señalada se leyera como un dato dudoso. Además del color hay icono y texto,
 * así que la marca no depende de distinguir el tono.
 */
const SELECTED_RING = "ring-2 ring-violet-400 ring-offset-1 ring-offset-background";
const SELECTED_TEXT = "text-violet-200";

interface EquipmentPanelProps {
  items: Item[];
  /** Ids señalados por recomendaciones (vínculo estructurado; vacío si no lo hay). */
  highlightedItemIds: Set<string>;
  /** Pieza que el jugador está usando como contexto actual del Mentor. */
  activeItemId?: string | null;
  /** Recibe también el elemento pulsado para devolverle el foco al cerrar. */
  onSelectItem: (item: Item, trigger: HTMLElement) => void;
  /** Abre «Añadir equipo». Con esto, las ranuras vacías también se pueden pulsar. */
  onAddItem?: () => void;
}

export function EquipmentPanel({
  items,
  highlightedItemIds,
  activeItemId = null,
  onSelectItem,
  onAddItem,
}: EquipmentPanelProps) {
  const t = useText(TEXT);
  const layout = buildEquipmentLayout(items);
  const diagnostics = computeEquipmentDiagnostics(layout, highlightedItemIds);

  return (
    <section
      aria-labelledby="equipo-titulo"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-end">
        {/* El rótulo visible es el «Equipo» de la sección: este queda para lectores de pantalla. */}
        <h3 id="equipo-titulo" className="sr-only">
          {t.title}
        </h3>
        <span className="text-xs text-muted-foreground" data-testid="equipo-recuento">
          {t.counts(diagnostics.equipped, diagnostics.emptySlots)}
        </span>
      </div>
      {/* La paperdoll manda: ocupa todo el ancho y empieza cuanto antes, para
          que quepa entera en el primer viewport de escritorio. Las dos
          aclaraciones de alcance (equipo real, sin puntuaciones) acompañan al
          diagnóstico, debajo: siguen visibles, solo que no empujan la
          cuadrícula fuera de la pantalla. */}
      <div className="flex flex-col gap-4">
        <div>
          <ul
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 lg:grid-rows-4"
            data-testid="equipment-grid"
          >
            {layout.cells.map((cell) => (
              <li key={cell.slot} className={SLOT_POSITION[cell.slot]}>
                <EquipmentCellButton
                  slot={cell.slot}
                  item={cell.item}
                  highlighted={cell.item !== null && highlightedItemIds.has(cell.item.id)}
                  active={cell.item !== null && cell.item.id === activeItemId}
                  onSelect={onSelectItem}
                  onAdd={onAddItem}
                />
              </li>
            ))}
          </ul>

          {onAddItem && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={onAddItem}
              data-testid="equipo-anadir-pieza"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t.pasteHere}
            </Button>
          )}

          {/* Frascos: grupo derivado de los datos reales, sin número fijo. */}
          <div className={cn("mt-2 flex flex-col gap-1.5", items.length === 0 && "hidden")} data-testid="flask-group">
            <h4 className="rotulo-seccion text-muted-foreground">
              {t.flasks(layout.flaskItems.length)}
            </h4>
            {layout.flaskItems.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {layout.flaskItems.map((flask) => (
                  <li key={flask.id}>
                    <EquipmentCellButton
                      slot="flask"
                      item={flask}
                      highlighted={highlightedItemIds.has(flask.id)}
                      active={flask.id === activeItemId}
                      onSelect={onSelectItem}
                  onAdd={onAddItem}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className={cn(
                  "rounded-md border border-dashed border-border/70 p-2 text-xs text-muted-foreground",
                  SURFACE,
                )}
              >
                {t.noFlasks}
              </p>
            )}
          </div>
        </div>

        <details
          // Sin ninguna pieza no hay nada que diagnosticar: se enseña al pegar la primera.
          className={cn("group rounded-md border border-border px-3 py-2", SURFACE, items.length === 0 && "hidden")}
          data-testid="equipment-diagnostics"
        >
          <summary className="-my-2 block cursor-pointer list-none py-3 text-xs text-muted-foreground marker:content-none group-open:mb-0">
            <span className="font-medium text-foreground">{t.diagnosis}</span>
            {t.diagnosisSummary(diagnostics.equipped, diagnostics.emptySlots, diagnostics.unverifiedModifiers)}
          </summary>
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              <DiagnosticRow label={t.registered} value={diagnostics.equipped} />
              <DiagnosticRow label={t.emptySlots} value={diagnostics.emptySlots} />
              <DiagnosticRow label={t.byYou} value={diagnostics.userProvided} />
              <DiagnosticRow label={t.noSource} value={diagnostics.withoutSource} />
              <DiagnosticRow
                label={t.unverifiedMods}
                value={diagnostics.unverifiedModifiers}
              />
              {diagnostics.highlighted > 0 && (
                <DiagnosticRow
                  label={t.highlighted}
                  value={diagnostics.highlighted}
                  emphasis
                />
              )}
            </dl>
            <p className="text-[11px] text-muted-foreground">
              {t.scope}
            </p>
          </div>
        </details>
      </div>

      {layout.extraItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="rotulo-seccion text-muted-foreground">
            {t.others(layout.extraItems.length)}
          </h4>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {layout.extraItems.map((item) => (
              <li key={item.id}>
                <EquipmentCellButton
                  slot={null}
                  item={item}
                  highlighted={highlightedItemIds.has(item.id)}
                  active={item.id === activeItemId}
                  onSelect={onSelectItem}
                  onAdd={onAddItem}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DiagnosticRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          emphasis ? SELECTED_TEXT : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

interface EquipmentCellButtonProps {
  /** "flask" para un frasco del grupo; null = objeto fuera de los huecos canónicos. */
  slot: EquipmentSlot | "flask" | null;
  item: Item | null;
  highlighted: boolean;
  active: boolean;
  onSelect: (item: Item, trigger: HTMLElement) => void;
  onAdd?: () => void;
}

function EquipmentCellButton({ slot, item, highlighted, active, onSelect, onAdd }: EquipmentCellButtonProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const labels = useFormatLabels();
  const Icon =
    slot === null ? Package : slot === "flask" ? FlaskConical : SLOT_ICONS[slot];
  const slotLabel = slot === null ? labels.slot.other : labels.slot[slot];

  // Hueco vacío con «Añadir equipo» a mano: pulsarlo lleva a pegar una pieza.
  if (item === null && onAdd) {
    return (
      <button
        type="button"
        data-slot-state="empty"
        data-slot={slot ?? "other"}
        onClick={onAdd}
        aria-label={t.addToSlot(slotLabel)}
        title={t.addToSlot(slotLabel)}
        className={cn(
          "gear-slot group flex h-full min-h-20 w-full flex-col items-center justify-center gap-1.5 border border-dashed border-border p-2 text-center",
          "text-muted-foreground/70 transition-colors hover:border-primary/60 hover:bg-primary/[0.05] hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Icon className="size-5 shrink-0 group-hover:hidden" aria-hidden="true" />
        <Plus className="hidden size-5 shrink-0 group-hover:block" aria-hidden="true" />
        <span className="text-xs">{slotLabel}</span>
        <span className="sr-only">{t.emptySlot}</span>
      </button>
    );
  }

  // Hueco vacío sin esa opción: no es un botón, no hay nada que abrir.
  if (item === null) {
    return (
      <div
        data-slot-state="empty"
        data-slot={slot ?? "other"}
        title={`${slotLabel}: ${t.emptySlot}`}
        className="gear-slot flex h-full min-h-20 flex-col items-center justify-center gap-1.5 border border-dashed border-border p-2 text-center text-muted-foreground/70"
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <span className="text-xs">{slotLabel}</span>
        <span className="sr-only">{t.emptySlot}</span>
      </div>
    );
  }

  const rarity = rarityStyle(item.rarity);
  const dataState = describeItemDataState(item, lang);

  return (
    <button
      type="button"
      data-slot-state="filled"
      data-slot={slot ?? "other"}
      data-item-id={item.id}
      data-highlighted={highlighted ? "true" : "false"}
      data-active={active ? "true" : "false"}
      aria-pressed={active}
      onClick={(event) => onSelect(item, event.currentTarget)}
      aria-label={`${slotLabel}: ${item.name}, ${item.baseType}, ${labels.rarity[item.rarity]}. ${dataState.label}. ${dataState.detail}${
        highlighted ? t.pointedOut : ""
      }`}
      title={`${item.name} · ${item.baseType} · ${labels.rarity[item.rarity]} · ${dataState.label}`}
      className={cn(
        "gear-slot flex h-full min-h-20 w-full flex-col gap-1 border p-2 text-left",
        SURFACE,
        "transition-[transform,box-shadow,border-color,background-color] duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:bg-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        rarity.border,
        highlighted && SELECTED_RING,
        active && "gear-slot--active border-primary/80 bg-primary/[0.07]",
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {slotLabel}
        </span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {highlighted && <Crosshair className={cn("size-3", SELECTED_TEXT)} />}
          <span className={cn("size-2 shrink-0 rounded-full", rarity.dot)} />
          <span className={cn("size-2 shrink-0 rounded-full bg-current", TONE_CLASSES[dataState.tone])} />
        </span>
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-2">
        <ItemArtwork item={item} className="size-11 rounded-sm" />
        <span className="min-w-0">
          <span className={cn("line-clamp-2 text-sm font-medium", rarity.text)}>{item.name}</span>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.baseType}</span>
        </span>
      </span>
    </button>
  );
}
