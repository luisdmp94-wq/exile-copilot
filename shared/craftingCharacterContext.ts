import type { CraftingComparison } from "./craftingComparison.js";
import type { CraftingGoalCategory, CraftingGoalSignal } from "./craftingGoal.js";
import {
  RESISTANCE_LABELS,
  RESISTANCE_LABELS_EN,
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
  lang: "es" | "en",
): Pick<CraftingCharacterContext, "requirementStatus" | "requirementLabel"> & {
  facts: string[];
  limitations: string[];
} {
  const en = lang === "en";
  const requirements = resultItem.requirements;
  if (!requirements || Object.keys(requirements).length === 0) {
    return {
      requirementStatus: "not-declared",
      requirementLabel: en ? "No requirements listed" : "Sin requisitos declarados",
      facts: [],
      limitations: [
        en
          ? "The resulting text doesn't list any requirements to check."
          : "El texto resultante no declara requisitos que comprobar.",
      ],
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
        en
          ? "The level requirement can't be checked because we don't know your character's level."
          : "No se puede comprobar el requisito de nivel porque no conocemos el nivel de tu personaje.",
      );
    } else if (reading.level < requirements.level) {
      missing.push(`${en ? "level" : "nivel"} ${reading.level}/${requirements.level}`);
    }
  }

  const attributes = [
    [en ? "Strength" : "Fuerza", requirements.str, profile.attributes.str],
    [en ? "Dexterity" : "Destreza", requirements.dex, profile.attributes.dex],
    [en ? "Intelligence" : "Inteligencia", requirements.int, profile.attributes.int],
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
    facts.push(en ? `Doesn't meet: ${missing.join(", ")}.` : `No cumple: ${missing.join(", ")}.`);
    return {
      requirementStatus: "unmet",
      requirementLabel: en ? "Requirements not met" : "Requisitos no cumplidos",
      facts,
      limitations,
    };
  }

  if (unknown.length > 0) {
    limitations.push(
      en
        ? attributeChanged
          ? "The craft changed attributes: your character's saved total still describes the previous item."
          : `These character attributes are missing: ${unknown.join(", ")}.`
        : attributeChanged
          ? "El craft cambió atributos: el total del personaje todavía describe el objeto anterior."
          : `Faltan estos atributos del personaje: ${unknown.join(", ")}.`,
    );
    return {
      requirementStatus: "unknown",
      requirementLabel: en ? "Requirements to confirm" : "No sé si cumples los requisitos",
      facts,
      limitations,
    };
  }

  if (levelUnknown) {
    return {
      requirementStatus: "unknown",
      requirementLabel: en ? "Character level unknown" : "Nivel del personaje desconocido",
      facts,
      limitations,
    };
  }

  facts.push(
    en
      ? "The known level and attributes meet the requirements shown."
      : "El nivel y los atributos conocidos cumplen los requisitos mostrados.",
  );
  return {
    requirementStatus: "met",
    requirementLabel: en ? "Requirements met" : "Requisitos cumplidos",
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
}, lang: "es" | "en" = "es"): CraftingCharacterContext {
  const en = lang === "en";
  const {
    profile,
    profileGoal,
    originalItem,
    resultItem,
    comparison,
    goalCategory,
    goalSignal,
  } = input;
  const requirements = requirementCheck(profile, resultItem, comparison, lang);
  const facts = [...requirements.facts];
  const limitations = [...requirements.limitations];
  const equipped =
    originalItem.slot !== "other" &&
    profile.items.some((item) => item.id === originalItem.id && item.slot === originalItem.slot);

  if (equipped) {
    facts.push(
      en
        ? "The result is an item linked to your current gear."
        : "El resultado corresponde a una pieza vinculada al equipo actual.",
    );
  } else {
    limitations.push(
      en
        ? "The item isn't linked to an equipped slot; it still needs comparing with what it would replace."
        : "La pieza no está vinculada a un hueco equipado; falta comparar el reemplazo real.",
    );
  }

  if (goalMatchesProfile(profileGoal, goalCategory)) {
    facts.push(
      en
        ? "The category you picked matches your character's overall goal."
        : "La categoría elegida coincide con el objetivo general del personaje.",
    );
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
      .map(
        (kind) =>
          `${(en ? RESISTANCE_LABELS_EN : RESISTANCE_LABELS)[kind]} ${profile.resistances[kind]}%`,
      );
    if (lowElemental.length > 0) {
      facts.push(
        en
          ? `Your character file has elemental resistances below ${LOW_ELEMENTAL_RESISTANCE}%: ${lowElemental.join(", ")}.`
          : `El personaje tiene resistencias elementales bajo ${LOW_ELEMENTAL_RESISTANCE}%: ${lowElemental.join(", ")}.`,
      );
    }
  }

  const protectionLabel = en
    ? comparison.protectionStatus === "lost"
      ? "Protection lost"
      : comparison.protectionStatus === "preserved"
        ? "Protections intact"
        : comparison.protectionStatus === "unverifiable"
          ? "Protection can't be checked"
          : "No protection set"
    : comparison.protectionStatus === "lost"
      ? "Protección perdida"
      : comparison.protectionStatus === "preserved"
        ? "Protecciones intactas"
        : comparison.protectionStatus === "unverifiable"
          ? "Protección no verificable"
          : "No protegiste ninguna línea";

  if (comparison.protectionStatus === "lost") {
    return {
      verdict: "stop",
      title: en ? "Stop: something protected was lost" : "Detente: se perdió algo protegido",
      summary: en
        ? "The craft happened, but it breaks a limit you set before spending. Check it before accepting the result."
        : "El craft ocurrió, pero contradice un límite que marcaste antes de gastar. Revísalo antes de aceptar el resultado.",
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
      title: en
        ? "Stop: the result doesn't meet the requirements"
        : "Detente: el resultado no cumple requisitos",
      summary: en
        ? "With the current data, your character can't use this item. Don't mark it as an upgrade until the shortfall is solved."
        : "Con los datos actuales, el personaje no puede usar esta pieza. No la marques como mejora sin resolver el déficit.",
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
      title: en
        ? "A candidate that fits what you wanted"
        : "Candidato coherente con lo que buscabas",
      summary: en
        ? "The tags point at your goal and there's no known block. You still have to judge how strong it is and how well it really fits."
        : "Las etiquetas apuntan al objetivo y no aparece un bloqueo conocido. Aún debes juzgar la magnitud y el encaje real.",
      requirementStatus: requirements.requirementStatus,
      requirementLabel: requirements.requirementLabel,
      protectionLabel,
      facts,
      limitations,
    };
  }

  limitations.push(
    en
      ? goalSignal?.status === "no-direct-signal"
        ? "The new tags show no direct link to the category you picked."
        : "There aren't enough tags to link the result to your goal."
      : goalSignal?.status === "no-direct-signal"
        ? "Las etiquetas nuevas no muestran una relación directa con la categoría elegida."
        : "No hay etiquetas suficientes para relacionar el resultado con el objetivo.",
  );
  return {
    verdict: "review",
    title: en ? "Not enough to judge it yet" : "No sé si esto le sirve a tu personaje",
    summary: en
      ? "The change is confirmed, but your character's data doesn't show it solves your goal. Decide by trying it in game."
      : "El cambio está hecho, pero con lo que sé de tu personaje no puedo decir que le arregle algo. Pruébala en el juego.",
    requirementStatus: requirements.requirementStatus,
    requirementLabel: requirements.requirementLabel,
    protectionLabel,
    facts,
    limitations,
  };
}
