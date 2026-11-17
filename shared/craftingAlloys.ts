import { z } from "zod";
import type { Item } from "./domain.js";
import type { CraftingObjective } from "./craftingProtection.js";

export const AlloyRemovalSelectionSchema = z.enum([
  "random",
  "player-selected",
  "unspecified",
]);
export type AlloyRemovalSelection = z.infer<typeof AlloyRemovalSelectionSchema>;

export const ALLOY_REMOVAL_LABELS: Record<AlloyRemovalSelection, string> = {
  random: "El tooltip declara una retirada aleatoria",
  "player-selected": "El tooltip permite elegir qué se reemplaza",
  unspecified: "El tooltip no aclara cómo se elige",
};

export const ALLOY_REMOVAL_LABELS_EN: Record<AlloyRemovalSelection, string> = {
  random: "The tooltip says the removal is random",
  "player-selected": "The tooltip lets you choose what is replaced",
  unspecified: "The tooltip doesn't say how it's chosen",
};

export const AlloyPlanInputSchema = z.object({
  alloyName: z.string().trim().max(120),
  fullTooltipText: z.string().trim().max(2000),
  guaranteedModifierText: z.string().trim().max(500),
  declaredItemClasses: z.array(z.string().trim().min(1).max(120)).max(30),
  playerConfirmedClassApplies: z.boolean(),
  removalSelection: AlloyRemovalSelectionSchema,
});
export type AlloyPlanInput = z.infer<typeof AlloyPlanInputSchema>;

export type AlloyEvaluationStatus = "compatible" | "blocked" | "needs-data";

export interface AlloyEvaluation {
  status: AlloyEvaluationStatus;
  reason: string;
  resultRarity: Item["rarity"];
  expectedRemovedModifierCount: 1;
  expectedAddedCrafted: true;
  maximumCraftedModifierCount: 1;
  irreversible: true;
}

export type StartAlloyDecision = (
  item: Item,
  plan: AlloyPlanInput,
  evaluation: AlloyEvaluation,
  objective: CraftingObjective,
) => Promise<boolean>;

export const ALLOY_MECHANIC_SOURCE = {
  title: "Content Update 0.5.0 — Path of Exile 2: Return of the Ancients",
  url: "https://www.pathofexile.com/forum/view-thread/3932540/filter-account-type/staff",
  patch: "0.5.0",
  lastMechanicChange: "0.5.3",
  leagueScope: "Runes of Aldur",
  declaredTotalCount: 13,
  verifiedAt: "2026-08-23",
} as const;

export const ALLOY_CLASS_RESTRICTION_SOURCES = [
  {
    patch: "0.5.2",
    url: "https://www.pathofexile.com/forum/view-thread/3960375",
    fact: "Transcendent Alloy dejó de poder aplicarse a Foci y Varas.",
  },
  {
    patch: "0.5.3",
    url: "https://www.pathofexile.com/forum/view-thread/3968601",
    fact: "Transcendent Alloy volvió a admitir Foci y Varas con valores inferiores.",
  },
] as const;

export const ALLOY_RESULT_UNKNOWN_LABEL =
  "Falta comprobar qué modificador reemplazó el Alloy y qué crafted modifier añadió.";
export const ALLOY_RESULT_UNKNOWN_LABEL_EN =
  "Still need to check which modifier the Alloy replaced and which crafted modifier it added.";

function result(
  item: Item,
  status: AlloyEvaluationStatus,
  reason: string,
): AlloyEvaluation {
  return {
    status,
    reason,
    resultRarity: item.rarity,
    expectedRemovedModifierCount: 1,
    expectedAddedCrafted: true,
    maximumCraftedModifierCount: 1,
    irreversible: true,
  };
}

/**
 * Preflight conservador de Alloys.
 *
 * GGG documenta el reemplazo y la naturaleza crafted del resultado, pero no
 * publica en las notas la matriz completa Alloy × tipo de objeto ni cómo se
 * elige la retirada. Esos datos deben proceder del tooltip que ve el jugador.
 */
export function evaluateAlloyPlan(
  item: Item,
  input: AlloyPlanInput,
  lang: "es" | "en" = "es",
): AlloyEvaluation {
  const plan = AlloyPlanInputSchema.parse(input);
  const state = item.craftingState;
  const t = (es: string, en: string): string => (lang === "en" ? en : es);

  if (state === undefined) {
    return result(
      item,
      "needs-data",
      t(
        "El texto no confirma los estados especiales del objeto; vuelve a copiarlo con Ctrl+Alt+C.",
        "The text doesn't confirm the item's special states; copy it again with Ctrl+Alt+C.",
      ),
    );
  }
  if (state.doubleCorrupted || state.corrupted) {
    return result(
      item,
      "blocked",
      state.doubleCorrupted
        ? t("El objeto tiene doble corrupción.", "The item is double corrupted.")
        : t("El objeto está corrupto.", "The item is corrupted."),
    );
  }
  if (state.mirrored) return result(item, "blocked", t("El objeto está reflejado.", "The item is mirrored."));
  if (state.sanctified) return result(item, "blocked", t("El objeto está santificado.", "The item is sanctified."));
  if (state.unmodifiable || state.unmodifiableExceptChaos) {
    return result(
      item,
      "blocked",
      state.unmodifiableExceptChaos
        ? t(
            "El objeto solo admite acciones de caos; un Alloy no se ha verificado como tal.",
            "The item only accepts chaos actions; an Alloy hasn't been confirmed as one.",
          )
        : t("El objeto declara que no puede modificarse.", "The item says it can't be modified."),
    );
  }
  if (state.mutated || state.desecrated || state.fractured || state.split || state.unidentified) {
    return result(
      item,
      "needs-data",
      t(
        "El objeto tiene un estado especial cuya interacción con Alloys todavía no está verificada.",
        "The item has a special state whose interaction with Alloys isn't confirmed yet.",
      ),
    );
  }

  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  if (explicit.length === 0) {
    return result(
      item,
      "needs-data",
      t(
        "No se detecta un modificador explícito que pueda ser reemplazado.",
        "No explicit modifier was found that could be replaced.",
      ),
    );
  }
  const crafted = explicit.filter((modifier) => modifier.crafted);
  if (crafted.length > 0) {
    return result(
      item,
      "blocked",
      t(
        "El objeto ya contiene un crafted modifier. GGG limita los objetos a uno y no se ha verificado que este Alloy sustituya precisamente ese crafted modifier.",
        "The item already has a crafted modifier. GGG limits items to one, and it isn't confirmed that this Alloy replaces that exact crafted modifier.",
      ),
    );
  }
  if (
    explicit.some(
      (modifier) => modifier.fractured || modifier.mutated || modifier.desecrated,
    )
  ) {
    return result(
      item,
      "needs-data",
      t(
        "Hay modificadores fractured, mutated o desecrated y no se ha verificado si pueden entrar en el reemplazo.",
        "There are fractured, mutated or desecrated modifiers, and it isn't confirmed whether they can be replaced.",
      ),
    );
  }
  if (explicit.some((modifier) => modifier.affix === undefined)) {
    return result(
      item,
      "needs-data",
      t(
        "Necesito el texto copiado con Ctrl+Alt+C para clasificar todos los modificadores explícitos antes del reemplazo.",
        "I need the text copied with Ctrl+Alt+C to sort every explicit modifier before the replacement.",
      ),
    );
  }

  if (
    plan.alloyName.length < 3 ||
    plan.fullTooltipText.length < 10 ||
    plan.guaranteedModifierText.length < 3 ||
    plan.declaredItemClasses.length === 0
  ) {
    return result(
      item,
      "needs-data",
      t(
        "Copia el tooltip completo y registra literalmente las clases admitidas y el modificador fabricado garantizado.",
        "Copy the full tooltip and write down, word for word, the item classes it accepts and the guaranteed crafted modifier.",
      ),
    );
  }
  if (!plan.playerConfirmedClassApplies) {
    return result(
      item,
      "needs-data",
      t(
        "Confirma que una de las clases escritas en el tooltip corresponde a la pieza seleccionada. Las restricciones de Alloys han cambiado entre parches y no se pueden deducir por el nombre.",
        "Confirm that one of the classes written in the tooltip matches the selected item. Alloy restrictions have changed between patches and can't be guessed from the name.",
      ),
    );
  }

  return result(
    item,
    "compatible",
    plan.removalSelection === "random"
      ? t(
          `La evidencia declarada encaja, pero cualquiera de los ${explicit.length} modificadores explícitos actuales puede ser reemplazado.`,
          `The evidence you entered fits, but any of the ${explicit.length} current explicit modifiers can be replaced.`,
        )
      : plan.removalSelection === "player-selected"
        ? t(
            "La evidencia declarada encaja y el tooltip indica que el jugador elige el modificador reemplazado; la selección final sigue perteneciendo al juego.",
            "The evidence you entered fits and the tooltip says you choose the replaced modifier; the final pick still happens in the game.",
          )
        : t(
            "La evidencia declarada encaja. GGG confirma que se reemplaza un modificador, pero no está verificado cómo se elige; la sesión conservará esa incógnita.",
            "The evidence you entered fits. GGG confirms one modifier is replaced, but how it's chosen isn't confirmed; the session will keep that unknown.",
          ),
  );
}
