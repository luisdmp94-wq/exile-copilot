/**
 * Las guías por acto como datos del Mentor (tarea 13 del plan, 25-11-2026).
 *
 * «¿Cómo mato al jefe del acto 3?» recibía «no lo sé» y la web tiene la guía.
 * Aquí se leen las guías (server/data/guideKnowledge.json, que sale de
 * src/guides con `npm run data:guides`) para dos cosas:
 *  - una respuesta por reglas con el texto de la guía, sin IA;
 *  - los datos que recibe la IA cuando redacta (jefes, zonas, recompensas).
 * Nada se añade a lo que dice la guía: cada frase es suya, tal cual.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalizeQuestion } from "../../shared/mentorIntent.js";

const GuideKnowledgeActSchema = z.object({
  act: z.number().int().min(1),
  slug: z.string(),
  label: z.string(),
  title: z.string(),
  draft: z.boolean(),
  checkedPatch: z.string(),
  essentials: z.array(z.string()),
  focusNote: z.string().nullable(),
  blocks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      intro: z.string(),
      cards: z.array(z.string()),
      lines: z.array(z.string()),
      /** Del bloque de jefes: las tarjetas y los consejos que son de la pelea contra el jefe final (tarea 15). */
      finalCards: z.array(z.string()).default([]),
      finalLines: z.array(z.string()).default([]),
    }),
  ),
  route: z.array(
    z.object({
      zone: z.string(),
      text: z.string(),
      optional: z.boolean(),
      priority: z.enum(["clave", "recomendable", "historia"]),
      reward: z.string().nullable(),
    }),
  ),
});
export type GuideKnowledgeAct = z.infer<typeof GuideKnowledgeActSchema>;

const GuideKnowledgeSchema = z.object({ es: z.array(GuideKnowledgeActSchema), en: z.array(GuideKnowledgeActSchema) });
export type GuideKnowledge = z.infer<typeof GuideKnowledgeSchema>;

export function loadGuideKnowledge(): GuideKnowledge {
  const raw = readFileSync(fileURLToPath(new URL("../data/guideKnowledge.json", import.meta.url)), "utf8");
  return GuideKnowledgeSchema.parse(JSON.parse(raw) as unknown);
}

/** Minúsculas y sin tildes, letra a letra: la posición de cada letra no cambia. */
export function foldText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\P{ASCII}/gu, (char) => {
      const base = char.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return base.length === 1 ? base : char;
    })
    .toLowerCase();
}

const allTexts = (guide: GuideKnowledgeAct): string[] => [
  guide.title,
  ...guide.essentials,
  ...(guide.focusNote ? [guide.focusNote] : []),
  ...guide.blocks.flatMap((block) => [block.title, block.intro, ...block.cards, ...block.lines]),
  ...guide.route.flatMap((step) => [step.zone, step.text, ...(step.reward ? [step.reward] : [])]),
];

const WORD_RE = /\p{L}[\p{L}'’-]*/gu;

/**
 * Nombres propios de las guías (jefes, zonas, objetos), sin tildes y en
 * minúscula: palabras que llevan mayúscula en mitad de una frase, o que abren
 * el nombre de una zona, y que las guías nunca escriben en minúscula. «Para» o
 * «Coge» abren frases en las guías y no son un nombre: no entran.
 */
export function guideProperWords(knowledge: GuideKnowledge): Set<string> {
  const proper = new Set<string>();
  const lowercase = new Set<string>();
  const guides = [...knowledge.es, ...knowledge.en];
  for (const guide of guides) {
    for (const text of allTexts(guide)) {
      for (const match of text.matchAll(WORD_RE)) {
        const word = match[0];
        if (!/^\p{Lu}/u.test(word)) {
          lowercase.add(foldText(word));
          continue;
        }
        const before = text.slice(0, match.index).trimEnd();
        const startsSentence = before.length === 0 || /[.!?:]$/.test(before);
        if (word.length >= 4 && !startsSentence) proper.add(foldText(word));
      }
    }
    for (const step of guide.route) {
      const first = WORD_RE.exec(step.zone)?.[0] ?? "";
      WORD_RE.lastIndex = 0;
      if (first.length >= 4 && /^\p{Lu}/u.test(first)) proper.add(foldText(first));
    }
  }
  for (const word of [...proper]) {
    if (lowercase.has(word) || NOT_A_NAME.has(word)) proper.delete(word);
  }
  return proper;
}

/**
 * Palabras con mayúscula que no sirven para saber de qué acto se habla: son
 * títulos o palabras corrientes («la Bruja del pantano», «Prueba de Caos»).
 */
const NOT_A_NAME = new Set(
  (
    "bruja caos prueba reina maestro guardian sumo sacerdote conde rey jefe guerra pantano remanente taumaturgo real " +
    "campamento ciudad templo taller santuario ruinas jungla camara camaras pasado corazon acto guia fuego rayo hielo " +
    "witch chaos trial queen master guardian high priest count king chief swamp remnant royal camp city temple " +
    "workshop sanctum ruins jungle chamber chambers past heart guide fire lightning cold forja forge sol mesa " +
    "abominacion abomination vibora viper quimera chimera habilidad espiritu skill spirit nivel level puntos points"
  ).split(" "),
);

/** Por acto, las palabras de sus nombres propios que no salen en ningún otro acto. */
function distinctiveWords(guides: readonly GuideKnowledgeAct[]): Map<number, Set<string>> {
  const lowercase = new Set<string>();
  const byAct = new Map<number, Set<string>>();
  for (const guide of guides) {
    const proper = new Set<string>();
    for (const text of allTexts(guide)) {
      for (const match of text.matchAll(WORD_RE)) {
        const word = match[0];
        if (word.length < 5) continue;
        if (/^\p{Lu}/u.test(word)) {
          // La primera palabra de una frase lleva mayúscula sin ser un nombre.
          const before = text.slice(0, match.index).trimEnd();
          const startsSentence = before.length === 0 || /[.!?:]$/.test(before);
          if (!startsSentence) proper.add(foldText(word));
        } else {
          lowercase.add(foldText(word));
        }
      }
    }
    byAct.set(guide.act, proper);
  }
  for (const [act, words] of byAct) {
    for (const word of [...words]) {
      const elsewhere = [...byAct].some(([other, set]) => other !== act && set.has(word));
      if (elsewhere || lowercase.has(word) || NOT_A_NAME.has(word)) words.delete(word);
    }
  }
  return byAct;
}

const distinctiveCache = new WeakMap<readonly GuideKnowledgeAct[], Map<number, Set<string>>>();
function distinctive(guides: readonly GuideKnowledgeAct[]): Map<number, Set<string>> {
  let cached = distinctiveCache.get(guides);
  if (!cached) {
    cached = distinctiveWords(guides);
    distinctiveCache.set(guides, cached);
  }
  return cached;
}

const ORDINALS: ReadonlyArray<[RegExp, number]> = [
  [/\b(primer|primero|first) (acto|act)\b/, 1],
  [/\b(segundo|second) (acto|act)\b/, 2],
  [/\b(tercer|tercero|third) (acto|act)\b/, 3],
  [/\b(cuarto|fourth) (acto|act)\b/, 4],
];

export interface GuideMatch {
  guide: GuideKnowledgeAct;
  /** Nombres propios de la guía que dice la pregunta («doryani»). */
  named: string[];
}

/** De qué acto habla la frase: por su número o por un nombre propio de su guía. */
export function guideInQuestion(knowledge: GuideKnowledge, question: string, lang: "es" | "en"): GuideMatch | null {
  const guides = lang === "en" ? knowledge.en : knowledge.es;
  const q = normalizeQuestion(question);
  const words = new Set(q.split(" "));
  const named = (guide: GuideKnowledgeAct): string[] =>
    [...(distinctive(guides).get(guide.act) ?? [])].filter((word) => words.has(word));

  const numbered = /\b(?:acto|act) ?(\d)\b/.exec(q);
  const act = numbered ? Number(numbered[1]) : (ORDINALS.find(([pattern]) => pattern.test(q))?.[1] ?? null);
  if (act !== null) {
    const guide = guides.find((entry) => entry.act === act);
    return guide ? { guide, named: named(guide) } : null;
  }
  let best: GuideMatch | null = null;
  for (const guide of guides) {
    const hits = named(guide);
    if (hits.length > (best?.named.length ?? 0)) best = { guide, named: hits };
  }
  return best;
}

const block = (guide: GuideKnowledgeAct, id: string) => guide.blocks.find((entry) => entry.id === id) ?? null;
const mentions = (text: string, names: readonly string[]): boolean => {
  const folded = foldText(text);
  return names.some((name) => folded.includes(name));
};

const BOSS_ASK = /\b(jefes?|boss(es)?|final|matar?|mato|matarlo|derrot\w+|venc\w+|pelea\w*|kill|beat|defeat|fight)\b/;
const REWARD_ASK = /\b(recompensas?|permanentes?|salt\w+|opcional(es)?|merece|rewards?|permanent|skip|optional|worth)\b/;

/**
 * Respuesta por reglas a una pregunta sobre un acto, con el texto de su guía.
 * null si la frase no nombra un acto ni un nombre propio de una guía.
 */
export function answerGuideQuestion(knowledge: GuideKnowledge, question: string, lang: "es" | "en"): string | null {
  const match = guideInQuestion(knowledge, question, lang);
  if (!match) return null;
  const { guide, named } = match;
  const en = lang === "en";
  const q = normalizeQuestion(question);
  const bullets = (lines: readonly string[]) => lines.map((line) => `• ${line}`).join("\n");
  const source = en
    ? `This is from the site's ${guide.label} guide${guide.draft ? " (still a draft)" : ""}: Guides → ${guide.label}.`
    : `Sale de la guía del ${guide.label} de la web${guide.draft ? " (aún en borrador)" : ""}: Guías → ${guide.label}.`;

  const bosses = block(guide, "jefes");
  const aboutNamed = named.length > 0;
  if (bosses && (BOSS_ASK.test(q) || aboutNamed)) {
    // Si nombra a un jefe o una zona, solo lo que la guía dice de ese nombre.
    const everything = [
      ...guide.essentials,
      ...guide.blocks.flatMap((entry) => [...entry.cards, ...entry.lines]),
      ...guide.route.map((step) => `${step.zone}: ${step.text}`),
    ];
    // Sin nombre, el jefe final: sus fases son las tarjetas del bloque.
    const lines = aboutNamed
      ? [...new Set(everything.filter((line) => mentions(line, named)))].slice(0, 5)
      : bosses.finalCards.length > 0
        ? bosses.finalCards
        : bosses.cards.length > 0
          ? bosses.cards
          : bosses.lines.slice(0, 4);
    // La nota es del jefe final: no se pega a una pregunta sobre otro nombre.
    const note = guide.focusNote && (!aboutNamed || mentions(guide.focusNote, named)) ? guide.focusNote : null;
    const before = note ? (en ? `Before you go in: ${note}` : `Antes de entrar: ${note}`) : "";
    return [aboutNamed ? "" : bosses.intro, bullets(lines), before, source].filter(Boolean).join("\n\n");
  }

  if (REWARD_ASK.test(q)) {
    const key = guide.route.filter((step) => step.priority === "clave");
    const intro = en ? `What not to skip in ${guide.label}:` : `Lo que no conviene saltarse en el ${guide.label}:`;
    return [intro, bullets(key.map((step) => `${step.zone}${step.reward ? ` (${step.reward})` : ""}: ${step.text}`)), source].join("\n\n");
  }

  const intro = en ? `The essentials of ${guide.label}:` : `Lo esencial del ${guide.label}:`;
  return [intro, bullets(guide.essentials), source].join("\n\n");
}


export interface GuideLine {
  /** De qué parte de la guía es: la IA elige por esto (tarea 14). */
  tema: string;
  texto: string;
  /**
   * Frases que contestan lo mismo (la pelea del jefe final): si se pide más de
   * eso, las ya dichas se quitan mientras queden otras del grupo (tarea 15).
   */
  grupo?: string;
}

/** Qué parte de la guía va primero cuando no cabe entera. */
export type GuideAsk = "fight" | "route" | "where";

export type GuideStep = GuideKnowledgeAct["route"][number];

/**
 * Las frases de una guía, por orden de utilidad, para que la IA elija cuáles
 * enseñar. Cada una se enseña tal cual; el tema dice de qué parte de la guía
 * es (la pelea del jefe final, otros jefes, dónde está cada cosa…).
 */
export function guideLines(
  guide: GuideKnowledgeAct,
  lang: "es" | "en",
  ask: GuideAsk = "fight",
  /** Zonas de lo que se acaba de nombrar (`stepsNamedIn`): van las primeras si pregunta dónde. */
  named: readonly GuideStep[] = [],
): GuideLine[] {
  const en = lang === "en";
  const of = en ? `(the site's guide for ${guide.label})` : `(guía de la web del ${guide.label})`;
  const tagged = (tema: string, lines: readonly string[], grupo?: string): GuideLine[] =>
    lines.map((texto) => ({ tema: `${tema} ${of}`, texto, ...(grupo ? { grupo } : {}) }));
  const bosses = block(guide, "jefes");
  const others = guide.blocks.filter((entry) => entry.id !== "jefes");
  // Sin marcas (unos datos antiguos), todas las tarjetas son del jefe final, como antes.
  const finalCards = bosses ? (bosses.finalCards.length > 0 ? bosses.finalCards : bosses.cards) : [];
  const finalLines = bosses ? bosses.finalLines : [];
  // El grupo son las fases y su detalle: lo que dice qué hacer en la pelea. La
  // presentación del jefe y la nota de resistencias no cuentan como «algo nuevo
  // que decir»: con solo eso por decir, las fases ya dichas no se quitan.
  const fightGroup = `pelea-final:${guide.act}`;
  const fightTopic = en ? "the final boss fight, phase by phase" : "la pelea contra el jefe final, fase a fase";
  const fight = [
    ...tagged(fightTopic, bosses ? [bosses.intro] : []),
    ...tagged(fightTopic, finalCards, fightGroup),
    ...tagged(fightTopic, guide.focusNote ? [en ? `Before the final boss: ${guide.focusNote}` : `Antes del jefe final: ${guide.focusNote}`] : []),
    // El detalle de esa misma pelea: lo que queda por decir cuando ya se han
    // dicho las fases. Antes iba mezclado con los otros jefes y no se elegía.
    ...tagged(en ? "more on the final boss fight, hit by hit" : "más de la pelea contra el jefe final, golpe a golpe", finalLines, fightGroup),
  ];
  const essentials = tagged(en ? "the essentials of the act" : "lo esencial del acto", guide.essentials);
  const step = (entry: GuideStep) => `${entry.zone}${entry.optional ? (en ? " (optional)" : " (opcional)") : ""}: ${entry.text}`;
  // Primero las zonas que dan algo para siempre: es por lo que se pregunta.
  const ordered = [
    ...guide.route.filter((entry) => entry.priority === "clave"),
    ...guide.route.filter((entry) => entry.priority !== "clave"),
  ];
  const whereTopic = en ? "where each thing is: zone and what you get there" : "dónde está cada cosa: zona y lo que hay en ella";
  // «¿Y eso dónde está?»: las zonas de lo que se acaba de nombrar, por orden de mención.
  const route = [
    ...tagged(en ? "where what the Mentor just named is: one zone per thing" : "dónde está lo que el Mentor acaba de nombrar: una zona por cosa", named.map(step)),
    ...tagged(whereTopic, ordered.filter((entry) => !named.includes(entry)).map(step)),
  ];
  const otherBosses = tagged(
    en ? "other tough bosses on the way (not the final boss)" : "otros jefes duros por el camino (no son el jefe final)",
    bosses ? [...bosses.cards.filter((card) => !finalCards.includes(card)), ...bosses.lines.filter((line) => !finalLines.includes(line))] : [],
  );
  const rest = others.flatMap((entry) => tagged(entry.title, [...entry.cards.map((card) => `${entry.title} · ${card}`), ...entry.lines]));
  return ask === "fight"
    ? [...fight, ...otherBosses, ...essentials, ...rest, ...route]
    : ask === "where"
      ? [...route, ...essentials, ...fight, ...otherBosses, ...rest]
      : [...essentials, ...route, ...fight, ...otherBosses, ...rest];
}

const lowercaseCache = new WeakMap<readonly GuideKnowledgeAct[], Set<string>>();
/** Palabras que las guías escriben alguna vez en minúscula: no son un nombre. */
function lowercaseWords(guides: readonly GuideKnowledgeAct[]): Set<string> {
  let cached = lowercaseCache.get(guides);
  if (!cached) {
    cached = new Set<string>();
    for (const guide of guides) {
      for (const text of allTexts(guide)) {
        for (const match of text.matchAll(WORD_RE)) {
          if (!/^\p{Lu}/u.test(match[0])) cached.add(foldText(match[0]));
        }
      }
    }
    lowercaseCache.set(guides, cached);
  }
  return cached;
}

/**
 * Las zonas de la ruta que tocan algo de lo que dice un texto, por orden de
 * mención. Se mira por los nombres que solo salen en esa zona («Ignagduk»,
 * «Aggorat»): un nombre que está en media guía no sitúa nada. El texto puede
 * venir del navegador: solo decide el orden de frases que ya son de la guía.
 */
export function stepsNamedIn(knowledge: GuideKnowledge, guide: GuideKnowledgeAct, lang: "es" | "en", text: string): GuideStep[] {
  const folded = foldText(text);
  if (folded.trim().length === 0) return [];
  const lowercase = lowercaseWords(lang === "en" ? knowledge.en : knowledge.es);
  const namesOf = (entry: GuideStep): string[] => {
    const names = new Set<string>();
    for (const match of `${entry.zone}. ${entry.text}`.matchAll(WORD_RE)) {
      const word = foldText(match[0]);
      if (word.length >= 5 && /^\p{Lu}/u.test(match[0]) && !NOT_A_NAME.has(word) && !lowercase.has(word)) names.add(word);
    }
    return [...names];
  };
  const byStep = guide.route.map((entry) => ({ entry, names: namesOf(entry) }));
  const hits: Array<{ entry: GuideStep; at: number }> = [];
  for (const { entry, names } of byStep) {
    const own = names.filter((name) => byStep.filter((other) => other.names.includes(name)).length === 1);
    const positions = own
      .map((name) => new RegExp(`(?<![\\p{L}])${name}(?![\\p{L}])`, "u").exec(folded)?.index ?? -1)
      .filter((at) => at >= 0);
    if (positions.length > 0) hits.push({ entry, at: Math.min(...positions) });
  }
  return hits.sort((a, b) => a.at - b.at).map((hit) => hit.entry);
}

const WHERE_ASK = /\b(donde|zonas?|where|zones?)\b/;
const FIGHT_ASK = /\b(pelea\w*|combate|lucha\w*|fases?|esquiv\w+|fight|phases?|dodge)\b/;

/**
 * Qué parte de la guía pide la frase. Decide qué ve primero la IA cuando la
 * guía no cabe entera, y si la respuesta de las reglas a la frase suelta
 * («lo siguiente que haría: rellenar huecos») se queda detrás de la guía.
 */
export function guideAsk(question: string, earlierQuestions: readonly string[]): GuideAsk {
  const q = normalizeQuestion(question);
  if (WHERE_ASK.test(q)) return "where";
  if (BOSS_ASK.test(q) || FIGHT_ASK.test(q)) return "fight";
  return asksAboutRoute(question, earlierQuestions) ? "route" : "fight";
}

/** ¿Pregunta por la pelea en sí (y no por equipo)? Con un jefe en la charla, manda la guía. */
export function asksAboutFight(question: string): boolean {
  return FIGHT_ASK.test(normalizeQuestion(question));
}

/**
 * ¿La charla va de zonas y recompensas más que de un jefe? Decide qué parte
 * de la guía ve primero la IA cuando no cabe entera.
 */
export function asksAboutRoute(question: string, earlierQuestions: readonly string[]): boolean {
  const q = normalizeQuestion(question);
  if (BOSS_ASK.test(q)) return false;
  return [q, ...earlierQuestions.map(normalizeQuestion)].some((text) => REWARD_ASK.test(text) || WHERE_ASK.test(text));
}
