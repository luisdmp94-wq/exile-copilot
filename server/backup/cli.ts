import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import "../env.js";
import {
  downloadR2Backup,
  listR2Backups,
  loadR2BackupConfig,
  missingR2BackupVariables,
  runR2Backup,
} from "./r2Backup.js";

/**
 * Copia de SQLite en Cloudflare R2, a mano.
 *
 *   npm run backup -- now     hace una copia ahora y la sube
 *   npm run backup -- list    lista las copias del bucket
 *   npm run backup -- check   descarga la última, la abre y cuenta lo que hay
 *   npm run backup -- check --save <ruta>   además la guarda para restaurarla
 *
 * En Render (Shell del servicio): `node dist-server/server/backup/cli.js now`.
 */

const TABLES = ["characters", "journal_entries", "mentor_threads"] as const;

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "list";
  const config = loadR2BackupConfig();
  if (config === null) {
    throw new Error(`Faltan variables: ${missingR2BackupVariables().join(", ")}.`);
  }

  if (command === "now") {
    const databasePath = process.env.DATABASE_PATH ?? "./data/exile-copilot.db";
    const result = await runR2Backup(config, databasePath);
    console.log(`Subida: ${result.key}`);
    console.log(`Tamaño: ${result.bytes} bytes comprimidos (${result.databaseBytes} de base)`);
    console.log(`SHA-256: ${result.sha256}`);
    return;
  }

  const backups = await listR2Backups(config);
  if (command === "list") {
    if (backups.length === 0) console.log("No hay copias en el bucket.");
    for (const backup of backups) {
      console.log(`${backup.lastModified}  ${String(backup.size).padStart(10)}  ${backup.key}`);
    }
    return;
  }

  if (command === "check") {
    const newest = backups[0];
    if (!newest) throw new Error("No hay ninguna copia que comprobar.");
    const database = await downloadR2Backup(config, newest.key);
    const dir = mkdtempSync(join(tmpdir(), "exile-copilot-backup-check-"));
    const path = join(dir, "restaurada.db");
    try {
      writeFileSync(path, database);
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        const integrity = (db.prepare("PRAGMA integrity_check").get() as { integrity_check?: string })
          .integrity_check;
        if (integrity !== "ok") throw new Error(`integrity_check: ${integrity ?? "sin respuesta"}`);
        console.log(`Copia: ${newest.key} (${newest.lastModified})`);
        console.log("✅ integrity_check: ok");
        for (const table of TABLES) {
          const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as {
            total: number;
          };
          console.log(`   ${table}: ${total}`);
        }
      } finally {
        db.close();
      }
      const save = argument("--save");
      if (save) {
        writeFileSync(resolve(save), database, { flag: "wx" });
        console.log(`Guardada en ${resolve(save)} (lista para restaurar, ver docs/DEPLOYMENT.md).`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    return;
  }

  throw new Error(`Orden desconocida: ${command}. Usa now, list o check.`);
}

main().catch((error: unknown) => {
  console.error(`[copia] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
