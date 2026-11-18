import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAppRoute, isPrivateRoute } from "../../server/appRoutes.js";
import { GUIDES } from "../../src/guides/index.js";
import { renderGuidePage } from "../../src/guides/prerender.js";

function projectFile(relative: string): string {
  return readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
}

describe("lo que ven los buscadores", () => {
  it("las direcciones de la web existen; las inventadas no", () => {
    for (const path of ["/", "/guias", "/guias/", "/check", "/estadisticas", "/estadisticas/"]) {
      expect(isAppRoute(path), path).toBe(true);
    }
    for (const path of ["/wp-admin", "/guias/acto-99", "/foo/bar", "/robots.txt", "/index.php", "/checkout"]) {
      expect(isAppRoute(path), path).toBe(false);
    }
  });

  it("las estadísticas no se indexan", () => {
    expect(isPrivateRoute("/estadisticas")).toBe(true);
    expect(isPrivateRoute("/")).toBe(false);
    const robots = projectFile("public/robots.txt");
    expect(robots).toContain("Disallow: /estadisticas");
    expect(robots).toContain("Sitemap: https://exilecopilot.com/sitemap.xml");
  });

  it("el sitemap lista la portada y todas las guías publicadas", () => {
    const sitemap = projectFile("public/sitemap.xml");
    expect(sitemap).toContain("<loc>https://exilecopilot.com/</loc>");
    for (const guide of GUIDES) {
      expect(sitemap, guide.slug).toContain(`<loc>https://exilecopilot.com/guias/${guide.slug}</loc>`);
    }
    expect(sitemap).not.toContain("estadisticas");
    expect(sitemap.match(/<url>/g)).toHaveLength(GUIDES.length + 1);
  });

  it("la portada lleva título y descripción en español y su dirección canónica", () => {
    const html = projectFile("index.html");
    expect(html).toMatch(/<title>Exile Copilot · [^<]*Path of Exile 2[^<]*español<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]*jugadores nuevos[^"]*" \/>/);
    expect(html).toContain('<link rel="canonical" href="https://exilecopilot.com/" />');
  });

  it("cada guía apunta a su propia dirección canónica, no a la portada", () => {
    const shell = projectFile("index.html");
    for (const guide of GUIDES) {
      const html = renderGuidePage(shell, guide);
      expect(html.match(/rel="canonical"/g), guide.slug).toHaveLength(1);
      expect(html).toContain(`<link rel="canonical" href="https://exilecopilot.com/guias/${guide.slug}" />`);
    }
  });
});

describe("lista ligera de guías (la que carga la portada)", () => {
  it("coincide con las guías reales en los dos idiomas", async () => {
    const { GUIDE_ROUTES, guidePageTitleFor, guideSlugFromPath } = await import("../../src/guides/routes.js");
    const { GUIDES_EN, findGuide, guidePageTitle } = await import("../../src/guides/index.js");

    expect(GUIDE_ROUTES.map((route) => route.slug)).toEqual(GUIDES.map((guide) => guide.slug));
    expect(GUIDE_ROUTES.map((route) => route.actLabel.es)).toEqual(GUIDES.map((guide) => guide.actLabel));
    expect(GUIDE_ROUTES.map((route) => route.actLabel.en)).toEqual(GUIDES_EN.map((guide) => guide.actLabel));
    for (const guide of GUIDES) {
      expect(guidePageTitleFor(guide.slug, "es")).toBe(guidePageTitle(findGuide(guide.slug, "es"), "es"));
      expect(guidePageTitleFor(guide.slug, "en")).toBe(guidePageTitle(findGuide(guide.slug, "en"), "en"));
      expect(guideSlugFromPath(`/guias/${guide.slug}`)).toBe(guide.slug);
    }
    expect(guideSlugFromPath("/guias/acto-99")).toBeNull();
  });
});
