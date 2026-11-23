import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import { sha256Hex, signS3Request, type S3Credentials } from "./s3Signature.js";

/**
 * Copia nocturna de SQLite a Cloudflare R2.
 *
 * El disco de Render solo lo puede leer este mismo servicio, así que la copia
 * se hace desde dentro: `VACUUM INTO` genera un archivo consistente aunque la
 * web siga escribiendo (WAL), se comprueba con `integrity_check`, se comprime
 * y se sube a R2 con la API S3. Nunca se registra la clave ni el contenido.
 */

export interface R2BackupConfig {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Hora UTC de la copia diaria (0-23). */
  hourUtc: number;
  /** Carpeta dentro del bucket. */
  prefix: string;
  /** Solo para tests: otro servidor compatible con S3. */
  endpoint: string;
}

export interface BackupObject {
  key: string;
  size: number;
  lastModified: string;
}

export interface BackupResult {
  key: string;
  bytes: number;
  databaseBytes: number;
  sha256: string;
}

const ENV = {
  accountId: "R2_BACKUP_ACCOUNT_ID",
  bucket: "R2_BACKUP_BUCKET",
  accessKeyId: "R2_BACKUP_ACCESS_KEY_ID",
  secretAccessKey: "R2_BACKUP_SECRET_ACCESS_KEY",
} as const;

/**
 * Lee la configuración del entorno. `null` si falta alguna de las cuatro
 * variables: la web funciona igual, solo que sin copia nocturna.
 */
export function loadR2BackupConfig(
  env: NodeJS.ProcessEnv = process.env,
): R2BackupConfig | null {
  const values = Object.fromEntries(
    Object.entries(ENV).map(([field, name]) => [field, env[name]?.trim() ?? ""]),
  ) as Record<keyof typeof ENV, string>;
  if (Object.values(values).some((value) => value.length === 0)) return null;
  if (!/^[a-f0-9]{32}$/i.test(values.accountId)) {
    throw new Error(`${ENV.accountId} debe ser el id de cuenta de Cloudflare (32 caracteres hex).`);
  }
  const hour = Number.parseInt(env.BACKUP_HOUR_UTC ?? "3", 10);
  return {
    ...values,
    hourUtc: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 3,
    prefix: "exile-copilot/",
    endpoint: env.R2_BACKUP_ENDPOINT?.trim() || `https://${values.accountId}.r2.cloudflarestorage.com`,
  };
}

/** Variables que faltan, para explicarlo en el registro sin enseñar valores. */
export function missingR2BackupVariables(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.values(ENV).filter((name) => !(env[name]?.trim()));
}

function credentials(config: R2BackupConfig): S3Credentials {
  return {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: "auto",
  };
}

function objectUrl(config: R2BackupConfig, key = ""): URL {
  const base = config.endpoint.replace(/\/+$/, "");
  const path = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`${base}/${encodeURIComponent(config.bucket)}${key ? `/${path}` : ""}`);
}

async function send(
  config: R2BackupConfig,
  method: "GET" | "PUT",
  url: URL,
  body?: Buffer,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const payload = body ?? Buffer.alloc(0);
  const headers = signS3Request({
    method,
    url,
    headers: extraHeaders,
    payloadSha256: sha256Hex(payload),
    credentials: credentials(config),
    now: new Date(),
  });
  const response = await fetch(url, {
    method,
    headers,
    ...(method === "PUT" ? { body: payload } : {}),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    // El cuerpo de error de S3 es XML con un código; no contiene la clave.
    const text = await response.text().catch(() => "");
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? "sin código";
    throw new Error(`R2 respondió ${response.status} (${code}) a ${method} ${url.pathname}`);
  }
  return response;
}

/**
 * Copia consistente de la base, comprobada y comprimida. Abre su propia
 * conexión: no toca la que usa la web.
 */
export function snapshotDatabase(databasePath: string): { gzip: Buffer; databaseBytes: number } {
  // Abrir una ruta que no existe crea una base vacía, que pasa integrity_check
  // y se subiría como si fuera una copia buena.
  if (!existsSync(databasePath)) throw new Error(`No existe la base de datos en ${databasePath}: no hay nada que copiar.`);
  const dir = mkdtempSync(join(tmpdir(), "exile-copilot-backup-"));
  const target = join(dir, "copia.db");
  try {
    const source = new DatabaseSync(databasePath);
    try {
      source.exec("PRAGMA busy_timeout = 5000;");
      source.prepare("VACUUM INTO ?").run(target);
    } finally {
      source.close();
    }
    const copy = new DatabaseSync(target, { readOnly: true });
    try {
      const row = copy.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
      if (row?.integrity_check !== "ok") {
        throw new Error(`La copia no supera integrity_check: ${row?.integrity_check ?? "sin respuesta"}`);
      }
    } finally {
      copy.close();
    }
    const raw = readFileSync(target);
    return { gzip: gzipSync(raw, { level: 9 }), databaseBytes: raw.length };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function backupKey(config: R2BackupConfig, now: Date): string {
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  return `${config.prefix}exile-copilot-${stamp}.db.gz`;
}

/** Hace una copia y la sube. Devuelve qué se subió. */
export async function runR2Backup(
  config: R2BackupConfig,
  databasePath: string,
  now: Date = new Date(),
): Promise<BackupResult> {
  const { gzip, databaseBytes } = snapshotDatabase(databasePath);
  const key = backupKey(config, now);
  await send(config, "PUT", objectUrl(config, key), gzip, {
    "content-type": "application/gzip",
  });
  return { key, bytes: gzip.length, databaseBytes, sha256: sha256Hex(gzip) };
}

function xmlValue(block: string, tag: string): string | null {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block)?.[1] ?? null;
}

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Copias que hay en el bucket, de la más nueva a la más antigua. */
export async function listR2Backups(config: R2BackupConfig): Promise<BackupObject[]> {
  const objects: BackupObject[] = [];
  let token: string | null = null;
  do {
    const url = objectUrl(config);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", config.prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const xml = await (await send(config, "GET", url)).text();
    for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = match[1]!;
      const key = xmlValue(block, "Key");
      if (key === null) continue;
      objects.push({
        key: xmlDecode(key),
        size: Number(xmlValue(block, "Size") ?? 0),
        lastModified: xmlValue(block, "LastModified") ?? "",
      });
    }
    token = xmlValue(xml, "IsTruncated") === "true" ? xmlValue(xml, "NextContinuationToken") : null;
  } while (token);
  return objects.sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** Descarga una copia y devuelve la base SQLite ya descomprimida. */
export async function downloadR2Backup(config: R2BackupConfig, key: string): Promise<Buffer> {
  const response = await send(config, "GET", objectUrl(config, key));
  return gunzipSync(Buffer.from(await response.arrayBuffer()));
}

/** Milisegundos hasta la próxima hora UTC indicada. */
export function msUntilNextRun(now: Date, hourUtc: number): number {
  const next = new Date(now);
  next.setUTCHours(hourUtc, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/** Margen por si el reloj de R2 y el del servidor no van al segundo. */
const CATCH_UP_TOLERANCE_MS = 5 * 60_000;

/**
 * ¿Falta la copia de la última hora programada? Se compara con esa hora, no
 * con «hace 25 horas»: si el servicio se reinicia justo a la hora de la copia
 * (un despliegue a las 3:00), la de ayer tiene 24 horas y con el umbral de 25
 * se daba por reciente; el día se quedaba sin copia.
 */
export function needsCatchUp(newestLastModified: string | undefined, now: Date, hourUtc: number): boolean {
  if (newestLastModified === undefined) return true;
  const newest = Date.parse(newestLastModified);
  if (Number.isNaN(newest)) return true;
  const lastDue = new Date(now);
  lastDue.setUTCHours(hourUtc, 0, 0, 0);
  if (lastDue.getTime() > now.getTime()) lastDue.setUTCDate(lastDue.getUTCDate() - 1);
  return newest < lastDue.getTime() - CATCH_UP_TOLERANCE_MS;
}

export interface NightlyBackupHandle {
  stop(): void;
}

/**
 * Programa la copia diaria. Además, poco después de arrancar mira si falta la
 * copia de la última hora programada (un reinicio justo a la hora de la copia
 * no debe saltarse un día) y, si es así, hace una enseguida.
 */
export function startNightlyR2Backup(
  config: R2BackupConfig,
  databasePath: string,
  log: Pick<Console, "log" | "warn"> = console,
  catchUpDelayMs = 2 * 60_000,
): NightlyBackupHandle {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let stopped = false;

  const run = async (reason: string) => {
    if (running || stopped) return;
    running = true;
    try {
      const result = await runR2Backup(config, databasePath);
      log.log(
        `[copia] ${reason}: subida ${result.key} (${result.bytes} bytes comprimidos, ` +
          `${result.databaseBytes} de base, sha256 ${result.sha256.slice(0, 12)})`,
      );
    } catch (error) {
      log.warn(
        `[copia] ${reason}: FALLÓ — ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      void run("copia nocturna").finally(schedule);
    }, msUntilNextRun(new Date(), config.hourUtc));
    timer.unref();
  };

  const catchUp = setTimeout(() => {
    void (async () => {
      try {
        const newest = (await listR2Backups(config))[0];
        if (needsCatchUp(newest?.lastModified, new Date(), config.hourUtc)) await run("copia de recuperación al arrancar");
      } catch (error) {
        log.warn(
          `[copia] no se pudo mirar la última copia: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();
  }, catchUpDelayMs);
  catchUp.unref();

  schedule();
  log.log(`[copia] copia nocturna a R2 activada: cada día a las ${config.hourUtc}:00 UTC`);
  return {
    stop() {
      stopped = true;
      clearTimeout(catchUp);
      if (timer) clearTimeout(timer);
    },
  };
}
