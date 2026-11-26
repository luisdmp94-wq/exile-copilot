import { isEquippedItem, type Item } from "@shared/domain.js";

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

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function isOneHandedWeapon(item: Item): boolean {
  return item.slot === "weapon" && ONE_HANDED_RE.test(item.itemClass?.trim() || item.baseType);
}

export function planImportedItemPlacement(
  allItems: readonly Item[],
  importedItem: Item,
): ImportedItemPlacement {
  // Una pieza que el jugador solo está mirando no ocupa hueco: no choca.
  const currentItems = allItems.filter(isEquippedItem);
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

  // Volver a pegar la misma arma (para corregir su texto desde Crafting, o
  // porque le has puesto un modificador) es actualizarla, no llevar otra: se
  // pregunta por ella. Sin esto se quedaba la vieja en la mano principal y la
  // nueva aparecía duplicada en la secundaria.
  const samePiece = currentItems.filter(
    (candidate) =>
      (candidate.slot === "weapon" || candidate.slot === "offhand") &&
      importedItem.slot === "weapon" &&
      sameText(candidate.name, importedItem.name) &&
      sameText(candidate.baseType, importedItem.baseType),
  );
  if (samePiece.length > 0) return { kind: "collision", item: importedItem, candidates: samePiece };

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
