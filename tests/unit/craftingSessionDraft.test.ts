import { describe, expect, it } from "vitest";
import {
  clearCraftingSessionDraft,
  craftingSessionDraftStorageKey,
  loadCraftingSessionDraft,
  saveCraftingSessionDraft,
} from "../../src/lib/craftingSessionDraft.js";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("borrador del resultado de una sesión de crafting", () => {
  it("recupera el texto únicamente para el mismo personaje y sesión", () => {
    const storage = fakeStorage();
    const identity = { profileId: "ritualista", sessionId: "craft-1" };

    expect(saveCraftingSessionDraft(identity, "objeto observado", storage)).toBe(true);
    expect(loadCraftingSessionDraft(identity, storage)).toBe("objeto observado");
    expect(
      loadCraftingSessionDraft({ profileId: "otro", sessionId: "craft-1" }, storage),
    ).toBe("");
    expect(
      loadCraftingSessionDraft({ profileId: "ritualista", sessionId: "craft-2" }, storage),
    ).toBe("");
  });

  it("limpia el borrador al cerrar el ciclo", () => {
    const storage = fakeStorage();
    const identity = { profileId: "ritualista", sessionId: "craft-1" };
    saveCraftingSessionDraft(identity, "objeto observado", storage);

    expect(clearCraftingSessionDraft(identity, storage)).toBe(true);
    expect(loadCraftingSessionDraft(identity, storage)).toBe("");
  });

  it("descarta una entrada corrupta sin cruzarla con otra sesión", () => {
    const identity = { profileId: "ritualista", sessionId: "craft-1" };
    const key = craftingSessionDraftStorageKey(identity);
    const storage = fakeStorage({ [key]: "{no-json" });

    expect(loadCraftingSessionDraft(identity, storage)).toBe("");
    expect(storage.data.has(key)).toBe(false);
  });
});
