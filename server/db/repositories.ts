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
