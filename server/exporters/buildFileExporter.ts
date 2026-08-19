import { BUILD_FILE_FORMAT_VERSION, BuildFileSchema, type BuildFile } from "../../shared/buildFile.js";
import type { CharacterProfile } from "../../shared/domain.js";

/**
 * Exportador `.build` (JSON versionado, formatVersion 1).
 *
 * Garantía de round-trip: la salida se valida contra `BuildFileSchema` antes
 * de devolverse, e incluye todos los campos opcionales del perfil para que el
 * importador no tenga que rellenar defaults (sin warnings de validación dura).
 */
export function exportBuild(
  profile: CharacterProfile,
  appliedRecommendations: string[] = [],
): string {
  const file: BuildFile = {
    formatVersion: BUILD_FILE_FORMAT_VERSION,
    app: "exile-copilot",
    exportedAt: new Date().toISOString(),
    patch: profile.patch,
    league: profile.league,
    character: {
      name: profile.name,
      class: profile.characterClass,
      ...(profile.ascendancy !== undefined ? { ascendancy: profile.ascendancy } : {}),
      level: profile.level,
      archetype: profile.archetype,
      attributes: profile.attributes,
      resistances: profile.resistances,
      ...(profile.life !== undefined ? { life: profile.life } : {}),
      ...(profile.energyShield !== undefined ? { energyShield: profile.energyShield } : {}),
      ...(profile.evasion !== undefined ? { evasion: profile.evasion } : {}),
      ...(profile.armour !== undefined ? { armour: profile.armour } : {}),
    },
    items: profile.items,
    skills: profile.skills,
    passives: profile.passives,
    appliedRecommendations,
    ...(profile.notes !== undefined ? { notes: profile.notes } : {}),
  };

  // Validación defensiva: si esto falla es un bug del exportador, no del usuario.
  const validated = BuildFileSchema.parse(file);
  return JSON.stringify(validated, null, 2);
}
