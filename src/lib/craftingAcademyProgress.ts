import { z } from "zod";
import {
  CRAFTING_ACADEMY_CONTENT_VERSION,
  allAcademyScenarios,
} from "@shared/craftingAcademy.js";

/**
 * Progreso local de la Academia.
 *
 * Vive en `localStorage` bajo una clave PROPIA y versionada. No toca el
 * personaje, el expediente, el diario ni las sesiones de crafting: perder este
 * dato solo cuesta repetir el nivel básico.
 */
export const ACADEMY_STORAGE_KEY = "exile-copilot:academia-crafting:v1";

export const ACADEMY_STAGES = ["intro", "lesson", "exam", "results"] as const;
export type AcademyStage = (typeof ACADEMY_STAGES)[number];

export const AcademyAnswerRecordSchema = z.object({
  optionId: z.string().min(1).max(120),
  correct: z.boolean(),
});
export type AcademyAnswerRecord = z.infer<typeof AcademyAnswerRecordSchema>;

export const AcademyProgressSchema = z.object({
  schemaVersion: z.literal(1),
  /** Si el contenido cambia de versión, el progreso guardado deja de aplicar. */
  contentVersion: z.string().min(1).max(120),
  stage: z.enum(ACADEMY_STAGES),
  cursor: z.number().int().min(0).max(999),
  answers: z.record(z.string(), AcademyAnswerRecordSchema),
  /** Escenarios que componen la tanda de examen en curso. */
  examScenarioIds: z.array(z.string().min(1).max(120)).max(64),
});
export type AcademyProgress = z.infer<typeof AcademyProgressSchema>;

export function emptyAcademyProgress(examScenarioIds: string[]): AcademyProgress {
  return {
    schemaVersion: 1,
    contentVersion: CRAFTING_ACADEMY_CONTENT_VERSION,
    stage: "intro",
    cursor: 0,
    answers: {},
    examScenarioIds,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Un navegador con almacenamiento bloqueado lanza al acceder. La Academia
    // debe seguir siendo jugable aunque no pueda recordar el progreso.
    return null;
  }
}

/**
 * Restaura el progreso validándolo.
 *
 * Devuelve `null` —empezar de cero— ante cualquier duda: JSON ilegible, forma
 * inesperada, versión de contenido distinta o escenarios que ya no existen.
 * Nunca lanza y nunca devuelve un progreso a medio validar.
 */
export function loadAcademyProgress(storage: StorageLike | null = defaultStorage()): AcademyProgress | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(ACADEMY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    discardAcademyProgress(storage);
    return null;
  }

  const parsed = AcademyProgressSchema.safeParse(parsedJson);
  if (!parsed.success) {
    discardAcademyProgress(storage);
    return null;
  }
  if (parsed.data.contentVersion !== CRAFTING_ACADEMY_CONTENT_VERSION) {
    discardAcademyProgress(storage);
    return null;
  }

  // Referencias a escenarios inexistentes (contenido editado sin subir versión)
  // se descartan en vez de romper el recorrido.
  const knownIds = new Set(allAcademyScenarios().map((scenario) => scenario.id));
  const answers: Record<string, AcademyAnswerRecord> = {};
  for (const [id, record] of Object.entries(parsed.data.answers)) {
    if (knownIds.has(id)) answers[id] = record;
  }
  const examScenarioIds = parsed.data.examScenarioIds.filter((id) => knownIds.has(id));

  return { ...parsed.data, answers, examScenarioIds };
}

export function saveAcademyProgress(
  progress: AcademyProgress,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ACADEMY_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    // Cuota llena o modo privado: el nivel sigue jugable, solo no se recuerda.
    return false;
  }
}

export function discardAcademyProgress(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(ACADEMY_STORAGE_KEY);
  } catch {
    /* nada que hacer: no hay progreso que conservar */
  }
}
