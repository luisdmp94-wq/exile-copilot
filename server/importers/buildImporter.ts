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

export interface ImportDefaults {
  league: string;
  patch: string;
}

export type ImportIntent = "character" | "target";

function gggId(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

/** Convierte 0_5, 0.5 o 0.5.4f en una familia comparable: 0.5. */
function versionFamily(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^\s*(\d+)[_.](\d+)/.exec(value);
  return match ? `${match[1]}.${match[2]}` : null;
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
  const warnings = [...decoded.warnings];
  if (!decoded.ok) {
    throw new ApiHttpError(
      400,
      "pob-code-invalido",
      `No se pudo importar el código Path of Building 2. ${warnings.join(" ")}`,
    );
  }

  const now = new Date().toISOString();
  const partial = decoded.partial;
  const treeFamily = versionFamily(partial.passiveTreeVersion);
  const patchFamily = versionFamily(defaults.patch);
  const versionMismatch = treeFamily !== null
    && patchFamily !== null
    && treeFamily !== patchFamily;
  const pobVersionLabel = [
    partial.targetVersion ? `compatibilidad ${partial.targetVersion}` : null,
    partial.passiveTreeVersion ? `árbol ${partial.passiveTreeVersion}` : null,
  ].filter((value): value is string => value !== null).join(" · ");
  const profile: CharacterProfile = {
    id: randomUUID(),
    name: "Personaje importado desde PoB",
    characterClass: partial.characterClass ?? "Desconocida",
    // ascendClassName de PoB es un nombre visible, no un id oficial verificado.
    ascendancy: partial.ascendancy ?? null,
    ascendancyId: null,
    // PoB puede no traer nivel: entonces el número es un mínimo técnico y así
    // queda declarado, en vez de pasar por un nivel 1 observado.
    level: partial.level ?? PLACEHOLDER_CHARACTER_LEVEL,
    levelSource: partial.level !== undefined ? "observed" : "placeholder",
    archetype: null, // nunca hardcodeado: el usuario lo declara si quiere
    league: defaults.league,
    patch: defaults.patch,
    items: partial.items,
    skills: partial.skills,
    passives: { allocated: partial.passives },
    attributes: partial.attributes ?? { str: null, dex: null, int: null },
    resistances: partial.resistances ?? { fire: null, cold: null, lightning: null, chaos: null },
    ...(partial.life !== undefined ? { life: partial.life } : {}),
    ...(partial.energyShield !== undefined ? { energyShield: partial.energyShield } : {}),
    ...(partial.evasion !== undefined ? { evasion: partial.evasion } : {}),
    ...(partial.armour !== undefined ? { armour: partial.armour } : {}),
    ...(partial.notes ? { notes: partial.notes } : {}),
    ...(partial.targetVersion || partial.passiveTreeVersion
      ? {
          pobImport: {
            ...(partial.targetVersion ? { targetVersion: partial.targetVersion } : {}),
            ...(partial.passiveTreeVersion
              ? { passiveTreeVersion: partial.passiveTreeVersion }
              : {}),
          },
        }
      : {}),
    sources: [
      {
        kind: "user",
        label: `Instantánea importada desde Path of Building 2${pobVersionLabel ? ` · ${pobVersionLabel}` : ""}`,
        retrievedAt: now,
      },
    ],
    importedAt: now,
  };

  if (versionMismatch) {
    warnings.unshift(
      `Incompatibilidad de versión — el árbol pasivo de PoB2 declara ${partial.passiveTreeVersion} (familia ${treeFamily}), pero Exile Copilot está analizando con ${defaults.patch}. Actualiza o convierte la build en PoB2 antes de aceptar recomendaciones.`,
    );
  }
  warnings.push(
    partial.passiveTreeVersion && treeFamily === patchFamily
      ? `Versión parcial — PoB2 declara el árbol pasivo ${partial.passiveTreeVersion}, compatible con la familia ${patchFamily}; la liga y el parche exactos "${defaults.patch}" siguen sin verificarse.`
      : `No verificado — se asume liga "${defaults.league}" y parche "${defaults.patch}" por defecto.`,
    ...(partial.items.length === 0
      ? ["Completa el equipo manualmente o exporta desde PoB2 un personaje que tenga el set de objetos activo."]
      : []),
  );
  return { profile, warnings, detectedFormat: "pob-code" };
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
