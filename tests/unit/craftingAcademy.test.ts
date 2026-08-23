import { describe, expect, it } from "vitest";
import {
  ACADEMY_CONCEPTS,
  ACADEMY_CONCEPT_IDS,
  CRAFTING_ACADEMY_CONTENT_VERSION,
  CRAFTING_ACADEMY_EXAM,
  CRAFTING_ACADEMY_LESSONS,
  allAcademyScenarios,
  pendingAcademyConcepts,
  resolveAcademyAnswer,
  type AcademyScenario,
} from "../../shared/craftingAcademy.js";
import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
} from "../../shared/craftingActions.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { ItemSchema } from "../../shared/domain.js";

const scenarios = allAcademyScenarios();

/** Texto visible de un escenario, para comprobar qué NO se afirma nunca. */
function allText(scenario: AcademyScenario): string {
  return [
    scenario.situation,
    scenario.question,
    scenario.explanation,
    scenario.misconception,
    ...scenario.why,
    ...scenario.options.flatMap((option) => [option.label, option.hint ?? ""]),
  ].join(" ");
}

describe("Academia de crafting — contenido del nivel básico", () => {
  it("cada escenario tiene una única respuesta correcta y coincide con el motor real", () => {
    expect(scenarios.length).toBeGreaterThan(0);
    for (const scenario of scenarios) {
      const resolution = resolveAcademyAnswer(scenario);
      expect(
        resolution.correctOptionIds,
        `escenario ${scenario.id}: el motor debe reconocer exactamente una opción correcta`,
      ).toHaveLength(1);
      expect(resolution.correctOptionIds[0], `escenario ${scenario.id}`).toBe(
        scenario.expectedOptionId,
      );
    }
  });

  it("la opción esperada existe y cada escenario ofrece entre 2 y 4 decisiones", () => {
    for (const scenario of scenarios) {
      expect(scenario.options.length, `escenario ${scenario.id}`).toBeGreaterThanOrEqual(2);
      expect(scenario.options.length, `escenario ${scenario.id}`).toBeLessThanOrEqual(4);
      const ids = scenario.options.map((option) => option.id);
      expect(new Set(ids).size, `escenario ${scenario.id}: ids repetidos`).toBe(ids.length);
      expect(ids, `escenario ${scenario.id}`).toContain(scenario.expectedOptionId);
    }
  });

  it("los objetos de ejercicio son válidos y declaran su procedencia sintética", () => {
    for (const scenario of scenarios) {
      expect(() => ItemSchema.parse(scenario.item)).not.toThrow();
      expect(scenario.item.sources.map((source) => source.label).join(" ")).toContain(
        "Ejercicio de aprendizaje",
      );
      // La lectura estructural del banco debe poder leerlos: si el diagnóstico
      // se bloqueara, el ejercicio estaría enseñando sobre un objeto imposible.
      const diagnosis = diagnoseCraftingItem(scenario.item);
      expect(diagnosis.unclassifiedExplicitCount, `escenario ${scenario.id}`).toBe(0);
    }
  });

  it("las explicaciones proceden del contenido versionado y tienen cuerpo", () => {
    expect(CRAFTING_ACADEMY_CONTENT_VERSION).toBe("basico-2026-08-23");
    for (const scenario of scenarios) {
      expect(scenario.explanation.length, `escenario ${scenario.id}`).toBeGreaterThan(40);
      expect(scenario.why.length, `escenario ${scenario.id}`).toBeGreaterThan(0);
      expect(scenario.misconception.length, `escenario ${scenario.id}`).toBeGreaterThan(20);
      expect(scenario.situation.length, `escenario ${scenario.id}`).toBeGreaterThan(20);
      // La corrección debe caber en pocas líneas: es una sesión, no un artículo.
      expect(scenario.explanation.length, `escenario ${scenario.id}`).toBeLessThan(320);
    }
  });

  it("la prosa no contiene ninguna cifra de probabilidad, precio ni DPS", () => {
    // Cualquier porcentaje, moneda o DPS en el TEXTO sería una afirmación que
    // las fuentes locales no respaldan. Los valores de los modificadores viven
    // en el objeto, no en la explicación, y por eso no entran aquí.
    const cifraProhibida = /\d+\s?%|\d+\s?(exaltado|divino|caos)s?\b|\bDPS\b/i;
    for (const scenario of scenarios) {
      expect(allText(scenario), `escenario ${scenario.id}`).not.toMatch(cifraProhibida);
    }
  });

  it("probabilidad, peso, pool, precio y «garantiza» solo aparecen negados", () => {
    const terminos =
      /(probabilidad|probabilidades|peso|pesos|pool|precio|precios|garantiza)/i;
    const negacion = /\b(no|ni|sin|nunca|jamás|tampoco)\b/i;
    for (const scenario of scenarios) {
      const frases = allText(scenario)
        .split(/(?<=[.:;!?])\s+/)
        .filter((frase) => terminos.test(frase));
      for (const frase of frases) {
        expect(
          negacion.test(frase),
          `escenario ${scenario.id}: «${frase.trim()}» usa el término en afirmativo`,
        ).toBe(true);
      }
    }
  });

  it("el recorrido cubre las cuatro monedas observadas y la decisión de parar", () => {
    const respuestas = new Set(scenarios.map((scenario) => scenario.expectedOptionId));
    for (const action of OBSERVED_CRAFTING_ACTIONS) {
      expect(respuestas, `falta ${action.id} como respuesta correcta`).toContain(action.id);
    }
    expect(respuestas).toContain("stop");
  });

  it("«Parar» es correcto exactamente cuando ninguna moneda ofrecida es compatible", () => {
    for (const scenario of scenarios) {
      const offered = scenario.options
        .map((option) => (option.check.kind === "action" ? option.check.actionId : null))
        .filter((value): value is (typeof OBSERVED_CRAFTING_ACTIONS)[number]["id"] => value !== null);
      const compatibles = evaluateObservedCraftingActions(scenario.item).filter(
        (evaluation) =>
          offered.includes(evaluation.action.id) && evaluation.status === "compatible",
      );
      if (scenario.expectedOptionId === "stop") {
        expect(compatibles, `escenario ${scenario.id}`).toHaveLength(0);
      } else if (scenario.options.some((option) => option.check.kind === "action")) {
        expect(compatibles.length, `escenario ${scenario.id}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("los distractores de tipo afirmación nunca son correctos", () => {
    const claims = scenarios.flatMap((scenario) =>
      scenario.options
        .filter((option) => option.check.kind === "claim")
        .map((option) => ({ scenario, option })),
    );
    expect(claims.length).toBeGreaterThan(0);
    for (const { scenario, option } of claims) {
      const resolution = resolveAcademyAnswer(scenario);
      const resolved = resolution.options.find((entry) => entry.optionId === option.id);
      expect(resolved?.correct, `${scenario.id}/${option.id}`).toBe(false);
    }
  });

  it("las cinco lecciones cubren los conceptos declarados y la prueba mezcla monedas y parar", () => {
    expect(CRAFTING_ACADEMY_LESSONS).toHaveLength(5);
    expect(CRAFTING_ACADEMY_EXAM.length).toBeGreaterThanOrEqual(5);
    expect(CRAFTING_ACADEMY_EXAM.length).toBeLessThanOrEqual(7);

    const usados = new Set(scenarios.map((scenario) => scenario.conceptId));
    for (const id of ACADEMY_CONCEPT_IDS) {
      expect(usados, `el concepto ${id} no aparece en ningún escenario`).toContain(id);
      expect(ACADEMY_CONCEPTS[id].label.length).toBeGreaterThan(3);
    }

    const respuestasExamen = CRAFTING_ACADEMY_EXAM.map((scenario) => scenario.expectedOptionId);
    expect(new Set(respuestasExamen)).toEqual(
      new Set(["transmutation", "augmentation", "regal", "exalted", "stop"]),
    );
  });

  it("cada escenario del examen tiene un concepto que la prueba puede señalar", () => {
    for (const scenario of CRAFTING_ACADEMY_EXAM) {
      expect(ACADEMY_CONCEPTS[scenario.conceptId]).toBeDefined();
    }
  });
});

describe("Academia de crafting — conceptos pendientes", () => {
  it("solo marca como pendiente lo respondido mal, nunca lo no respondido", () => {
    const [primero, segundo, tercero] = CRAFTING_ACADEMY_EXAM;
    const pendientes = pendingAcademyConcepts({
      [primero.id]: { correct: false },
      [segundo.id]: { correct: true },
      // `tercero` sigue sin responder: no puede contar como fallado.
    });
    expect(pendientes).toEqual([primero.conceptId]);
    expect(pendientes).not.toContain(segundo.conceptId);
    expect(pendientes).not.toContain(tercero.conceptId);
  });

  it("no repite un concepto aunque falle en varios escenarios", () => {
    const stops = CRAFTING_ACADEMY_EXAM.filter(
      (scenario) => scenario.expectedOptionId === "stop",
    );
    expect(stops.length).toBeGreaterThanOrEqual(2);
    const answers = Object.fromEntries(
      stops.map((scenario) => [scenario.id, { correct: false }]),
    );
    const pendientes = pendingAcademyConcepts(answers);
    expect(new Set(pendientes).size).toBe(pendientes.length);
  });

  it("un examen perfecto no deja conceptos pendientes", () => {
    const answers = Object.fromEntries(
      CRAFTING_ACADEMY_EXAM.map((scenario) => [scenario.id, { correct: true }]),
    );
    expect(pendingAcademyConcepts(answers)).toEqual([]);
  });

  it("acepta una tanda de repaso reducida sin arrastrar el resto del examen", () => {
    const soloUno = [CRAFTING_ACADEMY_EXAM[0]];
    const answers = { [CRAFTING_ACADEMY_EXAM[0].id]: { correct: true } };
    expect(pendingAcademyConcepts(answers, soloUno)).toEqual([]);
  });
});
