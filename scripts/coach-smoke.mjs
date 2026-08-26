/**
 * Prueba de navegador del TALLER UNIFICADO de Crafting.
 *
 * Uso:
 *   node scripts/coach-smoke.mjs                      → producción (requiere build previo)
 *   node scripts/coach-smoke.mjs --dev                → desarrollo (Vite + Strict Mode)
 *   node scripts/coach-smoke.mjs --all                → ambos
 *   node scripts/coach-smoke.mjs --update-screenshots → además actualiza docs/screenshots/
 *
 * Arranca su propio servidor, en su propio puerto y con su propia base SQLite
 * temporal. No toca la base real ni ningún servidor que ya estuviera en marcha.
 *
 * COMPROBACIONES:
 *   1. Crafting abre con los dos caminos y sin banco técnico a la vista.
 *   2. Pieza normal → una única acción compatible.
 *   3. Pieza mágica incompleta → una única acción compatible.
 *   4. Pieza rara llena → parar, con motivo.
 *   5. Datos incompletos → pedir la evidencia que falta.
 *   6. «No sé qué necesita» solo decide cuando los datos lo justifican.
 *   7. Recorrido completo: recomendación → registro → antes/después.
 *   8. El banco avanzado arranca plegado y conserva su estado.
 *   9. Cambiar de modo no borra nada.
 *  10. Densidad: pocas palabras antes de desplegar detalles.
 *  11. Móvil 390×844: el mentor no tapa preguntas, botones ni el objeto.
 *  12. Teclado: se puede recorrer y el foco no cae en contenido oculto.
 *  13. Sin peticiones externas ni errores de consola relevantes.
 */
import { spawn, execSync } from "node:child_process";
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

const TEMP_ROOT = createSmokeTempDir("taller");
const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all") ? ["prod", "dev"] : args.includes("--dev") ? ["dev"] : ["prod"];

const SHOT_DIR = UPDATE_SCREENSHOTS ? join(REPO, "docs", "screenshots") : join(TEMP_ROOT, "capturas");
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
      ? productionServerCommand()
      : toolCommand("vite", ["--port", String(port), "--strictPort"]);
  const proc = spawn(command, cmdArgs, {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: mode === "prod" ? "production" : "development",
      SECURE_COOKIES: "false",
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

const ESTADO_LIMPIO = { corrupted: false, mirrored: false, split: false, unidentified: false };
const mod = (id, text, affix, tags) => ({
  id,
  text,
  kind: "explicit",
  values: [],
  verified: true,
  affix,
  tags,
});

const CROSSBOW_TEXT = readFileSync(
  join(REPO, "server", "fixtures", "phoenixCoreCrossbowAdvanced.es.txt"),
  "utf8",
);

const TRANSMUTED_MACE_TEXT = [
  "Clase de objeto: Guantes",
  "Rareza: Mágico",
  "Guantes de cuero de victoria",
  "------------------",
  "Evasión: 45",
  "------------------",
  "## Nivel de objeto: 55",
  '{ Mod. de sufijo "de victoria" (Grado: 1) — Ataque }',
  "+25 a la precisión",
].join("\n");

// Cadena localizada basada en el objeto real que descubrió las regresiones de
// nombres mágicos, afijos sin nombre y transición Mágico → Raro.
const REAL_MAGIC_MACE_TEXT = [
  "Clase de objeto: Mazas a una mano",
  "Rareza: Mágico",
  "Maza de procesión  de victoria",
  "------------------------------",
  "Daño físico: 33-69",
  "Probabilidad de impacto crítico: 5.00%",
  "Ataques por segundo: 1.40",
  "-------------------------",
  "## Requiere: Nivel 54, 96 (unmet) Fue",
  "## Nivel de objeto: 64",
  '{ Mod. de prefijo "" (Grado: 4) — Ataque }',
  "+233(168-236) a la precisión",
  '{ Mod. de sufijo "de victoria" (Grado: 7) — Vida }',
  "Ganas 8(7-9) de vida por cada enemigo asesinado",
].join("\n");

const REAL_MACE_AFTER_REGAL_TEXT = [
  "Clase de objeto: Mazas a una mano",
  "Rareza: Raro",
  "Destructor de venganza",
  "Maza de procesión",
  "------------------------------",
  "Daño físico: 33-69",
  "Daño de fuego: 31-45 (fire)",
  "Probabilidad de impacto crítico: 5.00%",
  "Ataques por segundo: 1.40",
  "-------------------------",
  "## Requiere: Nivel 54, 96 (unmet) Fue",
  "## Nivel de objeto: 64",
  '{ Mod. de prefijo "certero" (Grado: 4) — Ataque }',
  "+233(168-236) a la precisión",
  '{ Mod. de sufijo "de victoria" (Grado: 7) — Vida }',
  "Ganas 8(7-9) de vida por cada enemigo asesinado",
  '{ Mod. de sufijo "de venganza" (Grado: 8) — Atributo }',
  "+12 a la fuerza",
].join("\n");

const REAL_MACE_AFTER_EXALTED_TEXT = [
  "Clase de objeto: Mazas a una mano",
  "Rareza: Raro",
  "Destructor de venganza",
  "Maza de procesión",
  "------------------------------",
  "Daño físico: 48-93",
  "Daño de fuego: 31-45 (fire)",
  "Probabilidad de impacto crítico: 5.00%",
  "Ataques por segundo: 1.40",
  "-------------------------",
  "## Requiere: Nivel 54, 96 (unmet) Fue",
  "## Nivel de objeto: 64",
  '{ Mod. de prefijo "certero" (Grado: 4) — Ataque }',
  "+233(168-236) a la precisión",
  '{ Mod. de prefijo "férreo" (Grado: 8) — Daño, Físico }',
  "Daño físico aumentado un 22(18-22)%",
  '{ Mod. de sufijo "de victoria" (Grado: 7) — Vida }',
  "Ganas 8(7-9) de vida por cada enemigo asesinado",
  '{ Mod. de sufijo "de venganza" (Grado: 8) — Atributo }',
  "+12 a la fuerza",
].join("\n");

/**
 * Perfil con una pieza de cada estado que el guía debe saber resolver, más la
 * ballesta real importada por la ruta normal de la API.
 */
async function seedProfile(request, base) {
  const demo = await (await request.get(`${base}/api/character/demo`)).json();
  const importada = await request.post(`${base}/api/import/item-text`, {
    data: { text: CROSSBOW_TEXT, patch: "0.5.4f" },
  });
  if (!importada.ok()) throw new Error(`no se pudo importar la ballesta: HTTP ${importada.status()}`);
  const ballesta = (await importada.json()).item;
  ballesta.id = "taller-ballesta";
  const mazaResponse = await request.post(`${base}/api/import/item-text`, {
    data: { text: REAL_MAGIC_MACE_TEXT, patch: "0.5.4f" },
  });
  if (!mazaResponse.ok()) throw new Error(`no se pudo importar la maza: HTTP ${mazaResponse.status()}`);
  const mazaReal = (await mazaResponse.json()).item;
  mazaReal.id = "taller-maza-real";

  const profile = {
    ...demo.profile,
    id: "taller-smoke-perfil",
    items: [
      ballesta,
      mazaReal,
      {
        id: "taller-normal",
        name: "Guantes en bruto",
        baseType: "Guantes de cuero",
        itemClass: "Guantes",
        slot: "gloves",
        rarity: "normal",
        itemLevel: 55,
        modifiers: [],
        craftingState: { ...ESTADO_LIMPIO },
        sources: [],
      },
      {
        id: "taller-magico",
        name: "Anillo a medio hacer",
        baseType: "Anillo de zafiro",
        slot: "ring1",
        rarity: "magic",
        itemLevel: 60,
        modifiers: [mod("tm1", "+24% a la resistencia al frío", "suffix", ["Resistencias"])],
        craftingState: { ...ESTADO_LIMPIO },
        sources: [],
      },
      {
        id: "taller-lleno",
        name: "Coraza terminada",
        baseType: "Coraza de placas",
        slot: "body",
        rarity: "rare",
        itemLevel: 78,
        modifiers: [
          mod("tl1", "+110 a la vida máxima", "prefix", ["Vida"]),
          mod("tl2", "+240 a la armadura", "prefix", ["Defensa"]),
          mod("tl3", "+12% a la vida máxima", "prefix", ["Vida"]),
          mod("tl4", "+31% a la resistencia al fuego", "suffix", ["Resistencias"]),
          mod("tl5", "+28% a la resistencia al rayo", "suffix", ["Resistencias"]),
          mod("tl6", "+17% a la resistencia al caos", "suffix", ["Resistencias"]),
        ],
        craftingState: { ...ESTADO_LIMPIO },
        sources: [],
      },
      {
        id: "taller-incompleto",
        name: "Botas copiadas a medias",
        baseType: "Botas de malla",
        slot: "boots",
        rarity: "magic",
        itemLevel: 61,
        modifiers: [mod("ti1", "+18% a la velocidad de movimiento", "suffix", ["Velocidad"])],
        sources: [],
      },
    ],
  };

  const saved = await request.post(`${base}/api/character`, {
    data: { profile },
  });
  if (!saved.ok()) throw new Error(`no se pudo sembrar el personaje: HTTP ${saved.status()}`);
  return profile;
}

/** Deja seleccionada una pieza concreta en el guía. */
async function elegirPieza(page, itemId) {
  // El selector vive plegado para no competir con la recomendación.
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="coach-piezas-importadas"]')
      ?.closest("details")
      ?.setAttribute("open", "true");
  });
  await page.getByTestId(`coach-elegir-${itemId}`).click();
  await page.waitForFunction(
    (id) =>
      document.querySelector(`[data-testid="coach-elegir-${id}"]`)?.getAttribute("data-active") ===
      "true",
    itemId,
    { timeout: 10000 },
  );
}

/** Elige la pieza indicada y avanza hasta la recomendación. */
async function abrirPieza(page, itemId, direccion = "damage") {
  await elegirPieza(page, itemId);
  await page.getByTestId("coach-eleccion").waitFor({ timeout: 10000 });
  await page.getByTestId(`coach-direccion-${direccion}`).click();
  await page.getByTestId("coach-sin-evidencia").waitFor({ timeout: 10000 });
  await page
    .getByTestId(direccion === "damage" ? "coach-focus-physical" : "coach-focus-maximum-life")
    .click();
  await page.getByTestId("coach-recomendacion").waitFor({ timeout: 10000 });
}

/** El mismo recorrido, empezando por lo que escribiría un jugador. */
async function abrirPiezaConObjetivo(page, itemId, objetivo) {
  await elegirPieza(page, itemId);
  await page.getByTestId("coach-eleccion").waitFor({ timeout: 10000 });
  await page.getByTestId("coach-objetivo-texto").fill(objetivo);
  await page.getByTestId("coach-interpretar-objetivo").click();
  await page.getByTestId("coach-recomendacion").waitFor({ timeout: 10000 });
}

/** ¿Se solapan dos rectángulos? */
function seSolapan(a, b) {
  if (!a || !b) return false;
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== TALLER DE CRAFTING — MODO ${mode.toUpperCase()} (${BASE}) ===`);
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

    // --- 1. Entrada sin personaje ----------------------------------------
    await page.goto(BASE, { waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("crafting-mode-chooser").waitFor({ timeout: 15000 });
    check(
      `[${mode}] Crafting abre con tres recorridos y el guía por defecto`,
      (await page.getByTestId("crafting-mode-academy").innerText()).includes(
        "Aprender crafting",
      ) &&
        (await page.getByTestId("crafting-mode-coach").innerText()).includes(
          "Ayuda en vivo",
        ) &&
        (await page.getByTestId("crafting-mode-laboratory").innerText()).includes(
          "Taller avanzado",
        ) &&
        (await page.getByTestId("crafting-mode-coach").getAttribute("data-active")) === "true",
    );
    check(
      `[${mode}] sin pieza, la única acción principal es pegar un objeto`,
      (await page.getByTestId("crafting-coach").getAttribute("data-phase")) === "empty" &&
        (await page.getByTestId("coach-pegar-objeto").isVisible()) &&
        (await page.getByTestId("crafting-workspace").count()) === 0,
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-inicio-${mode}.png`), fullPage: false });

    await page.getByTestId("crafting-mode-academy").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 15000 });
    check(
      `[${mode}] la Academia básica sigue disponible desde el mismo sitio`,
      (await page.getByTestId("academia-crafting").getAttribute("data-stage")) === "intro",
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-academia-${mode}.png`), fullPage: false });
    await page.getByTestId("crafting-mode-coach").click();

    // --- 2. Con piezas reales --------------------------------------------
    const profile = await seedProfile(context.request, BASE);
    await page.evaluate((id) => localStorage.setItem("exile-copilot:characterId", id), profile.id);
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("coach-objeto").waitFor({ timeout: 20000 });
    await page.getByText("Trabajar con otra pieza", { exact: true }).click();
    const selectorPiezas = page.getByTestId("coach-piezas-importadas");
    check(
      `[${mode}] el selector muestra arte, nombre, base y rareza de cada pieza`,
      (await selectorPiezas.locator(".item-artwork").count()) === profile.items.length &&
        (await selectorPiezas.innerText()).includes(profile.items[0]?.baseType ?? "") &&
        /Normal|Mágico|Raro|Único|Moneda|Gema|Otro/.test(await selectorPiezas.innerText()),
    );
    await page.getByText("Trabajar con otra pieza", { exact: true }).click();

    // El tercer recorrido expone el motor experto como una secuencia guiada.
    await page.getByTestId("crafting-mode-laboratory").click();
    await page.getByTestId("crafting-laboratory-status").waitFor({ timeout: 15000 });
    check(
      `[${mode}] el Taller avanzado empieza con una sola pregunta y cinco pasos`,
      (await page.getByTestId("crafting-workspace").innerText()).includes("Taller avanzado") &&
        (await page.getByTestId("crafting-laboratory-status").locator("li").count()) === 5 &&
        (await page.getByTestId("crafting-expert-blueprint").count()) === 0 &&
        (await page.getByTestId("crafting-diagnosis").innerText()).includes("¿Qué quieres mejorar primero?"),
    );
    const laboratoryTracker = page.getByTestId("crafting-laboratory-tracker");
    check(
      `[${mode}] el recorrido avanzado mantiene un único paso actual con estados explícitos`,
      (await laboratoryTracker.locator('[aria-current="step"]').count()) === 1 &&
        (await laboratoryTracker.locator('[data-step-state="current"]').count()) === 1 &&
        (await laboratoryTracker.locator('[data-step-state="pending"]').count()) >= 1,
    );
    const buildIntent = page.getByTestId("crafting-build-intent");
    check(
      `[${mode}] el plan avanzado señala una necesidad medible sin elegir por el jugador`,
      (await buildIntent.getAttribute("data-alignment")) === "choice-required" &&
        (await buildIntent.innerText()).includes("resistencias") &&
        (await page.getByTestId("crafting-use-build-intent-defence").isVisible()),
    );
    await page.getByRole("radio", { name: "Daño", exact: true }).click();
    check(
      `[${mode}] un objetivo contrario queda marcado para revisión`,
      (await page.getByTestId("crafting-build-intent").getAttribute("data-alignment")) === "conflict" &&
        (await page.getByTestId("crafting-build-intent").innerText()).includes("Revisa el objetivo") &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes(
          "encaje por revisar",
        ),
    );
    await page.getByRole("button", { name: "Guardar objetivo y continuar" }).click();
    await page.getByTestId("crafting-base-workbench").waitFor({ timeout: 10000 });
    const baseWorkbenchText = await page.getByTestId("crafting-base-workbench").innerText();
    const baseComparableBy = await page
      .getByTestId("crafting-base-workbench")
      .getAttribute("data-comparable-by");
    const baseCandidateCount = await page.locator('[data-testid^="crafting-base-candidate-"]').count();
    check(
      `[${mode}] el proyecto compara bases sin inventar una mejor pieza`,
      /Banco de bases/i.test(baseWorkbenchText) &&
        ["item-class", "slot"].includes(baseComparableBy) &&
        baseWorkbenchText.includes("probabilidades") &&
        baseCandidateCount >= 1,
    );
    check(
      `[${mode}] el objetivo se contrasta con evidencia local sin fingir un pool`,
      (await page.getByTestId("crafting-target-evidence").isVisible()) &&
        (await page.getByTestId("crafting-target-evidence").getAttribute("data-pool-coverage")) === "unavailable" &&
        (await page.getByTestId("crafting-target-evidence").innerText()).includes("Pool no disponible") &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes("sin pool autorizado"),
    );
    await page.getByRole("button", { name: "Confirmar esta base" }).click();
    await page.getByRole("button", { name: "Continuar sin marcar" }).click();
    await page.getByTestId("crafting-observed-targets").locator("summary").click();
    await page.getByTestId("crafting-use-observed-target-0").click();
    const exactTargets = page.getByTestId("crafting-exact-targets");
    await exactTargets.locator("input").first().fill("Daño físico aumentado un 81(65-84)%");
    await exactTargets.locator("select").first().selectOption("6");
    check(
      `[${mode}] un jugador experto puede partir de una línea observada y fijar grado 6 o mejor`,
      (await exactTargets.locator("input").first().inputValue()).includes("Daño físico") &&
        (await exactTargets.locator("select").first().inputValue()) === "6",
    );
    check(
      `[${mode}] el Mentor recibe el contrato avanzado completo y frena si ya se cumple`,
      (await page.getByTestId("mentor-contextual-titulo").innerText()).includes("Daño") &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes(
          "1 condición de parada",
        ) &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes(
          "no debes gastar",
        ),
    );
    await page.getByRole("button", { name: "Guardar parada y continuar" }).click();
    await page.getByTestId("crafting-expert-blueprint").waitFor({ timeout: 10000 });
    check(
      `[${mode}] si la pieza ya cumple la parada, el laboratorio frena otra inversión`,
      (await page.getByTestId("crafting-expert-blueprint").getAttribute("data-status")) === "already-complete" &&
        (await page.getByTestId("crafting-expert-blueprint").innerText()).includes("cumple tu contrato de salida") &&
        (await page.getByTestId("crafting-route-comparison").getByRole("button").first().isEnabled()) === false,
    );
    check(
      `[${mode}] el proyecto experto muestra fase, presupuesto y las tres salidas`,
      (await page.getByTestId("crafting-project-saved").isVisible()) &&
        (await page.getByTestId("crafting-project-base-decision").getAttribute("data-decision")) === "stop" &&
        (await page.getByTestId("crafting-project-branches").locator("article").count()) === 3 &&
        (await page.getByTestId("crafting-expert-blueprint").innerText()).includes("Tope · 50 exaltados"),
    );
    await page.evaluate((profileId) => {
      const prefix = `exile-copilot:crafting-project:v1:${profileId}:`;
      const storageKey = Object.keys(localStorage).find((key) => key.startsWith(prefix));
      if (!storageKey) throw new Error("No se encontró el proyecto avanzado guardado");
      const project = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      project.attempts = [
        {
          sessionId: "smoke-project-attempt",
          recordedAt: new Date().toISOString(),
          actionLabel: "Orbe exaltado",
          resultName: "Núcleo de fénix",
          branch: "salvage",
          decisionKind: "stop",
          decisionTitle: "No gastes otra moneda todavía",
          addedModifiers: ["+12 a la fuerza"],
          removedModifiers: [],
          protectedStatus: "preserved",
          successStatus: "not-fulfilled",
        },
      ];
      localStorage.setItem(storageKey, JSON.stringify(project));
      window.dispatchEvent(
        new CustomEvent("exile-copilot:crafting-project-updated", {
          detail: { storageKey },
        }),
      );
    }, profile.id);
    await page.getByTestId("crafting-project-history").waitFor({ timeout: 10000 });
    check(
      `[${mode}] el proyecto conserva memoria de cada intento y su rama`,
      (await page.getByTestId("crafting-project-history").getAttribute("data-attempt-count")) === "1" &&
        (await page.getByTestId("crafting-project-history").innerText()).includes("Resultado aprovechable") &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes("1 intento registrado"),
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-laboratorio-${mode}.png`), fullPage: false });
    await page.getByTestId("crafting-mode-coach").click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 15000 });
    await page.getByTestId("crafting-mode-laboratory").click();
    await page.getByTestId("crafting-expert-blueprint").waitFor({ timeout: 15000 });
    const persistedAdvancedContract = await page.evaluate((profileId) => {
      const prefix = `exile-copilot:crafting-project:v1:${profileId}:`;
      const storageKey = Object.keys(localStorage).find((key) => key.startsWith(prefix));
      return storageKey ? localStorage.getItem(storageKey) ?? "" : "";
    }, profile.id);
    check(
      `[${mode}] el proyecto conserva su contrato al salir y volver`,
      persistedAdvancedContract.includes("Daño físico aumentado un 81") &&
        (await page.getByTestId("crafting-expert-blueprint").getAttribute("data-status")) === "already-complete",
    );
    await page.getByTestId("crafting-mode-coach").click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 15000 });

    check(
      `[${mode}] con piezas importadas el guía muestra la primera sin abrir el banco`,
      (await page.getByTestId("coach-objeto").isVisible()) &&
        (await page.getByTestId("crafting-workspace").isVisible()) === false &&
        (await page.getByTestId("coach-objetivo-texto").isVisible()),
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-objeto-${mode}.png`), fullPage: false });

    // Densidad: qué se lee antes de desplegar nada.
    const palabras = (await page.getByTestId("crafting-coach").innerText())
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    check(
      `[${mode}] el recorrido principal cabe en pocas palabras (${palabras})`,
      palabras <= 90,
    );

    // El jugador puede describir la build sin conocer la taxonomía interna.
    await page
      .getByTestId("coach-objetivo-texto")
      .fill("Quiero un arco destinado a mi arquera de hielo nivel 86");
    await page.getByTestId("coach-interpretar-objetivo").click();
    const baseAssessment = page.getByTestId("coach-evaluacion-base");
    await baseAssessment.waitFor({ timeout: 10000 });
    await baseAssessment.locator("summary").click();
    check(
      `[${mode}] «arquera de hielo» se convierte directamente en un contrato de frío`,
      (await page.getByTestId("coach-direccion-elegida").innerText()).includes("daño de hielo") &&
        (await baseAssessment.getAttribute("data-status")) === "controlled-attempt" &&
        (await page.getByTestId("coach-base-personaje").innerText()).includes("expediente") &&
        (await page.getByTestId("coach-base-objetivo").innerText()).includes("daño de hielo") &&
        (await page.getByTestId("coach-base-decision").innerText()).includes("apuesta limitada"),
    );
    await baseAssessment.locator("summary").click();
    check(
      `[${mode}] el Mentor anuncia automáticamente el veredicto previo de la base`,
      (await page.getByTestId("mentor-speech-bubble").isVisible()) &&
        (await page.getByTestId("mentor-speech-bubble").innerText()).includes("intento controlado"),
    );
    await page.getByTestId("mentor-speech-dismiss").click();
    await page.getByTestId("coach-cambiar-direccion").click();

    // Un objetivo libre ambiguo no se convierte en una receta a escondidas.
    await page.getByTestId("coach-objetivo-texto").fill("Quiero más daño y resistencias");
    await page.getByTestId("coach-interpretar-objetivo").click();
    await page.getByTestId("coach-sin-evidencia").waitFor({ timeout: 10000 });
    check(
      `[${mode}] un objetivo libre ambiguo pide elegir una prioridad antes de gastar`,
      (await page.getByTestId("coach-sin-evidencia").innerText()).includes(
        "Elige cuál quieres trabajar primero",
      ) &&
        (await page.getByTestId("coach-elegir-damage").isVisible()) &&
        (await page.getByTestId("coach-elegir-defence").isVisible()),
    );

    // --- 3. Pieza normal → una única acción compatible -------------------
    await abrirPieza(page, "taller-normal");
    const recomendacion = page.getByTestId("coach-recomendacion");
    check(
      `[${mode}] pieza normal → Orbe de transmutación como única acción`,
      (await recomendacion.getAttribute("data-kind")) === "use-currency" &&
        (await recomendacion.getAttribute("data-action")) === "transmutation" &&
        (await page.getByTestId("coach-instruccion").innerText()).includes("Guantes en bruto"),
    );
    check(
      `[${mode}] antes de gastar declara cuándo debe detenerse el paso`,
      (await page.getByTestId("coach-condicion-parada").innerText()).includes("daño físico") &&
        (await page.getByTestId("coach-condicion-parada").innerText()).includes("media+") &&
        (await page.getByTestId("coach-condicion-parada").innerText()).includes("1 paso"),
    );
    check(
      `[${mode}] el contrato permite elegir tirada mínima y límite antes de gastar`,
      (await page.getByTestId("coach-contrato-controles").locator("summary").isVisible()) &&
      (await page.getByTestId("coach-roll-minimum-middle").getAttribute("aria-pressed")) === "true" &&
        (await page.getByTestId("coach-attempt-limit-1").getAttribute("aria-pressed")) === "true",
    );
    await page.getByTestId("coach-contrato-controles").locator("summary").click();
    await page.getByTestId("coach-roll-minimum-high").click();
    await page.getByTestId("coach-attempt-limit-2").click();
    await page.getByTestId("coach-contrato-controles").locator("summary").click();
    check(
      `[${mode}] cambiar el contrato actualiza su resumen antes de gastar`,
      (await page.getByTestId("coach-condicion-parada").innerText()).includes("alta") &&
        (await page.getByTestId("coach-condicion-parada").innerText()).includes("2 pasos"),
    );
    check(
      `[${mode}] el Mentor recibe la tirada y el límite elegidos`,
      (await page.getByTestId("mentor-contextual-titulo").innerText()).includes(
        "daño físico · tirada alta",
      ) &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes("2 pasos") &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes(
          "no como probabilidad",
        ),
    );
    check(
      `[${mode}] «Qué puede ocurrir» y «Evidencia técnica» llegan plegados`,
      (await recomendacion.locator("details[open]").count()) === 0 &&
      (await recomendacion.locator("details").count()) === 2,
    );
    await page.getByTestId("coach-lo-hare").click();
    check(
      `[${mode}] el contrato queda congelado mientras se espera el resultado`,
      (await page.getByTestId("coach-contrato-controles").count()) === 0,
    );
    const textoQueNoCuadra = TRANSMUTED_MACE_TEXT
      .replace("Clase de objeto: Guantes", "Clase de objeto: Bastones")
      .replace("Guantes de cuero de victoria", "Bastón distinto de victoria");
    await page.getByTestId("coach-resultado-texto").fill(textoQueNoCuadra);
    await page.getByTestId("coach-comparar").click();
    await page.getByTestId("coach-comparacion").waitFor({ timeout: 10000 });
    check(
      `[${mode}] si el texto no cuadra explica el motivo y permite corregirlo sin reiniciar`,
      (await page.getByTestId("coach-veredicto").textContent()).includes("La base cambió") &&
        (await page.getByTestId("coach-corregir-resultado").isVisible()) &&
        (await page.getByTestId("coach-objeto-resumen").innerText()).includes("pieza normal"),
    );
    await page.getByTestId("coach-diagnostico-comparacion").locator("summary").click();
    check(
      `[${mode}] un bloqueo muestra el snapshot anterior y las diferencias exactas`,
      (await page.getByTestId("coach-diagnostico-comparacion").innerText()).includes("Antes:") &&
        (await page.getByTestId("coach-diagnostico-comparacion").innerText()).includes("Después:") &&
        (await page.getByTestId("coach-diagnostico-nuevos").isVisible()),
    );
    await page.getByTestId("coach-corregir-resultado").click();
    check(
      `[${mode}] corregir conserva el texto anterior para poder editarlo`,
      (await page.getByTestId("coach-resultado-texto").evaluate((element) => element.value)) ===
        textoQueNoCuadra,
    );
    await page.getByTestId("coach-resultado-texto").fill(TRANSMUTED_MACE_TEXT);
    await page.getByTestId("coach-comparar").click();
    await page.getByTestId("coach-comparacion").waitFor({ timeout: 10000 });
    check(
      `[${mode}] un afijo ajeno permite solo el paso restante que el jugador autorizó`,
        (await page.getByTestId("coach-comparacion").getAttribute("data-verdict")) === "continue" &&
        (await page.getByTestId("coach-comparacion").innerText()).includes("modificador nuevo") &&
        (await page.getByTestId("coach-objeto-resumen").innerText()).includes("cabe uno más") &&
        (await page.getByTestId("coach-comparacion").getAttribute("data-decision-kind")) === "continue" &&
        /queda 1 paso/i.test(
          await page.getByTestId("coach-veredicto").textContent(),
        ) &&
        (await page.getByTestId("coach-seguir").isVisible()),
    );
    check(
      `[${mode}] el Mentor explica el progreso del contrato tras el resultado`,
      (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes("Paso 1 de 2") &&
        (await page.getByTestId("mentor-contextual-mensaje").innerText()).includes(
          "Queda 1 paso",
        ),
    );
    const speechBubble = page.getByTestId("mentor-speech-bubble");
    await speechBubble.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] la mascota anuncia el resultado automáticamente sin pedir otra consulta`,
      (await speechBubble.getAttribute("data-cue-id"))?.startsWith("crafting-result:") === true &&
        (await speechBubble.innerText()).includes("Paso 1 de 2") &&
        (await page.getByTestId("mentor-contextual").getAttribute("data-collapsed")) === "true",
    );
    await page.getByTestId("mentor-speech-open").click();
    check(
      `[${mode}] pulsar el bocadillo abre la explicación completa`,
      (await page.getByTestId("mentor-contextual").getAttribute("data-collapsed")) === "false" &&
        (await page.getByTestId("mentor-contextual-mensaje").isVisible()),
    );
    await page.getByTestId("mentor-contextual-plegar").click();
    check(
      `[${mode}] tras el resultado ofrece reevaluar, cambiar de pieza o terminar`,
      (await page.getByTestId("coach-empezar-otra").innerText()).includes("Replantear") &&
        (await page.getByTestId("coach-cambiar-pieza-resultado").isVisible()) &&
        (await page.getByTestId("coach-terminar-resultado").isVisible()),
    );

    // --- 4. Pieza mágica incompleta --------------------------------------
    await abrirPieza(page, "taller-magico");
    check(
      `[${mode}] pieza mágica con hueco → Orbe de aumento`,
      (await recomendacion.getAttribute("data-action")) === "augmentation",
    );
    check(
      `[${mode}] avisa de la consecuencia real de llenarla`,
      (await page.getByTestId("coach-aviso").innerText()).includes("límite observado"),
    );

    // --- 5. Pieza rara llena → parar -------------------------------------
    await abrirPieza(page, "taller-lleno");
    check(
      `[${mode}] pieza rara llena → parar, con motivo`,
      (await recomendacion.getAttribute("data-kind")) === "stop" &&
        (await recomendacion.innerText()).includes("llena") &&
        (await page.getByTestId("coach-lo-hare").count()) === 0,
    );

    // --- 6. Datos incompletos --------------------------------------------
    await abrirPieza(page, "taller-incompleto");
    await recomendacion.getByTestId("crafting-repair-toggle").click();
    check(
      `[${mode}] datos incompletos → pedir la evidencia que falta, no gastar`,
      (await recomendacion.getAttribute("data-kind")) === "needs-data" &&
        (await recomendacion.innerText()).includes("Ctrl+Alt+C") &&
        (await recomendacion.getByTestId("crafting-repair-repaste").isVisible()) &&
        (await page.getByTestId("coach-otro-camino").isVisible()),
    );

    // --- 7. Cadena real: un resultado ajeno al objetivo frena ------------
    await abrirPieza(page, "taller-maza-real");
    check(
      `[${mode}] la maza mágica real empieza por Regio`,
      (await recomendacion.getAttribute("data-action")) === "regal",
    );
    await page.getByTestId("coach-lo-hare").click();
    await page.getByTestId("coach-resultado-texto").fill(REAL_MACE_AFTER_REGAL_TEXT);
    await page.getByTestId("coach-comparar").click();
    await page.getByTestId("coach-comparacion").waitFor({ timeout: 10000 });
    check(
      `[${mode}] Regio conserva el snapshot, frena y separa el bloqueo del encaje`,
      (await page.getByTestId("coach-comparacion").getAttribute("data-verdict")) === "stop" &&
        (await page.getByTestId("coach-cambios").innerText()).includes("+12 a la fuerza") &&
        (await page.getByTestId("coach-relacion-objetivo").getAttribute("title")).includes(
          "no coincide con tu objetivo principal: daño físico",
        ) &&
        (await page.getByTestId("coach-seguir").count()) === 0,
    );
    check(
      `[${mode}] al agotar el intento ofrece otra base sin empujar otra moneda`,
      (await page.getByTestId("coach-probar-otra-base").isVisible()) &&
        (await page.getByTestId("coach-empezar-otra").innerText()).includes("Cambiar objetivo"),
    );
    // El jugador puede replantearlo explícitamente desde el resultado actual;
    // no se encadena Exaltado a escondidas.
    await page.getByTestId("coach-empezar-otra").click();
    await page.getByTestId("coach-direccion-damage").click();
    const focusButtons = page.locator('button[data-testid^="coach-focus-"]');
    const focusHeights = await focusButtons.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    );
    const interpretButton = page.getByTestId("coach-interpretar-objetivo");
    await page.waitForTimeout(200);
    const disabledStyle = await interpretButton.evaluate((button) => ({
      disabled: button instanceof HTMLButtonElement && button.disabled,
      background: getComputedStyle(button).backgroundColor,
    }));
    check(
      `[${mode}] el objetivo exacto está agrupado, es táctil y la CTA bloqueada no finge estar activa`,
      (await page.getByTestId("coach-focus-grupos").isVisible()) &&
        focusHeights.length === 8 &&
        focusHeights.every((height) => height >= 44) &&
        disabledStyle.disabled &&
        disabledStyle.background !== "rgb(246, 182, 35)" &&
        (await page.getByText("Elige un objetivo exacto.", { exact: true }).isVisible()),
    );
    await page.getByTestId("coach-focus-physical").click();
    await recomendacion.waitFor({ timeout: 10000 });
    check(
      `[${mode}] solo tras replantearlo el banco usa el resultado de Regio`,
      (await recomendacion.getAttribute("data-action")) === "exalted" &&
        (await page.getByTestId("coach-objeto").innerText()).includes("Destructor de venganza"),
    );
    await page.getByTestId("coach-lo-hare").click();
    const dosCambios = `${REAL_MACE_AFTER_EXALTED_TEXT}\n{ Mod. de sufijo "extra" (Grado: 9) — Atributo }\n+7 a la destreza`;
    await page.getByTestId("coach-resultado-texto").fill(dosCambios);
    await page.getByTestId("coach-comparar").click();
    await page.getByTestId("coach-comparacion").waitFor({ timeout: 10000 });
    check(
      `[${mode}] dos cambios en un solo pegado no se confirman y permiten recuperar el estado actual`,
      (await page.getByTestId("coach-comparacion").getAttribute("data-verdict")) === "stop" &&
        (await page.getByTestId("coach-diagnostico-nuevos").locator("li").count()) === 2 &&
        (await page.getByTestId("coach-usar-resultado-base").isVisible()),
    );
    await page.getByTestId("coach-corregir-resultado").click();
    await page.getByTestId("coach-resultado-texto").fill(REAL_MACE_AFTER_EXALTED_TEXT);
    await page.getByTestId("coach-comparar").click();
    await page.getByTestId("coach-comparacion").waitFor({ timeout: 10000 });
    check(
      `[${mode}] Exaltado compara contra el Regio, reconoce daño físico y respeta los requisitos`,
      (await page.getByTestId("coach-comparacion").getAttribute("data-verdict")) === "stop" &&
        (await page.getByTestId("coach-cambios").innerText()).includes("Daño físico aumentado") &&
        (await page.getByTestId("coach-calidad-afijo").getAttribute("data-roll-band")) === "high" &&
        (await page.getByTestId("coach-calidad-afijo").getAttribute("data-goal-fit")) === "confirmed" &&
        (await page.getByTestId("coach-calidad-afijo").innerText()).includes("Alta") &&
        (await page.getByTestId("coach-calidad-afijo").innerText()).includes("Grado 8") &&
        (await page.getByTestId("coach-relacion-objetivo").getAttribute("title")).includes(
          "coincide con tu objetivo: daño físico",
        ) &&
        (await page.getByTestId("coach-rendimiento-arma").innerText()).includes(
          "98.7",
        ) &&
        (await page.getByTestId("coach-comparacion-objetivo-arma").innerText()).includes(
          "71.4 → 98.7",
        ) &&
        (await page.getByTestId("coach-veredicto").textContent()).includes(
          "no cumple requisitos",
        ),
    );

    // --- 8. «No sé qué necesita» -----------------------------------------
    // El perfil demo declara resistencias por debajo del umbral, así que SÍ
    // existe una carencia citable; el guía debe apoyarse en ese dato y no en
    // las etiquetas de la pieza.
    await elegirPieza(page, "taller-lleno");
    await page.getByTestId("coach-eleccion").waitFor({ timeout: 10000 });
    await page.getByTestId("coach-direccion-unknown").click();
    const sinEvidencia = page.getByTestId("coach-sin-evidencia");
    await sinEvidencia.waitFor({ timeout: 10000 });
    check(
      `[${mode}] «No sé qué necesita» separa carencia, encaje de pieza y decisión`,
      /expediente declara/.test(await sinEvidencia.innerText()) &&
        /%/.test(await sinEvidencia.innerText()) &&
        (await page.getByTestId("coach-contexto-encaje-pieza").innerText()).includes(
          "sea la pieza adecuada",
        ) &&
        (await page.getByTestId("coach-context-focus-resistances").innerText()).includes(
          "en esta pieza",
        ) &&
        (await page.getByTestId("coach-context-focus-resistances").isVisible()) &&
        (await page.getByTestId("coach-cambiar-pieza-contexto").isVisible()) &&
        (await page.getByTestId("coach-no-gastar-sin-evidencia").isVisible()) &&
        !/etiquetas de|ya lleva/.test(await sinEvidencia.innerText()),
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-no-se-${mode}.png`), fullPage: false });

    // Y ahora el caso SIN evidencia: mismo perfil con las resistencias por
    // encima del umbral, de modo que no exista ninguna carencia citable.
    const sinCarencia = {
      ...profile,
      resistances: { fire: 78, cold: 80, lightning: 76, chaos: -10 },
    };
    await context.request.post(`${BASE}/api/character`, {
      data: { profile: sinCarencia },
    });
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("coach-objeto").waitFor({ timeout: 20000 });
    await page.getByTestId("coach-direccion-unknown").click();
    await page.getByTestId("coach-sin-evidencia").waitFor({ timeout: 10000 });
    check(
      `[${mode}] sin carencia comprobable dice que no puede decidirlo y ofrece salida`,
      (await page.getByTestId("coach-sin-evidencia").innerText()).includes(
        "No encuentro una prioridad concreta en tu plan ni una carencia medible en el expediente.",
      ) &&
        (await page.getByTestId("coach-elegir-damage").isVisible()) &&
        (await page.getByTestId("coach-elegir-defence").isVisible()) &&
        (await page.getByTestId("coach-no-gastar-sin-evidencia").isVisible()) &&
        (await page.getByTestId("coach-direccion-elegida").count()) === 0,
    );
    await page.screenshot({
      path: join(SHOT_DIR, `taller-sin-evidencia-${mode}.png`),
      fullPage: false,
    });
    // «No gastar todavía» también desde aquí, y sin perder la pieza.
    await page.getByTestId("coach-no-gastar-sin-evidencia").click();
    await page.getByTestId("coach-espera").waitFor({ timeout: 10000 });
    check(
      `[${mode}] desde la falta de evidencia también se puede aparcar sin perder la pieza`,
      (await page.getByTestId("coach-objeto").innerText()).length > 0,
    );
    await page.getByTestId("coach-otro-camino").click();
    // Se restaura el expediente original para el resto del recorrido.
    await context.request.post(`${BASE}/api/character`, {
      data: { profile },
    });
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "crafting");
    await page.getByTestId("coach-objeto").waitFor({ timeout: 20000 });

    // --- 8. Recorrido completo con la ballesta real ----------------------
    await abrirPiezaConObjetivo(
      page,
      "taller-ballesta",
      "Quiero más daño de hielo sin perder velocidad de ataque",
    );
    check(
      `[${mode}] el objetivo escrito se conserva y se interpreta antes de gastar`,
      (await page.getByTestId("coach-direccion-elegida").getAttribute("data-player-goal")) ===
        "Quiero más daño de hielo sin perder velocidad de ataque" &&
        (await page.getByTestId("coach-direccion-elegida").innerText()).toLocaleLowerCase("es").includes(
          "daño de hielo",
        ),
    );
    check(
      `[${mode}] vincula «no perder velocidad de ataque» a una línea real de la pieza`,
      (await page.getByTestId("coach-protecciones").innerText()).includes(
        "Velocidad de ataque aumentada un 13",
      ) &&
        (await page.getByTestId("coach-protecciones-no-vinculadas").count()) === 0,
    );
    check(
      `[${mode}] la ballesta real recibe una única acción compatible`,
      (await recomendacion.getAttribute("data-action")) === "exalted",
    );
    check(
      `[${mode}] el encabezado dice «Siguiente acción legal», no que sea la mejor`,
      // `innerText` aplica `text-transform`, así que se compara sin distinguir
      // mayúsculas: lo que importa es la fórmula, no su presentación.
      /siguiente acci[óo]n legal/i.test(await recomendacion.innerText()) &&
        !/mejor forma|la mejor manera|garantiz/i.test(await recomendacion.innerText()),
    );
    const aviso = page.getByTestId("coach-aleatoriedad");
    check(
      `[${mode}] la aleatoriedad y el límite de dirección se ven sin desplegar nada`,
      (await aviso.isVisible()) &&
        (await aviso.getAttribute("data-steering")) !== "directed" &&
        (await aviso.getAttribute("data-goal-fit")) === "not-confirmed" &&
        (await aviso.innerText()).includes("no puedo dirigirlo hacia daño"),
    );
    check(
      `[${mode}] las acciones son aceptar el riesgo, no gastar y explorar avanzadas`,
      (await page.getByTestId("coach-lo-hare").innerText()).includes("Aceptar riesgo") &&
        (await page.getByTestId("coach-no-gastar").isVisible()) &&
        (await page.getByTestId("coach-explorar-avanzado").isVisible()),
    );
    const contar = async (testId) => {
      const textoVisible = await page.getByTestId(testId).evaluate((element) => {
        const copy = element.cloneNode(true);
        if (!(copy instanceof HTMLElement)) return "";
        copy.querySelectorAll("[hidden], details:not([open]) > :not(summary)").forEach((node) => node.remove());
        return copy.textContent ?? "";
      });
      return textoVisible.trim().split(/\s+/).filter(Boolean).length;
    };
    const palabrasDecision = await contar("coach-recomendacion");
    const palabrasPanel = await contar("crafting-coach");
    check(
      `[${mode}] la decisión visible cabe en 80 palabras (${palabrasDecision})`,
      palabrasDecision <= 80,
    );
    check(
      `[${mode}] el panel entero no se convierte en documentación (${palabrasPanel})`,
      palabrasPanel <= 130,
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-recomendacion-${mode}.png`), fullPage: false });

    // «No gastar todavía» cierra el paso sin perder la pieza.
    await page.getByTestId("coach-no-gastar").click();
    await page.getByTestId("coach-espera").waitFor({ timeout: 10000 });
    check(
      `[${mode}] «No gastar todavía» cierra en corto y conserva la pieza`,
      (await page.getByTestId("coach-espera").innerText()).includes("sigue como está") &&
        (await page.getByTestId("coach-objeto").innerText()).includes("Núcleo de fénix") &&
        !/fracas|has fallado|error/i.test(await page.getByTestId("coach-espera").innerText()),
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-no-gastar-${mode}.png`), fullPage: false });
    await page.getByTestId("coach-volver-accion").click();
    await page.getByTestId("coach-recomendacion").waitFor({ timeout: 10000 });

    // «Explorar herramientas avanzadas» solo abre el banco.
    await page.getByTestId("coach-explorar-avanzado").click();
    await page.getByTestId("crafting-workspace").waitFor({ timeout: 15000 });
    check(
      `[${mode}] explorar avanzadas abre el banco sin prometer una receta dirigida`,
      !/dirig|garantiz|conseguir[áa] daño|asegura/i.test(
        await page.getByTestId("crafting-workspace").innerText(),
      ),
    );
    await page.getByTestId("crafting-avanzado-toggle").click();

    await page.getByTestId("coach-lo-hare").click();
    await page.getByTestId("coach-registro").waitFor({ timeout: 10000 });
    check(
      `[${mode}] tras «Lo haré en el juego» el foco cae en el pegado del resultado`,
      await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") === "coach-resultado-texto",
      ),
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-registro-${mode}.png`), fullPage: false });

    const resultado = `${CROSSBOW_TEXT.trim()}\n{ Mod. de sufijo "sintético del smoke" (Grado: 1) — Daño, Ataque }\n+19% a la velocidad de ataque añadida por la prueba`;
    await page.getByTestId("coach-resultado-texto").fill(resultado);
    await page.getByTestId("coach-comparar").click();
    await page.getByTestId("coach-comparacion").waitFor({ timeout: 20000 });
    const comparacion = await page.getByTestId("coach-comparacion").innerText();
    check(
      `[${mode}] el antes/después dice qué cambió y qué se conservó`,
      (await page.getByTestId("coach-cambios").innerText()).includes("velocidad de ataque") &&
        (await page.getByTestId("coach-hechos-resultado").innerText()).includes("Nada perdido"),
    );
    check(
      `[${mode}] tras llenar la pieza, el veredicto es parar`,
      (await page.getByTestId("coach-comparacion").getAttribute("data-verdict")) === "stop",
    );
    check(
      `[${mode}] no promete que el resultado estuviera garantizado`,
      !/garantiz/i.test(comparacion),
    );
    check(
      `[${mode}] un afijo ajeno al objetivo se describe como tal y detiene la cadena`,
      (await page.getByTestId("coach-calidad-afijo").getAttribute("data-goal-fit")) ===
        "not-confirmed" &&
        (await page.getByTestId("coach-calidad-afijo").innerText()).includes("No encaja") &&
        (await page.getByTestId("coach-salvedad-mejora").textContent()).includes("pieza completa") &&
        (await page.getByTestId("coach-comparacion").getAttribute("data-verdict")) === "stop" &&
        !/es una mejora|ha mejorado/i.test(comparacion),
    );
    const resultLayout = await page.getByTestId("coach-comparacion").evaluate((card) => {
      const visibleText = Array.from(card.querySelectorAll("*"))
        .filter((node) => {
          const style = getComputedStyle(node);
          return node.children.length === 0 &&
            !node.classList.contains("sr-only") &&
            node.closest("details:not([open])") === null &&
            style.display !== "none" &&
            style.visibility !== "hidden";
        })
        .map((node) => node.textContent ?? "")
        .join(" ");
      const visibleWords = visibleText.trim().split(/\s+/).filter(Boolean).length;
      const buttons = Array.from(card.querySelectorAll("button")).filter((button) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      });
      return {
        visibleWords,
        goldLabels: buttons
          .filter((button) => getComputedStyle(button).backgroundColor === "rgb(246, 182, 35)")
          .map((button) => button.textContent?.trim() ?? ""),
        buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
        valueFontSizes: Array.from(
          card.querySelectorAll('[data-testid="coach-rendimiento-arma"] .text-xl'),
        ).map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
      };
    });
    check(
      `[${mode}] el parte muestra un veredicto con palabra e icono y una sola acción dorada coherente`,
      (await page.getByTestId("coach-estado-resultado").innerText()).includes("PARA") &&
        resultLayout.goldLabels.length === 1 &&
        !resultLayout.goldLabels.includes("Probar otra base"),
    );
    check(
      `[${mode}] cifras y densidad forman un parte escaneable (${resultLayout.visibleWords} palabras)`,
      resultLayout.visibleWords <= 70 &&
        resultLayout.valueFontSizes.length === 3 &&
        resultLayout.valueFontSizes.every((size) => size >= 20),
    );
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileResult = await page.getByTestId("coach-comparacion").evaluate((card) => ({
      height: card.getBoundingClientRect().height,
      clientWidth: card.clientWidth,
      scrollWidth: card.scrollWidth,
      buttonHeights: Array.from(card.querySelectorAll("button"))
        .filter((button) => button.getBoundingClientRect().height > 0)
        .map((button) => button.getBoundingClientRect().height),
    }));
    check(
      `[${mode}] el parte móvil cabe en 520 px, no desborda y sus acciones son táctiles (${Math.round(mobileResult.height)} px)`,
      mobileResult.height <= 520 &&
        mobileResult.scrollWidth === mobileResult.clientWidth &&
        mobileResult.buttonHeights.every((height) => height >= 44),
    );
    if (desktopViewport) await page.setViewportSize(desktopViewport);
    await page.screenshot({ path: join(SHOT_DIR, `taller-comparacion-${mode}.png`), fullPage: false });

    // --- 9. Banco avanzado: plegado, con estado --------------------------
    const toggle = page.getByTestId("crafting-avanzado-toggle");
    check(
      `[${mode}] el banco avanzado arranca plegado y no compite`,
      (await toggle.getAttribute("data-open")) === "false" &&
        (await page.getByTestId("crafting-workspace").isVisible()) === false,
    );
    const focoEnOculto = await page.evaluate(() => {
      const banco = document.querySelector('[data-testid="crafting-workspace"]');
      if (!banco) return "sin-banco";
      const focusables = banco.querySelectorAll("button, input, textarea, select, a[href]");
      for (const element of focusables) {
        element.focus?.();
        if (document.activeElement === element) return "foco-en-oculto";
      }
      return "ok";
    });
    check(
      `[${mode}] el foco no puede entrar en el banco plegado (${focoEnOculto})`,
      focoEnOculto === "ok",
    );

    await toggle.click();
    await page.getByTestId("crafting-workspace").waitFor({ timeout: 15000 });
    check(
      `[${mode}] al desplegarlo el banco conserva su comportamiento`,
      (await page.getByTestId("crafting-workspace").innerText()).includes("Banco de crafting") &&
        (await page.getByTestId("crafting-route").count()) === 1,
    );
    await page.getByTestId("crafting-item-taller-lleno").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="crafting-item-taller-lleno"]')
          ?.getAttribute("data-active") === "true",
      undefined,
      { timeout: 10000 },
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-avanzado-${mode}.png`), fullPage: false });

    // --- 10. Cambiar de modo no borra nada -------------------------------
    await page.getByTestId("crafting-mode-academy").click();
    await page.getByTestId("academia-crafting").waitFor({ timeout: 15000 });
    await page.getByTestId("crafting-mode-coach").click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 15000 });
    check(
      `[${mode}] volver de la Academia conserva pieza elegida y banco desplegado`,
      (await page
        .getByTestId("crafting-item-taller-lleno")
        .getAttribute("data-active")) === "true" &&
        (await toggle.getAttribute("data-open")) === "true" &&
        (await page.getByTestId("crafting-workspace").isVisible()),
    );

    // --- 11. Teclado -----------------------------------------------------
    await elegirPieza(page, "taller-magico");
    await page.getByTestId("coach-eleccion").waitFor({ timeout: 10000 });
    await page.getByTestId("coach-direccion-damage").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("coach-focus-physical").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("coach-recomendacion").waitFor({ timeout: 10000 });
    check(
      `[${mode}] se puede decidir con teclado y el foco va a la recomendación`,
      await page.evaluate(
        () => document.activeElement?.closest('[data-testid="coach-recomendacion"]') !== null,
      ),
    );

    // --- 12. Móvil: el mentor no tapa nada -------------------------------
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(300);
    const anchoMovil = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    check(
      `[${mode}] 390 px sin desbordamiento horizontal (${anchoMovil.client}/${anchoMovil.scroll})`,
      anchoMovil.scroll <= anchoMovil.client + 1,
    );

    // Se comprueba DURANTE la decisión, no en una captura: se desplaza cada
    // elemento clave a la vista y se mide su solape real con el mentor.
    const objetivos = [
      "coach-objeto",
      "coach-recomendacion",
      "coach-lo-hare",
      "coach-otro-camino",
    ];
    let solapados = [];
    for (const testId of objetivos) {
      const locator = page.getByTestId(testId);
      if ((await locator.count()) === 0) continue;
      await locator.scrollIntoViewIfNeeded();
      await wait(120);
      const rects = await page.evaluate((id) => {
        const objetivo = document.querySelector(`[data-testid="${id}"]`);
        const mentor = document.querySelector('[data-testid="mentor-contextual"]');
        const r = (element) => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
        };
        return { objetivo: r(objetivo), mentor: r(mentor) };
      }, testId);
      if (seSolapan(rects.objetivo, rects.mentor)) solapados.push(testId);
    }
    check(
      `[${mode}] el mentor no tapa objeto, recomendación ni botones en móvil (${solapados.join(", ") || "ninguno"})`,
      solapados.length === 0,
    );

    // Y tampoco al desplegarlo, que es cuando más sitio ocupa. Se comprueba
    // rehaciendo una decisión real: la app mueve el foco y desplaza la vista.
    // El mentor puede llegar abierto o como mascota según el estado conservado
    // por el recorrido. Abrirlo mediante el control que sea realmente visible
    // evita que la prueba intente pulsar el botón interno de un panel oculto.
    if ((await page.getByTestId("mentor-contextual").getAttribute("data-collapsed")) === "true") {
      await page.getByTestId("mentor-mascota").click();
    }
    await wait(400);
    const reservaMentor = await page.evaluate(() => {
      const mentor = document.querySelector('[data-testid="mentor-contextual"]');
      if (!mentor) return null;
      const inset = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--mentor-inset"),
      );
      return { inset, height: mentor.getBoundingClientRect().height };
    });
    check(
      `[${mode}] al abrir el mentor se reserva su altura real`,
      reservaMentor !== null &&
        Number.isFinite(reservaMentor.inset) &&
        reservaMentor.inset >= reservaMentor.height,
    );
    await page.getByTestId("coach-cambiar-direccion").click();
    await page.getByTestId("coach-eleccion").waitFor({ timeout: 10000 });
    await page.getByTestId("coach-direccion-defence").click();
    await page.getByTestId("coach-focus-maximum-life").click();
    await page.getByTestId("coach-recomendacion").waitFor({ timeout: 10000 });
    await wait(700);
    // Con el mentor abierto ocupa parte de la pantalla; lo exigible es que el
    // jugador pueda leer la decisión y llegar a sus botones desplazándose.
    const tapados = [];
    for (const testId of ["coach-instruccion", "coach-acciones"]) {
      await page.evaluate((id) => {
        document.querySelector(`[data-testid="${id}"]`)?.scrollIntoView({ block: "nearest" });
      }, testId);
      await wait(250);
      const rects = await page.evaluate((id) => {
        const objetivo = document.querySelector(`[data-testid="${id}"]`);
        const mentor = document.querySelector('[data-testid="mentor-contextual"]');
        const r = (element) => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
        };
        return { objetivo: r(objetivo), mentor: r(mentor) };
      }, testId);
      if (seSolapan(rects.objetivo, rects.mentor)) tapados.push(testId);
    }
    check(
      `[${mode}] con el mentor desplegado la decisión y sus botones siguen alcanzables (${tapados.join(", ") || "ninguno tapado"})`,
      tapados.length === 0,
    );
    await page.screenshot({ path: join(SHOT_DIR, `taller-movil-${mode}.png`), fullPage: false });
    await page.getByTestId("mentor-contextual-plegar").click();
    await page.setViewportSize({ width: 1440, height: 1000 });

    // --- 13. Recursos y consola ------------------------------------------
    check(`[${mode}] sin peticiones a hosts externos (${externas.length})`, externas.length === 0);
    if (externas.length > 0) console.log("   externas:", externas.slice(0, 5));
    const erroresRelevantes = erroresConsola.filter((e) => !esFaviconAusente(e));
    check(
      `[${mode}] sin errores de consola relevantes (${erroresRelevantes.length})`,
      erroresRelevantes.length === 0,
    );
    if (erroresRelevantes.length > 0) console.log("   consola:", erroresRelevantes.slice(0, 3));
    await context.close();
  } catch (err) {
    console.error(`ERROR en el smoke del taller (${mode}):`, err.message);
    failures += 1;
    total += 1;
  } finally {
    if (browser) await browser.close();
    stopServer(proc);
  }
}

try {
  for (const mode of modes) {
    await runFlow(mode, mode === "prod" ? 7195 : 7194);
  }
} finally {
  removeSmokeTempDir(TEMP_ROOT);
}

console.log(
  `\nCapturas en: ${SHOT_DIR}${UPDATE_SCREENSHOTS ? " (versionadas)" : " (temporal; usa --update-screenshots para actualizar docs/)"}`,
);
console.log(
  failures === 0
    ? `\nTALLER DE CRAFTING: ${total}/${total} COMPROBACIONES PASARON`
    : `\nTALLER DE CRAFTING: ${failures} de ${total} COMPROBACIONES FALLARON`,
);
process.exit(failures === 0 ? 0 : 1);
