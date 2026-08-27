import { describe, expect, it } from "vitest";
import { clearExileCopilotLocalData } from "../../src/lib/privacy.js";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

describe("limpieza local de privacidad", () => {
  it("elimina solo claves de Exile Copilot y preserva otras apps de localhost", () => {
    const storage = new MemoryStorage();
    storage.setItem("exile-copilot:characterId", "char-a");
    storage.setItem("exile-copilot:crafting-project:v1:char-a:item-a", "{}");
    storage.setItem("otra-herramienta:preferencia", "conservar");

    expect(clearExileCopilotLocalData(storage)).toBe(2);
    expect(storage.has("exile-copilot:characterId")).toBe(false);
    expect(storage.has("exile-copilot:crafting-project:v1:char-a:item-a")).toBe(false);
    expect(storage.has("otra-herramienta:preferencia")).toBe(true);
  });
});
