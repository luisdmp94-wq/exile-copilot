import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Conexión SQLite con `node:sqlite` (DatabaseSync, integrado en Node 24).
 * Soporta ":memory:" para tests. SQL estándar pensado para migrar a PostgreSQL.
 */

export type Database = DatabaseSync;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS price_cache (
  key TEXT PRIMARY KEY,
  league TEXT NOT NULL,
  category TEXT NOT NULL,
  payload TEXT NOT NULL,
  etag TEXT,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT,
  recommendation_id TEXT,
  recommendation_action_kind TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS journal_entries_character_updated
  ON journal_entries(character_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS journal_state (
  character_id TEXT PRIMARY KEY,
  primary_entry_id TEXT,
  updated_at TEXT NOT NULL
);
`;

export function createDatabase(dbPath: string): Database {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  applySchema(db);
  return db;
}

/** Creación de esquema idempotente. */
export function applySchema(db: Database): void {
  db.exec(SCHEMA_SQL);
  const columns = db.prepare("PRAGMA table_info(journal_entries)").all() as unknown as Array<{
    name: string;
  }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("status")) {
    db.exec("ALTER TABLE journal_entries ADD COLUMN status TEXT");
  }
  if (!names.has("recommendation_id")) {
    db.exec("ALTER TABLE journal_entries ADD COLUMN recommendation_id TEXT");
  }
  if (!names.has("recommendation_action_kind")) {
    db.exec("ALTER TABLE journal_entries ADD COLUMN recommendation_action_kind TEXT");
  }

  // Migración aditiva: conserva cada payload y deriva únicamente columnas de
  // índice para las entradas anteriores al Hito 5B.
  db.exec(`
    UPDATE journal_entries
       SET status = COALESCE(status, json_extract(payload, '$.status')),
           recommendation_id = COALESCE(
             recommendation_id,
             json_extract(payload, '$.recommendationSnapshot.id')
           ),
           recommendation_action_kind = COALESCE(
             recommendation_action_kind,
             json_extract(payload, '$.recommendationSnapshot.actionKind'),
             CASE
               WHEN json_extract(payload, '$.recommendationSnapshot.id') IS NOT NULL
               THEN 'game_change'
               ELSE NULL
             END
           )
     WHERE json_valid(payload) = 1;
    CREATE INDEX IF NOT EXISTS journal_entries_character_status_updated
      ON journal_entries(character_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS journal_entries_character_memory_updated
      ON journal_entries(
        character_id,
        status,
        recommendation_action_kind,
        updated_at DESC
      );
  `);
}
