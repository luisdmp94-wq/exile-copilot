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
 *  15. el detalle muestra procedencia
 *  16. el foco queda atrapado dentro del diálogo
 *  17. Escape cierra el detalle
 *  18. Escape devuelve el foco al HUECO que lo abrió
 *  19. los datos desconocidos se declaran «Desconocido»
 *  20. varios frascos se agrupan a partir de datos reales
 *  21. un objeto duplicado/extra aparece en «Otros objetos»
 *  22. el botón «Ver el objeto evaluado» solo existe con vínculo estructurado
 *  23. la navegación recomendación → objeto abre el detalle
 *  24. Escape devuelve el foco al BOTÓN de la recomendación
 *  25. hay huecos resaltados por vínculo estructurado
 *  26. objeto → «Ver recomendaciones» activa el área Mentor
 *  27. la sección de recomendaciones queda visible y ENFOCADA
 *  28. el foco no queda dentro del panel «Personaje» oculto
 *  29. con prefers-reduced-motion el diálogo no anima
 *  30. sin desbordamiento horizontal a 320/360/375/390 px (4 comprobaciones)
 *  34. las celdas siguen siendo utilizables a 360 px
 *  35. el detalle funciona en móvil
 *  36. sin peticiones a hosts externos
 *  37. sin <img> remotas
 *  38. sin errores de consola relevantes (se excluye solo el 404 preexistente
 *      de /favicon.ico en el servidor de desarrollo, ajeno a este hito)
 */
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browserLaunch.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const modes = args.includes("--all") ? ["prod", "dev"] : args.includes("--dev") ? ["dev"] : ["prod"];

const SHOT_DIR = UPDATE_SCREENSHOTS
  ? join(REPO, "docs", "screenshots")
  : mkdtempSync(join(tmpdir(), "exile-copilot-4b-"));
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
/**
 * Navegación por áreas (Mentor / Personaje / Plan y mercado). Los tres paneles
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

let total = 0;
const check = (name, ok) => {
  total += 1;
  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) failures += 1;
};

/**
 * Prepara un perfil con VARIOS frascos y un objeto duplicado usando las rutas
 * reales de la API, y lo deja restaurable por el frontend vía localStorage.
 */
async function seedProfile(base) {
  const demo = await (await fetch(`${base}/api/character/demo`)).json();
  const profile = demo.profile;
  const fuente = [{ kind: "user", label: "Sembrado por la prueba", retrievedAt: new Date().toISOString() }];
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
  );
  const res = await fetch(`${base}/api/character`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) throw new Error(`no se pudo sembrar el perfil: HTTP ${res.status}`);
  return profile.id;
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== HITO 4B — MODO ${mode.toUpperCase()} (${BASE}) ===`);
  const proc = startServer(mode, port);
  let browser;
  try {
    check(`[${mode}] servidor responde /api/health`, await waitForServer(BASE));

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
    // El servidor de desarrollo de Vite no sirve /favicon.ico y el navegador lo
    // pide siempre: es un 404 PREEXISTENTE, ajeno al Hito 4B (en producción el
    // fallback SPA devuelve index.html y no ocurre). Se excluye solo ese caso,
    // por URL exacta, para no enmascarar ningún otro error.
    const esFaviconAusente = (texto) => texto.includes("/favicon.ico");
    const erroresConsola = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(msg.text() + " @ " + (msg.location()?.url ?? "?"));
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));
    // Respuestas de error: se registran con su URL para poder diagnosticarlas.
    page.on("response", (res) => {
      if (res.status() >= 400) erroresConsola.push(`HTTP ${res.status()} ${res.url()}`);
    });

    await page.goto(BASE, { waitUntil: "networkidle" });
    await irA(page, "personaje");
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
    check(`[${mode}] rareza expresada también como texto`, textoPanel.includes("Raro"));
    check(`[${mode}] procedencia visible en el hueco`, textoPanel.includes("Lo has indicado tú"));
    check(
      `[${mode}] diagnóstico con recuentos reales`,
      textoPanel.includes("Modificadores sin verificar"),
    );
    check(
      `[${mode}] sin puntuaciones ni afinidad inventadas`,
      !/\d+(\.\d+)?\s*\/\s*10|afinidad|salud de la build/i.test(textoPanel),
    );
    check(
      `[${mode}] las pistas de un plan .build no aparecen como equipo`,
      !textoPanel.includes("Stat Priority") && !textoPanel.includes("Any Two Handed Mace"),
    );

    // --- Detalle accesible ------------------------------------------------
    const primerHueco = page.locator('[data-slot-state="filled"]').first();
    await primerHueco.focus();
    const idHueco = await page.evaluate(() => document.activeElement?.getAttribute("data-item-id"));
    check(`[${mode}] el hueco es enfocable por teclado`, typeof idHueco === "string");

    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog");
    await dialogo.waitFor({ timeout: 15000 });
    check(`[${mode}] Enter abre el detalle`, await dialogo.isVisible());

    const textoDialogo = await dialogo.innerText();
    check(
      `[${mode}] el detalle muestra nombre y base`,
      textoDialogo.includes("Doom Song") && textoDialogo.includes("Varnished Crossbow"),
    );
    // El CSS `uppercase` afecta a innerText: se compara sin distinguir mayúsculas.
    check(`[${mode}] el detalle separa los tipos de modificador`, /expl[íi]citos/i.test(textoDialogo));
    check(`[${mode}] el detalle muestra requisitos`, textoDialogo.includes("Nivel 68"));
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
    const seededId = await seedProfile(BASE);
    await page.evaluate((id) => localStorage.setItem("exile-copilot:characterId", id), seededId);
    await page.reload({ waitUntil: "networkidle" });
    // Con personaje se entra por «Mentor»: el paperdoll está en «Personaje».
    await irA(page, "personaje");
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
    await page.locator("#market-budget").fill("5");
    await irA(page, "mentor");
    await page.getByRole("button", { name: "Generar recomendaciones" }).click();
    await page.waitForSelector("text=/Confianza|confianza/", { timeout: 25000 });
    const botones = page.locator('[data-testid^="ver-objeto-"]');
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
    await page.keyboard.press("Escape");
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    const focoTrasBoton = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? null,
    );
    check(
      `[${mode}] Escape devuelve el foco al botón de la recomendación`,
      focoTrasBoton === testIdBoton,
    );
    check(
      `[${mode}] hay huecos resaltados por vínculo estructurado`,
      (await page.locator('[data-highlighted="true"]').count()) >= 1,
    );

    // --- Navegación inversa objeto → recomendaciones -----------------------
    // Regresión completa: Personaje → abrir objeto relacionado → «Ver
    // recomendaciones» → área «Mentor» activa → sección visible y ENFOCADA,
    // con el foco fuera del panel «Personaje» oculto.
    await irA(page, "personaje");
    await page.locator('[data-highlighted="true"]').first().click();
    await dialogo.waitFor({ timeout: 15000 });
    const verRecs = dialogo.getByRole("button", { name: "Ver recomendaciones" });
    await verRecs.waitFor({ timeout: 15000 });
    await verRecs.click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="tab-mentor"]')?.getAttribute("data-state") ===
        "active",
      undefined,
      { timeout: 10000 },
    );
    check(`[${mode}] «Ver recomendaciones» activa el área Mentor`, true);
    await dialogo.waitFor({ state: "hidden", timeout: 15000 });
    // El desplazamiento es suave salvo con reduced-motion: se espera a que la
    // sección haya llegado a la parte visible.
    await page.waitForFunction(
      () => {
        const sec = document.getElementById("seccion-recomendaciones");
        if (sec === null) return false;
        const r = sec.getBoundingClientRect();
        return r.top > -8 && r.top < window.innerHeight * 0.6;
      },
      undefined,
      { timeout: 15000 },
    );
    const navInversa = await page.evaluate(() => {
      const sec = document.getElementById("seccion-recomendaciones");
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
      `[${mode}] la sección de recomendaciones queda visible y enfocada (foco: ${navInversa.foco})`,
      navInversa.visible && navInversa.enfocada,
    );
    check(
      `[${mode}] el foco no queda dentro del panel «Personaje» oculto`,
      !navInversa.focoEnPanelOculto,
    );

    // --- prefers-reduced-motion ------------------------------------------
    // El paperdoll vive en «Personaje»: se vuelve allí tras usar el mentor.
    await irA(page, "personaje");
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

    // --- Recursos externos y consola --------------------------------------
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
  } catch (err) {
    console.error(`ERROR en el smoke del Hito 4B (${mode}):`, err.message);
    failures += 1;
    total += 1;
  } finally {
    if (browser) await browser.close();
    stopServer(proc);
  }
}

for (const mode of modes) {
  await runFlow(mode, mode === "prod" ? 7189 : 7188);
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
