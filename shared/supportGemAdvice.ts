import { z } from "zod";

/**
 * «¿Qué gema de asistencia le pongo a esta habilidad?»
 *
 * Las reglas hacen el filtro duro con los datos del juego (etiquetas, grado,
 * atributo y lo que dice la propia descripción de la asistencia). La IA, si
 * está activa, solo elige entre las que quedan y lo explica; nunca puede
 * proponer una gema que las reglas hayan descartado.
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

export interface SupportQuery {
  skill: GemSkill;
  /** Grado de la gema sin tallar: permite asistencias de ese grado o menor. */
  maxGrade: number;
  /** Atributos en los que al jugador le queda hueco de asistencia. */
  attributes: readonly GemAttribute[];
  /** Asistencias que esa habilidad ya lleva puestas. */
  socketed?: readonly string[];
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

function scoreSupport(support: GemSupport, skill: GemSkill): number {
  let score = 0;
  for (const tag of support.tags) {
    if (SOFT_TAGS.has(tag) || !skill.tags.includes(tag)) continue;
    score += ELEMENT_TAGS.has(tag) ? 3 : 2;
  }
  if (/mas dano/.test(normalizeGemText(`${support.description} ${support.effects.join(" ")}`))) score += 1;
  if (support.costMultiplier) score -= 1;
  return score;
}

/** Asistencias que las reglas dejan poner, ordenadas de más a menos afín. */
export function supportCandidates(data: GemData, query: SupportQuery): SupportCandidate[] {
  const socketed = new Set((query.socketed ?? []).map(normalizeGemText));
  const socketedFamilies = new Set(
    data.supports.filter((support) => socketed.has(normalizeGemText(support.name))).map(supportFamily),
  );
  const best = new Map<string, GemSupport>();
  for (const support of data.supports) {
    if (support.grade === null || support.grade > query.maxGrade) continue;
    if (!query.attributes.includes(support.attribute)) continue;
    const family = supportFamily(support);
    if (socketedFamilies.has(family)) continue;
    if (!supportApplies(support, query.skill)) continue;
    // De cada familia, solo la versión más alta que la gema permite tallar.
    const current = best.get(family);
    if (!current || (support.grade ?? 0) > (current.grade ?? 0)) best.set(family, support);
  }
  return [...best.values()]
    .map((support) => ({ support, score: scoreSupport(support, query.skill) }))
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
  socketed: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  /** Lo que el jugador cuenta («mis esqueletos mueren rápido»). Nunca es una instrucción. */
  note: z.string().trim().max(MAX_ADVICE_NOTE_LENGTH).optional(),
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
  /** `ai`: la IA eligió entre las candidatas. `rules`: orden por etiquetas. */
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
