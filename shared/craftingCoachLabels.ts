/**
 * Rótulos del guía de Crafting, sin nada del motor.
 *
 * Viven aparte para que la mascota y la portada puedan nombrar una dirección
 * o una tirada sin descargar `craftingCoach.ts` entero. Ese archivo los
 * vuelve a exportar: quien ya los importaba de allí no cambia.
 */
import type { CoachDirection, CoachRollMinimum } from "./craftingCoach.js";

/** Con artículo: «Buscas mejorar el daño». */
export const COACH_DIRECTION_LABELS: Record<CoachDirection, string> = {
  damage: "el daño",
  defence: "la defensa",
};

/** Sin artículo: «etiquetas de daño». */
export const COACH_DIRECTION_NOUNS: Record<CoachDirection, string> = {
  damage: "daño",
  defence: "defensa",
};

/** Versión inglesa de `COACH_DIRECTION_LABELS` («You want to improve damage»). */
export const COACH_DIRECTION_LABELS_EN: Record<CoachDirection, string> = {
  damage: "damage",
  defence: "defence",
};

/** Versión inglesa de `COACH_DIRECTION_NOUNS` («damage tags»). */
export const COACH_DIRECTION_NOUNS_EN: Record<CoachDirection, string> = {
  damage: "damage",
  defence: "defence",
};

export function coachDirectionLabel(direction: CoachDirection, lang: "es" | "en" = "es"): string {
  return (lang === "en" ? COACH_DIRECTION_LABELS_EN : COACH_DIRECTION_LABELS)[direction];
}

export const COACH_ROLL_MINIMUM_LABELS: Record<CoachRollMinimum, string> = {
  any: "cualquier tirada",
  middle: "tirada media o alta",
  high: "tirada alta",
};

export const COACH_ROLL_MINIMUM_LABELS_EN: Record<CoachRollMinimum, string> = {
  any: "any roll",
  middle: "a middle or high roll",
  high: "a high roll",
};

export function coachRollMinimumLabel(minimum: CoachRollMinimum, lang: "es" | "en" = "es"): string {
  return (lang === "en" ? COACH_ROLL_MINIMUM_LABELS_EN : COACH_ROLL_MINIMUM_LABELS)[minimum];
}
