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
import { maxGemLevelFor } from "../../shared/quickReview.js";
import {
  assumedMaxGrade,
  supportCandidates,
  supportMainBenefit,
  worksOnlySometimes,
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

/**
 * «¿Cómo consigo más huecos para gemas de asistencia?» pregunta por los
 * engarces, no por qué asistencia poner (caso de la medición del 24-11-2026:
 * se contestaba con tres asistencias para Flecha de rayo).
 */
export function isSupportSocketQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  const sockets = /\b(huecos?|engarces?|ranuras?|sockets?|slots?)\b/.test(q);
  const supports = /\b(asistencias?|soportes?|apoyo|gemas?|supports?|gems?)\b/.test(q);
  const more =
    /\b(mas|consigo|conseguir|consiguen|saco|sacar|abro|abrir|anado|anadir|desbloqueo|desbloquear|aumento|aumentar|tercer|cuarto|quinto)\b/.test(q) ||
    /\b(more|get|add|unlock|extra|another|third|fourth|fifth)\b/.test(q);
  return sockets && supports && more;
}

/**
 * «gema(s)» junto a «asistencia / soporte», «support gem», o «asistencia» a
 * secas cuando se pregunta por ella («¿hay alguna asistencia para…?», «¿qué
 * asistencia le pongo?»): un novato no escribe «gema de asistencia» cada vez
 * (medición del 24-11-2026). «Necesito asistencia» no es una pregunta de gemas.
 */
export function isSupportGemQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (isSupportSocketQuestion(normalizedQuestion)) return false;
  const bare =
    /\b(que|cual|cuales|alguna|algunas|otra|otras|mejor|mejores|primera|las|mis|esta|esa) asistencias?\b/.test(q) ||
    /\basistencias? (para|de grado|le|les|a mi|a la|al|que le|van|va)\b/.test(q) ||
    /\b(pongo|poner|ponerle|uso|usar|engarzo|engarzar|cojo|coger|cambio|cambiar)\b.*\basistencias?\b/.test(q);
  const spanish = (/\bgemas?\b/.test(q) && /\b(asistencias?|soportes?|apoyo)\b/.test(q)) || bare;
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

/**
 * «¿Qué gemas pondrías en Drenar esencia?»: no dice «asistencia», pero las
 * gemas que se ponen EN una habilidad son sus asistencias (caso real de Luis
 * en la web, 24-11-2026). Hace falta que nombre la habilidad tal cual; con una
 * gema sin tallar es otra pregunta (qué habilidad tallar).
 */
export function asksGemsForNamedSkill(gems: GemKnowledge, normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (!/\bgemas?\b|\bgems?\b/.test(q) || /\bsin tallar\b|\buncut\b/.test(q)) return false;
  const putting =
    /\b(pongo|pondria|pondrias|poner|ponerle|meto|meteria|meterias|meter|meterle|engarzo|engarzar|llevo|llevar|uso|usar|van|va)\b/.test(q) ||
    /\b(put|use|socket|link|go|goes|run)\b/.test(q);
  return putting && skillInQuestion(gems, normalizedQuestion, null)?.how === "named";
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const ROMAN_VALUE: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

/**
 * El grado de la gema sin tallar, si la pregunta lo dice («de grado 3», «tier
 * II»). La gema lo llama «nivel»: solo cuenta así si habla de una sin tallar,
 * para no tomar «soy nivel 5» por un grado.
 */
function gradeIn(q: string): number | null {
  const uncut = /\bsin tallar\b|\buncut\b/.test(q);
  const match =
    /\b(?:grado|tier) ([1-5]|i{1,3}|iv|v)\b/.exec(q) ?? (uncut ? /\b(?:nivel|level|lvl) ([1-5])\b/.exec(q) : null);
  if (!match) return null;
  return ROMAN_VALUE[match[1]!] ?? Number(match[1]);
}
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
  /** La pregunta no habla de asistencias, pero quien llama ya sabe que hacen falta. */
  ungated = false,
): string | null {
  const normalized = normalizeQuestion(question);
  if (!ungated && !isSupportGemQuestion(normalized) && !asksGemsForNamedSkill(gems, normalized)) return null;
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
  // El grado manda: una asistencia de grado V no le sirve a quien solo puede
  // tallar las de grado I (caso real, 24-11-2026: grados IV y V para un
  // guerrero de nivel 14). Si la pregunta dice el grado, ese. «Mi primera gema
  // de asistencia» es de grado I. Si no, el que se supone por su nivel, y la
  // respuesta lo avisa.
  const firstGem = /\bprime\w*\b|\bfirst\b/.test(normalized);
  const statedGrade = gradeIn(normalized);
  const level = profile && profile.level > 0 ? profile.level : null;
  const maxGrade = statedGrade ?? (firstGem ? 1 : assumedMaxGrade(level));
  const assumed = statedGrade === null && !firstGem;
  const ranked = candidatesUpTo(maxGrade);
  // La primera gema de un novato: antes lo que funciona siempre que lo que
  // pide un cadáver cerca o solo sale «con un 40% de probabilidad».
  const candidates = firstGem
    ? [...ranked.filter((support) => !worksOnlySometimes(support)), ...ranked.filter(worksOnlySometimes)]
    : ranked;

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
  // hace: primero las que ya puede tallar, luego las que lo hacen siempre,
  // luego por grado.
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
    const outOfReach = (support: GemSupport) => Number((support.grade ?? 9) > maxGrade);
    pool.sort(
      (x, y) => outOfReach(x) - outOfReach(y) || Number(chancy(x)) - Number(chancy(y)) || (x.grade ?? 9) - (y.grade ?? 9),
    );
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
      : firstGem && resolved.how === "main"
        ? en
          ? `Put it in your main skill, ${shownSkill}. `
          : `Ponla en tu habilidad principal, ${shownSkill}. `
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

  // Si el grado se ha supuesto, se dice: el jugador puede tener una gema mejor.
  const upTo = ROMAN[maxGrade] ?? String(maxGrade);
  const sayGrade = en
    ? "If your uncut gem is a higher tier, tell me in the question (“tier III”)."
    : "Si tu gema sin tallar es de un grado más alto, dímelo en la pregunta («de grado III»).";
  // Cuando pide algo concreto se enseñan también las que lo hacen en un grado
  // más alto: no se puede decir a la vez «solo te enseño hasta grado II».
  const beyond = picked.filter((support) => (support.grade ?? 0) > maxGrade);
  const within = picked.filter((support) => (support.grade ?? 0) <= maxGrade);
  const gradeNote = !assumed
    ? ""
    : beyond.length > 0
      ? en
        ? `${within.length > 0 ? `You can engrave ${within.map((support) => localizeSupport(support, lang, gems.locale).name).join(", ")} now. ` : ""}The ones of tier ${[...new Set(beyond.map((support) => ROMAN[support.grade ?? 0] ?? support.grade))].join(", ")} need an uncut support gem of that tier: you may not have one yet.\n\n`
        : `${within.length > 0 ? `${within.map((support) => support.name).join(", ")} ya la puedes tallar. ` : ""}Las de grado ${[...new Set(beyond.map((support) => ROMAN[support.grade ?? 0] ?? support.grade))].join(", ")} piden una gema de asistencia sin tallar de ese grado: puede que aún no la tengas.\n\n`
      : maxGrade === 1
      ? en
        ? `I'm only showing tier I${level ? `: at level ${level} those are the ones you can surely engrave` : ""}. ${sayGrade}\n\n`
        : `Solo te enseño las de grado I${level ? `: a nivel ${level} son las que seguro puedes tallar` : ""}. ${sayGrade}\n\n`
      : en
        ? `I'm only showing up to tier ${upTo}. ${sayGrade}\n\n`
        : `Solo te enseño hasta grado ${upTo}. ${sayGrade}\n\n`;

  const rules = en ? "This comes from the game's data and fixed rules, no AI." : "Sale de los datos del juego y de reglas fijas, sin IA.";
  return `${lead}${intro}\n${picked.map(line).join("\n")}\n\n${gradeNote}${rules} ${where}`;
}

// ---------------------------------------------------------------------------
// «Necesito ayuda para mejorar Drenar esencia»
// ---------------------------------------------------------------------------

/**
 * Nombra una habilidad y pide que vaya mejor («necesito ayuda para mejorar
 * drenar esencia», pregunta real de Luis en la web el 25-11-2026: se quedaba
 * en «todavía no sé responder eso»). «¿Qué es mejor, A o B?» no es esto.
 */
export function asksToImproveNamedSkill(gems: GemKnowledge, normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  const improve =
    /\b(mejor(ar|arla|arlo|o|a|e|as|aria|arias)|potenci\w+|optimiz\w+|reforz\w+)\b/.test(q) ||
    /\bmas (fuerte|potente)\b|\bsacar(le)? (mas )?partido\b|\bsubir(le)? (el )?dano\b/.test(q) ||
    /\b(improve|improving|boost|buff|stronger|optimi[sz]e)\b|\bmake .* better\b/.test(q);
  return improve && skillInQuestion(gems, normalizedQuestion, null)?.how === "named";
}

/**
 * Lo que hace pegar más a UNA habilidad: el nivel de su gema, el árbol y sus
 * asistencias. Todo sale de los datos del juego y del personaje guardado; lo
 * que la web no sabe (a qué nivel lleva la gema) lo dice.
 */
export function answerImproveSkillQuestion(
  gems: GemKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const normalized = normalizeQuestion(question);
  if (!asksToImproveNamedSkill(gems, normalized)) return null;
  const en = lang === "en";
  const skill = skillInQuestion(gems, normalized, null)!.skill;
  const shown = localizeSkill(skill, lang, gems.locale).name;
  const setup =
    (profile?.skills ?? []).find(
      (candidate) => findSkillAnyLang(gems.data, gems.locale, candidate.mainSkill || candidate.label)?.name === skill.name,
    ) ?? null;
  const level = profile && profile.level > 0 && profile.levelSource !== "placeholder" ? profile.level : null;
  const max = level === null ? null : maxGemLevelFor(level);
  const gemLevel = setup?.level && setup.level > 0 ? setup.level : null;
  const arrow = en ? "press the ↑ arrow next to the skill" : "pulsa la flecha ↑ junto a la habilidad";

  const gemLine =
    gemLevel !== null && max !== null
      ? gemLevel < max
        ? en
          ? `Your gem is level ${gemLevel} and at character level ${level} you can take it to ${max}. Level it up with an Uncut Skill Gem of level ${max} or higher: ${arrow}.`
          : `La llevas a nivel ${gemLevel} y a tu nivel (${level}) puedes tenerla a ${max}. Súbela con una gema sin tallar de nivel ${max} o más: ${arrow}.`
        : en
          ? `Your gem is level ${gemLevel}, the highest your character level (${level}) allows. Nothing to do here for now.`
          : `La llevas a nivel ${gemLevel}, lo máximo que te deja tu nivel (${level}). Aquí no hay nada que hacer por ahora.`
      : max !== null
        ? en
          ? `At character level ${level} you can have it at level ${max}. I don't know what level yours is: if it's lower, level it up with an Uncut Skill Gem of level ${max} or higher (${arrow}).`
          : `A tu nivel (${level}) puedes tenerla a nivel ${max}. No sé a qué nivel la llevas: si va por debajo, súbela con una gema sin tallar de nivel ${max} o más (${arrow}).`
        : en
          ? `Keep its gem as high as your level allows: you level it up with a higher Uncut Skill Gem (${arrow}). Tell me your level and I'll tell you the number.`
          : `Lleva su gema al nivel más alto que te deje tu nivel: se sube con una gema sin tallar más alta (${arrow}). Dime tu nivel y te digo el número.`;

  const treeLine = en
    ? "The “Your passive tree” card sorts the notables by what they add to your main skills. Or ask me “where do I go next on the tree?”."
    : "La tarjeta «Tu árbol de pasivas» ordena los notables por lo que dan a tus habilidades principales. O pregúntame «¿por dónde sigo en el árbol?».";

  const supports = answerSupportGemQuestion(gems, question, profile, lang, true) ?? "";
  const intro = en ? `${shown} gets better in three places:` : `${shown} mejora por tres sitios:`;
  const gemTitle = en ? "1. Its gem level." : "1. El nivel de su gema.";
  const treeTitle = en ? "2. The passive tree." : "2. El árbol de pasivas.";
  const supportTitle = en ? "3. Its support gems." : "3. Sus asistencias.";
  return `${intro}\n\n${gemTitle} ${gemLine}\n\n${treeTitle} ${treeLine}\n\n${supportTitle} ${supports}`;
}
