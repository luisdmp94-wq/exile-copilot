import type { CraftingActionId } from "./craftingActions.js";
import type { Item, Modifier } from "./domain.js";

export type CraftingComparisonActionId = CraftingActionId | "essence" | "alloy";

export interface CraftingComparisonOptions {
  expectedRarity?: Item["rarity"];
  expectedRemovedModifierCount?: number;
  expectedAddedCrafted?: boolean;
  maximumCraftedModifierCount?: number;
  expectedAddedModifierText?: string;
  /** Ids pertenecientes al snapshot original, elegidos por el jugador. */
  protectedModifierIds?: string[];
}

export type CraftingComparisonStatus = "confirmed" | "inconclusive" | "mismatch";

export interface CraftingComparison {
  status: CraftingComparisonStatus;
  title: string;
  summary: string;
  identityMatches: boolean;
  itemLevelMatches: boolean;
  rarityMatches: boolean;
  addedModifiers: Modifier[];
  removedModifiers: Modifier[];
  protectionStatus: "not-requested" | "preserved" | "lost" | "unverifiable";
  protectedModifiers: Modifier[];
  lostProtectedModifiers: Modifier[];
  warnings: string[];
}

/** Incógnita canónica de la sesión; evita resolverla mediante literales duplicados. */
export const CRAFTING_RESULT_UNKNOWN_LABEL =
  "El modificador resultante es aleatorio y no puede conocerse de antemano.";

/**
 * Rareza que el objeto tiene DESPUÉS de cada acción observada. Se exporta para
 * que el guía pueda avisar de un cambio de etapa sin duplicar la tabla.
 */
export const EXPECTED_RESULT_RARITY: Record<CraftingComparisonActionId, Item["rarity"]> = {
  transmutation: "magic",
  augmentation: "magic",
  regal: "rare",
  exalted: "rare",
  essence: "rare",
  alloy: "rare",
};

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

function isOrderedTokenExpansion(originalValue: string, resultValue: string): boolean {
  const originalTokens = originalValue.split(" ").filter(Boolean);
  const resultTokens = resultValue.split(" ").filter(Boolean);
  const addedTokenCount = resultTokens.length - originalTokens.length;
  if (originalTokens.length < 2 || addedTokenCount < 1 || addedTokenCount > 4) return false;

  let originalIndex = 0;
  for (const token of resultTokens) {
    if (token === originalTokens[originalIndex]) originalIndex += 1;
    if (originalIndex === originalTokens.length) return true;
  }
  return false;
}

/**
 * Firma estable de un modificador copiado del juego.
 *
 * Los ids del importador son nuevos en cada pegado y no pueden compararse. Los
 * nombres localizados, el grado y las etiquetas de la cabecera tampoco forman
 * parte de la identidad del efecto: el cliente puede completar o reformatear
 * esos metadatos al cambiar la rareza. Para decidir si un mod sobrevivió solo
 * usamos lo que la moneda debe conservar: tipo, posición y texto del efecto.
 * Los flags especiales (fabricado, profanado...) se validan por separado
 * cuando la acción concreta los exige.
 */
function modifierSignature(modifier: Modifier): string {
  return [
    modifier.kind,
    modifier.affix ?? "",
    normalized(modifier.text),
  ].join("|");
}

function multisetDifference(left: Modifier[], right: Modifier[]): Modifier[] {
  const available = new Map<string, number>();
  for (const modifier of right) {
    const signature = modifierSignature(modifier);
    available.set(signature, (available.get(signature) ?? 0) + 1);
  }
  return left.filter((modifier) => {
    const signature = modifierSignature(modifier);
    const count = available.get(signature) ?? 0;
    if (count === 0) return true;
    available.set(signature, count - 1);
    return false;
  });
}

/**
 * PoE2 no serializa igual la identidad visible en todas las rarezas:
 *
 * - normal: una línea con la base;
 * - mágico: una línea con base + afijo, sin base separada;
 * - raro: nombre raro y base en dos líneas.
 *
 * Por eso las dos transiciones que CAMBIAN de etapa necesitan reconciliar la
 * base usando la frase que contiene a la otra, siempre con la misma clase. El
 * nivel de objeto y la conservación de mods se comprueban por separado, de
 * modo que esta tolerancia no basta por sí sola para aceptar otra pieza.
 */
function baseIdentityMatches(
  original: Item,
  result: Item,
  actionId: CraftingComparisonActionId,
): boolean {
  const originalBase = normalized(original.baseType);
  const resultBase = normalized(result.baseType);
  if (originalBase === resultBase) return true;
  const originalClass = normalized(original.itemClass ?? "");
  const resultClass = normalized(result.itemClass ?? "");
  if (originalClass.length === 0 || originalClass !== resultClass) return false;

  if (actionId === "transmutation" && original.rarity === "normal" && result.rarity === "magic") {
    return originalBase.length > 0 && resultBase.includes(originalBase);
  }

  if (actionId === "regal" && original.rarity === "magic" && result.rarity === "rare") {
    return resultBase.length > 0 && originalBase.includes(resultBase);
  }

  // En objetos mágicos localizados, el juego puede serializar base y afijos en
  // una sola línea. Al usar Aumento, el nuevo prefijo puede insertarse en mitad
  // del nombre: «Arco tribal de ira» → «Arco tribal vibrante de ira». La clase,
  // el nivel, los mods conservados y el único mod añadido se validan después;
  // aquí solo reconciliamos esa expansión ordenada del nombre visible.
  if (actionId === "augmentation" && original.rarity === "magic" && result.rarity === "magic") {
    return isOrderedTokenExpansion(originalBase, resultBase);
  }

  return false;
}

/**
 * Compara el snapshot anterior con el texto pegado después de gastar UNA
 * moneda observada. Solo confirma estructura: misma base, transición de rareza
 * esperada, el número esperado de explícitos retirados y exactamente uno nuevo.
 * Nunca decide si el nuevo mod es bueno ni estima probabilidades.
 */
export function compareCraftingResult(
  original: Item,
  result: Item,
  actionId: CraftingComparisonActionId,
  options: CraftingComparisonOptions = {},
): CraftingComparison {
  const warnings: string[] = [];
  const baseTypeMatches = baseIdentityMatches(original, result, actionId);
  if (!baseTypeMatches) {
    warnings.push(
      `La base cambió de «${original.baseType}» a «${result.baseType}»: no parece el mismo objeto.`,
    );
  }
  const itemLevelMatches =
    original.itemLevel !== undefined &&
    result.itemLevel !== undefined &&
    original.itemLevel === result.itemLevel;
  if (original.itemLevel === undefined) {
    warnings.push("El snapshot anterior no conserva el nivel de objeto.");
  } else if (result.itemLevel === undefined) {
    warnings.push("El resultado no incluye el nivel de objeto; no se puede confirmar la identidad.");
  } else if (!itemLevelMatches) {
    warnings.push(
      `El nivel de objeto cambió de ${original.itemLevel} a ${result.itemLevel}.`,
    );
  }
  const identityMatches = baseTypeMatches && itemLevelMatches;

  const expectedRarity =
    options.expectedRarity ??
    (actionId === "alloy" ? original.rarity : EXPECTED_RESULT_RARITY[actionId]);
  const rarityMatches = result.rarity === expectedRarity;
  if (!rarityMatches) {
    warnings.push(
      `La rareza resultante es «${result.rarity}»; para esta acción se esperaba «${expectedRarity}».`,
    );
  }

  const removedModifiers = multisetDifference(original.modifiers, result.modifiers);
  const addedModifiers = multisetDifference(result.modifiers, original.modifiers);
  const removedExplicit = removedModifiers.filter((modifier) => modifier.kind === "explicit");
  const removedAuxiliary = removedModifiers.filter((modifier) => modifier.kind !== "explicit");
  const addedExplicit = addedModifiers.filter((modifier) => modifier.kind === "explicit");
  const craftedResultCount = result.modifiers.filter(
    (modifier) => modifier.kind === "explicit" && modifier.crafted,
  ).length;
  const expectedAddedModifierText = options.expectedAddedModifierText?.trim();
  const requestedProtectedIds = [...new Set(options.protectedModifierIds ?? [])];
  const protectedModifiers = original.modifiers.filter(
    (modifier) =>
      modifier.kind === "explicit" && requestedProtectedIds.includes(modifier.id),
  );
  const knownProtectedIds = new Set(protectedModifiers.map((modifier) => modifier.id));
  const unknownProtectedIds = requestedProtectedIds.filter((id) => !knownProtectedIds.has(id));
  const lostProtectedModifiers = removedExplicit.filter((modifier) => knownProtectedIds.has(modifier.id));
  const protectionStatus: CraftingComparison["protectionStatus"] =
    requestedProtectedIds.length === 0
      ? "not-requested"
      : unknownProtectedIds.length > 0
        ? "unverifiable"
        : lostProtectedModifiers.length > 0
          ? "lost"
          : "preserved";
  const addedTextMatches =
    expectedAddedModifierText === undefined ||
    expectedAddedModifierText.length === 0 ||
    (addedExplicit.length === 1 &&
      normalized(addedExplicit[0]?.text ?? "").includes(normalized(expectedAddedModifierText)));

  const expectedRemovedModifierCount = options.expectedRemovedModifierCount ?? 0;
  if (removedExplicit.length !== expectedRemovedModifierCount) {
    warnings.push(
      `Se esperaba que desaparecieran ${expectedRemovedModifierCount} modificadores explícitos y se detectaron ${removedExplicit.length}.`,
    );
  }
  if (removedAuxiliary.length > 0) {
    warnings.push("También desaparecieron líneas no explícitas; revisa que no se aplicara otra acción.");
  }
  if (addedExplicit.length !== 1) {
    warnings.push(
      `Se esperaba 1 modificador explícito nuevo y se detectaron ${addedExplicit.length}.`,
    );
  }
  if (
    options.expectedAddedCrafted !== undefined &&
    addedExplicit.length === 1 &&
    Boolean(addedExplicit[0]?.crafted) !== options.expectedAddedCrafted
  ) {
    warnings.push(
      options.expectedAddedCrafted
        ? "El modificador nuevo no está identificado como fabricado en el texto avanzado."
        : "El modificador nuevo aparece como fabricado cuando no se esperaba.",
    );
  }
  if (!addedTextMatches) {
    warnings.push(
      "El modificador nuevo no contiene el efecto garantizado que se copió del tooltip.",
    );
  }
  if (unknownProtectedIds.length > 0) {
    warnings.push(
      "La selección de modificadores protegidos no coincide por completo con el snapshot original.",
    );
  }
  if (lostProtectedModifiers.length > 0) {
    warnings.push(
      `Se perdió ${lostProtectedModifiers.length} modificador protegido: ${lostProtectedModifiers.map((modifier) => modifier.text).join(" | ")}`,
    );
  }
  if (
    options.maximumCraftedModifierCount !== undefined &&
    craftedResultCount > options.maximumCraftedModifierCount
  ) {
    warnings.push(
      `El resultado contiene ${craftedResultCount} modificadores fabricados; el máximo permitido es ${options.maximumCraftedModifierCount}.`,
    );
  }
  if (addedModifiers.length !== addedExplicit.length) {
    warnings.push("También cambiaron líneas no explícitas; revisa que no se aplicara otra acción.");
  }

  const structurallyConfirmed =
    identityMatches &&
    rarityMatches &&
    removedExplicit.length === expectedRemovedModifierCount &&
    removedAuxiliary.length === 0 &&
    addedExplicit.length === 1 &&
    addedModifiers.length === 1 &&
    (options.expectedAddedCrafted === undefined ||
      Boolean(addedExplicit[0]?.crafted) === options.expectedAddedCrafted) &&
    (options.maximumCraftedModifierCount === undefined ||
      craftedResultCount <= options.maximumCraftedModifierCount) &&
    addedTextMatches;

  if (structurallyConfirmed) {
    const protectedLost = protectionStatus === "lost";
    return {
      status: "confirmed",
      title: protectedLost
        ? "Cambio confirmado, pero se perdió algo protegido"
        : "Cambio estructural confirmado",
      summary: protectedLost
        ? `La moneda produjo la estructura esperada, pero desapareció: ${lostProtectedModifiers.map((modifier) => modifier.text).join(" | ")}.`
        : expectedRemovedModifierCount === 1
          ? `El texto resultante es compatible: desaparece 1 modificador explícito y aparece 1 nuevo: ${addedExplicit[0]?.text ?? "texto no disponible"}.`
          : `El texto resultante es compatible con el snapshot anterior y aparece 1 modificador explícito nuevo: ${addedExplicit[0]?.text ?? "texto no disponible"}.`,
      identityMatches,
      itemLevelMatches,
      rarityMatches,
      addedModifiers,
      removedModifiers,
      protectionStatus,
      protectedModifiers,
      lostProtectedModifiers,
      warnings,
    };
  }

  const itemLevelConflict =
    original.itemLevel !== undefined &&
    result.itemLevel !== undefined &&
    original.itemLevel !== result.itemLevel;
  const mismatch =
    !baseTypeMatches ||
    itemLevelConflict ||
    !rarityMatches ||
    removedExplicit.length !== expectedRemovedModifierCount ||
    removedAuxiliary.length > 0 ||
    (options.maximumCraftedModifierCount !== undefined &&
      craftedResultCount > options.maximumCraftedModifierCount) ||
    !addedTextMatches;
  return {
    status: mismatch ? "mismatch" : "inconclusive",
    title: mismatch ? "El resultado no coincide con el paso esperado" : "No se puede confirmar todavía",
    summary:
      warnings[0] ??
      "El texto no aporta una diferencia suficientemente clara para confirmar el resultado.",
    identityMatches,
    itemLevelMatches,
    rarityMatches,
    addedModifiers,
    removedModifiers,
    protectionStatus,
    protectedModifiers,
    lostProtectedModifiers,
    warnings,
  };
}

export function craftingComparisonEvidence(comparison: CraftingComparison): string {
  const added = comparison.addedModifiers.map((modifier) => modifier.text).join(" | ");
  const removed = comparison.removedModifiers.map((modifier) => modifier.text).join(" | ");
  return [
    comparison.title,
    comparison.summary,
    added ? `Añadido: ${added}` : null,
    removed ? `Ya no aparece: ${removed}` : null,
    comparison.warnings.length > 0 ? `Advertencias: ${comparison.warnings.join(" ")}` : null,
  ]
    .filter((value): value is string => value !== null)
    .join("\n")
    .slice(0, 4000);
}
