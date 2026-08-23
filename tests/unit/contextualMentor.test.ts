import { describe, expect, it } from "vitest";
import type { Item, Recommendation } from "../../shared/domain.js";
import { classifyMentorQuestion } from "../../shared/mentorIntent.js";
import {
  contextualMentorCue,
  type ContextualMentorEvent,
} from "../../src/lib/contextualMentor.js";

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
    expect(cue.ask?.question).toContain("Doom Song");
    expect(cue.ask?.question).toContain("Arma");
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
    expect(cue.ask?.question).toContain("Cubrir resistencias");
  });

  it("usa una bienvenida honesta cuando todavía no existe personaje", () => {
    const cue = contextualMentorCue({ type: "welcome" });

    expect(cue.title).toBe("Necesito conocer a tu personaje");
    expect(cue.message).not.toContain("tu equipo");
    expect(cue.ask).toBeNull();
  });

  it("todas las consultas generadas declaran y cumplen una intención soportada", () => {
    const events: ContextualMentorEvent[] = [
      { type: "ready", profileName: "Demo" },
      { type: "workspace", workspace: "expediente" },
      { type: "workspace", workspace: "plan" },
      { type: "workspace", workspace: "crafting" },
      { type: "item", item },
      { type: "editor" },
      { type: "goal", goal: "survival" },
      { type: "budget", amount: 50, currency: "exalted" },
      { type: "league", league: "Runes of Aldur" },
      { type: "recommendations", recommendations: [recommendation] },
      { type: "recommendations", recommendations: [] },
      { type: "market", quoteCount: 2, verifiedCount: 1, degraded: false },
      { type: "tracked", title: "Cubrir resistencias" },
      { type: "session", title: "Probar botas" },
      { type: "profileSaved" },
      { type: "planImported", name: "Titan Warrior" },
      { type: "applied", title: "Cubrir resistencias" },
      { type: "invalidated" },
      { type: "sessionResult", title: "Probar botas" },
      { type: "sessionPaused", title: "Probar botas" },
    ];

    for (const event of events) {
      const ask = contextualMentorCue(event).ask;
      expect(ask, event.type).not.toBeNull();
      expect(classifyMentorQuestion(ask!.question).intent, ask!.question).toBe(ask!.intent);
    }
  });
});
