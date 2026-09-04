import { z } from "zod";
import {
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  CRAFTING_MEDIUM_ACADEMY_VERSION,
} from "@shared/craftingMediumAcademy.js";

export const MEDIUM_ACADEMY_STORAGE_KEY =
  "exile-copilot:academia-crafting:medio:v1";

export const MediumAcademyProgressSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().min(1).max(120),
  stage: z.enum(["intro", "cases", "results"]),
  cursor: z.number().int().min(0).max(999),
  answers: z.record(z.string(), z.string().min(1).max(120)),
});

export type MediumAcademyProgress = z.infer<
  typeof MediumAcademyProgressSchema
>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function emptyMediumAcademyProgress(): MediumAcademyProgress {
  return {
    schemaVersion: 1,
    contentVersion: CRAFTING_MEDIUM_ACADEMY_VERSION,
    stage: "intro",
    cursor: 0,
    answers: {},
  };
}

export function discardMediumAcademyProgress(
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(MEDIUM_ACADEMY_STORAGE_KEY);
  } catch {
    // El nivel sigue siendo jugable aunque el almacenamiento esté bloqueado.
  }
}

export function loadMediumAcademyProgress(
  storage: StorageLike | null = defaultStorage(),
): MediumAcademyProgress | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(MEDIUM_ACADEMY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    discardMediumAcademyProgress(storage);
    return null;
  }

  const parsed = MediumAcademyProgressSchema.safeParse(decoded);
  if (
    !parsed.success ||
    parsed.data.contentVersion !== CRAFTING_MEDIUM_ACADEMY_VERSION ||
    parsed.data.cursor >= CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length
  ) {
    discardMediumAcademyProgress(storage);
    return null;
  }

  const answers: Record<string, string> = {};
  for (const scenario of CRAFTING_MEDIUM_ACADEMY_SCENARIOS) {
    const optionId = parsed.data.answers[scenario.id];
    if (scenario.options.some((option) => option.id === optionId)) {
      answers[scenario.id] = optionId;
    }
  }
  return { ...parsed.data, answers };
}

export function saveMediumAcademyProgress(
  progress: MediumAcademyProgress,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(MEDIUM_ACADEMY_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
