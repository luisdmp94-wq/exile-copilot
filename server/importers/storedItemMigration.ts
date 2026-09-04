import {
  diagnoseCraftingItem,
  hasContradictoryAffixStructure,
} from "../../shared/craftingDiagnosis.js";
import type { CharacterProfile, Item } from "../../shared/domain.js";
import { parseItemText } from "./itemTextParser.js";

export interface StoredItemImportRepair {
  profile: CharacterProfile;
  repairedItemIds: string[];
}

/**
 * Reinterpreta únicamente snapshots antiguos que ya son internamente
 * contradictorios y conservan el tooltip original. No toca piezas válidas ni
 * intenta completar una copia parcial por el nombre de la base.
 */
export function repairStoredItemImport(item: Item): Item | null {
  if (!item.rawText?.trim() || !hasContradictoryAffixStructure(item)) return null;

  const reparsed = parseItemText(item.rawText).item;
  if (
    hasContradictoryAffixStructure(reparsed) ||
    diagnoseCraftingItem(reparsed).state !== "complete"
  ) {
    return null;
  }

  return {
    ...reparsed,
    // El id enlaza diario, memoria y sesiones con esta pieza. La migración
    // corrige su lectura sin convertirla en un objeto nuevo.
    id: item.id,
    // Conserva una ranura ya confirmada; aprovecha la nueva inferencia solo si
    // el importador antiguo no consiguió clasificarla.
    slot: item.slot === "other" ? reparsed.slot : item.slot,
    // No cambies la fecha/procedencia original por el mero hecho de migrar.
    sources: item.sources.length > 0 ? item.sources : reparsed.sources,
  };
}

/** Migra de forma idempotente los objetos legacy de un expediente. */
export function repairStoredItemImports(
  profile: CharacterProfile,
): StoredItemImportRepair {
  const repairedItemIds: string[] = [];
  const items = profile.items.map((item) => {
    const repaired = repairStoredItemImport(item);
    if (!repaired) return item;
    repairedItemIds.push(item.id);
    return repaired;
  });

  return repairedItemIds.length === 0
    ? { profile, repairedItemIds }
    : { profile: { ...profile, items }, repairedItemIds };
}
