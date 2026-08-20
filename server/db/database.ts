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
}
