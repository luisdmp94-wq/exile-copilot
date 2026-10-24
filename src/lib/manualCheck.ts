import type { ItemSlot, Resistances } from "@shared/domain.js";
import { REQUIRED_SLOTS, type BuildCheckInput } from "./buildPriorities";

/**
 * Formulario manual del chequeo de build, para quien no usa Path of Building:
 * las cuatro resistencias de la hoja de personaje y los huecos vacíos. Solo se
 * pide lo que usan las reglas; un campo en blanco es «sin dato», nunca 0.
 */

export type ResistanceField = keyof Resistances;

export type ManualResistanceValues = Record<ResistanceField, string>;

export const EMPTY_MANUAL_VALUES: ManualResistanceValues = {
  fire: "",
  cold: "",
  lightning: "",
  chaos: "",
};

export const RESISTANCE_FIELDS: Array<{ key: ResistanceField; label: string }> = [
  { key: "fire", label: "Fuego" },
  { key: "cold", label: "Frío" },
  { key: "lightning", label: "Rayo" },
  { key: "chaos", label: "Caos" },
];

/** Rango que puede mostrar la hoja de personaje: penalizaciones hasta el tope máximo. */
const MIN_RESISTANCE = -200;
const MAX_RESISTANCE = 90;

export type ManualCheckResult =
  | { ok: true; input: BuildCheckInput }
  | { ok: false; message: string };

/** «-30», «−30» o «-30%» → -30; en blanco → null; otra cosa → undefined. */
function parseResistance(raw: string): number | null | undefined {
  const text = raw.trim().replace(/−/g, "-").replace(/%$/, "").trim();
  if (text === "") return null;
  if (!/^-?\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value >= MIN_RESISTANCE && value <= MAX_RESISTANCE ? value : undefined;
}

export function parseManualCheck(
  values: ManualResistanceValues,
  emptySlots: ItemSlot[],
): ManualCheckResult {
  const resistances: Resistances = { fire: null, cold: null, lightning: null, chaos: null };
  for (const { key, label } of RESISTANCE_FIELDS) {
    const parsed = parseResistance(values[key]);
    if (parsed === undefined) {
      return {
        ok: false,
        message: `${label}: escribe un número entero entre ${MIN_RESISTANCE} y ${MAX_RESISTANCE}, por ejemplo 52 o -30.`,
      };
    }
    resistances[key] = parsed;
  }
  if (Object.values(resistances).every((value) => value === null)) {
    return { ok: false, message: "Escribe al menos una resistencia de tu hoja de personaje." };
  }

  const empty = new Set(emptySlots);
  return {
    ok: true,
    input: {
      resistances,
      equippedSlots: REQUIRED_SLOTS.map(({ slot }) => slot).filter((slot) => !empty.has(slot)),
    },
  };
}
