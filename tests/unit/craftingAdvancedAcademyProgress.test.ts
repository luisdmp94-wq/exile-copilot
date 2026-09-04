import { describe, expect, it } from "vitest";
import {
  emptyAdvancedAcademyProgress,
  loadAdvancedAcademyProgress,
  saveAdvancedAcademyProgress,
} from "../../src/lib/craftingAdvancedAcademyProgress.js";
import { CRAFTING_ADVANCED_ACADEMY_SCENARIOS } from "../../shared/craftingAdvancedAcademy.js";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("progreso de la Academia avanzada", () => {
  it("recupera el caso siguiente y una respuesta incorrecta después de recargar", () => {
    const storage = fakeStorage();
    const first = CRAFTING_ADVANCED_ACADEMY_SCENARIOS[0];
    const wrongOption = first.options.find(
      (option) => option.decision !== first.expectedDecision,
    );
    expect(wrongOption).toBeDefined();

    const progress = {
      ...emptyAdvancedAcademyProgress(),
      stage: "case" as const,
      cursor: 1,
      answers: { [first.id]: wrongOption!.id },
    };

    expect(saveAdvancedAcademyProgress(progress, storage)).toBe(true);
    expect(loadAdvancedAcademyProgress(storage)).toEqual(progress);
  });
});
