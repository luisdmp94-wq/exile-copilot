import type { Modifier } from "./domain.js";

export type ObservedRollBand = "low" | "middle" | "high" | "fixed" | "unknown";

export interface ObservedModifierRollQuality {
  band: ObservedRollBand;
  positionPercent: number | null;
  observedCount: number;
  label: string;
  detail: string;
}

const NUMBER = "-?\\d+(?:[.,]\\d+)?";
const OBSERVED_RANGE_RE = new RegExp(
  `(${NUMBER})\\s*\\(\\s*(${NUMBER})\\s*-\\s*(${NUMBER})\\s*\\)`,
  "g",
);

function numberFromGameText(value: string): number {
  return Number(value.replace(",", "."));
}

/** Extrae solo los rangos declarados por el texto avanzado del juego. */
export function extractObservedModifierRolls(
  text: string,
): NonNullable<Modifier["observedRolls"]> {
  const rolls: NonNullable<Modifier["observedRolls"]> = [];
  for (const match of text.matchAll(OBSERVED_RANGE_RE)) {
    const value = numberFromGameText(match[1] ?? "0");
    const first = numberFromGameText(match[2] ?? "0");
    const second = numberFromGameText(match[3] ?? "0");
    if (![value, first, second].every(Number.isFinite)) continue;
    rolls.push({ value, min: Math.min(first, second), max: Math.max(first, second) });
  }
  return rolls;
}

/**
 * Sitúa la tirada dentro de los rangos visibles. El porcentaje resultante no
 * es probabilidad, DPS ni percentil dentro del pool global.
 */
export function assessObservedModifierRoll(
  modifier: Pick<Modifier, "text" | "observedRolls">,
): ObservedModifierRollQuality {
  const rolls = modifier.observedRolls ?? extractObservedModifierRolls(modifier.text);
  if (rolls.length === 0) {
    return {
      band: "unknown",
      positionPercent: null,
      observedCount: 0,
      label: "Rango no visible",
      detail: "El texto no muestra un rango numérico comparable para esta línea.",
    };
  }

  const variable = rolls.filter((roll) => roll.max > roll.min);
  if (variable.length === 0) {
    return {
      band: "fixed",
      positionPercent: null,
      observedCount: rolls.length,
      label: "Valor fijo",
      detail: "Los valores observados no varían dentro del rango mostrado.",
    };
  }

  const average = variable.reduce((sum, roll) => {
    const position = (roll.value - roll.min) / (roll.max - roll.min);
    return sum + Math.max(0, Math.min(1, position));
  }, 0) / variable.length;
  const positionPercent = Math.round(average * 100);
  const band: ObservedRollBand =
    positionPercent >= 75 ? "high" : positionPercent >= 35 ? "middle" : "low";
  const label =
    band === "high"
      ? `Tirada alta · ${positionPercent}% del rango`
      : band === "middle"
        ? `Tirada media · ${positionPercent}% del rango`
        : `Tirada baja · ${positionPercent}% del rango`;

  return {
    band,
    positionPercent,
    observedCount: rolls.length,
    label,
    detail: `Posición media de los valores variables dentro de los rangos impresos: ${positionPercent}%.`,
  };
}
