import { describe, expect, it } from "vitest";
import { deriveCraftingBuildIntent } from "../../shared/craftingBuildIntent.js";

const PROFILE = {
  resistances: { fire: 75, cold: 75, lightning: 75, chaos: 0 },
};

describe("deriveCraftingBuildIntent", () => {
  it("alinea una categoría con prioridades explícitas de la build sin transportar su texto", () => {
    const intent = deriveCraftingBuildIntent({
      profile: PROFILE,
      target: {
        name: "Ballesta física",
        desiredMods: ["Daño físico", "Velocidad de ataque"],
      },
      profileGoal: "balanced",
      goalCategory: "damage",
    });

    expect(intent).toEqual({
      source: "target",
      alignment: "aligned",
      focuses: ["physical", "attack-speed"],
      suggestedCategories: ["damage", "speed"],
    });
    expect(JSON.stringify(intent)).not.toContain("Ballesta física");
    expect(JSON.stringify(intent)).not.toContain("Daño físico");
  });

  it("señala conflicto cuando el contrato trabaja otra categoría", () => {
    const intent = deriveCraftingBuildIntent({
      profile: PROFILE,
      target: { name: "Objetivo", desiredMods: ["Resistencias"] },
      profileGoal: "balanced",
      goalCategory: "damage",
    });

    expect(intent).toMatchObject({
      source: "target",
      alignment: "conflict",
      focuses: ["resistances"],
      suggestedCategories: ["defence"],
    });
  });

  it("pide elegir defensa cuando el expediente demuestra una resistencia baja", () => {
    const intent = deriveCraftingBuildIntent({
      profile: {
        resistances: { fire: 44, cold: 75, lightning: 75, chaos: 0 },
      },
      target: null,
      profileGoal: "balanced",
      goalCategory: "other",
    });

    expect(intent).toEqual({
      source: "resistances",
      alignment: "choice-required",
      focuses: ["resistances"],
      suggestedCategories: ["defence"],
    });
  });

  it("usa el objetivo general solo cuando no existe una señal más concreta", () => {
    const intent = deriveCraftingBuildIntent({
      profile: PROFILE,
      target: null,
      profileGoal: "survival",
      goalCategory: "defence",
    });

    expect(intent).toEqual({
      source: "profile-goal",
      alignment: "aligned",
      focuses: [],
      suggestedCategories: ["defence"],
    });
  });

  it("no convierte mapping, bossing o balanced en una necesidad de afijo", () => {
    for (const profileGoal of ["mapping", "bossing", "balanced"] as const) {
      expect(
        deriveCraftingBuildIntent({
          profile: PROFILE,
          target: { name: "Sin mods", desiredMods: [] },
          profileGoal,
          goalCategory: "damage",
        }),
      ).toEqual({
        source: "none",
        alignment: "unknown",
        focuses: [],
        suggestedCategories: [],
      });
    }
  });
});
