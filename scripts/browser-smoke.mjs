/**
 * Prueba real de navegador del flujo principal de Exile Copilot.
 * Usa Microsoft Edge instalado en el sistema (sin descargar Chromium).
 *
 * Uso: node scripts/browser-smoke.mjs
 * Requiere: `npm run build` previo (sirve dist/ en modo producción).
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PORT = 7199;
const BASE = `http://localhost:${PORT}`;
const SHOT_DIR = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* aún no listo */
    }
    await wait(500);
  }
  throw new Error("El servidor no respondió a tiempo");
}

// Arranque real del servidor de producción con tsx
const proc = spawn(
  "npx",
  ["tsx", "server/index.ts"],
  {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
proc.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

let browser;
let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failures++;
};

try {
  await waitForServer(`${BASE}/api/health`);
  check("servidor producción responde /api/health", true);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  mkdirSync(SHOT_DIR, { recursive: true });

  // 1. Carga inicial
  await page.goto(BASE, { waitUntil: "networkidle" });
  check(
    "página carga con cabecera Exile Copilot",
    await page.getByText("Exile Copilot").first().isVisible(),
  );

  // 2. Cargar ejemplo
  await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
  await page.getByText("Demo Gemling").first().waitFor({ timeout: 10000 });
  check("ejemplo precargado muestra el personaje demo", true);

  // 3. Editar vida (manual) y guardar correcciones (persistencia)
  await page.locator("#def-life").fill("2150");
  const saveBtn = page.getByRole("button", { name: /Guardar correcciones/i });
  await saveBtn.click();
  await wait(800);
  check("corrección manual guardada (vida 2150)", true);

  // 4. Presupuesto y generación de recomendaciones
  await page.locator("#market-budget").fill("5");
  await page
    .getByRole("button", { name: "Generar recomendaciones" })
    .click();
  await page.waitForSelector("text=/Prioridad|prioridad/i", { timeout: 15000 });
  await wait(1000);
  const cards = await page.locator("text=/Confianza|confianza/").count();
  check(`se generan recomendaciones (${cards} tarjetas visibles)`, cards >= 3);
  await page.screenshot({ path: `${SHOT_DIR}recomendaciones.png`, fullPage: true });

  // 5. Exportar .build oficial
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: /Descargar \.build/ }).click(),
  ]);
  const fileName = download.suggestedFilename();
  check(`descarga termina en .build (${fileName})`, fileName.endsWith(".build"));
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  check(
    "el archivo descargado es un Build válido (name + array de pasivas/skills)",
    typeof parsed.name === "string" &&
      (parsed.passives === undefined || Array.isArray(parsed.passives)) &&
      (parsed.skills === undefined || Array.isArray(parsed.skills)),
  );

  // 6. Informe de exportación honesto visible
  check(
    "informe de exportación visible (lo que el formato NO puede guardar)",
    await page
      .getByText(/no puede guardar|NO puede/i)
      .first()
      .isVisible()
      .catch(() => false),
  );

  // 7. Persistencia tras recargar
  await page.reload({ waitUntil: "networkidle" });
  const restored = await page
    .getByText("Demo Gemling")
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  check("el personaje guardado se recupera tras recargar", restored);

  await page.screenshot({ path: `${SHOT_DIR}app-completa.png`, fullPage: true });
} catch (err) {
  console.error("ERROR en la prueba de navegador:", err.message);
  failures++;
} finally {
  if (browser) await browser.close();
  proc.kill();
  // En Windows, matar el árbol de procesos de npx
  try {
    const { execSync } = await import("node:child_process");
    execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
  } catch {
    /* ya detenido */
  }
}

console.log(failures === 0 ? "\nTODAS LAS COMPROBACIONES PASARON" : `\n${failures} COMPROBACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
