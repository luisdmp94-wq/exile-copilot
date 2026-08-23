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
): CraftingGoalSignal {
  const observedTags = [...new Set(
    addedModifiers.flatMap((modifier) => modifier.tags ?? []).map(normalizeTag),
  )];

  if (category === undefined || category === "other") {
    return {
      status: "unknown",
      title: "Sin categoría comparable",
      summary:
        "El objetivo quedó como libre. La app conserva el resultado, pero no intenta clasificarlo.",
      matchedTags: [],
      observedTags,
    };
  }

  if (observedTags.length === 0) {
    return {
      status: "unknown",
      title: "El tooltip no aporta etiquetas comparables",
      summary:
        "No se puede relacionar directamente el cambio con el objetivo. Esto no significa que el modificador sea inútil.",
      matchedTags: [],
      observedTags: [],
    };
  }

  const allowed = GOAL_TAGS[category];
  const matchedTags = observedTags.filter((tag) => allowed.has(tag));
  if (matchedTags.length > 0) {
    return {
      status: "direct",
      title: `Señal directa de ${CRAFTING_GOAL_LABELS[category].toLocaleLowerCase("es")}`,
      summary:
        "Las etiquetas del cliente coinciden con la categoría elegida. Falta decidir si la magnitud y el encaje real compensan el coste.",
      matchedTags,
      observedTags,
    };
  }

  return {
    status: "no-direct-signal",
    title: "No aparece una señal directa del objetivo",
    summary:
      "Las etiquetas observadas apuntan a otra categoría. Puede existir una interacción indirecta con la build; la app no la descarta.",
    matchedTags: [],
    observedTags,
  };
}
