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
  //
  // El UPDATE se limita a las filas a las que les FALTA algún metadato: sin
  // ese filtro reescribía todas las filas válidas en cada arranque. Como
  // `recommendationSnapshot` siempre trae `id` (RecommendationSchema lo exige)
  // y `recommendation_action_kind` tiene respaldo 'game_change', una sola
  // pasada deja la fila completa y las siguientes no la seleccionan.
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
     WHERE json_valid(payload) = 1
       AND (
         status IS NULL
         OR (
           json_extract(payload, '$.recommendationSnapshot.id') IS NOT NULL
           AND recommendation_id IS NULL
         )
         OR (
           json_extract(payload, '$.recommendationSnapshot.id') IS NOT NULL
           AND recommendation_action_kind IS NULL
         )
       );
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
  applyDecisionSessionSchema(db);
  applyBuildMemorySchema(db);
}

function applyBuildMemorySchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS build_memory_entries (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      active INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS build_memory_character_active_updated
      ON build_memory_entries(character_id, active, updated_at DESC, id DESC);
  `);
}

function applyDecisionSessionSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decision_sessions (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      character_fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS decision_sessions_character_updated
      ON decision_sessions(character_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS decision_session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS decision_session_events_session_created
      ON decision_session_events(session_id, created_at ASC, id ASC);
  `);
  const stateColumns = db.prepare("PRAGMA table_info(journal_state)").all() as unknown as Array<{
    name: string;
  }>;
  const stateNames = new Set(stateColumns.map((column) => column.name));
  if (!stateNames.has("active_session_id")) {
    db.exec("ALTER TABLE journal_state ADD COLUMN active_session_id TEXT");
  }

  /*
   * Migración ADITIVA: la idempotencia se liga a la operación concreta. Una
   * clave reutilizada con otra ruta o con otro payload debe dar 409, no un
   * éxito silencioso que devolvería el resultado de una operación distinta.
   * Las filas antiguas quedan con NULL y se tratan como «sin huella conocida».
   */
  const eventColumns = db
    .prepare("PRAGMA table_info(decision_session_events)")
    .all() as unknown as Array<{ name: string }>;
  const eventNames = new Set(eventColumns.map((column) => column.name));
  if (!eventNames.has("operation")) {
    db.exec("ALTER TABLE decision_session_events ADD COLUMN operation TEXT");
  }
  if (!eventNames.has("request_fingerprint")) {
    db.exec("ALTER TABLE decision_session_events ADD COLUMN request_fingerprint TEXT");
  }
}

export function withTransaction<T>(db: Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // rollback failed because the transaction already aborted
    }
    throw error;
  }
}
