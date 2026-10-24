import { randomUUID } from "node:crypto";
import {
  PLACEHOLDER_CHARACTER_LEVEL,
  type CharacterProfile,
} from "../../shared/domain.js";
import type { BuildTargetPlan } from "../../shared/gggBuildPlanner.js";
import type { GggBuildPlannerV1 } from "../../shared/gggBuildPlanner.js";
import { ApiHttpError } from "../errors.js";
import { decodePobCode, looksLikePobCode } from "../adapters/pob.js";
import { importGggBuildPlanner, parseGggBuildPlanner } from "./gggBuildImporter.js";
import { profileFromPob, type ImportDefaults } from "./pobProfile.js";

/**
 * Dispatcher de importación de builds.
 *
 * Detecta:
 *  (a) JSON del formato OFICIAL `.build` (GGG Build Planner v1) → devuelve un
 *      `plan` objetivo o un `profile` parcial según la intención explícita.
 *      Como personaje nunca fabrica los campos que el formato no contiene.
 *  (b) Código Path of Building 2 (base64url + zlib) → `profile` con todos los
 *      campos presentes en la instantánea, marcados como no verificados.
 *  (c) Cualquier otra cosa → ApiHttpError(400) claro.
 *
 * La respuesta lleva `plan` XOR `profile` según el formato detectado.
 */

export interface ImportBuildResult {
  warnings: string[];
  detectedFormat: "ggg-build-planner-v1" | "pob-code" | "unknown";
  plan?: BuildTargetPlan;
  profile?: CharacterProfile;
}

export type { ImportDefaults } from "./pobProfile.js";

export type ImportIntent = "character" | "target";

function gggId(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

/**
 * Un `.build` no es un snapshot completo, pero sí puede ser el punto de partida
 * que el jugador reconoce como suyo. Solo trasladamos los campos que el formato
 * declara: nombre, ascendencia, skills y pasivas. El resto queda explícitamente
 * desconocido para que el editor pida completarlo.
 */
function importGggAsCharacter(
  build: GggBuildPlannerV1,
  defaults: ImportDefaults,
): ImportBuildResult {
  const now = new Date().toISOString();
  const skills = (build.skills ?? []).map((skill, index) => {
    const skillId = gggId(skill);
    const supports = typeof skill === "string" ? [] : (skill.support_skills ?? []).map((support) => {
      const supportId = gggId(support);
      return { name: supportId, gemId: supportId };
    });
    return {
      id: randomUUID(),
      label: `Habilidad importada ${index + 1}`,
      mainSkill: skillId,
      mainSkillGemId: skillId,
      supports,
    };
  });
  const allocated = (build.passives ?? []).map((passive) => ({
    ref: gggId(passive),
    isOfficialId: true,
    ...(typeof passive === "string" || passive.additional_text === undefined
      ? {}
      : { additionalText: passive.additional_text }),
  }));

  const profile: CharacterProfile = {
    id: randomUUID(),
    name: build.name.trim() || "Personaje importado desde .build",
    characterClass: "Desconocida",
    ascendancy: build.ascendancy ?? null,
    ascendancyId: build.ascendancy ?? null,
    level: PLACEHOLDER_CHARACTER_LEVEL,
    levelSource: "placeholder",
    archetype: null,
    league: defaults.league,
    patch: defaults.patch,
    items: [],
    skills,
    passives: { allocated },
    attributes: { str: null, dex: null, int: null },
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    sources: [{ kind: "user", label: "Archivo .build usado como borrador de personaje", retrievedAt: now }],
    importedAt: now,
  };

  return {
    profile,
    detectedFormat: "ggg-build-planner-v1",
    warnings: [
      "Personaje importado como borrador parcial: el archivo .build aporta nombre, ascendencia, habilidades y pasivas, pero no es una captura completa de tu personaje.",
      "Para analizarlo como tu personaje, completa nivel y clase y añade equipo copiado desde PoE2. El formato .build no contiene esos datos con fidelidad.",
      ...(build.inventory_slots?.length
        ? ["Las pistas de inventario del plan no se han presentado como objetos equipados ni como estadísticas reales."]
        : []),
    ],
  };
}

function importFromPob(content: string, defaults: ImportDefaults): ImportBuildResult {
  const decoded = decodePobCode(content);
  const warnings = decoded.warnings;
  if (!decoded.ok) {
    throw new ApiHttpError(
      400,
      "pob-code-invalido",
      `No se pudo importar el código Path of Building 2. ${warnings.join(" ")}`,
    );
  }

  const { profile, warnings: profileWarnings } = profileFromPob(decoded.partial, warnings, defaults);
  return { profile, warnings: profileWarnings, detectedFormat: "pob-code" };
}

export function importBuild(
  content: string,
  _defaults: ImportDefaults,
  intent: ImportIntent = "target",
): ImportBuildResult {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new ApiHttpError(400, "contenido-vacio", "El contenido a importar está vacío.");
  }

  // (a) JSON oficial: el destino procede de la acción visible del jugador.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const build = parseGggBuildPlanner(trimmed);
    if (intent === "character") return importGggAsCharacter(build, _defaults);
    const { plan, warnings } = importGggBuildPlanner(build);
    return { plan, warnings, detectedFormat: "ggg-build-planner-v1" };
  }

  // (b) Código PoB2 → perfil tan completo como la instantánea aportada
  if (looksLikePobCode(trimmed)) {
    return importFromPob(trimmed, _defaults);
  }

  // (c) Desconocido
  throw new ApiHttpError(
    400,
    "formato-desconocido",
    "Formato no reconocido. Se acepta: archivo .build oficial (GGG Build Planner v1, JSON) o código de Path of Building 2.",
  );
}
