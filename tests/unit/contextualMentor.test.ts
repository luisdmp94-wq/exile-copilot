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

  it("acompaña objetivo, parada y gasto de crafting sin prometer el resultado", () => {
    const goal = contextualMentorCue({
      type: "craftingGoal",
      itemName: "Núcleo de fénix",
      goal: "damage",
      currentCount: 3,
      nextTarget: 4,
    });
    const stop = contextualMentorCue({
      type: "craftingStop",
      itemName: "Núcleo de fénix",
      criterionLabel: "Al menos 4 afijos de daño",
    });
    const action = contextualMentorCue({
      type: "craftingAction",
      itemName: "Núcleo de fénix",
      actionLabel: "Orbe exaltado",
    });

    expect(goal.title).toBe("Daño en Núcleo de fénix");
    expect(goal.message).toContain("no que el afijo sea bueno");
    expect(stop.title).toBe("Al menos 4 afijos de daño");
    expect(stop.message).toContain("valoración final");
    expect(action.title).toBe("Orbe exaltado");
    expect(action.message).toContain("no predice");
  });

  it("reacciona a la dirección elegida en el guía con la pieza y el paso concretos", () => {
    const cue = contextualMentorCue({
      type: "craftingCoachDirection",
      itemName: "Núcleo de fénix",
      playerGoal: "quiero que haga más daño físico",
      directionLabel: "el daño",
      nextStepTitle: "Orbe exaltado",
      stepKind: "use-currency",
    });

    expect(cue.title).toContain("Núcleo de fénix");
    expect(cue.message).toContain("Orbe exaltado");
    expect(cue.message).toContain("más daño físico");
    expect(cue.ask?.question).toContain("Núcleo de fénix");
    expect(cue.ask?.question).toContain("Orbe exaltado");
  });

  it("si faltan datos no habla de gastar ni de aleatoriedad", () => {
    const cue = contextualMentorCue({
      type: "craftingCoachDirection",
      itemName: "Doom Song",
      playerGoal: "quiero más daño",
      directionLabel: "el daño",
      nextStepTitle: "Me falta ver bien la pieza",
      stepKind: "needs-data",
    });

    expect(cue.message).toContain("Antes de gastar");
    expect(cue.message).toContain("Completa ese dato");
    expect(cue.message).not.toMatch(/aleatoriedad|decidir si gastas/i);
  });

  it("tras pegar el resultado conserva el objetivo y la próxima decisión", () => {
    const cue = contextualMentorCue({
      type: "craftingCoachResult",
      itemName: "Doom Song",
      playerGoal: "quiero más daño físico",
      headline: "Ha aparecido un modificador nuevo",
      verdict: "continue",
      nextStepTitle: "Orbe exaltado",
    });

    expect(cue.source).toBe("engine");
    expect(cue.message).toContain("Orbe exaltado");
    expect(cue.message).toContain("más daño físico");
    expect(cue.ask?.question).toContain("continuar o parar");
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
      { type: "craftingItem", item },
      {
        type: "craftingCoachDirection",
        itemName: "Doom Song",
        playerGoal: "quiero más daño",
        directionLabel: "el daño",
        nextStepTitle: "Orbe exaltado",
        stepKind: "use-currency",
      },
      {
        type: "craftingCoachResult",
        itemName: "Doom Song",
        playerGoal: "quiero más daño",
        headline: "Ha aparecido un modificador nuevo",
        verdict: "continue",
        nextStepTitle: "Orbe exaltado",
      },
      {
        type: "craftingGoal",
        itemName: "Doom Song",
        goal: "damage",
        currentCount: 1,
        nextTarget: 2,
      },
      {
        type: "craftingStop",
        itemName: "Doom Song",
        criterionLabel: "Al menos 2 afijos de daño",
      },
      { type: "craftingAction", itemName: "Doom Song", actionLabel: "Orbe exaltado" },
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
