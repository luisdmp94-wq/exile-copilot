import { describe, expect, it } from "vitest";
import {
  CRAFTING_MEDIUM_BASE_READING_HELP,
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  resolveMediumAcademyDecision,
  validateMediumAcademyScenario,
} from "../../shared/craftingMediumAcademy.js";

describe("Academia de crafting · nivel medio", () => {
  it("explica la base sin exigir que el jugador conozca la base ideal de su build", () => {
    const scenario = CRAFTING_MEDIUM_ACADEMY_SCENARIOS.find(
      (entry) => entry.id === "medio-elegir-base",
    );

    expect(CRAFTING_MEDIUM_BASE_READING_HELP).toMatch(/debajo del nombre/i);
    expect(CRAFTING_MEDIUM_BASE_READING_HELP).toMatch(/no necesitas conocer la base ideal/i);
    expect(scenario?.question).toMatch(/si todavía no conoces/i);
    expect(scenario?.options.find(
      (entry) => entry.decision === scenario.expectedDecision,
    )?.label).toMatch(/llevo equipad/i);
    expect(scenario?.stopCondition).toMatch(/no gastes/i);
  });

  it("todas las situaciones derivan su respuesta de hechos del juego", () => {
    expect(CRAFTING_MEDIUM_ACADEMY_SCENARIOS).toHaveLength(7);
    for (const scenario of CRAFTING_MEDIUM_ACADEMY_SCENARIOS) {
      expect(validateMediumAcademyScenario(scenario)).toBe(true);
      expect(resolveMediumAcademyDecision(scenario.facts)).toBe(scenario.expectedDecision);
      expect(scenario.item.sources.some((source) => source.kind === "internal")).toBe(true);
      expect(scenario.gameSteps).toHaveLength(3);
      expect(scenario.stopCondition.trim().length, scenario.id).toBeGreaterThan(0);
      expect(scenario.options, scenario.id).toHaveLength(3);
      expect(
        scenario.options.filter((entry) => entry.decision === scenario.expectedDecision),
        scenario.id,
      ).toHaveLength(1);
    }
    expect(new Set(CRAFTING_MEDIUM_ACADEMY_SCENARIOS.map((scenario) => scenario.item.id)).size).toBe(7);
  });

  it("abandona un inicio mágico inútil y aprovecha uno prometedor", () => {
    expect(resolveMediumAcademyDecision({
      situation: "first-magic-mod",
      usefulModifierPresent: false,
      rarity: "magic",
      openModifierSlots: 1,
    })).toBe("change-unhelpful-base");

    expect(resolveMediumAcademyDecision({
      situation: "first-magic-mod",
      usefulModifierPresent: true,
      rarity: "magic",
      openModifierSlots: 1,
    })).toBe("use-augmentation");
  });

  it("distingue completar el mágico, subirlo a raro y valorar Exaltado", () => {
    expect(resolveMediumAcademyDecision({
      situation: "magic-open-slot",
      rarity: "magic",
      usefulModifierPresent: true,
      openModifierSlots: 1,
    })).toBe("use-augmentation");
    expect(resolveMediumAcademyDecision({
      situation: "magic-ready-for-regal",
      rarity: "magic",
      usefulModifierPresent: true,
      openModifierSlots: 0,
    })).toBe("use-regal");
    expect(resolveMediumAcademyDecision({
      situation: "rare-open-slot",
      rarity: "rare",
      usefulModifierPresent: true,
      openModifierSlots: 1,
    })).toBe("consider-exalted");
  });

  it("termina en el personaje cuando el objetivo ya está cumplido", () => {
    expect(resolveMediumAcademyDecision({
      situation: "goal-complete",
      rarity: "rare",
      usefulModifierPresent: true,
      goalDefined: true,
      goalFulfilled: true,
    })).toBe("equip-test-stop");
  });

  it("habla de decisiones en PoE2 y no de operar Exile Copilot", () => {
    const content = JSON.stringify(CRAFTING_MEDIUM_ACADEMY_SCENARIOS).toLowerCase();
    for (const forbidden of [
      "exile copilot",
      "comparador",
      "snapshot",
      "pegar",
      "recopiar",
      "tooltip",
      "contrato",
    ]) {
      expect(content).not.toContain(forbidden);
    }
    expect(content).toContain("en tu alijo");
    expect(content).toContain("la equipo y la pruebo");
  });

  it("presenta Exaltado como aleatorio, no como resultado garantizado", () => {
    const scenario = CRAFTING_MEDIUM_ACADEMY_SCENARIOS.find(
      (entry) => entry.id === "medio-cuando-exaltado",
    );
    expect(scenario).toBeDefined();
    expect(scenario?.explanation).toContain("aleatorio");
    expect(scenario?.takeaway).toContain("apuesta");
  });

  it("termina cada explicación con acciones que el jugador realiza dentro de PoE2", () => {
    const content = CRAFTING_MEDIUM_ACADEMY_SCENARIOS.flatMap((scenario) => scenario.gameSteps).join(" ");
    expect(content).toMatch(/juego|inventario|alijo/);
    expect(content).not.toMatch(/Exile Copilot|pegar|recopiar|laboratorio/i);
  });

  it("declara cuándo dejar de gastar en cada situación", () => {
    const stopConditions = CRAFTING_MEDIUM_ACADEMY_SCENARIOS.map(
      (scenario) => scenario.stopCondition,
    );
    expect(stopConditions).toHaveLength(7);
    expect(stopConditions.every((condition) => condition.trim().length > 20)).toBe(true);
    expect(stopConditions.join(" ")).toMatch(/no gastes|no uses|aparta|deja de gastar|relee/i);
  });
});
