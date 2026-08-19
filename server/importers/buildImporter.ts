import { randomUUID } from "node:crypto";
import type { CharacterProfile } from "../../shared/domain.js";
import { ApiHttpError } from "../errors.js";
import { decodePobCode, looksLikePobCode } from "../adapters/pob.js";
import { importGggBuildPlanner, parseGggBuildPlanner } from "./gggBuildImporter.js";

/**
 * Dispatcher de importación de builds.
 *
 * Detecta:
 *  (a) JSON del formato OFICIAL `.build` (GGG Build Planner v1) → gggBuildImporter.
 *  (b) Código Path of Building (base64url + zlib) → adaptador PoB best-effort.
 *  (c) Cualquier otra cosa → ApiHttpError(400) claro.
 */

export interface ImportBuildResult {
  profile: CharacterProfile;
  warnings: string[];
  detectedFormat: "ggg-build-planner-v1" | "pob-code" | "unknown";
}

export interface ImportDefaults {
  league: string;
  patch: string;
}

function importFromPob(content: string, defaults: ImportDefaults): ImportBuildResult {
  const decoded = decodePobCode(content);
  const warnings = [...decoded.warnings];
  if (!decoded.ok) {
    throw new ApiHttpError(
      400,
      "pob-code-invalido",
      `No se pudo decodificar el código Path of Building. ${warnings.join(" ")}`,
    );
  }

  const now = new Date().toISOString();
  const partial = decoded.partial;
  const profile: CharacterProfile = {
    id: randomUUID(),
    name: "Personaje importado desde PoB",
    characterClass: partial.characterClass ?? "Desconocida",
    ...(partial.ascendancy !== undefined ? { ascendancy: partial.ascendancy } : {}),
    level: partial.level ?? 1,
    archetype: "mercenary-crossbow",
    league: defaults.league,
    patch: defaults.patch,
    items: [],
    skills: partial.mainSkills.map((label, i) => ({
      id: randomUUID(),
      label: `Skill PoB ${i + 1}`,
      mainSkill: label,
      mainSkillGemId: null,
      supports: [],
    })),
    passives: { allocated: [] },
    attributes: { str: null, dex: null, int: null },
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    sources: [
      { kind: "user", label: "Código Path of Building (adaptador básico)", retrievedAt: now },
    ],
    importedAt: now,
  };
  warnings.push(
    `No verificado — se asume liga "${defaults.league}" y parche "${defaults.patch}" por defecto.`,
    "No verificado — completa manualmente items, resistencias y atributos: el adaptador PoB no los importa.",
  );
  return { profile, warnings, detectedFormat: "pob-code" };
}

export function importBuild(content: string, defaults: ImportDefaults): ImportBuildResult {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new ApiHttpError(400, "contenido-vacio", "El contenido a importar está vacío.");
  }

  // (a) JSON del formato oficial GGG Build Planner v1
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const build = parseGggBuildPlanner(trimmed);
    const { profile, warnings } = importGggBuildPlanner(build, defaults);
    return { profile, warnings, detectedFormat: "ggg-build-planner-v1" };
  }

  // (b) Código PoB
  if (looksLikePobCode(trimmed)) {
    return importFromPob(trimmed, defaults);
  }

  // (c) Desconocido
  throw new ApiHttpError(
    400,
    "formato-desconocido",
    "Formato no reconocido. Se acepta: archivo .build oficial (GGG Build Planner v1, JSON) o código de Path of Building.",
  );
}
