import type { CharacterProfile } from "@shared/domain.js";

/** La habilidad con la que el personaje hace el daño: la primera que apuntó. */
export function mainSkillOf(profile: Pick<CharacterProfile, "skills">): string | null {
  for (const setup of profile.skills) {
    const name = (setup.mainSkill || setup.label || "").trim();
    if (name !== "") return name;
  }
  return null;
}

/**
 * Hasta qué grado de asistencia enseñar sin preguntar. Al empezar solo hay
 * gemas de grado I; más adelante casi todo el mundo tiene ya alguna de grado
 * II. Los grados altos no se dan por supuestos: para eso está el consejero.
 */
export function teaserGradeFor(level: number | null): number {
  return level !== null && level >= 15 ? 2 : 1;
}
