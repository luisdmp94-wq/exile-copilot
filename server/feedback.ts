import type { DatabaseSync } from "node:sqlite";
import {
  FEEDBACK_RETENTION_DAYS,
  type FeedbackEntry,
  type FeedbackReport,
} from "../shared/feedback.js";

/** Avisos de problemas enviados por los jugadores; ver `shared/feedback.ts`. */
export function applyFeedbackSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      area TEXT,
      lang TEXT NOT NULL,
      viewport TEXT,
      browser TEXT,
      text TEXT NOT NULL
    );
  `);
}

export function recordFeedback(db: DatabaseSync, report: FeedbackReport, now = new Date()): void {
  // Se guardan como mucho 90 días: lo viejo se borra al llegar uno nuevo.
  const cutoff = new Date(now.getTime() - FEEDBACK_RETENTION_DAYS * 86_400_000).toISOString();
  db.prepare("DELETE FROM feedback_reports WHERE created_at < ?").run(cutoff);
  db.prepare(`
    INSERT INTO feedback_reports (created_at, area, lang, viewport, browser, text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(now.toISOString(), report.area, report.lang, report.viewport, report.browser, report.text);
}

export function listFeedback(db: DatabaseSync, limit = 50): FeedbackEntry[] {
  const rows = db
    .prepare(`
      SELECT id, created_at, area, lang, viewport, browser, text
      FROM feedback_reports ORDER BY id DESC LIMIT ?
    `)
    .all(limit) as Array<{
    id: number;
    created_at: string;
    area: string | null;
    lang: string;
    viewport: string | null;
    browser: string | null;
    text: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    area: row.area,
    lang: row.lang,
    viewport: row.viewport,
    browser: row.browser,
    text: row.text,
  }));
}
