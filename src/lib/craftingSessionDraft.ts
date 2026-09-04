import { z } from "zod";

const CraftingSessionDraftSchema = z.object({
  schemaVersion: z.literal(1),
  profileId: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().min(1).max(200),
  resultText: z.string().max(50_000),
});

export interface CraftingSessionDraftIdentity {
  profileId: string;
  sessionId: string;
}

export interface CraftingSessionDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): CraftingSessionDraftStorage | null {
  return (
    globalThis as typeof globalThis & {
      localStorage?: CraftingSessionDraftStorage;
    }
  ).localStorage ?? null;
}

export function craftingSessionDraftStorageKey(
  identity: CraftingSessionDraftIdentity,
): string {
  return `exile-copilot:crafting-session-draft:v1:${encodeURIComponent(identity.profileId)}:${encodeURIComponent(identity.sessionId)}`;
}

export function loadCraftingSessionDraft(
  identity: CraftingSessionDraftIdentity,
  storage: CraftingSessionDraftStorage | null = browserStorage(),
): string {
  if (!storage) return "";
  const key = craftingSessionDraftStorageKey(identity);
  try {
    const parsed = CraftingSessionDraftSchema.safeParse(
      JSON.parse(storage.getItem(key) ?? "null"),
    );
    if (
      !parsed.success ||
      parsed.data.profileId !== identity.profileId ||
      parsed.data.sessionId !== identity.sessionId
    ) {
      if (storage.getItem(key) !== null) storage.removeItem(key);
      return "";
    }
    return parsed.data.resultText;
  } catch {
    storage.removeItem(key);
    return "";
  }
}

export function saveCraftingSessionDraft(
  identity: CraftingSessionDraftIdentity,
  resultText: string,
  storage: CraftingSessionDraftStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  const key = craftingSessionDraftStorageKey(identity);
  try {
    if (resultText === "") {
      storage.removeItem(key);
      return true;
    }
    storage.setItem(
      key,
      JSON.stringify(
        CraftingSessionDraftSchema.parse({
          schemaVersion: 1,
          ...identity,
          resultText,
        }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearCraftingSessionDraft(
  identity: CraftingSessionDraftIdentity,
  storage: CraftingSessionDraftStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(craftingSessionDraftStorageKey(identity));
    return true;
  } catch {
    return false;
  }
}
