/**
 * Lo básico que pregunta un novato y que el Mentor no sabía contestar
 * (medición del 24-11-2026, docs/MEDICION-MENTOR-2.md): comparar dos piezas,
 * cuánta resistencia hace falta, una gema que sale en rojo, cómo conseguir más
 * huecos de asistencia, qué es el espíritu, qué ascendencia hay, para qué
 * sirve un orbe exaltado y escudo o arma a dos manos.
 *
 * Aquí no hay IA ni conocimiento de memoria. Cada respuesta sale de una de
 * estas fuentes, y lo dice:
 *  - el personaje del jugador (piezas, atributos, resistencias, habilidades);
 *  - los datos de gemas y el árbol oficial que la web ya tiene;
 *  - las guías por acto de la web (las cifras de abajo se comprueban contra
 *    ellas en `tests/unit/basicsQuestions.test.ts`);
 *  - textos del propio juego copiados de poe2db, con su fecha.
 * Lo que ninguna de las cuatro trae se dice que no se sabe.
 */
import type { CharacterProfile } from "../../shared/domain.js";
import { isItemSwapQuestion, normalizeQuestion } from "../../shared/mentorIntent.js";
import { exportClassName } from "../../shared/passiveTree.js";
import { ASCENDANCY_FROM_SPANISH } from "../../shared/pobBuild.js";
import { resistanceTargetFor } from "../../shared/quickReview.js";
import type { AdviceLang, GemAttribute, GemSkill } from "../../shared/supportGemAdvice.js";
import { findSkillAnyLang, localizeSkill } from "../advice/gemLocale.js";
import { ascendanciesOfClass } from "../registry/passiveRegistry.js";
import { isSkillChoiceQuestion, needsShield, weaponOf } from "./gameQuestions.js";
import { isSupportSocketQuestion, type GemKnowledge } from "./gemQuestion.js";

// ---------------------------------------------------------------------------
// Datos con fuente
// ---------------------------------------------------------------------------

/** Textos del juego tal como los publica poe2db (cliente en español e inglés), leídos el 24-11-2026. */
export const GAME_TEXTS = {
  fetchedAt: "2026-11-24",
  spirit: {
    source: "https://poe2db.tw/sp/Spirit",
    es: "El espíritu es una reserva de poder que se usa para activar y mantener habilidades que tienen efectos permanentes. Las habilidades que usan espíritu se gestionan en el panel de habilidades.",
    en: "Spirit is a reserve of power used to activate and maintain skills with permanent effects. Spirit-powered skills are managed within the Skills Panel.",
    weaponsEs: "armas con espíritu (como los cetros)",
    weaponsEn: "weapons with Spirit (such as Sceptres)",
  },
  jewellers: [
    {
      source: "https://poe2db.tw/sp/Lesser_Jewellers_Orb",
      sockets: 3,
      dropLevel: 25,
      nameEs: "Orbe de joyero menor",
      nameEn: "Lesser Jeweller's Orb",
      es: "Hace que una gema de habilidad tenga 3 engarces para gemas de asistencia",
      en: "Sets a Skill Gem to have 3 Support Gem Sockets",
    },
    {
      source: "https://poe2db.tw/sp/Greater_Jewellers_Orb",
      sockets: 4,
      dropLevel: 45,
      nameEs: "Orbe de joyero superior",
      nameEn: "Greater Jeweller's Orb",
      es: "Hace que una gema de habilidad tenga 4 engarces para gemas de asistencia",
      en: "Sets a Skill Gem to have 4 Support Gem Sockets",
    },
    {
      source: "https://poe2db.tw/sp/Perfect_Jewellers_Orb",
      sockets: 5,
      dropLevel: 65,
      nameEs: "Orbe de joyero perfecto",
      nameEn: "Perfect Jeweller's Orb",
      es: "Hace que una gema de habilidad tenga 5 engarces para gemas de asistencia",
      en: "Sets a Skill Gem to have 5 Support Gem Sockets",
    },
  ],
  jewellerUseEs:
    "Haz clic derecho en este objeto y luego clic izquierdo en una gema de habilidad para aplicarlo.",
  jewellerUseEn: "Right click this item then left click a Skill Gem to apply it.",
  exalted: {
    source: "https://poe2db.tw/sp/Exalted_Orb",
    es: "Mejora un objeto raro agregándole un nuevo modificador aleatorio",
    en: "Augments a Rare item with a new random modifier",
    limitEs: "Los objetos raros pueden tener hasta seis modificadores aleatorios.",
    limitEn: "Rare items can have up to six random modifiers.",
    maxModifiers: 6,
  },
} as const;

/** Lo que las guías por acto de la web dicen de las resistencias (src/guides/actOne.ts, «Resistencias»). */
export const GUIDE_RESISTANCES = {
  guideEs: "Acto 1: cómo no morir antes del acto 2",
  guideEn: "Act 1: how not to die before act 2",
  penalties: [
    { es: "acto 2", en: "act 2", value: "−10 %" },
    { es: "acto 3", en: "act 3", value: "−20 %" },
    { es: "acto 4", en: "act 4", value: "−30 %" },
    { es: "interludios", en: "interludes", value: "−40 % a −50 %" },
    { es: "mapas", en: "maps", value: "−60 %" },
  ],
  cap: 75,
} as const;

/** Lo que las guías dicen del espíritu y de la ascendencia (src/guides/actOne.ts, actTwo.ts, actThree.ts). */
export const GUIDE_REWARDS = {
  spirit: [
    { es: "El rey de las nieblas da +30 de espíritu para siempre.", en: "The King in the Mists gives +30 spirit for good.", actEs: "acto 1", actEn: "act 1" },
    {
      es: "Ignagduk, la Bruja del pantano, da +30 de espíritu para siempre.",
      en: "Ignagduk gives +30 spirit for good.",
      actEs: "acto 3, zona opcional",
      actEn: "act 3, optional zone",
    },
  ],
  ascendancy: {
    es: "Aquí consigues tu ascendencia. Si se te atraganta, vuelve con más nivel: no caduca.",
    en: "This is where you get your ascendancy. If it's too hard, come back with more levels: it doesn't expire.",
    trialEs: "Prueba de las sekhemas",
    trialEn: "Trial of the Sekhemas",
    chaosEs: "Prueba de Caos",
    chaosEn: "Trial of Chaos",
  },
} as const;

/** Nombres de ascendencia del cliente en español, con sus tildes (las claves de ASCENDANCY_FROM_SPANISH no las llevan). */
const ASCENDANCY_SPANISH_DISPLAY: Record<string, string> = {
  infernalista: "Infernalista",
  "maga de sangre": "Maga de sangre",
  liche: "Liche",
  "liche abisal": "Liche abisal",
  titan: "Titán",
  "adalid de guerra": "Adalid de guerra",
  "herrero de kitava": "Herrero de Kitava",
  estratega: "Estratega",
  "cazador de brujas": "Cazador de brujas",
  "legionario gemita": "Legionario gemita",
  tejetormentas: "Tejetormentas",
  cronomante: "Cronomante",
  "discipula de varashta": "Discípula de Varashta",
  amazona: "Amazona",
  "caminante espiritual": "Caminante espiritual",
  ritualista: "Ritualista",
  tiradora: "Tiradora",
  rastreadora: "Rastreadora",
  "artista marcial": "Artista marcial",
  invocador: "Invocador",
  "acolito de chayula": "Acólito de Chayula",
  oraculo: "Oráculo",
  chaman: "Chamán",
};

function ascendancyInSpanish(english: string): string {
  const key = Object.keys(ASCENDANCY_SPANISH_DISPLAY).find((spanish) => ASCENDANCY_FROM_SPANISH[spanish] === english);
  return key ? ASCENDANCY_SPANISH_DISPLAY[key]! : english;
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

const ATTRIBUTE: Record<AdviceLang, Record<GemAttribute, string>> = {
  es: { Fue: "fuerza", Des: "destreza", Int: "inteligencia" },
  en: { Fue: "Strength", Des: "Dexterity", Int: "Intelligence" },
};
const ATTRIBUTE_KEY: Record<GemAttribute, "str" | "dex" | "int"> = { Fue: "str", Des: "dex", Int: "int" };
const ATTRIBUTE_ORDER: readonly GemAttribute[] = ["Fue", "Des", "Int"];
const GEM_COLOUR: Record<AdviceLang, Record<GemAttribute, string>> = {
  es: { Fue: "roja", Des: "verde", Int: "azul" },
  en: { Fue: "red", Des: "green", Int: "blue" },
};

const join = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join("\n\n");

function ownSkills(gems: GemKnowledge | null, profile: CharacterProfile | null): GemSkill[] {
  if (!gems) return [];
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

// ---------------------------------------------------------------------------
// «¿Me cambio el arma única por una varita amarilla?»
// ---------------------------------------------------------------------------

export const SLOT_WORDS: ReadonlyArray<{ slots: readonly string[]; asks: RegExp; es: string; en: string }> = [
  {
    slots: ["weapon"],
    asks: /\b(armas?|arcos?|varitas?|mazos?|mazas?|baston(es)?|cetros?|espadas?|hachas?|dagas?|lanzas?|ballestas?|weapons?|bows?|wands?|maces?|staffs?|staves|sceptres?|scepters?|swords?|axes?|daggers?|spears?|crossbows?)\b/,
    es: "de arma",
    en: "as your weapon",
  },
  { slots: ["offhand"], asks: /\b(escudos?|carcaj|focos?|shields?|quivers?)\b/, es: "en la mano secundaria", en: "in your off hand" },
  { slots: ["helmet"], asks: /\b(cascos?|yelmos?|helmets?|helms?)\b/, es: "de casco", en: "as your helmet" },
  { slots: ["body"], asks: /\b(pecho|pechera|armaduras?|petos?|chest|armou?rs?)\b/, es: "de armadura", en: "as your body armour" },
  { slots: ["gloves"], asks: /\b(guantes|gloves)\b/, es: "de guantes", en: "as your gloves" },
  { slots: ["boots"], asks: /\b(botas|boots)\b/, es: "de botas", en: "as your boots" },
  { slots: ["belt"], asks: /\b(cinturon(es)?|belts?)\b/, es: "de cinturón", en: "as your belt" },
  { slots: ["amulet"], asks: /\b(amuletos?|amulets?)\b/, es: "de amuleto", en: "as your amulet" },
  { slots: ["ring1", "ring2"], asks: /\b(anillos?|rings?)\b/, es: "de anillo", en: "as your ring" },
];

const RARITY: Record<AdviceLang, Record<string, string>> = {
  es: { unique: "única", rare: "rara (amarilla)", magic: "mágica (azul)", normal: "normal (blanca)" },
  en: { unique: "unique", rare: "rare (yellow)", magic: "magic (blue)", normal: "normal (white)" },
};

export function answerItemCompareQuestion(question: string, profile: CharacterProfile | null, lang: AdviceLang): string | null {
  if (!isItemSwapQuestion(question)) return null;
  const en = lang === "en";
  const q = normalizeQuestion(question);

  const where = en
    ? "That is decided by comparing the two items, and the site does it: Guides → open your act → “Gems and items” → “Which of these two is better?”. Copy each item in the game with Ctrl+C and paste it in its box: it tells you which one to keep and why."
    : "Eso se decide comparando las dos piezas, y la web lo hace: Guías → abre tu acto → «Gemas y piezas» → «¿Cuál de estas dos es mejor?». Copia cada pieza en el juego con Ctrl+C y pégala en su casilla: te dice cuál conviene y por qué.";

  // La pieza de la que habla, si la web la conoce.
  const asked = SLOT_WORDS.find((entry) => entry.asks.test(q)) ?? null;
  const worn = asked ? (profile?.items ?? []).filter((item) => asked.slots.includes(item.slot)) : [];
  const wearing =
    asked && worn.length > 0
      ? `${en ? `Right now you wear ${asked.en}:` : `Ahora llevas ${asked.es}:`} ${worn
          .map((item) => {
            const rarity = RARITY[lang][item.rarity];
            const details = [
              item.baseType && item.baseType !== item.name ? item.baseType : "",
              rarity ?? "",
              typeof item.itemLevel === "number" ? (en ? `item level ${item.itemLevel}` : `nivel de objeto ${item.itemLevel}`) : "",
            ].filter(Boolean);
            return en ? `“${item.name}”${details.length > 0 ? ` (${details.join(", ")})` : ""}` : `«${item.name}»${details.length > 0 ? ` (${details.join(", ")})` : ""}`;
          })
          .join(en ? " and " : " y ")}.`
      : asked && profile && profile.items.length > 0
        ? en
          ? `I don't have the one you wear ${asked.en}: you'll need to copy both from the game.`
          : `La que llevas ${asked.es} no la tengo: copia las dos del juego.`
        : "";

  const rarityNote = /\b(unic[oa]s?|amarill[oa]s?|rar[oa]s?|uniques?|rares?|yellow)\b/.test(q)
    ? en
      ? "Being unique or yellow doesn't settle it: the comparison looks at what each item says, line by line."
      : "Que sea única o amarilla no decide: la comparación mira lo que pone en cada una, línea a línea."
    : "";

  const limit = en
    ? "Its limit: it compares only what is written on the two items. It doesn't work out a weapon's damage per second, and it doesn't look at your passive tree or your gems."
    : "Su límite: compara solo lo que pone en las dos piezas. No calcula el daño por segundo de un arma, ni mira tu árbol de pasivas ni tus gemas.";

  return join([where, wearing, rarityNote, limit]);
}

// ---------------------------------------------------------------------------
// «¿Cuánta resistencia necesito?»
// ---------------------------------------------------------------------------

export function isResistanceAmountQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (!/\bresistencias?\b|\bresis\b|\bresistances?\b|\bres\b/.test(q)) return false;
  return (
    /\b(cuanta|cuantas|cuanto|necesito|necesitan|hace falta|hacen falta|tope|maximo|maxima|limite|suficiente|bastan?|deberia tener|tengo que tener|a cuanto)\b/.test(q) ||
    /\b(how much|how many|need|cap|max|enough|should i have)\b/.test(q)
  );
}

export function answerResistanceQuestion(question: string, profile: CharacterProfile | null, lang: AdviceLang): string | null {
  if (!isResistanceAmountQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";
  const target = resistanceTargetFor(1);
  const inMaps = resistanceTargetFor("maps");
  const cap = GUIDE_RESISTANCES.cap;

  const goal = en
    ? `Aim for ${target}% in fire, cold and lightning while you level. That is the reference used by community guides, not an official figure. In maps, aim for ${inMaps}%. The normal cap is ${cap}%: above that it does nothing.`
    : `Apunta a un ${target} % en fuego, hielo y rayo mientras subes de nivel. Es la referencia de las guías de la comunidad, no una cifra oficial. En mapas, a un ${inMaps} %. El tope normal es un ${cap} %: por encima no sirve.`;

  const penalties = en
    ? `Each act takes more away: ${GUIDE_RESISTANCES.penalties.map((entry) => `${entry.en} ${entry.value.replace(" a ", " to ").replace(/ %/g, "%")}`).join(", ")}. What is enough today falls short in the next act.`
    : `Cada acto te quita más: ${GUIDE_RESISTANCES.penalties.map((entry) => `${entry.es} ${entry.value}`).join(", ")}. Lo que hoy te basta se queda corto en el acto siguiente.`;

  const have = profile?.resistances ?? null;
  const elements = [
    { key: "fire" as const, es: "fuego", en: "fire" },
    { key: "cold" as const, es: "hielo", en: "cold" },
    { key: "lightning" as const, es: "rayo", en: "lightning" },
  ];
  const known = have !== null && elements.some((element) => typeof have[element.key] === "number");
  let mine = "";
  if (known) {
    const shown = elements
      .map((element) => `${en ? element.en : element.es} ${typeof have![element.key] === "number" ? `${have![element.key]}${en ? "%" : " %"}` : "?"}`)
      .join(", ");
    const low = elements.filter((element) => typeof have![element.key] === "number" && (have![element.key] as number) < target);
    const verdict =
      low.length === 0
        ? en
          ? `None is below ${target}%.`
          : `Ninguna está por debajo del ${target} %.`
        : en
          ? `Below ${target}%: ${low.map((element) => element.en).join(", ")}.`
          : `Por debajo del ${target} %: ${low.map((element) => element.es).join(", ")}.`;
    mine = `${en ? "Your character has:" : "Tu personaje tiene:"} ${shown}. ${verdict}`;
  } else {
    mine = en
      ? "I don't know your resistances: they are on your character sheet in the game. Add them to your character and I'll tell you which one is short."
      : "No sé tus resistencias: están en la hoja de tu personaje, en el juego. Ponlas en tu personaje y te digo cuál te falta.";
  }

  const source = en
    ? `This is in Guides → “${GUIDE_RESISTANCES.guideEn}” → “Resistances”. It comes from the site's guides, no AI.`
    : `Está en Guías → «${GUIDE_RESISTANCES.guideEs}» → «Resistencias». Sale de las guías de la web, sin IA.`;

  return join([goal, penalties, mine, source]);
}

// ---------------------------------------------------------------------------
// «No puedo ponerme una gema, me sale en rojo»
// ---------------------------------------------------------------------------

export function isRedRequirementQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  const thing = /\b(gemas?|habilidad(es)?|asistencias?|piezas?|objetos?|armas?|requisitos?|gems?|skills?|items?|weapons?|requirements?)\b/.test(q);
  const red = /\ben rojo\b|\broj[oa]s?\b|\bin red\b|\bred\b/.test(q);
  const cannot =
    /\bno (me )?(puedo|deja|dejan|permite) (ponerme|poner|ponerla|ponerlo|equipar|equiparme|equiparla|equiparlo|usar|usarla|usarlo|engarzar|tallar)\b/.test(q) ||
    /\b(can t|cant|cannot|unable to) (equip|use|socket|wear)\b/.test(q);
  // «gema roja» a secas pregunta por un color, no por un requisito: hace falta «en rojo» o «no puedo».
  return thing && ((red && /\b(sale|salen|aparece|aparecen|pone|esta|estan|marca|marcan|shows?|is|are|turns?)\b/.test(q)) || cannot);
}

export function answerRedRequirementQuestion(
  gems: GemKnowledge | null,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  const q = normalizeQuestion(question);
  if (!isRedRequirementQuestion(q)) return null;
  const en = lang === "en";

  const meaning = en
    ? "A gem or an item shows in red when you don't meet something it asks for: a level or an attribute. Look at which line is red on it: that is what you're missing."
    : "Una gema o una pieza sale en rojo cuando no cumples algo de lo que pide: un nivel o un atributo. Mira qué línea está en rojo en ella: eso es lo que te falta.";
  const colours = en
    ? "Each gem asks for the attribute of its colour: red, Strength; green, Dexterity; blue, Intelligence."
    : "Cada gema pide el atributo de su color: roja, fuerza; verde, destreza; azul, inteligencia.";

  // Si nombra la gema, se dice de qué atributo es.
  let named = "";
  if (gems) {
    const padded = ` ${q} `;
    let found: { name: string; attribute: GemAttribute } | null = null;
    let length = 0;
    for (const gem of [...gems.data.skills, ...gems.data.supports]) {
      if (!gem.attribute) continue;
      const normalized = normalizeQuestion(gem.name);
      if (normalized.length >= 5 && normalized.length > length && padded.includes(` ${normalized} `)) {
        found = { name: gem.name, attribute: gem.attribute };
        length = normalized.length;
      }
    }
    if (found) {
      named = en
        ? `${found.name} is a ${GEM_COLOUR.en[found.attribute]} gem: it asks for ${ATTRIBUTE.en[found.attribute]}.`
        : `${found.name} es una gema ${GEM_COLOUR.es[found.attribute]}: pide ${ATTRIBUTE.es[found.attribute]}.`;
    }
  }

  const have = profile?.attributes ?? null;
  const known = have !== null && ATTRIBUTE_ORDER.some((attribute) => typeof have[ATTRIBUTE_KEY[attribute]] === "number");
  let mine = "";
  if (known) {
    const values = ATTRIBUTE_ORDER.flatMap((attribute) => {
      const value = have![ATTRIBUTE_KEY[attribute]];
      return typeof value === "number" ? [{ attribute, value }] : [];
    });
    const lowest = [...values].sort((a, b) => a.value - b.value)[0]!;
    const shown = ATTRIBUTE_ORDER.map((attribute) => `${ATTRIBUTE[lang][attribute]} ${have![ATTRIBUTE_KEY[attribute]] ?? "?"}`).join(" · ");
    mine = en
      ? `You have ${shown}. Your lowest is ${ATTRIBUTE.en[lowest.attribute]}: ${GEM_COLOUR.en[lowest.attribute]} gems are the ones that will turn red first.`
      : `Tienes ${shown}. Tu atributo más bajo es ${ATTRIBUTE.es[lowest.attribute]}: las gemas ${GEM_COLOUR.es[lowest.attribute]}s son las que antes te saldrán en rojo.`;
  }

  // Piezas que piden más de lo que tiene.
  const unmet: string[] = [];
  if (known) {
    for (const item of profile?.items ?? []) {
      for (const attribute of ATTRIBUTE_ORDER) {
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
      const needsLevel = item.requirements?.level;
      if (typeof needsLevel === "number" && profile && profile.level > 0 && needsLevel > profile.level) {
        unmet.push(en ? `${item.name} needs level ${needsLevel} (you are ${profile.level})` : `${item.name} pide nivel ${needsLevel} (eres ${profile.level})`);
      }
    }
  }
  const unmetLine = unmet.length > 0 ? `${en ? "Of your items, you don't meet:" : "De tus piezas, no cumples:"} ${unmet.slice(0, 3).join("; ")}.` : "";

  const gap = en
    ? "How much each gem asks for at each level isn't in my data: the gem itself says it. To raise an attribute: attribute nodes on the passive tree, or an item that gives it."
    : "Cuánto pide cada gema a cada nivel no lo tengo en mis datos: lo pone la propia gema. Para subir un atributo: nodos de atributo del árbol de pasivas, o una pieza que lo dé.";
  const source = en ? "This comes from your character and the game's gem data, no AI." : "Sale de tu personaje y de los datos de gemas del juego, sin IA.";

  return join([meaning, colours, named, mine, unmetLine, gap, source]);
}

// ---------------------------------------------------------------------------
// «¿Cómo consigo más huecos para gemas de asistencia?»
// ---------------------------------------------------------------------------

export function answerSupportSocketQuestion(question: string, profile: CharacterProfile | null, lang: AdviceLang): string | null {
  if (!isSupportSocketQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";
  const orbs = GAME_TEXTS.jewellers;

  const intro = en
    ? "Support gem sockets are added to each skill gem with jeweller's orbs. What each one says in the game:"
    : "Los huecos (engarces) de asistencia se añaden a cada gema de habilidad con orbes de joyero. Lo que dice cada uno en el juego:";
  const lines = orbs.map((orb) => (en ? `• ${orb.nameEn}: “${orb.en}”.` : `• ${orb.nameEs}: «${orb.es}».`)).join("\n");
  const use = en
    ? `How to use it: “${GAME_TEXTS.jewellerUseEn}” It only works on a gem that has fewer sockets than the orb gives. It goes gem by gem: one orb, one skill.`
    : `Cómo se usa: «${GAME_TEXTS.jewellerUseEs}» Solo vale en una gema que tenga menos engarces de los que da el orbe. Va gema a gema: un orbe, una habilidad.`;

  const level = profile && profile.level > 0 ? profile.level : null;
  const dropLevels = orbs.map((orb) => orb.dropLevel);
  const drop = en
    ? `poe2db lists them with drop level ${dropLevels.join(", ")}, in that order.`
    : `poe2db les pone nivel de caída ${dropLevels.join(", ")}, por ese orden.`;
  const reachable = level === null ? [] : orbs.filter((orb) => level >= orb.dropLevel);
  const mine =
    level === null
      ? ""
      : reachable.length === 0
        ? en
          ? `You are level ${level}: it's normal not to have any yet.`
          : `Eres nivel ${level}: es normal que aún no tengas ninguno.`
        : en
          ? `You are level ${level}: the ${reachable[reachable.length - 1]!.nameEn} can already drop for you.`
          : `Eres nivel ${level}: ya puede caerte el ${reachable[reachable.length - 1]!.nameEs.toLowerCase()}.`;

  const gap = en
    ? "Where exactly each one drops, and how many sockets a gem starts with, isn't in my data."
    : "En qué zona cae cada uno, y con cuántos engarces empieza una gema, no lo tengo en mis datos.";
  const source = en
    ? `These are the game's own texts as published by poe2db (read on ${GAME_TEXTS.fetchedAt}), no AI.`
    : `Son los textos del propio juego, tal como los publica poe2db (leídos el ${GAME_TEXTS.fetchedAt}), sin IA.`;

  return join([`${intro}\n${lines}`, use, [drop, mine].filter(Boolean).join(" "), gap, source]);
}

// ---------------------------------------------------------------------------
// «¿Qué es el espíritu y para qué sirve?»
// ---------------------------------------------------------------------------

export function isSpiritQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (!/\bespiritu\b|\bspirit\b/.test(q)) return false;
  // «Tengo una gema de espíritu sin tallar, ¿cuál cojo?» es elegir habilidad.
  if (isSkillChoiceQuestion(normalizedQuestion)) return false;
  return (
    /\b(que es|para que|como (consigo|subo|gano|se consigue|funciona|se sube)|mas espiritu|me falta|no tengo|cuanto|donde)\b/.test(q) ||
    /\b(what is|whats|what s|what does|how (do|does|can)|more spirit|not enough|where)\b/.test(q)
  );
}

export function answerSpiritQuestion(
  gems: GemKnowledge | null,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  if (!isSpiritQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";

  const definition = en ? `In the game's own words: “${GAME_TEXTS.spirit.en}”` : `Con las palabras del juego: «${GAME_TEXTS.spirit.es}»`;

  // Qué lo gasta, con los datos de gemas.
  let spends = "";
  let mine = "";
  if (gems) {
    const reserving = gems.data.skills.filter((skill) => skill.tags.includes("Persistente") && skill.reserve);
    const amounts = new Map<string, number>();
    for (const skill of reserving) amounts.set(skill.reserve!, (amounts.get(skill.reserve!) ?? 0) + 1);
    const usual = [...amounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (usual) {
      spends = en
        ? `What spends it: persistent skills (heralds, auras, permanent minions). While one is on, it reserves part of your Spirit. Of the ${reserving.length} in the game data, ${usual[1]} reserve ${usual[0].replace("Espíritu", "Spirit")}.`
        : `Lo gastan las habilidades persistentes (heraldos, auras, esbirros permanentes): mientras una está activa, reserva una parte. De las ${reserving.length} que hay en los datos del juego, ${usual[1]} reservan ${usual[0].toLowerCase()}.`;
    }
    const own = ownSkills(gems, profile).filter((skill) => skill.tags.includes("Persistente"));
    if (profile && profile.skills.length > 0) {
      mine =
        own.length > 0
          ? `${en ? "You carry:" : "Tú llevas:"} ${own
              .map((skill) => {
                const name = localizeSkill(skill, lang, gems.locale).name;
                return skill.reserve
                  ? `${name} (${en ? `reserves ${skill.reserve.replace("Espíritu", "Spirit")}` : `reserva ${skill.reserve.toLowerCase()}`})`
                  : name;
              })
              .join(", ")}.`
          : en
            ? "None of your skills reserves Spirit right now."
            : "Ninguna de tus habilidades reserva espíritu ahora mismo.";
    }
  }

  const rewards = GUIDE_REWARDS.spirit
    .map((reward) => (en ? `${reward.en} (${reward.actEn})` : `${reward.es.replace(/\.$/, "")} (${reward.actEs}).`))
    .join(en ? "; " : " ");
  const how = en
    ? `How you get it, from the site's act guides: ${rewards}. The game's text also mentions ${GAME_TEXTS.spirit.weaponsEn}.`
    : `Cómo se consigue, según las guías por acto de la web: ${rewards} El texto del juego nombra además las ${GAME_TEXTS.spirit.weaponsEs}.`;

  const source = en
    ? "This comes from the game's own text (poe2db), the gem data and the site's guides, no AI."
    : "Sale del texto del propio juego (poe2db), de los datos de gemas y de las guías de la web, sin IA.";

  return join([definition, spends, mine, how, source]);
}

// ---------------------------------------------------------------------------
// «¿Qué ascendencia me cojo?»
// ---------------------------------------------------------------------------

export function isAscendancyQuestion(normalizedQuestion: string): boolean {
  return /\bascendencias?\b|\bascendanc(y|ies)\b|\bascender\b|\bascend\b/.test(` ${normalizedQuestion} `);
}

/** Etiquetas de habilidad que dicen a qué se dedica un personaje, y cómo las nombra el árbol oficial (en inglés). */
const TAG_KEYWORDS: ReadonlyArray<{ tag: string; keyword: RegExp; es: string; en: string }> = [
  { tag: "Embate", keyword: /\bslams?\b/, es: "embates", en: "slams" },
  { tag: "Grito de guerra", keyword: /\bwarcr(y|ies)\b/, es: "gritos de guerra", en: "warcries" },
  { tag: "Tótem", keyword: /\btotems?\b/, es: "tótems", en: "totems" },
  { tag: "Proyectil", keyword: /\bprojectiles?\b/, es: "proyectiles", en: "projectiles" },
  { tag: "Esbirro", keyword: /\bminions?\b/, es: "esbirros", en: "minions" },
  { tag: "Maldición", keyword: /\bcurses?\b/, es: "maldiciones", en: "curses" },
  { tag: "Señal", keyword: /\bmarks?\b/, es: "señales", en: "marks" },
  { tag: "Granada", keyword: /\bgrenades?\b/, es: "granadas", en: "grenades" },
  { tag: "Heraldo", keyword: /\bheralds?\b/, es: "heraldos", en: "heralds" },
  { tag: "Fuego", keyword: /\bfire\b|\bignite/, es: "fuego", en: "fire" },
  { tag: "Hielo", keyword: /\bcold\b|\bfreez|\bchill/, es: "hielo", en: "cold" },
  { tag: "Rayo", keyword: /\blightning\b|\bshock/, es: "rayo", en: "lightning" },
  { tag: "Caos", keyword: /\bchaos\b|\bpoison/, es: "caos", en: "chaos" },
];

export function answerAscendancyQuestion(
  gems: GemKnowledge | null,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  if (!isAscendancyQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";
  const trial = GUIDE_REWARDS.ascendancy;

  const how = en
    ? `You get it in the ${trial.trialEn} (act 2). From the site's guide: “${trial.en}” The ${trial.chaosEn} (act 3) gives ascendancy points 3 and 4.`
    : `Se consigue en la ${trial.trialEs} (acto 2). De la guía de la web: «${trial.es}» La ${trial.chaosEs} (acto 3) da los puntos de ascendencia 3 y 4.`;

  const className = exportClassName(profile?.characterClass ?? null);
  let options: Array<{ name: string; nodeStats: string[] }> = [];
  try {
    options = className ? ascendanciesOfClass(className) : [];
  } catch {
    options = [];
  }
  const shownName = (name: string) => (en ? name : ascendancyInSpanish(name));

  if (options.length === 0) {
    const unknown = en
      ? "I don't know your class, so I can't list your ascendancies: set it in “Edit character”."
      : "No sé tu clase, así que no puedo decirte qué ascendencias tienes: ponla en «Editar personaje».";
    return join([unknown, how]);
  }

  const already = profile?.ascendancy
    ? en
      ? `You already have one: ${profile.ascendancy}. I have no data on changing it for another.`
      : `Ya llevas una: ${profile.ascendancy}. De cambiarla por otra no tengo datos.`
    : "";
  const list = en
    ? `As a ${profile!.characterClass} you choose between: ${options.map((option) => option.name).join(", ")}.`
    : `Como ${profile!.characterClass} eliges entre: ${options.map((option) => shownName(option.name)).join(", ")}.`;

  // Qué ascendencia nombra más lo que ya usa: se cuenta en los nodos oficiales.
  const own = ownSkills(gems, profile);
  // Cuántas de sus habilidades llevan cada etiqueta: tres embates pesan más que un grito con fuego.
  const carried = (tag: string) => own.filter((skill) => skill.tags.includes(tag)).length;
  const wanted = TAG_KEYWORDS.filter((entry) => carried(entry.tag) > 0);
  const counted = options
    .map((option) => {
      const hits = wanted
        .map((entry) => ({
          entry,
          skills: carried(entry.tag),
          count: option.nodeStats.filter((stats) => entry.keyword.test(stats.toLowerCase().replace(/\[[^\]|]*\|/g, "[").replace(/[[\]]/g, ""))).length,
        }))
        .filter((hit) => hit.count > 0)
        .sort((a, b) => b.count * b.skills - a.count * a.skills);
      return { option, hits, total: hits.reduce((sum, hit) => sum + hit.count * hit.skills, 0) };
    })
    .sort((a, b) => b.total - a.total);
  const ofYours = (skills: number) =>
    en ? `${skills} of your ${own.length} skills` : `${skills} de tus ${own.length} habilidades`;
  const fit =
    wanted.length > 0 && counted.some((entry) => entry.total > 0)
      ? `${en ? "By what you use now, counting the official nodes of each one:" : "Por lo que usas ahora, contando los nodos oficiales de cada una:"}\n${counted
          .map((entry) =>
            entry.hits.length > 0
              ? `• ${shownName(entry.option.name)}: ${entry.hits
                  .slice(0, 3)
                  .map((hit) =>
                    en
                      ? `${hit.count} nodes mention ${hit.entry.en} (${ofYours(hit.skills)})`
                      : `${hit.count} nodos hablan de ${hit.entry.es} (${ofYours(hit.skills)})`,
                  )
                  .join("; ")}.`
              : en
                ? `• ${entry.option.name}: none mentions what your skills do.`
                : `• ${shownName(entry.option.name)}: ninguno nombra lo que hacen tus habilidades.`,
          )
          .join("\n")}`
      : "";

  const limit = en
    ? "Which one is best I can't decide: I have no data to compare them. The count only says which one mentions most what you already use."
    : "Cuál es la mejor no lo decido yo: no tengo datos para compararlas. La cuenta solo dice cuál nombra más lo que ya usas.";
  const source = en
    ? "This comes from the official passive tree and the site's guides, no AI."
    : "Sale del árbol oficial de pasivas y de las guías de la web, sin IA.";

  return join([already, list, fit, how, limit, source]);
}

// ---------------------------------------------------------------------------
// «¿Para qué sirven los orbes exaltados? ¿Los gasto ya?»
// ---------------------------------------------------------------------------

export function isExaltedOrbQuestion(normalizedQuestion: string): boolean {
  return /\bexaltad[oa]s?\b|\bexalted\b|\bexalts?\b/.test(` ${normalizedQuestion} `);
}

export function answerExaltedOrbQuestion(question: string, profile: CharacterProfile | null, lang: AdviceLang): string | null {
  if (!isExaltedOrbQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";
  const orb = GAME_TEXTS.exalted;

  const what = en
    ? `Exalted Orb, in the game's own words: “${orb.en}”. And: “${orb.limitEn}”`
    : `Orbe exaltado, con las palabras del juego: «${orb.es}». Y: «${orb.limitEs}»`;
  const where = en
    ? `So it only works on a rare (yellow) item with fewer than ${orb.maxModifiers} modifiers. On a white, blue or unique item it does nothing.`
    : `O sea: solo sirve en una pieza rara (amarilla) con menos de ${orb.maxModifiers} modificadores. En una blanca, una azul o una única no hace nada.`;

  let mine = "";
  if (profile && profile.items.length > 0) {
    const rares = profile.items.filter((item) => item.rarity === "rare");
    const withRoom = rares
      .map((item) => ({ item, count: item.modifiers.filter((modifier) => modifier.kind === "explicit").length }))
      .filter((entry) => entry.count < orb.maxModifiers);
    mine =
      rares.length === 0
        ? en
          ? "I don't see any rare item on your character: right now you have nowhere to spend it."
          : "No veo ninguna pieza rara en tu personaje: ahora mismo no tienes dónde gastarlo."
        : withRoom.length === 0
          ? en
            ? "Your rare items already show six modifiers: there is no room on them."
            : "Tus piezas raras ya enseñan seis modificadores: no les cabe otro."
          : `${en ? "Rare items of yours with room:" : "Piezas raras tuyas con sitio:"} ${withRoom
              .slice(0, 4)
              .map((entry) => (en ? `${entry.item.name} (${entry.count} modifiers)` : `${entry.item.name} (${entry.count} modificadores)`))
              .join(", ")}.`;
  }

  const spend = en
    ? "Spend it now? With data I can only say where it fits: a rare item with room that you'll keep wearing. The modifier is random, and it leaves with the item when you replace it. What it's worth in trade I can't tell you: I have no prices here."
    : "¿Gastarlo ya? Con datos solo sé decirte dónde cabe: en una rara con sitio que vayas a seguir llevando. El modificador sale al azar, y se va con la pieza cuando la cambies. Cuánto vale para comerciar no te lo sé decir: aquí no tengo precios.";
  const source = en
    ? `The quotes are the game's own text as published by poe2db (read on ${GAME_TEXTS.fetchedAt}), no AI.`
    : `Las citas son el texto del propio juego, tal como lo publica poe2db (leído el ${GAME_TEXTS.fetchedAt}), sin IA.`;

  return join([what, where, mine, spend, source]);
}

// ---------------------------------------------------------------------------
// «¿Me conviene llevar escudo o un mazo a dos manos?»
// ---------------------------------------------------------------------------

export function isShieldOrTwoHandedQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  const shield = /\bescudos?\b|\bshields?\b/.test(q);
  const twoHanded = /\b(dos|2) manos\b|\btwo hand(ed)?\b|\b2h\b|\b2 hand(ed)?\b/.test(q);
  const choice = /\b(o|or|vs|conviene|mejor|better|deberia|should)\b/.test(q);
  return shield && (twoHanded || choice) && choice;
}

export function answerShieldQuestion(
  gems: GemKnowledge | null,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  if (!gems || !isShieldOrTwoHandedQuestion(normalizeQuestion(question))) return null;
  const en = lang === "en";
  const own = ownSkills(gems, profile);
  const name = (skill: GemSkill) => localizeSkill(skill, lang, gems.locale).name;

  const ownNeeding = own.filter(needsShield);
  const mine =
    own.length === 0
      ? en
        ? "I don't know your skills, so I can't tell whether any of them needs a shield."
        : "No sé qué habilidades llevas, así que no puedo decirte si alguna pide escudo."
      : ownNeeding.length > 0
        ? en
          ? `Of your skills, these use a shield: ${ownNeeding.map(name).join(", ")}. Without one they don't work.`
          : `De tus habilidades, usan escudo: ${ownNeeding.map(name).join(", ")}. Sin él no funcionan.`
        : en
          ? `None of your ${own.length} skills (${own.map(name).join(", ")}) uses a shield: you lose nothing of what you already have by going two-handed.`
          : `Ninguna de tus ${own.length} habilidades (${own.map(name).join(", ")}) usa escudo: con un arma a dos manos no pierdes nada de lo que ya llevas.`;

  // Lo que un escudo le abriría: habilidades de sus mismas armas que hablan de «tu escudo».
  const ownWeapons = new Set(own.flatMap(weaponOf));
  const ownSlugs = new Set(own.map((skill) => skill.slug));
  const opened = gems.data.skills
    .filter(
      (skill) =>
        needsShield(skill) &&
        weaponOf(skill).length > 0 &&
        !ownSlugs.has(skill.slug) &&
        (ownWeapons.size === 0 || weaponOf(skill).some((group) => ownWeapons.has(group))),
    )
    .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0));
  const withShield =
    opened.length > 0
      ? en
        ? `With a shield you could also engrave: ${opened.map((skill) => `${name(skill)} (gem level ${skill.grade})`).join(", ")}. Their text talks about “your shield”.`
        : `Con escudo podrías tallar además: ${opened.map((skill) => `${name(skill)} (nivel de gema ${skill.grade})`).join(", ")}. Su texto habla de «tu escudo».`
      : "";

  const gap = en
    ? "What I can't tell you with data is how much damage you lose or how much tougher you get with a shield: I don't have those numbers. A two-handed weapon takes both hands, so it's one or the other."
    : "Lo que no sé decirte con datos es cuánto daño pierdes ni cuánto más aguantas con escudo: esas cifras no las tengo. Un arma a dos manos ocupa las dos manos: es una cosa o la otra.";
  const next = en
    ? "If the real problem is that you die, ask me “why do I die?” and I'll look at your gear."
    : "Si lo que te pasa es que mueres, pregúntame «¿por qué muero?» y miro tu equipo.";
  const source = en ? "This comes from the game's gem data, no AI." : "Sale de los datos de gemas del juego, sin IA.";

  return join([mine, withShield, gap, next, source]);
}

// ---------------------------------------------------------------------------
// Todas, por orden
// ---------------------------------------------------------------------------

/**
 * La primera regla de lo básico que reconozca la pregunta, o null. Comparar
 * dos piezas no está aquí: va antes que ninguna otra regla del Mentor.
 */
export function answerBasicsQuestion(
  gems: GemKnowledge | null,
  question: string,
  profile: CharacterProfile | null,
  lang: AdviceLang,
): string | null {
  return (
    answerSupportSocketQuestion(question, profile, lang) ??
    answerRedRequirementQuestion(gems, question, profile, lang) ??
    answerShieldQuestion(gems, question, profile, lang) ??
    answerResistanceQuestion(question, profile, lang) ??
    answerSpiritQuestion(gems, question, profile, lang) ??
    answerAscendancyQuestion(gems, question, profile, lang) ??
    answerExaltedOrbQuestion(question, profile, lang)
  );
}
