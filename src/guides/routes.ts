/**
 * Direcciones y nombre corto de cada guía publicada, sin su texto.
 *
 * La portada solo necesita saber qué guías existen y cómo se titulan; el texto
 * completo (`actOne.ts` y compañía) pesa mucho y se descarga con el área de
 * guías. Una prueba comprueba que esta lista y las guías reales coinciden.
 */
export type GuideLang = "es" | "en";

export const GUIDE_ROUTES = [
  { slug: "acto-1", actLabel: { es: "acto 1", en: "act 1" } },
  { slug: "acto-2", actLabel: { es: "acto 2", en: "act 2" } },
  { slug: "acto-3", actLabel: { es: "acto 3", en: "act 3" } },
] as const;

export const DEFAULT_GUIDE_SLUG: string = GUIDE_ROUTES[0].slug;

/** `/guias/acto-2` → «acto-2»; null si la dirección no es de una guía conocida. */
export function guideSlugFromPath(pathname: string): string | null {
  const match = /^\/guias\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  return GUIDE_ROUTES.some((guide) => guide.slug === match[1]) ? match[1] : null;
}

export function guidePath(slug: string): string {
  return `/guias/${slug}`;
}

/** Título de la pestaña del navegador a partir del nombre corto del acto. */
export function pageTitleForAct(actLabel: string, lang: GuideLang = "es"): string {
  const act = actLabel.replace(/^./, (c) => c.toUpperCase());
  return lang === "en"
    ? `PoE2 ${act}: survival guide · Exile Copilot`
    : `${act} de PoE2: guía de supervivencia · Exile Copilot`;
}

/** Lo mismo, a partir de la dirección de la guía; una desconocida usa la primera. */
export function guidePageTitleFor(slug: string, lang: GuideLang = "es"): string {
  const route = GUIDE_ROUTES.find((guide) => guide.slug === slug) ?? GUIDE_ROUTES[0];
  return pageTitleForAct(route.actLabel[lang], lang);
}
