import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  downloadR2Backup,
  listR2Backups,
  loadR2BackupConfig,
  missingR2BackupVariables,
  msUntilNextRun,
  needsCatchUp,
  runR2Backup,
  snapshotDatabase,
  startNightlyR2Backup,
  type R2BackupConfig,
} from "../../server/backup/r2Backup.js";
import { sha256Hex, signS3Request } from "../../server/backup/s3Signature.js";
import { createDatabase } from "../../server/db/database.js";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const SECRET = "secreto-de-prueba-que-nunca-sale-en-el-registro";

/** R2 falso: comprueba la firma igual que lo haría R2 y guarda en memoria. */
function fakeR2(): { server: Server; objects: Map<string, Buffer>; rejected: string[] } {
  const objects = new Map<string, Buffer>();
  const rejected: string[] = [];
  const server = createServer(async (req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const amzDate = String(req.headers["x-amz-date"] ?? "");
    const payloadHash = String(req.headers["x-amz-content-sha256"] ?? "");
    const signedNames =
      /SignedHeaders=([^,]+)/.exec(String(req.headers.authorization ?? ""))?.[1]?.split(";") ?? [];
    const extra: Record<string, string> = {};
    for (const name of signedNames) {
      if (!["host", "x-amz-date", "x-amz-content-sha256"].includes(name)) {
        extra[name] = String(req.headers[name] ?? "");
      }
    }
    const date = new Date(
      `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T` +
        `${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`,
    );
    const expected = signS3Request({
      method: req.method as "GET" | "PUT",
      url,
      headers: extra,
      payloadSha256: payloadHash,
      credentials: { accessKeyId: "clave-id", secretAccessKey: SECRET, region: "auto" },
      now: date,
    }).authorization;
    if (req.headers.authorization !== expected || sha256Hex(body) !== payloadHash) {
      rejected.push(`${req.method} ${url.pathname}`);
      res.writeHead(403).end("<Error><Code>SignatureDoesNotMatch</Code></Error>");
      return;
    }
    const [, bucket, ...rest] = decodeURIComponent(url.pathname).split("/");
    const key = rest.join("/");
    if (bucket !== "copias") {
      res.writeHead(404).end("<Error><Code>NoSuchBucket</Code></Error>");
      return;
    }
    if (req.method === "PUT") {
      objects.set(key, body);
      res.writeHead(200).end();
    } else if (key === "" && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const contents = [...objects.entries()]
        .filter(([candidate]) => candidate.startsWith(prefix))
        .map(
          ([candidate, data]) =>
            `<Contents><Key>${candidate}</Key><Size>${data.length}</Size>` +
            `<LastModified>${new Date().toISOString()}</LastModified></Contents>`,
        )
        .join("");
      res
        .writeHead(200, { "content-type": "application/xml" })
        .end(`<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`);
    } else if (objects.has(key)) {
      res.writeHead(200).end(objects.get(key));
    } else {
      res.writeHead(404).end("<Error><Code>NoSuchKey</Code></Error>");
    }
  });
  return { server, objects, rejected };
}

describe("copia nocturna de SQLite a Cloudflare R2", () => {
  const r2 = fakeR2();
  let config: R2BackupConfig;
  let dir: string;
  let databasePath: string;
  let live: DatabaseSync;

  beforeAll(async () => {
    await new Promise<void>((resolve) => r2.server.listen(0, "127.0.0.1", resolve));
    const { port } = r2.server.address() as AddressInfo;
    config = loadR2BackupConfig({
      R2_BACKUP_ACCOUNT_ID: ACCOUNT,
      R2_BACKUP_BUCKET: "copias",
      R2_BACKUP_ACCESS_KEY_ID: "clave-id",
      R2_BACKUP_SECRET_ACCESS_KEY: SECRET,
      R2_BACKUP_ENDPOINT: `http://127.0.0.1:${port}`,
    })!;
    dir = mkdtempSync(join(tmpdir(), "exile-copilot-r2-test-"));
    databasePath = join(dir, "web.db");
    // La web deja la base abierta en WAL mientras se copia.
    live = createDatabase(databasePath);
    live
      .prepare("INSERT INTO characters (id, owner_id, payload, updated_at) VALUES (?, ?, ?, ?)")
      .run("pj-1", "dueño", '{"name":"Exiliada"}', "2026-11-23T00:00:00Z");
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => r2.server.close(() => resolve()));
    live.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("sin las cuatro variables no se activa y dice cuáles faltan", () => {
    expect(loadR2BackupConfig({ R2_BACKUP_BUCKET: "copias" })).toBeNull();
    expect(missingR2BackupVariables({ R2_BACKUP_BUCKET: "copias" })).toEqual([
      "R2_BACKUP_ACCOUNT_ID",
      "R2_BACKUP_ACCESS_KEY_ID",
      "R2_BACKUP_SECRET_ACCESS_KEY",
    ]);
    expect(() =>
      loadR2BackupConfig({
        R2_BACKUP_ACCOUNT_ID: "no-es-un-id",
        R2_BACKUP_BUCKET: "copias",
        R2_BACKUP_ACCESS_KEY_ID: "a",
        R2_BACKUP_SECRET_ACCESS_KEY: "b",
      }),
    ).toThrow(/32 caracteres/);
    expect(config.endpoint).toMatch(/^http:\/\/127\.0\.0\.1/);
    expect(
      loadR2BackupConfig({
        R2_BACKUP_ACCOUNT_ID: ACCOUNT,
        R2_BACKUP_BUCKET: "copias",
        R2_BACKUP_ACCESS_KEY_ID: "a",
        R2_BACKUP_SECRET_ACCESS_KEY: "b",
      })?.endpoint,
    ).toBe(`https://${ACCOUNT}.r2.cloudflarestorage.com`);
  });

  it("sube una copia firmada, la lista y al bajarla tiene los datos de la web", async () => {
    const result = await runR2Backup(config, databasePath, new Date("2026-11-23T03:00:00Z"));
    expect(result.key).toBe("exile-copilot/exile-copilot-2026-11-23T03-00-00Z.db.gz");
    expect(r2.rejected).toEqual([]);

    const listed = await listR2Backups(config);
    expect(listed.map((entry) => entry.key)).toEqual([result.key]);
    expect(listed[0]!.size).toBe(result.bytes);

    const restoredPath = join(dir, "restaurada.db");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(restoredPath, await downloadR2Backup(config, result.key));
    const restored = new DatabaseSync(restoredPath, { readOnly: true });
    try {
      expect(restored.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
      expect(restored.prepare("SELECT payload FROM characters WHERE id = 'pj-1'").get()).toEqual({
        payload: '{"name":"Exiliada"}',
      });
    } finally {
      restored.close();
    }
  });

  it("una clave equivocada falla sin enseñar el secreto", async () => {
    const wrong = { ...config, secretAccessKey: "otra" };
    const error = await runR2Backup(wrong, databasePath).catch((caught: unknown) => caught);
    expect(String(error)).toMatch(/403 \(SignatureDoesNotMatch\)/);
    expect(String(error)).not.toContain("otra");
    r2.rejected.length = 0;
  });

  it("al arrancar sin copias recientes hace una enseguida", async () => {
    r2.objects.clear();
    const lines: string[] = [];
    const log = { log: (line: string) => lines.push(line), warn: (line: string) => lines.push(line) };
    const handle = startNightlyR2Backup(config, databasePath, log, 0);
    try {
      await expect.poll(() => r2.objects.size, { timeout: 5_000 }).toBe(1);
      await expect.poll(() => lines.some((line) => line.includes("copia de recuperación"))).toBe(true);
      expect(lines.join("\n")).not.toContain(SECRET);
    } finally {
      handle.stop();
    }
  });

  it("calcula la espera hasta la próxima hora UTC", () => {
    expect(msUntilNextRun(new Date("2026-11-23T02:30:00Z"), 3)).toBe(30 * 60_000);
    expect(msUntilNextRun(new Date("2026-11-23T03:00:00Z"), 3)).toBe(24 * 3_600_000);
  });

  it("un reinicio justo a la hora de la copia no se salta el día", () => {
    // Copia de ayer a las 3:00; el servicio se reinicia hoy a las 3:00:10 y mira a las 3:02.
    const yesterday = "2026-11-22T03:00:06Z";
    expect(needsCatchUp(yesterday, new Date("2026-11-23T03:02:10Z"), 3)).toBe(true);
    // Con la copia de hoy ya hecha, un reinicio a mediodía no hace otra.
    expect(needsCatchUp("2026-11-23T03:00:06Z", new Date("2026-11-23T12:00:00Z"), 3)).toBe(false);
    // Antes de la hora de hoy, la de ayer vale: la de hoy la hará el temporizador.
    expect(needsCatchUp(yesterday, new Date("2026-11-23T02:00:00Z"), 3)).toBe(false);
    // Unos segundos de diferencia entre relojes no cuentan como copia que falta.
    expect(needsCatchUp("2026-11-23T02:59:58Z", new Date("2026-11-23T12:00:00Z"), 3)).toBe(false);
    // Sin copias, o con una fecha ilegible, se hace.
    expect(needsCatchUp(undefined, new Date("2026-11-23T12:00:00Z"), 3)).toBe(true);
    expect(needsCatchUp("no es una fecha", new Date("2026-11-23T12:00:00Z"), 3)).toBe(true);
  });

  it("no sube una base vacía si la ruta no existe", () => {
    const missing = join(tmpdir(), "exile-copilot-no-existe", "nada.db");
    expect(() => snapshotDatabase(missing)).toThrow(/No existe la base de datos/);
  });
});
