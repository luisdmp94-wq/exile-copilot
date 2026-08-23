import { describe, expect, it } from "vitest";
import { evaluateCraftingGoalSignal } from "../../shared/craftingGoal.js";
import type { Modifier } from "../../shared/domain.js";

function modifier(text: string, tags?: string[]): Modifier {
  return {
    id: text,
    text,
    kind: "explicit",
    values: [],
    verified: true,
    tags,
  };
}

describe("señal del objetivo de crafting", () => {
  it("detecta una coincidencia directa usando solo etiquetas literales", () => {
    const signal = evaluateCraftingGoalSignal("damage", [
      modifier("Agrega daño", [" Daño ", "Ataque"]),
    ]);

    expect(signal.status).toBe("direct");
    expect(signal.matchedTags).toEqual(["daño", "ataque"]);
  });

  it("no convierte una categoría distinta en un fracaso", () => {
    const signal = evaluateCraftingGoalSignal("damage", [
      modifier("+33 a la destreza", ["Atributo"]),
    ]);

    expect(signal.status).toBe("no-direct-signal");
    expect(signal.summary).toContain("interacción indirecta");
  });

  it("declara desconocido cuando el cliente no aporta etiquetas", () => {
    const signal = evaluateCraftingGoalSignal("speed", [
      modifier("Velocidad aumentada"),
    ]);

    expect(signal.status).toBe("unknown");
    expect(signal.summary).toContain("no significa que el modificador sea inútil");
  });

  it("no usa el texto del modificador como heurística oculta", () => {
    const signal = evaluateCraftingGoalSignal("damage", [
      modifier("Daño físico aumentado un 100%", ["Atributo"]),
    ]);

    expect(signal.status).toBe("no-direct-signal");
    expect(signal.matchedTags).toEqual([]);
  });

  it("conserva como libre la categoría otro", () => {
    const signal = evaluateCraftingGoalSignal("other", [
      modifier("Algo observado", ["Daño"]),
    ]);

    expect(signal.status).toBe("unknown");
    expect(signal.title).toBe("Sin categoría comparable");
  });
});
