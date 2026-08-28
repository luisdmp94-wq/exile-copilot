import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Express } from "express";
import {
  CharacterJournalSchema,
  CharacterProfileSchema,
} from "../shared/domain.js";
import { closeApiApp, createApiApp } from "../server/app.js";

const TEMP_PREFIX = "exile-copilot-restore-drill-";
const tempRoot = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
const sourcePath = join(tempRoot, "source.db");
const backupPath = join(tempRoot, "backup.db");
const restoredPath = join(tempRoot, "restored.db");
const characterId = "restore-drill-character";
const characterName = "Expediente restaurado";
const journalTitle = "Decisión conservada tras la copia";

const runtimeConfig = {
  nodeEnv: "production",
  secureCookies: true,
  poeNinjaOffline: true,
  mentorAiEnabled: false,
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function start(app: Express): Promise<{ server: Server; base: string }> {
  const server = await new Promise<Server>((resolveServer) => {
    const candidate = app.listen(0, "127.0.0.1", () => resolveServer(candidate));
  });
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${port}` };
}

async function stop(server: Server, app: Express): Promise<void> {
  try {
    await new Promise<void>((resolveServer, reject) =>
      server.close((error) => (error ? reject(error) : resolveServer())),
    );
  } finally {
    assert(closeApiApp(app), "SQLite no se cerró al detener la instancia del simulacro.");
  }
}

async function expectJson(response: Response, operation: string): Promise<unknown> {
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${operation} falló con HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }
  return JSON.parse(raw) as unknown;
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert(setCookie, "La instancia no creó una sesión anónima para el simulacro.");
  const cookie = setCookie.split(";", 1)[0];
  assert(cookie, "La cookie anónima del simulacro está vacía.");
  return cookie;
}

function copyDatabaseSet(from: string, to: string): string[] {
  const copied: string[] = [];
  for (const suffix of ["", "-wal", "-shm"] as const) {
    const source = `${from}${suffix}`;
    if (!existsSync(source)) continue;
    copyFileSync(source, `${to}${suffix}`);
    copied.push(suffix || "database");
  }
  return copied;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertIntegrity(path: string): void {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const result = database.prepare("PRAGMA integrity_check").all() as unknown as Array<{
      integrity_check?: string;
    }>;
    assert(
      result.length === 1 && result[0]?.integrity_check === "ok",
      "PRAGMA integrity_check no aprobó la copia restaurada.",
    );
  } finally {
    database.close();
  }
}

function cleanup(): void {
  const absoluteRoot = resolve(tempRoot);
  const absoluteTemp = resolve(tmpdir());
  const safe =
    absoluteRoot !== absoluteTemp &&
    absoluteRoot.startsWith(`${absoluteTemp}${sep}`) &&
    basename(absoluteRoot).startsWith(TEMP_PREFIX);
  if (!safe) {
    throw new Error(`Limpieza bloqueada para una ruta no reconocida: ${absoluteRoot}`);
  }
  rmSync(absoluteRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function run(): Promise<void> {
  const sourceApp = createApiApp({ dbPath: sourcePath, config: runtimeConfig });
  const source = await start(sourceApp);
  let cookie = "";
  try {
    const healthResponse = await fetch(`${source.base}/health`);
    await expectJson(healthResponse, "Salud de la instancia origen");
    cookie = cookieFrom(healthResponse);

    const demo = (await expectJson(
      await fetch(`${source.base}/character/demo`, { headers: { Cookie: cookie } }),
      "Lectura del personaje de prueba",
    )) as { profile?: unknown };
    const profile = CharacterProfileSchema.parse({
      ...CharacterProfileSchema.parse(demo.profile),
      id: characterId,
      name: characterName,
    });
    await expectJson(
      await fetch(`${source.base}/character`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ profile }),
      }),
      "Guardado del expediente de prueba",
    );
    await expectJson(
      await fetch(`${source.base}/journal/${characterId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          kind: "note",
          title: journalTitle,
          summary: "Esta entrada demuestra que la memoria persistente sobrevive a una restauración.",
          nextAction: "Comprobar la copia antes de admitir tráfico.",
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
      "Guardado del diario de prueba",
    );
  } finally {
    await stop(source.server, sourceApp);
  }

  const backupFiles = copyDatabaseSet(sourcePath, backupPath);
  assert(backupFiles.includes("database"), "La copia no contiene el archivo principal de SQLite.");
  assert(statSync(backupPath).size > 0, "La copia principal está vacía.");
  const backupHash = sha256(backupPath);

  const restoredFiles = copyDatabaseSet(backupPath, restoredPath);
  assert(restoredFiles.includes("database"), "La restauración no copió el archivo principal.");
  assert(sha256(restoredPath) === backupHash, "La copia restaurada difiere del respaldo.");
  assertIntegrity(restoredPath);

  const restoredApp = createApiApp({ dbPath: restoredPath, config: runtimeConfig });
  const restored = await start(restoredApp);
  try {
    const ready = await fetch(`${restored.base}/ready`, { headers: { Cookie: cookie } });
    const readyBody = (await expectJson(ready, "Disponibilidad de la instancia restaurada")) as {
      status?: unknown;
    };
    assert(readyBody.status === "ready", "La instancia restaurada no quedó disponible.");

    const characterBody = (await expectJson(
      await fetch(`${restored.base}/character/${characterId}`, {
        headers: { Cookie: cookie },
      }),
      "Recuperación del expediente",
    )) as { profile?: unknown };
    const restoredProfile = CharacterProfileSchema.parse(characterBody.profile);
    assert(restoredProfile.name === characterName, "El expediente restaurado no coincide.");

    const journal = CharacterJournalSchema.parse(
      await expectJson(
        await fetch(`${restored.base}/journal/${characterId}`, {
          headers: { Cookie: cookie },
        }),
        "Recuperación del diario",
      ),
    );
    assert(journal.primaryEntry?.title === journalTitle, "El diario restaurado no coincide.");
  } finally {
    await stop(restored.server, restoredApp);
  }

  console.log("✅ SQLite restaurada con integridad, expediente, sesión y diario verificables.");
  console.log(`✅ Simulacro aislado: ${backupFiles.length} archivo(s) copiado(s), sin usar datos reales.`);
}

try {
  await run();
} finally {
  cleanup();
}
