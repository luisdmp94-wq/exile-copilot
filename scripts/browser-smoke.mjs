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
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSmokeTempDir,
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
const TEMP_ROOT = createSmokeTempDir("flujo");

const SHOT_DIR = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
const args = process.argv.slice(2);
const modes = args.includes("--all")
  ? ["prod", "dev"]
  : args.includes("--dev")
    ? ["dev"]
    : ["prod"];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const STANDALONE_ITEM = [
  "Clase de objeto: Ballestas",
  "Rareza: Raro",
  "Núcleo de prueba",
  "Ballesta barnizada",
  "------------------",
  "Nivel de objeto: 32",
  "------------------",
  "Daño físico aumentado un 81%",
].join("\n");

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

/** Ruta de la base temporal de este modo, dentro del temporal de la ejecución. */
function dbPathFor(mode) {
  return join(TEMP_ROOT, `${mode}.db`);
}

function startServer(mode, port) {
  const { command, args: cmdArgs, shell } =
    mode === "prod"
      ? productionServerCommand()
      : toolCommand("vite", ["--port", String(port), "--strictPort"]);
  const proc = spawn(command, cmdArgs, {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: mode === "prod" ? "production" : "development",
      SECURE_COOKIES: "false",
      // Aislamiento explícito: nunca la base real.
      DATABASE_PATH: dbPathFor(mode),
    },
    shell,
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
 * Navegación por áreas (Expediente y mentor / Plan y mercado). Ambos paneles
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

/**
 * El editor completo del personaje vive en el panel lateral «Editar
 * expediente»: los campos del perfil solo existen mientras está abierto.
 */
async function abrirEditor(page) {
  await page.getByTestId("abrir-editor-expediente").click();
  await page.getByRole("dialog").waitFor({ timeout: 15000 });
}

async function cerrarEditor(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
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
    const publicHealth = await (await fetch(`${BASE}/api/health`)).json();

    // Se comprueba de VERDAD que la base en uso es la temporal de esta
    // ejecución, no se da por hecho que la variable se configuró.
    const dbPath = dbPathFor(mode);
    check(
      `[${mode}] base SQLite temporal y aislada (${basenameSeguro(dbPath)})`,
      existsSync(dbPath) &&
        dbPath.startsWith(TEMP_ROOT) &&
        !dbPath.startsWith(fileURLToPath(new URL("../", import.meta.url))),
    );

    browser = await launchBrowser();
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const runtimeErrors = [];
    const loadedScripts = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") loadedScripts.push(request.url());
    });
    page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        const location = message.location();
        runtimeErrors.push(
          `console: ${message.text()}${location.url ? ` (${location.url}:${location.lineNumber ?? 0})` : ""}`,
        );
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        runtimeErrors.push(
          `response: ${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/api/")) {
        runtimeErrors.push(
          `requestfailed: ${request.method()} ${new URL(request.url()).pathname}`,
        );
      }
    });
    mkdirSync(SHOT_DIR, { recursive: true });

    // 1. Carga inicial (Strict Mode en dev: no debe quedarse en "Restaurando…")
    await page.goto(BASE, { waitUntil: "networkidle" });
    check(
      `[${mode}] cabecera Exile Copilot visible`,
      await page.getByText("Exile Copilot").first().isVisible(),
    );
    check(
      `[${mode}] Crafting no forma parte de la descarga inicial`,
      !loadedScripts.some((url) => url.includes("CraftingSection")),
    );
    if (mode === "prod") {
      const moduleSrc = await page.locator('script[type="module"]').getAttribute("src");
      const [rootResponse, assetResponse] = await Promise.all([
        context.request.get(BASE),
        context.request.get(new URL(moduleSrc, BASE).toString()),
      ]);
      check(
        `[${mode}] HTML se revalida y los assets con hash son inmutables`,
        rootResponse.headers()["cache-control"] === "no-cache" &&
          assetResponse.headers()["cache-control"]?.includes("immutable") === true,
      );
    }
    check(
      `[${mode}] la cabecera distingue parche de cobertura verificada`,
      (await page.getByTestId("patch-compatibility-badge").getAttribute("data-status")) ===
        "limited" &&
        (await page.getByTestId("patch-compatibility-badge").innerText()).includes("parcial"),
    );
    const runtimeBadge = page.getByTestId("mentor-runtime-badge");
    const expectedMentorMode = publicHealth.services?.mentor?.mode;
    const expectedMentorLabel =
      expectedMentorMode === "ai-assisted" ? "IA asistida" : "Mentor por reglas";
    check(
      `[${mode}] la cabecera refleja el modo real del Mentor (${expectedMentorMode})`,
      (expectedMentorMode === "rules-only" || expectedMentorMode === "ai-assisted") &&
        (await runtimeBadge.getAttribute("data-mode")) === expectedMentorMode &&
        (await runtimeBadge.innerText()).includes(expectedMentorLabel),
    );
    await page.getByTestId("privacidad-abrir").click();
    const privacyDialog = page.getByTestId("privacidad-dialogo");
    await privacyDialog.waitFor({ timeout: 10000 });
    check(
      `[${mode}] privacidad explica sesión, almacenamiento, recuperación y estado del Mentor`,
      (await privacyDialog.getByText("Sesión anónima").isVisible()) &&
        (await privacyDialog.getByText("Qué se guarda").isVisible()) &&
        (await privacyDialog.getByText("Recuperación actual").isVisible()) &&
        (await page.getByTestId("privacidad-mentor").innerText()).includes(
          expectedMentorMode === "ai-assisted"
            ? publicHealth.services.mentor.provider === "groq"
              ? "pueden enviarse a Groq"
              : "pueden enviarse a OpenAI"
            : "no se envían a un proveedor de IA externo",
        ),
    );
    await page.getByTestId("privacidad-cerrar").click();
    const stuckRestoring = await page
      .getByText(/Restaurando/i)
      .first()
      .isVisible()
      .catch(() => false);
    check(`[${mode}] no se queda en "Restaurando…" (Strict Mode)`, !stuckRestoring);

    // 2. Bienvenida sin duplicados y carga del ejemplo (área «Expediente y mentor»)
    await irA(page, "expediente");
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
    // Sin personaje solo se ve la bienvenida: ni expediente ni caso vacíos, y el
    // importador todavía no está en pantalla (vive en «Editar expediente»).
    const importadorAntes = await page.locator("#panel-importacion").count();
    check(
      `[${mode}] bienvenida sin duplicados (${ejemploVisibles} botón de ejemplo, sin vacío repetido)`,
      ejemploVisibles === 1 &&
        importarVisibles === 1 &&
        (await page.getByText("Todavía no hay personaje").count()) === 0 &&
        (await page.getByTestId("caso-abierto").count()) === 0 &&
        importadorAntes === 0,
    );
    check(
      `[${mode}] la entrada ofrece tres intenciones reales`,
      (await page.locator('[data-intent="import"]:visible').count()) === 1 &&
        (await page.locator('[data-intent="new"]:visible').count()) === 1 &&
        (await page.locator('[data-intent="item"]:visible').count()) === 1,
    );

    // Crear personaje ya no es una promesa vacía: crea un perfil manual y
    // lleva directamente al primer campo que el jugador puede completar.
    await page.getByTestId("bienvenida-nuevo").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    check(
      `[${mode}] «Empezar desde cero» crea un perfil editable`,
      (await page.locator("#char-name").inputValue()) === "Nuevo personaje" &&
        (await page.evaluate(() => document.activeElement?.id)) === "char-name" &&
        (await page.getByText("Creado aquí").isVisible()),
    );
    await cerrarEditor(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("bienvenida").waitFor({ timeout: 15000 });

    // Un objeto suelto también tiene recorrido propio: pegar → analizar →
    // banco de Crafting, sin exigir importar primero un personaje completo.
    await page.getByTestId("bienvenida-objeto").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    await page.locator("#item-text").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(() => document.activeElement?.id === "item-text", undefined, {
      timeout: 15000,
    });
    check(
      `[${mode}] «Evaluar o craftear» enfoca directamente el objeto`,
      (await page.evaluate(() => document.activeElement?.id)) === "item-text",
    );
    await page.locator("#item-text").fill(STANDALONE_ITEM);
    await page.getByRole("button", { name: "Analizar objeto" }).click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 20000 });
    check(
      `[${mode}] objeto suelto continúa automáticamente en el guía de Crafting`,
      (await page.getByTestId("tab-crafting").getAttribute("data-state")) === "active" &&
        (await page
          .getByTestId("coach-objeto")
          .getByText("Núcleo de prueba")
          .first()
          .isVisible()) &&
        // El banco técnico NO se abre solo al pegar una pieza.
        (await page.getByTestId("crafting-workspace").isVisible()) === false,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("bienvenida").waitFor({ timeout: 15000 });

    // «Importar mi personaje» abre el editor Y lleva el foco al importador.
    await page.getByTestId("bienvenida-importar").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    await page.locator("#panel-importacion").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(
      () => document.activeElement?.id === "panel-importacion",
      undefined,
      { timeout: 15000 },
    );
    const focoImportador = await page.evaluate(
      () => document.activeElement?.id ?? null,
    );
    check(
      `[${mode}] «Importar mi personaje» abre el editor con el foco en el importador (${focoImportador})`,
      (await page.locator("#panel-importacion").locator("visible=true").count()) === 1 &&
        focoImportador === "panel-importacion",
    );
    await cerrarEditor(page);
    await page.getByRole("button", { name: "Cargar ejemplo" }).locator("visible=true").click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 10000 });
    check(`[${mode}] ejemplo precargado visible`, true);

    // El mentor empieza reducido a su mascota. Pulsarla abre SU panel flotante
    // (no otro acordeón de la página) y una segunda pulsación vuelve a cerrarlo.
    const contextualMentor = page.getByTestId("mentor-contextual");
    const mentorMascot = page.getByTestId("mentor-mascota");
    check(
      `[${mode}] mentor contextual empieza como mascota sin panel`,
      (await contextualMentor.getAttribute("data-collapsed")) === "true" &&
        (await mentorMascot.getAttribute("aria-expanded")) === "false" &&
        !(await page.getByTestId("mentor-contextual-mensaje").isVisible()),
    );
    await mentorMascot.click();
    check(
      `[${mode}] la mascota despliega su propio panel contextual`,
      (await contextualMentor.getAttribute("data-collapsed")) === "false" &&
        (await mentorMascot.getAttribute("aria-expanded")) === "true" &&
        (await page.getByTestId("mentor-contextual-mensaje").isVisible()),
    );
    await mentorMascot.click();
    check(
      `[${mode}] la mascota vuelve a plegar el panel`,
      (await contextualMentor.getAttribute("data-collapsed")) === "true" &&
        !(await page.getByTestId("mentor-contextual-mensaje").isVisible()),
    );

    // Crafting debe empezar directamente en sus tres recorridos. El antiguo
    // HUD «Cockpit de crafting» era ruido y no puede reaparecer por accidente.
    await irA(page, "crafting");
    await page.getByTestId("crafting-mode-chooser").waitFor({ timeout: 15000 });
    check(
      `[${mode}] Crafting se descarga al entrar y conserva una espera accesible`,
      loadedScripts.some((url) => url.includes("CraftingSection")),
    );
    check(
      `[${mode}] Crafting abre sin cockpit redundante`,
      (await page.getByTestId("crafting-cockpit").count()) === 0 &&
        (await page.getByText("Aprender crafting", { exact: true }).isVisible()) &&
        (await page.getByText("Ayuda en vivo", { exact: true }).isVisible()) &&
        (await page.getByText("Taller avanzado", { exact: true }).isVisible()),
    );

    // Doom Song ya incluye la estructura mínima que necesita el guía. Esta
    // comprobación evita que el ejemplo reparado vuelva a degradarse a resumen
    // incompleto por accidente.
    await page.getByRole("button", { name: /Más daño/ }).click();
    await page.getByRole("button", { name: "daño físico", exact: true }).click();
    check(
      `[${mode}] el arma del ejemplo reparada ya no pide volver a copiarla`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) !== "needs-data" &&
        (await page.getByTestId("coach-probar-practica").count()) === 0,
    );

    // Gale Crown sigue siendo deliberadamente un resumen sin clasificación
    // avanzada. Ese límite no puede convertirse en un callejón sin salida: el
    // usuario debe poder aprender con una pieza observada completa sin alterar
    // ni sustituir la pieza real de su expediente.
    await page.getByText("Trabajar con otra pieza", { exact: true }).click();
    await page.getByRole("button", { name: /Gale Crown/ }).click();
    await page.getByRole("button", { name: /Más defensa/ }).click();
    await page.getByRole("button", { name: "vida máxima", exact: true }).click();
    check(
      `[${mode}] una pieza incompleta explica el bloqueo antes de gastar`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) === "needs-data" &&
        (await page.getByTestId("coach-probar-practica").isVisible()),
    );
    await page.getByTestId("coach-probar-practica").click();
    await page.getByTestId("coach-practica-activa").waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] la práctica llega a una acción legal y declara que no se guarda`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) === "use-currency" &&
        (await page.getByTestId("coach-recomendacion").getAttribute("data-action")) === "regal" &&
        (await page.getByText(/no se guardará en tu expediente/i).isVisible()),
    );
    await page.getByRole("button", { name: "Volver a mi pieza", exact: true }).click();
    check(
      `[${mode}] salir de la práctica recupera la pieza real`,
      (await page.getByRole("heading", { name: "Gale Crown", exact: true }).isVisible()) &&
        (await page.getByTestId("coach-practica-activa").count()) === 0,
    );
    await irA(page, "expediente");

    await irA(page, "plan");
    const targetContextDetails = page.getByTestId("target-context-details");
    await targetContextDetails.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] el objetivo avanzado queda plegado hasta que se necesita`,
      !(await targetContextDetails.evaluate((details) => details.open)),
    );
    await targetContextDetails.locator(":scope > summary").click();
    const targetDataDetails = page.getByTestId("target-engine-data-details");
    await targetDataDetails.waitFor({ state: "visible", timeout: 10000 });
    const marketPrimaryAction = page.getByRole("button", {
      name: "Consultar precios",
      exact: true,
    });
    await marketPrimaryAction.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] Plan oculta la explicación técnica y Mercado conserva una sola CTA primaria`,
      (await targetDataDetails.isVisible()) &&
        !(await targetDataDetails.evaluate((details) => details.open)) &&
        (await marketPrimaryAction.getAttribute("data-variant")) === "default",
    );
    await page.getByRole("button", { name: "Ir al inicio de Exile Copilot" }).click();
    const volvioInicio = (await page.getByTestId("tab-expediente").getAttribute("data-state")) === "active";
    const volverArea = page.getByRole("button", { name: "Volver al área anterior" });
    await volverArea.click();
    const recuperoPlan = (await page.getByTestId("tab-plan").getAttribute("data-state")) === "active";
    check(
      `[${mode}] la marca vuelve al inicio y Volver recupera el área anterior`,
      volvioInicio && recuperoPlan,
    );
    await page.getByRole("button", { name: "Ir al inicio de Exile Copilot" }).click();

    // El ejemplo todavía no existe en SQLite. Las acciones con memoria no
    // pueden fallar en silencio: deben llevar al editor y explicar el paso.
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    const comprobarSinGuardar = page
      .getByTestId("caso-abierto")
      .getByRole("button", { name: "Probar y volver" });
    await comprobarSinGuardar.waitFor({ state: "visible", timeout: 15000 });
    await comprobarSinGuardar.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] una sesión sin personaje guardado abre el editor y lo explica`,
      (await page
        .getByText(/Guarda este personaje para que el mentor pueda recordar/i)
        .count()) === 1 &&
        (await page.getByRole("button", { name: /Guardar correcciones/i }).isEnabled()),
    );
    await cerrarEditor(page);

    // 3. Editar vida y guardar: comprobar la RESPUESTA de guardado (200 + perfil).
    // El editor completo vive ahora en el panel lateral «Editar expediente».
    await abrirEditor(page);
    await page.locator("#def-life").fill("2150");
    const [saveResponse, journalResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/character") && r.request().method() === "POST",
        { timeout: 10000 },
      ),
      page.waitForResponse(
        (r) => r.url().includes("/api/journal/") && r.request().method() === "GET",
        { timeout: 10000 },
      ),
      page.getByRole("button", { name: /Guardar correcciones/i }).click(),
    ]);
    const savedBody = await saveResponse.json().catch(() => null);
    check(
      `[${mode}] respuesta de guardado 200 con vida=2150`,
      saveResponse.status() === 200 && savedBody?.profile?.life === 2150,
    );
    check(
      `[${mode}] el diario privado queda disponible tras guardar`,
      journalResponse.status() === 200,
    );
    await cerrarEditor(page);

    // 4. Presupuesto (área «Plan y mercado») y recomendaciones (área «Expediente»)
    await irA(page, "plan");
    await page.getByTestId("market-context-details").evaluate((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    });
    await page.locator("#market-budget").fill("5");
    await irA(page, "expediente");
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    await page.waitForSelector("text=/Confianza|confianza/", { timeout: 15000 });
    // La principal domina el Caso Abierto; las demás viven en «Otras
    // posibilidades», que hay que desplegar para verlas.
    await page.getByTestId("acordeon-otras").click();
    const cards = await page.locator("text=/Confianza|confianza/").count();
    check(`[${mode}] se generan ${cards} tarjetas de recomendación`, cards >= 3);
    const textoRecomendaciones = await page.locator("main").innerText();
    check(
      `[${mode}] las recomendaciones no filtran enums ni timestamps internos`,
      !/\b(high|medium|low|balanced)\b/.test(textoRecomendaciones) &&
        !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(textoRecomendaciones),
    );

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
    const exportReport = page.getByTestId("informe-exportacion");
    await exportReport.waitFor({ state: "visible", timeout: 10_000 });
    check(
      `[${mode}] el informe de exportación queda plegado por defecto`,
      !(await exportReport.evaluate((details) => details.open)),
    );

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
    // Los campos del personaje viven en el panel «Editar expediente».
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "expediente");
    await abrirEditor(page);
    await page.locator("#def-life").waitFor({ timeout: 10000 });
    const restoredLife = await page.locator("#def-life").inputValue();
    check(
      `[${mode}] vida restaurada tras recargar = ${restoredLife} (esperado 2150)`,
      restoredLife === "2150",
    );
    await cerrarEditor(page);

    // Empezar otro personaje no deja el expediente guardado inaccesible. La
    // bienvenida ofrece un único retorno local y recupera la misma memoria.
    await abrirEditor(page);
    await page.getByRole("button", { name: "Empezar de nuevo" }).click();
    await cerrarEditor(page);
    await page.getByTestId("bienvenida-recuperar").waitFor({ timeout: 15000 });
    await page.getByTestId("bienvenida-recuperar").click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 15000 });
    const recoveredId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    check(
      `[${mode}] empezar de nuevo permite recuperar el expediente anterior`,
      recoveredId === savedBody.profile.id &&
        (await page.getByTestId("bienvenida-recuperar").count()) === 0,
    );

    // Simula el primer arranque tras un gran parche. Aunque el servidor siga
    // sirviendo datos de la versión revisada, un personaje marcado como 1.0 no
    // puede heredar a escondidas las instrucciones de Crafting anteriores.
    const futureProfile = { ...savedBody.profile, patch: "1.0" };
    // Usa la sesión del navegador: una petición Node separada sería, de forma
    // correcta, otro visitante y no puede sobrescribir este expediente.
    const futureSave = await context.request.post(`${BASE}/api/character`, {
      data: { profile: futureProfile },
    });
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("crafting-patch-review-gate").waitFor({
      state: "visible",
      timeout: 15000,
    });
    check(
      `[${mode}] un parche sin revisar detiene el consejo de Crafting`,
      futureSave.ok() &&
        (await page.getByTestId("crafting-patch-review-gate").isVisible()) &&
        (await page.getByTestId("crafting-patch-review-gate").innerText()).includes(
          "necesita revisión",
        ) &&
        (await page.getByTestId("crafting-coach").count()) === 0,
    );
    await page.getByTestId("mentor-mascota").click();
    check(
      `[${mode}] el mentor contextual tampoco contradice el bloqueo del parche`,
      (await page.getByTestId("mentor-contextual-patch-review-gate").isVisible()) &&
        (await page.getByTestId("mentor-contextual-preguntar").getAttribute("aria-disabled")) ===
          "true" &&
        (await page.getByTestId("mentor-contextual-preguntar").innerText()).includes(
          "Esperando revisión",
        ),
    );
    await page.getByRole("button", { name: "Ver conversación" }).click();
    await page.getByTestId("mentor-chat-patch-review-gate").waitFor({
      state: "visible",
      timeout: 10000,
    });
    check(
      `[${mode}] el chat del mentor explica por qué no propone mejoras`,
      (await page.getByTestId("mentor-chat-patch-review-gate").innerText()).includes(
        "datos del parche anterior",
      ) && (await page.getByTestId("mentor-preguntar").count()) === 0,
    );
    check(
      `[${mode}] recorrido completo sin errores de navegador ni API`,
      runtimeErrors.length === 0,
    );

    // Un fallo real de descarga diferida no puede dejar una pantalla negra.
    // Se bloquea el chunk de Crafting en un contexto limpio, se comprueba la
    // recuperación y después se permite la recarga normal.
    const recoveryContext = await browser.newContext();
    const recoveryPage = await recoveryContext.newPage();
    let blockedCraftingModule = false;
    const blockCrafting = async (route) => {
      const url = route.request().url();
      if (
        !blockedCraftingModule &&
        (url.includes("CraftingSection") || url.includes("/src/sections/CraftingSection.tsx"))
      ) {
        blockedCraftingModule = true;
        await route.abort("failed");
        return;
      }
      await route.continue();
    };
    await recoveryPage.route("**/*", blockCrafting);
    await recoveryPage.goto(BASE, { waitUntil: "networkidle" });
    await recoveryPage.getByTestId("tab-crafting").click();
    const recovery = recoveryPage.getByTestId("recuperacion-interfaz");
    await recovery.waitFor({ timeout: 15000 });
    check(
      `[${mode}] un módulo roto muestra recuperación en vez de una pantalla vacía`,
      blockedCraftingModule &&
        (await recovery.getByText("La interfaz se ha detenido").isVisible()) &&
        (await recoveryPage.getByTestId("recuperacion-recargar").isVisible()),
    );
    await recoveryPage.unroute("**/*", blockCrafting);
    await recoveryPage.getByTestId("recuperacion-recargar").click();
    await recoveryPage.getByText("Exile Copilot").first().waitFor({ timeout: 15000 });
    check(
      `[${mode}] recargar recupera la entrada sin alterar el expediente`,
      await recoveryPage.getByText("Exile Copilot").first().isVisible(),
    );
    await recoveryContext.close();

    // Una caída temporal de /meta debe poder resolverse desde la propia app,
    // sin pedir al jugador que conozca F5 ni que vuelva a pegar sus datos.
    const reconnectContext = await browser.newContext();
    const reconnectPage = await reconnectContext.newPage();
    let metaUnavailable = true;
    const interruptMeta = async (route) => {
      if (metaUnavailable) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "servicio-temporalmente-no-disponible",
            detail: "Prueba controlada de reconexión.",
          }),
        });
        return;
      }
      await route.continue();
    };
    await reconnectPage.route("**/api/meta", interruptMeta);
    await reconnectPage.goto(BASE, { waitUntil: "networkidle" });
    const metaErrorAlert = reconnectPage.getByTestId("meta-error");
    await metaErrorAlert.waitFor({ timeout: 15000 });
    check(
      `[${mode}] una caída temporal ofrece reintentar sin refrescar la página`,
      (await reconnectPage.getByTestId("meta-reintentar").isVisible()) &&
        (await metaErrorAlert.innerText()).includes("No se pudo cargar"),
    );
    metaUnavailable = false;
    const successfulMeta = reconnectPage.waitForResponse(
      (response) =>
        response.url() === `${BASE}/api/meta` && response.status() === 200,
      { timeout: 15000 },
    );
    await reconnectPage.getByTestId("meta-reintentar").click();
    await successfulMeta;
    await metaErrorAlert.waitFor({ state: "hidden", timeout: 15000 });
    await reconnectPage.getByTestId("tab-crafting").click();
    await reconnectPage.waitForFunction(
      () =>
        document.querySelector('[data-testid="tab-crafting"]')?.getAttribute("data-state") ===
        "active",
      undefined,
      { timeout: 15000 },
    );
    check(
      `[${mode}] el reintento recupera la configuración y la navegación`,
      (await reconnectPage.getByTestId("patch-compatibility-badge").isVisible()) &&
        (await reconnectPage.getByTestId("tab-crafting").getAttribute("data-state")) ===
          "active",
    );
    await reconnectContext.close();
    if (runtimeErrors.length > 0) {
      for (const error of runtimeErrors) console.error(`[runtime:${mode}] ${error}`);
    }
  } catch (err) {
    console.error(`ERROR en la prueba de navegador (${mode}):`, err.message);
    failures++;
  } finally {
    if (browser) await browser.close();
    await stopServer(proc);
  }
}

/** Solo el nombre del archivo: no se vuelca la ruta completa en el log. */
function basenameSeguro(ruta) {
  return ruta.split(/[\\/]/).pop();
}

try {
  for (const mode of modes) {
    await runFlow(mode, mode === "prod" ? 7199 : 7198);
  }
} finally {
  removeSmokeTempDir(TEMP_ROOT);
}

console.log(
  failures === 0
    ? "\nTODAS LAS COMPROBACIONES PASARON"
    : `\n${failures} COMPROBACIONES FALLARON`,
);
process.exit(failures === 0 ? 0 : 1);
