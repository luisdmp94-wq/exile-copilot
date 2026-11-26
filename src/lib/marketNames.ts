/**
 * poe.ninja solo conoce los nombres en inglés. Quien juega con el cliente en
 * español escribe «Orbe exaltado» y se quedaba con un «No verificado» sin
 * explicación. Aquí se traducen las monedas de uso diario antes de consultar.
 *
 * Los cuatro orbes de crafting usan el nombre que el proyecto ya tiene
 * contrastado (`OBSERVED_CRAFTING_ACTIONS`). Caos y divino admiten las formas
 * habituales («de caos» / «del caos»): solo interpretan lo que escribe el
 * jugador, no afirman cómo lo rotula el cliente.
 */
const SPANISH_CURRENCY: ReadonlyArray<readonly [RegExp, string]> = [
  [/^orbes? de transmutacion$/, "Orb of Transmutation"],
  [/^orbes? de aumento$/, "Orb of Augmentation"],
  [/^orbes? regios?$/, "Regal Orb"],
  [/^orbes? exaltados?$/, "Exalted Orb"],
  [/^orbes? del? caos$/, "Chaos Orb"],
  [/^orbes? divinos?$/, "Divine Orb"],
];

const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** El nombre con el que hay que preguntar a poe.ninja; el mismo si no se reconoce. */
export function marketName(name: string): string {
  const key = plain(name);
  return SPANISH_CURRENCY.find(([pattern]) => pattern.test(key))?.[1] ?? name.trim();
}
