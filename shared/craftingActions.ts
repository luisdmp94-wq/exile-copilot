import { z } from "zod";
import type { Item } from "./domain.js";
import type { CraftingObjective } from "./craftingProtection.js";

export const CraftingActionIdSchema = z.enum([
  "transmutation",
  "augmentation",
  "regal",
  "exalted",
]);
export type CraftingActionId = z.infer<typeof CraftingActionIdSchema>;
export type CraftingActionStatus = "compatible" | "blocked" | "needs-data";

export const CraftingCurrencyVariantSchema = z.object({
  id: z.enum(["base", "greater", "perfect"]),
  label: z.string().min(1),
  /** null significa «el tooltip observado no muestra un mínimo», no nivel 0. */
  minimumModifierLevel: z.number().int().positive().nullable(),
});
export type CraftingCurrencyVariant = z.infer<typeof CraftingCurrencyVariantSchema>;

export const ObservedCraftingActionSchema = z.object({
  id: CraftingActionIdSchema,
  label: z.string().min(1),
  targetRarity: z.enum(["normal", "magic", "rare"]),
  effect: z.string().min(1),
  observedTotalLimit: z.number().int().positive().nullable(),
  variants: z.array(CraftingCurrencyVariantSchema).min(1),
  evidence: z.string().min(1),
});
export type ObservedCraftingAction = z.infer<typeof ObservedCraftingActionSchema>;

export interface CraftingActionEvaluation {
  action: ObservedCraftingAction;
  status: CraftingActionStatus;
  reason: string;
}

export type StartCraftingDecision = (
  item: Item,
  action: ObservedCraftingAction,
  variant: CraftingCurrencyVariant,
  objective: CraftingObjective,
) => Promise<boolean>;

/** Nombre exacto y legible de la moneda elegida, sin inventar nombres internos. */
export function craftingCurrencyLabel(
  action: ObservedCraftingAction,
  variant: CraftingCurrencyVariant,
): string {
  return variant.id === "base"
    ? action.label
    : `${action.label} ${variant.label.toLocaleLowerCase("es")}`;
}

/** Catálogo limitado estrictamente a los tooltips aportados por el usuario. */
export const OBSERVED_CRAFTING_ACTIONS: readonly ObservedCraftingAction[] = [
  {
    id: "transmutation",
    label: "Orbe de transmutación",
    targetRarity: "normal",
    effect: "Convierte un objeto normal en mágico y le otorga 1 modificador.",
    observedTotalLimit: null,
    variants: [
      { id: "base", label: "Base", minimumModifierLevel: null },
      { id: "greater", label: "Superior", minimumModifierLevel: 44 },
      { id: "perfect", label: "Perfecto", minimumModifierLevel: 70 },
    ],
    evidence: "Tooltip observado: 01-transmutation-variants.jpg (22/08/2026).",
  },
  {
    id: "augmentation",
    label: "Orbe de aumento",
    targetRarity: "magic",
    effect: "Añade 1 modificador aleatorio a un objeto mágico.",
    observedTotalLimit: 2,
    variants: [
      { id: "base", label: "Base", minimumModifierLevel: null },
      { id: "greater", label: "Superior", minimumModifierLevel: 44 },
      { id: "perfect", label: "Perfecto", minimumModifierLevel: 70 },
    ],
    evidence: "Tooltip observado: 02-augmentation-variants.jpg (22/08/2026).",
  },
  {
    id: "regal",
    label: "Orbe regio",
    targetRarity: "magic",
    effect: "Convierte un objeto mágico en raro, conserva sus modificadores y añade 1.",
    observedTotalLimit: null,
    variants: [
      { id: "base", label: "Base", minimumModifierLevel: null },
      { id: "greater", label: "Superior", minimumModifierLevel: 35 },
    ],
    evidence: "Tooltip observado: 03-regal-variants.jpg (22/08/2026).",
  },
  {
    id: "exalted",
    label: "Orbe exaltado",
    targetRarity: "rare",
    effect: "Añade 1 modificador aleatorio a un objeto raro.",
    observedTotalLimit: 6,
    variants: [
      { id: "base", label: "Base", minimumModifierLevel: null },
      { id: "greater", label: "Superior", minimumModifierLevel: 35 },
    ],
    evidence: "Tooltip observado: 04-exalted-variants.jpg (22/08/2026).",
  },
] as const;

function result(
  action: ObservedCraftingAction,
  status: CraftingActionStatus,
  reason: string,
): CraftingActionEvaluation {
  return { action, status, reason };
}

export function evaluateObservedCraftingActions(
  item: Item,
  actions: readonly ObservedCraftingAction[] = OBSERVED_CRAFTING_ACTIONS,
): CraftingActionEvaluation[] {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const unclassified = explicit.filter((modifier) => modifier.affix === undefined).length;

  return actions.map((action) => {
    if (item.rarity !== action.targetRarity) {
      return result(
        action,
        "blocked",
        `Requiere un objeto ${action.targetRarity === "normal" ? "normal" : action.targetRarity === "magic" ? "mágico" : "raro"}.`,
      );
    }

    const state = item.craftingState;
    if (state === undefined) {
      return result(
        action,
        "needs-data",
        "La procedencia del objeto no confirma corrupción, reflejado, división ni identificación.",
      );
    }
    if (state.corrupted) {
      return result(
        action,
        "blocked",
        state.doubleCorrupted
          ? "El texto copiado declara que el objeto tiene doble corrupción."
          : "El texto copiado declara que el objeto está corrupto.",
      );
    }
    if (state.mirrored) {
      return result(action, "blocked", "El texto copiado declara que el objeto está reflejado.");
    }
    if (state.sanctified) {
      return result(action, "blocked", "El texto copiado declara que el objeto está santificado.");
    }
    if (state.unmodifiable || state.unmodifiableExceptChaos) {
      return result(
        action,
        "blocked",
        state.unmodifiableExceptChaos
          ? "El objeto declara que solo puede modificarse mediante una acción de caos; esta moneda no lo es."
          : "El texto copiado declara que el objeto no puede modificarse.",
      );
    }
    if (state.mutated || state.desecrated) {
      const specialStates = [
        state.mutated ? "mutado" : null,
        state.desecrated ? "profanado" : null,
      ].filter((value): value is string => value !== null);
      return result(
        action,
        "needs-data",
        `No se ha verificado la interacción de esta moneda con un objeto ${specialStates.join(" y ")}.`,
      );
    }
    if (state.split || state.unidentified) {
      const unknownStates = [
        state.split ? "dividido" : null,
        state.unidentified ? "sin identificar" : null,
      ].filter((value): value is string => value !== null);
      return result(
        action,
        "needs-data",
        `No se ha verificado la interacción con un objeto ${unknownStates.join(" y ")}.`,
      );
    }

    if (action.id === "transmutation") {
      if (explicit.length > 0) {
        return result(
          action,
          "needs-data",
          "El objeto figura como normal pero contiene modificadores explícitos; hay una inconsistencia que revisar.",
        );
      }
      return result(
        action,
        "compatible",
        "La rareza encaja y el texto importado no contiene un bloqueo conocido para esta acción observada.",
      );
    }

    if (explicit.length === 0 || unclassified > 0) {
      return result(
        action,
        "needs-data",
        explicit.length === 0
          ? "No hay modificadores explícitos registrados."
          : `${unclassified} modificador${unclassified === 1 ? "" : "es"} sin clasificar como prefijo o sufijo.`,
      );
    }

    if (
      action.observedTotalLimit !== null &&
      explicit.length >= action.observedTotalLimit
    ) {
      return result(
        action,
        "blocked",
        `Ya tiene ${explicit.length} modificadores explícitos; el límite total observado es ${action.observedTotalLimit}.`,
      );
    }

    return result(
      action,
      "compatible",
      "La rareza y el hueco total encajan; el texto importado no contiene un bloqueo conocido.",
    );
  });
}
