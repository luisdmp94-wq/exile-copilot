import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  findSkill,
  normalizeGemText,
  type AdviceLang,
  type GemData,
  type GemSkill,
  type GemSupport,
} from "../../shared/supportGemAdvice.js";

/**
 * Las gemas en inglés. Las reglas trabajan SIEMPRE con los datos en español
 * (sus filtros leen esas palabras); esto solo traduce lo que se enseña:
 * nombre, descripción y efectos, unidos por el identificador de la gema.
 * Así la recomendación es la misma en los dos idiomas.
 */
export interface GemLocaleEntry {
  slug: string;
  name: string;
  description: string;
  effects: string[];
}

export interface GemLocale {
  entries: Map<string, GemLocaleEntry>;
  /** Nombre inglés normalizado → identificador. */
  slugByName: Map<string, string>;
}

export const EMPTY_GEM_LOCALE: GemLocale = { entries: new Map(), slugByName: new Map() };

export function gemLocaleFrom(entries: GemLocaleEntry[]): GemLocale {
  const locale: GemLocale = { entries: new Map(), slugByName: new Map() };
  for (const entry of entries) {
    locale.entries.set(entry.slug, entry);
    locale.slugByName.set(normalizeGemText(entry.name), entry.slug);
  }
  return locale;
}

export function loadEnglishGemLocale(): GemLocale {
  const path = fileURLToPath(new URL("../data/gems.en.json", import.meta.url));
  if (!existsSync(path)) return EMPTY_GEM_LOCALE;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { skills?: GemLocaleEntry[]; supports?: GemLocaleEntry[] };
  return gemLocaleFrom([...(parsed.skills ?? []), ...(parsed.supports ?? [])]);
}

/** Busca la habilidad por su nombre en español o en inglés. */
export function findSkillAnyLang(data: GemData, locale: GemLocale, name: string): GemSkill | null {
  const spanish = findSkill(data, name);
  if (spanish) return spanish;
  const slug = locale.slugByName.get(normalizeGemText(name));
  return slug ? (data.skills.find((skill) => skill.slug === slug) ?? null) : null;
}

/** Un nombre de gema en inglés pasa a su nombre en español; si no se reconoce, se deja igual. */
export function toSpanishGemName(data: GemData, locale: GemLocale, name: string): string {
  const slug = locale.slugByName.get(normalizeGemText(name));
  if (!slug) return name;
  return (data.supports.find((gem) => gem.slug === slug) ?? data.skills.find((gem) => gem.slug === slug))?.name ?? name;
}

function translated<T extends GemSkill | GemSupport>(gem: T, lang: AdviceLang, locale: GemLocale): T {
  if (lang !== "en") return gem;
  const entry = locale.entries.get(gem.slug);
  if (!entry) return gem;
  return {
    ...gem,
    name: entry.name,
    description: entry.description || gem.description,
    effects: entry.effects.length > 0 ? entry.effects : gem.effects,
  };
}

export const localizeSkill = (skill: GemSkill, lang: AdviceLang, locale: GemLocale): GemSkill => translated(skill, lang, locale);
export const localizeSupport = (support: GemSupport, lang: AdviceLang, locale: GemLocale): GemSupport =>
  translated(support, lang, locale);

/** Etiquetas del juego en inglés, para el motivo de las reglas. Las raras se omiten. */
const TAG_EN: Record<string, string> = {
  Caos: "chaos",
  Fuego: "fire",
  Hielo: "cold",
  Rayo: "lightning",
  Físico: "physical",
  Esbirro: "minion",
  Hechizo: "spell",
  Ataque: "attack",
  Proyectil: "projectile",
  AdE: "area",
  Duración: "duration",
  "Cuerpo a cuerpo": "melee",
  Maldición: "curse",
  Canalización: "channelling",
  Persistente: "persistent",
  Nova: "nova",
  Golpe: "strike",
  Elemental: "elemental",
};

export function tagsInEnglish(tags: readonly string[]): string[] {
  return tags.flatMap((tag) => (TAG_EN[tag] ? [TAG_EN[tag]] : []));
}
