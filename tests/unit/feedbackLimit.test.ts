import { describe, expect, it } from "vitest";
import { createDatabase } from "../../server/db/database.js";
import { listFeedback, recordFeedback } from "../../server/feedback.js";
import { FEEDBACK_DAILY_LIMIT, type FeedbackReport } from "../../shared/feedback.js";

const report = (text: string): FeedbackReport => ({ text, area: null, lang: "es", viewport: null, browser: null });

describe("avisos de problemas: tope diario", () => {
  it("al llegar al tope del día deja de guardar, sin borrar los anteriores", () => {
    const db = createDatabase(":memory:");
    const monday = new Date("2026-11-16T10:00:00Z");
    expect(recordFeedback(db, report("Aviso real del lunes"), monday)).toBe(true);

    const tuesday = new Date("2026-11-17T12:00:00Z");
    for (let index = 0; index < FEEDBACK_DAILY_LIMIT; index += 1) {
      expect(recordFeedback(db, report(`Ruido ${index}`), tuesday)).toBe(true);
    }
    expect(recordFeedback(db, report("Uno más"), tuesday)).toBe(false);

    const stored = listFeedback(db, 1000);
    expect(stored).toHaveLength(FEEDBACK_DAILY_LIMIT + 1);
    expect(stored.some((entry) => entry.text === "Aviso real del lunes")).toBe(true);
    expect(stored.some((entry) => entry.text === "Uno más")).toBe(false);
    db.close();
  });

  it("al día siguiente vuelve a guardar", () => {
    const db = createDatabase(":memory:");
    const tuesday = new Date("2026-11-17T12:00:00Z");
    for (let index = 0; index < FEEDBACK_DAILY_LIMIT; index += 1) recordFeedback(db, report(`Ruido ${index}`), tuesday);
    expect(recordFeedback(db, report("Tarde"), tuesday)).toBe(false);
    expect(recordFeedback(db, report("Aviso del jueves"), new Date("2026-11-19T12:00:01Z"))).toBe(true);
    db.close();
  });
});
