import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "../../server/db/database.js";
import {
  deleteVisitorData,
  getMostRecentCharacterForOwner,
  listCharactersForOwner,
  countCharactersForOwner,
  saveBuildMemoryEntry,
  saveCharacter,
  saveDecisionSession,
  saveDecisionSessionEvent,
  saveJournalEntry,
  saveMentorThread,
  setActiveSessionId,
  setJournalPrimaryEntryId,
} from "../../server/db/repositories.js";

let db: Database | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

function count(table: string, where: string, value: string): number {
  const row = db!
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where} = ?`)
    .get(value) as { n: number | bigint };
  return Number(row.n);
}

describe("borrado privado del visitante", () => {
  it("redescubre solo el expediente más reciente del mismo propietario", () => {
    db = createDatabase(":memory:");
    saveCharacter(db, "char-a-antiguo", "{\"name\":\"A\"}", "visitor-a");
    saveCharacter(db, "char-a-reciente", "{\"name\":\"B\"}", "visitor-a");
    saveCharacter(db, "char-b", "{\"name\":\"C\"}", "visitor-b");
    db.prepare("UPDATE characters SET updated_at = ? WHERE id = ?").run(
      "2026-08-30T00:00:00.000Z",
      "char-a-antiguo",
    );
    db.prepare("UPDATE characters SET updated_at = ? WHERE id = ?").run(
      "2026-08-31T00:00:00.000Z",
      "char-a-reciente",
    );
    db.prepare("UPDATE characters SET updated_at = ? WHERE id = ?").run(
      "2026-09-01T00:00:00.000Z",
      "char-b",
    );

    expect(getMostRecentCharacterForOwner(db, "visitor-a")?.id).toBe(
      "char-a-reciente",
    );
    expect(getMostRecentCharacterForOwner(db, "visitor-b")?.id).toBe("char-b");
    expect(getMostRecentCharacterForOwner(db, "visitor-c")).toBeNull();
    expect(countCharactersForOwner(db, "visitor-a")).toBe(2);
    expect(
      listCharactersForOwner(db, "visitor-a", { offset: 0, limit: 1 }).map(
        (row) => row.id,
      ),
    ).toEqual(["char-a-reciente"]);
    expect(
      listCharactersForOwner(db, "visitor-a", { offset: 1, limit: 1 }).map(
        (row) => row.id,
      ),
    ).toEqual(["char-a-antiguo"]);
  });

  it("borra todo lo del propietario y conserva íntegro al otro visitante", () => {
    db = createDatabase(":memory:");
    const now = new Date().toISOString();
    saveCharacter(db, "char-a", "{}", "visitor-a");
    saveCharacter(db, "char-b", "{}", "visitor-b");
    saveMentorThread(db, {
      characterId: "char-a",
      ownerId: "visitor-a",
      threadInputsKey: "inputs-a",
      payload: "{}",
      updatedAt: now,
    });
    saveMentorThread(db, {
      characterId: "char-b",
      ownerId: "visitor-b",
      threadInputsKey: "inputs-b",
      payload: "{}",
      updatedAt: now,
    });
    saveJournalEntry(db, {
      id: "journal-a",
      characterId: "char-a",
      payload: "{}",
      status: "active",
      recommendationId: null,
      recommendationActionKind: null,
      createdAt: now,
      updatedAt: now,
    });
    setJournalPrimaryEntryId(db, "char-a", "journal-a");
    saveBuildMemoryEntry(db, {
      id: "memory-a",
      characterId: "char-a",
      kind: "core",
      payload: "{}",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    saveDecisionSession(db, {
      id: "session-a",
      characterId: "char-a",
      payload: "{}",
      status: "active",
      characterFingerprint: "fingerprint-a",
      createdAt: now,
      updatedAt: now,
    });
    setActiveSessionId(db, "char-a", "session-a");
    saveDecisionSessionEvent(db, {
      id: "event-a",
      sessionId: "session-a",
      characterId: "char-a",
      idempotencyKey: "delete-test-event-a",
      payload: "{}",
      createdAt: now,
      operation: "test",
      requestFingerprint: "request-a",
    });

    const deleted = deleteVisitorData(db, "visitor-a");

    expect(deleted).toEqual({
      characters: 1,
      journalEntries: 1,
      journalStates: 1,
      mentorThreads: 1,
      buildMemoryEntries: 1,
      decisionSessions: 1,
      decisionSessionEvents: 1,
    });
    expect(count("characters", "owner_id", "visitor-a")).toBe(0);
    expect(count("journal_entries", "character_id", "char-a")).toBe(0);
    expect(count("journal_state", "character_id", "char-a")).toBe(0);
    expect(count("mentor_threads", "owner_id", "visitor-a")).toBe(0);
    expect(count("build_memory_entries", "character_id", "char-a")).toBe(0);
    expect(count("decision_sessions", "character_id", "char-a")).toBe(0);
    expect(count("decision_session_events", "character_id", "char-a")).toBe(0);
    expect(count("characters", "owner_id", "visitor-b")).toBe(1);
    expect(count("mentor_threads", "owner_id", "visitor-b")).toBe(1);
  });
});
