import {
  readCharacterLevel,
  type CharacterProfile,
  type Item,
} from "./domain.js";

export type CharacterReadinessIssueId = "class" | "level" | "equipment" | "version";

export interface CharacterReadinessIssue {
  id: CharacterReadinessIssueId;
  label: string;
  detail: string;
}

export interface CharacterReadiness {
  ready: boolean;
  issues: CharacterReadinessIssue[];
  equippedItemCount: number;
  /** Alcance que la interfaz puede prometer sin fingir que observó más datos. */
  analysisScope: "blocked" | "partial" | "broad";
}

/**
 * Umbral editorial del producto, no una regla de PoE2.
 *
 * Con menos piezas todavía podemos orientar usando habilidades y estadísticas
 * observadas, pero no presentar el resultado como un análisis amplio del
 * equipo. Seis piezas cubren la mayoría del núcleo defensivo/ofensivo sin
 * exigir que el importador reconstruya todos los huecos para empezar.
 */
export const MIN_BROAD_ANALYSIS_EQUIPMENT = 6;

const NON_EQUIPMENT_RARITIES = new Set<Item["rarity"]>([
  "currency",
  "gem",
  "other",
]);

function versionFamily(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^\s*(\d+)[_.](\d+)/.exec(value);
  return match ? `${match[1]}.${match[2]}` : null;
}

/**
 * Mínimo honesto para pedir una recomendación de personaje.
 *
 * No exige resistencias ni defensas completas: el Mentor puede convertir esos
 * huecos en una petición de datos segura. Sí bloquea los tres casos en los que
 * ni siquiera existe un personaje observable detrás del borrador: clase
 * desconocida, nivel de relleno y ningún objeto equipado.
 */
export function assessCharacterReadiness(
  profile: CharacterProfile | null,
): CharacterReadiness {
  if (profile === null) {
    return {
      ready: false,
      issues: [],
      equippedItemCount: 0,
      analysisScope: "blocked",
    };
  }

  const issues: CharacterReadinessIssue[] = [];
  const characterClass = profile.characterClass.trim().toLocaleLowerCase("es");
  if (
    characterClass.length === 0 ||
    characterClass === "desconocida" ||
    characterClass === "desconocido" ||
    characterClass === "unknown"
  ) {
    issues.push({
      id: "class",
      label: "Clase",
      detail: "Indica la clase real que aparece en tu personaje.",
    });
  }

  if (!readCharacterLevel(profile).known) {
    issues.push({
      id: "level",
      label: "Nivel",
      detail: "Escribe el nivel que ves dentro de PoE2.",
    });
  }

  const treeVersion = profile.pobImport?.passiveTreeVersion;
  const treeFamily = versionFamily(treeVersion);
  const patchFamily = versionFamily(profile.patch);
  if (treeFamily !== null && patchFamily !== null && treeFamily !== patchFamily) {
    issues.push({
      id: "version",
      label: "Versión de árbol",
      detail: `El árbol pasivo importado es ${treeVersion} (familia ${treeFamily}), pero el expediente usa ${profile.patch}. Convierte la build en PoB2 y vuelve a importarla.`,
    });
  }

  const equippedItemCount = profile.items.filter(
    (item) => item.slot !== "other" && !NON_EQUIPMENT_RARITIES.has(item.rarity),
  ).length;
  if (equippedItemCount === 0) {
    issues.push({
      id: "equipment",
      label: "Equipo",
      detail: "Añade al menos un objeto equipado copiado desde PoE2.",
    });
  }

  const ready = issues.length === 0;
  return {
    ready,
    issues,
    equippedItemCount,
    analysisScope: !ready
      ? "blocked"
      : equippedItemCount < MIN_BROAD_ANALYSIS_EQUIPMENT
        ? "partial"
        : "broad",
  };
}

/**
 * Umbral para conversar con el Mentor sobre un personaje ya observado.
 *
 * Una recomendación de equipo exige al menos una pieza importada. En cambio,
 * el Mentor todavía puede explicar o reconciliar una decisión cuando la clase
 * y el nivel son reales y el expediente conserva estadísticas observadas. Así
 * no confundimos «sin inventario importado» con «personaje inexistente».
 */
export function assessMentorReadiness(
  profile: CharacterProfile | null,
): CharacterReadiness {
  const readiness = assessCharacterReadiness(profile);
  if (profile === null || readiness.ready) return readiness;

  const hasObservedStats =
    profile.life !== undefined ||
    profile.energyShield !== undefined ||
    profile.armour !== undefined ||
    profile.evasion !== undefined ||
    Object.values(profile.resistances).some((value) => value !== null) ||
    Object.values(profile.attributes).some((value) => value !== null);

  const hasIdentityIssue = readiness.issues.some(
    (issue) => issue.id === "class" || issue.id === "level",
  );
  if (!hasObservedStats || hasIdentityIssue) return readiness;

  const issues = readiness.issues.filter((issue) => issue.id !== "equipment");
  const ready = issues.length === 0;
  return {
    ...readiness,
    ready,
    issues,
    analysisScope: ready ? "partial" : "blocked",
  };
}
