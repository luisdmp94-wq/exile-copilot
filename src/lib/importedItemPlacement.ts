import type { Item } from "@shared/domain.js";

/**
 * Decisión previa a incorporar un tooltip al expediente.
 *
 * Un objeto pegado recibe siempre un id nuevo, por lo que comparar ids no
 * detecta que ya existe una pieza equipada en el mismo hueco. Esta capa usa
 * el hueco real y obliga a resolver las colisiones de forma explícita.
 */
export type ImportedItemPlacement =
  | { kind: "append"; item: Item }
  | { kind: "collision"; item: Item; candidates: Item[] };

const RING_SLOTS = ["ring1", "ring2"] as const;

export function planImportedItemPlacement(
  currentItems: readonly Item[],
  importedItem: Item,
): ImportedItemPlacement {
  if (importedItem.slot === "flask" || importedItem.slot === "other") {
    return { kind: "append", item: importedItem };
  }

  if (importedItem.slot === "ring1" || importedItem.slot === "ring2") {
    const occupiedRings = RING_SLOTS.flatMap((slot) => {
      const item = currentItems.find((candidate) => candidate.slot === slot);
      return item ? [item] : [];
    });
    const emptySlot = RING_SLOTS.find(
      (slot) => !currentItems.some((candidate) => candidate.slot === slot),
    );

    if (emptySlot) {
      return { kind: "append", item: { ...importedItem, slot: emptySlot } };
    }
    return { kind: "collision", item: importedItem, candidates: occupiedRings };
  }

  const occupied = currentItems.find((candidate) => candidate.slot === importedItem.slot);
  if (!occupied) return { kind: "append", item: importedItem };
  return { kind: "collision", item: importedItem, candidates: [occupied] };
}

/** Conserva la identidad y el hueco del objeto que el jugador eligió sustituir. */
export function replaceImportedItem(
  currentItems: readonly Item[],
  importedItem: Item,
  targetItemId: string,
): { items: Item[]; replacement: Item } | null {
  const target = currentItems.find((item) => item.id === targetItemId);
  if (!target) return null;

  const replacement: Item = {
    ...importedItem,
    id: target.id,
    slot: target.slot,
  };
  return {
    items: currentItems.map((item) => (item.id === targetItemId ? replacement : item)),
    replacement,
  };
}
