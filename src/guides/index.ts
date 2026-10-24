import type { ActGuide } from "./guide";
import { ACT_ONE_GUIDE } from "./actOne";
import { ACT_TWO_GUIDE } from "./actTwo";

/** Guías publicadas, en orden de campaña. */
export const GUIDES: ActGuide[] = [ACT_ONE_GUIDE, ACT_TWO_GUIDE];

/** Actos que aún no tienen guía; se anuncian como «pronto». */
export const UPCOMING_GUIDES = ["Acto 3"];

export const DEFAULT_GUIDE_SLUG = GUIDES[0].slug;

export function findGuide(slug: string): ActGuide {
  return GUIDES.find((guide) => guide.slug === slug) ?? GUIDES[0];
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
export function guidePageTitle(guide: ActGuide): string {
  const act = guide.actLabel.replace(/^./, (c) => c.toUpperCase());
  return `${act} de PoE2: guía de supervivencia · Exile Copilot`;
}
