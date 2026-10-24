/**
 * Genera `dist/guias/<slug>.html` para cada guía (ver src/guides/prerender.ts).
 * Se ejecuta después de `vite build`; el servidor los sirve en /guias/<slug>.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GUIDES } from "../src/guides/index.js";
import { renderGuidePage } from "../src/guides/prerender.js";

const distDir = resolve(process.cwd(), "dist");
const shell = readFileSync(resolve(distDir, "index.html"), "utf8");
const outDir = resolve(distDir, "guias");
mkdirSync(outDir, { recursive: true });

for (const guide of GUIDES) {
  const target = resolve(outDir, `${guide.slug}.html`);
  writeFileSync(target, renderGuidePage(shell, guide), "utf8");
  console.log(`[prerender] ${guide.slug} → dist/guias/${guide.slug}.html`);
}
