import {
  Circle,
  Crosshair,
  FlaskConical,
  Footprints,
  Gem,
  HardHat,
  Hand,
  Package,
  RectangleHorizontal,
  Shield,
  Shirt,
  Sword,
  type LucideIcon,
} from "lucide-react";
import type { Item } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { SLOT_LABELS, RARITY_LABELS } from "@/lib/format";
import {
  buildEquipmentLayout,
  computeEquipmentDiagnostics,
  describeItemDataState,
  rarityStyle,
  type EquipmentSlot,
} from "@/lib/equipment";
import { cn } from "@/lib/utils";

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
  /** Recibe también el elemento pulsado para devolverle el foco al cerrar. */
  onSelectItem: (item: Item, trigger: HTMLElement) => void;
}

export function EquipmentPanel({
  items,
  highlightedItemIds,
  onSelectItem,
}: EquipmentPanelProps) {
  const layout = buildEquipmentLayout(items);
  const diagnostics = computeEquipmentDiagnostics(layout, highlightedItemIds);

  return (
    <section
      aria-labelledby="equipo-titulo"
      className="gear-board flex flex-col gap-3 border border-border/80 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="equipo-titulo"
          className="text-xs font-semibold uppercase tracking-wider text-foreground"
        >
          Equipo de tu personaje
        </h3>
        <Badge variant="outline" className="text-muted-foreground">
          {diagnostics.equipped} equipado(s) · {diagnostics.emptySlots} vacío(s)
        </Badge>
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
                  onSelect={onSelectItem}
                />
              </li>
            ))}
          </ul>

          {/* Frascos: grupo derivado de los datos reales, sin número fijo. */}
          <div className="mt-2 flex flex-col gap-1.5" data-testid="flask-group">
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Frascos ({layout.flaskItems.length})
            </h4>
            {layout.flaskItems.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {layout.flaskItems.map((flask) => (
                  <li key={flask.id}>
                    <EquipmentCellButton
                      slot="flask"
                      item={flask}
                      highlighted={highlightedItemIds.has(flask.id)}
                      onSelect={onSelectItem}
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
                Sin información de frascos.
              </p>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-2" aria-label="Diagnóstico del equipo">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Diagnóstico
          </h4>
          <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border p-3 sm:grid-cols-3", SURFACE)}>
            <DiagnosticRow label="Objetos registrados" value={diagnostics.equipped} />
            <DiagnosticRow label="Ranuras vacías" value={diagnostics.emptySlots} />
            <DiagnosticRow label="Objetos indicados por ti" value={diagnostics.userProvided} />
            <DiagnosticRow label="Objetos sin fuente" value={diagnostics.withoutSource} />
            <DiagnosticRow
              label="Modificadores sin verificar"
              value={diagnostics.unverifiedModifiers}
            />
            {diagnostics.highlighted > 0 && (
              <DiagnosticRow
                label="Señalados por recomendaciones"
                value={diagnostics.highlighted}
                emphasis
              />
            )}
          </dl>
          <p className="text-[11px] text-muted-foreground">
            Solo tu equipo real. Las pistas de una build objetivo importada no se
            muestran aquí: son un plan, no objetos equipados.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Recuentos derivados de tus datos. Exile Copilot no calcula puntuaciones de
            build ni compara con el meta.
          </p>
        </aside>
      </div>

      {layout.extraItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Otros objetos ({layout.extraItems.length})
          </h4>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {layout.extraItems.map((item) => (
              <li key={item.id}>
                <EquipmentCellButton
                  slot={null}
                  item={item}
                  highlighted={highlightedItemIds.has(item.id)}
                  onSelect={onSelectItem}
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
  onSelect: (item: Item, trigger: HTMLElement) => void;
}

function EquipmentCellButton({ slot, item, highlighted, onSelect }: EquipmentCellButtonProps) {
  const Icon =
    slot === null ? Package : slot === "flask" ? FlaskConical : SLOT_ICONS[slot];
  const slotLabel = slot === null ? SLOT_LABELS.other : SLOT_LABELS[slot];

  // Hueco vacío: no es un botón, no hay nada que abrir.
  if (item === null) {
    return (
      <div
        data-slot-state="empty"
        data-slot={slot ?? "other"}
        className={cn(
          "gear-slot flex h-full min-h-20 flex-col gap-1 border border-dashed border-border/70 p-2",
          SURFACE,
        )}
      >
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {slotLabel}
        </span>
        <span className="text-xs text-muted-foreground/80">Ranura vacía</span>
      </div>
    );
  }

  const rarity = rarityStyle(item.rarity);
  const dataState = describeItemDataState(item);

  return (
    <button
      type="button"
      data-slot-state="filled"
      data-slot={slot ?? "other"}
      data-item-id={item.id}
      data-highlighted={highlighted ? "true" : "false"}
      onClick={(event) => onSelect(item, event.currentTarget)}
      aria-label={`${slotLabel}: ${item.name}, ${item.baseType}, ${RARITY_LABELS[item.rarity]}${
        highlighted ? ". Señalado por una recomendación" : ""
      }`}
      className={cn(
        "gear-slot flex h-full min-h-20 w-full flex-col gap-1 border p-2 text-left",
        SURFACE,
        "transition-colors motion-reduce:transition-none hover:bg-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        rarity.border,
        highlighted && SELECTED_RING,
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {slotLabel}
        </span>
        <span className={cn("size-2 shrink-0 rounded-full", rarity.dot)} aria-hidden="true" />
      </span>
      <span className={cn("line-clamp-2 text-sm font-medium", rarity.text)}>{item.name}</span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{item.baseType}</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-1">
        <span className={cn("text-[11px]", rarity.text)}>{RARITY_LABELS[item.rarity]}</span>
        <span
          className={cn("text-[11px]", TONE_CLASSES[dataState.tone])}
          title={dataState.detail}
        >
          · {dataState.label}
        </span>
      </span>
      {highlighted && (
        <span className={cn("flex items-center gap-1 text-[11px]", SELECTED_TEXT)}>
          <Crosshair className="size-3 shrink-0" aria-hidden="true" />
          Señalado por una recomendación
        </span>
      )}
    </button>
  );
}
