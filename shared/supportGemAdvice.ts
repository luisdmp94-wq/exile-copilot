import { z } from "zod";

/**
 * «¿Qué gema de asistencia le pongo a esta habilidad?»
 *
 * Las reglas filtran y eligen con los datos del juego (etiquetas, grado,
 * atributo, lo que dice la propia descripción de la asistencia y la build del
 * jugador). La IA, si está activa, solo redacta el porqué de lo ya elegido:
 * no puede proponer ni cambiar ninguna gema.
 */

export const GemAttributeSchema = z.enum(["Fue", "Des", "Int"]);
export type GemAttribute = z.infer<typeof GemAttributeSchema>;

export const GemSkillSchema = z.object({
  slug: z.string(),
  name: z.string(),
  attribute: GemAttributeSchema,
  grade: z.number().int().nullable(),
  tags: z.array(z.string()),
  reserve: z.string().nullable(),
  description: z.string(),
  effects: z.array(z.string()),
});
export type GemSkill = z.infer<typeof GemSkillSchema>;

export const GemSupportSchema = GemSkillSchema.extend({
  category: z.string().nullable(),
  lineage: z.boolean(),
  costMultiplier: z.string().nullable(),
});
export type GemSupport = z.infer<typeof GemSupportSchema>;

export const GemDataSchema = z.object({
  source: z.string(),
  fetchedAt: z.string(),
  skills: z.array(GemSkillSchema),
  supports: z.array(GemSupportSchema),
});
export type GemData = z.infer<typeof GemDataSchema>;

/**
 * Lo que la web ya sabe de la build del jugador (Expediente): el arquetipo que
 * escribió y lo que marcó como core o descartado en «Identidad de la build».
 * Es texto del jugador: orienta el orden, nunca es una instrucción.
 */
export const BuildContextSchema = z.object({
  archetype: z.string().trim().max(200).optional(),
  characterClass: z.string().trim().max(60).optional(),
  ascendancy: z.string().trim().max(60).optional(),
  core: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  discarded: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});
export type BuildContext = z.infer<typeof BuildContextSchema>;

/** La build, traducida a lo que las reglas saben usar. */
export interface BuildTheme {
  /** Tipos de daño que nombra la build, como etiquetas del juego («Caos»). */
  elements: string[];
  /** La build se apoya en esbirros. */
  minions: boolean;
  /** Textos core y descartados, normalizados. */
  core: string[];
  discarded: string[];
}

const THEME_ELEMENTS: Array<[RegExp, string]> = [
  [/caos|chaos|veneno|poison/, "Caos"],
  [/fuego|fire|igni/, "Fuego"],
  [/hielo|frio|cold|escarcha|congel/, "Hielo"],
  [/rayo|lightning|electr/, "Rayo"],
  [/fisic|physical|sangrado|bleed/, "Físico"],
];

export function buildTheme(build: BuildContext | undefined | null): BuildTheme {
  const core = (build?.core ?? []).map(normalizeGemText);
  const text = normalizeGemText([build?.archetype ?? "", ...(build?.core ?? [])].join(" "));
  return {
    elements: THEME_ELEMENTS.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag),
    minions: /esbirro|invoca|minion|summon|esqueleto|skelet/.test(text),
    core,
    discarded: (build?.discarded ?? []).map(normalizeGemText),
  };
}

const NO_THEME: BuildTheme = { elements: [], minions: false, core: [], discarded: [] };

function mentions(labels: readonly string[], name: string): boolean {
  const wanted = normalizeGemText(name);
  return labels.some((label) => label.includes(wanted));
}

/** Cuánto sube una habilidad en el reparto por ser parte de la build. */
export function skillThemeBoost(skill: GemSkill, theme: BuildTheme): number {
  let boost = 0;
  if (mentions(theme.core, skill.name)) boost += 2;
  if (skill.tags.some((tag) => theme.elements.includes(tag))) boost += 2;
  if (theme.minions && skill.tags.includes("Esbirro")) boost += 1;
  return boost;
}

export interface SupportQuery {
  skill: GemSkill;
  /** Grado de la gema sin tallar: permite asistencias de ese grado o menor. */
  maxGrade: number;
  /** Atributos en los que al jugador le queda hueco de asistencia. */
  attributes: readonly GemAttribute[];
  /** Asistencias que esa habilidad ya lleva puestas. */
  socketed?: readonly string[];
  /** La build del jugador, si la web la conoce. */
  build?: BuildContext | null;
  /** Lo que el jugador cuenta que le pasa con la habilidad. */
  note?: string | null;
}

export interface SupportCandidate {
  support: GemSupport;
  /** Mayor = encaja mejor por etiquetas. Solo ordena; no es una medida de daño. */
  score: number;
}

/** Etiquetas que describen la asistencia pero no exigen nada a la habilidad. */
const SOFT_TAGS = new Set(["Duración", "Activación", "Compensación", "Condicional", "Linaje", "Sostenida", "Fases"]);
const ELEMENT_TAGS = new Set(["Físico", "Fuego", "Hielo", "Rayo", "Caos"]);

export function normalizeGemText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function isPersistentMinion(skill: GemSkill): boolean {
  return skill.tags.includes("Esbirro") && skill.tags.includes("Persistente");
}

function isPersistentBuff(skill: GemSkill): boolean {
  return skill.tags.includes("Efecto beneficioso") && skill.tags.includes("Persistente");
}

function skillText(skill: GemSkill): string {
  return normalizeGemText(`${skill.name} ${skill.description} ${skill.effects.join(" ")}`);
}

/** ¿La habilidad golpea ella misma? Un daño «de X a Y» es un impacto; «por segundo» no. */
function hitsEnemies(skill: GemSkill): boolean {
  if (skill.tags.includes("Ataque")) return true;
  return skill.effects.some((effect) => /inflige de .+ a .+ de dano/.test(normalizeGemText(effect)));
}

/** Familia de la asistencia: «Lanzamiento rápido I» y «II» comparten hueco. */
export function supportFamily(support: GemSupport): string {
  return support.category ?? support.name.replace(/\s+[IVX]+$/, "");
}

/**
 * Asistencias que solo sirven a un tipo concreto de habilidad. Si la primera
 * frase de la asistencia nombra ese tipo, la habilidad tiene que serlo (por
 * etiqueta) o hablar de ello en su propio texto.
 */
const KEYWORD_RULES: Array<[RegExp, (skill: GemSkill, text: string) => boolean]> = [
  [/habilidades de maldicion/, (skill) => skill.tags.includes("Maldición")],
  [/habilidades de viaje/, (skill) => skill.tags.includes("Viaje")],
  [/habilidades de canalizacion/, (skill) => skill.tags.includes("Canalización")],
  [/metahabilidades/, (skill) => skill.tags.includes("Metahabilidad")],
  [/gritos de guerra/, (skill) => skill.tags.includes("Grito de guerra")],
  [/habilidades de senales/, (skill) => skill.tags.includes("Señal")],
  [/repetibles/, (skill) => skill.tags.includes("Repetible")],
  [/habilidades de escudo/, (_skill, text) => text.includes("escudo")],
  [/cascadeables/, (_skill, text) => text.includes("cascad")],
  [/estandarte/, (_skill, text) => text.includes("estandarte")],
  [/(?:consumen|generan) cargas/, (_skill, text) => text.includes("carga")],
  [/potenciar otras habilidades/, (_skill, text) => text.includes("potencia")],
  [/rotura de armadura/, (_skill, text) => text.includes("armadura")],
  [/ralentizaciones/, (_skill, text) => /ralentiz|escalofri|congel/.test(text)],
  [/municion|ballesta/, (skill, text) => skill.tags.includes("Munición") || /municion|ballesta/.test(text)],
];

/** Lo que la propia descripción de la asistencia exige a la habilidad. */
function textRulesAllow(support: GemSupport, skill: GemSkill): boolean {
  const text = normalizeGemText(support.description);
  const first = text.split(".")[0] ?? text;
  const tags = skill.tags;

  if (/^asiste embates/.test(first) && !tags.includes("Embate")) return false;
  if (/^asiste hechizos/.test(first) && !tags.includes("Hechizo")) return false;
  if (/^asiste (?:ataques|golpes|habilidades de ataque|habilidades de golpe)/.test(first) && !tags.includes("Ataque")) return false;
  if (/que (?:usas|uses) tu mismo/.test(first) && isPersistentMinion(skill)) return false;
  if (/reserven espiritu/.test(text) && (skill.reserve !== null || tags.includes("Persistente"))) return false;
  if (/que tengan? una duracion/.test(first) && !tags.includes("Duración")) return false;
  if (/que tien(?:e|en) un limite/.test(first) && !/limite/.test(skillText(skill))) return false;
  if (/que tengan? enfriamiento/.test(first) && !/enfriamiento|tiempo de recarga/.test(skillText(skill))) return false;

  for (const [condition, allows] of KEYWORD_RULES) {
    if (condition.test(first) && !allows(skill, skillText(skill))) return false;
  }

  const dealsDamage = /que impact(?:e|an)|impactos daninos|infligir impactos|que inflij(?:a|an) dano|que infligen dano/.test(first);
  if (dealsDamage) {
    if (isPersistentBuff(skill)) return false;
    if (/impact/.test(first) && !isPersistentMinion(skill) && !hitsEnemies(skill)) return false;
  }

  // «Asiste habilidades que crean muros / fisuras / superficies…»: la habilidad
  // tiene que hablar de eso mismo. Lo que ya cubren las etiquetas se salta.
  const creates = /que (?:crean?|creen?) ([a-zñ]+)/.exec(first);
  if (creates) {
    const noun = creates[1];
    const coveredByTags = /^(?:esbirros|proyectiles|totems|remanentes)$/.test(noun);
    if (!coveredByTags && !skillText(skill).includes(noun.slice(0, 5))) return false;
  }
  return true;
}

function supportApplies(support: GemSupport, skill: GemSkill): boolean {
  if (support.lineage) return false;
  // Los esbirros que reviven solo aceptan con seguridad asistencias de esbirros.
  if (isPersistentMinion(skill) && !support.tags.includes("Esbirro")) return false;
  for (const tag of support.tags) {
    if (SOFT_TAGS.has(tag)) continue;
    if (!skill.tags.includes(tag)) return false;
  }
  return textRulesAllow(support, skill);
}

/** ¿El daño de la habilidad es sobre todo «por segundo»? (Contagio, Drenar esencia…) */
function dealsDamageOverTime(skill: GemSkill): boolean {
  return skill.effects.some((effect) => /de dano .*por segundo/.test(normalizeGemText(effect)));
}

/**
 * Orden orientativo de las candidatas. Sube lo que da daño de verdad («un 30%
 * más de daño») y lo que encaja con el tipo de daño de la habilidad; baja lo
 * que encarece. No mide daño: solo decide qué se enseña primero.
 */
/**
 * Problemas que el jugador suele contar y qué asistencias los arreglan. Si su
 * nota habla de uno, las asistencias que lo resuelven suben.
 */
const NOTE_NEEDS: Array<[RegExp, RegExp]> = [
  [/muer|aguant|sobreviv|caen|duran poco/, /sig(?:a|ue)n? peleando|menos de dano recibido|menos dano recibido|resistencias|vida maxima/],
  [/mana|cuesta|caro/, /menos de costo|regeneracion de mana/],
  [/poco dano|pega poco|no mata|mas dano|jefe/, /% mas de dano/],
  [/lento|tarda|velocidad/, /velocidad de lanzamiento|velocidad de ataque|velocidad de habilidad/],
  [/area|grupo|muchos enemigos|limpiar/, /area de efecto aumentada|proyectiles adicionales|se propaga/],
];

function noteBoost(text: string, note: string): number {
  return NOTE_NEEDS.some(([need, fix]) => need.test(note) && fix.test(text)) ? 4 : 0;
}

function scoreSupport(support: GemSupport, skill: GemSkill, theme: BuildTheme, note: string): number {
  const text = normalizeGemText(`${support.description} ${support.effects.join(" ")}`);
  let score = note ? noteBoost(text, note) : 0;
  for (const tag of support.tags) {
    if (SOFT_TAGS.has(tag) || !skill.tags.includes(tag)) continue;
    score += ELEMENT_TAGS.has(tag) ? 3 : 1;
  }
  if (/% mas de dano|mas dano/.test(text)) score += 2;
  if (dealsDamageOverTime(skill) && /degenerativo/.test(text)) score += 3;
  if (support.costMultiplier) score -= 1;
  // Una mejora que solo funciona a veces (hace falta un cadáver, el maná lleno,
  // estar quieto, que el enemigo tenga poca vida…) vale menos que una fija.
  if (/cadaver|a menos que|mientras tengas|mientras estes|si has |vida baja|vida llena/.test(text)) score -= 2;
  // Y una que quita daño a cambio de otra cosa, menos todavía.
  if (/% menos de dano/.test(text)) score -= 3;
  // Una que le pone un enfriamiento largo a la habilidad la deja casi sin uso.
  if (/enfriamiento de \d+ segundos/.test(text)) score -= 4;
  // Con una build declarada: lo que el jugador marcó como core sube, y una
  // asistencia de un tipo de daño que la build no usa (Brutalidad en un
  // personaje de caos) baja aunque técnicamente valga.
  if (mentions(theme.core, support.name)) score += 3;
  if (theme.elements.length > 0) {
    for (const tag of support.tags) {
      if (!ELEMENT_TAGS.has(tag)) continue;
      score += theme.elements.includes(tag) ? 1 : -3;
    }
  }
  return score;
}

/** Asistencias que las reglas dejan poner, ordenadas de más a menos afín. */
export function supportCandidates(data: GemData, query: SupportQuery): SupportCandidate[] {
  const socketed = new Set((query.socketed ?? []).map(normalizeGemText));
  // Un personaje importado trae los nombres en inglés: también se comparan con el identificador.
  const socketedFamilies = new Set(
    data.supports
      .filter(
        (support) =>
          socketed.has(normalizeGemText(support.name)) || socketed.has(normalizeGemText(support.slug.replace(/_/g, " "))),
      )
      .map(supportFamily),
  );
  const theme = query.build ? buildTheme(query.build) : NO_THEME;
  const best = new Map<string, GemSupport>();
  for (const support of data.supports) {
    if (support.grade === null || support.grade > query.maxGrade) continue;
    if (!query.attributes.includes(support.attribute)) continue;
    const family = supportFamily(support);
    if (socketedFamilies.has(family)) continue;
    // Lo que el jugador descartó en su build no se vuelve a proponer.
    if (mentions(theme.discarded, support.name) || mentions(theme.discarded, family)) continue;
    if (!supportApplies(support, query.skill)) continue;
    // De cada familia, solo la versión más alta que la gema permite tallar.
    const current = best.get(family);
    if (!current || (support.grade ?? 0) > (current.grade ?? 0)) best.set(family, support);
  }
  return [...best.values()]
    .map((support) => ({ support, score: scoreSupport(support, query.skill, theme, normalizeGemText(query.note ?? "")) }))
    .sort((a, b) => b.score - a.score || (b.support.grade ?? 0) - (a.support.grade ?? 0) || a.support.name.localeCompare(b.support.name, "es"));
}

/** Busca una habilidad por su nombre en español, sin tildes ni mayúsculas. */
export function findSkill(data: GemData, name: string): GemSkill | null {
  const wanted = normalizeGemText(name);
  if (!wanted) return null;
  return (
    data.skills.find((skill) => normalizeGemText(skill.name) === wanted) ??
    data.skills.find((skill) => normalizeGemText(skill.slug.replace(/_/g, " ")) === wanted) ??
    null
  );
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const MAX_ADVICE_NOTE_LENGTH = 200;

export const SupportAdviceRequestSchema = z.object({
  skill: z.string().trim().min(1).max(80),
  maxGrade: z.number().int().min(1).max(5),
  attributes: z.array(GemAttributeSchema).min(1).max(3),
  // Todas las asistencias que el personaje lleva, en cualquier habilidad: en
  // PoE2 cada una solo se puede poner una vez, así que ninguna vuelve a valer.
  socketed: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  /** Lo que el jugador cuenta («mis esqueletos mueren rápido»). Nunca es una instrucción. */
  note: z.string().trim().max(MAX_ADVICE_NOTE_LENGTH).optional(),
  build: BuildContextSchema.optional(),
});
export type SupportAdviceRequest = z.infer<typeof SupportAdviceRequestSchema>;

export const SupportAdviceOptionSchema = z.object({
  name: z.string(),
  grade: z.number().int(),
  attribute: GemAttributeSchema,
  costMultiplier: z.string().nullable(),
  description: z.string(),
  effects: z.array(z.string()),
});
export type SupportAdviceOption = z.infer<typeof SupportAdviceOptionSchema>;

export const SupportAdviceResponseSchema = z.object({
  skill: z.object({ name: z.string(), tags: z.array(z.string()) }),
  /** null cuando ninguna asistencia cumple las condiciones. */
  recommended: SupportAdviceOptionSchema.extend({ reason: z.string() }).nullable(),
  alternatives: z.array(SupportAdviceOptionSchema),
  /** `ai`: la IA redactó el motivo. `rules`: motivo de las reglas. La elección es siempre de las reglas. */
  mode: z.enum(["ai", "rules"]),
  fallbackReason: z.string().nullable(),
  source: z.string(),
  fetchedAt: z.string(),
});
export type SupportAdviceResponse = z.infer<typeof SupportAdviceResponseSchema>;

export const GemSkillListResponseSchema = z.object({
  skills: z.array(z.object({ name: z.string(), tags: z.array(z.string()) })),
  fetchedAt: z.string(),
});
export type GemSkillListResponse = z.infer<typeof GemSkillListResponseSchema>;
