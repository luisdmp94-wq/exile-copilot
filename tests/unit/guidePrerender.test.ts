import { describe, expect, it } from "vitest";
import { GUIDES } from "../../src/guides/index.js";
import { renderGuidePage } from "../../src/guides/prerender.js";

const SHELL = `<!doctype html>
<html lang="es" class="dark">
  <head>
    <title>Exile Copilot</title>
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe("versión HTML de las guías para buscadores", () => {
  it.each(GUIDES.map((guide) => [guide.slug, guide] as const))(
    "%s: lleva título, descripción y todo el texto, también el plegado",
    (_slug, guide) => {
      const html = renderGuidePage(SHELL, guide);
      const act = guide.actLabel.replace(/^./, (c) => c.toUpperCase());
      expect(html).toContain(`<title>${act} de PoE2: guía de supervivencia · Exile Copilot</title>`);
      expect(html).toContain(`<meta name="description" content="${guide.description}" />`);
      expect(html).toContain(`<h1>${guide.title}</h1>`);
      for (const block of guide.blocks) {
        for (const tip of [...block.tips, ...(block.more ?? [])]) {
          // Las comillas del texto salen escapadas en el HTML.
          expect(html).toContain(tip.text.replace(/"/g, "&quot;"));
        }
      }
      // El script de la app sigue ahí: el visitante acaba en la página interactiva.
      expect(html).toContain('<script type="module" src="/assets/index-abc.js"></script>');
      expect(html.match(/<title>/g)).toHaveLength(1);
    },
  );

  it("se niega a generar la página si el HTML base no tiene dónde meterla", () => {
    expect(() => renderGuidePage("<html></html>", GUIDES[0])).toThrow();
  });
});
