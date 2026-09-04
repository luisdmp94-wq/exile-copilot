import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

const TEMP_PREFIX = "exile-copilot-production-restart-";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempRoot = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
const databasePath = join(tempRoot, "public.db");
const characterId = "production-restart-character";
const characterName = "Expediente tras reinicio";
const journalTitle = "Memoria recuperada por el servidor compilado";
const mentorInputsKey = "production-restart-mentor-inputs-v1";
const mentorQuestion = "¿Qué mejoro ahora?";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanup() {
  const absoluteRoot = resolve(tempRoot);
  const absoluteTemp = resolve(tmpdir());
  const safe =
    absoluteRoot !== absoluteTemp &&
    absoluteRoot.startsWith(`${absoluteTemp}${sep}`) &&
    basename(absoluteRoot).startsWith(TEMP_PREFIX);
  if (!safe) throw new Error(`Limpieza bloqueada para una ruta no reconocida: ${absoluteRoot}`);
  rmSync(absoluteRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function openPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert(address && typeof address !== "string", "No se pudo reservar un puerto temporal.");
  const port = address.port;
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}

function environment(port, trustProxy = "loopback") {
  return {
    ...process.env,
    NODE_ENV: "production",
    PUBLIC_DEPLOYMENT: "true",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATABASE_PATH: databasePath,
    SECURE_COOKIES: "true",
    TRUST_PROXY: trustProxy,
    POE_NINJA_OFFLINE: "true",
    DEFAULT_PATCH: "0.5.4f",
    DEFAULT_LEAGUE: "Runes of Aldur",
    GGG_OAUTH_ENABLED: "false",
    EXPLAINER_LLM_ENABLED: "false",
    MENTOR_AI_ENABLED: "false",
  };
}

function launch(port, trustProxy = "loopback") {
  const output = [];
  const child = spawn(process.execPath, ["scripts/start-production.mjs"], {
    cwd: root,
    env: environment(port, trustProxy),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  return { child, output };
}

async function waitForExit(child, timeoutMs = 8_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => reject(new Error("El proceso no terminó dentro del plazo.")), timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolveExit({ code, signal });
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function waitForReady(base, child, output, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "sin respuesta";
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`El servidor terminó antes de estar listo:\n${output.join("").slice(-2_000)}`);
    }
    try {
      const response = await fetch(`${base}/api/ready`);
      const body = await response.text();
      if (response.ok && body.includes('"status":"ready"')) return;
      lastFailure = `HTTP ${response.status}: ${body.slice(0, 200)}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`El servidor no quedó disponible (${lastFailure}).`);
}

async function stop(instance) {
  if (instance.child.exitCode !== null || instance.child.signalCode !== null) return;
  instance.child.kill("SIGTERM");
  try {
    const result = await waitForExit(instance.child, 12_000);
    if (process.platform !== "win32") {
      assert(result.code === 0, `El cierre limpio terminó con código ${result.code}.`);
      assert(
        instance.output.join("").includes("HTTP y SQLite cerrados correctamente"),
        "El servidor no confirmó el cierre limpio de HTTP y SQLite.",
      );
    }
  } catch (error) {
    instance.child.kill("SIGKILL");
    await waitForExit(instance.child, 3_000).catch(() => undefined);
    throw error;
  }
}

async function expectJson(response, operation) {
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${operation} falló con HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }
  return JSON.parse(raw);
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert(setCookie.includes("__Host-exile_copilot_session="), "Falta la cookie pública protegida.");
  for (const directive of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]) {
    assert(setCookie.includes(directive), `La cookie pública no contiene ${directive}.`);
  }
  return setCookie.split(";", 1)[0];
}

async function assertUnsafeConfigFailsClosed(port) {
  const instance = launch(port, "false");
  const result = await waitForExit(instance.child);
  const output = instance.output.join("");
  assert(result.code !== 0, "Una publicación sin proxy autorizado arrancó por error.");
  assert(output.includes("Configuración pública bloqueada"), "El fallo no explicó la barrera pública.");
  assert(output.includes("TRUST_PROXY"), "El fallo no identificó el proxy ausente.");
}

async function firstRun(base) {
  const direct = await fetch(`${base}/api/character/demo`);
  assert(direct.status === 426, "El servidor público aceptó HTTP directo.");
  assert(direct.headers.get("set-cookie") === null, "HTTP directo creó una sesión insegura.");

  const demoResponse = await fetch(`${base}/api/character/demo`, {
    headers: { "X-Forwarded-Proto": "https" },
  });
  const cookie = cookieFrom(demoResponse);
  const demo = await expectJson(demoResponse, "Lectura del personaje de prueba");
  const profile = { ...demo.profile, id: characterId, name: characterName };

  await expectJson(
    await fetch(`${base}/api/character`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({ profile }),
    }),
    "Guardado público del expediente",
  );

  await expectJson(
    await fetch(`${base}/api/journal/${characterId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({
        kind: "note",
        title: journalTitle,
        summary: "Comprueba que un reinicio real no borra la memoria del jugador.",
        nextAction: "Reabrir el expediente después del reinicio.",
        relatedItemIds: [],
        sources: [],
        context: {
          characterLevel: null,
          league: profile.league,
          patch: profile.patch,
          budget: null,
          goal: null,
        },
        recommendationSnapshot: null,
        makePrimary: true,
      }),
    }),
    "Guardado público del diario",
  );

  const mentor = await expectJson(
    await fetch(`${base}/api/mentor/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({
        question: mentorQuestion,
        profile,
        budget: { amount: 50, currency: "exalted" },
        goal: { kind: "survival" },
        league: profile.league,
        patch: profile.patch,
      }),
    }),
    "Consulta pública del Mentor",
  );
  await expectJson(
    await fetch(`${base}/api/mentor/thread/${characterId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({
        threadInputsKey: mentorInputsKey,
        turns: [
          { id: "restart-player", role: "player", text: mentorQuestion, answer: null },
          {
            id: "restart-mentor",
            role: "mentor",
            text: mentor.answer.answer,
            answer: mentor.answer,
          },
        ],
      }),
    }),
    "Guardado público del hilo del Mentor",
  );
  return cookie;
}

async function secondRun(base, cookie) {
  const headers = { Cookie: cookie, "X-Forwarded-Proto": "https" };
  const character = await expectJson(
    await fetch(`${base}/api/character/${characterId}`, { headers }),
    "Recuperación del expediente tras reiniciar",
  );
  assert(character.profile?.name === characterName, "El reinicio perdió el expediente.");

  const journal = await expectJson(
    await fetch(`${base}/api/journal/${characterId}`, { headers }),
    "Recuperación del diario tras reiniciar",
  );
  assert(
    journal.entries?.some((entry) => entry.title === journalTitle),
    "El reinicio perdió el diario del jugador.",
  );

  const mentorThread = await expectJson(
    await fetch(`${base}/api/mentor/thread/${characterId}/restore`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ threadInputsKey: mentorInputsKey }),
    }),
    "Recuperación del hilo del Mentor tras reiniciar",
  );
  assert(
    mentorThread.thread?.turns?.some(
      (turn) => turn.role === "mentor" && turn.answer?.answer === turn.text,
    ),
    "El reinicio perdió la conversación estructurada del Mentor.",
  );

  const repeated = await fetch(`${base}/api/character/demo`, { headers });
  assert(repeated.ok, "La sesión recuperada dejó de ser utilizable.");
  assert(repeated.headers.get("set-cookie") === null, "El reinicio sustituyó la sesión válida.");
}

async function run() {
  assert(existsSync(join(root, "dist", "index.html")), "Falta dist/: ejecuta npm run build primero.");
  assert(
    existsSync(join(root, "dist-server", "server", "index.js")),
    "Falta dist-server/: ejecuta npm run build primero.",
  );

  const blockedPort = await openPort();
  await assertUnsafeConfigFailsClosed(blockedPort);

  const port = await openPort();
  const base = `http://127.0.0.1:${port}`;
  const first = launch(port);
  let cookie;
  try {
    await waitForReady(base, first.child, first.output);
    cookie = await firstRun(base);
  } finally {
    await stop(first);
  }

  assert(existsSync(databasePath), "El servidor no creó la SQLite persistente.");
  assert(readFileSync(databasePath).length > 0, "La SQLite persistente está vacía.");

  const second = launch(port);
  try {
    await waitForReady(base, second.child, second.output);
    await secondRun(base, cookie);
  } finally {
    await stop(second);
  }

  console.log("✅ La configuración insegura quedó bloqueada antes de abrir tráfico.");
  console.log("✅ El servidor compilado recuperó cookie, expediente, diario y Mentor tras reiniciar.");
}

try {
  await run();
} finally {
  cleanup();
}
