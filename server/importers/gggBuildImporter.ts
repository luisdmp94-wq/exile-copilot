import {
  GggBuildPlannerV1Schema,
  type BuildTargetPlan,
  type GggBuildPlannerV1,
} from "../../shared/gggBuildPlanner.js";
import { ApiHttpError } from "../errors.js";

/**
 * Importador del formato OFICIAL `.build` (GGG Build Planner v1, Experimental).
 * Fuente del esquema: https://www.pathofexile.com/developer/docs/game
 *
 * DECISIÓN CRÍTICA: un `.build` oficial es un PLAN/instructor de build
 * objetivo, NO una captura del personaje actual. Por tanto la importación
 * devuelve un `BuildTargetPlan` con el objeto oficial CRUDO completo
 * (level_interval, weapon_set, additional_text, slot_x/slot_y, unique_name,
 * author, link, description, ascendancy), nunca un CharacterProfile.
 * No se derivan items, resistencias ni "0 mods" de los inventory_slots:
 * son solo pistas de texto del plan.
 */

export interface GggPlanImportResult {
  plan: BuildTargetPlan;
  warnings: string[];
}

/** Campos documentados del esquema v1, por tipo de objeto. */
const DOCUMENTED_KEYS = {
  build: ["name", "author", "link", "description", "ascendancy", "passives", "skills", "inventory_slots"],
  passive: ["id", "level_interval", "weapon_set", "additional_text"],
  skill: ["id", "level_interval", "additional_text", "support_skills"],
  support: ["id", "level_interval", "additional_text"],
  slot: ["inventory_id", "slot_x", "slot_y", "level_interval", "unique_name", "additional_text"],
} as const;

function unknownKeysOf(value: unknown, known: readonly string[], path: string): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.keys(value)
    .filter((k) => !known.includes(k))
    .map((k) => `${path}.${k}`);
}

/**
 * Lista los campos NO documentados en el esquema v1 presentes en el build.
 * Se conservan tal cual (los esquemas son loose), pero se declaran: nunca
 * una pérdida ni una conservación silenciosas.
 */
export function listUndocumentedFields(build: GggBuildPlannerV1): string[] {
  const out: string[] = [...unknownKeysOf(build, DOCUMENTED_KEYS.build, "(raíz)")];
  (build.passives ?? []).forEach((p, i) => {
    out.push(...unknownKeysOf(p, DOCUMENTED_KEYS.passive, `passives[${i}]`));
  });
  (build.skills ?? []).forEach((s, i) => {
    out.push(...unknownKeysOf(s, DOCUMENTED_KEYS.skill, `skills[${i}]`));
    if (typeof s === "object") {
      (s.support_skills ?? []).forEach((sup, j) => {
        out.push(...unknownKeysOf(sup, DOCUMENTED_KEYS.support, `skills[${i}].support_skills[${j}]`));
      });
    }
  });
  (build.inventory_slots ?? []).forEach((slot, i) => {
    out.push(...unknownKeysOf(slot, DOCUMENTED_KEYS.slot, `inventory_slots[${i}]`));
  });
  return out;
}

export function parseGggBuildPlanner(content: string): GggBuildPlannerV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new ApiHttpError(
      400,
      "build-json-invalido",
      `El contenido parece JSON pero no se pudo parsear: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = GggBuildPlannerV1Schema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("; ");
    throw new ApiHttpError(
      400,
      "ggg-build-invalido",
      `El JSON no es válido contra el esquema GGG Build Planner v1: ${detail}`,
    );
  }
  return result.data;
}

/**
 * Convierte el objeto oficial validado en un BuildTargetPlan SIN transformar:
 * el `build` se conserva crudo para poder reexportarlo con fidelidad.
 */
export function importGggBuildPlanner(build: GggBuildPlannerV1): GggPlanImportResult {
  const warnings: string[] = [
    "El archivo .build oficial es un PLAN de build objetivo (instructor), no una captura de tu personaje: " +
      "se ha guardado como build de referencia. Tu personaje actual no se modifica.",
    "Los nombres visibles de pasivas y skills no son resolubles desde sus ids oficiales sin datos del juego: " +
      "se muestran los ids (nombre no verificado).",
  ];
  if ((build.inventory_slots ?? []).length > 0) {
    warnings.push(
      "Los inventory_slots del plan son pistas de texto, no objetos equipados: no se derivan mods, bases ni estadísticas de ellos.",
    );
  }
  const undocumented = listUndocumentedFields(build);
  if (undocumented.length > 0) {
    warnings.push(
      `El archivo contiene ${undocumented.length} campo(s) no documentado(s) en el esquema GGG Build Planner v1; ` +
        `se conservan tal cual y se reexportan sin cambios: ${undocumented.join(", ")}.`,
    );
  }
  return {
    plan: { build, importedAt: new Date().toISOString() },
    warnings,
  };
}
