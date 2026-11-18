/**
 * Textos de las sesiones de decisión de Crafting (moneda, Essence, Alloy) en
 * los dos idiomas. Se guardan en el idioma activo al abrir la sesión.
 *
 * OJO: las etiquetas «resultado desconocido» (CRAFTING_/ESSENCE_/ALLOY_
 * RESULT_UNKNOWN_LABEL) NO están aquí: el servidor las usa como clave para
 * resolver la incógnita y se guardan siempre en español.
 */
export type DecisionLang = "es" | "en";

const ES = {
  check: (what: string, item: string) => `Comprobar ${what} en ${item}`,
  currency: {
    hypothesis:
      "La acción es compatible con la estructura observada; se comprobará una sola vez sin asumir el modificador resultante.",
    observation:
      "Conserva el texto actual. Si decides aplicar la moneda, no realices otra acción: copia inmediatamente el objeto resultante y vuelve a importarlo.",
    noWeights: "No hay pesos ni probabilidades verificadas para estimar el resultado.",
    noOtherAction: "No realizar otra acción de crafting antes de copiar el resultado.",
    protectedStay: "Los modificadores marcados como imprescindibles deben seguir presentes en el resultado.",
  },
  sameSnapshot: "El objeto debe seguir coincidiendo con el snapshot importado.",
  essence: {
    randomRemoval: (count: number) => `Se retirará al azar 1 de los ${count} modificadores explícitos observados.`,
    keepMods: "Los modificadores actuales deberían conservarse durante la mejora de mágico a raro.",
    hypothesisRemoval:
      "La Essence retirará un modificador explícito al azar y añadirá el efecto garantizado copiado de su tooltip.",
    hypothesisUpgrade: "La Essence elevará el objeto mágico a raro y añadirá el efecto garantizado copiado de su tooltip.",
    expected: (text: string) => `Efecto garantizado declarado: ${text}`,
    observation:
      "Conserva este snapshot. Si aplicas la Essence, no realices ninguna otra acción: copia inmediatamente el objeto resultante y vuelve a importarlo.",
    noPool: "No existe un pool completo y redistribuible para estimar probabilidades de afijos.",
    matchTooltip: "El nombre y el efecto deben coincidir con el tooltip de la Essence que vas a gastar.",
    checkProtected: "La comparación debe comprobar uno por uno los modificadores protegidos.",
  },
  alloy: {
    hypothesis:
      "El Alloy reemplazará un modificador explícito y añadirá el modificador fabricado garantizado copiado del tooltip.",
    expected: (text: string) => `Modificador fabricado garantizado declarado: ${text}`,
    observation:
      "Conserva este snapshot. Si aplicas el Alloy, no realices ninguna otra acción: copia inmediatamente el objeto resultante y vuelve a importarlo.",
    noMatrix: "No existe una matriz pública completa Alloy × tipo de objeto para validar el efecto por nombre.",
    selectionUnverified: "No está verificado cómo se elige el modificador reemplazado.",
    anyReplaced: (count: number) => `Cualquiera de los ${count} modificadores explícitos observados puede ser reemplazado.`,
    playerSelected: "Elige dentro del juego únicamente el modificador que aceptaste reemplazar.",
    criterionUnverified: "GGG confirma el reemplazo de un modificador, pero el criterio de selección no está verificado.",
    classes: (list: string) =>
      `El tooltip declara estas clases: ${list}. El jugador confirmó que la pieza seleccionada pertenece a una de ellas.`,
    matchTooltip: "El Alloy y su efecto deben coincidir con el tooltip completo registrado en esta sesión.",
    sameSnapshotNoCrafted:
      "El objeto debe seguir coincidiendo con el snapshot importado y no contener otro modificador fabricado.",
    protectedFlagged: "Ningún modificador marcado como imprescindible puede desaparecer sin quedar señalado.",
  },
};

const EN: typeof ES = {
  check: (what, item) => `Check ${what} on ${item}`,
  currency: {
    hypothesis:
      "The action fits the item's structure; it will be checked once without assuming which modifier appears.",
    observation:
      "Keep the current text. If you decide to use the orb, don't do anything else: copy the resulting item right away and import it again.",
    noWeights: "There are no verified weights or probabilities to estimate the result.",
    noOtherAction: "Don't do any other crafting action before copying the result.",
    protectedStay: "The modifiers you marked as must-keep have to still be there in the result.",
  },
  sameSnapshot: "The item must still match the imported snapshot.",
  essence: {
    randomRemoval: (count) => `1 of the ${count} explicit modifiers will be removed at random.`,
    keepMods: "The current modifiers should stay when the item goes from magic to rare.",
    hypothesisRemoval:
      "The Essence will remove one explicit modifier at random and add the guaranteed effect copied from its tooltip.",
    hypothesisUpgrade: "The Essence will turn the magic item rare and add the guaranteed effect copied from its tooltip.",
    expected: (text) => `Declared guaranteed effect: ${text}`,
    observation:
      "Keep this snapshot. If you use the Essence, don't do anything else: copy the resulting item right away and import it again.",
    noPool: "There's no complete, shareable modifier pool to estimate modifier probabilities.",
    matchTooltip: "The name and effect must match the tooltip of the Essence you're about to spend.",
    checkProtected: "The comparison has to check the protected modifiers one by one.",
  },
  alloy: {
    hypothesis: "The Alloy will replace one explicit modifier and add the guaranteed crafted modifier copied from its tooltip.",
    expected: (text) => `Declared guaranteed crafted modifier: ${text}`,
    observation:
      "Keep this snapshot. If you use the Alloy, don't do anything else: copy the resulting item right away and import it again.",
    noMatrix: "There's no complete public Alloy × item type table to validate the effect by name.",
    selectionUnverified: "How the replaced modifier is chosen isn't verified.",
    anyReplaced: (count) => `Any of the ${count} explicit modifiers can be replaced.`,
    playerSelected: "In game, pick only the modifier you agreed to replace.",
    criterionUnverified: "GGG confirms one modifier is replaced, but how it's chosen isn't verified.",
    classes: (list) =>
      `The tooltip lists these item classes: ${list}. The player confirmed the selected item belongs to one of them.`,
    matchTooltip: "The Alloy and its effect must match the full tooltip saved in this session.",
    sameSnapshotNoCrafted: "The item must still match the imported snapshot and have no other crafted modifier.",
    protectedFlagged: "No must-keep modifier can disappear without being flagged.",
  },
};

export const CRAFTING_DECISION_TEXT: Record<DecisionLang, typeof ES> = { es: ES, en: EN };
