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
});
