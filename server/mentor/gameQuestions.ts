/**
 * Dudas del juego que el Mentor contesta con los datos de gemas de la web
 * («tengo una gema de nivel 7, ¿qué hechizo escojo?», «¿Encadenamiento I o
 * II?», «en Blasfemia solo tengo Desesperación, ¿pongo algo más?», «¿hay algún
 * esbirro de caos?», «¿y en atributos qué subo?»).
 *
 * Salieron de medir el Mentor con diez preguntas reales de Luis (24-11-2026):
 * siete eran dudas del juego y ninguna tenía respuesta. Igual que las de gemas
 * de asistencia y las del árbol, aquí deciden las reglas y los datos del juego
 * (poe2db), sin IA. Lo que los datos no traen se dice, no se inventa.
 */
import type { CharacterProfile } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import { reviewCharacter } from "../../shared/quickReview.js";
import type { AdviceLang, GemAttribute, GemSkill, GemSupport } from "../../shared/supportGemAdvice.js";
import {
  findSkillAnyLang,
  localizeSkill,
  localizeSupport,
  toSpanishGemName,
} from "../advice/gemLocale.js";
import { isSupportGemQuestion, type GemKnowledge } from "./gemQuestion.js";

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const ROMAN_VALUE: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

const ATTRIBUTE: Record<AdviceLang, Record<GemAttribute, string>> = {
  es: { Fue: "fuerza", Des: "destreza", Int: "inteligencia" },
  en: { Fue: "Strength", Des: "Dexterity", Int: "Intelligence" },
};

/** Etiquetas que casi todas las habilidades llevan: no dicen a qué se dedica un personaje. */
const GENERIC_TAGS = new Set(["AdE", "Duración", "Repetible", "Activación", "Condicional", "Sostenida"]);

const sourceNote = (lang: AdviceLang) =>
  lang === "en"
    ? "This comes from the game's data and fixed rules, no AI."
    : "Sale de los datos del juego y de reglas fijas, sin IA.";

const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** La primera frase de una descripción: qué hace, sin el detalle. */
const firstSentence = (text: string) => sentence(text.trim().split(/(?<=[.!?])\s+/)[0] ?? text);

/** Etiquetas de utilidad: dicen que la habilidad ayuda, no con qué hace daño el personaje. */
const UTILITY_TAGS = new Set(["Maldición", "Efecto beneficioso", "Persistente", "Aura", "Metahabilidad", "Viaje", "Grito de guerra"]);
const ELEMENT_TAGS = new Set(["Caos", "Fuego", "Hielo", "Rayo", "Físico"]);

/** Las habilidades del personaje que la web reconoce en los datos del juego, sin repetir. */
function ownSkills(gems: GemKnowledge, profile: CharacterProfile | null): GemSkill[] {
  const seen = new Set<string>();
  const found: GemSkill[] = [];
  for (const setup of profile?.skills ?? []) {
    const skill = findSkillAnyLang(gems.data, gems.locale, setup.mainSkill || setup.label);
    if (!skill || seen.has(skill.slug)) continue;
    seen.add(skill.slug);
    found.push(skill);
  }
  return found;
}

/** Todo lo que lleva engarzado, con el nombre en español (las de Blasfemia van como «asistencias»). */
function socketedNames(gems: GemKnowledge, profile: CharacterProfile | null): Set<string> {
  const names = new Set<string>();
  for (const setup of profile?.skills ?? []) {
    for (const name of [setup.mainSkill || setup.label, ...setup.supports.map((support) => support.name)]) {
      names.add(normalizeQuestion(toSpanishGemName(gems.data, gems.locale, name)));
    }
  }
  return names;
}

function mostCommon<T>(values: readonly T[]): T | null {
  const count = new Map<T, number>();
  for (const value of values) count.set(value, (count.get(value) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, total] of count) {
    if (total > bestCount) {
      best = value;
      bestCount = total;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// «Tengo una gema de nivel 7, ¿qué hechizo escojo?»
// ---------------------------------------------------------------------------

/** El nivel de la gema sin tallar que dice la pregunta, o null. */
function uncutLevelIn(q: string): number | null {
  const match =
    /\bnivel (\d{1,2})\b/.exec(q) ??
    /\bsin tallar (?:de|del) (\d{1,2})\b/.exec(q) ??
    /\blevel (\d{1,2})\b/.exec(q) ??
    /\blvl (\d{1,2})\b/.exec(q);
  const level = match ? Number(match[1]) : null;
  return level !== null && level >= 1 && level <= 20 ? level : null;
}

export function isSkillChoiceQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (isSupportGemQuestion(normalizedQuestion)) return false;
  const gem = /\bgemas?\b|\buncut\b|\bskill gems?\b|\bspirit gems?\b/.test(q);
  const which =
    /\b(que|cual) (hechizo|habilidad|skill|gema)\b|\b(hechizo|habilidad)\b.*\b(escojo|elijo|cojo|coger|elegir|escoger|pongo|tallo|tallar)\b|\b(escojo|elijo|cojo|tallo)\b/.test(q) ||
    /\b(which|what) (spell|skill|gem)\b|\b(pick|choose|engrave|take)\b/.test(q) ||
    // «¿qué me pongo?», «¿cuál pongo?», «¿en qué la gasto?» (medición del 24-11-2026).
    /\b(que|cual) (me |le )?(pongo|uso|tallo|cojo|elijo|escojo)\b|\ben que la (gasto|uso)\b|\bque hago con\b/.test(q) ||
    /\bwhat (do|should) i (put|use|get|do)\b/.test(q);
  return gem && which && (uncutLevelIn(q) !== null || /\bsin tallar\b|\buncut\b/.test(q));
}

/**
 * Grupos de la tabla de tallado que son un arma de verdad: sus habilidades
 * solo valen con esa arma en la mano. «Ocultismo», «Elemental» y «Primalismo»
 * son hechizos y no atan a un arma.
 */
const WEAPON_GROUPS = new Set(["Maza", "Arco", "Lanza", "Ballesta", "Bastón"]);
const WEAPON_GROUP_EN: Record<string, string> = {
  Maza: "Mace",
  Arco: "Bow",
  Lanza: "Spear",
  Ballesta: "Crossbow",
  Bastón: "Quarterstaff",
};

/** Grupo de las gemas que se tallan con una gema de espíritu sin tallar. */
export const SPIRIT_GROUP = "Espíritu";

/** Las armas con las que sale la habilidad al tallar («Maza», «Arco o Lanza»); vacío si no la ata un arma. */
export const weaponOf = (skill: GemSkill): string[] => (skill.cutGroups ?? []).filter((group) => WEAPON_GROUPS.has(group));

/** La descripción de la habilidad habla de «tu escudo»: sin escudo no se puede usar. */
export const needsShield = (skill: GemSkill) =>
  /\btu escudo\b|\bcon (el|tu|un) escudo\b/.test(normalizeQuestion(skill.description));

/** ¿Lleva algo en la mano secundaria que la web conozca? Con un arma a dos manos, no. */
function mayHaveShield(profile: CharacterProfile | null): boolean {
  if (!profile || profile.items.length === 0) return true;
  // Un carcaj o un foco ocupan esa mano: tampoco hay escudo.
  return profile.items.some(
    (item) => item.slot === "offhand" && !/\b(carcaj|quiver|foco|focus)\b/.test(normalizeQuestion(`${item.name} ${item.baseType}`)),
  );
}

export function answerSkillChoiceQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isSkillChoiceQuestion(q)) return null;
  const en = lang === "en";
  // Sin nivel no se calla: se enseñan las que encajan, con el nivel que pide cada una.
  const level = uncutLevelIn(` ${q} `);

  const spirit = /\bespiritu\b|\bspirit\b/.test(q);
  const own = ownSkills(gems, profile);
  // Las armas que ya usa, por sus habilidades: quien lleva embates de maza no puede usar uno de lanza.
  const ownGroups = new Set(own.flatMap((skill) => (skill.cutGroups ?? []).filter((group) => group !== SPIRIT_GROUP)));
  // Quien solo lleva habilidades de arma no quiere hechizos; quien ya lanza alguno, sí.
  const usesSpellGroups = [...ownGroups].some((group) => !WEAPON_GROUPS.has(group));
  // Con las tablas de tallado en los datos, solo se propone lo que de verdad sale al tallar.
  const hasCutMenu = gems.data.skills.some((skill) => (skill.cutGroups ?? []).length > 0);
  const shieldOk = mayHaveShield(profile);
  /** ¿Sale este grupo de tallado para alguien que lleva lo que lleva este personaje? */
  const groupFits = (group: string) => {
    if (ownGroups.size === 0 || ownGroups.has(group)) return true;
    // Caso real (24-11-2026): a un guerrero con mazo se le proponía una habilidad de lanza.
    if (WEAPON_GROUPS.has(group)) return false;
    // Las formas de la druida piden ir por ese camino: no se proponen de pasada.
    return usesSpellGroups && group !== "Primalismo";
  };
  const ownSlugs = new Set(own.map((skill) => skill.slug));
  // Cuántas de sus habilidades llevan cada etiqueta: caos en cinco pesa más que físico en una.
  const tagWeight = new Map<string, number>();
  for (const skill of own) {
    for (const tag of skill.tags) {
      if (GENERIC_TAGS.has(tag) || UTILITY_TAGS.has(tag)) continue;
      tagWeight.set(tag, (tagWeight.get(tag) ?? 0) + (ELEMENT_TAGS.has(tag) ? 2 : 1));
    }
  }
  const ownTags = new Set(tagWeight.keys());
  const hasCurse = own.some((skill) => skill.tags.includes("Maldición"));
  const mainAttribute = mostCommon(own.flatMap((skill) => (skill.attribute ? [skill.attribute] : [])));
  const usesAttacks = own.some((skill) => skill.tags.includes("Ataque"));
  const wanted =
    /\bhechizos?\b|\bspells?\b/.test(q) ? "Hechizo" : /\besbirros?\b|\bminions?\b/.test(q) ? "Esbirro" : /\bataques?\b|\battacks?\b/.test(q) ? "Ataque" : null;

  const pool = gems.data.skills.filter((skill) => {
    if (skill.grade === null || (level !== null && skill.grade > level)) return false;
    if (ownSlugs.has(skill.slug)) return false;
    if (!hasCutMenu) {
      // Datos antiguos, sin tablas de tallado: lo persistente es de espíritu y sin
      // atributo no es una gema que se talle (viene de una ascendencia o de un objeto).
      if (skill.tags.includes("Persistente") !== spirit || skill.attribute === null) return false;
    } else {
      // Lo que no sale en las tablas de tallado lo da un arma o una ascendencia, no una gema sin tallar.
      const groups = skill.cutGroups ?? [];
      if (spirit) {
        if (!groups.includes(SPIRIT_GROUP)) return false;
        // «Se recarga tu ballesta» no le sirve a quien dispara con arco.
        const text = normalizeQuestion(skill.description);
        const otherWeapon = [...WEAPON_GROUPS].some(
          (group) => text.includes(` tu ${normalizeQuestion(group)} `) && !ownGroups.has(group),
        );
        if (ownGroups.size > 0 && otherWeapon) return false;
        if (!shieldOk && needsShield(skill)) return false;
      } else {
        const cut = groups.filter((group) => group !== SPIRIT_GROUP);
        if (cut.length === 0 || !cut.some(groupFits)) return false;
        // Una que aporrea «tu escudo» no vale con un arma a dos manos.
        if (!shieldOk && needsShield(skill)) return false;
      }
    }
    if (wanted && !skill.tags.includes(wanted)) return false;
    // A quien solo lanza hechizos o lleva esbirros no se le proponen ataques de arma.
    if (own.length > 0 && !usesAttacks && wanted !== "Ataque" && skill.tags.includes("Ataque")) return false;
    // Quien ya lleva una maldición no necesita otra como «hechizo nuevo»: eso es otra pregunta.
    if (hasCurse && skill.tags.includes("Maldición")) return false;
    return true;
  });
  const score = (skill: GemSkill) =>
    skill.tags.reduce((total, tag) => total + (tagWeight.get(tag) ?? 0), 0) +
    (mainAttribute !== null && skill.attribute === mainAttribute ? 1 : 0) +
    (skill.grade ?? 0) / 20;
  // Sin saber el nivel de la gema solo se enseñan las del nivel más bajo que
  // hay: son las que seguro puede tallar. De las más altas se avisa.
  // «Más bajo» es el primer nivel con donde elegir (tres o más), no una gema suelta.
  const gradesAscending = [...new Set(pool.map((skill) => skill.grade ?? 99))].sort((a, b) => a - b);
  const lowestGrade =
    gradesAscending.find((grade) => pool.filter((skill) => (skill.grade ?? 99) <= grade).length >= 3) ??
    gradesAscending[gradesAscending.length - 1] ??
    1;
  const reachable = level === null ? pool.filter((skill) => (skill.grade ?? 99) <= lowestGrade) : pool;
  const higherGrades = level === null ? [...new Set(pool.map((skill) => skill.grade ?? 0))].filter((grade) => grade > lowestGrade).sort((a, b) => a - b) : [];
  const picked = [...reachable].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)).slice(0, 4);

  const gemWord = spirit ? (en ? "uncut spirit gem" : "gema de espíritu sin tallar") : en ? "uncut skill gem" : "gema de habilidad sin tallar";
  if (picked.length === 0) {
    return en
      ? `I can't find a skill for ${level === null ? "an" : `a level ${level}`} ${gemWord} in the game data I have. ${sourceNote(lang)}`
      : `No encuentro ninguna habilidad para una ${gemWord}${level === null ? "" : ` de nivel ${level}`} en los datos del juego que tengo. ${sourceNote(lang)}`;
  }

  const line = (skill: GemSkill) => {
    const shown = localizeSkill(skill, lang, gems.locale);
    const details = [
      en ? `gem level ${skill.grade}` : `nivel de gema ${skill.grade}`,
      skill.attribute ? ATTRIBUTE[lang][skill.attribute] : "",
      weaponOf(skill).length > 0
        ? en
          ? `weapon: ${weaponOf(skill).map((group) => WEAPON_GROUP_EN[group] ?? group).join(" or ")}`
          : `arma: ${weaponOf(skill).join(" o ").toLowerCase()}`
        : "",
      needsShield(skill) ? (en ? "needs a shield" : "pide escudo") : "",
      skill.reserve ? (en ? `reserves ${skill.reserve.replace("Espíritu", "Spirit")}` : `reserva ${skill.reserve.toLowerCase()}`) : "",
    ].filter(Boolean);
    return `• ${shown.name} (${details.join(", ")}): ${firstSentence(shown.description)}`;
  };
  const fitsWith = [...ownTags]
    .filter((tag) => picked.some((skill) => skill.tags.includes(tag)))
    .sort((a, b) => (tagWeight.get(b) ?? 0) - (tagWeight.get(a) ?? 0))
    .slice(0, 3);
  const higherNote =
    higherGrades.length === 0
      ? ""
      : en
        ? ` There are more at gem level ${higherGrades.join(", ")}: tell me your gem's level and I'll show those too.`
        : ` Hay más de nivel de gema ${higherGrades.join(", ")}: dime el nivel de tu gema y te enseño también esas.`;
  const canEngrave =
    level === null
      ? en
        ? `You don't say your ${gemWord}'s level (it's written on the gem): you can engrave any skill of that gem level or lower. I'm showing the lowest ones, up to gem level ${lowestGrade}.${higherNote}`
        : `No me dices de qué nivel es tu ${gemWord} (lo pone en la propia gema): puedes tallar cualquier habilidad de ese nivel de gema o menos. Te enseño las más bajas, hasta nivel de gema ${lowestGrade}.${higherNote}`
      : en
        ? `With a level ${level} ${gemWord} you can engrave any skill of gem level ${level} or lower.`
        : `Con una ${gemWord} de nivel ${level} puedes tallar cualquier habilidad de nivel de gema ${level} o menos.`;
  const intro = en
    ? canEngrave + (own.length > 0 ? " The ones that fit what you already use best:" : " Some you can pick:")
    : canEngrave +
      (own.length > 0
        ? ` Las que mejor encajan con lo que ya llevas${fitsWith.length > 0 ? ` (${fitsWith.join(", ").toLowerCase()})` : ""}:`
        : " Algunas que puedes coger:");
  // Subir una que ya tiene solo vale si va por debajo del nivel de la gema
  // (caso real, 24-11-2026: «sube Embate rodante a nivel 5» y ya estaba a 5).
  const behind =
    level === null || spirit
      ? []
      : (profile?.skills ?? []).flatMap((setup) => {
          const skill = findSkillAnyLang(gems.data, gems.locale, setup.mainSkill || setup.label);
          // Una gema de espíritu no sube con una gema de habilidad sin tallar.
          const groups = skill?.cutGroups ?? [];
          if (!skill || groups.includes(SPIRIT_GROUP) || (groups.length === 0 && skill.tags.includes("Persistente"))) return [];
          if (typeof setup.level !== "number" || setup.level >= level) return [];
          return [{ skill, now: setup.level }];
        });
  const levelsKnown = (profile?.skills ?? []).some((setup) => typeof setup.level === "number");
  const upgrade =
    level === null || spirit || own.length === 0
      ? ""
      : behind.length > 0
        ? en
          ? `\n\nYou can also spend it on raising to level ${level} one you already have that is behind: ${behind
              .slice(0, 3)
              .map((entry) => `${localizeSkill(entry.skill, lang, gems.locale).name} (now level ${entry.now})`)
              .join(", ")}. That is damage straight away.`
          : `\n\nTambién puedes gastarla en subir a nivel ${level} una que ya tienes y va por debajo: ${behind
              .slice(0, 3)
              .map((entry) => `${entry.skill.name} (ahora nivel ${entry.now})`)
              .join(", ")}. Es daño inmediato.`
        : levelsKnown
          ? ""
          : en
            ? `\n\nYou can also spend it on raising to level ${level} a skill you already have, if it's below that level: that is damage straight away.`
            : `\n\nTambién puedes gastarla en subir a nivel ${level} una habilidad que ya tienes, si está por debajo: es daño inmediato.`;
  const unknown =
    own.length === 0
      ? en
        ? "\n\nI don't know your skills yet: add them to your character and I'll pick the ones that fit your build."
        : "\n\nAún no sé qué habilidades llevas: añádelas a tu personaje y elijo las que encajan con tu build."
      : "";
  return `${intro}\n${picked.map(line).join("\n")}${upgrade}${unknown}\n\n${sourceNote(lang)}`;
}

// ---------------------------------------------------------------------------
// «¿Qué pongo, Encadenamiento 1 o 2?»
// ---------------------------------------------------------------------------

const baseName = (name: string) => name.replace(/\s+[IVX]+$/, "");

interface SupportFamily {
  /** Nombre sin el número romano, en español. */
  base: string;
  tiers: GemSupport[];
}

function supportFamilyIn(gems: GemKnowledge, q: string): SupportFamily | null {
  const padded = ` ${q} `;
  const families = new Map<string, GemSupport[]>();
  for (const support of gems.data.supports) {
    const base = baseName(support.name);
    families.set(base, [...(families.get(base) ?? []), support]);
  }
  let found: SupportFamily | null = null;
  let length = 0;
  for (const [base, tiers] of families) {
    const names = [base, baseName(localizeSupport(tiers[0]!, "en", gems.locale).name)];
    for (const name of names) {
      const normalized = normalizeQuestion(name);
      // Una palabra corta («ira», «eco») casaría con media frase.
      if (normalized.length < 5 || normalized.length <= length) continue;
      if (padded.includes(` ${normalized} `)) {
        found = { base, tiers: [...tiers].sort((a, b) => (a.grade ?? 9) - (b.grade ?? 9) || a.name.localeCompare(b.name)) };
        length = normalized.length;
      }
    }
  }
  return found;
}

/** Los números que siguen al nombre («1 o 2», «II», «i o iii»), como posición dentro de la familia. */
function tiersAsked(q: string): number[] {
  const asked = new Set<number>();
  for (const token of q.split(" ")) {
    if (/^[1-5]$/.test(token)) asked.add(Number(token));
    else if (ROMAN_VALUE[token] !== undefined && token !== "i" && token !== "v") asked.add(ROMAN_VALUE[token]!);
  }
  // «i» y «v» sueltas son letras corrientes: solo cuentan si ya hay otro número al lado.
  if (asked.size > 0) {
    for (const token of q.split(" ")) {
      if (token === "i" || token === "v") asked.add(ROMAN_VALUE[token]!);
    }
  }
  return [...asked].sort((a, b) => a - b);
}

const isCost = (effect: string) => /\d\s*%? menos de |\bless\b|\breduced\b|\bmenos\b/.test(normalizeQuestion(effect));

/** La línea sin sus cifras: dos grados «hacen lo mismo» si solo cambian los números. */
const effectShape = (effect: string) => normalizeQuestion(effect).replace(/\d+/g, "#");
const effectTotal = (effect: string) =>
  [...effect.matchAll(/\d+(?:[.,]\d+)?/g)].reduce((total, match) => total + Number(match[0].replace(",", ".")), 0);
/** «Las habilidades asistidas infligen un 25% menos de daño» → «infligen un 25% menos de daño». */
const shortEffect = (effect: string) =>
  effect.replace(/^(Las habilidades asistidas|Los proyectiles de las habilidades asistidas|Supported Skills|Projectiles from Supported Skills)\s+/i, "");

/**
 * Qué cambia de un grado al siguiente, leído de sus líneas. Solo concluye
 * cuál conviene cuando los datos lo dicen sin duda (mismo efecto y otra
 * penalización, o lo mismo y una línea más); si no, enseña el cambio y calla.
 */
function compareTiers(lower: GemSupport, higher: GemSupport, lang: AdviceLang, gems: GemKnowledge): string {
  const en = lang === "en";
  const low = localizeSupport(lower, lang, gems.locale);
  const high = localizeSupport(higher, lang, gems.locale);
  const quote = (text: string) => (en ? `“${shortEffect(text)}”` : `«${shortEffect(text)}»`);
  const grade = higher.grade ? (ROMAN[higher.grade] ?? String(higher.grade)) : "?";
  const ifYouHave = en
    ? `If you have an uncut support gem of tier ${grade}, use ${high.name}.`
    : `Si tienes una gema de asistencia sin tallar de grado ${grade}, pon ${high.name}.`;

  const lowByShape = new Map(low.effects.map((effect) => [effectShape(effect), effect] as const));
  const highByShape = new Map(high.effects.map((effect) => [effectShape(effect), effect] as const));
  const added = high.effects.filter((effect) => !lowByShape.has(effectShape(effect)));
  const removed = low.effects.filter((effect) => !highByShape.has(effectShape(effect)));
  const changed = high.effects.flatMap((effect) => {
    const before = lowByShape.get(effectShape(effect));
    return before !== undefined && before !== effect ? [{ before, after: effect }] : [];
  });

  // Cambian de efecto: no son «la misma con más número».
  if (removed.length > 0) {
    return en
      ? `${low.name} and ${high.name} don't do the same thing: read both lines above and keep the one that fits what you need.`
      : `${low.name} y ${high.name} no hacen lo mismo: lee las dos líneas de arriba y quédate con la que te sirva.`;
  }

  const costChanges = changed.filter((change) => isCost(change.after));
  const goodChanges = changed.filter((change) => !isCost(change.after));
  const costsDown = costChanges.length > 0 && costChanges.every((change) => effectTotal(change.after) < effectTotal(change.before));
  const costsUp = costChanges.length > 0 && costChanges.every((change) => effectTotal(change.after) > effectTotal(change.before));
  const costText = costChanges
    .map((change) => (en ? `${quote(change.after)} instead of ${quote(change.before)}` : `${quote(change.after)} en vez de ${quote(change.before)}`))
    .join(en ? "; " : "; ");
  const goodText = goodChanges
    .map((change) => (en ? `${quote(change.before)} becomes ${quote(change.after)}` : `${quote(change.before)} pasa a ${quote(change.after)}`))
    .join("; ");
  const addedGood = added.filter((effect) => !isCost(effect));
  const addedCost = added.filter(isCost);
  const addedText = added.map(quote).join(en ? " and " : " y ");

  if (changed.length === 0 && added.length === 0) {
    return en
      ? `${low.name} and ${high.name} read the same in the game data I have.`
      : `${low.name} y ${high.name} dicen lo mismo en los datos del juego que tengo.`;
  }
  // Lo mismo y otra penalización.
  if (goodChanges.length === 0 && added.length === 0) {
    if (costsDown) {
      return en
        ? `${high.name} does the same and its penalty is smaller: ${costText}. ${ifYouHave}`
        : `${high.name} hace lo mismo y penaliza menos: ${costText}. ${ifYouHave}`;
    }
    if (costsUp) {
      return en
        ? `${high.name} does the same and its penalty is bigger: ${costText}. By these lines, ${low.name} is the better one.`
        : `${high.name} hace lo mismo y penaliza más: ${costText}. Por estas líneas, conviene más ${low.name}.`;
    }
    return en ? `What changes in ${high.name}: ${costText}.` : `Lo que cambia en ${high.name}: ${costText}.`;
  }
  // Lo mismo y algo más, sin tocar la penalización.
  if (costChanges.length === 0 && addedCost.length === 0) {
    const what = [goodText, addedGood.length > 0 ? (en ? `it adds ${addedText}` : `añade ${addedText}`) : ""].filter(Boolean).join(en ? "; and " : "; y ");
    return en
      ? `What changes in ${high.name}: ${what}. No extra penalty. ${ifYouHave}`
      : `Lo que cambia en ${high.name}: ${what}. Sin más penalización. ${ifYouHave}`;
  }
  // Misma parte buena, pero la penalización baja por un lado y sube por otro.
  if (goodChanges.length === 0 && addedGood.length === 0) {
    const costs = [costText, addedCost.length > 0 ? (en ? `new penalty ${addedCost.map(quote).join(" and ")}` : `penalización nueva ${addedCost.map(quote).join(" y ")}`) : ""]
      .filter(Boolean)
      .join("; ");
    return en
      ? `${high.name} does the same and its penalty changes: ${costs}. Which one pays off depends on which of those lines hurts you more.`
      : `${high.name} hace lo mismo y cambia la penalización: ${costs}. Cuál compensa depende de cuál de esas líneas te duele más.`;
  }
  // Cambia el efecto y también lo que cuesta: se enseña y decide el jugador.
  const effectPart = [goodText, addedGood.length > 0 ? (en ? `it adds ${addedGood.map(quote).join(" and ")}` : `añade ${addedGood.map(quote).join(" y ")}`) : ""]
    .filter(Boolean)
    .join("; ");
  const costPart = [costText, addedCost.length > 0 ? (en ? `new penalty ${addedCost.map(quote).join(" and ")}` : `penalización nueva ${addedCost.map(quote).join(" y ")}`) : ""]
    .filter(Boolean)
    .join("; ");
  // «Penaliza más» o «menos» solo cuando todas las líneas van en esa dirección
  // (Fortaleza II baja una penalización y añade otra: ahí solo se enseña).
  const direction =
    costsDown && addedCost.length === 0
      ? en
        ? "and its penalty is smaller"
        : "y además penaliza menos"
      : (costsUp || costChanges.length === 0) && (costsUp || addedCost.length > 0)
        ? en
          ? "but its penalty is bigger"
          : "pero penaliza más"
        : en
          ? "and its penalty changes"
          : "y cambia la penalización";
  const advice =
    costsDown && addedCost.length === 0
      ? ifYouHave
      : en
        ? "It only pays off if you need that extra effect more than the damage you lose."
        : "Solo compensa si necesitas ese efecto extra más que el daño que pierdes.";
  return en
    ? `${high.name} changes the effect (${effectPart || "see above"}) ${direction}: ${costPart}. ${advice}`
    : `${high.name} cambia el efecto (${effectPart || "mira arriba"}) ${direction}: ${costPart}. ${advice}`;
}

/** «Encadenamiento 1 o 2»: nombra una asistencia y pregunta por grados concretos. */
export function isSupportTierQuestion(gems: GemKnowledge, normalizedQuestion: string): boolean {
  return supportFamilyIn(gems, normalizedQuestion) !== null && tiersAsked(normalizedQuestion).length > 0;
}

export function answerSupportCompareQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  const family = supportFamilyIn(gems, q);
  if (!family) return null;
  const en = lang === "en";
  const asked = tiersAsked(q);
  const comparing =
    asked.length > 0 || /\b(o|or|vs|mejor|better|diferencia|difference|cual|which|que hace|what does|pongo|uso|use)\b/.test(q);
  if (!comparing) return null;

  // «1 o 2» son la primera y la segunda de la familia, tenga el número que tenga su nombre.
  const position = (support: GemSupport) => {
    const roman = /\s([IVX]+)$/.exec(support.name)?.[1]?.toLowerCase();
    return roman ? (ROMAN_VALUE[roman] ?? 1) : 1;
  };
  const shownTiers = asked.length > 0 ? family.tiers.filter((support) => asked.includes(position(support))) : family.tiers;
  const tiers = shownTiers.length > 0 ? shownTiers : family.tiers;

  const line = (support: GemSupport) => {
    const shown = localizeSupport(support, lang, gems.locale);
    const good = shown.effects.filter((effect) => !isCost(effect));
    const costs = shown.effects.filter(isCost);
    const grade = support.grade ? (ROMAN[support.grade] ?? String(support.grade)) : "?";
    const does = (good.length > 0 ? good : shown.effects).map(sentence).join(" ");
    const tradeOff = costs.length > 0 ? (en ? ` In exchange: ${costs.map(sentence).join(" ")}` : ` A cambio: ${costs.map(sentence).join(" ")}`) : "";
    return en
      ? `• ${shown.name} (needs an uncut support gem of tier ${grade}): ${does}${tradeOff}`
      : `• ${shown.name} (pide una gema de asistencia sin tallar de grado ${grade}): ${does}${tradeOff}`;
  };

  // El veredicto sale de comparar las líneas de las dos, no de suponer que la
  // de número más alto penaliza más (caso real, 24-11-2026: Disparo múltiple II
  // penaliza MENOS que la I y la frase decía lo contrario).
  const verdicts: string[] = [];
  for (let index = 1; index < tiers.length; index += 1) {
    verdicts.push(compareTiers(tiers[index - 1]!, tiers[index]!, lang, gems));
  }
  const verdict = verdicts.length > 0 ? `\n\n${verdicts.join("\n")}` : "";

  const socketed = socketedNames(gems, profile);
  const wearing = family.tiers.find((support) => socketed.has(normalizeQuestion(support.name)));
  const now = wearing
    ? en
      ? `\n\nRight now you have ${localizeSupport(wearing, lang, gems.locale).name} socketed.`
      : `\n\nAhora mismo llevas puesta ${wearing.name}.`
    : "";

  const title = en ? `${baseName(localizeSupport(family.tiers[0]!, lang, gems.locale).name)}, by tier:` : `${family.base}, por grados:`;
  return `${title}\n${tiers.map(line).join("\n")}${verdict}${now}\n\n${sourceNote(lang)}`;
}

// ---------------------------------------------------------------------------
// «En Blasfemia solo tengo Desesperación, ¿pongo algo más?»
// ---------------------------------------------------------------------------

/** Texto de una pasiva del árbol oficial: por él se sabe que hay un tope de maldiciones. */
export const EXTRA_CURSE_PASSIVE_TEXT = "Puedes aplicar una maldición adicional";

const curseGems = (gems: GemKnowledge) =>
  gems.data.skills.filter((skill) => skill.tags.includes("Maldición") && skill.attribute !== null);

export function isCurseQuestion(gems: GemKnowledge, normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (/\bmaldicion(es)?\b|\bcurses?\b|\bblasfemia\b|\bblasphemy\b/.test(q)) return true;
  const namesCurse = curseGems(gems).some((skill) =>
    [skill.name, localizeSkill(skill, "en", gems.locale).name].some((name) => q.includes(` ${normalizeQuestion(name)} `)),
  );
  return namesCurse && /\b(pongo|poner|anado|anadir|otra|otro|mas|cual|mejor|which|add|another|better|more)\b/.test(q);
}

export function answerCurseQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isCurseQuestion(gems, q)) return null;
  const en = lang === "en";
  const curses = curseGems(gems);
  const socketed = socketedNames(gems, profile);
  const mine = curses.filter((skill) => socketed.has(normalizeQuestion(skill.name)));
  const others = curses.filter((skill) => !mine.includes(skill)).sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0));
  const blasphemy = gems.data.skills.find((skill) => skill.slug === "Blasphemy") ?? null;
  const usesBlasphemy = blasphemy !== null && socketed.has(normalizeQuestion(blasphemy.name));
  const name = (skill: GemSkill) => localizeSkill(skill, lang, gems.locale).name;

  const have =
    mine.length > 0
      ? en
        ? `You have: ${mine.map(name).join(", ")}${usesBlasphemy ? ` (and ${name(blasphemy!)})` : ""}.`
        : `Llevas: ${mine.map(name).join(", ")}${usesBlasphemy ? ` (y ${name(blasphemy!)})` : ""}.`
      : en
        ? "I don't see any curse on your character."
        : "No veo ninguna maldición en tu personaje.";

  const line = (skill: GemSkill) => {
    const shown = localizeSkill(skill, lang, gems.locale);
    return en
      ? `• ${shown.name} (gem level ${skill.grade}): ${firstSentence(shown.description)}`
      : `• ${shown.name} (nivel de gema ${skill.grade}): ${firstSentence(shown.description)}`;
  };
  const list =
    others.length > 0
      ? `${en ? "The other curses in the game:" : "Las otras maldiciones que hay en el juego:"}\n${others.map(line).join("\n")}`
      : "";

  // Lo que dice la propia Blasfemia de añadir otra: se cita, no se resume.
  const blasphemyLines =
    blasphemy === null
      ? []
      : localizeSkill(blasphemy, lang, gems.locale).effects.filter((effect) =>
          /reserva|reserves?|menos de magnitud|less magnitude|magnitud/.test(normalizeQuestion(effect)),
        );
  const blasphemyNote =
    blasphemyLines.length > 0 && (usesBlasphemy || /\bblasfemia\b|\bblasphemy\b/.test(q))
      ? en
        ? `Each extra curse in ${name(blasphemy!)} has a price: ${blasphemyLines.map((text) => `“${text}”`).join(" and ")}.`
        : `Cada maldición de más en ${name(blasphemy!)} tiene precio: ${blasphemyLines.map((text) => `«${text}»`).join(" y ")}.`
      : "";

  const limit = en
    ? "Before adding one, check your limit: the passive tree has a node that says “You can apply an additional Curse”. Without something like that, a second curse doesn't stack with the first on the same enemy, so you'd pay for it and gain nothing."
    : `Antes de añadir otra, mira tu límite: en el árbol hay una pasiva que dice «${EXTRA_CURSE_PASSIVE_TEXT}». Sin algo así, una segunda maldición no se suma a la primera sobre el mismo enemigo: la pagarías sin ganar nada.`;

  return [have, list, blasphemyNote, limit, sourceNote(lang)].filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// «¿Hay algún esbirro que ataque con caos?»
// ---------------------------------------------------------------------------

const ELEMENTS: ReadonlyArray<{ tag: string; asks: RegExp; es: string; en: string }> = [
  { tag: "Caos", asks: /\bcaos\b|\bchaos\b/, es: "caos", en: "chaos" },
  { tag: "Fuego", asks: /\bfuego\b|\bfire\b/, es: "fuego", en: "fire" },
  { tag: "Hielo", asks: /\bhielo\b|\bfrio\b|\bcold\b/, es: "hielo", en: "cold" },
  { tag: "Rayo", asks: /\brayo\b|\blightning\b/, es: "rayo", en: "lightning" },
  { tag: "Físico", asks: /\bfisico\b|\bphysical\b/, es: "físico", en: "physical" },
];

export function isMinionQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (isSupportGemQuestion(normalizedQuestion)) return false;
  return /\besbirros?\b|\bminions?\b|\bespectros?\b|\bspectres?\b|\bsucubos?\b|\bsuccubus\b|\binvocacion(es)?\b/.test(q);
}

export function answerMinionQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isMinionQuestion(q)) return null;
  const en = lang === "en";
  const element = ELEMENTS.find((entry) => entry.asks.test(q)) ?? null;
  const minions = gems.data.skills.filter((skill) => skill.tags.includes("Esbirro") && skill.attribute !== null);
  const name = (skill: GemSkill) => localizeSkill(skill, lang, gems.locale).name;
  const line = (skill: GemSkill) => {
    const shown = localizeSkill(skill, lang, gems.locale);
    return en
      ? `• ${shown.name} (gem level ${skill.grade}): ${firstSentence(shown.description)}`
      : `• ${shown.name} (nivel de gema ${skill.grade}): ${firstSentence(shown.description)}`;
  };

  // De capturar monstruos (espectros, bestias) la web no tiene datos: se dice siempre.
  const gap = en
    ? "What I don't have is the list of monsters you can bind as a spectre or tame: I can't tell you which of those deals a given damage type, or which act it shows up in."
    : "Lo que no tengo es la lista de monstruos que puedes vincular como espectro o domar: de esos no sé decirte cuál hace cada tipo de daño ni en qué acto sale.";

  const own = ownSkills(gems, profile).filter((skill) => skill.tags.includes("Esbirro"));
  const mine =
    own.length > 0
      ? en
        ? `Your minion skills right now: ${own.map(name).join(", ")}.`
        : `Tus habilidades de esbirro ahora: ${own.map(name).join(", ")}.`
      : "";

  if (element) {
    const word = en ? element.en : element.es;
    const matching = minions
      .filter(
        (skill) =>
          skill.tags.includes(element.tag) ||
          [skill.description, ...skill.effects].some((text) => new RegExp(`\\bdano de ${normalizeQuestion(element.es)}\\b`).test(normalizeQuestion(text))),
      )
      .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0));
    const found =
      matching.length > 0
        ? `${en ? `Minion skill gems with ${word} damage:` : `Gemas de esbirro con daño de ${word}:`}\n${matching.map(line).join("\n")}`
        : en
          ? `I can't find any minion skill gem with ${word} damage in the game data I have.`
          : `No encuentro ninguna gema de esbirro con daño de ${word} en los datos del juego que tengo.`;
    return [found, mine, gap, sourceNote(lang)].filter(Boolean).join("\n\n");
  }

  const cantCompare = en
    ? "I can't compare those two with the data I have: I only know the minion skill gems, not each monster's numbers."
    : "No puedo comparar esos dos con los datos que tengo: solo conozco las gemas de esbirro, no los números de cada monstruo.";
  const all = `${en ? "The minion skill gems in the game, by gem level:" : "Las gemas de esbirro que hay, por nivel de gema:"}\n${[...minions]
    .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.name.localeCompare(b.name))
    .map((skill) => `${name(skill)} (${skill.grade})`)
    .join(", ")}.`;
  const comparing = /\b(mejor|better|vs|o|or)\b/.test(q);
  return [comparing ? cantCompare : "", mine, comparing ? "" : all, gap, sourceNote(lang)].filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// «¿Y en atributos qué subo?»
// ---------------------------------------------------------------------------

export function isAttributeQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (/\batributos?\b|\battributes?\b/.test(q)) return true;
  return (
    /\b(fuerza|destreza|inteligencia|strength|dexterity|intelligence)\b/.test(q) &&
    /\b(subo|subir|cojo|coger|pongo|elijo|raise|pick|take|put|which|cual)\b/.test(q)
  );
}

const ATTRIBUTE_KEY: Record<GemAttribute, "str" | "dex" | "int"> = { Fue: "str", Des: "dex", Int: "int" };

export function answerAttributeQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  if (!isAttributeQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";
  const order: GemAttribute[] = ["Fue", "Des", "Int"];

  const have = profile?.attributes ?? null;
  const known = have !== null && order.some((attribute) => typeof have[ATTRIBUTE_KEY[attribute]] === "number");
  const haveLine = known
    ? `${en ? "You have" : "Tienes"} ${order
        .map((attribute) => `${ATTRIBUTE[lang][attribute]} ${have![ATTRIBUTE_KEY[attribute]] ?? "?"}`)
        .join(" · ")}.`
    : "";

  // De qué color son sus gemas: es lo que más atributo pide mientras sube de nivel.
  const colours: GemAttribute[] = [];
  for (const setup of profile?.skills ?? []) {
    const skill = findSkillAnyLang(gems.data, gems.locale, setup.mainSkill || setup.label);
    if (skill?.attribute) colours.push(skill.attribute);
    for (const support of setup.supports) {
      const spanish = normalizeQuestion(toSpanishGemName(gems.data, gems.locale, support.name));
      const found = gems.data.supports.find((gem) => normalizeQuestion(gem.name) === spanish);
      if (found) colours.push(found.attribute);
    }
  }
  const counts = order.map((attribute) => ({ attribute, count: colours.filter((colour) => colour === attribute).length }));
  const main = [...counts].sort((a, b) => b.count - a.count)[0];
  const gemsLine =
    colours.length > 0
      ? `${en ? "Your gems:" : "Tus gemas:"} ${counts
          .filter((entry) => entry.count > 0)
          .sort((a, b) => b.count - a.count)
          .map((entry) => (en ? `${entry.count} ${ATTRIBUTE.en[entry.attribute]}` : `${entry.count} de ${ATTRIBUTE.es[entry.attribute]}`))
          .join(", ")}.`
      : "";

  // Piezas que pide más de lo que tiene.
  const unmet: string[] = [];
  if (known) {
    for (const item of profile?.items ?? []) {
      for (const attribute of order) {
        const key = ATTRIBUTE_KEY[attribute];
        const needs = item.requirements?.[key];
        const has = have![key];
        if (typeof needs === "number" && typeof has === "number" && needs > has) {
          unmet.push(
            en
              ? `${item.name} needs ${needs} ${ATTRIBUTE.en[attribute]} (you have ${has})`
              : `${item.name} pide ${needs} de ${ATTRIBUTE.es[attribute]} (tienes ${has})`,
          );
        }
      }
    }
  }
  const unmetLine =
    unmet.length > 0
      ? `${en ? "You don't meet:" : "No cumples:"} ${unmet.slice(0, 3).join("; ")}.`
      : known && (profile?.items.length ?? 0) > 0
        ? en
          ? "Your gear doesn't ask for anything you don't have."
          : "Tus piezas no te piden nada que no tengas."
        : "";

  const rule =
    unmet.length > 0
      ? en
        ? "Raise that first: an item you can't wear gives you nothing."
        : "Sube eso primero: una pieza que no te puedes poner no te da nada."
      : main && main.count > 0
        ? en
          ? `Rule: first whatever you're missing to equip something (an item or a gem shown in red). If nothing is missing, the attribute most of your gems use: ${ATTRIBUTE.en[main.attribute]}.`
          : `Regla: primero lo que te falte para ponerte algo (una pieza o una gema que salga en rojo). Si no te falta nada, el atributo de la mayoría de tus gemas: ${ATTRIBUTE.es[main.attribute]}.`
        : en
          ? "Rule: first whatever you're missing to equip something (an item or a gem shown in red). I don't know your skills yet, so I can't tell which attribute your gems use."
          : "Regla: primero lo que te falte para ponerte algo (una pieza o una gema que salga en rojo). Aún no sé qué habilidades llevas, así que no puedo decirte qué atributo piden tus gemas.";

  return [haveLine, gemsLine, unmetLine, rule, sourceNote(lang)].filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// «Me falta daño»
// ---------------------------------------------------------------------------

/** Los hallazgos de la revisión rápida que hablan de pegar más, no de aguantar. */
const DAMAGE_FINDINGS = new Set(["weapon", "gem", "contagion", "curse"]);

/**
 * Lo que la revisión rápida ve de daño en este personaje, o null si con lo que
 * sabe no ve nada (entonces contesta el motor de siempre).
 */
export function answerDamageQuestion(
  gems: GemKnowledge,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  if (!profile || profile.skills.length === 0) return null;
  const en = lang === "en";
  const main = profile.skills[0]!;
  const weapon = profile.items.find((item) => item.slot === "weapon") ?? null;
  const socketed = socketedNames(gems, profile);
  const usesCurse = curseGems(gems).some((skill) => socketed.has(normalizeQuestion(skill.name)));
  const review = reviewCharacter(
    {
      level: profile.level > 0 ? profile.level : null,
      act: null,
      mainSkill: toSpanishGemName(gems.data, gems.locale, main.mainSkill || main.label),
      mainSkillGemLevel: main.level ?? null,
      // De un arma única no se juzga el nivel: se lleva por lo que hace, no por su base.
      weaponItemLevel: weapon && weapon.rarity !== "unique" ? (weapon.itemLevel ?? null) : null,
      resistances: { fire: null, cold: null, lightning: null },
      ascendancyPoints: null,
      ascendancy: profile.ascendancy ?? null,
      usesCurse,
      otherSkills: profile.skills.slice(1).map((setup) => toSpanishGemName(gems.data, gems.locale, setup.mainSkill || setup.label)),
    },
    lang,
  );
  const findings = [...review.top, ...review.rest].filter((finding) => DAMAGE_FINDINGS.has(finding.id));
  if (findings.length === 0) return null;

  const lines = findings.map((finding, index) => `${index + 1}. ${sentence(finding.title)} ${finding.action}`);
  const blind =
    main.level === undefined
      ? en
        ? "\n\nI don't know your main gem's level: tell me in the quick review and I'll say if it's behind."
        : "\n\nNo sé el nivel de tu gema principal: dímelo en la revisión rápida y te digo si va atrasada."
      : "";
  const intro = en ? "What's holding your damage back, in order:" : "Lo que más te frena el daño, por orden:";
  return `${intro}\n${lines.join("\n")}${blind}\n\n${sourceNote(lang)}`;
}
