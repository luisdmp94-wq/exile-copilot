/**
 * El formulario de la «Revisión rápida», fuera de su tarjeta: así el Mentor y
 * la mascota pueden leer lo que el jugador ya contestó sin pintar la tarjeta.
 */
import type { CharacterProfile } from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import type { QuickReviewAct, QuickReviewInput } from "@shared/quickReview.js";

/** Se lanza en `window` cada vez que el jugador cambia un dato de la revisión. */
export const QUICK_REVIEW_CHANGED_EVENT = "exile-copilot:revision-cambiada";

export interface Form {
  level: string;
  act: string;
  mainSkill: string;
  gemLevel: string;
  weapon: string;
  fire: string;
  cold: string;
  lightning: string;
  ascPoints: string;
  ascendancy: string;
  curse: string;
  otherSkills: string;
}

export const EMPTY: Form = {
  level: "",
  act: "",
  mainSkill: "",
  gemLevel: "",
  weapon: "",
  fire: "",
  cold: "",
  lightning: "",
  ascPoints: "",
  ascendancy: "",
  curse: "",
  otherSkills: "",
};

export const LICH = /\b(?:liche|lich)\b/i;

/** Lo que ya sabe la web del personaje guardado, para no preguntarlo otra vez. */
export function fromProfile(profile: CharacterProfile | null): Partial<Form> {
  if (!profile) return {};
  const level = readCharacterLevel(profile);
  const weapon = profile.items.find((item) => item.slot === "weapon");
  const skills = profile.skills.map((skill) => skill.mainSkill || skill.label).filter(Boolean);
  const res = profile.resistances;
  const asText = (value: number | null) => (value === null ? "" : String(value));
  return {
    ...(level.known ? { level: String(level.level) } : {}),
    ...(weapon && weapon.rarity !== "unique" && weapon.itemLevel ? { weapon: String(weapon.itemLevel) } : {}),
    ...(skills[0] ? { mainSkill: skills[0], otherSkills: skills.slice(1).join(", ") } : {}),
    fire: asText(res.fire),
    cold: asText(res.cold),
    lightning: asText(res.lightning),
    ...(profile.ascendancy ? { ascendancy: LICH.test(profile.ascendancy) ? "lich" : "other" } : {}),
  };
}

/**
 * Lo que puede valer cada número en PoE2 (con margen). Fuera de rango no se
 * usa: se avisa al jugador en vez de darle un consejo con basura.
 */
export const RANGES: Partial<Record<keyof Form, [number, number]>> = {
  level: [1, 100],
  gemLevel: [1, 40],
  weapon: [1, 100],
  fire: [-200, 90],
  cold: [-200, 90],
  lightning: [-200, 90],
};

/** Solo enteros escritos tal cual («1e5» o «3.5» no valen). */
const parseWhole = (value: string): number | null => {
  const text = value.trim();
  return /^-?\d{1,4}$/.test(text) ? Number(text) : null;
};

export function fieldIsInvalid(form: Form, key: keyof Form): boolean {
  const text = form[key].trim();
  if (text === "") return false;
  const range = RANGES[key];
  const value = parseWhole(text);
  return value === null || (range !== undefined && (value < range[0] || value > range[1]));
}

const numberOrNull = (form: Form, key: keyof Form): number | null =>
  fieldIsInvalid(form, key) ? null : parseWhole(form[key]);

export function toInput(form: Form): QuickReviewInput {
  const act: QuickReviewAct | null =
    form.act === "maps" ? "maps" : ["1", "2", "3", "4"].includes(form.act) ? (Number(form.act) as QuickReviewAct) : null;
  return {
    level: numberOrNull(form, "level"),
    act,
    mainSkill: form.mainSkill.trim() || null,
    mainSkillGemLevel: numberOrNull(form, "gemLevel"),
    weaponItemLevel: numberOrNull(form, "weapon"),
    resistances: {
      fire: numberOrNull(form, "fire"),
      cold: numberOrNull(form, "cold"),
      lightning: numberOrNull(form, "lightning"),
    },
    ascendancyPoints: numberOrNull(form, "ascPoints"),
    ascendancy: form.ascendancy === "lich" ? "Lich" : form.ascendancy === "other" ? "other" : null,
    usesCurse: form.curse === "yes" ? true : form.curse === "no" ? false : null,
    otherSkills: form.otherSkills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  };
}

/**
 * El formulario tal como lo ve el jugador: lo que la web sabe del personaje,
 * y encima lo que él escribió (lo vacío no pisa nada).
 */
export function quickReviewFormFor(
  profile: CharacterProfile | null,
  stored: Readonly<Record<string, string>>,
): Form {
  const written = Object.fromEntries(
    Object.entries(stored).filter(([, value]) => typeof value === "string" && value.trim() !== ""),
  ) as Partial<Form>;
  return { ...EMPTY, ...fromProfile(profile), ...written };
}
