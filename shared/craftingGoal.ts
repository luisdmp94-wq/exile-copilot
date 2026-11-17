import { z } from "zod";
import type { Modifier } from "./domain.js";

export const CraftingGoalCategorySchema = z.enum([
  "damage",
  "defence",
  "attributes",
  "speed",
  "skills",
  "other",
]);
export type CraftingGoalCategory = z.infer<typeof CraftingGoalCategorySchema>;

export const CRAFTING_GOAL_LABELS: Record<CraftingGoalCategory, string> = {
  damage: "Daño",
  defence: "Defensa o supervivencia",
  attributes: "Atributos o requisitos",
  speed: "Velocidad",
  skills: "Niveles o habilidades",
  other: "Otro objetivo",
};

export const CRAFTING_GOAL_LABELS_EN: Record<CraftingGoalCategory, string> = {
  damage: "Damage",
  defence: "Defence or survival",
  attributes: "Attributes or requirements",
  speed: "Speed",
  skills: "Levels or skills",
  other: "Something else",
};

/** Nombre de la categoría en el idioma pedido. */
export function craftingGoalLabel(
  category: CraftingGoalCategory,
  lang: "es" | "en" = "es",
): string {
  return (lang === "en" ? CRAFTING_GOAL_LABELS_EN : CRAFTING_GOAL_LABELS)[category];
}

const GOAL_TAGS: Record<Exclude<CraftingGoalCategory, "other">, Set<string>> = {
  damage: new Set([
    "damage",
    "daño",
    "physical",
    "físico",
    "elemental",
    "fire",
    "fuego",
    "cold",
    "hielo",
    "lightning",
    "rayo",
    "chaos",
    "caos",
    "critical",
    "crítico",
  ]),
  defence: new Set([
    "defence",
    "defences",
    "defensa",
    "defensas",
    "armour",
    "armadura",
    "evasion",
    "evasión",
    "energy shield",
    "escudo de energía",
    "life",
    "vida",
    "resistance",
    "resistencias",
  ]),
  attributes: new Set([
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
  ]),
  speed: new Set(["speed", "velocidad"]),
  skills: new Set([
    "skill",
    "skills",
    "habilidad",
    "habilidades",
    "gem",
    "gems",
    "gema",
    "gemas",
    "projectile",
    "projectiles",
    "proyectil",
    "proyectiles",
  ]),
};

function normalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

export type CraftingGoalSignalStatus = "direct" | "no-direct-signal" | "unknown";

export interface CraftingGoalSignal {
  status: CraftingGoalSignalStatus;
  title: string;
  summary: string;
  matchedTags: string[];
  observedTags: string[];
}

/**
 * Compara solo etiquetas literales presentes en el texto avanzado. No analiza
 * el nombre del afijo, no estima utilidad y no convierte ausencia en fracaso.
 */
export function evaluateCraftingGoalSignal(
  category: CraftingGoalCategory | undefined,
  addedModifiers: readonly Modifier[],
  lang: "es" | "en" = "es",
): CraftingGoalSignal {
  const en = lang === "en";
  const observedTags = [...new Set(
    addedModifiers.flatMap((modifier) => modifier.tags ?? []).map(normalizeTag),
  )];

  if (category === undefined || category === "other") {
    return {
      status: "unknown",
      title: en ? "No category to compare" : "Sin categoría comparable",
      summary: en
        ? "The goal was left open. The app keeps the result but does not try to classify it."
        : "El objetivo quedó como libre. La app conserva el resultado, pero no intenta clasificarlo.",
      matchedTags: [],
      observedTags,
    };
  }

  if (observedTags.length === 0) {
    return {
      status: "unknown",
      title: en ? "The tooltip has no tags to compare" : "El tooltip no aporta etiquetas comparables",
      summary: en
        ? "The change can't be linked directly to the goal. That doesn't mean the modifier is useless."
        : "No se puede relacionar directamente el cambio con el objetivo. Esto no significa que el modificador sea inútil.",
      matchedTags: [],
      observedTags: [],
    };
  }

  const allowed = GOAL_TAGS[category];
  const matchedTags = observedTags.filter((tag) => allowed.has(tag));
  if (matchedTags.length > 0) {
    return {
      status: "direct",
      title: en
        ? `Direct ${CRAFTING_GOAL_LABELS_EN[category].toLocaleLowerCase("en")} signal`
        : `Señal directa de ${CRAFTING_GOAL_LABELS[category].toLocaleLowerCase("es")}`,
      summary: en
        ? "The game's tags match the chosen category. You still need to decide if the size and real fit are worth the cost."
        : "Las etiquetas del cliente coinciden con la categoría elegida. Falta decidir si la magnitud y el encaje real compensan el coste.",
      matchedTags,
      observedTags,
    };
  }

  return {
    status: "no-direct-signal",
    title: en ? "No direct signal for the goal" : "No aparece una señal directa del objetivo",
    summary: en
      ? "The tags seen point to another category. There may be an indirect link with the build; the app doesn't rule it out."
      : "Las etiquetas observadas apuntan a otra categoría. Puede existir una interacción indirecta con la build; la app no la descarta.",
    matchedTags: [],
    observedTags,
  };
}
