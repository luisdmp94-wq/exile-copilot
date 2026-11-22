/**
 * Lo que la web manda para pedir «¿por dónde sigo en el árbol?» y lo que
 * recibe. La petición se saca del personaje con `treeRequestFromProfile`,
 * igual en el navegador que en el Mentor del servidor.
 */
import { z } from "zod";
import type { CharacterProfile, Item } from "./domain.js";
import type { DefenceStyle, WeaponKind } from "./passiveTreeAdvice.js";

export const WEAPON_KINDS = [
  "wand",
  "staff",
  "sceptre",
  "focus",
  "shield",
  "bow",
  "crossbow",
  "mace",
  "sword",
  "axe",
  "dagger",
  "claw",
  "spear",
  "flail",
  "quarterstaff",
  "talisman",
] as const satisfies readonly WeaponKind[];

export const PassiveTreeAdviceRequestSchema = z.object({
  characterClass: z.string().max(60).nullable(),
  ascendancy: z.string().max(60).nullable(),
  /** Nodos cogidos: números de PoB2 o ids oficiales. */
  passives: z.array(z.string().max(80)).max(400),
  /** Habilidades del personaje; la primera es la principal. */
  skills: z.array(z.string().max(80)).max(20),
  weapons: z.array(z.enum(WEAPON_KINDS)).max(4),
  defence: z.enum(["life", "energyShield", "hybrid"]).nullable(),
  usesArmour: z.boolean(),
  usesEvasion: z.boolean(),
  /** Versión del árbol del código de PoB2 («0_5»), si se sabe. */
  treeVersion: z.string().max(20).nullable(),
  lang: z.enum(["es", "en"]).default("es"),
});
export type PassiveTreeAdviceRequest = z.infer<typeof PassiveTreeAdviceRequestSchema>;

const SuggestionSchema = z.object({
  key: z.string(),
  name: z.string(),
  search: z.string(),
  stats: z.array(z.string()),
  points: z.number().int(),
  path: z.array(z.string()),
  onTheWay: z.array(z.object({ count: z.number().int(), text: z.string() })),
  reasons: z.array(z.string()),
  kind: z.enum(["offence", "defence"]),
});

export const PassiveTreeAdviceResponseSchema = z.object({
  tree: z.object({ version: z.string(), commit: z.string() }),
  /** Nodos del árbol principal que tiene cogidos (claves del árbol). */
  allocated: z.array(z.string()),
  start: z.string().nullable(),
  ascendancyCount: z.number().int(),
  unknownCount: z.number().int(),
  /** El código es de otra versión del árbol: «0.4» frente a «0.5». */
  versionMismatch: z.object({ code: z.string(), tree: z.string() }).nullable(),
  /** Las habilidades que ha tenido en cuenta, en el idioma de la web. */
  skills: z.array(z.string()),
  offence: z.array(SuggestionSchema),
  defence: SuggestionSchema.nullable(),
});
export type PassiveTreeAdviceResponse = z.infer<typeof PassiveTreeAdviceResponseSchema>;

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const WEAPON_PATTERNS: Array<[RegExp, WeaponKind]> = [
  [/quarterstaff|baston(es)? de (combate|pelea|guerra)|baculo de (combate|pelea)/, "quarterstaff"],
  [/crossbow|ballesta/, "crossbow"],
  [/\bbows?\b|\barcos?\b/, "bow"],
  [/\bwands?\b|varita/, "wand"],
  [/\bstaff\b|\bstaves\b|baston|baculo/, "staff"],
  [/sceptre|cetro/, "sceptre"],
  [/\bfoc(us|i)\b|\bfocos?\b/, "focus"],
  [/\bmaces?\b|\bmazas?\b/, "mace"],
  [/\bswords?\b|\bespadas?\b/, "sword"],
  [/\baxes?\b|\bhachas?\b/, "axe"],
  [/dagger|\bdagas?\b/, "dagger"],
  [/\bclaws?\b|\bgarras?\b/, "claw"],
  [/\bspears?\b|\blanzas?\b/, "spear"],
  [/\bflails?\b|mangual/, "flail"],
  [/talisman/, "talisman"],
  [/\bshields?\b|\bbucklers?\b|\bescudos?\b(?! de energ)|\bbroquel/, "shield"],
];

/** Qué arma lleva en cada mano, por la clase o la base del objeto. */
export function weaponKindOf(item: Pick<Item, "itemClass" | "baseType" | "name">): WeaponKind | null {
  const text = fold(`${item.itemClass ?? ""} ${item.baseType} ${item.name}`);
  for (const [pattern, kind] of WEAPON_PATTERNS) if (pattern.test(text)) return kind;
  return null;
}

/** Ni de aliados ni de esbirros: lo que da al propio personaje. */
const NOT_FOR_YOU = /aliad|esbirro|presencia|all(?:y|ies)|minion|presence/i;

function gearDefence(items: readonly Item[]): DefenceStyle | null {
  let life = 0;
  let shield = 0;
  for (const item of items) {
    if (item.slot === "weapon") continue;
    for (const modifier of item.modifiers) {
      if (NOT_FOR_YOU.test(modifier.text)) continue;
      if (/escudo de energ|energy shield/i.test(modifier.text)) shield += 1;
      else if (/vida m[aá]xima|maximum life/i.test(modifier.text)) life += 1;
    }
  }
  if (life === 0 && shield === 0) return null;
  if (shield > life * 1.5) return "energyShield";
  if (shield > 0 && life > 0 && shield >= life * 0.6) return "hybrid";
  return life >= shield ? "life" : "energyShield";
}

function defenceStyle(profile: CharacterProfile): DefenceStyle | null {
  const life = profile.life ?? 0;
  const shield = profile.energyShield ?? 0;
  if (life > 0 || shield > 0) {
    if (shield >= life * 0.8) return "energyShield";
    if (shield >= life * 0.5) return "hybrid";
    return "life";
  }
  return gearDefence(profile.items);
}

function gearShows(items: readonly Item[], pattern: RegExp): boolean {
  return items.some((item) => pattern.test(item.rawText ?? "") || item.modifiers.some((modifier) => !NOT_FOR_YOU.test(modifier.text) && pattern.test(modifier.text)));
}

export function treeRequestFromProfile(profile: CharacterProfile, lang: "es" | "en"): PassiveTreeAdviceRequest {
  const weapons = new Set<WeaponKind>();
  for (const item of profile.items) {
    if (item.slot !== "weapon" && item.slot !== "offhand") continue;
    const kind = weaponKindOf(item);
    if (kind) weapons.add(kind);
  }
  const skills = profile.skills.map((setup) => setup.mainSkill.trim()).filter((name) => name.length > 0);
  return {
    characterClass: profile.characterClass || null,
    ascendancy: profile.ascendancy ?? null,
    passives: profile.passives.allocated.map((node) => node.ref).slice(0, 400),
    skills: [...new Set(skills)].slice(0, 20),
    weapons: [...weapons].slice(0, 4),
    defence: defenceStyle(profile),
    usesArmour: (profile.armour ?? 0) > 50 || gearShows(profile.items, /^\s*(armadura|armour)\s*:\s*\d+|armadura aumentad|increased armour/im),
    usesEvasion: (profile.evasion ?? 0) > 50 || gearShows(profile.items, /^\s*(evasi[oó]n|evasion rating)\s*:\s*\d+|evasi[oó]n aumentad|increased evasion/im),
    treeVersion: profile.pobImport?.passiveTreeVersion ?? null,
    lang,
  };
}
