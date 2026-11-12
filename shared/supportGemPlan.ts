import { z } from "zod";
import {
  BuildContextSchema,
  GemAttributeSchema,
  MAX_ADVICE_NOTE_LENGTH,
  SupportAdviceOptionSchema,
  normalizeGemText,
  supportCandidates,
  supportFamily,
  type BuildContext,
  type GemAttribute,
  type GemData,
  type GemSkill,
  type GemSupport,
} from "./supportGemAdvice.js";

/**
 * «Tengo varias gemas de asistencia: ¿cuáles cojo y dónde las pongo?»
 *
 * El reparto lo hacen las reglas: qué vale para cada habilidad, cuántos huecos
 * quedan por atributo y que una misma gema no se repita. La IA, si está
 * activa, solo redacta el motivo de cada pareja ya decidida.
 */

export type GemCapacity = Record<GemAttribute, number>;

export interface SupportPair {
  skill: GemSkill;
  support: GemSupport;
  score: number;
}

export interface PlanQuery {
  skills: readonly GemSkill[];
  maxGrade: number;
  capacity: GemCapacity;
  /** Asistencias que el personaje ya lleva puestas, en cualquier habilidad. */
  socketed?: readonly string[];
  build?: BuildContext | null;
}

/** Cuántas candidatas se consideran por habilidad y atributo. */
const PER_SKILL_AND_ATTRIBUTE = 3;

/** Todas las parejas habilidad + asistencia que las reglas permiten. */
export function supportPairs(data: GemData, query: PlanQuery): SupportPair[] {
  const attributes = (Object.keys(query.capacity) as GemAttribute[]).filter((attribute) => query.capacity[attribute] > 0);
  if (attributes.length === 0) return [];
  const pairs: SupportPair[] = [];
  const seenSkills = new Set<string>();
  for (const skill of query.skills) {
    if (seenSkills.has(skill.slug)) continue;
    seenSkills.add(skill.slug);
    const candidates = supportCandidates(data, {
      skill,
      maxGrade: query.maxGrade,
      attributes,
      socketed: query.socketed ?? [],
      build: query.build ?? null,
    });
    // Las mejores de cada atributo: así una gema de destreza no se queda fuera
    // solo porque las de inteligencia puntúen más.
    const taken = new Map<GemAttribute, number>();
    for (const candidate of candidates) {
      const count = taken.get(candidate.support.attribute) ?? 0;
      if (count >= PER_SKILL_AND_ATTRIBUTE) continue;
      taken.set(candidate.support.attribute, count + 1);
      pairs.push({ skill, support: candidate.support, score: candidate.score });
    }
  }
  return pairs;
}

export function pairKey(skillName: string, supportName: string): string {
  return `${normalizeGemText(skillName)}→${normalizeGemText(supportName)}`;
}

/**
 * Reparte `gems` gemas siguiendo el orden dado y respetando los topes:
 * huecos libres por atributo, una sola copia de cada familia de asistencia y,
 * mientras haya habilidades sin nada nuevo, una gema por habilidad.
 */
export function allocateSupports(ordered: readonly SupportPair[], gems: number, capacity: GemCapacity): SupportPair[] {
  const left: GemCapacity = { ...capacity };
  const usedFamilies = new Set<string>();
  const perSkill = new Map<string, number>();
  const chosen: SupportPair[] = [];

  for (const limit of [1, 2]) {
    for (const pair of ordered) {
      if (chosen.length >= gems) return chosen;
      const family = supportFamily(pair.support);
      if (usedFamilies.has(family)) continue;
      if (left[pair.support.attribute] <= 0) continue;
      if ((perSkill.get(pair.skill.slug) ?? 0) >= limit) continue;
      chosen.push(pair);
      usedFamilies.add(family);
      left[pair.support.attribute] -= 1;
      perSkill.set(pair.skill.slug, (perSkill.get(pair.skill.slug) ?? 0) + 1);
    }
  }
  return chosen;
}

/** Orden por reglas: las parejas más afines primero, alternando habilidades. */
export function rankPairsByRules(pairs: readonly SupportPair[]): SupportPair[] {
  return [...pairs].sort(
    (a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name, "es") || a.support.name.localeCompare(b.support.name, "es"),
  );
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const FreeSlots = z.number().int().min(0).max(9);

export const SupportPlanRequestSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  /** Cuántas gemas sin tallar tiene para repartir. */
  gems: z.number().int().min(1).max(5),
  maxGrade: z.number().int().min(1).max(5),
  /** Huecos libres por atributo, como los enseña el juego (5 − 4 = 1). */
  capacity: z.object({ Fue: FreeSlots, Des: FreeSlots, Int: FreeSlots }),
  socketed: z.array(z.string().trim().min(1).max(80)).max(16).optional(),
  note: z.string().trim().max(MAX_ADVICE_NOTE_LENGTH).optional(),
  build: BuildContextSchema.optional(),
});
export type SupportPlanRequest = z.infer<typeof SupportPlanRequestSchema>;

export const SupportPlanResponseSchema = z.object({
  assignments: z.array(
    z.object({
      skill: z.string(),
      support: SupportAdviceOptionSchema,
      reason: z.string(),
    }),
  ),
  /** Gemas que se quedan sin sitio con esas condiciones. */
  leftover: z.number().int().min(0),
  /** Nombres que no corresponden a ninguna habilidad conocida. */
  unknownSkills: z.array(z.string()),
  mode: z.enum(["ai", "rules"]),
  fallbackReason: z.string().nullable(),
  source: z.string(),
  fetchedAt: z.string(),
});
export type SupportPlanResponse = z.infer<typeof SupportPlanResponseSchema>;

export { GemAttributeSchema };
