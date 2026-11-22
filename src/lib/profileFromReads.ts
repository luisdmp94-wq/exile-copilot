/**
 * Lo que se lee rápido del juego —una captura de la hoja (tecla C), una de la
 * ventana de habilidades o un código de Path of Building 2— pasa al MISMO
 * personaje: mismo id, mismo diario. Solo se escribe lo que se ha leído; lo
 * que no se vio se queda como estaba.
 *
 * Cada función devuelve también los datos de la revisión rápida que hay que
 * poner al día, porque el Mentor usa la revisión por encima del perfil: si no,
 * un nivel viejo escrito allí taparía el nuevo.
 */
import type { CharacterProfile, SkillSetup } from "@shared/domain.js";
import { SCREENSHOT_SKILL_ID_PREFIX } from "@shared/quickReview.js";
import type { ScreenshotSheet, ScreenshotSkill } from "@shared/screenshotRead.js";

export interface ProfileRead {
  profile: CharacterProfile;
  /** Campos de la revisión rápida (como texto) que cambian con esta lectura. */
  review: Record<string, string>;
  /** Cuántos datos se han rellenado, para decírselo al jugador. */
  filled: number;
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");

/**
 * Clases base de PoE2 (cliente en inglés y en español). La hoja enseña la
 * clase base mientras no hay ascendencia: eso no es una ascendencia.
 */
const BASE_CLASSES = new Set(
  [
    "Warrior", "Guerrero",
    "Ranger", "Exploradora",
    "Huntress", "Cazadora",
    "Witch", "Bruja",
    "Sorceress", "Hechicera",
    "Mercenary", "Mercenario",
    "Monk", "Monje",
    "Druid", "Druida",
  ].map((name) => name.toLocaleLowerCase("es")),
);

/** Hoja del personaje: nivel, vida, escudo, atributos y resistencias. */
export function applySheetToProfile(profile: CharacterProfile, sheet: ScreenshotSheet): ProfileRead {
  const review: Record<string, string> = {};
  let filled = 0;
  let next: CharacterProfile = { ...profile };

  if (sheet.level !== null) {
    next = { ...next, level: sheet.level, levelSource: "observed" };
    review.level = String(sheet.level);
    filled += 1;
  }
  if (sheet.life !== null) {
    next = { ...next, life: sheet.life };
    filled += 1;
  }
  if (sheet.energyShield !== null) {
    next = { ...next, energyShield: sheet.energyShield };
    filled += 1;
  }

  const attributes = { ...next.attributes };
  for (const key of ["str", "dex", "int"] as const) {
    if (sheet[key] !== null) {
      attributes[key] = sheet[key];
      filled += 1;
    }
  }
  next = { ...next, attributes };

  const resistances = { ...next.resistances };
  for (const key of ["fire", "cold", "lightning", "chaos"] as const) {
    const value = sheet[key];
    if (value !== null) {
      resistances[key] = value;
      if (key !== "chaos") review[key] = String(value);
      filled += 1;
    }
  }
  next = { ...next, resistances };

  // La hoja enseña la ascendencia cuando ya la tienes («Liche»); si solo
  // enseña la clase base no hay nada nuevo que apuntar.
  const className = sheet.className?.trim();
  if (
    className &&
    !sameName(className, next.characterClass) &&
    !BASE_CLASSES.has(className.toLocaleLowerCase("es")) &&
    !next.ascendancy
  ) {
    next = { ...next, ascendancy: className };
    filled += 1;
  }

  return { profile: next, review, filled };
}

/**
 * Ventana de habilidades: la que elige el jugador como principal va la
 * primera (el motor toma la primera). Las que el perfil no tenía se añaden
 * sin apoyos conocidos, para que nadie diga «tiene 0 apoyos».
 */
export function applySkillsToProfile(
  profile: CharacterProfile,
  skills: readonly ScreenshotSkill[],
  mainIndex: number,
): ProfileRead {
  const main = skills[mainIndex];
  if (!main) return { profile, review: {}, filled: 0 };

  const ordered = [main, ...skills.filter((_, index) => index !== mainIndex)];
  const known = [...profile.skills];
  const result: SkillSetup[] = [];
  ordered.forEach((read, index) => {
    const existingIndex = known.findIndex((skill) => sameName(skill.mainSkill, read.name));
    if (existingIndex >= 0) {
      result.push(known[existingIndex]!);
      known.splice(existingIndex, 1);
      return;
    }
    result.push({
      id: `${SCREENSHOT_SKILL_ID_PREFIX}${Date.now().toString(36)}-${index}`,
      label: "",
      mainSkill: read.name,
      mainSkillGemId: null,
      supports: [],
    });
  });

  return {
    profile: { ...profile, skills: [...result, ...known] },
    review: {
      mainSkill: main.name,
      gemLevel: main.level === null ? "" : String(main.level),
      otherSkills: ordered
        .slice(1)
        .map((skill) => skill.name)
        .join(", "),
    },
    filled: ordered.length,
  };
}

/**
 * Código de PoB2 sobre el personaje que ya tienes: entra lo que trae el código
 * (equipo, habilidades con sus apoyos, pasivas, nivel, estadísticas) y se
 * conservan el id, el nombre, la liga y el parche. Lo que el código no trae
 * no borra lo que ya había.
 */
export function mergeImportedProfile(current: CharacterProfile, imported: CharacterProfile): ProfileRead {
  const review: Record<string, string> = {};
  let filled = 0;
  let next: CharacterProfile = { ...current };

  if (imported.items.length > 0) {
    next = { ...next, items: imported.items };
    filled += imported.items.length;
  }
  if (imported.skills.length > 0) {
    next = { ...next, skills: imported.skills };
    filled += imported.skills.length;
    const main = imported.skills[0]?.mainSkill;
    if (main) review.mainSkill = main;
  }
  if (imported.passives.allocated.length > 0) {
    next = { ...next, passives: imported.passives };
    filled += 1;
    // La versión del árbol del código: el árbol de la web avisa si no es la suya.
    if (imported.pobImport) next = { ...next, pobImport: imported.pobImport };
  }
  if (imported.levelSource === "observed") {
    next = { ...next, level: imported.level, levelSource: "observed" };
    review.level = String(imported.level);
    filled += 1;
  }
  if (imported.characterClass && imported.characterClass !== "Desconocida") {
    next = { ...next, characterClass: imported.characterClass };
  }
  // PoB2 escribe «None» cuando aún no hay ascendencia: no es un nombre.
  const hasValue = (value: string | null) => value !== null && value.trim() !== "" && !/^none$/i.test(value.trim());
  if (hasValue(imported.ascendancy)) next = { ...next, ascendancy: imported.ascendancy };
  if (hasValue(imported.ascendancyId)) next = { ...next, ascendancyId: imported.ascendancyId };

  for (const key of ["life", "energyShield", "evasion", "armour"] as const) {
    const value = imported[key];
    if (value !== undefined) {
      next = { ...next, [key]: value };
      filled += 1;
    }
  }
  const attributes = { ...next.attributes };
  for (const key of ["str", "dex", "int"] as const) {
    if (imported.attributes[key] !== null) attributes[key] = imported.attributes[key];
  }
  const resistances = { ...next.resistances };
  for (const key of ["fire", "cold", "lightning", "chaos"] as const) {
    const value = imported.resistances[key];
    if (value !== null) {
      resistances[key] = value;
      if (key !== "chaos") review[key] = String(value);
    }
  }
  next = { ...next, attributes, resistances };

  return { profile: next, review, filled };
}
