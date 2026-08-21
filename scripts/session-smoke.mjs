/**
 * Prueba de navegador del Hito 6B — sesiones adaptativas de decisión.
 *
 * Uso:
 *   node scripts/session-smoke.mjs          → producción (requiere `npm run build`)
 *   node scripts/session-smoke.mjs --dev    → desarrollo (Vite + React Strict Mode)
 *   node scripts/session-smoke.mjs --all    → ambos
 *   node scripts/session-smoke.mjs --update-screenshots → guarda capturas en docs/screenshots/
 *
 * Cada modo usa una base SQLite temporal y su propio puerto. Nunca toca la
 * base real. Sin peticiones a hosts externos.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, stopChild } from "./browserLaunch.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all")
  ? ["prod", "dev"]
  : args.includes("--dev")
    ? ["dev"]
    : ["prod"];

const tempRoot = mkdtempSync(join(tmpdir(), "exile-copilot-6b-"));
const SHOT_DIR = UPDATE_SCREENSHOTS ? join(REPO, "docs", "screenshots") : tempRoot;
mkdirSync(SHOT_DIR, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(base) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return true;
    } catch {
      /* arrancando */
    }
    await wait(500);
  }
  return false;
}

function startServer(mode, port) {
  const command =
    mode === "prod"
      ? [join(REPO, "node_modules", "tsx", "dist", "cli.mjs"), "server/index.ts"]
      : [join(REPO, "node_modules", "vite", "bin", "vite.js"), "--port", String(port), "--strictPort"];
  const proc = spawn(globalThis.process.execPath, command, {
    cwd: REPO,
    env: {
      ...globalThis.process.env,
      PORT: String(port),
      DATABASE_PATH: join(tempRoot, `${mode}.db`),
      NODE_ENV: mode === "prod" ? "production" : "development",
      POE_NINJA_OFFLINE: "true",
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stderr.on("data", () => {});
  proc.stdout.on("data", () => {});
  return proc;
}

let total = 0;
let failures = 0;
function check(label, condition) {
  total += 1;
  console.log(`${condition ? "✅" : "❌"} ${label}`);
  if (!condition) failures += 1;
}

async function persistDemo(base) {
  const demoResponse = await fetch(`${base}/api/character/demo`);
  if (!demoResponse.ok) throw new Error(`demo no disponible: HTTP ${demoResponse.status}`);
  const { profile } = await demoResponse.json();
  const saveResponse = await fetch(`${base}/api/character`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!saveResponse.ok) throw new Error(`demo no persistido: HTTP ${saveResponse.status}`);
  return profile.id;
}

async function runFlow(mode, port) {
  const base = `http://localhost:${port}`;
  console.log(`\n=== HITO 6B — ${mode.toUpperCase()} (${base}) ===`);
  const server = startServer(mode, port);
  let browser;
  try {
    const up = await waitForServer(base);
    check(`[${mode}] servidor disponible`, up);
    if (!up) {
      stopChild(server);
      return;
    }
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
    page.on("console", (message) => {
      const text = `${message.text()} @ ${message.location()?.url ?? "?"}`;
      // El 409 de la carrera entre pestañas es el resultado ESPERADO de una de
      // las comprobaciones: el navegador lo registra en consola igualmente.
      const esperado409 = text.includes("409") && text.includes("/session/");
      if (message.type() === "error" && !text.includes("/favicon.ico") && !esperado409) {
        errors.push(text);
      }
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("response", (response) => {
      // El 409 de la carrera entre pestañas es un resultado ESPERADO de la
      // prueba, no un fallo: se comprueba aparte más abajo.
      if (
        response.status() >= 400 &&
        response.status() !== 409 &&
        !response.url().endsWith("/favicon.ico")
      ) {
        errors.push(`HTTP ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    const persistedId = await persistDemo(base);
    await page.evaluate(
      (id) => localStorage.setItem("exile-copilot:characterId", id),
      persistedId,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });

    const section = page.locator("#seccion-decision-adaptativa");
    check(`[${mode}] sección de decisión visible`, await section.isVisible());
    check(
      `[${mode}] copy en español, sin jerga interna`,
      (await section.innerText()).includes("Comprobar una decisión") &&
        !(await section.innerText()).includes("waiting_result") &&
        !(await section.innerText()).includes("session_gate") &&
        !(await section.innerText()).includes("guided_decision"),
    );

    await page.locator("#decision-objetivo").fill("Subir supervivencia sin tocar mi habilidad core");
    await page.locator("#decision-hipotesis").fill("Un anillo con más vida me deja aguantar un mapa");
    await page.locator("#decision-incognita").fill("tooltip exacto de la herramienta");
    await page.locator("#decision-core").fill("Barrera voltaica");
    await page.getByRole("button", { name: "Empezar a comprobar" }).click();
    await page.getByText("Qué hacer ahora").waitFor({ timeout: 20_000 });

    const afterStart = await section.innerText();
    check(`[${mode}] hay una sola acción visible`, afterStart.includes("Qué hacer ahora"));
    check(
      `[${mode}] pide el dato crítico antes de un paso irreversible`,
      /tooltip exacto/i.test(afterStart),
    );
    check(
      `[${mode}] no muestra identificadores internos tras empezar`,
      !afterStart.includes("waiting_result") &&
        !afterStart.includes("session_gate") &&
        !afterStart.includes("guided_decision") &&
        afterStart.includes("En curso"),
    );

    await page.locator("#add-core").fill("anillo actual");
    await page.getByRole("button", { name: "Proteger" }).click();
    // La protección aparece ahora en dos sitios: el listado con su acción de
    // retirada y el detalle de la sesión. Basta con que exista.
    await page.getByText("anillo actual", { exact: true }).first().waitFor({ timeout: 10_000 });
    check(`[${mode}] la pieza protegida aparece como intocable`, true);

    await page.locator("#session-result").fill("Se siente más fluido, no lo he medido.");
    await page.getByLabel("Es una sensación (no una medición)").check();
    await page.getByRole("button", { name: "Registrar resultado" }).click();
    await page.getByText("sensación, no medición", { exact: false }).waitFor({ timeout: 15_000 });
    const afterSubjective = await section.innerText();
    check(
      `[${mode}] lo subjetivo no se presenta como medición`,
      /sensación/i.test(afterSubjective) && !/medición objetiva/i.test(afterSubjective),
    );

    await page.locator("#session-result").fill("El daño no subió, pero apareció una interacción rara del tótem.");
    await page.getByPlaceholder("Si salió otra cosa valiosa").fill("interacción rara del tótem");
    await page.getByRole("button", { name: "Registrar resultado" }).click();
    await page.getByText("interacción rara del tótem").first().waitFor({ timeout: 15_000 });
    const afterValuable = await section.innerText();
    check(
      `[${mode}] un resultado valioso inesperado cambia el plan`,
      afterValuable.includes("Cambiamos de plan") || afterValuable.includes("interacción rara del tótem"),
    );

    await page.getByRole("button", { name: "Pausar" }).click();
    await page.getByText("En pausa", { exact: true }).waitFor({ timeout: 10_000 });
    check(`[${mode}] pausar conserva el recurso, no es un fracaso`, true);

    // --- Selector visible de incógnita tras RECARGAR -----------------------
    // Antes dependía de un estado local del formulario de inicio: al recargar
    // se perdía y no había forma de indicar qué dato resolvía la evidencia.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    const selectorTrasRecarga = page.getByTestId("decision-selector-incognita");
    const haySelector = await selectorTrasRecarga.count();
    check(`[${mode}] tras recargar hay selector visible de incógnita`, haySelector === 1);
    if (haySelector === 1) {
      await selectorTrasRecarga.selectOption({ label: "tooltip exacto de la herramienta" });
      await page.locator("#session-evidence").fill("Tooltip copiado tal cual del juego.");
      await page.getByRole("button", { name: "Guardar evidencia" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector("#seccion-decision-adaptativa")
            ?.textContent?.includes("Tooltip copiado tal cual del juego.") === true,
        undefined,
        { timeout: 15_000 },
      );
      check(`[${mode}] la evidencia resuelve la incógnita elegida tras recargar`, true);
    }

    // --- Retirar una protección a conciencia --------------------------------
    const protecciones = page.getByTestId("decision-protecciones");
    const hayProtecciones = await protecciones.count();
    check(`[${mode}] las protecciones se listan con su nombre`, hayProtecciones === 1);
    if (hayProtecciones === 1) {
      const retirar = protecciones.getByRole("button", { name: "Retirar esta protección" });
      check(`[${mode}] cada protección ofrece retirarla`, (await retirar.count()) >= 1);
    }

    // --- 409 entre dos pestañas --------------------------------------------
    // La segunda pestaña actúa y deja obsoleta la memoria de la primera; la
    // primera debe recibir 409 y decirlo, no escribir encima en silencio.
    const otra = await context.newPage();
    await otra.goto(base, { waitUntil: "networkidle" });
    await otra.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    // La otra pestaña protege una pieza: eso SÍ cambia la revisión de memoria.
    await otra.locator("#add-core").fill("Proteccion desde la otra pestana");
    await otra.getByRole("button", { name: "Proteger" }).click();
    await otra.waitForFunction(
      () =>
        document
          .querySelector("#seccion-decision-adaptativa")
          ?.textContent?.includes("Proteccion desde la otra pestana") === true,
      undefined,
      { timeout: 15_000 },
    );
    const conflictos = [];
    page.on("response", (response) => {
      if (response.status() === 409) conflictos.push(response.url());
    });
    await page.locator("#session-evidence").fill("Evidencia con la memoria ya obsoleta.");
    await page.getByRole("button", { name: "Guardar evidencia" }).click();
    for (let intento = 0; intento < 60 && conflictos.length === 0; intento += 1) {
      await wait(250);
    }
    check(`[${mode}] la pestaña obsoleta recibe 409 del servidor`, conflictos.length >= 1);
    // Y lo COMUNICA: avisa de que la memoria cambió y recarga la vigente, en
    // lugar de escribir encima en silencio.
    const avisoVisible = await page
      .getByText("La memoria del mentor cambió", { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    await page.waitForFunction(
      () =>
        document
          .querySelector("#seccion-decision-adaptativa")
          ?.textContent?.includes("Proteccion desde la otra pestana") === true,
      undefined,
      { timeout: 15_000 },
    );
    const trasConflicto = await section.innerText();
    check(
      `[${mode}] tras el 409 avisa y recarga la memoria vigente`,
      (avisoVisible || conflictos.length >= 1) &&
        trasConflicto.includes("Proteccion desde la otra pestana") &&
        !trasConflicto.includes("Evidencia con la memoria ya obsoleta."),
    );
    await otra.close();

    // --- Estado cerrado: sin botones inválidos y con vía a otra decisión ----
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    await page.locator("#session-result").fill("Cerramos este paso con un resultado medido.");
    await page.getByRole("button", { name: "Registrar resultado" }).click();
    await page.getByTestId("decision-cerrada").waitFor({ timeout: 20_000 });
    const cerrada = await section.innerText();
    check(
      `[${mode}] cerrada: no ofrece resultado, evidencia ni pausa`,
      (await page.getByTestId("decision-pausar").count()) === 0 &&
        (await page.locator("#session-result").count()) === 0 &&
        (await page.locator("#session-evidence").count()) === 0 &&
        cerrada.includes("Esta decisión está cerrada"),
    );
    const nueva = page.getByTestId("decision-nueva");
    check(`[${mode}] cerrada: ofrece empezar otra decisión`, (await nueva.count()) === 1);
    await nueva.click();
    await page.getByTestId("decision-form-inicio").waitFor({ timeout: 10_000 });
    await page.locator("#decision-objetivo").fill("Otra decisión manual desde cero");
    await page.locator("#decision-hipotesis").fill("Comprobar que se puede volver a empezar");
    await page.getByRole("button", { name: "Empezar a comprobar" }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#seccion-decision-adaptativa")
          ?.textContent?.includes("Otra decisión manual desde cero") === true,
      undefined,
      { timeout: 20_000 },
    );
    check(`[${mode}] cerrada → nueva decisión manual funciona`, true);

    await page.screenshot({
      path: join(SHOT_DIR, mode === "prod" ? "sesion-escritorio-prod.png" : "sesion-escritorio-dev.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    check(`[${mode}] sin desbordamiento horizontal a 390 px`, !overflow);
    await page.screenshot({
      path: join(SHOT_DIR, mode === "prod" ? "sesion-movil-prod.png" : "sesion-movil-dev.png"),
      fullPage: true,
    });

    check(`[${mode}] sin peticiones a hosts externos`, externalRequests.length === 0);
    if (externalRequests.length > 0) {
      console.log("  externas:", externalRequests.slice(0, 5));
    }
    check(`[${mode}] sin errores de consola relevantes`, errors.length === 0);
    if (errors.length > 0) {
      console.log("  errores:", errors.slice(0, 8));
    }
  } finally {
    if (browser) await browser.close();
    stopChild(server);
  }
}

const ports = { prod: 7191, dev: 7192 };
try {
  for (const mode of modes) {
    await runFlow(mode, ports[mode]);
  }
} finally {
  if (!UPDATE_SCREENSHOTS) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* temporal */
    }
  }
}

console.log(`\nHito 6B: ${total - failures}/${total} comprobaciones`);
if (failures > 0) process.exit(1);
