import { describe, expect, it } from "vitest";
import {
  loadCraftingSelection,
  saveCraftingSelection,
} from "../../src/lib/craftingSelection.js";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("selección persistida de Crafting", () => {
  it("recupera la pieza activa únicamente para el mismo personaje", () => {
    const storage = fakeStorage();

    expect(saveCraftingSelection("perfil-a", "pieza-2", storage)).toBe(true);
    expect(loadCraftingSelection("perfil-a", storage)).toBe("pieza-2");
    expect(loadCraftingSelection("perfil-b", storage)).toBeNull();
  });

  it("descarta una selección dañada sin bloquear Crafting", () => {
    const storage = fakeStorage();
    expect(saveCraftingSelection("perfil-a", "pieza-2", storage)).toBe(true);
    const [key] = [...storage.data.keys()];
    storage.setItem(key, "no es json");

    expect(loadCraftingSelection("perfil-a", storage)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });
});
