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
 *   5. la respuesta muestra confianza (en español)
 *   6. el turno del jugador y el del mentor se distinguen
 *   7. la respuesta no muestra identificadores internos del contrato
 *   8. la respuesta no muestra niveles en inglés (high/medium/low)
 *   9. la versión del motor no se muestra por defecto
 *  10. «Ver evidencia y limitaciones» existe y está plegada
 *  11. la evidencia se abre con TECLADO y muestra fuentes
 *  12. la evidencia muestra «falta por verificar»
 *  13. la evidencia conserva motor, fecha y tipo de consulta en español
 *  14. la evidencia traduce los tipos de fuente (nunca «calculation»)
 *  15. «¿Cuál es mi principal problema?» explica la prioridad
 *  16. una pregunta no soportada se declara como tal y ofrece ejemplos
 *  17. una pregunta no soportada no propone ninguna acción
 *  18. el texto malicioso se muestra como TEXTO, nunca como HTML
 *  19. hay turnos suficientes para desbordar el hilo
 *  20. el último mensaje queda visible dentro del hilo
 *  21. añadir un turno NO desplaza la página entera
 *  22. con «prefers-reduced-motion» el último turno sigue visible
 *  23. guardar la acción invalida la conversación (cambia la revisión del diario)
 *  24. la acción guardada aparece como acción activa del diario
 *  25. con acción activa el mentor RECUERDA el paso y no crea otro
 *  26. con acción activa no se ofrece volver a guardarla
 *  27. hay conversación antes de cambiar los inputs
 *  28. cambiar el presupuesto reinicia la conversación
 *  29-31. sin desbordamiento horizontal a 320/360/390 px
 *  32. el campo de pregunta es accesible por teclado y envía con Enter
 *  33. sin peticiones a hosts externos
 *  34. sin errores de consola relevantes
 *  35. el modo visible coincide con reglas o fallback IA esperado
 *  36-43. mentor contextual: bienvenida, plegado, carrera, atribución,
 *         intención soportada, debounce y tamaño móvil
 */
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, productionServerCommand, toolCommand } from "./browserLaunch.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const UPDATE_SCREENSHOTS = args.includes("--update-screenshots");
const EXPECT_AI_FALLBACK = process.env.MENTOR_AI_SMOKE_EXPECT_FALLBACK === "true";
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
      // El recorrido concentra en segundos todas las preguntas que una persona
      // haría durante una sesión; evita que el propio smoke choque con el
      // límite de producción sin modificar dicho límite en la aplicación.
      MENTOR_RATE_LIMIT_PER_MINUTE: "300",
      // El smoke ordinario prueba la procedencia por reglas. La variante
      // explícita de fallback activa IA con su propio proveedor simulado.
      MENTOR_AI_ENABLED: EXPECT_AI_FALLBACK ? "true" : "false",
      // Base SQLite propia y temporal: jamás se usa la real.
      DATABASE_PATH: join(tempRoot, `${mode}.db`),
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
 * La conversación vive plegada en «Preguntar al mentor», bajo el caso abierto.
 * Se despliega antes de escribir en lugar de suponer que está a la vista.
 */
async function abrirMentor(page) {
  const trigger = page.getByTestId("acordeon-mentor");
  if ((await trigger.getAttribute("aria-expanded")) === "true") return;
  await trigger.click();
  await page.locator("#seccion-mentor-chat").waitFor({ state: "visible", timeout: 15000 });
}

async function preguntar(page, texto) {
  await abrirMentor(page);
  await page.locator("#mentor-pregunta").fill(texto);
  await page.getByTestId("mentor-preguntar").click();
  await page.getByTestId("mentor-cargando").waitFor({ state: "detached", timeout: 25000 });
}

/**
 * Holgura en px al comprobar el desplazamiento. El desplazamiento suave puede
 * detenerse en una posición fraccionaria, así que la espera y la comprobación
 * de visibilidad usan la MISMA tolerancia: si no, la comprobación falla por
 * unos pocos píxeles aunque el hilo esté abajo del todo. Un fallo real (no
 * desplazar) deja el último turno cientos de píxeles fuera.
 */
const HOLGURA_SCROLL = 8;

/** Espera a que el desplazamiento suave del hilo termine en el último turno. */
async function esperarHiloAbajo(page) {
  await page.waitForFunction(
    (holgura) => {
      const cont = document.querySelector('[data-testid="mentor-hilo"]');
      if (cont === null) return false;
      return cont.scrollTop + cont.clientHeight >= cont.scrollHeight - holgura;
    },
    HOLGURA_SCROLL,
    { timeout: 15000 },
  );
}

async function runFlow(mode, port) {
  const BASE = `http://localhost:${port}`;
  console.log(`\n=== HITO 6A — MODO ${mode.toUpperCase()} (${BASE}) ===`);
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
    const erroresConsola = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erroresConsola.push(`${msg.text()} @ ${msg.location()?.url ?? "?"}`);
    });
    page.on("pageerror", (err) => erroresConsola.push(String(err)));

    await page.goto(BASE, { waitUntil: "networkidle" });

    // --- Sin personaje: honestidad ----------------------------------------
    await irA(page, "expediente");
    const seccion = page.locator("#seccion-mentor-chat");
    // Sin personaje no hay caso abierto ni conversación: solo la bienvenida.
    // El mentor no aparece para no poder improvisar nada.
    check(
      `[${mode}] sin personaje no hay conversación que improvisar`,
      (await page.getByTestId("bienvenida").isVisible()) &&
        (await seccion.count()) === 0,
    );
    check(
      `[${mode}] sin personaje el mentor contextual no presupone un expediente`,
      (await page.getByTestId("mentor-contextual-titulo").innerText()).includes(
        "Necesito conocer a tu personaje",
      ) && (await page.getByTestId("mentor-contextual-preguntar").count()) === 0,
    );

    await page.getByRole("button", { name: "Cargar ejemplo" }).first().click();
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20000 });

    // El ejemplo vive primero solo en memoria del navegador. Antes de probar
    // acciones que escriben en el diario hay que guardarlo en SQLite, igual que
    // se exige ahora al jugador: sin personaje persistido la interfaz abre el
    // editor y no finge que ha creado memoria.
    await page.getByTestId("abrir-editor-expediente").click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15000 });
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/character") &&
          response.request().method() === "POST",
        { timeout: 10000 },
      ),
      page.getByRole("button", { name: /Guardar correcciones/i }).click(),
    ]);
    check(`[${mode}] personaje persistido antes de usar la memoria`, saveResponse.status() === 200);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15000 });

    check(
      `[${mode}] el mentor contextual reconoce el personaje cargado`,
      /Demo Gemling|Los cambios ya forman parte del diagnóstico/.test(
        await page.getByTestId("mentor-contextual-titulo").innerText(),
      ),
    );

    // El plegado pertenece al panel, no al cue. Cambiar de área no puede
    // reconstruir el componente ni desplegarlo a espaldas del jugador.
    const contextualToggle = page.getByTestId("mentor-contextual-plegar");
    if ((await contextualToggle.getAttribute("aria-expanded")) === "true") {
      await contextualToggle.click();
    }
    await irA(page, "plan");
    check(
      `[${mode}] el mentor contextual conserva el plegado al cambiar de área`,
      (await contextualToggle.getAttribute("aria-expanded")) === "false",
    );
    // Cuando está plegado, el panel y su control interno quedan ocultos por
    // diseño; la mascota es el único control visible para volver a abrirlo.
    await page.getByTestId("mentor-mascota").click();

    // Una respuesta que llega después de cambiar de contexto puede guardarse
    // en el hilo, pero no sustituir el nuevo panel.
    await page.route(
      "**/api/mentor/query",
      async (route) => {
        await wait(700);
        await route.continue();
      },
      { times: 1 },
    );
    const delayedResponse = page.waitForResponse(
      (response) => response.url().includes("/api/mentor/query"),
      { timeout: 20000 },
    );
    const contextualAsk = page.getByTestId("mentor-contextual-preguntar");
    await contextualAsk.focus();
    await page.keyboard.press("Enter");
    await irA(page, "expediente");
    await delayedResponse;
    await wait(150);
    check(
      `[${mode}] una respuesta tardía no pisa el contexto nuevo`,
      (await page.getByTestId("mentor-contextual-titulo").innerText()).includes(
        "Has vuelto al expediente",
      ) && (await page.getByTestId("mentor-contextual-respuesta").count()) === 0,
    );

    // En una consulta vigente, el botón permanece montado y la procedencia
    // visible corresponde al modo real de respuesta.
    await irA(page, "plan");
    await contextualAsk.focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("mentor-contextual-respuesta").waitFor({ timeout: 25000 });
    const contextualText = await page.getByTestId("mentor-contextual-respuesta").innerText();
    const contextualMode = await page.getByTestId("mentor-contextual-modo").innerText();
    check(
      `[${mode}] la consulta contextual es soportada y declara respuesta del motor`,
      /respuesta del motor/i.test(contextualMode) &&
        !contextualText.includes("No he entendido esa pregunta"),
    );
    await page
      .waitForFunction(
        () =>
          document.activeElement?.getAttribute("data-testid") ===
          "mentor-contextual-preguntar",
        { timeout: 1500 },
      )
      .catch(() => undefined);
    const contextualFocus = await page.evaluate(() => ({
      testId: document.activeElement?.getAttribute("data-testid") ?? null,
      tag: document.activeElement?.tagName ?? null,
    }));
    check(
      `[${mode}] responder no desmonta el botón que tenía el foco`,
      contextualFocus.testId === "mentor-contextual-preguntar",
    );

    // El hilo contextual anterior no debe contaminar las cuentas históricas
    // del smoke existente. El perfil sí vuelve porque ya está persistido.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Demo Gemling").first().waitFor({ timeout: 20000 });

    // Escribir un número no produce cues intermedios 1/15/150: solo el valor
    // final tras una pausa breve.
    await irA(page, "plan");
    await page.evaluate(() => {
      window.__contextualTitles = [];
      const title = document.querySelector('[data-testid="mentor-contextual-titulo"]');
      window.__contextualObserver = new MutationObserver(() => {
        window.__contextualTitles.push(title?.textContent ?? "");
      });
      if (title) {
        window.__contextualObserver.observe(title, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    });
    await page.getByTestId("market-context-details").evaluate((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    });
    const budgetInput = page.locator("#market-budget");
    await budgetInput.fill("");
    await budgetInput.pressSequentially("1500", { delay: 100 });
    await wait(750);
    const budgetTitles = await page.evaluate(() => {
      window.__contextualObserver?.disconnect();
      return window.__contextualTitles;
    });
    check(
      `[${mode}] el presupuesto solo anuncia el valor final`,
      budgetTitles.some((title) => title.includes("1500")) &&
        !budgetTitles.some((title) => /^(1|15|150)\s/.test(title)),
    );
    await irA(page, "expediente");

    await abrirMentor(page);
    await seccion.waitFor({ state: "visible", timeout: 20000 });

    check(
      `[${mode}] la sección ofrece sugerencias reconocidas`,
      (await page.getByTestId("mentor-sugerencia").count()) >= 3,
    );

    // --- Mentor v3: conversación social -----------------------------------
    await preguntar(page, "hola");
    const saludo = page.getByTestId("mentor-turno-mentor").last();
    const textoSaludo = await saludo.innerText();
    check(
      `[${mode}] «hola» recibe un saludo y no dispara una recomendación`,
      /hola|ayudarte/i.test(textoSaludo) &&
        (await page.getByTestId("mentor-proxima-accion").count()) === 0,
    );
    check(
      `[${mode}] un saludo no muestra evidencia técnica vacía`,
      (await saludo.getByTestId("mentor-evidencia").count()) === 0,
    );
    check(
      `[${mode}] el saludo no filtra ids internos`,
      !/\b(?:rec|fact)(?::|-)/i.test(textoSaludo),
    );

    // --- Identidad del Mentor ---------------------------------------------
    await preguntar(page, "¿Quién eres?");
    const identidad = page.getByTestId("mentor-turno-mentor").last();
    const textoIdentidad = await identidad.innerText();
    check(
      `[${mode}] «¿Quién eres?» recibe una presentación útil y honesta`,
      textoIdentidad.includes("Mentor de Exile Copilot") &&
        textoIdentidad.includes("si me faltan datos") &&
        !textoIdentidad.includes("No puedo responder") &&
        !textoIdentidad.includes("Todavía no sé responder"),
    );
    check(
      `[${mode}] la identidad no crea una recomendación ni evidencia vacía`,
      (await page.getByTestId("mentor-proxima-accion").count()) === 0 &&
        (await identidad.getByTestId("mentor-evidencia").count()) === 0,
    );

    // --- next_improvement --------------------------------------------------
    await preguntar(page, "¿Qué mejoro ahora?");
    const proximaAccion = page.getByTestId("mentor-proxima-accion");
    await proximaAccion.first().waitFor({ timeout: 20000 });
    check(
      `[${mode}] «¿Qué mejoro ahora?» responde con UNA sola próxima acción`,
      (await proximaAccion.count()) === 1,
    );
    const modoMentor = await page.getByTestId("mentor-modo").innerText();
    check(
      `[${mode}] el modo visible declara ${EXPECT_AI_FALLBACK ? "respaldo IA" : "reglas"}`,
      EXPECT_AI_FALLBACK
        ? modoMentor.includes("Respaldo por reglas")
        : modoMentor.includes("Reglas verificables"),
    );
    const textoMentor = await seccion.innerText();
    check(`[${mode}] la respuesta muestra confianza`, /confianza/i.test(textoMentor));
    check(
      `[${mode}] los turnos de jugador y mentor se distinguen`,
      (await page.getByTestId("mentor-turno-jugador").count()) >= 1 &&
        (await page.getByTestId("mentor-turno-mentor").count()) >= 1,
    );

    // --- Presentación humana: nada de valores internos por defecto ----------
    // Los identificadores del contrato (`next_improvement`, `explain_priority`,
    // `calculation`, `user`) y los niveles en inglés no se pintan nunca; la
    // versión del motor y la fecha técnica solo dentro de la sección plegable.
    const internos = ["next_improvement", "explain_priority", "calculation", "inputFingerprint"];
    check(
      `[${mode}] la respuesta no muestra identificadores internos del contrato`,
      internos.every((token) => !textoMentor.includes(token)) &&
        !/\b(?:rec|fact)(?::|-)/i.test(textoMentor),
    );
    check(
      `[${mode}] la respuesta no muestra niveles en inglés (high/medium/low)`,
      !/\b(high|medium|low)\b/.test(textoMentor),
    );
    check(
      `[${mode}] la versión del motor no se muestra por defecto`,
      !textoMentor.includes("1.1.0"),
    );

    // La evidencia existe, es accesible y está PLEGADA por defecto.
    const evidencia = page.getByTestId("mentor-evidencia").last();
    const fuentes = evidencia.locator('[data-testid="mentor-fuentes"]');
    const noVerificado = evidencia.locator('[data-testid="mentor-no-verificado"]');
    check(
      `[${mode}] «Ver evidencia y limitaciones» existe y está plegada`,
      (await page.getByTestId("mentor-evidencia").count()) === 1 &&
        (await evidencia.locator("summary").innerText()).includes(
          "Ver evidencia y limitaciones",
        ) &&
        !(await fuentes.isVisible()) &&
        !(await noVerificado.isVisible()),
    );

    // Se abre con TECLADO (details/summary nativo), no solo con el ratón.
    await evidencia.locator("summary").focus();
    await page.keyboard.press("Enter");
    await fuentes.waitFor({ state: "visible", timeout: 10000 });
    const textoEvidencia = await evidencia.innerText();
    check(
      `[${mode}] la evidencia se abre con teclado y muestra fuentes`,
      await fuentes.isVisible(),
    );
    check(
      `[${mode}] la evidencia muestra «falta por verificar»`,
      await noVerificado.isVisible(),
    );
    check(
      `[${mode}] la evidencia conserva motor, fecha y tipo de consulta en español`,
      textoEvidencia.includes("Motor 1.1.0") &&
        textoEvidencia.includes("Respondido el") &&
        textoEvidencia.includes("Tipo de consulta: Qué mejorar ahora"),
    );
    check(
      `[${mode}] la evidencia traduce los tipos de fuente (nunca «calculation»)`,
      !textoEvidencia.includes("calculation") && !textoEvidencia.includes("(user)"),
    );
    // Se vuelve a plegar para no alterar las comprobaciones siguientes.
    await evidencia.locator("summary").focus();
    await page.keyboard.press("Enter");

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

    // --- Desplazamiento del chat -------------------------------------------
    // Con suficientes turnos el hilo desborda su alto máximo. Al añadir una
    // pregunta, una respuesta o el estado de carga el contenedor debe quedar en
    // el último turno, SIN mover la página entera.
    await preguntar(page, "¿Qué debería hacer primero?");
    await preguntar(page, "¿Por qué me recomiendas esto?");
    await preguntar(page, "¿Cuál es el siguiente paso?");
    await esperarHiloAbajo(page);

    const antesDeScroll = await page.evaluate(() => window.scrollY);
    await preguntar(page, "¿Qué mejoro ahora?");
    await esperarHiloAbajo(page);

    const scroll = await page.evaluate((holgura) => {
      const cont = document.querySelector('[data-testid="mentor-hilo"]');
      const turnos = cont.querySelectorAll('[data-testid="mentor-turno-mentor"]');
      const ultimo = turnos[turnos.length - 1];
      const caja = cont.getBoundingClientRect();
      const cajaUltimo = ultimo.getBoundingClientRect();
      return {
        turnos: turnos.length,
        desbordado: cont.scrollHeight > cont.clientHeight + 1,
        // El final del último mensaje entra en la parte visible del contenedor.
        ultimoVisible:
          cajaUltimo.bottom <= caja.bottom + holgura && cajaUltimo.bottom > caja.top,
        paginaY: window.scrollY,
      };
    }, HOLGURA_SCROLL);

    check(
      `[${mode}] hay turnos suficientes para desbordar el hilo (${scroll.turnos} respuestas)`,
      scroll.turnos >= 6 && scroll.desbordado,
    );
    check(
      `[${mode}] el último mensaje queda visible dentro del hilo`,
      scroll.ultimoVisible,
    );
    check(
      `[${mode}] añadir un turno no desplaza la página entera (${antesDeScroll} → ${scroll.paginaY})`,
      scroll.paginaY === antesDeScroll,
    );

    // Con `prefers-reduced-motion: reduce` el salto es inmediato, pero el
    // último turno tiene que quedar igual de visible.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await preguntar(page, "¿Cuál es mi principal problema?");
    await esperarHiloAbajo(page);
    const reducido = await page.evaluate((holgura) => {
      const cont = document.querySelector('[data-testid="mentor-hilo"]');
      const turnos = cont.querySelectorAll('[data-testid="mentor-turno-mentor"]');
      const cajaUltimo = turnos[turnos.length - 1].getBoundingClientRect();
      const caja = cont.getBoundingClientRect();
      return cajaUltimo.bottom <= caja.bottom + holgura && cajaUltimo.bottom > caja.top;
    }, HOLGURA_SCROLL);
    check(`[${mode}] con «prefers-reduced-motion» el último turno sigue visible`, reducido);
    await page.emulateMedia({ reducedMotion: "no-preference" });

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
    const diario = await page
      .locator('[data-testid="diario-accion"]')
      .innerText()
      .catch(() => "");
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
    await irA(page, "plan");
    await page.getByTestId("market-context-details").evaluate((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    });
    await page.locator("#market-budget").fill("777");
    await page.locator("#market-budget").blur();
    await irA(page, "expediente");
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
    const contextualMobile = await page.getByTestId("mentor-contextual").boundingBox();
    check(
      `[${mode}] en móvil el mentor plegado ocupa menos del 12 % del alto`,
      contextualMobile !== null && contextualMobile.height < 800 * 0.12,
    );

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
