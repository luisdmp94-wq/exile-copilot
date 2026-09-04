import { describe, expect, it } from "vitest";
import {
  emptyMediumAcademyProgress,
  loadMediumAcademyProgress,
  saveMediumAcademyProgress,
} from "../../src/lib/craftingMediumAcademyProgress.js";
import { CRAFTING_MEDIUM_ACADEMY_SCENARIOS } from "../../shared/craftingMediumAcademy.js";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("progreso de la Academia media", () => {
  it("recupera la situación siguiente y la respuesta anterior después de recargar", () => {
    const storage = fakeStorage();
    const first = CRAFTING_MEDIUM_ACADEMY_SCENARIOS[0];
    const wrongOption = first.options.find(
      (option) => option.decision !== first.expectedDecision,
    );
    expect(wrongOption).toBeDefined();

    const progress = {
      ...emptyMediumAcademyProgress(),
      stage: "cases" as const,
      cursor: 1,
      answers: { [first.id]: wrongOption!.id },
    };

    expect(saveMediumAcademyProgress(progress, storage)).toBe(true);
    expect(loadMediumAcademyProgress(storage)).toEqual(progress);
  });
});
