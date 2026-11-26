// Compila la ventanita a overlay/dist con el esbuild del proyecto.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
mkdirSync(out, { recursive: true });

const common = { bundle: true, logLevel: "warning", target: "es2022", charset: "utf8" };
await build({ ...common, entryPoints: [join(here, "src/main.ts")], outfile: join(out, "main.cjs"), platform: "node", format: "cjs", external: ["electron", "koffi", "electron-updater"] });
await build({ ...common, entryPoints: [join(here, "src/preload.ts")], outfile: join(out, "preload.cjs"), platform: "node", format: "cjs", external: ["electron"] });
await build({ ...common, entryPoints: [join(here, "src/renderer.ts")], outfile: join(out, "renderer.js"), platform: "browser", format: "iife" });
copyFileSync(join(here, "src/overlay.html"), join(out, "overlay.html"));
console.log("Ventanita compilada en overlay/dist");
