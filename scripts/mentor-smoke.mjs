/**
 * Prueba de navegador del Hito 6A — «Habla con tu mentor».
 *
 * Uso:
 *   node scripts/mentor-smoke.mjs          → producción (requiere `npm run build`)
 *   node scripts/mentor-smoke.mjs --dev    → desarrollo (Vite + React Strict Mode)
 *   node scripts/mentor-smoke.mjs --all    → ambos
 *   node scripts/mentor-smoke.mjs --update-screenshots → guarda capturas en docs/screenshots/
 *
 * Aislamiento: cada modo usa su propia base SQLite en un directorio temporal
 * (DATABASE_PATH) y su propio puerto; los servidores se detienen al terminar.
 * NUNCA toca la base real ni un servidor que ya estuviera en marcha.
 * Las capturas van a un temporal salvo con --update-screenshots, así que
 * ejecutar la prueba no ensucia el árbol de Git.
 *
 * COMPROBACIONES (por modo):
 *   1. servidor responde /api/health
 *   2. sin personaje, el mentor lo dice honestamente y no inventa
 *   3. la sección ofrece sugerencias reconocidas
 *   4. «¿Qué mejoro ahora?» responde con UNA sola próxima acción
 *   5. la respuesta muestra fuentes
 *   6. la respuesta muestra confianza
 *   7. la respuesta muestra «falta por verificar»
 *   8. el turno del jugador y el del mentor se distinguen
 *   9. «¿Cuál es mi principal problema?» explica la prioridad
 *  10. una pregunta no soportada se declara como tal y ofrece ejemplos
 *  11. una pregunta no soportada no propone ninguna acción
 *  12. el texto malicioso se muestra como TEXTO, nunca como HTML
 *  13. guardar la acción invalida la conversación (cambia la revisión del diario)
 *  14. la acción guardada aparece como acción activa del diario
 *  15. con acción activa el mentor RECUERDA el paso y no crea otro
 *  16. con acción activa no se ofrece volver a guardarla
 *  17. cambiar el presupuesto reinicia la conversación
 *  17. sin peticiones a hosts externos
 *  18. sin errores de consola relevantes
 *  19-21. sin desbordamiento horizontal a 320/360/390 px
 *  22. el campo de pregunta es accesible por teclado y envía con Enter
 */
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all") ? ["prod", "dev"] : args.includes("--dev") ? ["dev"] : ["prod"];

const tempRoot = mkdtempSync(join(tmpdir(), "exile-copilot-6a-"));
const SHOT_DIR = UPDATE_SCREENSHOTS ? join(REPO, "docs", "screenshots") : tempRoot;
mkdirSync(SHOT_DIR, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

function startServer(mode, port) {
  const cmd = mode === "prod" ? ["tsx", "server/index.ts"] : ["vite", "--port", String(port), "--strictPort"];
  const proc = spawn("npx", cmd, {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: mode === "prod" ? "production" : "development",
      POE_NINJA_OFFLINE: "true",
      // Base SQLite propia y temporal: jamás se usa la real.
      DATABASE_PATH: join(tempRoot, `${mode}.db`),
    },
    shell: true,
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

async function preguntar(page, texto) {
  await page.locator("#mentor-pregunta").fill(texto);
  await page.getByTestId("mentor-preguntar").click();
  await page.getByTestId("mentor-cargando").waitFor({ state: "detached", timeout: 25000 });
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== HITO 6A — MODO ${mode.toUpperCase()} (${BASE}) ===`);
  const proc = startServer(mode, port);
  let browser;
  try {
    check(`[${mode}] servidor responde /api/health`, await waitForServer(BASE));

    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    const externas = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externas.push(`${req.resourceType()} ${url}`);
      }
    });
    const erroresConsola = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(`${msg.text()} @ ${msg.location()?.url ?? "?"}`);
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));

    await page.goto(BASE, { waitUntil: "networkidle" });

    // --- Sin personaje: honestidad ----------------------------------------
    const seccion = page.locator("#seccion-mentor-chat");
    await seccion.waitFor({ timeout: 20000 });
    const sinPersonaje = await seccion.innerText();
    check(
      `[${mode}] sin personaje el mentor lo dice y no improvisa`,
      sinPersonaje.includes("Necesitas un personaje primero") &&
        sinPersonaje.includes("no voy a improvisar"),
    );

    await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20000 });

    check(
      `[${mode}] la sección ofrece sugerencias reconocidas`,
      (await page.getByTestId("mentor-sugerencia").count()) >= 3,
    );

    // --- next_improvement --------------------------------------------------
    await preguntar(page, "¿Qué mejoro ahora?");
    const proximaAccion = page.getByTestId("mentor-proxima-accion");
    await proximaAccion.first().waitFor({ timeout: 20000 });
    check(
      `[${mode}] «¿Qué mejoro ahora?» responde con UNA sola próxima acción`,
      (await proximaAccion.count()) === 1,
    );
    const textoMentor = await seccion.innerText();
    check(`[${mode}] la respuesta muestra fuentes`, /fuentes/i.test(textoMentor));
    check(`[${mode}] la respuesta muestra confianza`, /confianza/i.test(textoMentor));
    check(
      `[${mode}] la respuesta muestra «falta por verificar»`,
      (await page.getByTestId("mentor-no-verificado").count()) >= 1,
    );
    check(
      `[${mode}] los turnos de jugador y mentor se distinguen`,
      (await page.getByTestId("mentor-turno-jugador").count()) >= 1 &&
        (await page.getByTestId("mentor-turno-mentor").count()) >= 1,
    );

    // --- explain_priority --------------------------------------------------
    await preguntar(page, "¿Cuál es mi principal problema?");
    check(
      `[${mode}] «¿Cuál es mi principal problema?» explica la prioridad`,
      (await seccion.innerText()).includes("Tu principal problema ahora es"),
    );

    // --- unsupported -------------------------------------------------------
    await preguntar(page, "¿Cuánto vale mi arma en el mercado?");
    const trasNoSoportada = await seccion.innerText();
    check(
      `[${mode}] una pregunta no soportada se declara como tal`,
      trasNoSoportada.includes("Todavía no sé responder eso"),
    );
    check(
      `[${mode}] la pregunta no soportada no añade otra próxima acción`,
      (await page.getByTestId("mentor-proxima-accion").count()) === 2,
    );

    // --- XSS: el texto se muestra como TEXTO -------------------------------
    const payload = '<img src=x onerror=alert(1)><b>negrita</b>';
    await preguntar(page, payload);
    const turnoJugador = page.getByTestId("mentor-turno-jugador").last();
    check(
      `[${mode}] el texto malicioso se muestra como texto, nunca como HTML`,
      (await turnoJugador.innerText()).includes("<img src=x onerror=alert(1)>") &&
        (await turnoJugador.locator("img, b").count()) === 0,
    );

    // --- Guardar la acción en el diario ------------------------------------
    await preguntar(page, "¿Qué mejoro ahora?");
    const guardar = page.getByTestId("mentor-guardar-accion");
    await guardar.waitFor({ timeout: 20000 });
    await guardar.click();
    // Guardar cambia la revisión del diario, así que el hilo se reinicia solo:
    // esa es justamente la invalidación por cambio de inputs.
    await page
      .getByTestId("mentor-turno-mentor")
      .first()
      .waitFor({ state: "detached", timeout: 25000 });
    check(
      `[${mode}] guardar la acción invalida la conversación (cambia el diario)`,
      (await page.getByTestId("mentor-turno-mentor").count()) === 0,
    );
    const diario = await page.locator("#seccion-mentor").innerText().catch(() => "");
    check(
      `[${mode}] la acción guardada aparece como acción activa del diario`,
      /acci[óo]n activa|en curso|esperando resultado/i.test(diario),
    );

    // --- Con acción activa el mentor recuerda ------------------------------
    await preguntar(page, "¿Qué mejoro ahora?");
    const conAccionActiva = await seccion.innerText();
    check(
      `[${mode}] con acción activa el mentor RECUERDA el paso en curso`,
      conAccionActiva.includes("Ya tienes una acción en marcha"),
    );
    check(
      `[${mode}] con acción activa no se ofrece volver a guardarla`,
      (await page.getByTestId("mentor-guardar-accion").count()) === 0 &&
        (await page.getByTestId("mentor-accion-recordada").count()) === 1,
    );

    await page.screenshot({ path: join(SHOT_DIR, `mentor-escritorio-${mode}.png`), fullPage: true });

    // --- Invalidación por otro input relevante -----------------------------
    check(
      `[${mode}] hay conversación antes de cambiar los inputs`,
      (await page.getByTestId("mentor-turno-mentor").count()) > 0,
    );
    await page.locator("#market-budget").fill("777");
    await page.locator("#market-budget").blur();
    await wait(1000);
    check(
      `[${mode}] cambiar el presupuesto reinicia la conversación`,
      (await page.getByTestId("mentor-turno-mentor").count()) === 0,
    );

    // --- Responsive ---------------------------------------------------------
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await wait(400);
      const medida = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      check(
        `[${mode}] ${width} px sin desbordamiento horizontal (client ${medida.client} / scroll ${medida.scroll})`,
        medida.scroll <= medida.client + 1,
      );
    }

    // --- Teclado ------------------------------------------------------------
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator("#mentor-pregunta").focus();
    const enfocado = await page.evaluate(() => document.activeElement?.id ?? null);
    await page.keyboard.type("¿Qué mejoro ahora?");
    await page.keyboard.press("Enter");
    await page.getByTestId("mentor-cargando").waitFor({ state: "detached", timeout: 25000 });
    check(
      `[${mode}] el campo es accesible por teclado y Enter envía la pregunta`,
      enfocado === "mentor-pregunta" &&
        (await page.getByTestId("mentor-turno-mentor").count()) >= 1,
    );
    await page.screenshot({ path: join(SHOT_DIR, `mentor-movil-${mode}.png`), fullPage: true });

    // --- Recursos externos y consola ---------------------------------------
    check(`[${mode}] sin peticiones a hosts externos (${externas.length})`, externas.length === 0);
    if (externas.length > 0) console.log("   externas:", externas.slice(0, 5));
    // El 404 de /favicon.ico del servidor de desarrollo es preexistente y ajeno
    // a este hito; se excluye por URL exacta para no enmascarar otros errores.
    const relevantes = erroresConsola.filter((e) => !e.includes("/favicon.ico"));
    check(`[${mode}] sin errores de consola relevantes (${relevantes.length})`, relevantes.length === 0);
    if (relevantes.length > 0) console.log("   consola:", relevantes.slice(0, 3));
  } catch (err) {
    console.error(`ERROR en el smoke del Hito 6A (${mode}):`, err.message);
    failures += 1;
    total += 1;
  } finally {
    if (browser) await browser.close();
    stopServer(proc);
  }
}

for (const mode of modes) {
  await runFlow(mode, mode === "prod" ? 7183 : 7182);
}

console.log(
  `\nCapturas en: ${SHOT_DIR}${UPDATE_SCREENSHOTS ? " (versionadas)" : " (temporal)"}`,
);
if (!UPDATE_SCREENSHOTS) {
  try {
    rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    /* el sistema limpiará el temporal */
  }
}
console.log(
  failures === 0
    ? `\nHITO 6A: ${total}/${total} COMPROBACIONES PASARON`
    : `\nHITO 6A: ${failures} de ${total} COMPROBACIONES FALLARON`,
);
process.exit(failures === 0 ? 0 : 1);
