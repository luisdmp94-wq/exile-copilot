import type { ActGuide } from "./guide";
import { ACT_ONE_GUIDE } from "./actOne";
import { ACT_TWO_GUIDE } from "./actTwo";
import { ACT_ONE_GUIDE_EN } from "./actOneEn";
import { ACT_TWO_GUIDE_EN } from "./actTwoEn";

export type GuideLang = "es" | "en";

/** Guías publicadas, en orden de campaña. */
export const GUIDES: ActGuide[] = [ACT_ONE_GUIDE, ACT_TWO_GUIDE];
/** Las mismas guías en inglés: mismas direcciones (/guias/acto-1), mismos datos. */
export const GUIDES_EN: ActGuide[] = [ACT_ONE_GUIDE_EN, ACT_TWO_GUIDE_EN];

export function guidesFor(lang: GuideLang): ActGuide[] {
  return lang === "en" ? GUIDES_EN : GUIDES;
}

/** Actos que aún no tienen guía; se anuncian como «pronto». */
export const UPCOMING_GUIDES = ["Acto 3"];
export const UPCOMING_GUIDES_EN = ["Act 3"];

export const DEFAULT_GUIDE_SLUG = GUIDES[0].slug;

export function findGuide(slug: string, lang: GuideLang = "es"): ActGuide {
  const guides = guidesFor(lang);
  return guides.find((guide) => guide.slug === slug) ?? guides[0];
}

/** `/guias/acto-2` → «acto-2»; null si la dirección no es de una guía conocida. */
export function guideSlugFromPath(pathname: string): string | null {
  const match = /^\/guias\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  return GUIDES.some((guide) => guide.slug === match[1]) ? match[1] : null;
}

export function guidePath(slug: string): string {
  return `/guias/${slug}`;
}

/** Título de la pestaña del navegador: es lo que sale en Google. */
export function guidePageTitle(guide: ActGuide, lang: GuideLang = "es"): string {
  const act = guide.actLabel.replace(/^./, (c) => c.toUpperCase());
  return lang === "en"
    ? `PoE2 ${act}: survival guide · Exile Copilot`
    : `${act} de PoE2: guía de supervivencia · Exile Copilot`;
}
