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
    /\b(which|what) (spell|skill|gem)\b|\b(pick|choose|engrave|take)\b/.test(q);
  return gem && which && (uncutLevelIn(q) !== null || /\bsin tallar\b|\buncut\b/.test(q));
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
  const level = uncutLevelIn(` ${q} `);
  if (level === null) {
    return en
      ? "Tell me the level of your uncut gem (it's written on it) and I'll tell you which skills you can engrave with it."
      : "Dime de qué nivel es tu gema sin tallar (lo pone en la propia gema) y te digo qué habilidades puedes tallar con ella.";
  }

  const spirit = /\bespiritu\b|\bspirit\b/.test(q);
  const own = ownSkills(gems, profile);
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
    // Sin atributo no es una gema que se talle: viene de una ascendencia o de un objeto.
    if (skill.attribute === null || skill.grade === null || skill.grade > level) return false;
    if (ownSlugs.has(skill.slug)) return false;
    if (skill.tags.includes("Persistente") !== spirit) return false;
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
  const picked = [...pool].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)).slice(0, 4);

  const gemWord = spirit ? (en ? "uncut spirit gem" : "gema de espíritu sin tallar") : en ? "uncut skill gem" : "gema de habilidad sin tallar";
  if (picked.length === 0) {
    return en
      ? `I can't find a skill for a level ${level} ${gemWord} in the game data I have. ${sourceNote(lang)}`
      : `No encuentro ninguna habilidad para una ${gemWord} de nivel ${level} en los datos del juego que tengo. ${sourceNote(lang)}`;
  }

  const line = (skill: GemSkill) => {
    const shown = localizeSkill(skill, lang, gems.locale);
    const attribute = skill.attribute ? ATTRIBUTE[lang][skill.attribute] : "";
    return en
      ? `• ${shown.name} (gem level ${skill.grade}, ${attribute}): ${firstSentence(shown.description)}`
      : `• ${shown.name} (nivel de gema ${skill.grade}, ${attribute}): ${firstSentence(shown.description)}`;
  };
  const fitsWith = [...ownTags]
    .filter((tag) => picked.some((skill) => skill.tags.includes(tag)))
    .sort((a, b) => (tagWeight.get(b) ?? 0) - (tagWeight.get(a) ?? 0))
    .slice(0, 3);
  const intro = en
    ? `With a level ${level} ${gemWord} you can engrave any skill of gem level ${level} or lower.` +
      (own.length > 0 ? " The ones that fit what you already use best:" : " Some you can pick:")
    : `Con una ${gemWord} de nivel ${level} puedes tallar cualquier habilidad de nivel de gema ${level} o menos.` +
      (own.length > 0
        ? ` Las que mejor encajan con lo que ya llevas${fitsWith.length > 0 ? ` (${fitsWith.join(", ").toLowerCase()})` : ""}:`
        : " Algunas que puedes coger:");
  const upgrade =
    own.length > 0 && !spirit
      ? en
        ? `\n\nYou can also spend it on raising one you already have to level ${level}, for example ${localizeSkill(own[0]!, lang, gems.locale).name}: that is damage straight away.`
        : `\n\nTambién puedes gastarla en subir a nivel ${level} una que ya tienes, por ejemplo ${own[0]!.name}: es daño inmediato.`
      : "";
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

  const costsDiffer =
    tiers.length > 1 &&
    new Set(tiers.map((support) => support.effects.filter(isCost).join("|"))).size > 1;
  const verdict =
    tiers.length < 2
      ? ""
      : costsDiffer
        ? en
          ? "\n\nThe higher one does more, but its penalty is bigger too: it only pays off if you need that extra effect more than the damage you lose."
          : "\n\nLa de número más alto hace más, pero su penalización también es mayor: solo compensa si necesitas ese efecto extra más que el daño que pierdes."
        : en
          ? "\n\nThe higher one does more of the same with no extra penalty: use it if you have the uncut gem for it."
          : "\n\nLa de número más alto hace más de lo mismo sin más penalización: ponla si tienes la gema sin tallar que pide.";

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
