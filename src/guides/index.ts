import type { ActGuide } from "./guide";
import { ACT_ONE_GUIDE } from "./actOne";
import { ACT_TWO_GUIDE } from "./actTwo";
import { ACT_THREE_GUIDE } from "./actThree";
import { ACT_ONE_GUIDE_EN } from "./actOneEn";
import { ACT_TWO_GUIDE_EN } from "./actTwoEn";
import { ACT_THREE_GUIDE_EN } from "./actThreeEn";

import { pageTitleForAct, type GuideLang } from "./routes";

export { DEFAULT_GUIDE_SLUG, guidePath, guideSlugFromPath, type GuideLang } from "./routes";

/** Guías publicadas, en orden de campaña. */
export const GUIDES: ActGuide[] = [ACT_ONE_GUIDE, ACT_TWO_GUIDE, ACT_THREE_GUIDE];
/** Las mismas guías en inglés: mismas direcciones (/guias/acto-1), mismos datos. */
export const GUIDES_EN: ActGuide[] = [ACT_ONE_GUIDE_EN, ACT_TWO_GUIDE_EN, ACT_THREE_GUIDE_EN];

export function guidesFor(lang: GuideLang): ActGuide[] {
  return lang === "en" ? GUIDES_EN : GUIDES;
}

/** Actos que aún no tienen guía; se anuncian como «pronto». */
export const UPCOMING_GUIDES = ["Acto 4"];
export const UPCOMING_GUIDES_EN = ["Act 4"];

export function findGuide(slug: string, lang: GuideLang = "es"): ActGuide {
  const guides = guidesFor(lang);
  return guides.find((guide) => guide.slug === slug) ?? guides[0];
}

/** Título de la pestaña del navegador: es lo que sale en Google. */
export function guidePageTitle(guide: ActGuide, lang: GuideLang = "es"): string {
  return pageTitleForAct(guide.actLabel, lang);
}
