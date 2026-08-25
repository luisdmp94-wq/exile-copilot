import type { CraftingComparison } from "./craftingComparison.js";
import type { CraftingGoalCategory, CraftingGoalSignal } from "./craftingGoal.js";
import {
  RESISTANCE_LABELS,
  readCharacterLevel,
  type CharacterProfile,
  type GoalKind,
  type Item,
} from "./domain.js";

export type CraftingContextVerdict = "candidate" | "review" | "stop";
export type CraftingRequirementStatus = "met" | "unmet" | "unknown" | "not-declared";

export interface CraftingCharacterContext {
  verdict: CraftingContextVerdict;
  title: string;
  summary: string;
  requirementStatus: CraftingRequirementStatus;
  requirementLabel: string;
  protectionLabel: string;
  facts: string[];
  limitations: string[];
}

const ATTRIBUTE_TAGS = new Set([
  "attribute",
  "attributes",
  "atributo",
  "atributos",
  "strength",
  "fuerza",
  "dexterity",
  "destreza",
  "intelligence",
  "inteligencia",
]);

const RESISTANCE_TAGS = new Set(["resistance", "resistances", "resistencia", "resistencias"]);

/**
 * Umbral por debajo del cual el expediente señala una resistencia elemental
 * como carencia observable. Se exporta para que el guía cite el MISMO dato en
 * vez de duplicar el número.
 */
export const LOW_ELEMENTAL_RESISTANCE = 75;

/**
 * Distingue un expediente real del perfil técnico creado al pegar únicamente
 * un objeto. Nunca usa el nombre visible como contrato: exige alguna evidencia
 * que pertenezca al personaje y no a la pieza.
 */
export function hasCraftingCharacterContext(profile: CharacterProfile | null): boolean {
  if (profile === null) return false;
  if (readCharacterLevel(profile).known) return true;
  if (profile.ascendancy !== null || profile.skills.length > 0) return true;
  if (profile.characterClass.trim().toLocaleLowerCase("es") !== "desconocida") return true;
  if (Object.values(profile.attributes).some((value) => value !== null)) return true;
  if (Object.values(profile.resistances).some((value) => value !== null)) return true;
  return [profile.life, profile.energyShield, profile.evasion, profile.armour].some(
    (value) => value !== undefined,
  );
}

function normalizedTag(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function comparisonTouchesTags(comparison: CraftingComparison, tags: Set<string>): boolean {
  return [...comparison.addedModifiers, ...comparison.removedModifiers].some((modifier) =>
    (modifier.tags ?? []).some((tag) => tags.has(normalizedTag(tag))),
  );
}

function requirementCheck(
  profile: CharacterProfile,
  resultItem: Item,
  comparison: CraftingComparison,
): Pick<CraftingCharacterContext, "requirementStatus" | "requirementLabel"> & {
  facts: string[];
  limitations: string[];
} {
  const requirements = resultItem.requirements;
  if (!requirements || Object.keys(requirements).length === 0) {
    return {
      requirementStatus: "not-declared",
      requirementLabel: "Sin requisitos declarados",
      facts: [],
      limitations: ["El texto resultante no declara requisitos que comprobar."],
    };
  }

  const facts: string[] = [];
  const limitations: string[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];
  const attributeChanged = comparisonTouchesTags(comparison, ATTRIBUTE_TAGS);

  // El nivel solo se compara si su procedencia demuestra que es real. Un
  // mínimo técnico (perfil creado desde un objeto suelto) no autoriza afirmar
  // ni que cumple ni que no cumple el requisito.
  let levelUnknown = false;
  if (requirements.level !== undefined) {
    const reading = readCharacterLevel(profile);
    if (!reading.known) {
      levelUnknown = true;
      limitations.push(
        "No se puede comprobar el requisito de nivel porque no conocemos el nivel de tu personaje.",
      );
    } else if (reading.level < requirements.level) {
      missing.push(`nivel ${reading.level}/${requirements.level}`);
    }
  }

  const attributes = [
    ["Fuerza", requirements.str, profile.attributes.str],
    ["Destreza", requirements.dex, profile.attributes.dex],
    ["Inteligencia", requirements.int, profile.attributes.int],
  ] as const;
  for (const [label, required, current] of attributes) {
    if (required === undefined) continue;
    if (attributeChanged) {
      unknown.push(label.toLocaleLowerCase("es"));
    } else if (current === null) {
      unknown.push(label.toLocaleLowerCase("es"));
    } else if (current < required) {
      missing.push(`${label.toLocaleLowerCase("es")} ${current}/${required}`);
    }
  }

  if (missing.length > 0) {
    facts.push(`No cumple: ${missing.join(", ")}.`);
    return {
      requirementStatus: "unmet",
      requirementLabel: "Requisitos no cumplidos",
      facts,
      limitations,
    };
  }

  if (unknown.length > 0) {
    limitations.push(
      attributeChanged
        ? "El craft cambió atributos: el total del expediente todavía describe el objeto anterior."
        : `Faltan estos atributos del personaje: ${unknown.join(", ")}.`,
    );
    return {
      requirementStatus: "unknown",
      requirementLabel: "Requisitos por confirmar",
      facts,
      limitations,
    };
  }

  if (levelUnknown) {
    return {
      requirementStatus: "unknown",
      requirementLabel: "Nivel del personaje desconocido",
      facts,
      limitations,
    };
  }

  facts.push("El nivel y los atributos conocidos cumplen los requisitos mostrados.");
  return {
    requirementStatus: "met",
    requirementLabel: "Requisitos cumplidos",
    facts,
    limitations,
  };
}

function goalMatchesProfile(goal: GoalKind, category: CraftingGoalCategory | undefined): boolean {
  return (
    (goal === "damage" && category === "damage") ||
    (goal === "survival" && category === "defence")
  );
}

/**
 * Relaciona un resultado YA observado con el expediente. No calcula DPS,
 * defensas derivadas ni valor de mercado y no interpreta el texto del afijo.
 */
export function evaluateCraftingCharacterContext(input: {
  profile: CharacterProfile;
  profileGoal: GoalKind;
  originalItem: Item;
  resultItem: Item;
  comparison: CraftingComparison;
  goalCategory: CraftingGoalCategory | undefined;
  goalSignal: CraftingGoalSignal | null;
}): CraftingCharacterContext {
  const {
    profile,
    profileGoal,
    originalItem,
    resultItem,
    comparison,
    goalCategory,
    goalSignal,
  } = input;
  const requirements = requirementCheck(profile, resultItem, comparison);
  const facts = [...requirements.facts];
  const limitations = [...requirements.limitations];
  const equipped =
    originalItem.slot !== "other" &&
    profile.items.some((item) => item.id === originalItem.id && item.slot === originalItem.slot);

  if (equipped) {
    facts.push("El resultado corresponde a una pieza vinculada al equipo actual.");
  } else {
    limitations.push("La pieza no está vinculada a un hueco equipado; falta comparar el reemplazo real.");
  }

  if (goalMatchesProfile(profileGoal, goalCategory)) {
    facts.push("La categoría elegida coincide con el objetivo general del personaje.");
  }

  const observedTags = new Set(goalSignal?.observedTags ?? []);
  if (
    goalCategory === "defence" &&
    [...observedTags].some((tag) => RESISTANCE_TAGS.has(tag))
  ) {
    const lowElemental = (["fire", "cold", "lightning"] as const)
      .filter((kind) => {
        const value = profile.resistances[kind];
        return value !== null && value < LOW_ELEMENTAL_RESISTANCE;
      })
      .map((kind) => `${RESISTANCE_LABELS[kind]} ${profile.resistances[kind]}%`);
    if (lowElemental.length > 0) {
      facts.push(
        `El expediente tiene resistencias elementales bajo ${LOW_ELEMENTAL_RESISTANCE}%: ${lowElemental.join(", ")}.`,
      );
    }
  }

  const protectionLabel =
    comparison.protectionStatus === "lost"
      ? "Protección perdida"
      : comparison.protectionStatus === "preserved"
        ? "Protecciones intactas"
        : comparison.protectionStatus === "unverifiable"
          ? "Protección no verificable"
          : "Sin protección declarada";

  if (comparison.protectionStatus === "lost") {
    return {
      verdict: "stop",
      title: "Detente: se perdió algo protegido",
      summary:
        "El craft ocurrió, pero contradice un límite que marcaste antes de gastar. Revísalo antes de aceptar el resultado.",
      requirementStatus: requirements.requirementStatus,
      requirementLabel: requirements.requirementLabel,
      protectionLabel,
      facts,
      limitations,
    };
  }

  if (requirements.requirementStatus === "unmet") {
    return {
      verdict: "stop",
      title: "Detente: el resultado no cumple requisitos",
      summary:
        "Con los datos actuales, el personaje no puede usar esta pieza. No la marques como mejora sin resolver el déficit.",
      requirementStatus: requirements.requirementStatus,
      requirementLabel: requirements.requirementLabel,
      protectionLabel,
      facts,
      limitations,
    };
  }

  if (
    goalSignal?.status === "direct" &&
    requirements.requirementStatus !== "unknown"
  ) {
    return {
      verdict: "candidate",
      title: "Candidato coherente con lo que buscabas",
      summary:
        "Las etiquetas apuntan al objetivo y no aparece un bloqueo conocido. Aún debes juzgar la magnitud y el encaje real.",
      requirementStatus: requirements.requirementStatus,
      requirementLabel: requirements.requirementLabel,
      protectionLabel,
      facts,
      limitations,
    };
  }

  limitations.push(
    goalSignal?.status === "no-direct-signal"
      ? "Las etiquetas nuevas no muestran una relación directa con la categoría elegida."
      : "No hay etiquetas suficientes para relacionar el resultado con el objetivo.",
  );
  return {
    verdict: "review",
    title: "Aún no hay base para juzgarlo",
    summary:
      "El cambio está confirmado, pero el expediente no demuestra que resuelva tu objetivo. Decide con la prueba en juego.",
    requirementStatus: requirements.requirementStatus,
    requirementLabel: requirements.requirementLabel,
    protectionLabel,
    facts,
    limitations,
  };
}
