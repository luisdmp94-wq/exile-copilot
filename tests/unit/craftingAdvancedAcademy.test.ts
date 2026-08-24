import { describe, expect, it } from "vitest";
import {
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS,
  CRAFTING_ADVANCED_ACADEMY_VERSION,
  resolveAdvancedAcademyDecision,
  validateAdvancedAcademyScenario,
  type AdvancedAcademyFacts,
} from "../../shared/craftingAdvancedAcademy.js";

describe("Academia de crafting — nivel avanzado", () => {
  it("incluye seis decisiones distintas y todo el contenido coincide con el resolutor", () => {
    expect(CRAFTING_ADVANCED_ACADEMY_VERSION).toBe("avanzado-2026-08-24");
    expect(CRAFTING_ADVANCED_ACADEMY_SCENARIOS).toHaveLength(6);

    for (const scenario of CRAFTING_ADVANCED_ACADEMY_SCENARIOS) {
      expect(validateAdvancedAcademyScenario(scenario), scenario.id).toBe(true);
      expect(resolveAdvancedAcademyDecision(scenario.facts), scenario.id).toBe(
        scenario.expectedDecision,
      );
      expect(new Set(scenario.options.map((entry) => entry.id)).size, scenario.id).toBe(
        scenario.options.length,
      );
      expect(
        scenario.options.filter((entry) => entry.decision === scenario.expectedDecision),
        scenario.id,
      ).toHaveLength(1);
    }
  });

  it("cubre contrato, conservación, reemplazo, salida, evidencia y empate honesto", () => {
    expect(
      CRAFTING_ADVANCED_ACADEMY_SCENARIOS.map((scenario) => scenario.expectedDecision),
    ).toEqual([
      "define-stop",
      "augmentation",
      "request-tooltip",
      "stop",
      "complete-data",
      "compare-risks",
    ]);
  });

  it("prioriza completar datos, objetivo y salida antes de proponer monedas", () => {
    const base: AdvancedAcademyFacts = {
      itemDataComplete: false,
      objectiveDefined: false,
      stopDefined: false,
      stopFulfilled: false,
      protectedLineCount: 0,
      routes: [
        {
          id: "exalted",
          label: "Orbe exaltado",
          legal: true,
          risk: "adds",
          tooltipVerified: true,
          consequence: "Añade.",
        },
      ],
    };

    expect(resolveAdvancedAcademyDecision(base)).toBe("complete-data");
    expect(resolveAdvancedAcademyDecision({ ...base, itemDataComplete: true })).toBe(
      "define-objective",
    );
    expect(
      resolveAdvancedAcademyDecision({
        ...base,
        itemDataComplete: true,
        objectiveDefined: true,
      }),
    ).toBe("define-stop");
  });

  it("parar al cumplir el contrato domina sobre cualquier acción todavía legal", () => {
    const fulfilled = CRAFTING_ADVANCED_ACADEMY_SCENARIOS.find(
      (scenario) => scenario.id === "avanzado-salida-cumplida",
    );
    expect(fulfilled).toBeDefined();
    expect(fulfilled?.facts.routes.some((route) => route.legal)).toBe(true);
    expect(resolveAdvancedAcademyDecision(fulfilled!.facts)).toBe("stop");
  });

  it("un reemplazo sin tooltip nunca se convierte en recomendación", () => {
    const replacement = CRAFTING_ADVANCED_ACADEMY_SCENARIOS.find(
      (scenario) => scenario.id === "avanzado-reemplazo-no-demostrado",
    );
    expect(replacement).toBeDefined();
    expect(replacement?.facts.routes.every((route) => !route.tooltipVerified)).toBe(true);
    expect(resolveAdvancedAcademyDecision(replacement!.facts)).toBe("request-tooltip");
  });

  it("no afirma porcentajes, precios ni DPS en ningún caso", () => {
    const forbidden = /\d+\s?%|\bDPS\b|\d+\s?(?:exaltado|divino|caos)s?\b/i;
    for (const scenario of CRAFTING_ADVANCED_ACADEMY_SCENARIOS) {
      const text = [
        scenario.title,
        scenario.skill,
        scenario.situation,
        scenario.question,
        scenario.explanation,
        scenario.lesson,
        scenario.contract.objective,
        scenario.contract.stop,
        ...scenario.contract.protect,
        ...scenario.options.flatMap((entry) => [entry.label, entry.hint]),
        ...scenario.facts.routes.flatMap((route) => [route.label, route.consequence]),
      ].join(" ");
      expect(text, scenario.id).not.toMatch(forbidden);
    }
  });
});
