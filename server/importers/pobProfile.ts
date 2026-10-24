import {
  PLACEHOLDER_CHARACTER_LEVEL,
  type CharacterProfile,
} from "../../shared/domain.js";
import type { PobPartial } from "../adapters/pobXml.js";

/**
 * Personaje a partir de lo leído en un código PoB2, sin dependencias de Node:
 * lo usan el importador del servidor y el chequeo de build en el navegador.
 */

export interface ImportDefaults {
  league: string;
  patch: string;
}

/** Convierte 0_5, 0.5 o 0.5.4f en una familia comparable: 0.5. */
function versionFamily(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^\s*(\d+)[_.](\d+)/.exec(value);
  return match ? `${match[1]}.${match[2]}` : null;
}

export function profileFromPob(
  partial: PobPartial,
  decodeWarnings: string[],
  defaults: ImportDefaults,
): { profile: CharacterProfile; warnings: string[] } {
  const now = new Date().toISOString();
  const warnings = [...decodeWarnings];
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
    id: crypto.randomUUID(),
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
  return { profile, warnings };
}
