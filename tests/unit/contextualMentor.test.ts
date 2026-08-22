import { describe, expect, it } from "vitest";
import type { Item, Recommendation } from "../../shared/domain.js";
import { contextualMentorCue } from "../../src/lib/contextualMentor.js";

const item: Item = {
  id: "item-arma",
  slot: "weapon",
  name: "Doom Song",
  baseType: "Varnished Crossbow",
  rarity: "rare",
  modifiers: [],
  sources: [],
};

const recommendation = {
  id: "rec-resistencias",
  priority: 1,
  title: "Cubrir resistencias",
} as Recommendation;

describe("mentor contextual", () => {
  it("convierte la inspección de una pieza en una pregunta ligada al objeto", () => {
    const cue = contextualMentorCue({ type: "item", item });

    expect(cue.title).toBe("Doom Song");
    expect(cue.message).toContain("No juzgues la pieza aislada");
    expect(cue.question).toContain("Doom Song");
    expect(cue.question).toContain("Arma");
  });

  it("explica que cambiar objetivo invalida prioridades anteriores", () => {
    const cue = contextualMentorCue({ type: "goal", goal: "survival" });

    expect(cue.title).toBe("Supervivencia");
    expect(cue.message).toContain("dejan de ser vigentes");
  });

  it("mantiene la honestidad cuando el mercado está degradado", () => {
    const cue = contextualMentorCue({
      type: "market",
      quoteCount: 3,
      verifiedCount: 0,
      degraded: true,
    });

    expect(cue.title).toBe("0 de 3 precio(s) verificado(s)");
    expect(cue.message).toContain("nunca para justificar una compra irreversible");
  });

  it("convierte el resultado del motor en una única prioridad contextual", () => {
    const cue = contextualMentorCue({
      type: "recommendations",
      recommendations: [recommendation],
    });

    expect(cue.source).toBe("engine");
    expect(cue.title).toBe("Prioridad: Cubrir resistencias");
    expect(cue.question).toContain("Cubrir resistencias");
  });

  it("muestra la respuesta de IA sin fabricar un nuevo botón de consulta", () => {
    const cue = contextualMentorCue({
      type: "ai",
      answer: "Comprueba primero la resistencia al frío.",
    });

    expect(cue.source).toBe("ai");
    expect(cue.message).toBe("Comprueba primero la resistencia al frío.");
    expect(cue.question).toBeNull();
  });
});
