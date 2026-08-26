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
      focus: "physical",
      rollMinimum: "middle",
      rollMinimumLabel: "tirada media o alta",
      attemptLimit: 2,
      nextAction: "exalted",
      protectedLineCount: 2,
      unresolvedProtectionCount: 1,
      baseStatus: "controlled-attempt",
      baseVerdictTitle: "Solo merece un intento controlado",
      baseVerdictSummary: "La moneda es legal, pero no dirige el resultado.",
    });

    expect(cue.title).toContain("Núcleo de fénix");
    expect(cue.message).toContain("Orbe exaltado");
    expect(cue.message).toContain("más daño físico");
    expect(cue.message).toContain("2 líneas existentes");
    expect(cue.message).toContain("1 protección sin vincular");
    expect(cue.message).toContain("tirada media o alta");
    expect(cue.message).toContain("2 pasos");
    expect(cue.ask?.question).toContain("Núcleo de fénix");
    expect(cue.ask?.question).toContain("Orbe exaltado");
    expect(cue.ask?.craftingState).toEqual({
      mode: "coach",
      focus: "physical",
      rollMinimum: "middle",
      attemptCurrent: 0,
      attemptLimit: 2,
      phase: "planning",
      decision: null,
      nextAction: "exalted",
    });
  });

  it("si faltan datos no habla de gastar ni de aleatoriedad", () => {
    const cue = contextualMentorCue({
      type: "craftingCoachDirection",
      itemName: "Doom Song",
      playerGoal: "quiero más daño",
      directionLabel: "el daño",
      nextStepTitle: "Me falta ver bien la pieza",
      stepKind: "needs-data",
      focus: "physical",
      rollMinimum: "middle",
      rollMinimumLabel: "tirada media o alta",
      attemptLimit: 1,
      nextAction: null,
      baseStatus: "needs-data",
      baseVerdictTitle: "Aún no puedo juzgar esta base",
      baseVerdictSummary: "Falta el texto avanzado completo.",
    });

    expect(cue.message).toContain("Antes de gastar");
    expect(cue.message).toContain("Completa ese dato");
    expect(cue.message).not.toMatch(/aleatoriedad|decidir si gastas/i);
  });

  it("reacciona al cambiar la tirada mínima y el límite de la base", () => {
    const cue = contextualMentorCue({
      type: "craftingCoachContract",
      itemName: "Núcleo de fénix",
      playerGoal: "quiero más daño físico",
      focus: "physical",
      focusLabel: "daño físico",
      rollMinimum: "high",
      rollMinimumLabel: "tirada alta",
      attemptLimit: 2,
      nextAction: "regal",
    });

    expect(cue.title).toBe("daño físico · tirada alta");
    expect(cue.message).toContain("2 pasos");
    expect(cue.message).toContain("no como probabilidad");
    expect(cue.ask?.question).toContain("Núcleo de fénix");
  });

  it("tras pegar el resultado conserva el objetivo y la próxima decisión", () => {
    const cue = contextualMentorCue({
      type: "craftingCoachResult",
      itemName: "Doom Song",
      playerGoal: "quiero más daño físico",
      headline: "Ha aparecido un modificador nuevo",
      verdict: "continue",
      decisionKind: "continue",
      verdictText: "El paso no cumple el objetivo, pero queda margen.",
      nextStepTitle: "Orbe exaltado",
      focus: "physical",
      rollMinimum: "middle",
      rollMinimumLabel: "tirada media o alta",
      attemptCurrent: 1,
      attemptLimit: 2,
      attemptsRemaining: 1,
      nextAction: "exalted",
    });

    expect(cue.source).toBe("engine");
    expect(cue.message).toContain("Orbe exaltado");
    expect(cue.message).toContain("más daño físico");
    expect(cue.message).toContain("Paso 1 de 2");
    expect(cue.message).toContain("Queda 1 paso");
    expect(cue.ask?.question).toContain("continuar, parar o cambiar de base");
  });

  it("resume el contrato avanzado completo sin transportar el texto libre del afijo", () => {
    const state = {
      mode: "advanced" as const,
      goalCategory: "damage" as const,
      buildIntent: {
        source: "target" as const,
        alignment: "aligned" as const,
        focuses: ["physical" as const],
        suggestedCategories: ["damage" as const],
      },
      protectedModifierCount: 2,
      stopCriteria: [
        { kind: "exact-modifier-text" as const, maximumTier: 6 },
      ],
      tool: "currency" as const,
      action: "exalted" as const,
      variant: "greater" as const,
      preflightConfirmed: true,
      stopAlreadyReached: false,
      ready: true,
      projectPhase: "finishing" as const,
      baseDecision: "continue" as const,
      attemptCount: 2,
      latestBranch: "salvage" as const,
    };
    const cue = contextualMentorCue({
      type: "craftingAdvancedPlan",
      itemName: "Doom Song",
      state,
    });

    expect(cue.title).toBe("Daño · Doom Song");
    expect(cue.message).toContain("encaje alineado con daño físico");
    expect(cue.message).toContain("2 líneas protegidas");
    expect(cue.message).toContain("1 condición de parada");
    expect(cue.message).toContain("Orbe exaltado");
    expect(cue.message).toContain("preflight están completos");
    expect(cue.message).toContain("Fase: cierre del craft");
    expect(cue.message).toContain("2 intentos registrados");
    expect(cue.message).toContain("resultado aprovechable");
    expect(cue.message).toContain("la base puede continuar");
    expect(cue.ask?.craftingState).toEqual(state);
    expect(JSON.stringify(cue.ask?.craftingState)).not.toContain("Daño físico aumentado");
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
        focus: "physical",
        rollMinimum: "middle",
        rollMinimumLabel: "tirada media o alta",
        attemptLimit: 1,
        nextAction: "exalted",
        baseStatus: "controlled-attempt",
        baseVerdictTitle: "Solo merece un intento controlado",
        baseVerdictSummary: "La moneda es legal, pero no dirige el resultado.",
      },
      {
        type: "craftingCoachContract",
        itemName: "Doom Song",
        playerGoal: "quiero más daño",
        focus: "physical",
        focusLabel: "daño físico",
        rollMinimum: "high",
        rollMinimumLabel: "tirada alta",
        attemptLimit: 2,
        nextAction: "exalted",
      },
      {
        type: "craftingCoachResult",
        itemName: "Doom Song",
        playerGoal: "quiero más daño",
        headline: "Ha aparecido un modificador nuevo",
        verdict: "continue",
        decisionKind: "continue",
        verdictText: "Queda un paso dentro del límite.",
        nextStepTitle: "Orbe exaltado",
        focus: "physical",
        rollMinimum: "middle",
        rollMinimumLabel: "tirada media o alta",
        attemptCurrent: 1,
        attemptLimit: 2,
        attemptsRemaining: 1,
        nextAction: "exalted",
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
