const STORAGE_PREFIX = "exile-copilot:crafting-selection:v1:";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface PersistedCraftingSelection {
  version: 1;
  profileId: string;
  itemId: string;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function storageKey(profileId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(profileId)}`;
}

export function loadCraftingSelection(
  profileId: string,
  storage: StorageLike | null = defaultStorage(),
): string | null {
  if (!storage) return null;
  const key = storageKey(profileId);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1 ||
      !("profileId" in value) ||
      value.profileId !== profileId ||
      !("itemId" in value) ||
      typeof value.itemId !== "string" ||
      value.itemId.length === 0 ||
      value.itemId.length > 200
    ) {
      storage.removeItem(key);
      return null;
    }
    return value.itemId;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // La selección puede volver al primer objeto aunque el navegador bloquee storage.
    }
    return null;
  }
}

export function saveCraftingSelection(
  profileId: string,
  itemId: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage || profileId.length === 0 || itemId.length === 0) return false;
  const value: PersistedCraftingSelection = { version: 1, profileId, itemId };
  try {
    storage.setItem(storageKey(profileId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
