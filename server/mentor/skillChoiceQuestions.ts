/**
 * Elegir habilidades (tarea 16, 27-11-2026).
 *
 * Sale de lo que contó Gabo, el hermano de Luis: «lo peor es elegir
 * habilidades», quiere saber por qué combinan las gemas y montar su build en
 * vez de copiarla, con algo que diga si le vale con sus armas. Medido ese día
 * solo con reglas: de 22 preguntas así, 19 daban «no lo sé» y 3 contestaban de
 * resistencias.
 *
 * Cuatro preguntas, todas con los datos de gemas de la web y sin IA:
 *  - «¿Qué habilidad me cojo?», «¿qué habilidades hay de ballesta?»
 *  - «¿Me vale Flecha de rayo con mi mazo?», «¿mi build me vale con mi arco?»
 *  - «¿Por qué combina Furia con Terremoto?»
 *  - «¿Cómo monto mi propia build?»
 *
 * Lo que NO hacen: decir cuánto daño hace algo. La web no lo calcula. Dicen
 * qué se puede usar con qué y por qué, y lo avisan.
 */
import type { CharacterProfile } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import {
  GROUP_LABEL,
  SPELL_GROUPS,
  SPIRIT_GROUP,
  WEAPON_GROUPS,
  isSpellGroup,
  isWeaponGroup,
  skillWeaponFit,
  weaponInText,
  type SkillChoice,
  type WeaponGroup,
} from "../../shared/skillChoice.js";
import {
  supportCandidates,
  supportMainBenefit,
  type AdviceLang,
  type GemAttribute,
  type GemSkill,
} from "../../shared/supportGemAdvice.js";
import { localizeSkill, localizeSupport, type GemLocale } from "../advice/gemLocale.js";
import type { GemData } from "../../shared/supportGemAdvice.js";
import { firstSentence, needsShield, ownSkills, sourceNote, supportFamilyIn } from "./gameQuestions.js";
import { isSupportGemQuestion, skillInQuestion, type GemKnowledge } from "./gemQuestion.js";

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const ALL_ATTRIBUTES: GemAttribute[] = ["Fue", "Des", "Int"];
const ATTRIBUTE: Record<AdviceLang, Record<GemAttribute, string>> = {
  es: { Fue: "fuerza", Des: "destreza", Int: "inteligencia" },
  en: { Fue: "Strength", Des: "Dexterity", Int: "Intelligence" },
};

/** Etiquetas que no dicen a qué se dedica una habilidad: no cuentan como «en común». */
const VAGUE_TAGS = new Set(["AdE", "Duración", "Repetible", "Activación", "Condicional", "Sostenida", "Compensación", "Fases"]);

/** Dónde está el configurador en la web. Se dice igual en todas las respuestas. */
const configuratorLine = (lang: AdviceLang) =>
  lang === "en"
    ? "To do it with clicks: in Guides, \"Build your own\" (gems and items tab)."
    : "Para hacerlo con clics: en Guías, «Monta tu build» (pestaña de gemas y piezas).";

const noDamageNote = (lang: AdviceLang) =>
  lang === "en"
    ? "This says what you can use and why, not how much damage it does: I don't calculate that."
    : "Esto dice qué puedes usar y por qué, no cuánto daño hace: eso no lo calculo.";

const label = (group: string, lang: AdviceLang) => GROUP_LABEL[lang][group] ?? group.toLowerCase();

const joinOr = (parts: string[], lang: AdviceLang) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} ${lang === "en" ? "or" : "o"} ${parts[parts.length - 1]}`;

// ---------------------------------------------------------------------------
// Qué arma lleva
// ---------------------------------------------------------------------------

export interface CarriedWeapon {
  /** Grupo de habilidades que abre su arma; null si no se sabe o es de hechicero. */
  group: WeaponGroup | null;
  /** Lleva báculo, varita o cetro, o solo hechizos. */
  caster: boolean;
  /** Cómo se llama la pieza, si la web la tiene. */
  piece: string | null;
}

/**
 * El arma del personaje: primero por el nombre de la pieza; si no dice nada,
 * por las habilidades que ya lleva (quien usa embates de maza lleva una maza).
 */
export function carriedWeapon(gems: GemKnowledge, profile: CharacterProfile | null): CarriedWeapon {
  const item = (profile?.items ?? []).find((entry) => entry.slot === "weapon") ?? null;
  const piece = item ? item.baseType || item.name || null : null;
  const read = item ? weaponInText(`${item.name} ${item.baseType}`) : null;
  if (read) return { ...read, piece };
  const own = ownSkills(gems, profile);
  const count = new Map<WeaponGroup, number>();
  for (const skill of own) for (const group of (skill.cutGroups ?? []).filter(isWeaponGroup)) count.set(group, (count.get(group) ?? 0) + 1);
  const group = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const caster = group === null && own.some((skill) => (skill.cutGroups ?? []).some(isSpellGroup));
  return { group, caster, piece };
}

/** La pregunta sin el nombre de la habilidad: «Lanza de rayos» no es llevar una lanza. */
function withoutSkillName(gems: GemKnowledge, q: string, skill: GemSkill | null): string {
  if (!skill) return q;
  let rest = ` ${q} `;
  for (const name of [skill.name, localizeSkill(skill, "en", gems.locale).name]) {
    rest = rest.replace(` ${normalizeQuestion(name)} `, " ");
  }
  return rest.trim();
}

const namedSkill = (gems: GemKnowledge, q: string): GemSkill | null => {
  const found = skillInQuestion(gems, q, null);
  return found?.how === "named" ? found.skill : null;
};

// ---------------------------------------------------------------------------
// La lista para el configurador de la web
// ---------------------------------------------------------------------------

/**
 * Las habilidades con su arma: lo que enseña «Monta tu build». Las que no
 * están en las tablas de tallado (las da un arma o una ascendencia) vienen
 * con `groups` vacío: no salen en las listas para elegir, pero la web necesita
 * su nombre en los dos idiomas para enseñar bien las que el jugador ya lleva.
 */
export function skillChoices(data: GemData, locale: GemLocale, lang: AdviceLang): SkillChoice[] {
  return data.skills
    .filter((skill) => skill.grade !== null)
    .map((skill) => {
      const shown = localizeSkill(skill, lang, locale);
      return {
        name: shown.name,
        alias: localizeSkill(skill, lang === "en" ? "es" : "en", locale).name,
        grade: skill.grade ?? 1,
        attribute: skill.attribute,
        tags: skill.tags,
        groups: skill.cutGroups ?? [],
        summary: firstSentence(shown.description),
        needsShield: needsShield(skill),
      };
    });
}

// ---------------------------------------------------------------------------
// «¿Qué habilidad me cojo?», «¿qué habilidades hay de ballesta?»
// ---------------------------------------------------------------------------

const NOUN = "(?:habilidad|habilidades|skill|skills|hechizo|hechizos|ataque|ataques|spell|spells|attack|attacks)";
const PICK = "(?:elegir|elijo|escoger|escojo|coger|cojo|pillo|pillar|pick|choose)";
const BROWSE = [
  new RegExp(`\\b(?:que|q|cual|cuales|which|what) (?:son |otras |mas )?(?:las |los )?${NOUN}\\b`),
  new RegExp(`\\b${NOUN}\\b.*\\b${PICK}\\b`),
  new RegExp(`\\b${PICK}\\b.*\\b${NOUN}\\b`),
];

export function isSkillBrowseQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (isSupportGemQuestion(normalizedQuestion)) return false;
  if (/\bsin tallar\b|\buncut\b|\basistencias?\b|\bsupports?\b/.test(q)) return false;
  // «¿Qué ataques hace el jefe?» pregunta por la pelea, no por qué coger.
  if (/\b(jefes?|boss|bosses|enemigos?|enemy|enemies|monstruos?|monsters?)\b/.test(q)) return false;
  return BROWSE.some((pattern) => pattern.test(q));
}

export function answerSkillBrowseQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isSkillBrowseQuestion(q)) return null;
  const en = lang === "en";
  const partner = /\b(combinan?|pegan?|van bien|va bien|go(es)? well|combine)\b/.test(` ${q} `) ? namedSkill(gems, q) : null;
  const rest = withoutSkillName(gems, q, namedSkill(gems, q));
  const asked = weaponInText(rest);
  const carried = carriedWeapon(gems, profile);
  const own = ownSkills(gems, profile);
  const ownSlugs = new Set(own.map((skill) => skill.slug));
  const wantsSpells = /\b(hechizos?|spells?)\b/.test(` ${q} `);
  const wantsAttacks = /\b(ataques?|attacks?)\b/.test(` ${q} `);

  // De qué grupos se enseña: el arma que nombra, la de la habilidad con la que
  // quiere combinar, la que lleva, o los hechizos.
  const partnerGroups = partner ? (partner.cutGroups ?? []).filter((group) => group !== SPIRIT_GROUP) : [];
  const ownSchools = [...new Set(own.flatMap((skill) => (skill.cutGroups ?? []).filter(isSpellGroup)))];
  let groups: string[];
  if (partnerGroups.length > 0) groups = partnerGroups;
  else if (asked?.group) groups = [asked.group];
  else if (wantsSpells || asked?.caster) groups = ownSchools.length > 0 ? ownSchools : [...SPELL_GROUPS];
  else if (carried.group) groups = [carried.group];
  else if (carried.caster) groups = ownSchools.length > 0 ? ownSchools : [...SPELL_GROUPS];
  else groups = [];

  if (groups.length === 0) {
    const counts = WEAPON_GROUPS.map(
      (group) => `${label(group, lang)} (${gems.data.skills.filter((skill) => (skill.cutGroups ?? []).includes(group)).length})`,
    );
    return en
      ? `To choose skills I need your weapon: every attack skill only works with one weapon type. Tell me which one you use (${counts.join(", ")}) or whether you cast spells, which need no particular weapon.\n\n${configuratorLine(lang)}\n\n${sourceNote(lang)}`
      : `Para elegir habilidades necesito saber tu arma: cada ataque solo vale con un tipo de arma. Dime cuál llevas (${counts.join(", ")}) o si lanzas hechizos, que no piden un arma concreta.\n\n${configuratorLine(lang)}\n\n${sourceNote(lang)}`;
  }

  const inGroups = gems.data.skills.filter(
    (skill) => skill.grade !== null && (skill.cutGroups ?? []).some((group) => groups.includes(group)),
  );
  const wantedTag = wantsSpells ? "Hechizo" : wantsAttacks ? "Ataque" : null;
  const typed = wantedTag ? inGroups.filter((skill) => skill.tags.includes(wantedTag)) : inGroups;
  // Con la mano secundaria vacía en un personaje con equipo, no hay escudo:
  // una habilidad que aporrea «tu escudo» no se propone.
  const items = profile?.items ?? [];
  const shieldOk = items.length === 0 || items.some((entry) => entry.slot === "offhand");
  const pool = (typed.length > 0 ? typed : inGroups).filter(
    (skill) => !ownSlugs.has(skill.slug) && skill.slug !== partner?.slug && (shieldOk || !needsShield(skill)),
  );

  // Lo que ya usa pesa: a quien lleva rayo se le enseña primero lo de rayo.
  const weight = new Map<string, number>();
  for (const skill of partner ? [partner] : own) {
    for (const tag of skill.tags) if (!VAGUE_TAGS.has(tag)) weight.set(tag, (weight.get(tag) ?? 0) + 1);
  }
  const sharedTags = (skill: GemSkill) => skill.tags.filter((tag) => weight.has(tag));
  const score = (skill: GemSkill) => sharedTags(skill).reduce((total, tag) => total + (weight.get(tag) ?? 0), 0);
  // Su gema más alta dice hasta dónde llega hoy: una habilidad a nivel 5 se
  // talló con una gema sin tallar de nivel 5, y esa gema vale para cualquier
  // habilidad de nivel de gema 5 o menos. Lo de más arriba es «para más adelante».
  const ownLevels = (profile?.skills ?? []).flatMap((setup) => (typeof setup.level === "number" ? [setup.level] : []));
  const reach = ownLevels.length > 0 ? Math.max(...ownLevels) : null;
  const within = (skill: GemSkill) => reach === null || (skill.grade ?? 99) <= reach;
  const picked = [...pool]
    .sort(
      (a, b) =>
        Number(within(b)) - Number(within(a)) ||
        // Dentro de lo que ya puede tallar, lo más parecido a lo suyo; fuera, lo que antes le llega.
        (within(a) ? score(b) - score(a) || (b.grade ?? 0) - (a.grade ?? 0) : (a.grade ?? 0) - (b.grade ?? 0) || score(b) - score(a)) ||
        a.name.localeCompare(b.name, "es"),
    )
    .slice(0, 5);
  if (picked.length === 0) return null;
  const later = reach !== null && picked.some((skill) => !within(skill));

  const line = (skill: GemSkill) => {
    const shown = localizeSkill(skill, lang, gems.locale);
    const details = [
      en ? `gem level ${skill.grade}` : `nivel de gema ${skill.grade}`,
      later && !within(skill) ? (en ? "for later" : "para más adelante") : "",
      skill.attribute ? ATTRIBUTE[lang][skill.attribute] : "",
      needsShield(skill) ? (en ? "needs a shield" : "pide escudo") : "",
      partner && sharedTags(skill).length > 0
        ? `${en ? "shares" : "comparten"}: ${sharedTags(skill).join(", ").toLowerCase()}`
        : "",
    ].filter(Boolean);
    return `• ${shown.name} (${details.join(", ")}): ${firstSentence(shown.description)}`;
  };

  const groupWords = joinOr(groups.map((group) => label(group, lang)), lang);
  const isWeapon = groups.some(isWeaponGroup);
  const carriedIsThis = carried.group !== null && groups.includes(carried.group);
  let intro: string;
  if (partner) {
    const partnerName = localizeSkill(partner, lang, gems.locale).name;
    intro = en
      ? `These ${groupWords} skills share tags with ${partnerName}. Sharing a tag means that whatever raises that kind of damage helps both; I can't tell you whether the combination is good:`
      : `Estas habilidades de ${groupWords} comparten etiquetas con ${partnerName}. Compartir etiqueta quiere decir que lo que suba ese tipo de daño les vale a las dos; no sé decirte si la combinación es buena:`;
  } else if (isWeapon) {
    const have = en
      ? carriedIsThis ? `You carry a ${groupWords}` : `With a ${groupWords}`
      : carriedIsThis ? `Llevas ${groupWords}` : `Con ${groupWords}`;
    const total = en
      ? `the game has ${inGroups.length} ${groupWords} skills`
      : `el juego tiene ${inGroups.length} habilidades de ${groupWords}`;
    const fits = weight.size > 0 ? (en ? "The ones closest to what you already use:" : "Las que más se parecen a lo que ya usas:") : en ? "Some of them:" : "Algunas:";
    intro = en
      ? `${have}: ${total}, and they only work with that weapon in hand. ${fits}`
      : `${have}: ${total}, y solo valen con esa arma en la mano. ${fits}`;
  } else {
    const fits = weight.size > 0 ? (en ? "The ones closest to what you already use:" : "Los que más se parecen a lo que ya usas:") : en ? "Some of them:" : "Algunos:";
    intro = en
      ? `Spells need no particular weapon. In ${groupWords} the game has ${inGroups.length} skills. ${fits}`
      : `Los hechizos no piden un arma concreta. En ${groupWords} el juego tiene ${inGroups.length} habilidades. ${fits}`;
  }

  // Pregunta por un arma que no es la suya: se avisa, no se calla.
  const otherWeapon =
    asked?.group && carried.group && asked.group !== carried.group
      ? en
        ? `\n\nNote: you carry a ${label(carried.group, lang)}. These only work with a ${label(asked.group, lang)} in hand.`
        : `\n\nOjo: tú llevas ${label(carried.group, lang)}. Estas solo valen con ${label(asked.group, lang)} en la mano.`
      : "";
  const more = pool.length - picked.length;
  const moreLine =
    more > 0
      ? en
        ? `\n\nThere are ${more} more. ${configuratorLine(lang).replace("To do it with clicks", "To see them all and pick with clicks")}`
        : `\n\nHay ${more} más. ${configuratorLine(lang).replace("Para hacerlo con clics", "Para verlas todas y elegir con clics")}`
      : `\n\n${configuratorLine(lang)}`;
  const reachNote =
    reach === null
      ? ""
      : en
        ? ` Your highest gem is level ${reach}: with an uncut gem like that one you can engrave anything of gem level ${reach} or lower.`
        : ` Tu gema más alta es de nivel ${reach}: con una sin tallar como esa puedes tallar cualquiera de nivel de gema ${reach} o menos.`;
  const gradeNote =
    (en
      ? "\"Gem level\" is the level of the uncut skill gem you need to engrave it."
      : "«Nivel de gema» es el nivel de la gema de habilidad sin tallar que hace falta para tallarla.") + reachNote;
  return `${intro}\n${picked.map(line).join("\n")}${otherWeapon}${moreLine}\n\n${gradeNote} ${sourceNote(lang)}`;
}

// ---------------------------------------------------------------------------
// «¿Me vale Flecha de rayo con mi mazo?», «¿mi build me vale con mi arco?»
// ---------------------------------------------------------------------------

const FIT_WORDS =
  /\b(vale|valen|sirve|sirven|puedo usar|se puede usar|funciona|funcionan|compatible|compatibles|encaja|encajan|works?|can i use|usable)\b/;

export function isSkillFitQuestion(gems: GemKnowledge, normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (!FIT_WORDS.test(q)) return false;
  if (/\basistencias?\b|\bsupports?\b|\bgemas? de (apoyo|soporte)\b/.test(q)) return false;
  const skill = namedSkill(gems, normalizedQuestion);
  const rest = ` ${withoutSkillName(gems, normalizedQuestion, skill)} `;
  const weaponWord = weaponInText(rest) !== null || /\b(arma|armas|weapon|weapons)\b/.test(rest);
  const buildWord = /\b(build|builds|habilidades|skills)\b/.test(q);
  return weaponWord && (skill !== null || buildWord);
}

/** Una línea por habilidad: vale, no vale, hechizo, espíritu o «no lo sé». */
function fitLine(gems: GemKnowledge, skill: GemSkill, weapon: WeaponGroup | null, lang: AdviceLang): { text: string; ok: boolean | null } {
  const en = lang === "en";
  const name = localizeSkill(skill, lang, gems.locale).name;
  const fit = skillWeaponFit(skill.cutGroups ?? [], weapon);
  if (fit.kind === "weapon") {
    const needs = joinOr(fit.weapons.map((group) => label(group, lang)), lang);
    if (fit.fits === true) return { ok: true, text: en ? `${name}: yes, it is a ${needs} skill.` : `${name}: sí, es una habilidad de ${needs}.` };
    if (fit.fits === false) return { ok: false, text: en ? `${name}: no, it is a ${needs} skill.` : `${name}: no, es una habilidad de ${needs}.` };
    return { ok: null, text: en ? `${name}: it is a ${needs} skill.` : `${name}: es una habilidad de ${needs}.` };
  }
  if (fit.kind === "spell") {
    return {
      ok: true,
      text: en
        ? `${name}: yes, it is a spell (${label(fit.school, lang)}) and spells need no particular weapon.`
        : `${name}: sí, es un hechizo (${label(fit.school, lang)}) y los hechizos no piden un arma concreta.`,
    };
  }
  if (fit.kind === "spirit") {
    return {
      ok: true,
      text: en
        ? `${name}: it is a spirit gem. It reserves Spirit and is not tied to a weapon group.`
        : `${name}: es una gema de espíritu. Reserva espíritu y no va atada a un grupo de arma.`,
    };
  }
  return {
    ok: null,
    text: en
      ? `${name}: I don't know. It is not in the engraving tables I have (it usually comes from a weapon, an ascendancy or another gem).`
      : `${name}: no lo sé. No está en las tablas de tallado que tengo (suele venir de un arma, de una ascendencia o de otra gema).`,
  };
}

export function answerSkillFitQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isSkillFitQuestion(gems, q)) return null;
  const en = lang === "en";
  const skill = namedSkill(gems, q);
  const asked = weaponInText(withoutSkillName(gems, q, skill));
  const carried = carriedWeapon(gems, profile);
  const weapon = asked ? asked.group : carried.group;
  const casterWeapon = asked ? asked.caster : carried.caster;
  const weaponWords = weapon
    ? label(weapon, lang)
    : casterWeapon
      ? en ? "a caster weapon (staff, wand or sceptre)" : "un arma de hechicero (báculo, varita o cetro)"
      : null;

  if (skill) {
    const fit = skillWeaponFit(skill.cutGroups ?? [], weapon);
    const name = localizeSkill(skill, lang, gems.locale).name;
    const does = `${en ? "What it does" : "Qué hace"}: ${firstSentence(localizeSkill(skill, lang, gems.locale).description)}`;
    if (fit.kind === "weapon") {
      const needs = joinOr(fit.weapons.map((group) => label(group, lang)), lang);
      if (weaponWords === null) {
        return en
          ? `${name} is a ${needs} skill: it only works with a ${needs} in hand. I don't know which weapon you carry, so I can't say yes or no.\n\n${does}\n\n${sourceNote(lang)}`
          : `${name} es una habilidad de ${needs}: solo vale con ${needs} en la mano. No sé qué arma llevas, así que no puedo decirte sí o no.\n\n${does}\n\n${sourceNote(lang)}`;
      }
      if (fit.fits) {
        return en
          ? `Yes. ${name} is a ${needs} skill and you carry a ${weaponWords}.\n\n${does}\n\n${noDamageNote(lang)} ${sourceNote(lang)}`
          : `Sí. ${name} es una habilidad de ${needs} y llevas ${weaponWords}.\n\n${does}\n\n${noDamageNote(lang)} ${sourceNote(lang)}`;
      }
      const yours = weapon
        ? en
          ? ` With a ${weaponWords} you do have ${gems.data.skills.filter((entry) => (entry.cutGroups ?? []).includes(weapon)).length} skills: ask me "which ${weaponWords} skills are there?".`
          : ` Con ${weaponWords} sí tienes ${gems.data.skills.filter((entry) => (entry.cutGroups ?? []).includes(weapon)).length} habilidades: pregúntame «¿qué habilidades hay de ${weaponWords}?».`
        : en
          ? " Spells are what goes with it: they need no particular weapon."
          : " Lo suyo son los hechizos, que no piden un arma concreta.";
      return en
        ? `No. ${name} is a ${needs} skill: it only works with a ${needs} in hand, and you carry ${weapon ? `a ${weaponWords}` : weaponWords}.${yours}\n\n${sourceNote(lang)}`
        : `No. ${name} es una habilidad de ${needs}: solo vale con ${needs} en la mano, y tú llevas ${weaponWords}.${yours}\n\n${sourceNote(lang)}`;
    }
    let lead: string;
    if (fit.kind === "spell") {
      lead = en
        ? `Yes. ${name} is a spell (${label(fit.school, lang)}) and spells need no particular weapon.`
        : `Sí. ${name} es un hechizo (${label(fit.school, lang)}) y los hechizos no piden un arma concreta.`;
    } else if (fit.kind === "spirit") {
      lead = en
        ? `${name} is a spirit gem: it reserves Spirit and is not tied to a weapon group.`
        : `${name} es una gema de espíritu: reserva espíritu y no va atada a un grupo de arma.`;
    } else {
      lead = en
        ? `I don't know. ${name} is not in the engraving tables I have (it usually comes from a weapon, an ascendancy or another gem), so I can't tell which weapon it needs.`
        : `No lo sé. ${name} no está en las tablas de tallado que tengo (suele venir de un arma, de una ascendencia o de otra gema), así que no sé qué arma pide.`;
    }
    return `${lead}\n\n${does}\n\n${noDamageNote(lang)} ${sourceNote(lang)}`;
  }

  // Sin nombrar una: se miran las que lleva, una por una.
  const own = ownSkills(gems, profile);
  if (own.length === 0) {
    return en
      ? `I don't know your skills yet, so I can't check them against your weapon. Add them to your character, or ask me about one by name ("does Lightning Arrow work with my mace?").\n\n${sourceNote(lang)}`
      : `Aún no sé qué habilidades llevas, así que no puedo mirarlas contra tu arma. Añádelas a tu personaje o pregúntame por una con su nombre («¿me vale Flecha de rayo con mi mazo?»).\n\n${sourceNote(lang)}`;
  }
  const lines = own.map((entry) => fitLine(gems, entry, weapon, lang));
  const usable = lines.filter((entry) => entry.ok === true).length;
  const unknown = lines.filter((entry) => entry.ok === null).length;
  const withWeapon = weaponWords ?? (en ? "your weapon (I don't know which one it is)" : "tu arma (no sé cuál es)");
  const head = en
    ? `With ${weapon ? `a ${withWeapon}` : withWeapon} you can use ${usable} of your ${own.length} skills${unknown > 0 ? `; ${unknown} I can't tell` : ""}:`
    : `Con ${withWeapon} puedes usar ${usable} de tus ${own.length} habilidades${unknown > 0 ? `; de ${unknown} no lo sé` : ""}:`;
  return `${head}\n${lines.map((entry) => `• ${entry.text}`).join("\n")}\n\n${noDamageNote(lang)} ${sourceNote(lang)}`;
}

// ---------------------------------------------------------------------------
// «¿Por qué combina Furia con Terremoto?»
// ---------------------------------------------------------------------------

const WHY_WORDS = /\b(por que|porque|why)\b|\b(combina|combinan|pega|pegan|encaja|encajan)\b|\bvan? bien\b|\bgo(es)? well\b/;

interface SupportAndSkill {
  family: NonNullable<ReturnType<typeof supportFamilyIn>>;
  skill: GemSkill;
}

function supportAndSkillIn(gems: GemKnowledge, q: string): SupportAndSkill | null {
  const family = supportFamilyIn(gems, q);
  if (!family) return null;
  // El nombre de la asistencia se quita antes de buscar la habilidad.
  let rest = ` ${q} `;
  for (const name of [family.base, localizeSupport(family.tiers[0]!, "en", gems.locale).name.replace(/\s+[IVX]+$/, "")]) {
    rest = rest.replace(` ${normalizeQuestion(name)} `, " ");
  }
  const skill = namedSkill(gems, rest.trim());
  return skill ? { family, skill } : null;
}

export function isWhyCombineQuestion(gems: GemKnowledge, normalizedQuestion: string): boolean {
  return WHY_WORDS.test(` ${normalizedQuestion} `) && supportAndSkillIn(gems, normalizedQuestion) !== null;
}

export function answerWhyCombineQuestion(gems: GemKnowledge, question: string, lang: AdviceLang): string | null {
  const q = normalizeQuestion(question);
  if (!isWhyCombineQuestion(gems, q)) return null;
  const found = supportAndSkillIn(gems, q);
  if (!found) return null;
  const en = lang === "en";
  const { family, skill } = found;
  const tier = family.tiers[0]!;
  const support = localizeSupport(tier, lang, gems.locale);
  const supportName = support.name.replace(/\s+[IVX]+$/, "");
  const shownSkill = localizeSkill(skill, lang, gems.locale);
  const candidates = supportCandidates(gems.data, { skill, maxGrade: 5, attributes: ALL_ATTRIBUTES });
  const rank = candidates.findIndex((entry) => entry.support.name.replace(/\s+[IVX]+$/, "") === family.base);
  const shared = tier.tags.filter((tag) => skill.tags.includes(tag) && !VAGUE_TAGS.has(tag));
  const sharedText = shared.join(", ").toLowerCase();
  const grade = ROMAN[tier.grade ?? 1] ?? "I";
  const gives = `• ${en ? `What it gives (tier ${grade})` : `Qué le da (grado ${grade})`}: ${firstSentence(supportMainBenefit(support))}`;
  const does = `• ${en ? `What ${shownSkill.name} does` : `Qué hace ${shownSkill.name}`}: ${firstSentence(shownSkill.description)}`;
  const tagsOfSkill = skill.tags.join(", ").toLowerCase();

  if (rank < 0) {
    return en
      ? `${supportName} does not fit ${shownSkill.name}. ${firstSentence(support.description)} ${shownSkill.name} has these tags: ${tagsOfSkill}.\n${gives}\n${does}\n\nAsk me "which support gem do I put on ${shownSkill.name}?" and I'll show the ones that do fit. ${sourceNote(lang)}`
      : `${supportName} no encaja con ${shownSkill.name}. ${firstSentence(support.description)} ${shownSkill.name} lleva estas etiquetas: ${tagsOfSkill}.\n${gives}\n${does}\n\nPregúntame «¿qué asistencia le pongo a ${shownSkill.name}?» y te enseño las que sí le valen. ${sourceNote(lang)}`;
  }
  const why = shared.length > 0
    ? en
      ? `They share ${shared.length === 1 ? "the tag" : "the tags"} ${sharedText}: the gem assists exactly that kind of skill.`
      : `Comparten ${shared.length === 1 ? "la etiqueta" : "las etiquetas"} ${sharedText}: la gema asiste justo ese tipo de habilidad.`
    : firstSentence(support.description);
  const place = en
    ? `• In my list for ${shownSkill.name} it is number ${rank + 1} of ${candidates.length} supports that fit, sorted by tags.`
    : `• En mi lista para ${shownSkill.name} es la número ${rank + 1} de ${candidates.length} asistencias que le valen, ordenadas por etiquetas.`;
  return en
    ? `${supportName} fits ${shownSkill.name}. ${why}\n${gives}\n${does}\n${place}\n\n${noDamageNote(lang)} ${sourceNote(lang)}`
    : `${supportName} sí encaja con ${shownSkill.name}. ${why}\n${gives}\n${does}\n${place}\n\n${noDamageNote(lang)} ${sourceNote(lang)}`;
}

// ---------------------------------------------------------------------------
// «¿Cómo monto mi propia build?»
// ---------------------------------------------------------------------------

export function isOwnBuildQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  return (
    /\b(montar|monto|montarme|crear|creo|crearme|hacer|hago|hacerme|armar|armo|armarme|make|create|build)\b.*\b(build|builds)\b/.test(q) ||
    /\b(mi|una|tu) propia build\b|\bbuild propia\b|\bmy own build\b|\b(que|which|what) build\b/.test(q)
  );
}

export function answerOwnBuildQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isOwnBuildQuestion(q)) return null;
  const en = lang === "en";
  const carried = carriedWeapon(gems, profile);
  const main = ownSkills(gems, profile)[0] ?? null;
  const mainName = main ? localizeSkill(main, lang, gems.locale).name : null;
  const weaponWords = carried.group ? label(carried.group, lang) : null;
  const count = carried.group ? gems.data.skills.filter((skill) => (skill.cutGroups ?? []).includes(carried.group!)).length : 0;
  if (en) {
    const weapon = weaponWords
      ? `You carry a ${weaponWords}: the game has ${count} ${weaponWords} skills.`
      : carried.caster
        ? "You cast spells, which need no particular weapon."
        : "I don't know which weapon you carry.";
    return [
      "I'll help you build your own, step by step. I don't hand you a finished build.",
      `• Step 1, the weapon decides. Every attack skill works with one weapon type only; spells need no particular weapon. ${weapon}`,
      `• Step 2, pick a main skill. Ask me "which ${weaponWords ?? "bow"} skills are there?".`,
      `• Step 3, give it support gems that fit. Ask me "which support gem do I put on ${mainName ?? "my skill"}?" or "why does … go well with …?".`,
      '• Step 4, check it all works with your weapon: "does my build work with my weapon?".',
      "",
      configuratorLine(lang),
      "",
      `${noDamageNote(lang)} ${sourceNote(lang)}`,
    ].join("\n");
  }
  const weapon = weaponWords
    ? `Llevas ${weaponWords}: el juego tiene ${count} habilidades de ${weaponWords}.`
    : carried.caster
      ? "Tú lanzas hechizos, que no piden un arma concreta."
      : "No sé qué arma llevas.";
  return [
    "Te ayudo a montar la tuya, paso a paso. No te doy una build hecha.",
    `• Paso 1, el arma manda. Cada ataque solo vale con un tipo de arma; los hechizos no piden un arma concreta. ${weapon}`,
    `• Paso 2, elige una habilidad principal. Pregúntame «¿qué habilidades hay de ${weaponWords ?? "arco"}?».`,
    `• Paso 3, ponle asistencias que le encajen. Pregúntame «¿qué asistencia le pongo a ${mainName ?? "mi habilidad"}?» o «¿por qué combina … con …?».`,
    "• Paso 4, comprueba que todo vale con tu arma: «¿mi build me vale con mi arma?».",
    "",
    configuratorLine(lang),
    "",
    `${noDamageNote(lang)} ${sourceNote(lang)}`,
  ].join("\n");
}

/** Las cuatro, en orden: la más concreta primero. */
export function answerSkillChoiceTopic(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  return (
    answerWhyCombineQuestion(gems, question, lang) ??
    answerSkillFitQuestion(gems, question, profile, lang) ??
    answerOwnBuildQuestion(gems, question, profile, lang) ??
    answerSkillBrowseQuestion(gems, question, profile, lang)
  );
}
