/**
 * Preguntas al Mentor sobre gemas de asistencia («¿hay alguna gema de
 * asistencia para Descarga de caos que dé más proyectiles?»).
 *
 * El Mentor contesta con lo mismo que el consejero de gemas: las reglas y los
 * datos del juego deciden qué asistencias valen para esa habilidad. No hay IA
 * y no se inventa nada: si la web no sabe de qué habilidad se habla, lo dice.
 */
import type { CharacterProfile } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import {
  supportCandidates,
  supportMainBenefit,
  type AdviceLang,
  type GemAttribute,
  type GemData,
  type GemSkill,
  type GemSupport,
} from "../../shared/supportGemAdvice.js";
import {
  findSkillAnyLang,
  localizeSkill,
  localizeSupport,
  toSpanishGemName,
  type GemLocale,
} from "../advice/gemLocale.js";

export interface GemKnowledge {
  data: GemData;
  locale: GemLocale;
}

/** «gema(s)» junto a «asistencia / soporte», o «support gem». */
export function isSupportGemQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  const spanish = /\bgemas?\b/.test(q) && /\b(asistencias?|soportes?|apoyo)\b/.test(q);
  const english = /\bsupport(s| gems?)?\b/.test(q) && /\b(gems?|supports?)\b/.test(q);
  return spanish || english;
}

/** Algo concreto que el jugador pide a la asistencia, y cómo se reconoce en sus efectos. */
interface Wish {
  id: "projectiles" | "area";
  asks: RegExp;
  /** Sobre el efecto en español, ya normalizado (sin tildes ni mayúsculas). */
  effect: RegExp;
  /** Sobre el efecto en inglés, normalizado: solo para elegir qué línea enseñar. */
  effectEn: RegExp;
}

const WISHES: readonly Wish[] = [
  {
    id: "projectiles",
    asks: /multiplic|mas proyectil|varios proyectil|proyectiles? adicional|mas disparos|dispar\w* mas|se divid|bifurc|more projectile|multiple projectile|additional projectile|extra projectile|multishot|split|fork/,
    effect: /proyectiles? adicional|bifurc/,
    effectEn: /additional projectile|fork/,
  },
  {
    id: "area",
    asks: /mas area|area mas|mayor area|area de efecto|mas grande|more area|bigger area|area of effect|\baoe\b/,
    // «Un 50 % menos de área de efecto» es justo lo contrario de lo que pide.
    effect: /area de efecto aumentada|mas de area de efecto/,
    effectEn: /increased area of effect|more area of effect/,
  },
];

/** Palabras de la pregunta que no ayudan a reconocer una habilidad. */
const STOP_WORDS = new Set([
  "gema", "gemas", "asistencia", "asistencias", "soporte", "soportes", "apoyo", "support", "supports", "gems",
  "para", "alguna", "algun", "haga", "hace", "puede", "pueda", "pongo", "poner", "mejor", "cual", "cuales",
  "como", "tengo", "quiero", "that", "what", "which", "there", "with", "make", "makes", "have", "does", "best",
]);

const tokensOf = (text: string): string[] =>
  normalizeQuestion(text)
    .split(" ")
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));

interface ResolvedSkill {
  skill: GemSkill;
  /** `named`: la pregunta la nombra. `similar`: se parece a una del personaje. `main`: su habilidad principal. */
  how: "named" | "similar" | "main";
}

/** De qué habilidad habla la pregunta. null si la web no puede saberlo. */
export function skillInQuestion(
  gems: GemKnowledge,
  normalizedQuestion: string,
  profile: CharacterProfile | null,
): ResolvedSkill | null {
  const padded = ` ${normalizedQuestion} `;
  // 1) La pregunta dice el nombre tal cual, en español o en inglés: gana el más largo.
  let named: GemSkill | null = null;
  let namedLength = 0;
  for (const skill of gems.data.skills) {
    for (const name of [skill.name, localizeSkill(skill, "en", gems.locale).name]) {
      const normalized = normalizeQuestion(name);
      if (normalized.length > namedLength && padded.includes(` ${normalized} `)) {
        named = skill;
        namedLength = normalized.length;
      }
    }
  }
  if (named) return { skill: named, how: "named" };

  // 2) No lo dice bien («disparo de caos»): la del personaje que más palabras comparte.
  const own = (profile?.skills ?? [])
    .map((setup) => findSkillAnyLang(gems.data, gems.locale, setup.mainSkill || setup.label))
    .filter((skill): skill is GemSkill => skill !== null);
  const words = new Set(tokensOf(normalizedQuestion));
  let similar: GemSkill | null = null;
  let shared = 0;
  for (const skill of own) {
    const names = [skill.name, localizeSkill(skill, "en", gems.locale).name];
    const count = Math.max(...names.map((name) => tokensOf(name).filter((word) => words.has(word)).length));
    if (count > shared) {
      similar = skill;
      shared = count;
    }
  }
  if (similar) return { skill: similar, how: "similar" };

  // 3) Ni eso: su habilidad principal, avisando.
  return own[0] ? { skill: own[0], how: "main" } : null;
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const ATTRIBUTE: Record<AdviceLang, Record<GemAttribute, string>> = {
  es: { Fue: "fuerza", Des: "destreza", Int: "inteligencia" },
  en: { Fue: "Strength", Des: "Dexterity", Int: "Intelligence" },
};

const ALL_ATTRIBUTES: readonly GemAttribute[] = ["Fue", "Des", "Int"];
const SHOWN = 3;

/**
 * La respuesta del Mentor a una pregunta de gemas de asistencia, o null si no
 * es una pregunta de ese tipo.
 */
export function answerSupportGemQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const normalized = normalizeQuestion(question);
  if (!isSupportGemQuestion(normalized)) return null;
  const en = lang === "en";
  const where = en
    ? "To fine-tune it with your uncut gem's tier and your free slots: Guides → “Which support gem do I use?”."
    : "Para afinarlo con el grado de tu gema sin tallar y tus huecos: Guías → «¿Qué gema de asistencia pongo?».";

  const resolved = skillInQuestion(gems, normalized, profile);
  if (!resolved) {
    return en
      ? `Tell me which skill it's for, by its in-game name, and I'll tell you which supports fit. ${where}`
      : `Dime para qué habilidad es, con el nombre que tiene en el juego, y te digo qué asistencias le van. ${where}`;
  }

  const shownSkill = localizeSkill(resolved.skill, lang, gems.locale).name;
  // Lo que ya lleva puesto no se vuelve a proponer: cada asistencia solo cabe una vez.
  const socketed = (profile?.skills ?? [])
    .flatMap((setup) => setup.supports.map((support) => support.name))
    .map((name) => toSpanishGemName(gems.data, gems.locale, name));
  const candidatesUpTo = (maxGrade: number): GemSupport[] =>
    supportCandidates(gems.data, {
      skill: resolved.skill,
      maxGrade,
      attributes: ALL_ATTRIBUTES,
      socketed,
      build: profile?.archetype ? { archetype: profile.archetype.slice(0, 200) } : null,
    }).map((candidate) => candidate.support);
  // Sin saber el grado de su gema sin tallar, se enseña lo mejor que existe.
  const candidates = candidatesUpTo(5);

  const wish = WISHES.find((entry) => entry.asks.test(normalized)) ?? null;
  const matchesWish = (support: GemSupport) =>
    wish !== null && support.effects.some((effect) => wish.effect.test(normalizeQuestion(effect)));
  // ¿Lo hace siempre, o solo «con un 20 % de probabilidad» o al azar?
  const chancy = (support: GemSupport) =>
    support.effects.some((effect) => {
      const text = normalizeQuestion(effect);
      return wish !== null && wish.effect.test(text) && /probabilidad|aleatori/.test(text);
    });
  // Cuando pide algo concreto, importa cuál puede tallar antes. El consejero
  // solo enseña la versión más alta de cada familia, así que se miran los
  // cinco grados y, de cada asistencia, se queda la de grado más bajo que lo
  // hace: primero las que lo hacen siempre, luego por grado.
  const granted: GemSupport[] = [];
  if (wish) {
    const seen = new Set<string>();
    const pool: GemSupport[] = [];
    for (let grade = 1; grade <= 5; grade += 1) {
      for (const support of candidatesUpTo(grade)) {
        if (seen.has(support.slug) || !matchesWish(support)) continue;
        seen.add(support.slug);
        pool.push(support);
      }
    }
    pool.sort((x, y) => Number(chancy(x)) - Number(chancy(y)) || (x.grade ?? 9) - (y.grade ?? 9));
    const names = new Set<string>();
    for (const support of pool) {
      const base = support.name.replace(/\s+[IVX]+$/, "");
      if (names.has(base)) continue;
      names.add(base);
      granted.push(support);
    }
  }
  const picked = (granted.length > 0 ? granted : candidates).slice(0, SHOWN);

  const lead =
    resolved.how === "named"
      ? ""
      : resolved.how === "similar"
        ? en
          ? `I take it you mean ${shownSkill}. `
          : `Entiendo que hablas de ${shownSkill}. `
        : en
          ? `I can't tell which skill you mean, so I'm answering for your main one, ${shownSkill}. `
          : `No sé de qué habilidad hablas, así que te contesto para tu principal, ${shownSkill}. `;

  if (picked.length === 0) {
    return (
      lead +
      (en
        ? `I can't find any support that fits ${shownSkill} in the game data I have. ${where}`
        : `No encuentro ninguna asistencia que encaje con ${shownSkill} en los datos del juego que tengo. ${where}`)
    );
  }

  const line = (support: GemSupport): string => {
    const shown = localizeSupport(support, lang, gems.locale);
    const pattern = wish && granted.length > 0 ? (en ? wish.effectEn : wish.effect) : null;
    const effect =
      (pattern && shown.effects.find((text) => pattern.test(normalizeQuestion(text)))) || supportMainBenefit(shown);
    const grade = support.grade ? ` ${en ? "tier" : "grado"} ${ROMAN[support.grade] ?? support.grade},` : "";
    // Lo que cuesta ponerla, si lo dice: no se enseña solo la parte buena.
    const cost = shown.effects.find(
      (text) => text !== effect && /\d menos de |\bless\b|\breduced\b/.test(normalizeQuestion(text)),
    );
    const tradeOff = cost ? (en ? ` In exchange: ${cost}.` : ` A cambio: ${cost}.`) : "";
    return `• ${shown.name} (${grade.trim()} ${ATTRIBUTE[lang][support.attribute]}): ${effect}.${tradeOff}`.replace("( ", "(");
  };

  const intro =
    wish && granted.length > 0
      ? en
        ? `Yes. For ${shownSkill}, these supports do that:`
        : `Sí. Para ${shownSkill}, estas asistencias hacen eso:`
      : wish
        ? en
          ? `I can't find a support that does that for ${shownSkill} in the game data I have. The ones that fit it best are:`
          : `No encuentro una asistencia que haga eso con ${shownSkill} en los datos del juego que tengo. Las que mejor le van son:`
        : en
          ? `For ${shownSkill}, the supports that fit it best are:`
          : `Para ${shownSkill}, las asistencias que mejor le van son:`;

  const rules = en ? "This comes from the game's data and fixed rules, no AI." : "Sale de los datos del juego y de reglas fijas, sin IA.";
  return `${lead}${intro}\n${picked.map(line).join("\n")}\n\n${rules} ${where}`;
}
