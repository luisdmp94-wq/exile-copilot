/**
 * Prueba de navegador de la ACADEMIA DE CRAFTING — BÁSICO Y AVANZADO.
 *
 * Uso:
 *   node scripts/academy-smoke.mjs                      → producción (requiere build previo)
 *   node scripts/academy-smoke.mjs --dev                → desarrollo (Vite + Strict Mode)
 *   node scripts/academy-smoke.mjs --all                → ambos
 *   node scripts/academy-smoke.mjs --update-screenshots → además actualiza docs/screenshots/
 *
 * Arranca su propio servidor en su propio puerto y con su propia base SQLite
 * temporal: no toca la base real ni ningún servidor que ya estuviera en marcha.
 *
 * COMPROBACIONES:
 *   1. La entrada a Crafting ofrece las dos opciones reales.
 *   2. La Academia se abre sin exigir personaje y permite cambiar de nivel.
 *   3. Cada situación muestra objeto, una pregunta y entre 2 y 4 decisiones.
 *   4. Un fallo se corrige con color Y texto, y no bloquea el recorrido.
 *   5. Un acierto se confirma con color Y texto.
 *   6. Transmutación, Aumento, Regio, Exaltado y Parar aparecen en el recorrido.
 *   7. La prueba final detecta conceptos pendientes y ofrece repasarlos.
 *   8. El progreso sobrevive a una recarga.
 *   9. Un progreso corrupto se descarta sin romper la Academia.
 *  10. Reiniciar exige confirmación explícita.
 *  11. «Practicar con mi objeto» conserva personaje, objeto elegido y sesión.
 *  12. El banco anterior sigue funcionando igual.
 *  13. 390 px sin desbordamiento horizontal.
 *  14. Teclado, foco tras responder y prefers-reduced-motion.
 *  15. El nivel avanzado recorre contrato, protección, salida y riesgos.
 *  16. Sin peticiones externas ni errores de consola relevantes.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSmokeTempDir,
  launchBrowser,
  removeSmokeTempDir,
  toolCommand,
} from "./browserLaunch.mjs";

const TEMP_ROOT = createSmokeTempDir("academia");
const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all") ? ["prod", "dev"] : args.includes("--dev") ? ["dev"] : ["prod"];

const SHOT_DIR = UPDATE_SCREENSHOTS
  ? join(REPO, "docs", "screenshots")
  : join(TEMP_ROOT, "capturas");
mkdirSync(SHOT_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const dbPathFor = (mode) => join(TEMP_ROOT, `${mode}.db`);
const basenameSeguro = (ruta) => ruta.split(/[\\/]/).pop();

async function waitForServer(base) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch {
      /* aún no está listo */
    }
    await wait(500);
  }
  return false;
}

async function waitForFile(path, attempts = 50) {
  for (let index = 0; index < attempts; index += 1) {
    if (existsSync(path)) return true;
    await wait(100);
  }
  return false;
}

function startServer(mode, port) {
  const { command, args: cmdArgs, shell } =
    mode === "prod"
      ? toolCommand("tsx", ["server/index.ts"])
      : toolCommand("vite", ["--port", String(port), "--strictPort"]);
  const proc = spawn(command, cmdArgs, {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: mode === "prod" ? "production" : "development",
      POE_NINJA_OFFLINE: "true",
      DATABASE_PATH: dbPathFor(mode),
    },
    shell,
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stderr.on("data", () => {});
  return proc;
}

function stopServer(proc) {
  try {
    execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
  } catch {
    try {
      proc.kill();
    } catch {
      /* ya detenido */
    }
  }
}

let failures = 0;
let total = 0;
const check = (name, ok) => {
  total += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failures += 1;
};

async function irA(page, area) {
  await page.getByTestId(`tab-${area}`).click();
  await page.waitForFunction(
    (a) =>
      document.querySelector(`[data-testid="tab-${a}"]`)?.getAttribute("data-state") === "active",
    area,
    { timeout: 10000 },
  );
}

/** Deja un personaje demo guardado y restaurable por el frontend. */
async function seedProfile(base) {
  const demo = await (await fetch(`${base}/api/character/demo`)).json();
  const profile = { ...demo.profile, id: "academia-smoke-perfil" };
  const saved = await fetch(`${base}/api/character`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!saved.ok) throw new Error(`no se pudo sembrar el personaje: HTTP ${saved.status}`);
  return profile;
}

/** Responde el escenario actual eligiendo la opción indicada y continúa. */
async function responder(page, optionTestId) {
  await page.getByTestId(optionTestId).click();
  await page.getByTestId("academia-feedback").waitFor({ timeout: 10000 });
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== ACADEMIA — MODO ${mode.toUpperCase()} (${BASE}) ===`);
  const proc = startServer(mode, port);
  let browser;
  try {
    check(`[${mode}] servidor responde /api/health`, await waitForServer(BASE));
    const dbPath = dbPathFor(mode);
    check(
      `[${mode}] base SQLite temporal y aislada (${basenameSeguro(dbPath)})`,
      (await waitForFile(dbPath)) && dbPath.startsWith(TEMP_ROOT) && !dbPath.startsWith(REPO),
    );

    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    const externas = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externas.push(`${req.resourceType()} ${url}`);
      }
    });
    const esFaviconAusente = (texto) => texto.includes("/favicon.ico");
    const erroresConsola = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(msg.text() + " @ " + (msg.location()?.url ?? "?"));
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));
    page.on("response", (res) => {
      if (res.status() >= 400) erroresConsola.push(`HTTP ${res.status()} ${res.url()}`);
    });

    // --- 1. Entrada a Crafting: dos opciones, sin personaje --------------
    await page.goto(BASE, { waitUntil: "networkidle" });
    await irA(page, "crafting");
    const chooser = page.getByTestId("crafting-mode-chooser");
    await chooser.waitFor({ timeout: 15000 });
    check(
      `[${mode}] la entrada a Crafting ofrece aprender o pedir ayuda con mi objeto`,
      (await page.getByTestId("crafting-mode-academy").isVisible()) &&
        (await page.getByTestId("crafting-mode-coach").isVisible()) &&
        (await page.getByTestId("crafting-mode-coach").getAttribute("data-active")) === "true",
    );
    await page.screenshot({ path: join(SHOT_DIR, `academia-entrada-${mode}.png`), fullPage: false });

    await page.getByTestId("crafting-mode-academy").click();
    const academia = page.getByTestId("academia-crafting");
    await academia.waitFor({ timeout: 15000 });
    check(
      `[${mode}] la Academia se abre sin exigir personaje`,
      (await academia.getAttribute("data-stage")) === "intro" &&
        (await page.getByTestId("academia-indice").locator("li").count()) === 5,
    );

    // --- 1b. Nivel avanzado completo ------------------------------------
    check(
      `[${mode}] el selector ofrece Básico y Avanzado sin habilitar Medio`,
      (await page.getByTestId("academia-nivel-basico").isVisible()) &&
        (await page.getByTestId("academia-nivel-avanzado").isVisible()) &&
        (await page.getByRole("button", { name: "Nivel medio, en preparación" }).isDisabled()),
    );
    await page.getByTestId("academia-nivel-avanzado").click();
    const avanzada = page.getByTestId("academia-avanzada");
    await avanzada.waitFor({ timeout: 10000 });
    check(
      `[${mode}] el nivel avanzado presenta seis casos y su evidencia`,
      (await avanzada.getAttribute("data-stage")) === "intro" &&
        (await page.getByTestId("academia-avanzada-indice").locator("li").count()) === 6 &&
        (await avanzada.innerText()).includes("casos son sintéticos"),
    );
    await page.getByTestId("academia-avanzada-empezar").click();
    const respuestasAvanzadas = [
      "av-definir-salida",
      "av-aumento",
      "av-pedir-tooltip",
      "av-parar",
      "av-recopiar",
      "av-comparar",
    ];
    for (const opcion of respuestasAvanzadas) {
      await page.getByTestId(`academia-avanzada-opcion-${opcion}`).click();
      const feedback = page.getByTestId("academia-avanzada-feedback");
      await feedback.waitFor({ timeout: 10000 });
      check(
        `[${mode}] caso avanzado ${opcion} se corrige con evidencia`,
        (await feedback.getAttribute("data-result")) === "correcto" &&
          (await feedback.innerText()).includes("Idea que te llevas"),
      );
      await page.getByTestId("academia-avanzada-continuar").click();
    }
    await page.getByTestId("academia-avanzada-resultado").waitFor({ timeout: 10000 });
    check(
      `[${mode}] el nivel avanzado termina y permite llevarlo al laboratorio`,
      (await avanzada.getAttribute("data-stage")) === "results" &&
        (await page.getByTestId("academia-avanzada-resultado").innerText()).includes("6 de 6") &&
        (await page.getByTestId("academia-avanzada-practicar").isVisible()),
    );
    await page.getByRole("button", { name: "Volver a niveles" }).click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 10000 });
    check(
      `[${mode}] volver desde Avanzado conserva el nivel básico disponible`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "intro",
    );

    // --- 2. Recorrido de lecciones ---------------------------------------
    await page.getByTestId("academia-empezar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    await page.screenshot({ path: join(SHOT_DIR, `academia-leccion-${mode}.png`), fullPage: false });

    const opcionesPrimera = await page.locator('[data-testid^="academia-opcion-"]').count();
    check(
      `[${mode}] la primera situación ofrece entre 2 y 4 decisiones (${opcionesPrimera})`,
      opcionesPrimera >= 2 && opcionesPrimera <= 4,
    );
    check(
      `[${mode}] la situación muestra el objeto marcado como ejercicio`,
      (await page.getByTestId("academia-objeto").isVisible()) &&
        (await page.getByTestId("academia-objeto").innerText()).includes("Ejercicio de aprendizaje"),
    );

    // 2a. Fallo deliberado en la lección 1: rareza «Normal» sobre un raro.
    await responder(page, "academia-opcion-normal");
    const feedbackFallo = page.getByTestId("academia-feedback");
    const textoFallo = await feedbackFallo.innerText();
    check(
      `[${mode}] un fallo se corrige con color Y texto`,
      (await feedbackFallo.getAttribute("data-result")) === "incorrecto" &&
        textoFallo.includes("No era esa") &&
        textoFallo.length > 60,
    );
    check(
      `[${mode}] tras fallar, el foco queda en la corrección`,
      await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") === "academia-feedback",
      ),
    );
    check(
      `[${mode}] la opción correcta queda señalada aunque hayas fallado`,
      (await page.getByTestId("academia-opcion-rare").getAttribute("data-state")) === "correcta",
    );
    await page.screenshot({ path: join(SHOT_DIR, `academia-fallo-${mode}.png`), fullPage: false });
    check(
      `[${mode}] fallar no bloquea: se puede continuar`,
      await page.getByTestId("academia-continuar").isEnabled(),
    );

    await page.getByTestId("academia-continuar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    check(
      `[${mode}] al avanzar, el foco vuelve a la pregunta`,
      await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") === "academia-pregunta",
      ),
    );

    // 2b. Acierto con TECLADO en la lección 1.2 (prefijos: 2).
    await page.getByTestId("academia-opcion-dos").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("academia-feedback").waitFor({ timeout: 10000 });
    const textoAcierto = await page.getByTestId("academia-feedback").innerText();
    check(
      `[${mode}] se puede responder con teclado y el acierto se confirma con color Y texto`,
      (await page.getByTestId("academia-feedback").getAttribute("data-result")) === "correcto" &&
        textoAcierto.includes("Correcto"),
    );
    await page.screenshot({ path: join(SHOT_DIR, `academia-acierto-${mode}.png`), fullPage: false });

    // 2c. Resto de lecciones, siempre con la respuesta correcta.
    const restoDeLecciones = [
      "academia-opcion-caben",
      "academia-opcion-transmutation",
      "academia-opcion-augmentation",
      "academia-opcion-no-limite",
      "academia-opcion-regal",
      "academia-opcion-stop",
      "academia-opcion-exalted",
      "academia-opcion-stop",
    ];
    const monedasVistas = new Set();
    for (const opcion of restoDeLecciones) {
      await page.getByTestId("academia-continuar").click();
      await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
      const etiquetas = await page.locator('[data-testid^="academia-opcion-"]').allInnerTexts();
      for (const etiqueta of etiquetas) {
        if (etiqueta.includes("transmutación")) monedasVistas.add("transmutacion");
        if (etiqueta.includes("aumento")) monedasVistas.add("aumento");
        if (etiqueta.includes("regio")) monedasVistas.add("regio");
        if (etiqueta.includes("exaltado")) monedasVistas.add("exaltado");
        if (etiqueta.includes("Parar")) monedasVistas.add("parar");
      }
      await responder(page, opcion);
      check(
        `[${mode}] acierto en ${opcion.replace("academia-opcion-", "")}`,
        (await page.getByTestId("academia-feedback").getAttribute("data-result")) === "correcto",
      );
    }
    check(
      `[${mode}] el recorrido cubre las cuatro monedas y Parar (${[...monedasVistas].sort().join(", ")})`,
      ["aumento", "exaltado", "parar", "regio", "transmutacion"].every((clave) =>
        monedasVistas.has(clave),
      ),
    );

    // --- 3. Prueba final --------------------------------------------------
    await page.getByTestId("academia-continuar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    check(
      `[${mode}] la prueba final arranca tras las lecciones`,
      (await academia.getAttribute("data-stage")) === "exam" &&
        (await page.getByTestId("academia-progreso").innerText()) === "1 de 6",
    );
    await page.screenshot({ path: join(SHOT_DIR, `academia-prueba-${mode}.png`), fullPage: false });

    // Falla el primero a propósito para comprobar los conceptos pendientes.
    await responder(page, "academia-opcion-regal");
    await page.getByTestId("academia-continuar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    const examenRestante = [
      "academia-opcion-augmentation",
      "academia-opcion-regal",
      "academia-opcion-exalted",
      "academia-opcion-stop",
      "academia-opcion-stop",
    ];
    for (let i = 0; i < examenRestante.length; i += 1) {
      await responder(page, examenRestante[i]);
      await page.getByTestId("academia-continuar").click();
      if (i < examenRestante.length - 1) {
        await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
      }
    }

    await page.getByTestId("academia-pendientes").waitFor({ timeout: 10000 });
    check(
      `[${mode}] el resultado detecta el concepto pendiente y no lo llama probabilidad`,
      (await academia.getAttribute("data-stage")) === "results" &&
        (await page.getByTestId("academia-pendiente-transmutacion").isVisible()) &&
        (await page.getByTestId("academia-resultado-resumen").innerText()).includes(
          "no es una probabilidad de crafting",
        ),
    );
    await page.screenshot({
      path: join(SHOT_DIR, `academia-resultado-${mode}.png`),
      fullPage: false,
    });
    check(
      `[${mode}] el resultado ofrece repasar solo lo pendiente`,
      (await page.getByTestId("academia-repasar").innerText()).includes("(1)"),
    );

    // --- 4. Persistencia --------------------------------------------------
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("crafting-mode-academy").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 15000 });
    check(
      `[${mode}] el progreso sobrevive a una recarga`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "results" &&
        (await page.getByTestId("academia-pendiente-transmutacion").isVisible()),
    );

    // Repaso solo del concepto fallado.
    await page.getByTestId("academia-repasar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    check(
      `[${mode}] el repaso solo pregunta lo pendiente`,
      (await page.getByTestId("academia-progreso").innerText()) === "1 de 1",
    );
    await responder(page, "academia-opcion-transmutation");
    await page.getByTestId("academia-continuar").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 10000 });
    check(
      `[${mode}] al corregir el concepto, deja de figurar como pendiente`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "results" &&
        (await page.getByTestId("academia-pendientes").count()) === 0,
    );

    // --- 5. Progreso corrupto --------------------------------------------
    await page.evaluate(() =>
      localStorage.setItem("exile-copilot:academia-crafting:v1", "{esto no es json"),
    );
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("crafting-mode-academy").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 15000 });
    check(
      `[${mode}] un progreso corrupto se descarta y la Academia arranca limpia`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "intro" &&
        (await page.evaluate(() =>
          localStorage.getItem("exile-copilot:academia-crafting:v1"),
        )) === null,
    );
    // Forma válida como JSON pero inválida como progreso.
    await page.evaluate(() =>
      localStorage.setItem(
        "exile-copilot:academia-crafting:v1",
        JSON.stringify({ schemaVersion: 9, stage: "otro", cursor: -3 }),
      ),
    );
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("crafting-mode-academy").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 15000 });
    check(
      `[${mode}] un progreso con forma inválida también se descarta sin romper`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "intro",
    );

    // --- 6. Reinicio con confirmación ------------------------------------
    await page.getByTestId("academia-empezar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    await responder(page, "academia-opcion-rare");
    await page.getByTestId("academia-continuar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    await page.getByTestId("academia-reiniciar").click();
    await page.getByTestId("academia-reiniciar-dialogo").waitFor({ timeout: 10000 });
    await page.getByTestId("academia-reiniciar-cancelar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    check(
      `[${mode}] cancelar la confirmación conserva el progreso`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "lesson" &&
        (await page.getByTestId("academia-progreso").innerText()) === "2 de 10",
    );
    await page.getByTestId("academia-reiniciar").click();
    await page.getByTestId("academia-reiniciar-dialogo").waitFor({ timeout: 10000 });
    await page.getByTestId("academia-reiniciar-confirmar").click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="academia-crafting"]')?.getAttribute("data-stage") ===
        "intro",
      undefined,
      { timeout: 10000 },
    );
    check(
      `[${mode}] confirmar reinicia el nivel y borra el progreso guardado`,
      (await page.evaluate(() => localStorage.getItem("exile-copilot:academia-crafting:v1"))) ===
        null,
    );

    // --- 7. Móvil ---------------------------------------------------------
    await page.getByTestId("academia-empezar").click();
    await page.getByTestId("academia-pregunta").waitFor({ timeout: 10000 });
    for (const ancho of [375, 390]) {
      await page.setViewportSize({ width: ancho, height: 844 });
      await wait(220);
      const medidas = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      check(
        `[${mode}] la Academia no desborda horizontalmente a ${ancho} px (${medidas.client}/${medidas.scroll})`,
        medidas.scroll <= medidas.client + 1,
      );
    }
    await page.screenshot({ path: join(SHOT_DIR, `academia-movil-${mode}.png`), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // --- 8. Movimiento reducido ------------------------------------------
    const reducedContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const reducedPage = await reducedContext.newPage();
    try {
      await reducedPage.goto(BASE, { waitUntil: "networkidle" });
      await irA(reducedPage, "crafting");
      await reducedPage.getByTestId("crafting-mode-academy").click();
      await reducedPage.getByTestId("academia-empezar").click();
      await reducedPage.getByTestId("academia-pregunta").waitFor({ timeout: 15000 });
      const transiciones = await reducedPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid^="academia-opcion-"]')).map(
          (element) => getComputedStyle(element).transitionProperty,
        ),
      );
      check(
        `[${mode}] con prefers-reduced-motion las decisiones no animan (${transiciones[0] ?? "?"})`,
        transiciones.length > 0 && transiciones.every((valor) => valor === "none"),
      );
    } finally {
      await reducedContext.close();
    }

    // --- 9. Volver al banco conservando el estado ------------------------
    const profile = await seedProfile(BASE);
    await page.evaluate((id) => localStorage.setItem("exile-copilot:characterId", id), profile.id);
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    const banco = page.getByTestId("crafting-workspace");
    check(
      `[${mode}] el banco no compite con la recomendación: arranca plegado`,
      (await banco.isVisible()) === false &&
        (await page.getByTestId("crafting-avanzado-toggle").getAttribute("data-open")) === "false",
    );
    await page.getByTestId("crafting-avanzado-toggle").click();
    await banco.waitFor({ timeout: 20000 });
    check(
      `[${mode}] el banco anterior sigue funcionando igual al desplegarlo`,
      (await banco.innerText()).includes("Banco de crafting") &&
        (await page.getByTestId("crafting-route").count()) === 1,
    );
    // Elige una pieza distinta de la primera para poder comprobar que se conserva.
    const piezas = page.locator('[data-testid^="crafting-item-"]');
    const segundaPieza = piezas.nth(1);
    const idSegunda = await segundaPieza.getAttribute("data-testid");
    await segundaPieza.click();
    await page.waitForFunction(
      (id) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute("data-active") === "true",
      idSegunda,
      { timeout: 10000 },
    );

    await page.getByTestId("crafting-mode-academy").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 15000 });
    check(
      `[${mode}] entrar en la Academia no descarga el banco`,
      (await page.getByTestId("crafting-workspace").count()) === 1,
    );
    await page.getByTestId("academia-practicar").click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 15000 });
    const perfilTrasVolver = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    check(
      `[${mode}] «Practicar con mi objeto» conserva personaje, pieza elegida y banco`,
      (await page.getByTestId(idSegunda).getAttribute("data-active")) === "true" &&
        (await banco.innerText()).includes("Banco de crafting") &&
        perfilTrasVolver === profile.id,
    );
    const journal = await (await fetch(`${BASE}/api/journal/${profile.id}`)).json();
    check(
      `[${mode}] la Academia no ha tocado el diario ni las sesiones`,
      journal.session === null && (journal.pausedSessions ?? []).length === 0,
    );

    // --- 10. Recursos y consola ------------------------------------------
    check(`[${mode}] sin peticiones a hosts externos (${externas.length})`, externas.length === 0);
    if (externas.length > 0) console.log("   externas:", externas.slice(0, 5));
    const imgs = await page.evaluate(() =>
      Array.from(document.images).map((i) => i.currentSrc || i.src),
    );
    check(
      `[${mode}] sin <img> remotas (${imgs.length} imágenes)`,
      imgs.every((s) => s.startsWith("data:") || s.startsWith(location.origin)),
    );
    const erroresRelevantes = erroresConsola.filter((e) => !esFaviconAusente(e));
    check(
      `[${mode}] sin errores de consola relevantes (${erroresRelevantes.length})`,
      erroresRelevantes.length === 0,
    );
    if (erroresRelevantes.length > 0) console.log("   consola:", erroresRelevantes.slice(0, 3));
    await context.close();
  } catch (err) {
    console.error(`ERROR en el smoke de la Academia (${mode}):`, err.message);
    failures += 1;
    total += 1;
  } finally {
    if (browser) await browser.close();
    stopServer(proc);
  }
}

try {
  for (const mode of modes) {
    await runFlow(mode, mode === "prod" ? 7193 : 7192);
  }
} finally {
  removeSmokeTempDir(TEMP_ROOT);
}

console.log(
  `\nCapturas en: ${SHOT_DIR}${UPDATE_SCREENSHOTS ? " (versionadas)" : " (temporal; usa --update-screenshots para actualizar docs/)"}`,
);
console.log(
  failures === 0
    ? `\nACADEMIA — BÁSICO Y AVANZADO: ${total}/${total} COMPROBACIONES PASARON`
    : `\nACADEMIA — BÁSICO Y AVANZADO: ${failures} de ${total} COMPROBACIONES FALLARON`,
);
process.exit(failures === 0 ? 0 : 1);
