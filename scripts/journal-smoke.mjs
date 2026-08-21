/**
 * Prueba de navegador de los Hitos 5A/5B — memoria persistente y contexto.
 *
 * Uso:
 *   node scripts/journal-smoke.mjs        → producción (requiere build)
 *   node scripts/journal-smoke.mjs --dev  → desarrollo (React Strict Mode)
 *   node scripts/journal-smoke.mjs --all  → ambos modos
 *
 * Cada modo usa su propio puerto y una base SQLite temporal. No modifica la
 * base del usuario, no escribe capturas en el repo y detiene solo el proceso
 * que esta prueba ha creado.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, stopChild } from "./browserLaunch.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const modes = args.includes("--all")
  ? ["prod", "dev"]
  : args.includes("--dev")
    ? ["dev"]
    : ["prod"];
const tempRoot = mkdtempSync(join(tmpdir(), "exile-copilot-5a-"));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(base) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return true;
    } catch {
      // El proceso todavía está arrancando.
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
  const process = spawn(globalThis.process.execPath, command, {
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
  process.stderr.on("data", () => {});
  return process;
}

function stopServer(process) {
  stopChild(process);
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
  console.log(`\n=== HITOS 5A/5B — ${mode.toUpperCase()} (${base}) ===`);
  const server = startServer(mode, port);
  let browser;
  try {
    check(`[${mode}] servidor disponible`, await waitForServer(base));
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const externalRequests = [];
    const errors = [];
    const recommendationPayloads = [];
    let recommendationConflicts = 0;

    page.on("request", (request) => {
      const url = request.url();
      if (url === `${base}/api/recommendations` && request.method() === "POST") {
        try {
          recommendationPayloads.push(request.postDataJSON());
        } catch {
          errors.push("Payload no JSON en POST /api/recommendations");
        }
      }
      if (!url.startsWith(base) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });
    page.on("console", (message) => {
      const text = `${message.text()} @ ${message.location()?.url ?? "?"}`;
      const expectedConflict =
        text.includes("409 (Conflict)") &&
        text.includes(`${base}/api/recommendations`);
      if (
        message.type() === "error" &&
        !text.includes(`${base}/favicon.ico`) &&
        !expectedConflict
      ) {
        errors.push(text);
      }
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("response", (response) => {
      if (
        response.status() === 409 &&
        response.url() === `${base}/api/recommendations`
      ) {
        recommendationConflicts += 1;
        return;
      }
      if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
        errors.push(`HTTP ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(base, { waitUntil: "networkidle" });
    check(`[${mode}] mentor visible`, await page.getByText("Mentor del personaje").isVisible());
    check(
      `[${mode}] vacío honesto antes de importar`,
      await page.getByText("El mentor necesita conocer a tu personaje").isVisible(),
    );

    await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });
    const emptyJournal = page.getByText("No hay un siguiente paso activo");
    await emptyJournal.waitFor({ timeout: 20_000 });
    check(
      `[${mode}] memoria vacía tras cargar personaje`,
      await emptyJournal.isVisible(),
    );

    // «Cargar ejemplo» es deliberadamente efímero. Persistimos el mismo
    // snapshot por las rutas públicas y verificamos la restauración real que
    // tendrá un personaje guardado por el usuario.
    const persistedCharacterId = await persistDemo(base);
    await page.evaluate(
      (id) => localStorage.setItem("exile-copilot:characterId", id),
      persistedCharacterId,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20_000 });

    await page.locator("#market-budget").fill("5");
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    const trackButtons = page.getByRole("button", { name: "Guardar como próximo paso" });
    await trackButtons.first().waitFor({ timeout: 25_000 });
    check(`[${mode}] cada recomendación puede seguirse`, (await trackButtons.count()) === 3);

    // Otra pestaña crea una acción mientras esta UI conserva recomendaciones
    // antiguas. El 409 debe retirar esas tarjetas ANTES de esperar el GET de
    // recarga, para que no puedan guardarse ni exportarse durante la ventana.
    const concurrentResponse = await fetch(
      `${base}/api/journal/${persistedCharacterId}/entries`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "note",
          title: "Cambio concurrente",
          summary: "Creado por la prueba desde una segunda pestaña.",
          nextAction: "Revisar la memoria antes de decidir.",
          relatedItemIds: [],
          sources: [],
          context: {
            characterLevel: null,
            league: null,
            patch: null,
            budget: null,
            goal: null,
          },
          recommendationSnapshot: null,
          makePrimary: true,
        }),
      },
    );
    if (!concurrentResponse.ok) {
      throw new Error(`no se pudo crear la entrada concurrente: HTTP ${concurrentResponse.status}`);
    }
    const concurrentEntry = (await concurrentResponse.json()).entry;

    let releaseJournalReload = () => {};
    const journalReloadHold = new Promise((resolve) => {
      releaseJournalReload = resolve;
    });
    let signalJournalReload = () => {};
    const journalReloadStarted = new Promise((resolve) => {
      signalJournalReload = resolve;
    });
    await page.route(
      `${base}/api/journal/${persistedCharacterId}`,
      async (route) => {
        signalJournalReload();
        await journalReloadHold;
        await route.continue();
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    await journalReloadStarted;
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button")).some((button) =>
          button.textContent?.includes("Guardar como próximo paso"),
        ),
      undefined,
      { timeout: 10_000 },
    );
    check(
      `[${mode}] un 409 retira decisiones obsoletas antes de recargar`,
      (await trackButtons.count()) === 0,
    );
    releaseJournalReload();
    await page.getByText("El mentor ya te ha dado un siguiente paso").waitFor({
      timeout: 15_000,
    });
    check(
      `[${mode}] el 409 recupera la memoria concurrente`,
      recommendationConflicts === 1,
    );

    const resolveConcurrent = await fetch(
      `${base}/api/journal/${persistedCharacterId}/entries/${concurrentEntry.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          result: "Entrada concurrente reconocida por la prueba.",
        }),
      },
    );
    if (!resolveConcurrent.ok) {
      throw new Error(`no se pudo cerrar la entrada concurrente: HTTP ${resolveConcurrent.status}`);
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#market-budget").fill("5");
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    await trackButtons.first().waitFor({ timeout: 25_000 });

    await trackButtons.first().click();
    const nextAction = page.getByText("Haz esto ahora");
    await nextAction.waitFor({ timeout: 15_000 });
    check(`[${mode}] presenta una única próxima acción`, (await nextAction.count()) === 1);
    check(`[${mode}] conserva confianza`, await page.getByText(/Confianza /).first().isVisible());
    check(`[${mode}] conserva riesgo`, await page.getByText(/Riesgo /).first().isVisible());
    check(`[${mode}] conserva fuentes`, await page.getByText(/^Fuentes:/).isVisible());
    check(
      `[${mode}] una acción activa bloquea tareas paralelas`,
      await page.getByRole("button", { name: "Generar recomendaciones" }).isDisabled(),
    );

    const characterId = await page.evaluate(() =>
      localStorage.getItem("exile-copilot:characterId"),
    );
    check(
      `[${mode}] personaje persistido antes del diario`,
      characterId === persistedCharacterId,
    );
    const journalBeforeReload = await (await fetch(`${base}/api/journal/${characterId}`)).json();
    check(
      `[${mode}] snapshot auditable guardado`,
      journalBeforeReload.primaryEntry?.recommendationSnapshot !== null &&
        journalBeforeReload.primaryEntry?.context?.budget?.amount === 5,
    );

    await page.reload({ waitUntil: "networkidle" });
    await nextAction.waitFor({ timeout: 20_000 });
    check(`[${mode}] próxima acción sobrevive a recarga`, await nextAction.isVisible());

    await page.getByRole("button", { name: "Ya hice este paso" }).click();
    await page.getByText("Esperando tu resultado").first().waitFor({ timeout: 15_000 });
    check(
      `[${mode}] ejecutar no equivale a completar`,
      await page.getByLabel("¿Qué ocurrió después de hacer el paso?").isVisible(),
    );
    const saveResult = page.getByRole("button", {
      name: "Guardar resultado y cerrar este paso",
    });
    check(`[${mode}] no acepta resultado vacío`, await saveResult.isDisabled());
    await page
      .getByLabel("¿Qué ocurrió después de hacer el paso?")
      .fill("El cambio dejó rayo en 75% sin perder vida.");
    await saveResult.click();
    await page.getByText("Resultado: El cambio dejó rayo en 75% sin perder vida.").waitFor({
      timeout: 15_000,
    });
    check(
      `[${mode}] resultado cierra el paso y permanece en historial`,
      await page.getByText("No hay un siguiente paso activo").isVisible(),
    );

    const generateAfterResult = page.getByRole("button", {
      name: "Generar recomendaciones",
    });
    await generateAfterResult.waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForFunction(
      () => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (entry) => entry.textContent?.includes("Generar recomendaciones"),
        );
        return button instanceof HTMLButtonElement && !button.disabled;
      },
      undefined,
      { timeout: 15_000 },
    );
    await generateAfterResult.click();
    await page.getByText("El diario influyó en esta decisión").waitFor({
      timeout: 20_000,
    });
    const latestRecommendationPayload = recommendationPayloads.at(-1);
    check(
      `[${mode}] la UI envía la revisión del diario`,
      typeof latestRecommendationPayload?.journalRevision === "string" &&
        /^journal-memory-v1:[0-9a-f]{16}$/.test(
          latestRecommendationPayload.journalRevision,
        ),
    );
    check(
      `[${mode}] un resultado previo cambia la siguiente decisión`,
      await page.getByText(/Actualizar el perfil tras/).first().isVisible(),
    );
    check(
      `[${mode}] no repite la mejora antes de reconciliar datos`,
      (await page
        .locator("#seccion-recomendaciones")
        .getByText("Cubrir resistencias elementales", { exact: true })
        .count()) === 0,
    );
    check(
      `[${mode}] la reconciliación se declara no exportable`,
      await page
        .getByText("Acción de datos: no modifica el juego ni se incluye en el archivo .build.")
        .isVisible(),
    );

    await page.getByText("Crear seguimiento manual").click();
    await page.getByLabel("Tipo", { exact: true }).selectOption("craft");
    await page.getByLabel("Título").fill("Craft de la ballesta");
    await page.getByLabel("Estado o decisión").fill("Dos prefijos físicos y un sufijo malo.");
    await page
      .getByLabel(/Próxima acción/)
      .fill("Aplicar una sola moneda y enseñarme el resultado.");
    await page.getByRole("button", { name: "Guardar seguimiento" }).click();
    await page.getByRole("heading", { name: "Craft de la ballesta" }).waitFor({
      timeout: 15_000,
    });
    check(
      `[${mode}] seguimiento manual puede ser la acción principal`,
      await page.getByText("Aplicar una sola moneda y enseñarme el resultado.").isVisible(),
    );
    check(
      `[${mode}] no ofrece borrado silencioso`,
      (await page
        .locator("#seccion-mentor")
        .getByRole("button", { name: /eliminar|borrar/i })
        .count()) === 0,
    );

    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await wait(250);
      const viewport = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      check(
        `[${mode}] ${width}px sin desbordamiento horizontal`,
        viewport.scroll <= viewport.client + 1,
      );
    }

    check(`[${mode}] sin peticiones externas`, externalRequests.length === 0);
    check(`[${mode}] sin errores relevantes`, errors.length === 0);
    if (externalRequests.length > 0) console.log("   externas:", externalRequests.slice(0, 3));
    if (errors.length > 0) console.log("   errores:", errors.slice(0, 3));
  } catch (error) {
    console.error(`ERROR en Hito 5A (${mode}):`, error);
    total += 1;
    failures += 1;
  } finally {
    if (browser) await browser.close();
    stopServer(server);
  }
}

for (const mode of modes) {
  await runFlow(mode, mode === "prod" ? 7191 : 7190);
}

console.log(
  failures === 0
    ? `\nHITOS 5A/5B: ${total}/${total} COMPROBACIONES PASARON`
    : `\nHITOS 5A/5B: ${failures} de ${total} COMPROBACIONES FALLARON`,
);
globalThis.process.exit(failures === 0 ? 0 : 1);
