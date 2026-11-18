/**
 * Qué entradas de poe2db son gemas de verdad.
 *
 * El listado en español de poe2db sigue enseñando gemas que el juego retiró,
 * y los dos listados traen alguna entrada que no es una gema. Sin este filtro
 * la web las ofrecía en el desplegable de habilidades como si existieran.
 */

/**
 * Gemas fundidas en otra en el parche 0.3.0 (historial de versiones de
 * poe2db, 18-11-2026): las tres maldiciones pasaron a «Debilidad elemental» y
 * las tres «Lanzar al…» a «Lanzar al infligir estado alterado elemental».
 */
export const RETIRED_GEM_SLUGS: ReadonlySet<string> = new Set([
  "Conductivity",
  "Flammability",
  "Hypothermia",
  "Cast_on_Freeze",
  "Cast_on_Ignite",
  "Cast_on_Shock",
]);

/** Plantillas sin rellenar («Compañero: {0}») y contenido interno del juego («[DNT] …»). */
export function isPlaceholderGemName(name: string): boolean {
  return /[{}]/.test(name) || /^\[DNT\]/i.test(name.trim());
}

export function isRealGem(gem: { slug: string; name: string }): boolean {
  return !RETIRED_GEM_SLUGS.has(gem.slug) && !isPlaceholderGemName(gem.name);
}
