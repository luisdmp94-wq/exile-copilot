/**
 * Prueba de navegador del chequeo de build (Exile Mentor) sobre la web pública.
 *
 * Uso:
 *   npm run test:check   → construye dist-check/ y ejecuta esta prueba
 *
 * Sirve dist-check/ con `vite preview` (la misma build que se publica en
 * Cloudflare Pages) y aplica a cada respuesta la Content-Security-Policy de
 * public-check/_headers, así un cambio que rompa la política falla aquí antes
 * que en producción. Recorre como jugador: errores de pegado, código PoB2 en
 * campaña y en mapas, resumen copiado, idioma, modo manual, memoria de
 * progreso y móvil.
 * Comprueba además que leer un build no hace ninguna petición de red.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { launchBrowser, stopChild, toolCommand } from "./browserLaunch.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const PORT = 7310;
const BASE = `http://127.0.0.1:${PORT}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let total = 0;
let failures = 0;
function check(label, condition) {
  total += 1;
  console.log(`${condition ? "✅" : "❌"} ${label}`);
  if (!condition) failures += 1;
}

/** Código PoB2 de prueba: la instantánea sintética con resistencias bajas. */
function lowResPobCode() {
  const xml = readFileSync(new URL("../server/fixtures/pob2/richCharacter.synthetic.xml", import.meta.url), "utf8")
    .replace('stat="FireResist" value="75"', 'stat="FireResist" value="52"')
    .replace('stat="LightningResist" value="75"', 'stat="LightningResist" value="61"')
    .replace('stat="ChaosResist" value="36"', 'stat="ChaosResist" value="-24"');
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** La misma política que servirá Cloudflare, leída de public-check/_headers. */
function contentSecurityPolicy() {
  const headers = readFileSync(new URL("../public-check/_headers", import.meta.url), "utf8");
  const line = headers.split(/\r?\n/).find((entry) => entry.trim().startsWith("Content-Security-Policy:"));
  if (!line) throw new Error("public-check/_headers no declara Content-Security-Policy");
  return line.trim().slice("Content-Security-Policy:".length).trim();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return true;
    } catch {
      // El servidor todavía está arrancando.
    }
    await wait(500);
  }
  return false;
}

async function priorityTexts(page) {
  return page.locator('[data-testid^="priority-"]').evaluateAll((items) =>
    items.map((item) => ({ id: item.dataset.testid, text: item.innerText })),
  );
}

async function run(page, requests) {
  const alert = page.getByRole("alert");

  // 1. Portada
  await page.goto(`${BASE}/?lang=es`);
  check("título con el nombre Exile Mentor", (await page.title()).includes("Exile Mentor"));
  check("no aparece el nombre antiguo en la página", !(await page.locator("body").innerText()).includes("Copilot"));
  check(
    "empieza en «En la campaña»",
    (await page.getByRole("button", { name: "En la campaña" }).getAttribute("aria-pressed")) === "true",
  );

  // 2. Errores al pegar
  const code = page.getByRole("textbox");
  const read = page.getByRole("button", { name: "Leer mi build" });
  await read.click();
  check("vacío → pide el código", (await alert.innerText()).includes("Pega primero el código"));
  await code.fill("https://pobb.in/BOAabYYRuHBe");
  await read.click();
  check("enlace de pobb.in → explica el botón Copy", (await alert.innerText()).includes("pulsa «Copy»"));
  await code.fill("esto no es un código");
  await read.click();
  check("texto cualquiera → no es un código de PoB2", (await alert.innerText()).includes("no parece un código"));

  // 3. Código PoB2 en campaña, sin red
  await code.fill(lowResPobCode());
  const before = requests.length;
  await read.click();
  await page.getByTestId("build-check-priorities").waitFor();
  check("leer el build no hace ninguna petición de red", requests.length === before);
  const campaign = await priorityTexts(page);
  check(
    "campaña: primero los huecos vacíos",
    campaign[0]?.id === "priority-huecos-equipo" && campaign[0].text.includes("Urgente"),
  );
  const elementalCampaign = campaign.find((entry) => entry.id === "priority-resistencias-elementales");
  check(
    "campaña: resistencias como «Menor» y con la penalización explicada",
    !!elementalCampaign && elementalCampaign.text.includes("Menor") && elementalCampaign.text.includes("cada acto"),
  );
  check(
    "lectura del personaje",
    (await page.getByTestId("build-check-reading").innerText()).includes("Ranger · Ritualist · nivel 90"),
  );
  check(
    "primer chequeo guardado",
    (await page.getByTestId("build-check-history").innerText()).includes("Guardo este chequeo"),
  );
  await page.getByRole("button", { name: "Copiar resumen" }).click();
  const summary = await page.evaluate(() => navigator.clipboard.readText());
  check(
    "copiar resumen: personaje, prioridades y dirección de la web",
    summary.startsWith("Exile Mentor · Ranger · Ritualist · nivel 90 · en la campaña") &&
      summary.includes("1. [Urgente] Rellena los huecos de equipo vacíos") &&
      summary.endsWith(`Chequeo hecho con Exile Mentor: ${BASE}`),
  );

  // 4. Mapas y cambio de idioma sobre el mismo resultado
  await page.getByRole("button", { name: "Ya en mapas" }).click();
  const maps = await priorityTexts(page);
  check(
    "mapas: resistencias primero y urgentes",
    maps[0]?.id === "priority-resistencias-elementales" && maps[0].text.includes("Urgente"),
  );
  await page.getByRole("button", { name: "English" }).click();
  // textContent: el encabezado se muestra en mayúsculas por CSS.
  check(
    "inglés: encabezado traducido",
    ((await page.getByTestId("build-check-priorities").textContent()) ?? "").includes("What I'd fix first"),
  );
  check("inglés: lectura traducida", (await page.getByTestId("build-check-reading").innerText()).includes("level 90"));

  // 5. Modo manual: todo arreglado → progreso
  await page.getByRole("button", { name: "I'll type it in" }).click();
  for (const [name, value] of [["fire", "75"], ["cold", "75"], ["lightning", "75"], ["chaos", "0"]]) {
    await page.locator(`input[name="${name}"]`).fill(value);
  }
  await page.getByRole("button", { name: "Show what to fix" }).click();
  await page.getByTestId("build-check-priorities").waitFor();
  check(
    "manual: nada urgente",
    (await page.getByTestId("build-check-priorities").innerText()).includes("Nothing urgent"),
  );
  const history = await page.getByTestId("build-check-history").innerText();
  check("progreso: mejora desde el último chequeo", history.includes("You're improving"));
  check("progreso: resistencias elementales resueltas", history.includes("Fixed: elemental resistances"));

  // 6. Preferencias recordadas y olvidar chequeos
  await page.getByRole("button", { name: "Forget my checks" }).click();
  check(
    "olvidar borra los chequeos guardados",
    (await page.evaluate(() => localStorage.getItem("exile-copilot.check.history"))) === null,
  );
  await page.goto(`${BASE}/`);
  check(
    "recuerda el idioma al volver",
    (await page.getByRole("button", { name: "English" }).getAttribute("aria-pressed")) === "true",
  );
  check(
    "recuerda «mapas» al volver",
    (await page.getByRole("button", { name: "Already mapping" }).getAttribute("aria-pressed")) === "true",
  );

  // 7. Móvil
  await page.setViewportSize({ width: 375, height: 812 });
  check(
    "móvil: sin desplazamiento lateral",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
}

async function main() {
  if (!existsSync(new URL("../dist-check/index.html", import.meta.url))) {
    console.error("Falta dist-check/. Ejecuta antes `npm run build:check` (o usa `npm run test:check`).");
    process.exit(1);
  }
  const launch = toolCommand("vite", [
    "preview",
    "--config",
    "vite.check.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORT),
    "--strictPort",
  ]);
  const server = spawn(launch.command, launch.args, { cwd: REPO, shell: launch.shell, stdio: "ignore" });
  const browser = await launchBrowser();
  try {
    if (!(await waitForServer())) throw new Error(`la web no arrancó en ${BASE}`);

    const csp = contentSecurityPolicy();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-ES" });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await context.route("**/*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": csp } });
    });
    const page = await context.newPage();
    const requests = [];
    const consoleErrors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await run(page, requests);

    check("ninguna petición fuera de la propia web", requests.every((url) => url.startsWith(`${BASE}/`)));
    check(
      `sin errores en consola ni bloqueos de la política de seguridad${consoleErrors.length ? `: ${consoleErrors[0]}` : ""}`,
      consoleErrors.length === 0,
    );
    await context.close();
  } catch (error) {
    failures += 1;
    console.error(`❌ La prueba se detuvo: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser.close();
    stopChild(server);
  }

  console.log(`\nChequeo de build: ${total - Math.min(failures, total)}/${total} comprobaciones correctas.`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
