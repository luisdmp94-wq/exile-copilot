/**
 * Elegir habilidades: con qué arma sale cada una (tarea 16, 27-11-2026).
 *
 * Los datos son los de las tablas de tallado del juego (`cutGroups` en
 * `gems.es.json`): cada habilidad se talla dentro de un grupo. Cinco grupos
 * son un arma de verdad (la habilidad solo vale con esa arma en la mano); tres
 * son escuelas de hechizos, que no piden arma; «Espíritu» son las gemas que
 * reservan espíritu.
 *
 * Aquí no se calcula daño: se dice si una habilidad SE PUEDE usar con un arma.
 */
import { z } from "zod";
import { GemAttributeSchema, type AdviceLang } from "./supportGemAdvice.js";

export const WEAPON_GROUPS = ["Maza", "Arco", "Lanza", "Ballesta", "Bastón"] as const;
export type WeaponGroup = (typeof WEAPON_GROUPS)[number];
export const SPELL_GROUPS = ["Elemental", "Ocultismo", "Primalismo"] as const;
export type SpellGroup = (typeof SPELL_GROUPS)[number];
export const SPIRIT_GROUP = "Espíritu";

export const isWeaponGroup = (group: string): group is WeaponGroup => (WEAPON_GROUPS as readonly string[]).includes(group);
export const isSpellGroup = (group: string): group is SpellGroup => (SPELL_GROUPS as readonly string[]).includes(group);

/** El nombre del grupo como se le dice al jugador, en minúsculas («con arco»). */
export const GROUP_LABEL: Record<AdviceLang, Record<string, string>> = {
  es: {
    Maza: "maza",
    Arco: "arco",
    Lanza: "lanza",
    Ballesta: "ballesta",
    Bastón: "bastón",
    Elemental: "elemental",
    Ocultismo: "ocultismo",
    Primalismo: "primalismo",
    Espíritu: "espíritu",
  },
  en: {
    Maza: "mace",
    Arco: "bow",
    Lanza: "spear",
    Ballesta: "crossbow",
    Bastón: "quarterstaff",
    Elemental: "elemental",
    Ocultismo: "occult",
    Primalismo: "primal",
    Espíritu: "spirit",
  },
};

/** Sin tildes ni mayúsculas, con espacios a los lados para buscar palabras enteras. */
const plain = (text: string) =>
  ` ${text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()} `;

// «Ballesta» va antes que «Arco»: en inglés «crossbow» no debe leerse como «bow».
const WEAPON_WORDS: ReadonlyArray<{ group: WeaponGroup; pattern: RegExp }> = [
  { group: "Ballesta", pattern: / (ballestas?|crossbows?) / },
  { group: "Arco", pattern: / (arcos?|bows?) / },
  { group: "Lanza", pattern: / (lanzas?|spears?) / },
  { group: "Bastón", pattern: / (baston|bastones|quarterstaff|quarterstaves) / },
  { group: "Maza", pattern: / (mazas?|mazos?|martillos?|garrotes?|maces?|mauls?|hammers?|clubs?) / },
];
/** Armas de quien lanza hechizos: no atan a ninguna habilidad de arma. */
const CASTER_WORDS = / (baculos?|varitas?|cetros?|staff|staves|wands?|sceptres?|scepters?) /;

export interface WeaponRead {
  /** El grupo de habilidades que abre el arma; null si es un arma de hechicero. */
  group: WeaponGroup | null;
  /** Báculo, varita o cetro: hechizos. */
  caster: boolean;
}

/**
 * Qué arma nombra un texto (el nombre de una pieza o una pregunta), o null.
 * Solo reconoce las palabras de arriba: un arma con otro nombre no se adivina.
 */
export function weaponInText(text: string): WeaponRead | null {
  const padded = plain(text);
  for (const entry of WEAPON_WORDS) if (entry.pattern.test(padded)) return { group: entry.group, caster: false };
  return CASTER_WORDS.test(padded) ? { group: null, caster: true } : null;
}

export type SkillWeaponFit =
  /** Habilidad de arma: vale o no con la que se pregunta. `fits` es null si no se sabe qué arma lleva. */
  | { kind: "weapon"; weapons: WeaponGroup[]; fits: boolean | null }
  /** Hechizo: no pide un arma concreta. */
  | { kind: "spell"; school: SpellGroup }
  /** Gema de espíritu. */
  | { kind: "spirit" }
  /** No está en las tablas de tallado: no se sabe con qué arma sale. */
  | { kind: "unknown" };

/** ¿Se puede usar la habilidad con esa arma? Solo con los grupos de tallado. */
export function skillWeaponFit(groups: readonly string[], weapon: WeaponGroup | null): SkillWeaponFit {
  const weapons = groups.filter(isWeaponGroup);
  if (weapons.length > 0) return { kind: "weapon", weapons, fits: weapon === null ? null : weapons.includes(weapon) };
  const school = groups.find(isSpellGroup);
  if (school) return { kind: "spell", school };
  if (groups.includes(SPIRIT_GROUP)) return { kind: "spirit" };
  return { kind: "unknown" };
}

export const SkillChoiceSchema = z.object({
  name: z.string(),
  /** El nombre en el otro idioma: un personaje importado trae sus habilidades en inglés. */
  alias: z.string(),
  /** Nivel de la gema de habilidad sin tallar que hace falta. */
  grade: z.number().int(),
  attribute: GemAttributeSchema.nullable(),
  tags: z.array(z.string()),
  /** Grupos de tallado, con los nombres de `WEAPON_GROUPS` y `SPELL_GROUPS`. */
  groups: z.array(z.string()),
  /** Qué hace, en una frase. */
  summary: z.string(),
  needsShield: z.boolean(),
});
export type SkillChoice = z.infer<typeof SkillChoiceSchema>;

export const SkillChoiceListResponseSchema = z.object({
  skills: z.array(SkillChoiceSchema),
  source: z.string(),
  fetchedAt: z.string(),
});
export type SkillChoiceListResponse = z.infer<typeof SkillChoiceListResponseSchema>;
