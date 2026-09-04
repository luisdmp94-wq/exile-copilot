/**
 * Prueba de navegador del Hito 4B — «Visualización contextual del equipo».
 *
 * Uso:
 *   node scripts/equipment-smoke.mjs                     → producción (requiere `npm run build`)
 *   node scripts/equipment-smoke.mjs --dev               → servidor de desarrollo (Strict Mode)
 *   node scripts/equipment-smoke.mjs --all               → ambos
 *   node scripts/equipment-smoke.mjs --update-screenshots → además actualiza docs/screenshots/
 *
 * Por defecto las capturas se escriben en un directorio temporal del sistema,
 * de modo que ejecutar la prueba NUNCA ensucia el árbol de Git. Solo con
 * `--update-screenshots` se sobrescriben las capturas versionadas.
 *
 * Arranca su propio servidor en un puerto propio y lo detiene al terminar:
 * no toca ningún servidor que ya estuviera en marcha (p. ej. el 7100).
 *
 * COMPROBACIONES (en orden de ejecución):
 *   1. servidor responde /api/health
 *   2. paperdoll: huecos ocupados del perfil demo
 *   3. paperdoll: ranuras vacías representadas
 *   4. las ranuras vacías dicen «Ranura vacía»
 *   5. rareza expresada también como texto
 *   6. procedencia visible en el hueco
 *   7. diagnóstico con recuentos reales
 *   8. sin puntuaciones ni afinidad inventadas
 *   9. las pistas de un plan `.build` no aparecen como equipo
 *  10. el hueco es enfocable por teclado
 *  11. Enter abre el detalle
 *  12. el detalle muestra nombre y base
 *  13. el detalle separa los tipos de modificador
 *  14. el detalle muestra requisitos
 *  15. el detalle muestra una ilustración local del objeto
 *  16. el detalle lleva al banco sin duplicar el planificador
 *  17. el detalle compacto no convierte datos parciales en ceros
 *  19. el detalle muestra procedencia
 *  20. el foco queda atrapado dentro del diálogo
 *  19. Escape cierra el detalle
 *  20. Escape devuelve el foco al HUECO que lo abrió
 *  21. los datos desconocidos se declaran «Desconocido»
 *  22. varios frascos se agrupan a partir de datos reales
 *  23. un objeto duplicado/extra aparece en «Otros objetos»
 *  24. el botón «Ver el objeto evaluado» solo existe con vínculo estructurado
 *  25. la navegación recomendación → objeto abre el detalle
 *  26. Escape devuelve el foco al BOTÓN de la recomendación
 *  27. hay huecos resaltados por vínculo estructurado
 *  28. objeto → «Ver recomendaciones» activa el área Mentor
 *  29. la sección de recomendaciones queda visible y ENFOCADA
 *  30. el foco no queda dentro del panel «Personaje» oculto
 *  31. con prefers-reduced-motion el diálogo no anima
 *  32. sin desbordamiento horizontal a 320/360/375/390 px (4 comprobaciones)
 *  36. las celdas siguen siendo utilizables a 360 px
 *  37. el detalle funciona en móvil
 *  38. sin peticiones a hosts externos
 *  39. sin <img> remotas
 *  40. sin errores de consola relevantes (se excluye solo el 404 preexistente
 *      de /favicon.ico en el servidor de desarrollo, ajeno a este hito)
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSmokeTempDir,
  isAllowedSmokeImageUrl,
  launchBrowser,
  productionServerCommand,
  removeSmokeTempDir,
  toolCommand,
} from "./browserLaunch.mjs";

/**
 * Base SQLite propia de ESTA ejecución. Sin esto el smoke podía arrancar el
 * servidor contra la base real del usuario. Se borra en `finally`, aunque
 * alguna comprobación falle.
 */
const TEMP_ROOT = createSmokeTempDir("equipo");

/** Ruta de la base temporal de este modo. */
function dbPathFor(mode) {
  return join(TEMP_ROOT, `${mode}.db`);
}

/** Solo el nombre del archivo: no se vuelca la ruta completa en el log. */
function basenameSeguro(ruta) {
  return ruta.split(/[\\/]/).pop();
}

const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all") ? ["prod", "dev"] : args.includes("--dev") ? ["dev"] : ["prod"];

const SHOT_DIR = UPDATE_SCREENSHOTS
  ? join(REPO, "docs", "screenshots")
  : join(TEMP_ROOT, "capturas");
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
      ? productionServerCommand()
      : toolCommand("vite", [
          "--configLoader",
          "runner",
          "--port",
          String(port),
          "--strictPort",
        ]);
  const proc = spawn(command, cmdArgs, {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: mode === "prod" ? "production" : "development",
      PUBLIC_DEPLOYMENT: "false",
      SECURE_COOKIES: "false",
      POE_NINJA_OFFLINE: "true",
      // Aislamiento explícito: nunca la base real.
      DATABASE_PATH: dbPathFor(mode),
    },
    shell,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Vite y el servidor de producción escriben bastante durante este recorrido.
  // Si nadie drena stdout, Windows puede llenar la tubería y bloquear el
  // proceso hijo aunque la aplicación esté sana.
  proc.stdout.on("data", () => {});
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
/**
 * Navegación por áreas (Expediente y mentor / Plan y mercado). Ambos paneles
 * siguen montados para no perder estado, así que hay que ACTIVAR el área antes
 * de interactuar con sus controles.
 */
async function irA(page, area) {
  await page.getByTestId(`tab-${area}`).click();
  await page.waitForFunction(
    (a) =>
      document.querySelector(`[data-testid="tab-${a}"]`)?.getAttribute("data-state") ===
      "active",
    area,
    { timeout: 10000 },
  );
}

/**
 * El banco técnico ya no es la vista de entrada de Crafting: vive plegado tras
 * «Herramientas avanzadas». Este smoke sigue comprobándolo entero, así que lo
 * despliega explícitamente antes de usarlo.
 */
async function abrirBancoAvanzado(page) {
  const toggle = page.getByTestId("crafting-avanzado-toggle");
  await toggle.waitFor({ timeout: 20000 });
  if ((await toggle.getAttribute("data-open")) !== "true") await toggle.click();
  await page.getByTestId("crafting-workspace").waitFor({ timeout: 20000 });
}

let total = 0;
const check = (name, ok) => {
  total += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failures += 1;
};

/**
 * Prepara un perfil con VARIOS frascos, un objeto duplicado y una ballesta real
 * importada desde texto avanzado usando las rutas reales de la API. Lo deja
 * restaurable por el frontend vía localStorage.
 */
async function seedProfile(request, base) {
  const demo = await (await request.get(`${base}/api/character/demo`)).json();
  const profile = demo.profile;
  const fuente = [{ kind: "user", label: "Sembrado por la prueba", retrievedAt: new Date().toISOString() }];
  const craftingText = readFileSync(
    join(REPO, "server", "fixtures", "phoenixCoreCrossbowAdvanced.es.txt"),
    "utf8",
  );
  const imported = await request.post(`${base}/api/import/item-text`, {
    data: { text: craftingText, patch: "0.5.4f" },
  });
  if (!imported.ok()) throw new Error(`no se pudo importar el objeto de crafting: HTTP ${imported.status()}`);
  const craftingItem = (await imported.json()).item;
  craftingItem.id = "smoke-crafting-crossbow";
  const craftingResultText = `${craftingText.trim()}\n{ Mod. de sufijo "sintético del smoke" (Grado: 1) — Daño, Ataque }\nModificador sintético de daño añadido por la prueba de navegador`;
  profile.items.push(
    {
      id: "smoke-flask-1",
      name: "Frasco de prueba 1",
      baseType: "Life Flask",
      slot: "flask",
      rarity: "magic",
      modifiers: [],
      sources: fuente,
    },
    {
      id: "smoke-flask-2",
      name: "Frasco de prueba 2",
      baseType: "Mana Flask",
      slot: "flask",
      rarity: "normal",
      modifiers: [],
      sources: fuente,
    },
    {
      id: "smoke-ring-dup",
      name: "Anillo duplicado",
      baseType: "Iron Ring",
      slot: "ring1",
      rarity: "unique",
      modifiers: [],
      sources: fuente,
    },
    craftingItem,
  );
  const res = await request.post(`${base}/api/character`, {
    data: { profile },
  });
  if (!res.ok()) throw new Error(`no se pudo sembrar el perfil: HTTP ${res.status()}`);
  return {
    profileId: profile.id,
    craftingItemId: craftingItem.id,
    craftingText,
    craftingResultText,
  };
}

/**
 * Reproduce la entrada más corta del producto. El objeto suelto se persiste al
 * importarlo para sobrevivir a una recarga; después se fuerza un fallo al
 * crear la decisión. El objeto y el preflight deben seguir intactos y el mismo
 * botón debe permitir reintentar, sin abrir el editor ni pedir otra entrada.
 */
async function exerciseImplicitCraftingSaveRetry(browser, base, mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let interactions = 0;
  const click = async (locator) => {
    interactions += 1;
    await locator.click();
  };
  const checkBox = async (locator) => {
    interactions += 1;
    await locator.check();
  };

  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await click(page.getByTestId("bienvenida-objeto"));

    const editor = page.getByRole("dialog");
    await editor.waitFor({ timeout: 15000 });
    const craftingText = readFileSync(
      join(REPO, "server", "fixtures", "phoenixCoreCrossbowAdvanced.es.txt"),
      "utf8",
    );
    await editor.getByLabel(/Analizar objeto copiado del juego/).fill(craftingText);
    await click(editor.getByRole("button", { name: "Analizar objeto" }));
    await editor.waitFor({ state: "hidden", timeout: 20000 });

    await abrirBancoAvanzado(page);
    const workspace = page.getByTestId("crafting-workspace");
    const outcome = workspace.getByLabel("Añade un matiz (opcional)");
    const expectedOutcome = "Añadir un modificador útil sin perder el objeto pegado";
    await click(workspace.getByRole("radio", { name: "Daño", exact: true }));
    await outcome.fill(expectedOutcome);
    await click(workspace.getByTestId("crafting-success-goal-toggle"));
    await click(
      workspace
        .getByTestId("crafting-route")
        .getByRole("button", { name: "Preparar Orbe exaltado" }),
    );
    const preflight = workspace.getByTestId("crafting-preflight-exalted");
    await checkBox(preflight.getByLabel(/El objeto sigue igual/));

    const persistedStandaloneId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    let failFirstDecision = true;
    await page.route("**/api/journal/*/session", async (route) => {
      if (failFirstDecision && route.request().method() === "POST") {
        failFirstDecision = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo-controlado-al-crear-decision" }),
        });
        return;
      }
      await route.continue();
    });

    const prepare = preflight.getByRole("button", { name: "Preparar este craft" });
    await click(prepare);
    await page.getByText("No se pudo actualizar la decisión").waitFor({
      timeout: 15000,
    });

    const confirmationsPreserved = [await preflight.getByLabel(/El objeto sigue igual/).isChecked()];
    check(
      `[${mode}] un fallo al crear la decisión conserva objeto, objetivo y confirmaciones`,
      (await workspace.getByText("Núcleo de fénix").first().isVisible()) &&
        (await outcome.inputValue()) === expectedOutcome &&
        confirmationsPreserved.every(Boolean),
    );
    check(
      `[${mode}] el objeto ya estaba guardado y el fallo no crea una sesión fantasma`,
      (await page.getByRole("dialog").count()) === 0 &&
        (await page.locator("#seccion-decision-crafting").count()) === 0 &&
        persistedStandaloneId !== null &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) ===
          persistedStandaloneId,
    );

    await click(prepare);
    const session = page.locator("#seccion-decision-crafting");
    await session.waitFor({ timeout: 20000 });
    check(
      `[${mode}] el mismo preflight reintenta y continúa tras guardar`,
      (await session.isVisible()) &&
        (await session.innerText()).includes(expectedOutcome) &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) !== null,
    );
    const resultCheck = session.getByTestId("crafting-result-check");
    await resultCheck.getByLabel("Objeto actual copiado desde PoE2").fill(craftingText);
    await click(resultCheck.getByRole("button", { name: "Comparar con el snapshot anterior" }));
    await resultCheck
      .locator('[data-comparison-status="inconclusive"]')
      .waitFor({ timeout: 20000 });
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.locator("#seccion-decision-crafting").waitFor({ timeout: 20000 });
    await resultCheck
      .locator('[data-comparison-status="inconclusive"]')
      .waitFor({ timeout: 20000 });
    check(
      `[${mode}] la sesión mínima conserva un resultado inconcluso al recargar`,
      (await resultCheck.getByLabel("Objeto actual copiado desde PoE2").inputValue()) ===
        craftingText &&
        (await resultCheck.innerText()).includes(
          "Se esperaba 1 modificador explícito nuevo y se detectaron 0",
        ) &&
        (await resultCheck.getByRole("button", { name: "Guardar y parar" }).count()) === 0 &&
        (await resultCheck.getByRole("button", { name: "Guardar y seguir" }).count()) === 0,
    );
    check(
      `[${mode}] la ruta mínima queda en nueve interacciones o menos (${interactions})`,
      interactions <= 9,
    );

    // En desarrollo todos los contextos de navegador comparten a propósito la
    // sesión local. Este escenario crea un personaje standalone; si no lo
    // borra, el escenario principal deja de empezar en la bienvenida y la
    // prueba se contamina a sí misma. La base es temporal y aislada.
    const cleanupStatus = await page.evaluate(async () => {
      const response = await fetch("/api/visitor/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "BORRAR MIS DATOS" }),
      });
      return response.status;
    });
    if (cleanupStatus !== 200) {
      throw new Error(`no se pudo limpiar el escenario de reintento: HTTP ${cleanupStatus}`);
    }
  } finally {
    await context.close();
  }
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== HITO 4B — MODO ${mode.toUpperCase()} (${BASE}) ===`);
  const proc = startServer(mode, port);
  let browser;
  try {
    check(`[${mode}] servidor responde /api/health`, await waitForServer(BASE));

    // Se comprueba de VERDAD que la base en uso es la temporal de esta
    // ejecución, no se da por hecho que la variable se configuró.
    const dbPath = dbPathFor(mode);
    check(
      `[${mode}] base SQLite temporal y aislada (${basenameSeguro(dbPath)})`,
      (await waitForFile(dbPath)) && dbPath.startsWith(TEMP_ROOT) && !dbPath.startsWith(REPO),
    );

    browser = await launchBrowser();
    await exerciseImplicitCraftingSaveRetry(browser, BASE, mode);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    const externas = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externas.push(`${req.resourceType()} ${url}`);
      }
    });
    // El servidor de desarrollo de Vite no sirve /favicon.ico y el navegador lo
    // pide siempre: es un 404 PREEXISTENTE, ajeno al Hito 4B (en producción el
    // fallback SPA devuelve index.html y no ocurre). Se excluye solo ese caso,
    // por URL exacta, para no enmascarar ningún otro error.
    const esFaviconAusente = (texto) => texto.includes("/favicon.ico");
    const erroresConsola = [];
    let falloDeGuardadoSimulado = false;
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(msg.text() + " @ " + (msg.location()?.url ?? "?"));
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));
    // Respuestas de error: se registran con su URL para poder diagnosticarlas.
    page.on("response", (res) => {
      if (res.status() >= 400) erroresConsola.push(`HTTP ${res.status()} ${res.url()}`);
    });

    await page.goto(BASE, { waitUntil: "networkidle" });
    await irA(page, "expediente");
    await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20000 });

    // --- Paperdoll -------------------------------------------------------
    await page.locator('[data-testid="equipment-grid"]').waitFor({ timeout: 15000 });
    const llenos = await page.locator('[data-slot-state="filled"]').count();
    const vacios = await page.locator('[data-slot-state="empty"]').count();
    check(`[${mode}] paperdoll con ${llenos} huecos ocupados`, llenos === 8);
    check(`[${mode}] ranuras vacías representadas (${vacios})`, vacios >= 2);

    const panel = page.locator('section[aria-labelledby="equipo-titulo"]');
    const textoPanel = await panel.innerText();
    check(`[${mode}] las ranuras vacías dicen «Ranura vacía»`, textoPanel.includes("Ranura vacía"));
    const primerHueco = page.locator('[data-slot-state="filled"]').first();
    const etiquetaPrimerHueco = (await primerHueco.getAttribute("aria-label")) ?? "";
    check(
      `[${mode}] rareza, base y procedencia conservadas en la etiqueta accesible`,
      etiquetaPrimerHueco.includes("Raro") &&
        etiquetaPrimerHueco.includes("Lo has indicado tú") &&
        etiquetaPrimerHueco.split(",").length >= 3,
    );
    check(
      `[${mode}] las celdas no repiten rareza ni procedencia como texto visible`,
      !textoPanel.includes("Lo has indicado tú"),
    );
    const lineasVisiblesPorCelda = await primerHueco.evaluate((cell) =>
      Array.from(cell.querySelectorAll("span"))
        .filter((node) => node.children.length === 0 && (node.textContent ?? "").trim().length > 0)
        .filter((node) => {
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden";
        }).length,
    );
    check(
      `[${mode}] cada ficha de equipo se reduce a dos textos visibles`,
      lineasVisiblesPorCelda <= 2,
    );
    const diagnostico = page.locator('[data-testid="equipment-diagnostics"]');
    check(
      `[${mode}] diagnóstico resumido y plegado por defecto`,
      (await diagnostico.getAttribute("open")) === null &&
        (await diagnostico.locator("summary").innerText()).includes("mods sin verificar"),
    );
    await diagnostico.locator("summary").click();
    check(
      `[${mode}] diagnóstico conserva sus recuentos al abrirse`,
      (await diagnostico.innerText()).includes("Modificadores sin verificar"),
    );
    await diagnostico.locator("summary").click();
    check(
      `[${mode}] sin puntuaciones ni afinidad inventadas`,
      !/\d+(\.\d+)?\s*\/\s*10|afinidad|salud de la build/i.test(textoPanel),
    );
    check(
      `[${mode}] las pistas de un plan .build no aparecen como equipo`,
      !textoPanel.includes("Stat Priority") && !textoPanel.includes("Any Two Handed Mace"),
    );

    // --- Detalle accesible ------------------------------------------------
    await primerHueco.focus();
    const idHueco = await page.evaluate(() => document.activeElement?.getAttribute("data-item-id"));
    check(`[${mode}] el hueco es enfocable por teclado`, typeof idHueco === "string");

    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog");
    await dialogo.waitFor({ timeout: 15000 });
    check(`[${mode}] Enter abre el detalle`, await dialogo.isVisible());

    await dialogo.locator(".item-artwork svg").waitFor({ timeout: 15000 });

    const textoDialogo = await dialogo.innerText();
    check(
      `[${mode}] el detalle muestra nombre y base`,
      textoDialogo.includes("Doom Song") && textoDialogo.includes("Varnished Crossbow"),
    );
    // El CSS `uppercase` afecta a innerText: se compara sin distinguir mayúsculas.
    check(`[${mode}] el detalle separa los tipos de modificador`, /expl[íi]citos/i.test(textoDialogo));
    check(`[${mode}] el detalle muestra requisitos`, textoDialogo.includes("Nivel 68"));
    check(`[${mode}] el detalle muestra una ilustración local del objeto`, await dialogo.locator(".item-artwork svg").isVisible());
    check(
      `[${mode}] el detalle lleva al banco sin duplicar el planificador`,
      textoDialogo.includes("Analizar y trabajar esta pieza") &&
        !textoDialogo.includes("Monedas disponibles") &&
        !textoDialogo.includes("Ver evidencia y límites"),
    );
    check(
      `[${mode}] el detalle compacto no convierte datos parciales en ceros`,
      !textoDialogo.includes("Prefijos\n0") && !textoDialogo.includes("Sufijos\n0"),
    );
    check(`[${mode}] el detalle muestra procedencia`, textoDialogo.includes("Procedencia"));
    check(
      `[${mode}] el foco queda atrapado dentro del diálogo`,
      await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return d !== null && d.contains(document.activeElement);
      }),
    );

    await page.keyboard.press("Escape");
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    check(`[${mode}] Escape cierra el detalle`, true);
    const focoTrasHueco = await page.evaluate(() => ({
      itemId: document.activeElement?.getAttribute("data-item-id") ?? null,
      testId: document.activeElement?.getAttribute("data-testid") ?? null,
    }));
    check(
      `[${mode}] Escape devuelve el foco al hueco que lo abrió`,
      focoTrasHueco.itemId === idHueco,
    );

    // --- Datos desconocidos ----------------------------------------------
    await page.locator('[data-slot="helmet"][data-slot-state="filled"]').first().click();
    await dialogo.waitFor({ timeout: 15000 });
    check(
      `[${mode}] los datos desconocidos se declaran «Desconocido»`,
      (await dialogo.innerText()).includes("Desconocido"),
    );
    await page.keyboard.press("Escape");
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });

    // --- Varios frascos y objeto duplicado (datos reales vía API) ---------
    const {
      profileId: seededId,
      craftingItemId,
      craftingText,
      craftingResultText,
    } = await seedProfile(
      context.request,
      BASE,
    );
    await page.evaluate((id) => localStorage.setItem("exile-copilot:characterId", id), seededId);
    await page.reload({ waitUntil: "networkidle" });
    // El paperdoll vive en el expediente, dentro del área «Expediente y mentor».
    await irA(page, "expediente");
    await page.locator('[data-testid="flask-group"]').waitFor({ timeout: 20000 });
    const frascos = await page.locator('[data-slot="flask"][data-slot-state="filled"]').count();
    check(`[${mode}] varios frascos agrupados desde datos reales (${frascos})`, frascos === 2);
    const textoPanel2 = await panel.innerText();
    check(
      `[${mode}] el objeto duplicado aparece en «Otros objetos»`,
      // El CSS `uppercase` afecta a innerText: se compara sin distinguir mayúsculas.
      /otros objetos/i.test(textoPanel2) && textoPanel2.includes("Anillo duplicado"),
    );

    // --- Vínculo estructurado recomendación → objeto ----------------------
    await irA(page, "plan");
    await page.getByTestId("market-context-details").evaluate((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    });
    await page.locator("#market-budget").fill("5");
    await irA(page, "expediente");
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    await page.waitForSelector('[data-testid="caso-abierto"][data-caso="recommendation"]', {
      timeout: 25000,
    });

    const densidadCaso = await page.locator('[data-testid="caso-abierto"]').evaluate((caso) => ({
      height: Math.round(caso.getBoundingClientRect().height),
      longParagraphs: Array.from(caso.querySelectorAll("p")).filter((paragraph) => {
        const style = getComputedStyle(paragraph);
        return style.display !== "none" && (paragraph.innerText ?? "").trim().length > 160;
      }).length,
      pillsOutsideDetails: Array.from(
        caso.querySelectorAll('[data-testid="caso-datos-clave"] [data-slot="badge"]'),
      ).every((badge) => badge.closest("details") === null),
      observationVisible:
        caso.querySelector('[data-testid="caso-que-observar"]')?.hasAttribute("open") === true,
    }));
    check(`[${mode}] caso principal compacto (${densidadCaso.height}px)`, densidadCaso.height <= 650);
    check(
      `[${mode}] caso principal sin párrafos visibles de más de 160 caracteres`,
      densidadCaso.longParagraphs === 0,
    );
    check(
      `[${mode}] coste, riesgo, confianza, impacto y procedencia siguen visibles`,
      densidadCaso.pillsOutsideDetails,
    );
    check(
      `[${mode}] la comprobación dentro de PoE2 empieza visible`,
      densidadCaso.observationVisible,
    );

    // El paperdoll SOLO recibe los ids del contenido dominante. El orden de
    // recomendaciones puede cambiar cuando se ajustan reglas legítimas, por lo
    // que no se presupone si la principal tendrá o no vínculo: se comprueba que
    // cualquier resalte corresponda siempre a un objeto real, nunca a un hueco.
    const resalteInicial = await page.evaluate(() => {
      const marcados = [...document.querySelectorAll('[data-highlighted="true"]')];
      return {
        total: marcados.length,
        conObjeto: marcados.filter((el) => el.getAttribute("data-item-id")).length,
        vacios: document.querySelectorAll('[data-slot-state="empty"][data-highlighted="true"]')
          .length,
      };
    });
    check(
      `[${mode}] el caso dominante solo puede resaltar objetos reales`,
      resalteInicial.conObjeto === resalteInicial.total && resalteInicial.vacios === 0,
    );

    // Las recomendaciones que NO dominan viven plegadas en «Otras posibilidades»
    // y, desde la reducción de densidad, cada alternativa empieza además
    // resumida. El acceso al objeto debe seguir existiendo al pedir sus detalles;
    // no se exige volver a cargar de texto la pantalla para mantenerlo visible.
    await page.getByTestId("acordeon-otras").click();
    const alternativas = page.locator('[data-testid^="alternativa-"]:visible');
    for (let index = 0; index < (await alternativas.count()); index += 1) {
      const verDetalles = alternativas.nth(index).getByRole("button", { name: "Ver detalles" });
      if ((await verDetalles.count()) > 0) await verDetalles.click();
    }
    // Se elige expresamente una alternativa: la recomendación principal puede
    // tener ahora su propio vínculo y usa una presentación distinta.
    const botonesAlternativos = alternativas.locator('[data-testid^="ver-objeto-"]:visible');
    const usaAlternativaVinculada = (await botonesAlternativos.count()) > 0;
    let botones = botonesAlternativos;
    if (!usaAlternativaVinculada) {
      // Si ninguna alternativa está vinculada a equipo, la recomendación
      // principal puede ser la única evidencia estructurada. El producto no
      // debe inventar una alternativa solo para satisfacer la prueba.
      botones = page.locator('[data-testid^="ver-objeto-"]:visible');
    }
    await botones.first().waitFor({ timeout: 15000 });
    const nBotones = await botones.count();
    check(`[${mode}] «Ver el objeto evaluado» solo con vínculo estructurado (${nBotones})`, nBotones >= 1);

    const botonRec = botones.first();
    const testIdBoton = await botonRec.getAttribute("data-testid");
    await botonRec.click();
    await dialogo.waitFor({ timeout: 15000 });
    check(
      `[${mode}] la navegación recomendación → objeto abre el detalle`,
      (await dialogo.innerText()).includes("Recomendaciones que evalúan este objeto"),
    );
    check(
      `[${mode}] el expediente no duplica el preflight de crafting`,
      (await dialogo.getByRole("button", { name: "Preparar decisión guiada" }).count()) === 0,
    );
    check(
      `[${mode}] el detalle ofrece continuar en el banco de Crafting`,
      await dialogo.getByTestId("trabajar-en-crafting").isVisible(),
    );
    await page.keyboard.press("Escape");
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    const focoTrasBoton = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? null,
    );
    check(
      `[${mode}] Escape devuelve el foco al botón de la recomendación`,
      focoTrasBoton === testIdBoton,
    );

    // --- Navegación inversa objeto → caso abierto -------------------------
    // Abrir el objeto evaluado → «Ver recomendaciones» → el Caso Abierto queda
    // visible y ENFOCADO, sin que el foco caiga en un panel oculto.
    await page.locator(`[data-testid="${testIdBoton}"]`).click();
    await dialogo.waitFor({ timeout: 15000 });
    const verRecs = dialogo.getByRole("button", { name: "Ver recomendaciones" });
    await verRecs.waitFor({ timeout: 15000 });
    await verRecs.click();
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    // El desplazamiento es suave salvo con reduced-motion: se espera a que el
    // caso haya llegado a la parte visible.
    await page.waitForFunction(
      () => {
        const sec = document.getElementById("caso-abierto");
        if (sec === null) return false;
        const r = sec.getBoundingClientRect();
        return r.top > -8 && r.top < window.innerHeight * 0.6;
      },
      undefined,
      { timeout: 15000 },
    );
    const navInversa = await page.evaluate(() => {
      const sec = document.getElementById("caso-abierto");
      const rect = sec.getBoundingClientRect();
      const activo = document.activeElement;
      return {
        visible: rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight,
        enfocada: activo === sec,
        focoEnPanelOculto:
          activo !== null &&
          activo.closest('[data-slot="tabs-content"][data-state="inactive"]') !== null,
        foco: activo === null ? "(ninguno)" : (activo.id || activo.tagName),
      };
    });
    check(
      `[${mode}] el Caso Abierto queda visible y enfocado (foco: ${navInversa.foco})`,
      navInversa.visible && navInversa.enfocada,
    );
    check(
      `[${mode}] el foco no queda dentro de un panel de área oculto`,
      !navInversa.focoEnPanelOculto,
    );

    // --- Resalte del paperdoll: ids del caso dominante, nunca de un hueco ---
    // Se guarda como próximo paso la recomendación que SÍ declara un objeto:
    // pasa a dominar el caso y sus ids —los de un objeto real del perfil—
    // llegan al paperdoll.
    // `.last()`: la lista entera también es una tarjeta; la que interesa es la
    // más interna, la de esta recomendación.
    if (usaAlternativaVinculada) {
      const tarjetaRec = botonRec.locator('xpath=ancestor::*[@data-slot="card"][1]');
      await tarjetaRec.getByRole("button", { name: "Guardar como próximo paso" }).click();
      await page.waitForSelector('[data-testid="caso-abierto"][data-caso="journal"]', {
        timeout: 20000,
      });
    }
    const resaltados = await page.evaluate(() => {
      const marcados = [...document.querySelectorAll('[data-highlighted="true"]')];
      return {
        total: marcados.length,
        conObjeto: marcados.filter((el) => el.getAttribute("data-item-id")).length,
        vacios: document.querySelectorAll('[data-slot-state="empty"][data-highlighted="true"]')
          .length,
        ids: marcados.map((el) => el.getAttribute("data-item-id")),
      };
    });
    check(
      `[${mode}] el caso dominante resalta su objeto (${resaltados.ids.join(", ") || "ninguno"})`,
      resaltados.total >= 1 && resaltados.conObjeto === resaltados.total,
    );
    check(
      `[${mode}] nunca se resalta una ranura vacía`,
      resaltados.vacios === 0,
    );

    // Limpieza: al cerrar el caso, el paperdoll se queda sin ids.
    if (usaAlternativaVinculada) {
      await page.getByRole("button", { name: "Cancelar seguimiento" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll('[data-highlighted="true"]').length === 0,
        undefined,
        { timeout: 20000 },
      );
      check(`[${mode}] al cambiar de caso el resalte se limpia`, true);
    } else {
      check(
        `[${mode}] sin alternativa vinculada no se crea un seguimiento ficticio`,
        (await page.getByRole("button", { name: "Cancelar seguimiento" }).count()) === 0,
      );
    }

    // --- prefers-reduced-motion ------------------------------------------
    await irA(page, "expediente");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-slot-state="filled"]').first().click();
    await dialogo.waitFor({ timeout: 15000 });
    const animacion = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (d === null) return null;
      const cs = getComputedStyle(d);
      return { name: cs.animationName, duration: cs.animationDuration };
    });
    check(
      `[${mode}] con prefers-reduced-motion el diálogo no anima (${animacion?.name ?? "?"})`,
      animacion !== null && (animacion.name === "none" || animacion.duration === "0s"),
    );
    await page.keyboard.press("Escape");
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    await page.emulateMedia({ reducedMotion: null });

    await page.screenshot({ path: join(SHOT_DIR, `equipo-escritorio-${mode}.png`), fullPage: true });

    // --- Responsive: sin desbordamiento horizontal ------------------------
    for (const width of [320, 360, 375, 390]) {
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

    await page.setViewportSize({ width: 360, height: 800 });
    await wait(300);
    const celda = await page.locator('[data-slot-state="filled"]').first().boundingBox();
    check(
      `[${mode}] las celdas siguen siendo utilizables a 360 px (${celda ? Math.round(celda.width) : 0}px)`,
      celda !== null && celda.width >= 100 && celda.height >= 60,
    );
    await page.locator('[data-slot-state="filled"]').first().click();
    await dialogo.waitFor({ timeout: 15000 });
    check(`[${mode}] el detalle funciona en móvil`, await dialogo.isVisible());
    await page.keyboard.press("Escape");
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    await page.screenshot({ path: join(SHOT_DIR, `equipo-movil-${mode}.png`), fullPage: true });

    // --- Crafting guiado: preflight → sesión persistente -----------------
    // La moneda no se «recomienda» con un clic: el jugador declara el objetivo,
    // confirma el snapshot y entiende la aleatoriedad antes de abrir una
    // decisión persistente vinculada al objeto real importado.
    await page.setViewportSize({ width: 390, height: 844 });
    await irA(page, "crafting");
    await page.getByTestId("crafting-mode-chooser").waitFor({ timeout: 15000 });
    const entradaCraftingMovil = await page.evaluate(() => {
      const chooser = document.querySelector('[data-testid="crafting-mode-chooser"]');
      const goal = Array.from(document.querySelectorAll("h3")).find((heading) =>
        heading.textContent?.includes("Qué quieres conseguir con esta pieza"),
      );
      return {
        chooserHeight: Math.round(chooser?.getBoundingClientRect().height ?? 9999),
        goalTop: Math.round(goal?.getBoundingClientRect().top ?? 9999),
        viewportHeight: window.innerHeight,
      };
    });
    check(
      `[${mode}] la entrada móvil llega a la pregunta del objeto (${entradaCraftingMovil.chooserHeight}px)`,
      entradaCraftingMovil.chooserHeight <= 100 &&
        entradaCraftingMovil.goalTop < entradaCraftingMovil.viewportHeight,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await abrirBancoAvanzado(page);
    const craftingWorkspace = page.getByTestId("crafting-workspace");
    check(
      `[${mode}] Crafting existe como tercera área principal`,
      (await page.getByTestId("tab-crafting").getAttribute("data-state")) === "active" &&
        (await craftingWorkspace.innerText()).includes("Banco de crafting"),
    );
    await craftingWorkspace.getByTestId(`crafting-item-${craftingItemId}`).click();
    check(
      `[${mode}] el banco usa el objeto real importado`,
      (await craftingWorkspace.innerText()).includes("Núcleo de fénix"),
    );
    const tituloMentorContextual = page.getByTestId("mentor-contextual-titulo");
    check(
      `[${mode}] el mentor acompaña la pieza seleccionada sin consulta automática`,
      (await tituloMentorContextual.innerText()) === "Núcleo de fénix" &&
        (await page.getByTestId("mentor-contextual-respuesta").count()) === 0,
    );
    const rutaCrafting = craftingWorkspace.getByTestId("crafting-route");
    check(
      `[${mode}] el diagnóstico convierte la compatibilidad en una próxima acción`,
      (await rutaCrafting.getAttribute("data-route-state")) === "single-currency" &&
        (await rutaCrafting.innerText()).includes("Orbe exaltado") &&
        (await rutaCrafting.getByRole("button", { name: "Define tu objetivo" }).isVisible()),
    );
    const textoCraftingInicial = await craftingWorkspace.innerText();
    const palabrasCraftingInicial = textoCraftingInicial.trim().split(/\s+/).filter(Boolean).length;
    check(
      `[${mode}] el banco inicial cabe en 300 palabras (${palabrasCraftingInicial})`,
      palabrasCraftingInicial <= 300,
    );
    check(
      `[${mode}] una lectura parcial no presenta prefijos o sufijos cero como hechos`,
      !/Prefijos\s+0/.test(textoCraftingInicial) && !/Sufijos\s+0/.test(textoCraftingInicial),
    );
    const altoFilaPieza = await craftingWorkspace
      .getByTestId(`crafting-item-${craftingItemId}`)
      .evaluate((element) => Math.round(element.getBoundingClientRect().height));
    check(
      `[${mode}] el selector usa filas compactas (${altoFilaPieza}px)`,
      altoFilaPieza <= 60,
    );
    const toolVisibility = {
      currency: await craftingWorkspace.getByTestId("crafting-tool-panel-currency").isVisible(),
      essence: await craftingWorkspace.getByTestId("crafting-essences").isVisible(),
      alloy: await craftingWorkspace.getByTestId("crafting-alloys").isVisible(),
    };
    const currencySelected =
      (await craftingWorkspace.getByTestId("crafting-tool-currency").getAttribute("aria-selected")) ===
      "true";
    check(
      `[${mode}] Crafting muestra una herramienta cada vez (${JSON.stringify(toolVisibility)})`,
      currencySelected && !toolVisibility.essence && !toolVisibility.alloy,
    );
    await page.screenshot({
      path: join(SHOT_DIR, `crafting-banco-${mode}.png`),
      fullPage: true,
    });

    await page.setViewportSize({ width: 375, height: 844 });
    const anchoCraftingMovil = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    check(
      `[${mode}] Crafting no desborda horizontalmente en móvil (${anchoCraftingMovil.client}/${anchoCraftingMovil.scroll})`,
      anchoCraftingMovil.scroll <= anchoCraftingMovil.client + 1,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const altoCraftingMovil = await craftingWorkspace.evaluate((element) =>
      Math.round(element.getBoundingClientRect().height),
    );
    check(
      `[${mode}] la vista inicial de Crafting ocupa como máximo 2,5 pantallas móviles (${altoCraftingMovil}px)`,
      altoCraftingMovil <= 844 * 2.5,
    );
    await page.screenshot({
      path: join(SHOT_DIR, `crafting-banco-movil-${mode}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Una sola intención acompaña a todas las herramientas del banco.
    const intencionCrafting = craftingWorkspace.getByTestId("crafting-intention");
    await rutaCrafting.getByRole("button", { name: "Define tu objetivo" }).click();
    check(
      `[${mode}] la ruta devuelve el foco al objetivo que falta`,
      await intencionCrafting.evaluate((element) => document.activeElement === element),
    );
    await intencionCrafting.getByRole("radio", { name: "Daño", exact: true }).click();
    const veredictoBase = intencionCrafting.getByTestId("crafting-base-verdict");
    check(
      `[${mode}] antes de elegir moneda el mentor decide si la base merece una prueba`,
      (await veredictoBase.getAttribute("data-base-verdict")) === "positive" &&
        (await veredictoBase.innerText()).includes("merece una prueba controlada"),
    );
    const criterioParada = intencionCrafting.getByTestId("crafting-success-criteria");
    check(
      `[${mode}] elegir una categoría basta como objetivo y ofrece una parada concreta`,
      (await intencionCrafting.getByLabel("Añade un matiz (opcional)").isVisible()) &&
        (await criterioParada.innerText()).includes("Un afijo de daño más") &&
        (await criterioParada.innerText()).includes("Ahora hay 3; para al llegar a 4") &&
        (await criterioParada.innerText()).includes("Recomendado") &&
        (await rutaCrafting.getByRole("button", { name: "Elige cuándo parar" }).isVisible()) &&
        (await tituloMentorContextual.innerText()) === "Daño en Núcleo de fénix",
    );
    await rutaCrafting.getByRole("button", { name: "Elige cuándo parar" }).click();
    check(
      `[${mode}] preparar sin criterio lleva al punto de parada en vez de abrir un formulario bloqueado`,
      await criterioParada.evaluate((element) => document.activeElement === element) &&
        (await craftingWorkspace.getByTestId("crafting-preflight-exalted").count()) === 0,
    );
    await intencionCrafting
      .getByLabel("Añade un matiz (opcional)")
      .fill("Más daño sin perder velocidad ni +niveles");
    const proteccionesPlegables = intencionCrafting.getByTestId("crafting-protection-details");
    check(
      `[${mode}] una ruta aditiva no obliga a leer todas las protecciones`,
      !(await proteccionesPlegables.getAttribute("open")) &&
        (await proteccionesPlegables.locator("summary").innerText()).includes("opcional"),
    );
    await proteccionesPlegables.locator("summary").click();
    await intencionCrafting
      .getByTestId("crafting-protection-picker")
      .getByRole("checkbox")
      .first()
      .check();
    await intencionCrafting.getByTestId("crafting-success-goal-toggle").click();
    check(
      `[${mode}] la intención combina objetivo y restricciones elegidas por clic`,
      (await intencionCrafting.innerText()).includes("Daño · 1 intocable") &&
        (await intencionCrafting.innerText()).includes("1/3 condiciones") &&
        (await rutaCrafting.getByRole("button", { name: "Preparar Orbe exaltado" }).isVisible()) &&
        (await tituloMentorContextual.innerText()) === "Al menos 4 afijos de daño",
    );

    // La cobertura registrada llega a 0.5.0/0.5.3, no al parche activo. La UI
    // conserva las monedas básicas y falla cerrada antes de abrir los flujos.
    const advancedPatchGate = craftingWorkspace.getByTestId("crafting-advanced-patch-gate");
    check(
      `[${mode}] Crafting avanzado explica el freno sin ocultar las monedas básicas`,
      (await advancedPatchGate.isVisible()) &&
        (await advancedPatchGate.innerText()).includes("en revisión para este parche") &&
        (await craftingWorkspace.getByTestId("crafting-tool-essence").isDisabled()) &&
        (await craftingWorkspace.getByTestId("crafting-tool-alloy").isDisabled()) &&
        !(await craftingWorkspace.getByTestId("crafting-tool-currency").isDisabled()),
    );
    await rutaCrafting.getByRole("button", { name: "Preparar Orbe exaltado" }).click();
    check(
      `[${mode}] abrir el preflight actualiza el mentor sin gastar ni llamar a la IA`,
      (await tituloMentorContextual.innerText()) === "Orbe exaltado" &&
        (await page.getByTestId("mentor-contextual-respuesta").count()) === 0,
    );
    const accionExaltada = craftingWorkspace.locator("details").filter({ hasText: "Orbe exaltado" });
    check(
      `[${mode}] la acción compatible aparece antes que las no aplicables`,
      await accionExaltada.isVisible() &&
        (await craftingWorkspace.getByRole("button", { name: /Ver acciones no aplicables \(3\)/ }).isVisible()),
    );
    check(
      `[${mode}] una moneda que solo añade no pide proteger modificadores`,
      (await accionExaltada.getByTestId("crafting-protection-picker").count()) === 0,
    );
    const preflight = craftingWorkspace.getByTestId("crafting-preflight-exalted");
    await preflight.waitFor({ timeout: 15000 });
    const crearDecision = preflight.getByRole("button", {
      name: "Preparar este craft",
    });
    check(`[${mode}] no se puede gastar sin confirmar el preflight`, await crearDecision.isDisabled());
    await preflight.getByRole("radio", { name: /^Superior/ }).check();
    check(
      `[${mode}] la variante superior se elige explícitamente`,
      await preflight.getByRole("radio", { name: /^Superior/ }).isChecked(),
    );
    const lecturaAfijos = craftingWorkspace.getByTestId("crafting-affix-assessment");
    await craftingWorkspace
      .getByTestId("crafting-reading-details")
      .locator("summary")
      .first()
      .click();
    const textoLecturaAfijos = await lecturaAfijos.innerText();
    check(
      `[${mode}] la lectura separa el núcleo de daño de las etiquetas genéricas de ataque`,
      (await lecturaAfijos.getAttribute("data-aligned-count")) === "3" &&
        textoLecturaAfijos.includes("3 afijos apuntan a daño") &&
        textoLecturaAfijos.includes("3/5 alineados") &&
        !textoLecturaAfijos.includes("5/5 alineados"),
    );
    check(
      `[${mode}] el detalle afijo por afijo empieza plegado y sin métricas inventadas`,
      !(await lecturaAfijos.locator("details").getAttribute("open")) &&
        !textoLecturaAfijos.match(/DPS estimado|probabilidad de éxito|precio estimado/i),
    );
    await page.screenshot({
      path: join(SHOT_DIR, `crafting-affixes-${mode}.png`),
      fullPage: true,
    });
    await preflight.getByLabel(/El objeto sigue igual/).check();
    check(`[${mode}] la confirmación compacta habilita la decisión`, !(await crearDecision.isDisabled()));
    await crearDecision.click();
    const casoCrafting = craftingWorkspace.locator("#seccion-decision-crafting");
    await casoCrafting.waitFor({ timeout: 20000 });
    check(
      `[${mode}] al preparar el craft la sesión recibe foco`,
      await casoCrafting.evaluate((element) => document.activeElement === element),
    );
    check(
      `[${mode}] la sesión sustituye al planificador anterior`,
      !(await craftingWorkspace.getByTestId("crafting-actions").isVisible()) &&
        !(await craftingWorkspace.locator('[aria-labelledby="crafting-items-title"]').isVisible()),
    );
    check(
      `[${mode}] solo existe una instancia viva de la sesión de crafting`,
      (await page.getByTestId("crafting-result-check").count()) === 1 &&
        (await page.locator("#seccion-decision-adaptativa").count()) === 0,
    );
    const textoCasoCrafting = await casoCrafting.innerText();
    const vinculada =
      textoCasoCrafting.includes("Orbe exaltado superior") &&
      textoCasoCrafting.includes("Núcleo de fénix") &&
      textoCasoCrafting.includes("Nivel de modificador 35");
    check(
      `[${mode}] la comprobación queda vinculada a objeto y moneda`,
      vinculada,
    );
    if (!vinculada) console.log("   sesión visible:", textoCasoCrafting);
    check(
      `[${mode}] la sesión distingue qué ocurre aquí y qué ocurre dentro de PoE2`,
      textoCasoCrafting.includes("Exile Copilot no modifica el objeto") &&
        textoCasoCrafting.includes("1. Aquí: paso preparado") &&
        textoCasoCrafting.includes("2. En PoE2: ejecuta y copia") &&
        textoCasoCrafting.includes("3. Aquí: compara y guarda") &&
        !textoCasoCrafting.includes("Aún no sabemos") &&
        !textoCasoCrafting.includes("Intocable"),
    );
    const comprobadorResultado = casoCrafting.getByTestId("crafting-result-check");
    await comprobadorResultado.waitFor({ timeout: 15000 });
    const descartarComprobacion = comprobadorResultado.getByRole("button", {
      name: "Descartar esta comprobación",
    });
    check(
      `[${mode}] pausa y descarte son decisiones distintas antes de volver de PoE2`,
      (await comprobadorResultado
        .getByRole("button", { name: "Guardar para seguir más tarde" })
        .isVisible()) &&
        (await descartarComprobacion.isVisible()) &&
        !(await comprobadorResultado.innerText()).includes("Cerrar comprobación"),
    );
    await descartarComprobacion.click();
    const confirmarDescarte = page.getByTestId("crafting-discard-dialog");
    await confirmarDescarte.waitFor({ timeout: 10000 });
    check(
      `[${mode}] descartar el craft exige confirmar la pérdida antes de cerrar`,
      (await confirmarDescarte.innerText()).includes("sin actualizar tu expediente") &&
        (await confirmarDescarte.getByRole("button", { name: "Sí, descartar" }).isVisible()),
    );
    await confirmarDescarte.getByRole("button", { name: "Seguir con la comprobación" }).click();
    await confirmarDescarte.waitFor({ state: "hidden", timeout: 10000 });
    await comprobadorResultado.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] cancelar el descarte conserva el craft preparado`,
      (await comprobadorResultado.isVisible()) &&
        (await comprobadorResultado
          .getByRole("button", { name: "Comparar con el snapshot anterior" })
          .isVisible()),
    );
    await page.getByTestId("crafting-mode-coach").click();
    await comprobadorResultado
      .getByRole("button", { name: "Guardar para seguir más tarde" })
      .click();
    const craftPausado = page.getByTestId("crafting-paused-sessions");
    await craftPausado.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("data-testid") === "crafting-paused-sessions",
      undefined,
      { timeout: 10000 },
    );
    check(
      `[${mode}] guardar mantiene visible el acceso al craft desde Ayuda en vivo`,
      (await page.getByTestId("crafting-mode-coach").getAttribute("data-active")) === "true" &&
        (await craftPausado.innerText()).includes("Núcleo de fénix") &&
        (await craftPausado.innerText()).includes("Orbe exaltado superior") &&
        (await page.getByTestId("crafting-avanzado-toggle").innerText()).includes(
          "Tienes un craft guardado aquí abajo",
        ),
    );
    check(
      `[${mode}] la pausa lleva el foco al proyecto guardado`,
      await craftPausado.evaluate((element) => document.activeElement === element),
    );
    await page.reload({ waitUntil: "networkidle" });
    const craftPausadoTrasRecarga = page.getByTestId("crafting-paused-sessions");
    await craftPausadoTrasRecarga.waitFor({ state: "visible", timeout: 20000 });
    check(
      `[${mode}] el craft pausado sigue localizable tras recargar`,
      (await page.getByTestId("crafting-mode-coach").getAttribute("data-active")) === "true" &&
        (await craftPausadoTrasRecarga.getByRole("button", { name: "Reanudar" }).isVisible()),
    );
    await craftPausadoTrasRecarga.getByRole("button", { name: "Reanudar" }).click();
    await comprobadorResultado.waitFor({ state: "visible", timeout: 20000 });
    check(
      `[${mode}] reanudar vuelve al mismo objeto, moneda y comparación`,
      (await comprobadorResultado.innerText()).includes("Núcleo de fénix") &&
        (await comprobadorResultado.innerText()).includes("Orbe exaltado superior") &&
        (await comprobadorResultado
          .getByRole("button", { name: "Comparar con el snapshot anterior" })
          .isVisible()),
    );
    await comprobadorResultado
      .getByLabel("Objeto actual copiado desde PoE2")
      .fill(craftingText);
    await comprobadorResultado
      .getByRole("button", { name: "Comparar con el snapshot anterior" })
      .click();
    await comprobadorResultado
      .locator('[data-comparison-status="inconclusive"]')
      .waitFor({ timeout: 20000 });
    check(
      `[${mode}] pegar el mismo snapshot no confirma un Exaltado inexistente`,
      (await comprobadorResultado.innerText()).includes(
        "Se esperaba 1 modificador explícito nuevo y se detectaron 0",
      ) &&
        (await comprobadorResultado.innerText()).includes(
          "Los 1 modificadores protegidos siguen presentes",
        ) &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y parar" }).count()) === 0 &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y seguir" }).count()) === 0,
    );
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.locator("#seccion-decision-crafting").waitFor({ timeout: 20000 });
    await comprobadorResultado
      .locator('[data-comparison-status="inconclusive"]')
      .waitFor({ timeout: 20000 });
    check(
      `[${mode}] recargar conserva texto, veredicto y protecciones del resultado inconcluso`,
      (await comprobadorResultado
        .getByLabel("Objeto actual copiado desde PoE2")
        .inputValue()) === craftingText &&
        (await comprobadorResultado.innerText()).includes(
          "Se esperaba 1 modificador explícito nuevo y se detectaron 0",
        ) &&
        (await comprobadorResultado.innerText()).includes(
          "Los 1 modificadores protegidos siguen presentes",
        ) &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y parar" }).count()) === 0 &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y seguir" }).count()) === 0,
    );
    const partialCraftingResultText = craftingResultText.replace(
      /^Clase de objeto:.*\r?\n/m,
      "",
    );
    await comprobadorResultado
      .getByLabel("Objeto actual copiado desde PoE2")
      .fill(partialCraftingResultText);
    await comprobadorResultado
      .getByRole("button", { name: "Comparar con el snapshot anterior" })
      .click();
    await comprobadorResultado
      .locator('[data-comparison-status="inconclusive"]')
      .waitFor({ timeout: 20000 });
    const reparacionResultado = comprobadorResultado.getByTestId("crafting-repair-banner");
    check(
      `[${mode}] un resultado incompleto nunca confirma ni permite cerrar el craft`,
      (await reparacionResultado.isVisible()) &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y parar" }).count()) === 0 &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y seguir" }).count()) === 0,
    );
    await reparacionResultado.getByTestId("crafting-repair-toggle").click();
    await reparacionResultado.getByTestId("crafting-repair-show-report").click();
    check(
      `[${mode}] el resultado incompleto conserva un informe local reproducible`,
      (await reparacionResultado.getByTestId("crafting-repair-report").inputValue()).includes(
        "Formato: EC-CRAFTING-IMPORT-1",
      ),
    );
    await comprobadorResultado
      .getByLabel("Objeto actual copiado desde PoE2")
      .fill(craftingResultText);
    await comprobadorResultado
      .getByRole("button", { name: "Comparar con el snapshot anterior" })
      .click();
    await comprobadorResultado
      .locator('[data-comparison-status="confirmed"]')
      .waitFor({ timeout: 20000 });
    const textoComparacion = await comprobadorResultado.innerText();
    check(
      `[${mode}] detecta exactamente el modificador añadido`,
      textoComparacion.includes("Cambio estructural confirmado") &&
        textoComparacion.includes("Modificador sintético de daño añadido por la prueba de navegador"),
    );
    const signalObjetivo = comprobadorResultado.getByTestId("crafting-goal-signal");
    const contextoPersonaje = comprobadorResultado.getByTestId("crafting-character-context");
    const siguienteDecision = comprobadorResultado.getByTestId("crafting-next-decision");
    check(
      `[${mode}] relaciona resultado, objetivo y expediente sin inventar una puntuación`,
      (await signalObjetivo.getAttribute("data-signal-status")) === "direct" &&
        (await contextoPersonaje.getAttribute("data-context-verdict")) === "candidate" &&
        (await contextoPersonaje.innerText()).includes("Candidato coherente con lo que buscabas") &&
        !(await contextoPersonaje.innerText()).match(/\d+\/10|% de mejora/),
    );
    check(
      `[${mode}] el asesor dice parar cuando se cumple la condición elegida`,
      (await siguienteDecision.getAttribute("data-next-decision")) === "stop" &&
        (await siguienteDecision.innerText()).includes("Punto de parada alcanzado") &&
        (await siguienteDecision.innerText()).includes("Conserva este resultado") &&
        (await comprobadorResultado.getByTestId("crafting-success-assessment").getAttribute("data-success-status")) === "fulfilled" &&
        !(await siguienteDecision.innerText()).match(/probabilidad de éxito|DPS|precio estimado/i),
    );
    await page.screenshot({
      path: join(SHOT_DIR, `crafting-decision-${mode}.png`),
      fullPage: true,
    });
    check(
      `[${mode}] la decisión recomendada gobierna el cierre del paso`,
      textoComparacion.includes("Cierra este paso con la decisión delante") &&
        (await comprobadorResultado.getByRole("button", { name: "Guardar y parar" }).isVisible()) &&
        (await comprobadorResultado
          .getByRole("button", { name: "Guardar para seguir más tarde" })
          .isVisible()) &&
        !textoComparacion.includes("Objeto actual copiado desde PoE2") &&
        textoComparacion.includes("El objeto de PoE2 ya cambió dentro del juego"),
    );
    let interceptarGuardado = true;
    await page.route("**/api/character", async (route) => {
      if (interceptarGuardado && route.request().method() === "POST") {
        interceptarGuardado = false;
        falloDeGuardadoSimulado = true;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await comprobadorResultado.getByRole("button", { name: "Guardar y parar" }).click();
    await comprobadorResultado.getByText(/La sesión sigue abierta/).waitFor({ timeout: 20000 });
    const journalTrasFallo = await (
      await context.request.get(`${BASE}/api/journal/${seededId}`)
    ).json();
    check(
      `[${mode}] un fallo al guardar no cierra la sesión`,
      ["active", "waiting_result", "reopening"].includes(journalTrasFallo.session?.status) &&
        journalTrasFallo.session?.evidence?.some(
          (entry) =>
            entry.kind === "confirmed" && entry.text.includes("Cambio estructural confirmado"),
        ),
    );
    await page.unroute("**/api/character");
    await comprobadorResultado.getByRole("button", { name: "Guardar y parar" }).click();
    let cierrePersistido = false;
    for (let intento = 0; intento < 80; intento += 1) {
      const [characterResponse, journalResponse] = await Promise.all([
        context.request.get(`${BASE}/api/character/${encodeURIComponent(seededId)}`),
        context.request.get(`${BASE}/api/journal/${encodeURIComponent(seededId)}`),
      ]);
      if (characterResponse.ok && journalResponse.ok) {
        const characterState = await characterResponse.json();
        const journalState = await journalResponse.json();
        const item = characterState.profile.items.find((entry) => entry.id === craftingItemId);
        cierrePersistido =
          item?.modifiers?.length === 6 &&
          journalState.session?.status === "completed" &&
          journalState.session?.evidence?.some(
            (entry) =>
              entry.kind === "confirmed" && entry.text.includes("Cambio estructural confirmado"),
          ) &&
          journalState.session?.lastResult?.subjective === true &&
          journalState.session?.lastResult?.text?.includes("El jugador indica");
        if (cierrePersistido) break;
      }
      await wait(250);
    }
    check(`[${mode}] el expediente guarda el objeto resultante con el mismo vínculo`, cierrePersistido);
    if (!cierrePersistido) console.log("   estado visible:", await comprobadorResultado.innerText());
    const journalFinal = await (
      await context.request.get(`${BASE}/api/journal/${seededId}`)
    ).json();
    const persistenciaCraftingCorrecta =
      journalFinal.session?.craftingExperiment?.originalItem?.id === craftingItemId &&
      journalFinal.session?.craftingExperiment?.variantId === "greater" &&
      journalFinal.session?.craftingExperiment?.minimumModifierLevel === 35 &&
      journalFinal.session?.craftingExperiment?.actionLabel === "Orbe exaltado superior" &&
      journalFinal.session?.craftingExperiment?.successCriteria?.length === 1 &&
      journalFinal.session?.craftingExperiment?.successCriteria?.[0]?.kind === "goal-affix-count" &&
      journalFinal.session?.craftingExperiment?.successCriteria?.[0]?.minimumCount === 4 &&
      journalFinal.session?.evidence?.some(
        (entry) =>
          entry.kind === "confirmed" && entry.text.includes("Cambio estructural confirmado"),
      ) &&
      journalFinal.session?.lastResult?.subjective === true &&
      journalFinal.session?.lastResult?.text?.includes("El jugador indica") &&
      !journalFinal.session?.lastResult?.text?.includes("Cambio estructural confirmado") &&
      journalFinal.session?.lastResult?.outcome === "resolved";
    check(
      `[${mode}] la sesión persiste snapshot, comparación y valoración`,
      persistenciaCraftingCorrecta,
    );
    if (!persistenciaCraftingCorrecta) {
      console.log("   sesión final:", journalFinal.session);
      console.log(
        "   eventos finales:",
        journalFinal.sessionEvents?.map((entry) => ({
          trigger: entry.trigger,
          from: entry.fromStatus,
          to: entry.toStatus,
          createdAt: entry.createdAt,
        })),
      );
    }

    const rutaTrasResultado = craftingWorkspace.getByTestId("crafting-route");
    const revisarRiesgo = rutaTrasResultado.getByRole("button", {
      name: "Revisar opciones con riesgo",
    });
    const reemplazoProtegido = await revisarRiesgo.isVisible();
    if (reemplazoProtegido) await revisarRiesgo.click();
    const estadoRutaLlena = await rutaTrasResultado.getAttribute("data-route-state");
    const essenceNoRevisada =
      (await rutaTrasResultado.getByRole("button", { name: "Revisar una Essence" }).count()) === 0;
    const alloyNoRevisado =
      (await rutaTrasResultado.getByRole("button", { name: "Revisar un Alloy" }).count()) === 0;
    const gateAvanzadoVisible = await craftingWorkspace
      .getByTestId("crafting-advanced-patch-gate")
      .isVisible();
    const rutaLlenaExplicaRevision = /tooltip|reemplazar|riesgo/i.test(
      await rutaTrasResultado.innerText(),
    );
    const piezaLlenaSegura =
      estadoRutaLlena === "replacement-tools" &&
      essenceNoRevisada &&
      alloyNoRevisado &&
      rutaLlenaExplicaRevision;
    check(
      `[${mode}] una pieza llena reconoce el riesgo sin ofrecer rutas no revisadas`,
      piezaLlenaSegura,
    );
    if (!piezaLlenaSegura) {
      console.log("   ruta llena:", {
        estadoRutaLlena,
        reemplazoProtegido,
        essenceNoRevisada,
        alloyNoRevisado,
        gateAvanzadoVisible,
        rutaLlenaExplicaRevision,
      });
    }

    // --- Recursos externos y consola --------------------------------------
    check(`[${mode}] sin peticiones a hosts externos (${externas.length})`, externas.length === 0);
    if (externas.length > 0) console.log("   externas:", externas.slice(0, 5));
    const imgs = await page.evaluate(() =>
      Array.from(document.images).map((i) => i.currentSrc || i.src),
    );
    check(
      `[${mode}] una URL remota con el origen como credencial sigue siendo externa`,
      !isAllowedSmokeImageUrl(`${new URL(BASE).origin}@example.invalid/imagen.png`, BASE),
    );
    check(
      `[${mode}] sin <img> remotas (${imgs.length} imágenes)`,
      imgs.every((s) => isAllowedSmokeImageUrl(s, BASE)),
    );
    const erroresRelevantes = erroresConsola.filter(
      (e) =>
        !esFaviconAusente(e) &&
        !(falloDeGuardadoSimulado && e.includes("api/character") && e.includes("ERR_FAILED")),
    );
    check(
      `[${mode}] sin errores de consola relevantes (${erroresRelevantes.length})`,
      erroresRelevantes.length === 0,
    );
    if (erroresRelevantes.length > 0) console.log("   consola:", erroresRelevantes.slice(0, 3));
  } catch (err) {
    console.error(`ERROR en el smoke del Hito 4B (${mode}):`, err.message);
    failures += 1;
    total += 1;
  } finally {
    if (browser) await browser.close();
    stopServer(proc);
  }
}

try {
  for (const mode of modes) {
    await runFlow(mode, mode === "prod" ? 7189 : 7188);
  }
} finally {
  removeSmokeTempDir(TEMP_ROOT);
}

console.log(
  `\nCapturas en: ${SHOT_DIR}${UPDATE_SCREENSHOTS ? " (versionadas)" : " (temporal; usa --update-screenshots para actualizar docs/)"}`,
);
console.log(
  failures === 0
    ? `\nHITO 4B: ${total}/${total} COMPROBACIONES PASARON`
    : `\nHITO 4B: ${failures} de ${total} COMPROBACIONES FALLARON`,
);
process.exit(failures === 0 ? 0 : 1);
