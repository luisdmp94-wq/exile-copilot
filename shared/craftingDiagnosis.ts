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

const REDUCED_SUFFIX_CAPACITY_RE =
  /^-1\s+(?:(?:maximum|max(?:imum)?)\s+)?(?:(?:suffix|sufijo)\s+)?(?:modifier|modificador)(?:es|s)?(?:\s+(?:de\s+)?(?:suffix|sufijo))?\s+(?:allowed|permitidos?)$/iu;

/**
 * Ajusta el límite total solo cuando el propio tooltip declara la reducción.
 * En la base observada, perder un sufijo reduce de 2 a 1 el máximo mágico y de
 * 6 a 5 el máximo raro. No se infiere esta regla por el nombre del objeto.
 */
export function observedTotalAffixLimit(
  item: Item,
  defaultLimit: number | null,
): number | null {
  if (defaultLimit === null) return null;
  const losesOneSuffix = item.modifiers.some(
    (modifier) =>
      modifier.kind === "implicit" && REDUCED_SUFFIX_CAPACITY_RE.test(modifier.text.trim()),
  );
  return losesOneSuffix ? Math.max(0, defaultLimit - 1) : defaultLimit;
}

const SUPPORTED_CRAFTING_RARITIES = new Set<Item["rarity"]>([
  "normal",
  "magic",
  "rare",
]);

/** Detecta snapshots imposibles sin deducir ningún afijo ausente. */
export function hasContradictoryAffixStructure(item: Item): boolean {
  const explicitCount = item.modifiers.filter(
    (modifier) => modifier.kind === "explicit",
  ).length;
  return (
    (item.rarity === "normal" && explicitCount > 0) ||
    ((item.rarity === "magic" || item.rarity === "rare") && explicitCount === 0)
  );
}

export function diagnoseCraftingItem(
  item: Item,
  lang: "es" | "en" = "es",
): CraftingItemDiagnosis {
  const t = (es: string, en: string): string => (lang === "en" ? en : es);
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const prefixCount = explicit.filter((modifier) => modifier.affix === "prefix").length;
  const suffixCount = explicit.filter((modifier) => modifier.affix === "suffix").length;
  const unclassifiedExplicitCount = explicit.length - prefixCount - suffixCount;
  const observedTotalLimit = observedTotalAffixLimit(
    item,
    OBSERVED_TOTAL_AFFIX_LIMIT[item.rarity] ?? null,
  );
  const observedOpenSlots =
    observedTotalLimit === null ? null : Math.max(0, observedTotalLimit - explicit.length);
  const blockers: string[] = [];
  const itemState = item.craftingState;

  if (itemState === undefined) {
    blockers.push(
      t(
        "El texto no confirma todavía los estados especiales que pueden impedir el crafting.",
        "The copied text doesn't confirm yet whether a special state blocks crafting.",
      ),
    );
  }

  if (itemState?.doubleCorrupted || itemState?.corrupted) {
    blockers.push(
      itemState.doubleCorrupted
        ? t("El objeto tiene doble corrupción.", "The item is double corrupted.")
        : t("El objeto está corrupto.", "The item is corrupted."),
    );
  }
  if (itemState?.mirrored) blockers.push(t("El objeto está reflejado.", "The item is mirrored."));
  if (itemState?.sanctified) blockers.push(t("El objeto está santificado.", "The item is sanctified."));
  if (itemState?.unmodifiable || itemState?.unmodifiableExceptChaos) {
    blockers.push(
      itemState.unmodifiableExceptChaos
        ? t(
            "El objeto solo admite modificaciones mediante acciones de caos.",
            "The item can only be changed with Chaos actions.",
          )
        : t("El objeto declara que no puede modificarse.", "The item says it can't be modified."),
    );
  }
  const hasSpecialModifier = explicit.some(
    (modifier) => modifier.fractured || modifier.mutated || modifier.desecrated,
  );
  if (itemState?.mutated || itemState?.desecrated || itemState?.fractured || hasSpecialModifier) {
    blockers.push(
      t(
        "El objeto tiene un estado especial cuya interacción todavía no está verificada.",
        "The item has a special state whose interaction isn't verified yet.",
      ),
    );
  }
  if (itemState?.split || itemState?.unidentified) {
    blockers.push(
      itemState.split && itemState.unidentified
        ? t(
            "El objeto está dividido y sin identificar; su interacción todavía no está verificada.",
            "The item is split and unidentified; its interaction isn't verified yet.",
          )
        : itemState.split
          ? t(
              "El objeto está dividido; su interacción todavía no está verificada.",
              "The item is split; its interaction isn't verified yet.",
            )
          : t(
              "El objeto está sin identificar; su interacción todavía no está verificada.",
              "The item is unidentified; its interaction isn't verified yet.",
            ),
    );
  }

  if (!SUPPORTED_CRAFTING_RARITIES.has(item.rarity)) {
    blockers.push(
      t(
        "La lectura inicial solo cubre objetos normales, mágicos y raros.",
        "The first reading only covers normal, magic and rare items.",
      ),
    );
  }
  if (item.itemLevel === undefined) {
    blockers.push(t("Falta el nivel de objeto.", "Item level is missing."));
  }
  if (item.rarity !== "normal" && explicit.length === 0) {
    blockers.push(t("No hay modificadores explícitos registrados.", "No explicit mods were found."));
  } else if (item.rarity === "normal" && explicit.length > 0) {
    blockers.push(
      t(
        "El objeto figura como normal, pero contiene modificadores explícitos; hay una inconsistencia que revisar.",
        "The item shows as normal but has explicit modifiers; something doesn't add up.",
      ),
    );
  } else if (unclassifiedExplicitCount > 0) {
    blockers.push(
      lang === "en"
        ? `${unclassifiedExplicitCount} explicit mod${unclassifiedExplicitCount === 1 ? "" : "s"} ` +
            "not classified as prefix or suffix."
        : `${unclassifiedExplicitCount} modificador${unclassifiedExplicitCount === 1 ? "" : "es"} ` +
            `explícito${unclassifiedExplicitCount === 1 ? "" : "s"} sin clasificar como prefijo o sufijo.`,
    );
    for (const modifier of explicit.filter((candidate) => candidate.affix === undefined)) {
      blockers.push(
        lang === "en"
          ? `Unclassified line: "${modifier.text}".`
          : `Línea sin clasificar: «${modifier.text}».`,
      );
    }
  }

  const legalStateBlocked = Boolean(
    itemState?.corrupted ||
      itemState?.mirrored ||
      itemState?.sanctified ||
      itemState?.unmodifiable ||
      itemState?.unmodifiableExceptChaos,
  );
  const specialStateNeedsData = Boolean(
    itemState === undefined ||
      itemState.split ||
      itemState.unidentified ||
      itemState.mutated ||
      itemState.desecrated ||
      itemState.fractured ||
      hasSpecialModifier,
  );
  const structureInconsistent =
    (item.rarity === "normal" && explicit.length > 0) ||
    (item.rarity !== "normal" && explicit.length === 0);
  const hardBlocked =
    legalStateBlocked ||
    !SUPPORTED_CRAFTING_RARITIES.has(item.rarity) ||
    item.itemLevel === undefined ||
    structureInconsistent;
  const state: CraftingItemDiagnosis["state"] = hardBlocked
    ? "blocked"
    : specialStateNeedsData || unclassifiedExplicitCount > 0
      ? "partial"
      : "complete";
  const structure =
    lang === "en"
      ? `${prefixCount} prefix${prefixCount === 1 ? "" : "es"} and ` +
        `${suffixCount} suffix${suffixCount === 1 ? "" : "es"}`
      : `${prefixCount} prefijo${prefixCount === 1 ? "" : "s"} y ` +
        `${suffixCount} sufijo${suffixCount === 1 ? "" : "s"}`;

  let summary: string;
  if (state === "complete" && item.rarity === "normal") {
    summary = t(
      "Objeto normal sin modificadores explícitos. Su estructura permite evaluar una Transmutación sin atribuirle todavía un resultado concreto.",
      "Normal item with no explicit modifiers. You can consider an Orb of Transmutation, but the result can't be predicted.",
    );
  } else if (state === "complete" && observedOpenSlots !== null) {
    if (lang === "en") {
      summary =
        observedOpenSlots === 0
          ? `Found ${structure}. No open slots left under the observed limit.`
          : `Found ${structure}. ${observedOpenSlots} open slot${observedOpenSlots === 1 ? "" : "s"} ` +
            "left under the observed limit.";
    } else {
      summary =
        observedOpenSlots === 0
          ? `Se distinguen ${structure}. No quedan huecos totales según el límite observado.`
          : `Se distinguen ${structure}. Queda${observedOpenSlots === 1 ? "" : "n"} ` +
            `${observedOpenSlots} hueco${observedOpenSlots === 1 ? "" : "s"} total${observedOpenSlots === 1 ? "" : "es"} ` +
            `según el límite observado.`;
    }
  } else if (explicit.length > 0) {
    summary =
      lang === "en"
        ? `Read ${explicit.length} explicit modifiers, but the structure isn't complete.`
        : `Se leen ${explicit.length} modificadores explícitos, pero la estructura no está completa.`;
  } else {
    summary = t(
      "Todavía no hay datos suficientes para leer la estructura de crafting.",
      "There isn't enough data yet to read the crafting structure.",
    );
  }

  let nextAction: string;
  if (item.itemLevel === undefined) {
    nextAction = t(
      "En PoE2, pasa el ratón por esta pieza y pulsa Ctrl+Alt+C; necesito que aparezca «Nivel de objeto».",
      "In PoE2, hover this item and press Ctrl+Alt+C; I need to see \"Item Level\".",
    );
  } else if (unclassifiedExplicitCount > 0) {
    nextAction = t(
      "En PoE2, pasa el ratón por esta pieza y pulsa Ctrl+Alt+C; así podré distinguir cada prefijo y sufijo.",
      "In PoE2, hover this item and press Ctrl+Alt+C; that way I can tell each prefix and suffix apart.",
    );
  } else if (itemState === undefined) {
    nextAction = t(
      "En PoE2, pasa el ratón por esta pieza y pulsa Ctrl+Alt+C para confirmar si puede modificarse.",
      "In PoE2, hover this item and press Ctrl+Alt+C to confirm whether it can be modified.",
    );
  } else if (specialStateNeedsData) {
    nextAction = t(
      "Esta pieza tiene un estado especial que todavía no sé resolver con seguridad. No gastes moneda sobre ella.",
      "This item has a special state I can't handle safely yet. Don't spend currency on it.",
    );
  } else if (item.rarity !== "normal" && explicit.length === 0) {
    nextAction = t(
      "Importa el texto completo del objeto antes de evaluar una moneda.",
      "Import the item's full text before judging any currency.",
    );
  } else if (item.rarity === "normal" && explicit.length === 0) {
    nextAction = t(
      "Comprueba una Transmutación para convertirlo en mágico con un solo modificador.",
      "Consider an Orb of Transmutation to make it magic with one modifier.",
    );
  } else if (state === "complete" && observedOpenSlots === 0) {
    nextAction = t(
      "El asesor debe bloquear acciones que añadan otro modificador hasta verificar una vía legal.",
      "Actions that add another modifier stay blocked until a legal route is verified.",
    );
  } else if (state === "complete") {
    nextAction = t(
      "Indica qué resultado buscas; después se comprobará qué acciones son legales y seguras.",
      "Tell me what result you're after; then we'll check which actions are legal and safe.",
    );
  } else {
    nextAction = t(
      "Completa los datos señalados antes de elegir una moneda.",
      "Fill in the flagged data before picking a currency.",
    );
  }

  return {
    state,
    label:
      state === "complete"
        ? t("Estructura lista", "Structure ready")
        : state === "partial"
          ? t("Lectura parcial", "Partial reading")
          : t("Diagnóstico bloqueado", "Diagnosis blocked"),
    summary,
    prefixCount,
    suffixCount,
    unclassifiedExplicitCount,
    explicitCount: explicit.length,
    auxiliaryCount: item.modifiers.length - explicit.length,
    observedTotalLimit,
    observedOpenSlots,
    blockers,
    limitations:
      lang === "en"
        ? [
            "An open slot doesn't mean a given currency can or should be used.",
            "No chances, weights or costs are shown because they aren't verified yet.",
            "Total limits and transitions come from local evidence seen on 22 Aug 2026 and may change with a patch.",
          ]
        : [
            "Un hueco libre no garantiza que una moneda concreta pueda o deba usarse.",
            "No se muestran probabilidades, pesos ni costes porque todavía no están verificados.",
            "Los límites totales y las transiciones proceden de evidencia local observada el 22/08/2026 y pueden cambiar con un parche.",
          ],
    nextAction,
  };
}
