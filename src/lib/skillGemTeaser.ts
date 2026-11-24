import type { CharacterProfile } from "@shared/domain.js";
import { assumedMaxGrade } from "@shared/supportGemAdvice.js";

/** La habilidad con la que el personaje hace el daño: la primera que apuntó. */
export function mainSkillOf(profile: Pick<CharacterProfile, "skills">): string | null {
  for (const setup of profile.skills) {
    const name = (setup.mainSkill || setup.label || "").trim();
    if (name !== "") return name;
  }
  return null;
}

/**
 * Hasta qué grado de asistencia enseñar sin preguntar: la misma regla que usa
 * el Mentor. Los grados altos no se dan por supuestos: para eso está el consejero.
 */
export const teaserGradeFor = assumedMaxGrade;
