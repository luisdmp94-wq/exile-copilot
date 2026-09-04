import { z } from "zod";
import {
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS,
  CRAFTING_ADVANCED_ACADEMY_VERSION,
} from "@shared/craftingAdvancedAcademy.js";

export const ADVANCED_ACADEMY_STORAGE_KEY =
  "exile-copilot:academia-crafting:avanzado:v1";

export const AdvancedAcademyProgressSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().min(1).max(120),
  stage: z.enum(["intro", "case", "results"]),
  cursor: z.number().int().min(0).max(999),
  answers: z.record(z.string(), z.string().min(1).max(120)),
});

export type AdvancedAcademyProgress = z.infer<
  typeof AdvancedAcademyProgressSchema
>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function emptyAdvancedAcademyProgress(): AdvancedAcademyProgress {
  return {
    schemaVersion: 1,
    contentVersion: CRAFTING_ADVANCED_ACADEMY_VERSION,
    stage: "intro",
    cursor: 0,
    answers: {},
  };
}

export function discardAdvancedAcademyProgress(
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(ADVANCED_ACADEMY_STORAGE_KEY);
  } catch {
    // El nivel sigue siendo jugable aunque el almacenamiento esté bloqueado.
  }
}

export function loadAdvancedAcademyProgress(
  storage: StorageLike | null = defaultStorage(),
): AdvancedAcademyProgress | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(ADVANCED_ACADEMY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    discardAdvancedAcademyProgress(storage);
    return null;
  }

  const parsed = AdvancedAcademyProgressSchema.safeParse(decoded);
  if (
    !parsed.success ||
    parsed.data.contentVersion !== CRAFTING_ADVANCED_ACADEMY_VERSION ||
    parsed.data.cursor >= CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length
  ) {
    discardAdvancedAcademyProgress(storage);
    return null;
  }

  const answers: Record<string, string> = {};
  for (const scenario of CRAFTING_ADVANCED_ACADEMY_SCENARIOS) {
    const optionId = parsed.data.answers[scenario.id];
    if (scenario.options.some((option) => option.id === optionId)) {
      answers[scenario.id] = optionId;
    }
  }
  return { ...parsed.data, answers };
}

export function saveAdvancedAcademyProgress(
  progress: AdvancedAcademyProgress,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ADVANCED_ACADEMY_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
