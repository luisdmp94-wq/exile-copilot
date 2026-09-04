import type { Item } from "@shared/domain.js";

/**
 * Los objetos del personaje de ejemplo son datos didácticos, no posesiones del
 * jugador. La procedencia debe atravesar todos los recorridos de Crafting para
 * que ninguna vista termine autorizando una moneda o esperando un resultado.
 */
export function isCraftingExampleItem(
  item: Pick<Item, "sources">,
): boolean {
  return item.sources.some((source) =>
    source.label.toLocaleLowerCase("es").includes("demostración"),
  );
}

/**
 * Reconoce también demos antiguas que llegaron a guardarse y después fueron
 * restauradas como un perfil normal. Se exige que todas las piezas conserven
 * procedencia didáctica: un personaje real con una pieza aislada de ejemplo no
 * debe convertirse entero en simulación.
 */
export function isCraftingExampleProfile(
  profile: { items: Array<Pick<Item, "sources">> },
): boolean {
  return profile.items.length > 0 && profile.items.every(isCraftingExampleItem);
}
