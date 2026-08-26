/**
 * Hito 6D — prueba real de la memoria persistente de build.
 *
 * Uso:
 *   node scripts/build-memory-smoke.mjs
 *   node scripts/build-memory-smoke.mjs --dev
 *   node scripts/build-memory-smoke.mjs --all
 *   node scripts/build-memory-smoke.mjs --all --update-screenshots
 *
 * Cada modo usa su propia SQLite temporal y bloquea peticiones externas.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSmokeTempDir,
  launchBrowser,
  productionServerCommand,
  removeSmokeTempDir,
  stopChild,
  toolCommand,
} from "./browserLaunch.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const TEMP_ROOT = createSmokeTempDir("build-memory");
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all")
  ? ["prod", "dev"]
  : args.includes("--dev")
    ? ["dev"]
    : ["prod"];
const SHOT_DIR = UPDATE_SCREENSHOTS
  ? join(REPO, "docs", "screenshots")
  : TEMP_ROOT;
mkdirSync(SHOT_DIR, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let total = 0;
let failures = 0;

function check(label, condition) {
  total += 1;
  console.log(`${condition ? "✅" : "❌"} ${label}`);
  if (!condition) failures += 1;
}

function startServer(mode, port) {
  const command =
    mode === "prod"
      ? productionServerCommand()
      : toolCommand("vite", ["--port", String(port), "--strictPort"]);
  const server = spawn(command.command, command.args, {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(TEMP_ROOT, `${mode}.db`),
      NODE_ENV: mode === "prod" ? "production" : "development",
      SECURE_COOKIES: "false",
      POE_NINJA_OFFLINE: "true",
    },
    shell: command.shell,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  return server;
}

async function waitForServer(base) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return true;
    } catch {
      // El servidor todavía está arrancando.
    }
    await wait(500);
  }
  return false;
}

async function runFlow(mode, port) {
  const base = `http://localhost:${port}`;
  const server = startServer(mode, port);
  let browser;
  console.log(`\n=== HITO 6D — ${mode.toUpperCase()} (${base}) ===`);
  try {
    const available = await waitForServer(base);
    check(`[${mode}] servidor disponible`, available);
    if (!available) return;

    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    const externalRequests = [];
    const errors = [];

    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(base) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      const text = message.text();
      const source = message.location()?.url ?? "";
      if (
        message.type() === "error" &&
        !text.includes("favicon.ico") &&
        !source.endsWith("/favicon.ico")
      ) {
        errors.push(`${text}${source ? ` @ ${source}` : ""}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
        errors.push(`HTTP ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });

    const memory = page.getByTestId("memoria-build");
    await memory.waitFor({ timeout: 15_000 });
    check(
      `[${mode}] explica que la memoria requiere persistencia`,
      (await memory.getByRole("button", { name: "Guardar personaje y activar memoria" }).count()) === 1,
    );
    await memory.getByRole("button", { name: "Guardar personaje y activar memoria" }).click();
    const addRule = memory.getByRole("button", { name: "Añadir regla" });
    await addRule.waitFor({ timeout: 15_000 });
    await page.waitForFunction(
      () => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (candidate) => candidate.textContent?.includes("Añadir regla"),
        );
        return button instanceof HTMLButtonElement && !button.disabled;
      },
      undefined,
      { timeout: 15_000 },
    );
    check(
      `[${mode}] el personaje guardado habilita Añadir regla`,
      !(await addRule.isDisabled()),
    );

    await addRule.click();
    await page.locator("#build-memory-label").fill("Doom Song es el arma Core");
    await page
      .locator("#build-memory-reason")
      .fill("Define la identidad de esta variante y no debe sustituirse en silencio.");
    const doomSongValue = await page
      .locator("#build-memory-item option")
      .filter({ hasText: "Doom Song" })
      .getAttribute("value");
    if (!doomSongValue) throw new Error("Doom Song no aparece entre los objetos vinculables");
    await page.locator("#build-memory-item").selectOption(doomSongValue);
    await memory.getByRole("button", { name: "Guardar en la memoria" }).click();
    await memory.getByText("Doom Song es el arma Core", { exact: true }).waitFor({ timeout: 15_000 });
    check(
      `[${mode}] guarda una regla Core vinculada a un objeto real`,
      (await memory.locator('[data-slot="badge"]').filter({ hasText: /^Core$/ }).count()) === 1 &&
        (await memory.getByText(/no debe sustituirse en silencio/).count()) === 1,
    );

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    await page.getByTestId("memoria-build").getByText("Doom Song es el arma Core", { exact: true }).waitFor({ timeout: 15_000 });
    check(
      `[${mode}] la identidad sobrevive a recargar`,
      (await page.getByTestId("memoria-build").getByText("Doom Song es el arma Core", { exact: true }).count()) === 1,
    );

    const select = page.getByRole("combobox", { name: "Clasificación de Doom Song es el arma Core" });
    await select.selectOption("experimental");
    await page
      .getByTestId("memoria-build")
      .locator('[data-slot="badge"]')
      .filter({ hasText: /^Experimental$/ })
      .waitFor({ timeout: 15_000 });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    check(
      `[${mode}] la reclasificación también persiste`,
      (await page
        .getByTestId("memoria-build")
        .locator('[data-slot="badge"]')
        .filter({ hasText: /^Experimental$/ })
        .count()) === 1,
    );

    await page.screenshot({
      path: join(SHOT_DIR, `memoria-build-escritorio-${mode}.png`),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    check(`[${mode}] sin desbordamiento horizontal a 390 px`, !overflow);
    await page.screenshot({
      path: join(SHOT_DIR, `memoria-build-movil-${mode}.png`),
      fullPage: true,
    });

    await page.getByTestId("memoria-build").getByRole("button", { name: "Archivar" }).click();
    await page.getByText("Aún no has marcado qué es esencial", { exact: false }).waitFor({ timeout: 15_000 });
    await page.reload({ waitUntil: "networkidle" });
    check(
      `[${mode}] archivar retira la regla incluso tras recargar`,
      (await page.getByText("Doom Song es el arma Core", { exact: true }).count()) === 0,
    );
    check(`[${mode}] sin peticiones externas`, externalRequests.length === 0);
    check(`[${mode}] sin errores de navegador`, errors.length === 0);
    if (externalRequests.length) console.log("  externas:", externalRequests.slice(0, 5));
    if (errors.length) console.log("  errores:", errors.slice(0, 8));
  } finally {
    if (browser) await browser.close();
    stopChild(server);
  }
}

const ports = { prod: 7193, dev: 7194 };
try {
  for (const mode of modes) await runFlow(mode, ports[mode]);
} finally {
  if (!UPDATE_SCREENSHOTS) removeSmokeTempDir(TEMP_ROOT);
}

console.log(`\nHito 6D: ${total - failures}/${total} comprobaciones`);
if (failures > 0) process.exit(1);
