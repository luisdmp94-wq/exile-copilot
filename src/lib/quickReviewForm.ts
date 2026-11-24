/**
 * El formulario de la «Revisión rápida», fuera de su tarjeta: así el Mentor y
 * la mascota pueden leer lo que el jugador ya contestó sin pintar la tarjeta.
 */
import type { CharacterProfile } from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import { QUICK_REVIEW_SKILL_ID, type QuickReviewAct, type QuickReviewInput } from "@shared/quickReview.js";

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

const sameSkill = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");

/**
 * El personaje que ven el motor y el Mentor: el guardado, con lo que el jugador
 * contestó en la revisión rápida mirando el juego. Antes esas respuestas solo
 * movían la tarjeta: el Mentor seguía con «resistencias desconocidas», el nivel
 * viejo y la habilidad equivocada aunque el jugador ya los hubiera escrito.
 *
 * Solo se usan los números válidos; lo vacío no pisa nada. No se guarda: el
 * expediente del servidor no cambia por mirar la revisión.
 */
export function profileWithQuickReview(profile: CharacterProfile, form: Form): CharacterProfile {
  const input = toInput(form);
  let next = profile;

  if (input.level !== null) {
    next = { ...next, level: input.level, levelSource: "observed" };
  }

  const { fire, cold, lightning } = input.resistances;
  if (fire !== null || cold !== null || lightning !== null) {
    next = {
      ...next,
      resistances: {
        ...next.resistances,
        ...(fire !== null ? { fire } : {}),
        ...(cold !== null ? { cold } : {}),
        ...(lightning !== null ? { lightning } : {}),
      },
    };
  }

  // La habilidad que hace el daño va la primera: el motor toma la primera
  // como principal. Si el perfil ya la tiene, se adelanta con sus apoyos.
  const main = input.mainSkill;
  if (main !== null && !(next.skills[0] && sameSkill(next.skills[0].mainSkill, main))) {
    const existing = next.skills.find((skill) => sameSkill(skill.mainSkill, main));
    const skills = existing
      ? [existing, ...next.skills.filter((skill) => skill !== existing)]
      : [
          {
            id: QUICK_REVIEW_SKILL_ID,
            label: "",
            mainSkill: main,
            mainSkillGemId: null,
            supports: [],
          },
          ...next.skills,
        ];
    next = { ...next, skills };
  }

  return next;
}

const FORM_KEYS = Object.keys(EMPTY) as Array<keyof Form>;
/** Junto a cada dato escrito se guarda lo que decía la ficha en ese momento. */
const BASE_PREFIX = "base:";

/**
 * Lo que se guarda al escribir en la revisión: los datos, y al lado lo que la
 * ficha del personaje decía de cada uno entonces. Así, cuando la ficha cambia
 * después (un código de PoB2 con otra arma, el nivel corregido en el editor),
 * se nota y manda la ficha; sin eso, el número escrito un día tapaba para
 * siempre lo nuevo («tu arma va 30 niveles por detrás» con el arma recién cambiada).
 */
export function withReviewBase(form: Readonly<Record<string, string>>, profile: CharacterProfile | null): Record<string, string> {
  const known = fromProfile(profile) as Partial<Record<keyof Form, string>>;
  const saved: Record<string, string> = {};
  for (const key of FORM_KEYS) {
    saved[key] = form[key] ?? "";
    saved[BASE_PREFIX + key] = known[key] ?? "";
  }
  return saved;
}

/** ¿Lo guardado ya lleva al lado lo que decía la ficha? (Lo de antes de este cambio, no.) */
export function hasReviewBase(stored: Readonly<Record<string, string>>): boolean {
  return Object.keys(stored).some((key) => key.startsWith(BASE_PREFIX));
}

/**
 * El formulario tal como lo ve el jugador: lo que la web sabe del personaje,
 * y encima lo que él escribió (lo vacío no pisa nada). Si la ficha cambió un
 * dato después de que él lo escribiera, manda la ficha.
 */
export function quickReviewFormFor(
  profile: CharacterProfile | null,
  stored: Readonly<Record<string, string>>,
): Form {
  const known = fromProfile(profile) as Partial<Record<keyof Form, string>>;
  const form: Form = { ...EMPTY, ...known };
  for (const key of FORM_KEYS) {
    const typed = stored[key];
    if (typeof typed !== "string" || typed.trim() === "") continue;
    const base = stored[BASE_PREFIX + key];
    if (typeof base === "string" && base !== (known[key] ?? "")) continue;
    form[key] = typed;
  }
  // El nivel de gema escrito era el de la habilidad de entonces: si la principal ya es otra, no vale.
  const typedSkill = stored.mainSkill;
  if (typeof typedSkill === "string" && typedSkill.trim() !== "" && typedSkill !== form.mainSkill) form.gemLevel = "";
  // Un único no se juzga por su nivel de objeto: con uno equipado la casilla
  // va vacía, aunque en el navegador quedara un número de un arma anterior.
  const weapon = profile?.items.find((item) => item.slot === "weapon");
  if (weapon?.rarity === "unique") form.weapon = "";
  return form;
}
