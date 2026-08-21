/**
 * Prueba real de navegador del flujo principal de Exile Copilot.
 * Usa Microsoft Edge instalado en el sistema (sin descargar Chromium).
 *
 * Uso:
 *   node scripts/browser-smoke.mjs          → producción (requiere `npm run build` previo)
 *   node scripts/browser-smoke.mjs --dev    → modo desarrollo (Vite + Strict Mode)
 *   node scripts/browser-smoke.mjs --all    → ambos
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browserLaunch.mjs";

const SHOT_DIR = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
const args = process.argv.slice(2);
const modes = args.includes("--all")
  ? ["prod", "dev"]
  : args.includes("--dev")
    ? ["dev"]
    : ["prod"];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, attempts = 90) {
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

function startServer(mode, port) {
  const cmd =
    mode === "prod"
      ? ["tsx", "server/index.ts"]
      : ["vite", "--port", String(port), "--strictPort"];
  const proc = spawn("npx", cmd, {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: mode === "prod" ? "production" : "development",
    },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stderr.on("data", (d) => process.stderr.write(`[server:${mode}] ${d}`));
  return proc;
}

async function stopServer(proc) {
  try {
    const { execSync } = await import("node:child_process");
    execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
  } catch {
    /* ya detenido */
  }
}

let failures = 0;
/**
 * Navegación por áreas (Mentor / Personaje / Plan y mercado). Los tres paneles
 * siguen montados para no perder estado, así que hay que ACTIVAR el área antes
 * de interactuar con sus controles.
 */
async function irA(page, area) {
  const tab = page.getByTestId(`tab-${area}`);
  await tab.click();
  await page.waitForFunction(
    (a) =>
      document.querySelector(`[data-testid="tab-${a}"]`)?.getAttribute("data-state") ===
      "active",
    area,
    { timeout: 10000 },
  );
}

const check = (name, ok) => {
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failures++;
};

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== MODO ${mode.toUpperCase()} (${BASE}) ===`);
  const proc = startServer(mode, port);
  let browser;
  try {
    await waitForServer(`${BASE}/api/health`);
    check(`[${mode}] servidor responde /api/health`, true);

    browser = await launchBrowser();
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    mkdirSync(SHOT_DIR, { recursive: true });

    // 1. Carga inicial (Strict Mode en dev: no debe quedarse en "Restaurando…")
    await page.goto(BASE, { waitUntil: "networkidle" });
    check(
      `[${mode}] cabecera Exile Copilot visible`,
      await page.getByText("Exile Copilot").first().isVisible(),
    );
    const stuckRestoring = await page
      .getByText(/Restaurando/i)
      .first()
      .isVisible()
      .catch(() => false);
    check(`[${mode}] no se queda en "Restaurando…" (Strict Mode)`, !stuckRestoring);

    // 2. Bienvenida sin duplicados y carga del ejemplo (área «Personaje»)
    await irA(page, "personaje");
    await page.getByTestId("bienvenida").waitFor({ timeout: 15000 });
    // Solo botones VISIBLES: los paneles inactivos siguen montados (ocultos) y
    // el vacío de recomendaciones tiene su propio botón de ejemplo, legítimo.
    const ejemploVisibles = await page
      .getByRole("button", { name: "Cargar ejemplo" })
      .locator("visible=true")
      .count();
    const importarVisibles = await page
      .getByTestId("bienvenida-importar")
      .locator("visible=true")
      .count();
    check(
      `[${mode}] bienvenida sin duplicados (${ejemploVisibles} botón de ejemplo, sin vacío repetido)`,
      ejemploVisibles === 1 &&
        importarVisibles === 1 &&
        (await page.getByText("Todavía no hay personaje").count()) === 0 &&
        (await page.locator("#panel-importacion").locator("visible=true").count()) === 1,
    );
    await page.getByRole("button", { name: "Cargar ejemplo" }).locator("visible=true").click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 10000 });
    check(`[${mode}] ejemplo precargado visible`, true);

    // 3. Editar vida y guardar: comprobar la RESPUESTA de guardado (200 + perfil)
    await page.locator("#def-life").fill("2150");
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/character") && r.request().method() === "POST",
        { timeout: 10000 },
      ),
      page.getByRole("button", { name: /Guardar correcciones/i }).click(),
    ]);
    const savedBody = await saveResponse.json().catch(() => null);
    check(
      `[${mode}] respuesta de guardado 200 con vida=2150`,
      saveResponse.status() === 200 && savedBody?.profile?.life === 2150,
    );

    // 4. Presupuesto (área «Plan y mercado») y recomendaciones (área «Mentor»)
    await irA(page, "plan");
    await page.locator("#market-budget").fill("5");
    await irA(page, "mentor");
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    await page.waitForSelector("text=/Confianza|confianza/", { timeout: 15000 });
    const cards = await page.locator("text=/Confianza|confianza/").count();
    check(`[${mode}] se generan ${cards} tarjetas de recomendación`, cards >= 3);

    // 5. Marcar una recomendación como aplicada y exportar
    const checkbox = page
      .getByRole("checkbox", { name: /Ya la apliqué/i })
      .first();
    if (await checkbox.isVisible().catch(() => false)) await checkbox.check();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.getByRole("button", { name: /Descargar \.build/ }).click(),
    ]);
    const fileName = download.suggestedFilename();
    check(`[${mode}] descarga termina en .build (${fileName})`, fileName.endsWith(".build"));

    // 6. Esquema completo del archivo descargado
    const path = await download.path();
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const allowed = new Set([
      "name",
      "author",
      "link",
      "description",
      "ascendancy",
      "passives",
      "skills",
      "inventory_slots",
    ]);
    const keysOk = Object.keys(parsed).every((k) => allowed.has(k));
    const shapesOk =
      typeof parsed.name === "string" &&
      (parsed.passives === undefined || Array.isArray(parsed.passives)) &&
      (parsed.skills === undefined || Array.isArray(parsed.skills)) &&
      (parsed.inventory_slots === undefined ||
        parsed.inventory_slots.every(
          (s) => typeof s === "object" && typeof s.inventory_id === "string",
        ));
    check(
      `[${mode}] archivo válido contra el esquema GGG (claves y formas)`,
      keysOk && shapesOk,
    );
    check(
      `[${mode}] recomendación aplicada incrustada en description`,
      typeof parsed.description === "string" &&
        parsed.description.includes("Mejoras planificadas"),
    );
    await page.screenshot({
      path: `${SHOT_DIR}flujo-${mode}.png`,
      fullPage: true,
    });

    // 7. Persistencia: recargar y comprobar EXACTAMENTE vida=2150
    // Con personaje se entra por «Mentor»: hay que volver a «Personaje».
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "personaje");
    await page.locator("#def-life").waitFor({ timeout: 10000 });
    const restoredLife = await page.locator("#def-life").inputValue();
    check(
      `[${mode}] vida restaurada tras recargar = ${restoredLife} (esperado 2150)`,
      restoredLife === "2150",
    );
  } catch (err) {
    console.error(`ERROR en la prueba de navegador (${mode}):`, err.message);
    failures++;
  } finally {
    if (browser) await browser.close();
    await stopServer(proc);
  }
}

for (const mode of modes) {
  await runFlow(mode, mode === "prod" ? 7199 : 7198);
}

console.log(
  failures === 0
    ? "\nTODAS LAS COMPROBACIONES PASARON"
    : `\n${failures} COMPROBACIONES FALLARON`,
);
process.exit(failures === 0 ? 0 : 1);
