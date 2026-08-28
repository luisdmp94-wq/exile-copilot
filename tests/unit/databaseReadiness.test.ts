import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  createDatabase,
  probeDatabasePersistence,
} from "../../server/db/database.js";

describe("comprobación de persistencia SQLite", () => {
  it("acepta una base escribible sin dejar la fila reversible", () => {
    const db = createDatabase(":memory:");
    try {
      expect(probeDatabasePersistence(db)).toBe(true);
      expect(
        db
          .prepare("SELECT COUNT(*) AS total FROM price_cache WHERE key = ?")
          .get("__exile_copilot_runtime_readiness_probe__"),
      ).toEqual({ total: 0 });
    } finally {
      db.close();
    }
  });

  it("bloquea una base legible que SQLite ha puesto en solo lectura", () => {
    const db = createDatabase(":memory:");
    try {
      db.exec("PRAGMA query_only = ON");
      expect(db.prepare("SELECT 1 AS ok").get()).toEqual({ ok: 1 });
      expect(probeDatabasePersistence(db)).toBe(false);
    } finally {
      db.close();
    }
  });

  it("falla cerrado cuando la conexión ya no existe", () => {
    const db = new DatabaseSync(":memory:");
    db.close();
    expect(probeDatabasePersistence(db)).toBe(false);
  });
});
