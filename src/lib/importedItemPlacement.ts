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
const HAND_SLOTS = ["weapon", "offhand"] as const;

/**
 * Armas de una mano: caben en la mano secundaria (varita + cetro, dos dagas…).
 * El parser las manda todas a «weapon»; sin esto, pegar la segunda chocaba con
 * la primera aunque la mano secundaria estuviera libre. Manda la clase del
 * objeto («Cetros», «Varitas», «Mazas de una mano»); la base solo si no hay clase.
 */
const ONE_HANDED_RE =
  /wand|varita|sceptre|cetro|dagger|daga|claw|garra|spear|lanza|flail|mangual|one hand|una mano/i;

function isOneHandedWeapon(item: Item): boolean {
  return item.slot === "weapon" && ONE_HANDED_RE.test(item.itemClass?.trim() || item.baseType);
}

export function planImportedItemPlacement(
  currentItems: readonly Item[],
  importedItem: Item,
): ImportedItemPlacement {
  if (importedItem.slot === "flask" || importedItem.slot === "charm" || importedItem.slot === "other") {
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

  // Con un arma a dos manos (o que no sabemos si es de una) en la principal, la
  // secundaria no está libre de verdad: se pregunta como siempre.
  const mainHand = currentItems.find((candidate) => candidate.slot === "weapon");
  if (isOneHandedWeapon(importedItem) && (!mainHand || isOneHandedWeapon(mainHand))) {
    const emptyHand = HAND_SLOTS.find(
      (slot) => !currentItems.some((candidate) => candidate.slot === slot),
    );
    if (emptyHand) return { kind: "append", item: { ...importedItem, slot: emptyHand } };
    const occupiedHands = HAND_SLOTS.flatMap((slot) => {
      const item = currentItems.find((candidate) => candidate.slot === slot);
      return item ? [item] : [];
    });
    return { kind: "collision", item: importedItem, candidates: occupiedHands };
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
