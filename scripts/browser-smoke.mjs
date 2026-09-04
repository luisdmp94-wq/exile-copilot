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
import { deflateSync } from "node:zlib";
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

const REPLACEMENT_GLOVES = [
  "Clase de objeto: Guantes",
  "Rareza: Raro",
  "Replacement Grip",
  "Vendajes vaal",
  "------------------",
  "Nivel de objeto: 79",
  "------------------",
  "+90 a la vida máxima",
].join("\n");

const DISTORTED_AMULET = readFileSync(
  fileURLToPath(
    new URL("../server/fixtures/distortedAmuletAdvanced.es.txt", import.meta.url),
  ),
  "utf8",
);

// Un único fixture alimenta parser, API y navegador. Su manifest conserva la
// procedencia y evita que estas tres barreras diverjan.
const ENGLISH_FRACTURED_AMULET = readFileSync(
  fileURLToPath(
    new URL(
      "../server/fixtures/itemText/observedFocusedAmuletAdvanced.en.txt",
      import.meta.url,
    ),
  ),
  "utf8",
);

const CHARACTER_BUILD = readFileSync(
  fileURLToPath(new URL("../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
  "utf8",
);

const RICH_POB_XML = readFileSync(
  fileURLToPath(new URL("../server/fixtures/pob2/richCharacter.synthetic.xml", import.meta.url)),
  "utf8",
);
const RICH_POB_CODE = deflateSync(Buffer.from(RICH_POB_XML, "utf8"))
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

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
      // readiness:deployment ya valida las variables públicas reales. Este
      // recorrido arranca un origen local aislado, no debe heredar ese modo.
      PUBLIC_DEPLOYMENT: "false",
      SECURE_COOKIES: "false",
      // Aislamiento explícito: nunca la base real.
      DATABASE_PATH: dbPathFor(mode),
      // Este recorrido intensivo ejecuta en pocos segundos acciones que un
      // jugador repartiría durante horas. Los límites públicos siguen
      // cubiertos por sus pruebas de seguridad; aquí evitamos que el propio
      // smoke se bloquee antes de comprobar el borrado final.
      API_RATE_LIMIT_PER_MINUTE: "10000",
      WRITE_RATE_LIMIT_PER_MINUTE: "2000",
      GUIDANCE_RATE_LIMIT_PER_MINUTE: "1000",
      MENTOR_RATE_LIMIT_PER_MINUTE: "300",
    },
    shell,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Hay que drenar ambos pipes. En Windows, dejar stdout sin consumidor llena
  // su búfer y puede congelar el servidor aislado durante recorridos largos.
  proc.stdout.on("data", () => {});
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

/**
 * Vuelve al selector respetando el historial real de áreas. Un flujo
 * restaurado puede necesitar primero Crafting → Expediente y solo después
 * Expediente → personajes; no se presupone una etiqueta fija.
 */
async function volverASelectorDePersonajes(page) {
  for (let step = 0; step < 3; step++) {
    const welcome = page.getByTestId("bienvenida");
    if ((await welcome.count()) > 0 && (await welcome.isVisible())) return;

    const previousArea = page.getByRole("button", { name: "Volver al área anterior" });
    if ((await previousArea.count()) > 0 && (await previousArea.isVisible())) {
      await previousArea.click();
      await page.waitForTimeout(100);
      continue;
    }

    const characters = page.getByRole("button", { name: "Volver a personajes" });
    if ((await characters.count()) > 0 && (await characters.isVisible())) {
      await characters.click();
      await page.getByTestId("bienvenida").waitFor({ timeout: 15000 });
      return;
    }
  }
  throw new Error("No se pudo volver al selector de personajes mediante la navegación visible");
}

const check = (name, ok) => {
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failures++;
};

/**
 * Auditoría sin heurísticas externas: exige los invariantes accesibles que la
 * propia aplicación controla. No sustituye una revisión con lector de
 * pantalla, pero evita publicar controles mudos, ids duplicados o diálogos sin
 * nombre después de un parche visual.
 */
async function auditAccessibleSurface(page, label) {
  const result = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.closest('[aria-hidden="true"]')
      );
    };
    const accessibleName = (element) => {
      const referenced = (element.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
      const labels = "labels" in element && element.labels
        ? [...element.labels].map((entry) => entry.textContent ?? "").join(" ").trim()
        : "";
      return (
        [
          element.getAttribute("aria-label"),
          referenced,
          labels,
          element.textContent,
          element.getAttribute("title"),
          element.getAttribute("alt"),
        ]
          .map((value) => value?.trim() ?? "")
          .find((value) => value.length > 0) ?? ""
      );
    };
    const controls = [
      ...document.querySelectorAll(
        'button,a[href],input:not([type="hidden"]),textarea,select,summary,[role="tab"],[contenteditable="true"]',
      ),
    ].filter(visible);
    const unnamed = controls
      .filter((element) => accessibleName(element).length === 0)
      .map((element) => ({
        tag: element.tagName.toLocaleLowerCase(),
        id: element.id || null,
        testId: element.getAttribute("data-testid"),
      }));
    const ids = [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const unnamedDialogs = [...document.querySelectorAll('[role="dialog"]')]
      .filter(visible)
      .filter((dialog) => accessibleName(dialog).length === 0)
      .length;

    return {
      lang: document.documentElement.lang,
      title: document.title.trim(),
      h1Count: document.querySelectorAll("h1").length,
      duplicateIds,
      unnamed,
      unnamedDialogs,
    };
  });
  const ok =
    result.lang === "es" &&
    result.title.length > 0 &&
    result.h1Count === 1 &&
    result.duplicateIds.length === 0 &&
    result.unnamed.length === 0 &&
    result.unnamedDialogs === 0;
  check(label, ok);
  if (!ok) console.error(`[accesibilidad] ${JSON.stringify(result)}`);
  return result;
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== MODO ${mode.toUpperCase()} (${BASE}) ===`);
  const proc = startServer(mode, port);
  let browser;
  try {
    await waitForServer(`${BASE}/api/health`);
    check(`[${mode}] servidor responde /api/health`, true);
    const healthResponse = await fetch(`${BASE}/api/health`);
    const publicHealth = await healthResponse.json();
    const evidenceDates = [
      publicHealth.patch?.asOf,
      publicHealth.compatibility?.reviewedAt,
    ].filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
    const latestEvidenceDate = evidenceDates.sort().at(-1);
    const readinessResponse = await fetch(`${BASE}/api/ready`);
    const readiness = await readinessResponse.json();
    check(
      `[${mode}] instancia disponible para su modo declarado (/api/ready)`,
      readinessResponse.ok &&
        readiness.status === "ready" &&
        readiness.checks?.every((entry) => entry.status === "pass"),
    );
    check(
      `[${mode}] los sondeos operativos nunca se sirven desde caché`,
      healthResponse.headers.get("cache-control")?.includes("no-store") === true &&
        readinessResponse.headers.get("cache-control")?.includes("no-store") === true &&
        healthResponse.headers.get("pragma") === "no-cache" &&
        readinessResponse.headers.get("pragma") === "no-cache",
    );
    const privateResponse = await fetch(`${BASE}/api/character/demo`);
    check(
      `[${mode}] las respuestas del visitante son privadas y no almacenables`,
      privateResponse.ok &&
        privateResponse.headers.get("cache-control") ===
          "private, no-store, max-age=0" &&
        privateResponse.headers.get("pragma") === "no-cache" &&
        privateResponse.headers.get("vary")?.includes("Cookie") === true,
    );
    check(
      `[${mode}] health publica la fecha real de la evidencia y no la hora de consulta`,
      latestEvidenceDate !== undefined &&
        publicHealth.dataUpdatedAt === `${latestEvidenceDate}T00:00:00.000Z`,
    );

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
    const youtubeRequests = [];
    await context.route("https://www.youtube-nocookie.com/**", async (route) => {
      youtubeRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>YouTube test double</title>",
      });
    });
    const page = await context.newPage();
    const runtimeErrors = [];
    let expectedCharacterSaveFailure = false;
    let expectedCharacterRestoreFailure = false;
    let expectedItemImportFailure = false;
    const loadedScripts = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") loadedScripts.push(request.url());
    });
    page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        if (expectedCharacterSaveFailure && message.text().includes("503")) return;
        if (expectedCharacterRestoreFailure && message.text().includes("503")) return;
        if (
          expectedItemImportFailure &&
          message.text().includes("400") &&
          message.location().url.includes("/api/import/item-text")
        ) return;
        const location = message.location();
        runtimeErrors.push(
          `console: ${message.text()}${location.url ? ` (${location.url}:${location.lineNumber ?? 0})` : ""}`,
        );
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        if (
          expectedItemImportFailure &&
          response.status() === 400 &&
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/import/item-text"
        ) {
          return;
        }
        if (
          expectedCharacterSaveFailure &&
          response.status() === 503 &&
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/character"
        ) {
          return;
        }
        if (
          expectedCharacterRestoreFailure &&
          response.status() === 503 &&
          response.request().method() === "GET" &&
          new URL(response.url()).pathname.startsWith("/api/character/")
        ) {
          return;
        }
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
    const visualComfort = await page.evaluate(() => {
      const parseRgb = (value) => {
        const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
        return channels.length === 3 ? channels : null;
      };
      const luminance = (rgb) => {
        const linear = rgb.map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const bodyStyle = getComputedStyle(document.body);
      const foreground = parseRgb(bodyStyle.color);
      const background = parseRgb(bodyStyle.backgroundColor);
      if (!foreground || !background) return null;
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return {
        foreground,
        contrast: (lighter + 0.05) / (darker + 0.05),
      };
    });
    check(
      `[${mode}] el texto principal evita blanco puro sin perder legibilidad prolongada`,
      visualComfort !== null &&
        Math.max(...visualComfort.foreground) <= 215 &&
        visualComfort.contrast >= 7,
    );
    await auditAccessibleSurface(
      page,
      `[${mode}] portada sin controles mudos, ids duplicados ni estructura principal ambigua`,
    );
    const expedienteTab = page.getByTestId("tab-expediente");
    await expedienteTab.press("ArrowRight");
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="tab-plan"]')?.getAttribute("data-state") ===
          "active" &&
        document.activeElement?.getAttribute("data-testid") === "tab-plan",
    );
    check(
      `[${mode}] las áreas se recorren con teclado`,
      (await page.getByTestId("tab-plan").getAttribute("data-state")) === "active" &&
        (await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))) ===
          "tab-plan",
    );
    await page.getByTestId("tab-plan").press("Home");
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="tab-expediente"]')?.getAttribute("data-state") ===
          "active" &&
        document.activeElement?.getAttribute("data-testid") === "tab-expediente",
    );
    check(
      `[${mode}] Home recupera la primera área`,
      (await expedienteTab.getAttribute("data-state")) === "active" &&
        (await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))) ===
          "tab-expediente",
    );
    check(
      `[${mode}] Crafting no forma parte de la descarga inicial`,
      !loadedScripts.some((url) => url.includes("CraftingSection")),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileChrome = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="cabecera-principal"]');
      const nav = document.querySelector(".workspace-nav");
      return {
        headerHeight: header?.getBoundingClientRect().height ?? 999,
        navHeight: nav?.getBoundingClientRect().height ?? 999,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    check(
      `[${mode}] cabecera móvil compacta y sin desplazamiento horizontal`,
      mobileChrome.headerHeight <= 84 &&
        mobileChrome.headerHeight + mobileChrome.navHeight <= 170 &&
        !mobileChrome.overflow,
    );
    const mobileMusicToggle = page.getByTestId("experimental-music-toggle");
    check(
      `[${mode}] Música conserva nombre y acceso propio en la cabecera móvil`,
      (await mobileMusicToggle.isVisible()) &&
        (await mobileMusicToggle.innerText()).includes("Música") &&
        (await mobileMusicToggle.getAttribute("data-state")) === "idle" &&
        (await mobileMusicToggle.evaluate((element) => {
          const header = element.closest('[data-testid="cabecera-principal"]');
          return header instanceof HTMLElement;
        })),
    );
    const mobileWelcome = await page.evaluate(() => {
      const title = document.querySelector("#bienvenida-titulo");
      const primary = document.querySelector('[data-testid="bienvenida-importar"]');
      const lineHeight = title ? Number(getComputedStyle(title).lineHeight.replace("px", "")) : 1;
      return {
        titleLines: title ? Math.round(title.getBoundingClientRect().height / lineHeight) : 99,
        primaryBottom: primary?.getBoundingClientRect().bottom ?? 9999,
        viewportHeight: window.innerHeight,
      };
    });
    check(
      `[${mode}] la primera decisión cabe completa en la portada móvil`,
      mobileWelcome.titleLines <= 4 &&
        mobileWelcome.primaryBottom <= mobileWelcome.viewportHeight,
    );
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const stickyGlobalControls = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="cabecera-principal"]');
      const nav = document.querySelector(".workspace-nav");
      const music = document.querySelector('[data-testid="experimental-music-toggle"]');
      const headerBox = header?.getBoundingClientRect();
      const navBox = nav?.getBoundingClientRect();
      const musicBox = music?.getBoundingClientRect();
      return {
        headerTop: headerBox?.top ?? 999,
        headerBottom: headerBox?.bottom ?? 999,
        navTop: navBox?.top ?? -1,
        musicVisible:
          musicBox !== undefined &&
          musicBox !== null &&
          musicBox.bottom > 0 &&
          musicBox.top < window.innerHeight,
      };
    });
    check(
      `[${mode}] Música sigue visible al desplazarse por cualquier área`,
      stickyGlobalControls.headerTop === 0 &&
        stickyGlobalControls.musicVisible &&
        stickyGlobalControls.navTop >= stickyGlobalControls.headerBottom - 1,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width: 640, height: 800 });
    const intermediateMascot = await page.getByTestId("mentor-mascota").boundingBox();
    const intermediateNavigation = await page
      .locator('.workspace-nav [role="tab"]')
      .evaluateAll((tabs) =>
        tabs.map((tab) => ({
          label: tab.innerText.trim(),
          clipped: tab.scrollWidth > tab.clientWidth + 1,
        })),
      );
    check(
      `[${mode}] Música no desborda la cabecera en ancho intermedio`,
      (await mobileMusicToggle.isVisible()) &&
        (await mobileMusicToggle.innerText()).includes("Música") &&
        (await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        )),
    );
    check(
      `[${mode}] la mascota plegada no tapa una zona grande en ancho intermedio`,
      intermediateMascot !== null &&
        intermediateMascot.width <= 80 &&
        intermediateMascot.height <= 90,
    );
    check(
      `[${mode}] las tres áreas conservan nombres completos en ancho intermedio`,
      intermediateNavigation.map((tab) => tab.label.toLocaleLowerCase("es")).join("|") ===
        "expediente|plan|crafting" &&
        intermediateNavigation.every((tab) => !tab.clipped),
    );
    await page.setViewportSize({ width: 1280, height: 800 });
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
    // Los detalles técnicos ya no compiten con la acción principal: se
    // verifican dentro del resumen desplegable de estado.
    await page.getByTestId("cabecera-estado").locator(":scope > summary").click();
    check(
      `[${mode}] la cabecera distingue parche de cobertura verificada`,
      (await page.getByTestId("patch-compatibility-badge").getAttribute("data-status")) ===
        "limited" &&
        (await page.getByTestId("patch-compatibility-badge").innerText()).includes("parcial"),
    );
    const runtimeBadge = page.getByTestId("mentor-runtime-badge");
    const expectedMentorMode = publicHealth.services?.mentor?.mode;
    const expectedMentorLabel =
      expectedMentorMode === "ai-assisted" ? "IA con respaldo verificable" : "Motor verificable";
    check(
      `[${mode}] la cabecera refleja el modo real del Mentor (${expectedMentorMode})`,
      (expectedMentorMode === "rules-only" || expectedMentorMode === "ai-assisted") &&
        (await runtimeBadge.getAttribute("data-mode")) === expectedMentorMode &&
        (await runtimeBadge.innerText()).includes(expectedMentorLabel),
    );
    await page.getByTestId("cabecera-estado").locator(":scope > summary").click();
    const musicToggle = page.getByTestId("experimental-music-toggle");
    const musicFrame = page.getByTestId("experimental-music-frame");
    check(
      `[${mode}] la música está disponible sin conectar por sí sola`,
      (await musicToggle.count()) === 1 &&
        (await musicToggle.isVisible()) &&
        (await musicToggle.innerText()).includes("Música") &&
        (await musicToggle.innerText()).toLowerCase().includes("prueba") &&
        (await musicToggle.getAttribute("data-state")) === "idle" &&
        (await musicToggle.getAttribute("aria-expanded")) === "false" &&
        (await musicFrame.count()) === 0,
    );
    await musicToggle.click();
    check(
      `[${mode}] Música informa del proveedor antes de conectar`,
      (await page.getByTestId("experimental-music-consent").isVisible()) &&
        (await musicFrame.count()) === 0 &&
        youtubeRequests.length === 0,
    );
    await page.getByTestId("experimental-music-play").click();
    await musicFrame.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] YouTube solo se carga tras consentimiento explícito`,
      youtubeRequests.length >= 1 &&
        (await musicToggle.getAttribute("data-state")) === "playing" &&
        (await musicToggle.innerText()).toLowerCase().includes("sonando"),
    );
    await page.getByRole("button", { name: "Detener música" }).click();
    await page.getByTestId("privacidad-abrir").click();
    const privacyDialog = page.getByTestId("privacidad-dialogo");
    await privacyDialog.waitFor({ timeout: 10000 });
    const mentorPrivacyText = await page.getByTestId("privacidad-mentor").innerText();
    const expectedMentorProvider =
      publicHealth.services.mentor.provider === "groq" ? "Groq" : "OpenAI";
    check(
      `[${mode}] privacidad explica sesión, almacenamiento, recuperación y proveedores externos`,
      (await privacyDialog.getByRole("heading", { name: "Sesión anónima", exact: true }).isVisible()) &&
        (await privacyDialog.getByText("Qué se guarda").isVisible()) &&
        (await privacyDialog.getByText("Recuperación actual").isVisible()) &&
        (await page.getByTestId("privacidad-musica").innerText()).includes("YouTube") &&
        (expectedMentorMode === "ai-assisted"
          ? mentorPrivacyText.includes(`se envían a ${expectedMentorProvider}`) &&
            mentorPrivacyText.includes("hasta ocho turnos") &&
            mentorPrivacyText.includes("No se envían tu nombre de personaje, cookie") &&
            mentorPrivacyText.includes("resultados libres del diario")
          : mentorPrivacyText.includes("no se envían a un proveedor de IA externo")),
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
    check(
      `[${mode}] la portada no repite el proceso antes de la decisión principal`,
      (await page.locator('[aria-label="Qué ocurrirá después"]').count()) === 0 &&
        (await page
          .getByTestId("bienvenida-ayuda-secundaria")
          .getByTestId("bienvenida-ejemplo")
          .count()) === 1,
    );

    // Crear personaje ya no es una promesa vacía: crea un perfil manual y
    // lleva directamente al primer campo que el jugador puede completar.
    await page.getByTestId("bienvenida-nuevo").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    const closeControls = page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true });
    check(
      `[${mode}] «Empezar desde cero» crea un perfil editable`,
      (await page.locator("#char-name").inputValue()) === "Nuevo personaje" &&
        (await page.evaluate(() => document.activeElement?.id)) === "char-name" &&
        (await page.getByText("Creado aquí").isVisible()),
    );
    check(
      `[${mode}] el panel de alta anuncia su cierre en español`,
      (await closeControls.count()) === 1 &&
        (await closeControls.isVisible()) &&
        (await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).count()) === 0,
    );
    await auditAccessibleSurface(
      page,
      `[${mode}] alta de personaje conserva nombres y diálogo accesible`,
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
    await page.locator("#item-text").fill("esto no es un objeto copiado desde PoE2");
    expectedItemImportFailure = true;
    await page.getByRole("button", { name: "Analizar objeto" }).click();
    const invalidItemToast = page.getByText("No se pudo analizar el objeto", {
      exact: true,
    });
    await invalidItemToast.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] un texto ajeno a PoE2 no crea un objeto fantasma ni borra lo pegado`,
      (await page.locator("#item-text").inputValue()) ===
        "esto no es un objeto copiado desde PoE2" &&
        (await page.getByTestId("crafting-coach").count()) === 0 &&
        (await page.getByText(/pulsa Ctrl\+Alt\+C/i).isVisible()),
    );
    expectedItemImportFailure = false;
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
    check(
      `[${mode}] el Mentor acompaña el objeto suelto sin exigir clase ni nivel`,
      (await page.getByTestId("mentor-contextual-titulo").innerText()).includes(
        "Estás en Crafting",
      ) &&
        !(await page.getByTestId("mentor-contextual-mensaje").innerText()).includes(
          "Faltan clase",
        ),
    );
    const standaloneCharacterId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    await page.reload({ waitUntil: "networkidle" });
    const restoredStandaloneCoach = page.getByTestId("crafting-coach");
    await restoredStandaloneCoach.waitFor({ timeout: 15000 });
    await restoredStandaloneCoach
      .getByTestId("coach-objeto")
      .getByText("Núcleo de prueba", { exact: true })
      .waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] el objeto suelto sobrevive al refresco y conserva su expediente`,
      standaloneCharacterId !== null &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) ===
          standaloneCharacterId &&
        (await page.getByTestId("bienvenida").count()) === 0 &&
        (await page.getByTestId("tab-crafting").getAttribute("data-state")) === "active",
    );
    await volverASelectorDePersonajes(page);

    // Regresión del caso real del jugador: las dos pasivas asignadas son
    // propiedades fijas, no afijos. Una copia completa debe llegar a una
    // Transmutación legal y nunca volver a pedir Ctrl+Alt+C.
    await page.getByTestId("bienvenida-objeto").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    await page.locator("#item-text").fill(DISTORTED_AMULET);
    await page.getByRole("button", { name: "Analizar objeto" }).click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 20000 });
    await page
      .getByRole("heading", { name: "Amuleto distorsionado", exact: true })
      .waitFor({ state: "visible", timeout: 20000 });
    await auditAccessibleSurface(
      page,
      `[${mode}] guía del Amuleto distorsionado conserva controles accesibles`,
    );
    check(
      `[${mode}] el Amuleto distorsionado completo no se presenta como lectura rota`,
      (await page.getByRole("heading", { name: "Amuleto distorsionado", exact: true }).isVisible()) &&
        (await page.getByTestId("crafting-repair-banner").count()) === 0,
    );
    await page.getByRole("button", { name: /Más daño/ }).click();
    await page.getByRole("button", { name: "daño físico", exact: true }).click();
    check(
      `[${mode}] el Amuleto distorsionado enseña Transmutación sin pedir otra copia`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) ===
        "use-currency" &&
        (await page.getByTestId("coach-recomendacion").getAttribute("data-action")) ===
          "transmutation" &&
        (await page.getByTestId("crafting-repair-banner").count()) === 0 &&
        (await page.getByTestId("coach-probar-practica").count()) === 0,
    );
    await volverASelectorDePersonajes(page);

    // El formato avanzado inglés actual se reconoce, pero sus mecánicas
    // especiales continúan cerradas hasta disponer de evidencia de parche.
    await page.getByTestId("bienvenida-objeto").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    await page.locator("#item-text").fill(ENGLISH_FRACTURED_AMULET);
    await page.getByRole("button", { name: "Analizar objeto" }).click();
    await page.getByTestId("crafting-coach").waitFor({ timeout: 20000 });
    await page
      .getByRole("heading", { name: "Observed Pendant", exact: true })
      .waitFor({ state: "visible", timeout: 20000 });
    const englishCoach = page.getByTestId("crafting-coach");
    const englishSpecialBanner = englishCoach.getByTestId("crafting-repair-banner");
    check(
      `[${mode}] el tooltip avanzado inglés conserva identidad y ranura de amuleto`,
      (await page.getByRole("heading", { name: "Observed Pendant", exact: true }).isVisible()) &&
        (await englishCoach.getByTestId("coach-objeto").getAttribute("data-slot")) === "amulet",
    );
    check(
      `[${mode}] un objeto fracturado leído no se confunde con una copia incompleta`,
      (await englishSpecialBanner.isVisible()) &&
        (await englishSpecialBanner
          .getByTestId("crafting-repair-category")
          .getAttribute("data-kind")) === "mechanic-unverified" &&
        (await englishSpecialBanner.getByTestId("crafting-repair-repaste").count()) === 0 &&
        !(await englishSpecialBanner.innerText()).includes("Ctrl+Alt+C"),
    );
    await volverASelectorDePersonajes(page);

    // «Añadir personaje» decide el destino. Un `.build` subido aquí se usa
    // como borrador parcial del personaje; en Plan se conserva como objetivo.
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
      `[${mode}] «Añadir personaje» abre el alta con el foco en el importador (${focoImportador})`,
      (await page.locator("#panel-importacion").locator("visible=true").count()) === 1 &&
        focoImportador === "panel-importacion" &&
        (await page.getByTestId("importador-personaje").innerText()).includes("Path of Building 2") &&
        (await page.getByTestId("importador-personaje").innerText()).includes("archivo .build de PoE2 solo crea un borrador parcial") &&
        !(await page.getByTestId("importador-personaje").innerText()).includes("Archivo .build oficial"),
    );
    const pob2Help = page.getByTestId("ayuda-codigo-pob2");
    check(
      `[${mode}] la ayuda para obtener el código PoB2 existe sin cargar la pantalla inicial`,
      (await pob2Help.isVisible()) &&
        !(await pob2Help.evaluate((details) => details.open)) &&
        (await pob2Help.locator("summary").innerText()).includes("Dónde consigo"),
    );
    await pob2Help.locator("summary").click();
    const officialPob2Link = pob2Help.getByRole("link", {
      name: /Descargar instalador para Windows/,
    });
    const otherPob2Downloads = pob2Help.getByRole("link", {
      name: /Ver versión portátil y otras descargas en GitHub/,
    });
    check(
      `[${mode}] la ayuda explica el recorrido y enlaza el proyecto oficial`,
      (await pob2Help.innerText()).includes("Import/Export Build") &&
        (await pob2Help.innerText()).includes("Authorize with Path of Exile") &&
        (await pob2Help.innerText()).includes("Passive Tree and Jewels") &&
        (await pob2Help.innerText()).includes("Items and Skills") &&
        (await pob2Help.innerText()).includes("Exile Copilot solo recibe el código") &&
        (await pob2Help.innerText()).includes("Generate") &&
        (await officialPob2Link.getAttribute("href")) ===
          "https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/releases/latest/download/PathOfBuildingCommunity-PoE2-Setup.exe" &&
        (await otherPob2Downloads.getAttribute("href")) ===
          "https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/releases" &&
        (await pob2Help.innerText()).includes("No necesitas buscarlo dentro de GitHub") &&
        (await officialPob2Link.getAttribute("target")) === "_blank",
    );
    check(
      `[${mode}] el alta ofrece llevar los planes .build a su área correcta`,
      (await page.getByTestId("ir-importar-objetivo").isVisible()) === true,
    );
    await page.locator("#character-build-paste").fill(CHARACTER_BUILD);
    await page.getByTestId("importar-personaje").click();
    const importDialog = page.getByRole("dialog");
    await importDialog.locator("#char-class").waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] un .build parcial no expulsa al jugador a un expediente vacío`,
      (await importDialog.isVisible()) &&
        (await importDialog.getByTestId("import-warnings").innerText()).includes("no es una captura completa") &&
        (await importDialog.locator("#char-class").isVisible()) &&
        (await importDialog.locator("#char-level").isVisible()) &&
        (await page.getByText("Plan .build oficial importado").count()) === 0,
    );
    await importDialog.getByRole("button", { name: "Cerrar" }).click();
    await page.getByText("Titan Warrior").first().waitFor({ timeout: 15000 });
    const partialReadiness = page.getByTestId("recommendations-readiness");
    await partialReadiness.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] el borrador parcial no se presenta como listo ni permite recomendaciones inseguras`,
      (await page.getByTestId("caso-abierto").innerText()).includes("Completa tu personaje") &&
        (await partialReadiness.innerText()).includes("Clase:") &&
        (await partialReadiness.innerText()).includes("Nivel:") &&
        (await partialReadiness.innerText()).includes("Equipo:") &&
        !(await page.getByRole("button", { name: "Generar recomendaciones" }).isEnabled()) &&
        (await partialReadiness
          .getByRole("button", { name: "Completar expediente" })
          .isVisible()),
    );
    await page.getByTestId("mentor-briefing-toggle").click();
    check(
      `[${mode}] el Mentor de personaje aplica el mismo bloqueo del expediente`,
      (await page.getByTestId("mentor-profile-readiness-gate").isVisible()) &&
        (await page.getByTestId("mentor-profile-readiness-gate").innerText()).includes(
          "clase, nivel, equipo",
        ),
    );
    const partialCharacterId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    // El alta persiste también un borrador parcial: no está listo para consejo,
    // pero el jugador puede completarlo después de recargar.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Titan Warrior").first().waitFor({ timeout: 15000 });
    await page.getByTestId("recommendations-readiness").waitFor({ timeout: 15000 });
    check(
      `[${mode}] el borrador importado sobrevive al refresco sin fingir que está completo`,
      partialCharacterId !== null &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === partialCharacterId &&
        (await page.getByTestId("recommendations-readiness").isVisible()),
    );
    await abrirEditor(page);
    await page.locator("#item-text").fill(STANDALONE_ITEM);
    await page.getByRole("dialog").getByRole("button", { name: "Analizar objeto" }).click();
    await page
      .getByRole("dialog")
      .locator('input[value="Núcleo de prueba"]')
      .waitFor({
      state: "visible",
      timeout: 15000,
    });
    check(
      `[${mode}] completar el equipo no expulsa al jugador del editor`,
      (await page.getByRole("dialog").isVisible()) &&
        (await page.getByTestId("tab-expediente").getAttribute("data-state")) === "active" &&
        (await page.getByTestId("guardar-correcciones").isEnabled()),
    );
    await page.getByRole("button", { name: "Cambiar o empezar de nuevo" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
    check(
      `[${mode}] empezar de nuevo cierra el editor en vez de dejar un panel vacío`,
      (await page.getByRole("dialog").count()) === 0,
    );
    await page.getByTestId("bienvenida").waitFor({ timeout: 15000 });

    // Un código PoB2 que sí contiene una instantánea debe reconstruirla. Esta
    // es la regresión del caso real que antes acababa siempre con 0 objetos.
    await page.getByTestId("bienvenida-importar").click();
    await page.locator("#panel-importacion").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#character-build-paste").fill(RICH_POB_CODE);

    let failImportedCharacterSave = true;
    const interruptImportedCharacterSave = async (route) => {
      if (failImportedCharacterSave && route.request().method() === "POST") {
        failImportedCharacterSave = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo-controlado-al-guardar-importacion" }),
        });
        return;
      }
      await route.continue();
    };
    await page.route("**/api/character", interruptImportedCharacterSave);
    expectedCharacterSaveFailure = true;
    await page.getByTestId("importar-personaje").click();
    await page.getByText("Se leyó el personaje, pero no se pudo guardar").waitFor({
      timeout: 15000,
    });
    await page.waitForTimeout(100);
    expectedCharacterSaveFailure = false;
    check(
      `[${mode}] un fallo al guardar no cierra el alta ni pierde el código importado`,
      !failImportedCharacterSave &&
        (await page.getByRole("dialog").isVisible()) &&
        (await page.locator("#character-build-paste").inputValue()) === RICH_POB_CODE &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === null,
    );
    await page.getByTestId("importar-personaje").click();
    await page.unroute("**/api/character", interruptImportedCharacterSave);
    const equipmentGrid = page.getByTestId("equipment-grid");
    await equipmentGrid.waitFor({ state: "visible", timeout: 15000 });
    const equippedFromPob = await equipmentGrid.locator('[data-slot-state="filled"]').count();
    check(
      `[${mode}] PoB2 reconstruye el set activo sin fingir que está completo (${equippedFromPob} objetos)`,
      equippedFromPob === 2 &&
        (await equipmentGrid.locator('[data-slot="gloves"][data-slot-state="filled"]').count()) === 1 &&
        (await equipmentGrid.locator('[data-slot="boots"][data-slot-state="filled"]').count()) === 1 &&
        (await page.getByTestId("recommendations-readiness").count()) === 0 &&
        (await page.getByRole("button", { name: "Generar recomendaciones" }).isEnabled()),
    );
    const partialAnalysis = page.getByTestId("profile-partial-analysis");
    await partialAnalysis.waitFor({ state: "visible", timeout: 15000 });
    const openCaseText = await page.getByTestId("caso-abierto").innerText();
    const partialAnalysisText = await partialAnalysis.innerText();
    const normalizedOpenCaseText = openCaseText.toLocaleLowerCase("es");
    check(
      `[${mode}] dos piezas habilitan orientación parcial, no un falso análisis amplio`,
      normalizedOpenCaseText.includes("análisis parcial disponible") &&
        !normalizedOpenCaseText.includes("listo para analizar") &&
        partialAnalysisText.includes("Añade más piezas"),
    );
    check(
      `[${mode}] los objetos importados conservan su identidad visible`,
      (await page.getByRole("button", { name: /Guantes: Oblivion Paw/ }).count()) === 1 &&
        (await page.getByRole("button", { name: /Botas: Golem Tread/ }).count()) === 1,
    );
    const richCharacterId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    // La instantánea completa también forma parte del alta atómica: debe
    // restaurar exactamente el mismo expediente tras refrescar.
    await page.reload({ waitUntil: "networkidle" });
    await equipmentGrid.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] la instantánea PoB2 importada queda guardada y se restaura`,
      richCharacterId !== null &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === richCharacterId &&
        (await equipmentGrid.locator('[data-slot-state="filled"]').count()) === 2,
    );
    // El perfil no puede quedar huérfano si se borra únicamente su referencia
    // local: la cookie privada todavía permite redescubrir el último expediente.
    await page.evaluate(() => {
      localStorage.removeItem("exile-copilot:characterId");
      localStorage.removeItem("exile-copilot:previousCharacter");
    });
    await page.reload({ waitUntil: "networkidle" });
    await equipmentGrid.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] una referencia local perdida redescubre el expediente privado del servidor`,
      richCharacterId !== null &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === richCharacterId &&
        (await equipmentGrid.locator('[data-slot-state="filled"]').count()) === 2,
    );
    let blockCharacterRestore = true;
    let interruptedCharacterRestores = 0;
    const interruptCharacterRestore = async (route) => {
      if (blockCharacterRestore && route.request().method() === "GET") {
        interruptedCharacterRestores += 1;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "fallo-controlado-al-restaurar" }),
        });
        return;
      }
      await route.continue();
    };
    await page.route(
      `**/api/character/${encodeURIComponent(richCharacterId)}`,
      interruptCharacterRestore,
    );
    expectedCharacterRestoreFailure = true;
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("character-restore-error").waitFor({ timeout: 15000 });
    await page.waitForTimeout(100);
    expectedCharacterRestoreFailure = false;
    check(
      `[${mode}] una caída temporal no borra el expediente ni muestra un alta falsa`,
      interruptedCharacterRestores >= 1 &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === richCharacterId &&
        (await page.getByTestId("bienvenida").count()) === 0 &&
        (await page.getByTestId("character-restore-retry").isVisible()),
    );
    blockCharacterRestore = false;
    await page.getByTestId("character-restore-retry").click();
    await equipmentGrid.waitFor({ state: "visible", timeout: 15000 });
    await page.unroute(
      `**/api/character/${encodeURIComponent(richCharacterId)}`,
      interruptCharacterRestore,
    );
    check(
      `[${mode}] reintentar recupera el expediente sin crear otro personaje`,
      (await equipmentGrid.locator('[data-slot-state="filled"]').count()) === 2 &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === richCharacterId,
    );
    await abrirEditor(page);
    await page.locator("#item-text").fill(REPLACEMENT_GLOVES);
    await page.getByRole("dialog").getByRole("button", { name: "Analizar objeto" }).click();
    const collisionDialog = page.getByTestId("item-slot-collision-dialog");
    await collisionDialog.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] pegar una segunda pieza en un hueco ocupado no la oculta ni sustituye en silencio`,
      (await collisionDialog.getByText("Ese hueco ya está ocupado").isVisible()) &&
        (await collisionDialog.getByRole("button", { name: "Sustituir Oblivion Paw" }).isVisible()) &&
        (await collisionDialog
          .getByRole("button", { name: "Conservar ambos · guardar como extra" })
          .isVisible()) &&
        (await page.locator("#item-text").inputValue()) === REPLACEMENT_GLOVES,
    );
    await collisionDialog.getByRole("button", { name: "Sustituir Oblivion Paw" }).click();
    await collisionDialog.waitFor({ state: "hidden", timeout: 15000 });
    await page.locator('input[value="Replacement Grip"]').waitFor({
      state: "visible",
      timeout: 15000,
    });
    check(
      `[${mode}] la sustitución elegida actualiza la pieza y conserva el flujo de edición`,
      !(await collisionDialog.isVisible()) &&
        (await page.getByRole("dialog").isVisible()) &&
        (await page.getByTestId("guardar-correcciones").isEnabled()),
    );
    await page.getByRole("button", { name: "Cambiar o empezar de nuevo" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
    await page.getByTestId("bienvenida").waitFor({ timeout: 15000 });

    await irA(page, "plan");
    const initialTargetDetails = page.getByTestId("target-context-details");
    if (!(await initialTargetDetails.evaluate((details) => details.open))) {
      await initialTargetDetails.locator("summary").first().click();
    }
    await page.getByTestId("importador-build-objetivo").waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] Plan y mercado mantiene separado el importador de .build objetivo`,
      (await page.getByTestId("importador-build-objetivo").innerText()).includes("Archivo .build para usar como objetivo") &&
        (await page.getByTestId("importador-personaje").count()) === 0,
    );
    await initialTargetDetails.locator("summary").first().click();
    await irA(page, "expediente");
    await page.getByRole("button", { name: "Cargar ejemplo" }).locator("visible=true").click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 10000 });
    check(`[${mode}] ejemplo precargado visible`, true);

    // En móvil la cabecera ya ofrece «Mentor». La conversación completa debe
    // esperar a que el jugador vea su equipo, no repetir la misma entrada justo
    // después de «Generar recomendaciones» y empujar el expediente hacia abajo.
    await page.setViewportSize({ width: 390, height: 844 });
    const mentorFirstScreen = await page.evaluate(() => {
      const equipment = document.querySelector("#equipo-titulo")?.closest("section");
      const briefing = document.querySelector('[data-testid="mentor-briefing"]');
      const mainAction = document.querySelector('[data-testid="cabecera-accion-principal"]');
      return {
        equipmentTop: equipment?.getBoundingClientRect().top ?? 9999,
        briefingTop: briefing?.getBoundingClientRect().top ?? -1,
        actionLabel: mainAction?.getAttribute("aria-label") ?? "",
        viewportHeight: window.innerHeight,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    check(
      `[${mode}] móvil muestra el equipo antes de repetir la conversación del Mentor`,
      mentorFirstScreen.actionLabel === "Abrir Mentor" &&
        mentorFirstScreen.equipmentTop < mentorFirstScreen.briefingTop &&
        mentorFirstScreen.equipmentTop < mentorFirstScreen.viewportHeight &&
        !mentorFirstScreen.overflow,
    );
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByTestId("cabecera-accion-principal").click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="mentor-briefing"]')?.open === true,
      null,
      { timeout: 10000 },
    );
    check(
      `[${mode}] «Abrir Mentor» abre y enfoca la conversación real`,
      (await page.getByTestId("mentor-briefing").evaluate((details) => details.open)) &&
        (await page.locator("#mentor-pregunta").evaluate((input) => document.activeElement === input)),
    );
    await page.getByTestId("mentor-briefing-toggle").click();

    // El mentor empieza reducido a su mascota. Pulsarla abre SU panel flotante
    // (no otro acordeón de la página) y una segunda pulsación vuelve a cerrarlo.
    const contextualMentor = page.getByTestId("mentor-contextual");
    const mentorMascot = page.getByTestId("mentor-mascota");
    check(
      `[${mode}] Mentor v4 empieza como Mascota v3 sin panel`,
      (await contextualMentor.getAttribute("data-version")) === "4" &&
        (await contextualMentor.getAttribute("data-mascot-version")) === "3" &&
        (await mentorMascot.getAttribute("data-version")) === "3" &&
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

    // El personaje cargado con «Cargar ejemplo» no existe en la cuenta. Puede
    // enseñar por qué elegir un objetivo, pero nunca debe convertirse en una
    // autorización para gastar ni pedir un resultado real imposible de pegar.
    await page.getByRole("button", { name: /No lo sé/ }).click();
    await page.getByTestId("coach-context-focus-resistances").click();
    check(
      `[${mode}] una carencia contextual sobre la demo sigue siendo didáctica`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) === "example" &&
        (await page.getByTestId("coach-example-summary").innerText()).includes(
          "no existe en tu cuenta",
        ) &&
        (await page.getByTestId("coach-lo-hare").count()) === 0 &&
        (await page.getByTestId("coach-registro").count()) === 0,
    );
    await page.getByTestId("coach-otro-camino").click();

    // Cambiar a un objetivo elegido por el jugador tampoco borra la procedencia
    // de Doom Song. La seguridad depende del objeto, no de la pregunta usada.
    await page.getByRole("button", { name: /Más daño/ }).click();
    await page.getByRole("button", { name: "daño físico", exact: true }).click();
    check(
      `[${mode}] Doom Song conserva su frontera de demostración al cambiar de objetivo`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) === "example" &&
        (await page.getByTestId("coach-probar-practica").isVisible()) &&
        (await page.getByTestId("coach-lo-hare").count()) === 0 &&
        (await page.getByTestId("coach-revisar-expediente").count()) === 0,
    );

    await page.getByTestId("coach-probar-practica").click();
    await page.getByTestId("coach-practice-summary").waitFor({ timeout: 15000 });
    check(
      `[${mode}] la práctica enseña sin registrar ni pedir un craft real`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) === "practice" &&
        (await page.getByTestId("coach-practice-summary").innerText()).includes(
          "No gastes moneda",
        ) &&
        (await page.getByTestId("coach-lo-hare").count()) === 0 &&
        (await page.getByTestId("coach-registro").count()) === 0,
    );
    await page.getByTestId("coach-practice-return").click();
    await page.getByTestId("coach-eleccion").waitFor({ timeout: 10000 });

    // La protección pertenece al perfil de demostración completo, no solo a la
    // primera pieza seleccionada. Cambiar a Gale Crown conserva el mismo límite.
    await page.getByText("Trabajar con otra pieza", { exact: true }).click();
    await page.getByRole("button", { name: /Gale Crown/ }).click();
    await page.getByRole("button", { name: /Más defensa/ }).click();
    await page.getByRole("button", { name: "vida máxima", exact: true }).click();
    check(
      `[${mode}] cambiar de pieza no convierte la demo en equipo real`,
      (await page.getByTestId("coach-recomendacion").getAttribute("data-kind")) === "example" &&
        (await page.getByTestId("coach-example-summary").isVisible()) &&
        (await page.getByTestId("coach-lo-hare").count()) === 0 &&
        (await page.getByTestId("coach-registro").count()) === 0,
    );
    await irA(page, "expediente");

    await irA(page, "plan");
    const featuredBuilds = page.getByTestId("featured-builds-section");
    await featuredBuilds.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] la selección de temporada no inventa un top 10 sin builds verificadas`,
      (await page.getByTestId("featured-builds-count").innerText()).includes("0 / 10") &&
        !(await featuredBuilds.evaluate((details) => details.open)),
    );
    const targetContextDetails = page.getByTestId("target-context-details");
    await targetContextDetails.waitFor({ state: "visible", timeout: 10000 });
    check(
      `[${mode}] el destino opcional no compite con el mercado`,
      !(await targetContextDetails.evaluate((details) => details.open)),
    );
    await targetContextDetails.locator("summary").first().click();
    await page.getByTestId("importador-build-objetivo").waitFor({ state: "visible" });
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
      `[${mode}] una sesión sin personaje guardado pide una confirmación breve`,
      (await page.getByText(/No tienes que volver a rellenar el personaje/i).count()) === 1 &&
        (await page.getByRole("button", { name: /Guardar y continuar/i }).isEnabled()),
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
    const desktopCaseSpacing = await page.evaluate(() => {
      const openCase = document.querySelector('[data-testid="caso-abierto"]');
      const mentor = document.querySelector('[data-testid="mentor-briefing"]');
      if (!(openCase instanceof HTMLElement) || !(mentor instanceof HTMLElement)) {
        return null;
      }
      const openCaseGroup = openCase.parentElement;
      if (!(openCaseGroup instanceof HTMLElement)) return null;
      return mentor.getBoundingClientRect().top - openCaseGroup.getBoundingClientRect().bottom;
    });
    check(
      `[${mode}] Mentor continúa debajo del caso sin un vacío provocado por el equipo (separación ${desktopCaseSpacing ?? "desconocida"}px)`,
      desktopCaseSpacing !== null && desktopCaseSpacing >= 0 && desktopCaseSpacing <= 64,
    );
    // La principal domina el Caso Abierto; las demás viven en «Otras
    // posibilidades», que hay que desplegar para verlas.
    await page.getByTestId("acordeon-otras").click();
    const cards = await page.locator("text=/Confianza|confianza/").count();
    check(`[${mode}] se generan ${cards} tarjetas de recomendación`, cards >= 3);
    const alternatives = page.locator('[data-testid^="alternativa-"]');
    const alternativeCount = await alternatives.count();
    check(
      `[${mode}] las ${alternativeCount} alternativas empiezan resumidas`,
      alternativeCount >= 2 &&
        (await alternatives.getByRole("button", { name: "Ver detalles" }).count()) ===
          alternativeCount &&
        (await alternatives
          .getByRole("button", { name: "Guardar como próximo paso" })
          .count()) === 0,
    );
    const firstAlternative = alternatives.nth(0);
    const secondAlternative = alternatives.nth(1);
    await firstAlternative.getByRole("button", { name: "Ver detalles" }).click();
    check(
      `[${mode}] una alternativa revela seguridad y acciones solo al pedir detalles`,
      (await firstAlternative.getByText("Motivo", { exact: true }).isVisible()) &&
        (await firstAlternative
          .getByRole("button", { name: "Guardar como próximo paso" })
          .isVisible()),
    );
    await secondAlternative.getByRole("button", { name: "Ver detalles" }).click();
    check(
      `[${mode}] abrir otra alternativa cierra la anterior`,
      (await firstAlternative.getByRole("button", { name: "Ver detalles" }).isVisible()) &&
        (await firstAlternative
          .getByRole("button", { name: "Guardar como próximo paso" })
          .count()) === 0 &&
        (await secondAlternative
          .getByRole("button", { name: "Ocultar detalles" })
          .isVisible()),
    );
    await secondAlternative.getByRole("button", { name: "Ocultar detalles" }).click();
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

    // Guardar una recomendación debe convertirla en el siguiente paso visible
    // también desde Plan. Antes quedaba enterrada únicamente en Expediente,
    // aunque la navegación prometía que Plan reunía el rumbo del jugador.
    const falseInvalidationBefore =
      (await page.getByText("Tus datos cambiaron", { exact: true }).count()) +
      (await page
        .getByText("Los datos han cambiado — vuelve a generar las recomendaciones", {
          exact: true,
        })
        .count());
    await page
      .getByTestId("caso-abierto")
      .getByRole("button", { name: "Guardar como próximo paso" })
      .click();
    const currentAction = page.getByTestId("accion-actual");
    await currentAction.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(100);
    const falseInvalidationAfter =
      (await page.getByText("Tus datos cambiaron", { exact: true }).count()) +
      (await page
        .getByText("Los datos han cambiado — vuelve a generar las recomendaciones", {
          exact: true,
        })
        .count());
    check(
      `[${mode}] guardar el consejo no finge que cambiaron personaje, objetivo o presupuesto`,
      falseInvalidationAfter <= falseInvalidationBefore,
    );
    const savedActionTitle = await currentAction.locator("h2").innerText();
    await irA(page, "plan");
    const planNextAction = page.getByTestId("plan-siguiente-paso");
    await planNextAction.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] Plan muestra el siguiente paso que el jugador acaba de guardar`,
      (await planNextAction.innerText()).includes(savedActionTitle) &&
        (await planNextAction.getByRole("button", { name: "Abrir seguimiento" }).isVisible()),
    );

    // 7. Persistencia: recargar y comprobar tanto el siguiente paso como
    // EXACTAMENTE vida=2150.
    await page.reload({ waitUntil: "networkidle" });
    await irA(page, "plan");
    await planNextAction.waitFor({ state: "visible", timeout: 15000 });
    check(
      `[${mode}] el siguiente paso continúa visible en Plan tras recargar`,
      (await planNextAction.innerText()).includes(savedActionTitle),
    );
    // Los campos del personaje viven en el panel «Editar expediente».
    await irA(page, "expediente");
    await abrirEditor(page);
    await page.locator("#def-life").waitFor({ timeout: 10000 });
    const restoredLife = await page.locator("#def-life").inputValue();
    check(
      `[${mode}] vida restaurada tras recargar = ${restoredLife} (esperado 2150)`,
      restoredLife === "2150",
    );
    await cerrarEditor(page);

    // Entrar directamente en un expediente dejaba la flecha sin historial y,
    // por tanto, invisible. Tras recargar, la cabecera debe ofrecer una salida
    // explícita hacia la selección sin borrar el expediente guardado.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Volver a personajes" }).click();
    await page.getByTestId("bienvenida-recuperar").waitFor({ timeout: 15000 });
    check(
      `[${mode}] un expediente abierto directamente permite volver a personajes`,
      (await page.getByTestId("bienvenida").isVisible()) &&
        (await page.getByTestId("bienvenida-recuperar").innerText()).includes(
          savedBody.profile.name,
        ),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("bienvenida-recuperar").waitFor({ timeout: 15000 });
    check(
      `[${mode}] empezar de nuevo sigue siendo intencional tras recargar`,
      (await page.getByTestId("bienvenida").isVisible()) &&
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) === null,
    );
    await page.getByTestId("bienvenida-recuperar").click();
    // El nombre ya aparece dentro del propio botón y en notificaciones previas:
    // esperarlo podía resolver antes de que terminara GET /character. La señal
    // autoritativa es que la bienvenida se desmonta al recuperar el perfil.
    await page
      .getByTestId("bienvenida-recuperar")
      .waitFor({ state: "detached", timeout: 15000 });
    const recoveredId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    check(
      `[${mode}] empezar de nuevo permite recuperar el expediente anterior`,
      recoveredId === savedBody.profile.id &&
        (await page.getByTestId("bienvenida-recuperar").count()) === 0,
    );

    // Una sesión real puede contener varios personajes. Todos deben seguir
    // accesibles mediante resúmenes compactos, sin exponer equipo o notas.
    await abrirEditor(page);
    await page.getByRole("button", { name: "Cambiar o empezar de nuevo" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
    const savedCharacters = page.getByTestId("bienvenida-guardados");
    await savedCharacters.waitFor({ timeout: 15000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const savedCharactersMobile = await page.evaluate(() => ({
      overflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      width: document.querySelector('[data-testid="bienvenida-guardados"]')
        ?.getBoundingClientRect().width ?? 0,
    }));
    check(
      `[${mode}] el selector de personajes permanece compacto en móvil`,
      !savedCharactersMobile.overflow &&
        savedCharactersMobile.width > 0 &&
        savedCharactersMobile.width <= 390,
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await savedCharacters.locator("summary").click();
    const savedRows = savedCharacters.locator('[data-testid^="bienvenida-guardado-"]');
    check(
      `[${mode}] la bienvenida ofrece varios expedientes sin recargar la portada`,
      (await savedRows.count()) >= 2 &&
        !(await savedCharacters.innerText()).includes("Oblivion Paw") &&
        !(await savedCharacters.innerText()).includes("Notas"),
    );
    if (partialCharacterId !== null) {
      await page.getByTestId(`bienvenida-guardado-${partialCharacterId}`).click();
      await page.getByTestId("bienvenida").waitFor({
        state: "detached",
        timeout: 15000,
      });
      await page.waitForFunction(
        (expectedId) =>
          localStorage.getItem("exile-copilot:characterId") === expectedId,
        partialCharacterId,
      );
      await page.getByText("Titan Warrior").first().waitFor({ timeout: 15000 });
      check(
        `[${mode}] se puede cambiar a otro personaje guardado de la misma sesión`,
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) ===
          partialCharacterId,
      );
      await irA(page, "plan");
      check(
        `[${mode}] el siguiente paso del expediente principal no se filtra al otro personaje`,
        !(await page.getByTestId("plan-siguiente-paso").isVisible()),
      );
      await irA(page, "expediente");
      await abrirEditor(page);
      await page.getByRole("button", { name: "Cambiar o empezar de nuevo" }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });
      await page.getByTestId("bienvenida-guardados").locator("summary").click();
      await page
        .getByTestId(`bienvenida-guardado-${savedBody.profile.id}`)
        .click();
      await page.getByTestId("bienvenida").waitFor({ state: "detached", timeout: 15000 });
      check(
        `[${mode}] volver al expediente principal conserva su identidad`,
        (await page.evaluate(() => localStorage.getItem("exile-copilot:characterId"))) ===
          savedBody.profile.id,
      );
      await irA(page, "plan");
      const restoredPrimaryAction = page.getByTestId("plan-siguiente-paso");
      await restoredPrimaryAction.waitFor({ state: "visible", timeout: 15000 });
      check(
        `[${mode}] al volver se recupera la memoria propia del expediente principal`,
        (await restoredPrimaryAction.innerText()).includes(savedActionTitle),
      );
      await irA(page, "expediente");
    } else {
      check(`[${mode}] se puede cambiar a otro personaje guardado de la misma sesión`, false);
    }

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
      (await reconnectPage.getByTestId("cabecera-estado").isVisible()) &&
        (await reconnectPage.getByTestId("tab-crafting").getAttribute("data-state")) ===
          "active",
    );
    await reconnectContext.close();

    // 8. Privacidad pública: se ejecuta al final y únicamente contra la base
    // temporal de este smoke. Demuestra confirmación, limpieza local, borrado
    // del servidor y regreso a una sesión vacía sin tocar datos reales.
    await page.evaluate(() => {
      localStorage.setItem("otra-herramienta:preferencia", "conservar");
      sessionStorage.setItem(
        "exile-copilot:mentor-v4:thread",
        JSON.stringify({ version: 4, turns: [] }),
      );
      sessionStorage.setItem("otra-herramienta:sesion", "conservar");
    });
    await page.getByTestId("privacidad-abrir").click();
    await page.getByTestId("privacidad-borrar-abrir").click();
    check(
      `[${mode}] el borrado irreversible exige una segunda confirmación`,
      await page.getByTestId("privacidad-borrar-confirmacion").isVisible(),
    );
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${BASE}/api/visitor/data` &&
        response.request().method() === "DELETE",
      { timeout: 15000 },
    );
    await page.getByTestId("privacidad-borrar-confirmar").click();
    const deleteResponse = await deleteResponsePromise;
    await page.waitForLoadState("domcontentloaded");
    await page.getByText("Descubre qué mejorar primero en tu personaje de PoE2").waitFor({ timeout: 15000 });
    const localPrivacyState = await page.evaluate(() => ({
      exileKeys: Object.keys(localStorage).filter((key) =>
        key.startsWith("exile-copilot:"),
      ),
      otherPreference: localStorage.getItem("otra-herramienta:preferencia"),
      exileSessionKeys: Object.keys(sessionStorage).filter((key) =>
        key.startsWith("exile-copilot:"),
      ),
      otherSession: sessionStorage.getItem("otra-herramienta:sesion"),
    }));
    const deletedCharacter = await context.request.get(
      `${BASE}/api/character/${encodeURIComponent(savedBody.profile.id)}`,
    );
    const privacyDeletionOk =
      deleteResponse.status() === 200 &&
      deletedCharacter.status() === 404 &&
      localPrivacyState.exileKeys.length === 0 &&
      localPrivacyState.exileSessionKeys.length === 0;
    check(
      `[${mode}] borrar elimina servidor y claves locales de Exile Copilot`,
      privacyDeletionOk,
    );
    if (!privacyDeletionOk) {
      console.error(
        `[privacy:${mode}] ${JSON.stringify({
          deleteStatus: deleteResponse.status(),
          deletedCharacterStatus: deletedCharacter.status(),
          exileKeys: localPrivacyState.exileKeys,
          exileSessionKeys: localPrivacyState.exileSessionKeys,
        })}`,
      );
    }
    check(
      `[${mode}] la limpieza no borra datos locales de otra herramienta`,
      localPrivacyState.otherPreference === "conservar" &&
        localPrivacyState.otherSession === "conservar",
    );
    check(
      `[${mode}] tras borrar se vuelve a una sesión sin personaje`,
      await page.getByText("Descubre qué mejorar primero en tu personaje de PoE2").isVisible(),
    );
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
