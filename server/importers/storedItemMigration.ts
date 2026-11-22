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

/** Línea con la que empieza cada pieza copiada del juego. */
const ITEM_CLASS_LINE_RE = /^\s*(?:item class|clase de objeto)\s*:/gim;

/**
 * El tooltip guardado contiene DOS piezas: se pegó una detrás de otra en el
 * mismo cuadro y el importador antiguo las leyó como una sola (unos guantes
 * con los mods de un cetro).
 */
function holdsSeveralItems(rawText: string): boolean {
  return (rawText.match(ITEM_CLASS_LINE_RE) ?? []).length > 1;
}

/**
 * Único importado antes de reconocer `{ Mod. único … }`: la cabecera y el texto
 * decorativo quedaron guardados como mods sueltos.
 */
function hasLooseUniqueHeaders(item: Item): boolean {
  return (
    item.rarity === "unique" &&
    item.modifiers.some((modifier) => /^\{[^}]*(?:único|unico|unique)[^}]*\}$/iu.test(modifier.text.trim()))
  );
}

/**
 * Reinterpreta únicamente snapshots antiguos que ya son internamente
 * contradictorios y conservan el tooltip original. No toca piezas válidas ni
 * intenta completar una copia parcial por el nombre de la base.
 */
export function repairStoredItemImport(item: Item): Item | null {
  const rawText = item.rawText?.trim();
  if (!rawText) return null;

  const contradictory = hasContradictoryAffixStructure(item);
  const misread = holdsSeveralItems(rawText) || hasLooseUniqueHeaders(item);
  if (!contradictory && !misread) return null;

  const { item: reparsed, recognized } = parseItemText(rawText);
  if (contradictory && !misread) {
    if (
      hasContradictoryAffixStructure(reparsed) ||
      diagnoseCraftingItem(reparsed).state !== "complete"
    ) {
      return null;
    }
  } else if (!recognized || reparsed.name !== item.name || hasContradictoryAffixStructure(reparsed)) {
    // La relectura debe ser la MISMA pieza (su primera parte) y estar sana;
    // si no, mejor dejarla como estaba que cambiarla por otra cosa.
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
