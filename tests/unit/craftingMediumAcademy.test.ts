import { describe, expect, it } from "vitest";
import {
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  resolveMediumAcademyDecision,
  validateMediumAcademyScenario,
} from "../../shared/craftingMediumAcademy.js";

describe("Academia de crafting · nivel medio", () => {
  it("todos los casos derivan su respuesta de los hechos", () => {
    expect(CRAFTING_MEDIUM_ACADEMY_SCENARIOS).toHaveLength(6);
    for (const scenario of CRAFTING_MEDIUM_ACADEMY_SCENARIOS) {
      expect(validateMediumAcademyScenario(scenario)).toBe(true);
      expect(resolveMediumAcademyDecision(scenario.facts)).toBe(scenario.expectedDecision);
    }
  });

  it("prioriza datos e identidad antes de interpretar el resultado", () => {
    expect(resolveMediumAcademyDecision({ resultDataComplete: false, identityMatches: false, actionStructureMatches: false, protectedLineLost: true, stopConditionFulfilled: true })).toBe("recopy-result");
    expect(resolveMediumAcademyDecision({ resultDataComplete: true, identityMatches: false, actionStructureMatches: true, protectedLineLost: true, stopConditionFulfilled: true })).toBe("reject-different-item");
  });

  it("una pérdida protegida frena incluso si la salida parece cumplida", () => {
    expect(resolveMediumAcademyDecision({ resultDataComplete: true, identityMatches: true, actionStructureMatches: true, protectedLineLost: true, stopConditionFulfilled: true })).toBe("protect-and-stop");
  });

  it("distingue parar de continuar dentro del contrato", () => {
    expect(resolveMediumAcademyDecision({ resultDataComplete: true, identityMatches: true, actionStructureMatches: true, protectedLineLost: false, stopConditionFulfilled: true })).toBe("keep-and-stop");
    expect(resolveMediumAcademyDecision({ resultDataComplete: true, identityMatches: true, actionStructureMatches: true, protectedLineLost: false, stopConditionFulfilled: false })).toBe("continue-contract");
  });
});
