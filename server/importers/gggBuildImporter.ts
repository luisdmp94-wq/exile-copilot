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
  return {
    plan: { build, importedAt: new Date().toISOString() },
    warnings,
  };
}
