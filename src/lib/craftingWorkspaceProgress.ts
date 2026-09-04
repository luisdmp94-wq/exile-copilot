import { z } from "zod";

export const CRAFTING_WORKSPACE_MODES = ["coach", "academy", "laboratory"] as const;
export type CraftingWorkspaceMode = (typeof CRAFTING_WORKSPACE_MODES)[number];

const STORAGE_PREFIX = "exile-copilot:crafting-workspace:v1:";
const ACADEMY_LEVEL_STORAGE_PREFIX = "exile-copilot:crafting-academy-level:v1:";

export const CRAFTING_ACADEMY_LEVELS = ["basic", "medium", "advanced"] as const;
export type CraftingAcademyLevel = (typeof CRAFTING_ACADEMY_LEVELS)[number];

const CraftingWorkspaceProgressSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.enum(CRAFTING_WORKSPACE_MODES),
});

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function storageKey(profileId: string | null): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(profileId ?? "sin-personaje")}`;
}

/**
 * Recuerda únicamente en qué recorrido de Crafting estaba el jugador.
 * El contenido y el progreso de cada recorrido conservan sus propios contratos.
 */
export function loadCraftingWorkspaceMode(
  profileId: string | null,
  storage: StorageLike | null = defaultStorage(),
): CraftingWorkspaceMode {
  if (!storage) return "coach";
  try {
    const raw = storage.getItem(storageKey(profileId));
    if (raw === null) return "coach";
    const parsed = CraftingWorkspaceProgressSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      storage.removeItem(storageKey(profileId));
      return "coach";
    }
    return parsed.data.mode;
  } catch {
    try {
      storage.removeItem(storageKey(profileId));
    } catch {
      // Crafting sigue disponible aunque el navegador bloquee el almacenamiento.
    }
    return "coach";
  }
}

export function saveCraftingWorkspaceMode(
  profileId: string | null,
  mode: CraftingWorkspaceMode,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  const parsed = CraftingWorkspaceProgressSchema.safeParse({ schemaVersion: 1, mode });
  if (!parsed.success) return false;
  try {
    storage.setItem(storageKey(profileId), JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}

export function loadCraftingAcademyLevel(
  profileId: string | null,
  storage: StorageLike | null = defaultStorage(),
): CraftingAcademyLevel {
  if (!storage) return "basic";
  const key = `${ACADEMY_LEVEL_STORAGE_PREFIX}${encodeURIComponent(profileId ?? "sin-personaje")}`;
  try {
    const value = storage.getItem(key);
    const parsed = z.enum(CRAFTING_ACADEMY_LEVELS).safeParse(value);
    if (parsed.success) return parsed.data;
    if (value !== null) storage.removeItem(key);
    return "basic";
  } catch {
    return "basic";
  }
}

export function saveCraftingAcademyLevel(
  profileId: string | null,
  level: CraftingAcademyLevel,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage || !z.enum(CRAFTING_ACADEMY_LEVELS).safeParse(level).success) return false;
  try {
    storage.setItem(
      `${ACADEMY_LEVEL_STORAGE_PREFIX}${encodeURIComponent(profileId ?? "sin-personaje")}`,
      level,
    );
    return true;
  } catch {
    return false;
  }
}
