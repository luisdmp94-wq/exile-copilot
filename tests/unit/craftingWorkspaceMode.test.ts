import { describe, expect, it } from "vitest";
import {
  hasCraftingWorkspaceMode,
  loadCraftingWorkspaceMode,
  saveCraftingWorkspaceMode,
} from "../../src/lib/craftingWorkspaceProgress";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("recorrido de Crafting recordado por personaje", () => {
  it("distingue un personaje que nunca eligió de uno que eligió Ayuda en vivo", () => {
    // Pegar la primera pieza desde el Taller crea el personaje provisional. Solo
    // si ese personaje aún no eligió nada se le deja donde estaba el jugador.
    const storage = memoryStorage();
    expect(hasCraftingWorkspaceMode("nuevo", storage)).toBe(false);
    expect(loadCraftingWorkspaceMode("nuevo", storage)).toBe("coach");

    saveCraftingWorkspaceMode("nuevo", "coach", storage);
    expect(hasCraftingWorkspaceMode("nuevo", storage)).toBe(true);

    saveCraftingWorkspaceMode("otro", "laboratory", storage);
    expect(loadCraftingWorkspaceMode("otro", storage)).toBe("laboratory");
    expect(hasCraftingWorkspaceMode("tercero", storage)).toBe(false);
  });

  it("sin almacenamiento no afirma que haya una elección guardada", () => {
    expect(hasCraftingWorkspaceMode("cualquiera", null)).toBe(false);
  });
});
