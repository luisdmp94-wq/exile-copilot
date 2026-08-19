import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { BuildFileSchema, type BuildFile } from "../../shared/buildFile.js";
import type { CharacterProfile, SourceEvidence } from "../../shared/domain.js";
import { ApiHttpError } from "../errors.js";
import { decodePobCode, looksLikePobCode } from "../adapters/pob.js";

/**
 * Importador tolerante de builds.
 *
 * Detecta tres formatos:
 *  (a) JSON que valida contra `BuildFileSchema` (shared/buildFile.ts). Si
 *      faltan campos opcionales se rellenan con defaults y se añade un warning
 *      por cada uno; si falla la validación dura → ApiHttpError(400) con detalle.
 *  (b) Código Path of Building (base64url + zlib) → server/adapters/pob.ts.
 *  (c) Cualquier otra cosa → error 400 claro.
 */

export interface ImportBuildResult {
  profile: CharacterProfile;
  warnings: string[];
  detectedFormat: "build-json" | "pob-code" | "unknown";
}

/** Campos opcionales cuyo default rellenamos con warning. */
function collectDefaultedFieldWarnings(raw: unknown, warnings: string[]): void {
  if (typeof raw !== "object" || raw === null) return;
  const obj = raw as Record<string, unknown>;

  const optionalTopLevel: Array<[string, string]> = [
    ["items", "items (lista vacía)"],
    ["skills", "skills (lista vacía)"],
    ["passives", "pasivas (sin nodos)"],
    ["appliedRecommendations", "appliedRecommendations (vacío)"],
  ];
  for (const [key, label] of optionalTopLevel) {
    if (!(key in obj)) warnings.push(`Campo ausente "${key}" — rellenado con valor por defecto: ${label}.`);
  }
  if (typeof obj.character === "object" && obj.character !== null) {
    const ch = obj.character as Record<string, unknown>;
    const optionalChar: Array<[string, string]> = [
      ["ascendancy", "sin ascendencia"],
      ["attributes", "atributos en 0"],
      ["resistances", "resistencias en 0"],
    ];
    for (const [key, label] of optionalChar) {
      if (!(key in ch)) warnings.push(`Campo ausente "character.${key}" — rellenado con valor por defecto: ${label}.`);
    }
  }
}

function userSource(label: string): SourceEvidence {
  return { kind: "user", label, retrievedAt: new Date().toISOString() };
}

/** Convierte un BuildFile validado en un CharacterProfile completo. */
export function buildFileToProfile(file: BuildFile): CharacterProfile {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: file.character.name,
    characterClass: file.character.class,
    ...(file.character.ascendancy !== undefined ? { ascendancy: file.character.ascendancy } : {}),
    level: file.character.level,
    archetype: file.character.archetype ?? "mercenary-crossbow",
    league: file.league,
    patch: file.patch,
    items: file.items,
    skills: file.skills,
    passives: file.passives,
    attributes: file.character.attributes ?? { str: 0, dex: 0, int: 0 },
    resistances:
      file.character.resistances ?? { fire: 0, cold: 0, lightning: 0, chaos: 0 },
    ...(file.character.life !== undefined ? { life: file.character.life } : {}),
    ...(file.character.energyShield !== undefined ? { energyShield: file.character.energyShield } : {}),
    ...(file.character.evasion !== undefined ? { evasion: file.character.evasion } : {}),
    ...(file.character.armour !== undefined ? { armour: file.character.armour } : {}),
    ...(file.notes !== undefined ? { notes: file.notes } : {}),
    sources: [userSource("Archivo .build importado (formatVersion 1)")],
    importedAt: now,
  };
}

function importFromJson(content: string): ImportBuildResult {
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

  const warnings: string[] = [];
  collectDefaultedFieldWarnings(parsed, warnings);

  const result = BuildFileSchema.safeParse(parsed);
  if (!result.success) {
    const detail =
      result.error instanceof ZodError
        ? result.error.issues
            .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
            .join("; ")
        : "Error de validación desconocido.";
    throw new ApiHttpError(
      400,
      "build-json-invalido",
      `El JSON no cumple el esquema .build (formatVersion 1): ${detail}`,
    );
  }

  return {
    profile: buildFileToProfile(result.data),
    warnings,
    detectedFormat: "build-json",
  };
}

function importFromPob(content: string): ImportBuildResult {
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
    league: "No verificado",
    patch: "No verificado",
    items: [],
    skills: partial.mainSkills.map((label, i) => ({
      id: randomUUID(),
      label: `Skill PoB ${i + 1}`,
      mainSkill: label,
      supports: [],
    })),
    passives: { allocated: [] },
    attributes: { str: 0, dex: 0, int: 0 },
    resistances: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
    sources: [userSource("Código Path of Building (adaptador básico)")],
    importedAt: now,
  };
  warnings.push(
    "No verificado — completa manualmente items, resistencias y atributos: el adaptador PoB no los importa.",
  );
  return { profile, warnings, detectedFormat: "pob-code" };
}

export function importBuild(content: string): ImportBuildResult {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new ApiHttpError(400, "contenido-vacio", "El contenido a importar está vacío.");
  }

  // (a) JSON .build
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return importFromJson(trimmed);
  }

  // (b) Código PoB
  if (looksLikePobCode(trimmed)) {
    return importFromPob(trimmed);
  }

  // (c) Desconocido
  throw new ApiHttpError(
    400,
    "formato-desconocido",
    "Formato no reconocido. Se acepta: JSON de archivo .build (formatVersion 1) o código de Path of Building.",
  );
}
