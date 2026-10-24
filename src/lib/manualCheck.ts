import type { ItemSlot, Resistances } from "@shared/domain.js";
import { REQUIRED_SLOTS, type BuildCheckInput } from "./buildPriorities";
import { CHECK_TEXT, type CheckLang } from "./checkText";

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

export const RESISTANCE_FIELDS: ResistanceField[] = ["fire", "cold", "lightning", "chaos"];

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
  lang: CheckLang,
): ManualCheckResult {
  const text = CHECK_TEXT[lang];
  const resistances: Resistances = { fire: null, cold: null, lightning: null, chaos: null };
  for (const key of RESISTANCE_FIELDS) {
    const parsed = parseResistance(values[key]);
    if (parsed === undefined) {
      return {
        ok: false,
        message: text.manual.invalidNumber(text.resistanceLabels[key], MIN_RESISTANCE, MAX_RESISTANCE),
      };
    }
    resistances[key] = parsed;
  }
  if (Object.values(resistances).every((value) => value === null)) {
    return { ok: false, message: text.manual.needOneResistance };
  }

  const empty = new Set(emptySlots);
  return {
    ok: true,
    input: {
      resistances,
      equippedSlots: REQUIRED_SLOTS.filter((slot) => !empty.has(slot)),
    },
  };
}
