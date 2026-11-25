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
  blocks: z.array(z.object({ id: z.string(), title: z.string(), intro: z.string(), cards: z.array(z.string()), lines: z.array(z.string()) })),
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


/**
 * Las frases de una guía, por orden de utilidad, para que la IA elija cuáles
 * enseñar. Cada una se enseña tal cual: aquí solo se le pone delante de qué
 * parte de la guía es, para que se entienda suelta.
 */
export function guideLines(guide: GuideKnowledgeAct, lang: "es" | "en", routeFirst = false): string[] {
  const en = lang === "en";
  const bosses = block(guide, "jefes");
  const others = guide.blocks.filter((entry) => entry.id !== "jefes");
  const fight = [
    ...(guide.focusNote ? [en ? `Before the final boss: ${guide.focusNote}` : `Antes del jefe final: ${guide.focusNote}`] : []),
    ...(bosses ? [bosses.intro, ...bosses.cards] : []),
  ];
  const step = (entry: GuideKnowledgeAct["route"][number]) =>
    `${entry.zone}${entry.optional ? (en ? " (optional)" : " (opcional)") : ""}: ${entry.text}`;
  // Primero las zonas que dan algo para siempre: es por lo que se pregunta.
  const route = [
    ...guide.route.filter((entry) => entry.priority === "clave").map(step),
    ...guide.route.filter((entry) => entry.priority !== "clave").map(step),
  ];
  const rest = [
    ...(bosses ? bosses.lines : []),
    ...others.flatMap((entry) => [...entry.cards.map((card) => `${entry.title} · ${card}`), ...entry.lines]),
  ];
  return routeFirst ? [...guide.essentials, ...route, ...fight, ...rest] : [...fight, ...guide.essentials, ...rest, ...route];
}

const WHERE_ASK = /\b(donde|zonas?|where|zones?)\b/;

/**
 * ¿La charla va de zonas y recompensas más que de un jefe? Decide qué parte
 * de la guía ve primero la IA cuando no cabe entera.
 */
export function asksAboutRoute(question: string, earlierQuestions: readonly string[]): boolean {
  const q = normalizeQuestion(question);
  if (BOSS_ASK.test(q)) return false;
  return [q, ...earlierQuestions.map(normalizeQuestion)].some((text) => REWARD_ASK.test(text) || WHERE_ASK.test(text));
}
