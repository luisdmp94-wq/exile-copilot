import type { Database } from "./database.js";

/**
 * Repositorios pequeños sobre `price_cache` y `characters`.
 * Sin ORM: SQL estándar y funciones mínimas.
 */

export interface PriceCacheRow {
  key: string;
  league: string;
  category: string;
  payload: string;
  etag: string | null;
  fetched_at: string;
}

export function getCacheEntry(db: Database, key: string): PriceCacheRow | null {
  const row = db
    .prepare(
      "SELECT key, league, category, payload, etag, fetched_at FROM price_cache WHERE key = ?",
    )
    .get(key);
  return (row as PriceCacheRow | undefined) ?? null;
}

export function setCacheEntry(
  db: Database,
  entry: {
    key: string;
    league: string;
    category: string;
    payload: string;
    etag: string | null;
    fetchedAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO price_cache (key, league, category, payload, etag, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       league = excluded.league,
       category = excluded.category,
       payload = excluded.payload,
       etag = excluded.etag,
       fetched_at = excluded.fetched_at`,
  ).run(
    entry.key,
    entry.league,
    entry.category,
    entry.payload,
    entry.etag,
    entry.fetchedAt,
  );
}

/** Refresca solo fetched_at (usado tras un 304 Not Modified). */
export function touchCacheEntry(db: Database, key: string, fetchedAt: string): void {
  db.prepare("UPDATE price_cache SET fetched_at = ? WHERE key = ?").run(
    fetchedAt,
    key,
  );
}

/** Borra una entrada de caché (p. ej. cuando el payload almacenado está corrupto). */
export function deleteCacheEntry(db: Database, key: string): void {
  db.prepare("DELETE FROM price_cache WHERE key = ?").run(key);
}

export interface CharacterRow {
  id: string;
  payload: string;
  updated_at: string;
}

export function saveCharacter(db: Database, id: string, payload: string): void {
  db.prepare(
    `INSERT INTO characters (id, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
  ).run(id, payload, new Date().toISOString());
}

export function getCharacter(db: Database, id: string): CharacterRow | null {
  const row = db
    .prepare("SELECT id, payload, updated_at FROM characters WHERE id = ?")
    .get(id);
  return (row as CharacterRow | undefined) ?? null;
}

export interface JournalEntryRow {
  id: string;
  character_id: string;
  payload: string;
  created_at: string;
  updated_at: string;
}

export function saveJournalEntry(
  db: Database,
  entry: {
    id: string;
    characterId: string;
    payload: string;
    status: string;
    recommendationId: string | null;
    recommendationActionKind: string | null;
    createdAt: string;
    updatedAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO journal_entries (
       id, character_id, payload, status, recommendation_id,
       recommendation_action_kind, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       character_id = excluded.character_id,
       payload = excluded.payload,
       status = excluded.status,
       recommendation_id = excluded.recommendation_id,
       recommendation_action_kind = excluded.recommendation_action_kind,
       updated_at = excluded.updated_at`,
  ).run(
    entry.id,
    entry.characterId,
    entry.payload,
    entry.status,
    entry.recommendationId,
    entry.recommendationActionKind,
    entry.createdAt,
    entry.updatedAt,
  );
}

export function getJournalEntry(db: Database, id: string): JournalEntryRow | null {
  const row = db
    .prepare(
      `SELECT id, character_id, payload, created_at, updated_at
       FROM journal_entries WHERE id = ?`,
    )
    .get(id);
  return (row as JournalEntryRow | undefined) ?? null;
}

export function listJournalEntries(db: Database, characterId: string): JournalEntryRow[] {
  const rows = db
    .prepare(
      `SELECT id, character_id, payload, created_at, updated_at
       FROM journal_entries
       WHERE character_id = ?
       ORDER BY updated_at DESC, created_at DESC, id DESC`,
    )
    .all(characterId);
  return rows as unknown as JournalEntryRow[];
}

/** Lectura acotada usada por el motor: solo resultados de recomendaciones. */
export function listCompletedRecommendationJournalEntries(
  db: Database,
  characterId: string,
  limit: number,
): JournalEntryRow[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const rows = db
    .prepare(
      `SELECT id, character_id, payload, created_at, updated_at
       FROM journal_entries
       WHERE character_id = ?
         AND status = 'completed'
         AND recommendation_id IS NOT NULL
         AND recommendation_action_kind = 'game_change'
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(characterId, safeLimit);
  return rows as unknown as JournalEntryRow[];
}

export function getJournalPrimaryEntryId(db: Database, characterId: string): string | null {
  const row = db
    .prepare("SELECT primary_entry_id FROM journal_state WHERE character_id = ?")
    .get(characterId) as { primary_entry_id: string | null } | undefined;
  return row?.primary_entry_id ?? null;
}

export function setJournalPrimaryEntryId(
  db: Database,
  characterId: string,
  entryId: string | null,
): void {
  db.prepare(
    `INSERT INTO journal_state (character_id, primary_entry_id, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(character_id) DO UPDATE SET
       primary_entry_id = excluded.primary_entry_id,
       updated_at = excluded.updated_at`,
  ).run(characterId, entryId, new Date().toISOString());
}

export function getActiveSessionId(db: Database, characterId: string): string | null {
  const row = db
    .prepare("SELECT active_session_id FROM journal_state WHERE character_id = ?")
    .get(characterId) as { active_session_id: string | null } | undefined;
  return row?.active_session_id ?? null;
}

export function setActiveSessionId(
  db: Database,
  characterId: string,
  sessionId: string | null,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO journal_state (character_id, primary_entry_id, active_session_id, updated_at)
     VALUES (?, NULL, ?, ?)
     ON CONFLICT(character_id) DO UPDATE SET
       active_session_id = excluded.active_session_id,
       updated_at = excluded.updated_at`,
  ).run(characterId, sessionId, now);
}

export interface DecisionSessionRow {
  id: string;
  character_id: string;
  payload: string;
  status: string;
  character_fingerprint: string;
  created_at: string;
  updated_at: string;
}

export function saveDecisionSession(
  db: Database,
  session: {
    id: string;
    characterId: string;
    payload: string;
    status: string;
    characterFingerprint: string;
    createdAt: string;
    updatedAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO decision_sessions (
       id, character_id, payload, status, character_fingerprint, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload,
       status = excluded.status,
       character_fingerprint = excluded.character_fingerprint,
       updated_at = excluded.updated_at`,
  ).run(
    session.id,
    session.characterId,
    session.payload,
    session.status,
    session.characterFingerprint,
    session.createdAt,
    session.updatedAt,
  );
}

export function getDecisionSession(db: Database, id: string): DecisionSessionRow | null {
  const row = db
    .prepare(
      `SELECT id, character_id, payload, status, character_fingerprint, created_at, updated_at
       FROM decision_sessions WHERE id = ?`,
    )
    .get(id);
  return (row as DecisionSessionRow | undefined) ?? null;
}

export function listDecisionSessions(
  db: Database,
  characterId: string,
  limit: number,
): DecisionSessionRow[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 20));
  const rows = db
    .prepare(
      `SELECT id, character_id, payload, status, character_fingerprint, created_at, updated_at
       FROM decision_sessions
       WHERE character_id = ?
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(characterId, safeLimit);
  return rows as unknown as DecisionSessionRow[];
}

export function getEventByIdempotencyKey(
  db: Database,
  idempotencyKey: string,
): {
  payload: string;
  character_id: string;
  operation: string | null;
  request_fingerprint: string | null;
} | null {
  const row = db
    .prepare(
      `SELECT payload, character_id, operation, request_fingerprint
       FROM decision_session_events WHERE idempotency_key = ?`,
    )
    .get(idempotencyKey);
  return (
    (row as
      | {
          payload: string;
          character_id: string;
          operation: string | null;
          request_fingerprint: string | null;
        }
      | undefined) ?? null
  );
}

/** Sesiones más antiguas que sobran al aplicar la retención máxima. */
export function listDecisionSessionIdsBeyond(
  db: Database,
  characterId: string,
  keep: number,
): string[] {
  const safeKeep = Math.max(0, Math.trunc(keep));
  const rows = db
    .prepare(
      `SELECT id FROM decision_sessions
       WHERE character_id = ?
       ORDER BY updated_at DESC, created_at DESC, id DESC
       LIMIT -1 OFFSET ?`,
    )
    .all(characterId, safeKeep);
  return (rows as unknown as Array<{ id: string }>).map((row) => row.id);
}

/** Borra una sesión y su historial. Solo lo usa la retención documentada. */
export function deleteDecisionSession(db: Database, sessionId: string): void {
  db.prepare(`DELETE FROM decision_session_events WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM decision_sessions WHERE id = ?`).run(sessionId);
}

export function countSessionEvents(db: Database, sessionId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM decision_session_events WHERE session_id = ?`)
    .get(sessionId) as { n: number | bigint } | undefined;
  return Number(row?.n ?? 0);
}

export function saveDecisionSessionEvent(
  db: Database,
  event: {
    id: string;
    sessionId: string;
    characterId: string;
    idempotencyKey: string;
    payload: string;
    createdAt: string;
    operation: string;
    requestFingerprint: string;
  },
): void {
  db.prepare(
    `INSERT INTO decision_session_events (
       id, session_id, character_id, idempotency_key, payload, created_at,
       operation, request_fingerprint
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.id,
    event.sessionId,
    event.characterId,
    event.idempotencyKey,
    event.payload,
    event.createdAt,
    event.operation,
    event.requestFingerprint,
  );
}

export function listDecisionSessionEvents(
  db: Database,
  sessionId: string,
  limit: number,
): Array<{ payload: string }> {
  // 42 = tope de material (40) más la reserva de cierre (2).
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 42));
  const rows = db
    .prepare(
      `SELECT payload FROM decision_session_events
       WHERE session_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
    )
    .all(sessionId, safeLimit);
  return rows as unknown as Array<{ payload: string }>;
}
