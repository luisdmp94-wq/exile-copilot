import type { DatabaseSync } from "node:sqlite";
import { normalizeQuestion } from "../shared/mentorIntent.js";
import type { MentorAnswer } from "../shared/mentorQuery.js";
import {
  UNANSWERED_MAX_ROWS,
  UNANSWERED_RETENTION_DAYS,
  scrubQuestion,
  type UnansweredEntry,
  type UnansweredReason,
} from "../shared/mentorUnanswered.js";
import { dayOf } from "./analytics.js";

/** Preguntas que el Mentor no supo contestar; ver `shared/mentorUnanswered.ts`. */
export function applyMentorUnansweredSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_unanswered (
      question_key TEXT NOT NULL,
      reason TEXT NOT NULL,
      lang TEXT NOT NULL,
      question TEXT NOT NULL,
      count INTEGER NOT NULL,
      first_day TEXT NOT NULL,
      last_day TEXT NOT NULL,
      PRIMARY KEY (question_key, reason, lang)
    );
  `);
}

/**
 * Frases con las que una regla reconoce la pregunta pero dice que la web no
 * tiene el dato (`server/mentor/gameQuestions.ts` y `gemQuestion.ts`). Si se
 * cambian allí, la prueba `mentorUnanswered.test.ts` avisa.
 */
const NO_DATA_ANSWER =
  /no encuentro ningun|no encuentro una asistencia|no puedo comparar esos dos|i can t find|i can t compare those two/;
/**
 * El Mentor miró el personaje y dijo que no ve la causa o la mejora
 * (`focusNothingFoundAnswer` y «no encuentro una mejora clara» en
 * `mentorService.ts`). Suele tapar una pregunta que era de otra cosa:
 * «¿cambio mi arma única por una varita amarilla?» lleva «daño» y recibía esto.
 */
const NOTHING_FOUND_ANSWER =
  /no veo una causa clara|no encuentro una causa clara|no encuentro una mejora clara|i don t see a clear cause|i don t find a clear cause|i can t find a clear improvement/;
/** De monstruos que se capturan no hay datos: la respuesta solo lista gemas de esbirro. */
const CAPTURED_MONSTER_QUESTION = /\bespectros?\b|\bspectres?\b|\bbestias?\b|\bbeasts?\b|\bdomar\b|\btame\b/;

/**
 * Por qué esta respuesta cuenta como «no supo contestar», o null si contestó.
 * Se deduce de la respuesta ya hecha: el Mentor no cambia.
 */
export function unansweredReason(
  answer: MentorAnswer,
  question: string,
  patchFeatureBlocked: boolean,
): UnansweredReason | null {
  if (answer.intent === "unsupported") {
    return answer.responseMode === "rules" ? "no-entendida" : "ia-sin-respuesta";
  }
  if (patchFeatureBlocked && answer.unverified.length > 0 && answer.nextAction === null && answer.intent === "explain_priority") {
    return "area-sin-revisar";
  }
  if (answer.nextAction === null && NOTHING_FOUND_ANSWER.test(normalizeQuestion(answer.answer))) {
    return "sin-causa";
  }
  if (answer.intent === "conversation" && answer.responseMode === "rules") {
    if (NO_DATA_ANSWER.test(normalizeQuestion(answer.answer))) return "sin-datos";
    if (
      CAPTURED_MONSTER_QUESTION.test(normalizeQuestion(question)) &&
      /espectro|spectre/.test(normalizeQuestion(answer.answer))
    ) {
      return "sin-datos";
    }
  }
  return null;
}

/** Devuelve false si no se guardó (pregunta vacía tras limpiarla o tope de filas). */
export function recordUnanswered(
  db: DatabaseSync,
  entry: { question: string; reason: UnansweredReason; lang: "es" | "en" },
  now = new Date(),
): boolean {
  const question = scrubQuestion(entry.question);
  const key = normalizeQuestion(question);
  if (key === "") return false;
  const day = dayOf(now);
  // Lo que no se repite en 90 días se borra al llegar una nueva.
  const cutoff = dayOf(new Date(now.getTime() - UNANSWERED_RETENTION_DAYS * 86_400_000));
  db.prepare("DELETE FROM mentor_unanswered WHERE last_day < ?").run(cutoff);

  const bumped = db
    .prepare(
      "UPDATE mentor_unanswered SET count = count + 1, last_day = ? WHERE question_key = ? AND reason = ? AND lang = ?",
    )
    .run(day, key, entry.reason, entry.lang);
  if (Number(bumped.changes) > 0) return true;

  const total = db.prepare("SELECT COUNT(*) AS total FROM mentor_unanswered").get() as { total: number } | undefined;
  if ((total?.total ?? 0) >= UNANSWERED_MAX_ROWS) return false;
  db.prepare(`
    INSERT INTO mentor_unanswered (question_key, reason, lang, question, count, first_day, last_day)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(key, entry.reason, entry.lang, question, day, day);
  return true;
}

/** Las más recientes primero y, dentro del mismo día, las más repetidas. */
export function listUnanswered(db: DatabaseSync, limit = 200): UnansweredEntry[] {
  const rows = db
    .prepare(`
      SELECT question, reason, lang, count, first_day, last_day
      FROM mentor_unanswered ORDER BY last_day DESC, count DESC, question ASC LIMIT ?
    `)
    .all(limit) as Array<{
    question: string;
    reason: UnansweredReason;
    lang: "es" | "en";
    count: number;
    first_day: string;
    last_day: string;
  }>;
  return rows.map((row) => ({
    question: row.question,
    reason: row.reason,
    lang: row.lang,
    count: row.count,
    firstDay: row.first_day,
    lastDay: row.last_day,
  }));
}
