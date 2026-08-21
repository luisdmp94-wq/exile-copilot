import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { applySchema } from "../../server/db/database.js";
import {
  listCompletedRecommendationJournalEntries,
  saveJournalEntry,
} from "../../server/db/repositories.js";

describe("migración aditiva del Character Journal", () => {
  it("conserva payloads 5A y rellena columnas indexables sin borrar entradas", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE journal_entries (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const payload = JSON.stringify({
        id: "legacy-entry",
        status: "completed",
        recommendationSnapshot: { id: "rec-resistencias-elementales" },
      });
      db.prepare(
        `INSERT INTO journal_entries
          (id, character_id, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        "legacy-entry",
        "legacy-character",
        payload,
        "2026-08-20T10:00:00.000Z",
        "2026-08-20T10:01:00.000Z",
      );

      applySchema(db);

      const columns = db.prepare("PRAGMA table_info(journal_entries)").all() as unknown as Array<{
        name: string;
      }>;
      expect(columns.map((column) => column.name)).toEqual(
        expect.arrayContaining([
          "status",
          "recommendation_id",
          "recommendation_action_kind",
        ]),
      );
      const rows = listCompletedRecommendationJournalEntries(
        db,
        "legacy-character",
        10,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.payload).toBe(payload);
      expect(
        db.prepare(
          "SELECT recommendation_action_kind FROM journal_entries WHERE id = ?",
        ).get("legacy-entry"),
      ).toEqual({ recommendation_action_kind: "game_change" });

      saveJournalEntry(db, {
        id: "profile-sync-entry",
        characterId: "legacy-character",
        payload: JSON.stringify({
          id: "profile-sync-entry",
          recommendationSnapshot: {
            id: "rec-memoria-resistencias-elementales",
            actionKind: "profile_sync",
          },
        }),
        status: "completed",
        recommendationId: "rec-memoria-resistencias-elementales",
        recommendationActionKind: "profile_sync",
        createdAt: "2026-08-21T10:00:00.000Z",
        updatedAt: "2026-08-21T10:01:00.000Z",
      });
      expect(
        listCompletedRecommendationJournalEntries(db, "legacy-character", 10),
      ).toHaveLength(1);
      expect(
        db.prepare("SELECT COUNT(*) AS total FROM journal_entries").get(),
      ).toEqual({ total: 2 });
    } finally {
      db.close();
    }
  });

  it("una segunda ejecución no reescribe filas ya completas", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE journal_entries (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const conSnapshot = JSON.stringify({
        id: "legacy-con-snapshot",
        status: "completed",
        recommendationSnapshot: { id: "rec-mejora-arma" },
      });
      const sinSnapshot = JSON.stringify({ id: "legacy-nota", status: "active" });
      const insert = db.prepare(
        `INSERT INTO journal_entries
          (id, character_id, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      insert.run(
        "legacy-con-snapshot",
        "legacy-character",
        conSnapshot,
        "2026-08-20T10:00:00.000Z",
        "2026-08-20T10:01:00.000Z",
      );
      insert.run(
        "legacy-nota",
        "legacy-character",
        sinSnapshot,
        "2026-08-20T11:00:00.000Z",
        "2026-08-20T11:01:00.000Z",
      );

      // Primera pasada: rellena los metadatos que faltaban.
      applySchema(db);
      const trasPrimera = db
        .prepare(
          `SELECT id, payload, status, recommendation_id, recommendation_action_kind
             FROM journal_entries ORDER BY id`,
        )
        .all();
      expect(trasPrimera).toEqual([
        {
          id: "legacy-con-snapshot",
          payload: conSnapshot,
          status: "completed",
          recommendation_id: "rec-mejora-arma",
          recommendation_action_kind: "game_change",
        },
        {
          id: "legacy-nota",
          payload: sinSnapshot,
          status: "active",
          recommendation_id: null,
          recommendation_action_kind: null,
        },
      ]);

      // Segunda pasada: no debe tocar ninguna fila. total_changes() cuenta las
      // filas escritas por la conexión, así que su delta demuestra el 0 real.
      const antes = db.prepare("SELECT total_changes() AS n").get() as { n: number };
      applySchema(db);
      const despues = db.prepare("SELECT total_changes() AS n").get() as { n: number };
      expect(despues.n - antes.n).toBe(0);

      // Y los datos siguen exactamente igual: ni payloads ni metadatos ni filas.
      expect(
        db
          .prepare(
            `SELECT id, payload, status, recommendation_id, recommendation_action_kind
               FROM journal_entries ORDER BY id`,
          )
          .all(),
      ).toEqual(trasPrimera);
    } finally {
      db.close();
    }
  });
});

describe("migración aditiva de sesiones 6B", () => {
  it("añade tablas de sesión sin reescribir payloads del diario", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE journal_entries (
          id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE journal_state (
          character_id TEXT PRIMARY KEY,
          primary_entry_id TEXT,
          updated_at TEXT NOT NULL
        );
      `);
      const payload = JSON.stringify({
        id: "legacy-6b",
        status: "active",
        title: "Paso legado",
      });
      db.prepare(
        `INSERT INTO journal_entries
          (id, character_id, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        "legacy-6b",
        "legacy-character",
        payload,
        "2026-08-20T10:00:00.000Z",
        "2026-08-20T10:01:00.000Z",
      );
      db.prepare(
        `INSERT INTO journal_state (character_id, primary_entry_id, updated_at)
         VALUES (?, ?, ?)`,
      ).run("legacy-character", "legacy-6b", "2026-08-20T10:01:00.000Z");

      applySchema(db);

      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
        .all() as Array<{ name: string }>;
      expect(tables.map((row) => row.name)).toEqual(
        expect.arrayContaining([
          "decision_sessions",
          "decision_session_events",
          "journal_entries",
          "journal_state",
        ]),
      );
      const stateColumns = db.prepare("PRAGMA table_info(journal_state)").all() as Array<{
        name: string;
      }>;
      expect(stateColumns.map((column) => column.name)).toContain("active_session_id");
      expect(
        db.prepare("SELECT payload FROM journal_entries WHERE id = ?").get("legacy-6b"),
      ).toEqual({ payload });
      expect(
        db.prepare("SELECT primary_entry_id FROM journal_state WHERE character_id = ?").get(
          "legacy-character",
        ),
      ).toEqual({ primary_entry_id: "legacy-6b" });
    } finally {
      db.close();
    }
  });
});
