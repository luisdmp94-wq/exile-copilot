import { describe, expect, it } from "vitest";
import {
  loadCraftingAcademyLevel,
  loadCraftingWorkspaceMode,
  saveCraftingAcademyLevel,
  saveCraftingWorkspaceMode,
} from "../../src/lib/craftingWorkspaceProgress.js";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("recorrido activo de Crafting", () => {
  it("restaura Academia y Taller después de una recarga", () => {
    const storage = fakeStorage();

    expect(saveCraftingWorkspaceMode("ritualista", "academy", storage)).toBe(true);
    expect(loadCraftingWorkspaceMode("ritualista", storage)).toBe("academy");

    expect(saveCraftingWorkspaceMode("ritualista", "laboratory", storage)).toBe(true);
    expect(loadCraftingWorkspaceMode("ritualista", storage)).toBe("laboratory");
  });

  it("aísla el recorrido de cada personaje", () => {
    const storage = fakeStorage();
    saveCraftingWorkspaceMode("ritualista", "academy", storage);
    saveCraftingWorkspaceMode("guerrero", "laboratory", storage);

    expect(loadCraftingWorkspaceMode("ritualista", storage)).toBe("academy");
    expect(loadCraftingWorkspaceMode("guerrero", storage)).toBe("laboratory");
    expect(loadCraftingWorkspaceMode(null, storage)).toBe("coach");
  });

  it("ante datos corruptos vuelve a Ayuda en vivo y limpia la clave", () => {
    const storage = fakeStorage({
      "exile-copilot:crafting-workspace:v1:ritualista": JSON.stringify({
        schemaVersion: 1,
        mode: "modo-inventado",
      }),
    });

    expect(loadCraftingWorkspaceMode("ritualista", storage)).toBe("coach");
    expect(storage.data.size).toBe(0);
  });

  it("recuerda el nivel académico exacto y lo aísla por personaje", () => {
    const storage = fakeStorage();
    expect(saveCraftingAcademyLevel("ritualista", "medium", storage)).toBe(true);
    expect(saveCraftingAcademyLevel("guerrero", "advanced", storage)).toBe(true);

    expect(loadCraftingAcademyLevel("ritualista", storage)).toBe("medium");
    expect(loadCraftingAcademyLevel("guerrero", storage)).toBe("advanced");
    expect(loadCraftingAcademyLevel(null, storage)).toBe("basic");
  });
});
