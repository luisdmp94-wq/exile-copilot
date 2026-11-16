import type { DatabaseSync } from "node:sqlite";
import type { StatsDay, UsageEvent, VisitBeacon } from "../shared/visitStats.js";

/**
 * Contador anónimo: una fila por día, tipo y etiqueta, con su número. No se
 * guarda nada por persona; ver `shared/visitStats.ts`.
 */

type Kind = "visitante" | "nuevo" | "visita" | "origen" | "pagina" | "uso";

export function applyAnalyticsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_counts (
      day TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (day, kind, label)
    );
  `);
}

/** Día en UTC, «2026-11-16». */
export function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function bump(db: DatabaseSync, day: string, kind: Kind, label: string): void {
  db.prepare(`
    INSERT INTO daily_counts (day, kind, label, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(day, kind, label) DO UPDATE SET count = count + 1
  `).run(day, kind, label);
}

export function recordVisit(db: DatabaseSync, visit: VisitBeacon, now = new Date()): void {
  const day = dayOf(now);
  bump(db, day, "visita", "todas");
  bump(db, day, "pagina", visit.page);
  if (visit.firstToday) {
    bump(db, day, "visitante", "todos");
    // El origen se cuenta por visitante del día, no por cada página que abre.
    bump(db, day, "origen", visit.source);
  }
  if (visit.firstVisit) bump(db, day, "nuevo", "todos");
}

export function recordUse(db: DatabaseSync, event: UsageEvent, now = new Date()): void {
  bump(db, dayOf(now), "uso", event);
}

/** Los últimos `days` días, del más reciente al más antiguo, con ceros donde no hubo nada. */
export function readStats(db: DatabaseSync, days: number, now = new Date()): StatsDay[] {
  const wanted: string[] = [];
  for (let back = 0; back < days; back += 1) {
    wanted.push(dayOf(new Date(now.getTime() - back * 86_400_000)));
  }
  const rows = db
    .prepare("SELECT day, kind, label, count FROM daily_counts WHERE day >= ? ORDER BY day DESC")
    .all(wanted[wanted.length - 1]) as unknown as Array<{ day: string; kind: Kind; label: string; count: number }>;
  return wanted.map((day) => {
    const result: StatsDay = { day, visitors: 0, newVisitors: 0, visits: 0, sources: {}, pages: {}, uses: {} };
    for (const row of rows) {
      if (row.day !== day) continue;
      if (row.kind === "visitante") result.visitors += row.count;
      else if (row.kind === "nuevo") result.newVisitors += row.count;
      else if (row.kind === "visita") result.visits += row.count;
      else if (row.kind === "origen") result.sources[row.label] = row.count;
      else if (row.kind === "pagina") result.pages[row.label] = row.count;
      else if (row.kind === "uso") result.uses[row.label] = row.count;
    }
    return result;
  });
}
