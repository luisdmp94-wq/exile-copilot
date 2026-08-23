import type { Item } from "./domain.js";

/**
 * Lectura estructural de un objeto para crafting.
 *
 * No calcula pesos, probabilidades, costes ni resultados posibles. Solo
 * resume datos presentes en el objeto y aplica los límites TOTALES observados
 * en los tooltips aportados por el usuario (mágico: 2; raro: 6).
 */
export interface CraftingItemDiagnosis {
  state: "complete" | "partial" | "blocked";
  label: string;
  summary: string;
  prefixCount: number;
  suffixCount: number;
  unclassifiedExplicitCount: number;
  explicitCount: number;
  auxiliaryCount: number;
  observedTotalLimit: number | null;
  observedOpenSlots: number | null;
  blockers: string[];
  limitations: string[];
  nextAction: string;
}

const OBSERVED_TOTAL_AFFIX_LIMIT: Partial<Record<Item["rarity"], number>> = {
  magic: 2,
  rare: 6,
};

export function diagnoseCraftingItem(item: Item): CraftingItemDiagnosis {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const prefixCount = explicit.filter((modifier) => modifier.affix === "prefix").length;
  const suffixCount = explicit.filter((modifier) => modifier.affix === "suffix").length;
  const unclassifiedExplicitCount = explicit.length - prefixCount - suffixCount;
  const observedTotalLimit = OBSERVED_TOTAL_AFFIX_LIMIT[item.rarity] ?? null;
  const observedOpenSlots =
    observedTotalLimit === null ? null : Math.max(0, observedTotalLimit - explicit.length);
  const blockers: string[] = [];
  const itemState = item.craftingState;

  if (itemState?.doubleCorrupted || itemState?.corrupted) {
    blockers.push(itemState.doubleCorrupted ? "El objeto tiene doble corrupción." : "El objeto está corrupto.");
  }
  if (itemState?.mirrored) blockers.push("El objeto está reflejado.");
  if (itemState?.sanctified) blockers.push("El objeto está santificado.");
  if (itemState?.unmodifiable || itemState?.unmodifiableExceptChaos) {
    blockers.push(
      itemState.unmodifiableExceptChaos
        ? "El objeto solo admite modificaciones mediante acciones de caos."
        : "El objeto declara que no puede modificarse.",
    );
  }
  if (itemState?.mutated || itemState?.desecrated) {
    blockers.push("El objeto tiene un estado especial cuya interacción todavía no está verificada.");
  }

  if (observedTotalLimit === null) {
    blockers.push("La lectura inicial solo cubre objetos mágicos y raros.");
  }
  if (item.itemLevel === undefined) {
    blockers.push("Falta el nivel de objeto.");
  }
  if (explicit.length === 0) {
    blockers.push("No hay modificadores explícitos registrados.");
  } else if (unclassifiedExplicitCount > 0) {
    blockers.push(
      `${unclassifiedExplicitCount} modificador${unclassifiedExplicitCount === 1 ? "" : "es"} ` +
        `explícito${unclassifiedExplicitCount === 1 ? "" : "s"} sin clasificar como prefijo o sufijo.`,
    );
  }

  const legalStateBlocked = Boolean(
    itemState?.corrupted ||
      itemState?.mirrored ||
      itemState?.sanctified ||
      itemState?.unmodifiable ||
      itemState?.unmodifiableExceptChaos,
  );
  const hardBlocked =
    legalStateBlocked ||
    observedTotalLimit === null ||
    item.itemLevel === undefined ||
    explicit.length === 0;
  const state: CraftingItemDiagnosis["state"] = hardBlocked
    ? "blocked"
    : unclassifiedExplicitCount > 0
      ? "partial"
      : "complete";
  const structure = `${prefixCount} prefijo${prefixCount === 1 ? "" : "s"} y ` +
    `${suffixCount} sufijo${suffixCount === 1 ? "" : "s"}`;

  let summary: string;
  if (state === "complete" && observedOpenSlots !== null) {
    summary =
      observedOpenSlots === 0
        ? `Se distinguen ${structure}. No quedan huecos totales según el límite observado.`
        : `Se distinguen ${structure}. Queda${observedOpenSlots === 1 ? "" : "n"} ` +
          `${observedOpenSlots} hueco${observedOpenSlots === 1 ? "" : "s"} total${observedOpenSlots === 1 ? "" : "es"} ` +
          `según el límite observado.`;
  } else if (explicit.length > 0) {
    summary = `Se leen ${explicit.length} modificadores explícitos, pero la estructura no está completa.`;
  } else {
    summary = "Todavía no hay datos suficientes para leer la estructura de crafting.";
  }

  let nextAction: string;
  if (item.itemLevel === undefined || unclassifiedExplicitCount > 0) {
    nextAction = "Activa las descripciones avanzadas del juego y vuelve a copiar el objeto.";
  } else if (explicit.length === 0) {
    nextAction = "Importa el texto completo del objeto antes de evaluar una moneda.";
  } else if (state === "complete" && observedOpenSlots === 0) {
    nextAction = "El asesor debe bloquear acciones que añadan otro modificador hasta verificar una vía legal.";
  } else if (state === "complete") {
    nextAction = "Indica qué resultado buscas; después se comprobará qué acciones son legales y seguras.";
  } else {
    nextAction = "Completa los datos señalados antes de elegir una moneda.";
  }

  return {
    state,
    label:
      state === "complete"
        ? "Estructura lista"
        : state === "partial"
          ? "Lectura parcial"
          : "Diagnóstico bloqueado",
    summary,
    prefixCount,
    suffixCount,
    unclassifiedExplicitCount,
    explicitCount: explicit.length,
    auxiliaryCount: item.modifiers.length - explicit.length,
    observedTotalLimit,
    observedOpenSlots,
    blockers,
    limitations: [
      "Un hueco libre no garantiza que una moneda concreta pueda o deba usarse.",
      "No se muestran probabilidades, pesos ni costes porque todavía no están verificados.",
      "Los límites totales proceden de evidencia local observada el 22/08/2026 y pueden cambiar con un parche.",
    ],
    nextAction,
  };
}
