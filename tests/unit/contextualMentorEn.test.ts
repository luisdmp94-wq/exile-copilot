import { describe, expect, it } from "vitest";
import type { Item, Recommendation } from "../../shared/domain.js";
import { classifyMentorQuestion } from "../../shared/mentorIntent.js";
import { contextualMentorCue, type ContextualMentorEvent } from "../../src/lib/contextualMentor.js";
import { englishMentorCue } from "../../src/lib/contextualMentorEn.js";

const item: Item = {
  id: "item-arma",
  slot: "weapon",
  name: "Doom Song",
  baseType: "Varnished Crossbow",
  rarity: "rare",
  modifiers: [],
  sources: [],
};

const recommendation = { id: "rec-res", priority: 1, title: "Cap your resistances" } as Recommendation;

const direction: ContextualMentorEvent = {
  type: "craftingCoachDirection",
  itemName: "Doom Song",
  playerGoal: "hit harder",
  // Así llegan si el aviso se lanzó en español y luego se cambió de idioma.
  directionLabel: "el daño",
  direction: "damage",
  nextStepTitle: "Exalted Orb",
  stepKind: "use-currency",
  focus: "physical",
  rollMinimum: "middle",
  rollMinimumLabel: "tirada media o alta",
  attemptLimit: 2,
  nextAction: "exalted",
  protectedLineCount: 2,
  unresolvedProtectionCount: 1,
  baseStatus: "controlled-attempt",
  baseVerdictTitle: "Worth one controlled attempt",
  baseVerdictSummary: "The currency is allowed, but it can't steer the result.",
};

/** Un aviso de cada clase: todos tienen que salir en inglés. */
const EVENTS: ContextualMentorEvent[] = [
  { type: "welcome" },
  { type: "ready", profileName: "Text" },
  { type: "profileIncomplete", profileName: "Text", missing: ["level"] },
  { type: "workspace", workspace: "guias" },
  { type: "workspace", workspace: "expediente" },
  { type: "workspace", workspace: "plan" },
  { type: "workspace", workspace: "crafting" },
  { type: "item", item },
  { type: "craftingItem", item },
  {
    type: "craftingCoachProject",
    itemName: "Doom Song",
    playerGoal: "a unique crossbow",
    intent: "unique-acquisition",
    reason: "You asked for a unique item; don't spend currency on this one out of habit.",
  },
  { type: "craftingCoachExample", itemName: "Doom Song", origin: "practice" },
  { type: "craftingCoachExample", itemName: "Doom Song" },
  direction,
  { ...direction, stepKind: "needs-data", nextStepTitle: "Item level" },
  { ...direction, stepKind: "stop", nextStepTitle: "Keep the item" },
  {
    type: "craftingCoachContract",
    itemName: "Doom Song",
    playerGoal: "hit harder",
    focus: "physical",
    focusLabel: "daño físico",
    rollMinimum: "high",
    rollMinimumLabel: "tirada alta",
    attemptLimit: 1,
    nextAction: "exalted",
  },
  {
    type: "craftingCoachResult",
    itemName: "Doom Song",
    playerGoal: "hit harder",
    headline: "The new line matches",
    verdict: "continue",
    decisionKind: "continue",
    verdictText: "The roll reaches your minimum.",
    nextStepTitle: "Exalted Orb",
    focus: "physical",
    rollMinimum: "any",
    rollMinimumLabel: "cualquier tirada",
    attemptCurrent: 1,
    attemptLimit: 3,
    attemptsRemaining: 2,
    nextAction: "exalted",
  },
  { type: "craftingGoal", itemName: "Doom Song", goal: "damage", currentCount: 3, nextTarget: 4 },
  { type: "craftingGoal", itemName: "Doom Song", goal: "defence", currentCount: 1, nextTarget: null },
  { type: "craftingGoal", itemName: "Doom Song", goal: "other", currentCount: 0, nextTarget: null },
  {
    type: "craftingStop",
    itemName: "Doom Song",
    criterionLabel: "Al menos 4 afijos de daño",
    criterion: { kind: "goal-affix-count", category: "damage", minimumCount: 4 },
  },
  { type: "craftingAction", itemName: "Doom Song", actionLabel: "Orbe exaltado", actionId: "exalted" },
  { type: "editor" },
  { type: "goal", goal: "survival" },
  { type: "budget", amount: 5, currency: "exalted" },
  { type: "league", league: "Standard" },
  { type: "recommendations", recommendations: [recommendation] },
  { type: "recommendations", recommendations: [] },
  { type: "market", quoteCount: 3, verifiedCount: 1, degraded: false },
  { type: "market", quoteCount: 1, verifiedCount: 0, degraded: true },
  { type: "tracked", title: "Cap your resistances" },
  { type: "session", title: "Cap your resistances" },
  { type: "profileSaved" },
  { type: "planImported", name: "Titan Warrior" },
  { type: "applied", title: "Cap your resistances" },
  { type: "invalidated" },
  { type: "sessionResult", title: "Cap your resistances" },
  { type: "sessionPaused", title: "Cap your resistances" },
  { type: "error", area: "mentor", message: "x" },
];

const SPANISH_LETTERS = /[ñ¿¡áéíóú«»]/;

describe("mascota del Mentor en inglés", () => {
  it("todos los avisos salen en inglés con el mismo id, tipo y pregunta que en español", () => {
    for (const event of EVENTS) {
      const english = englishMentorCue(event);
      const spanish = contextualMentorCue(event);
      const label = `${event.type}: ${english.title}`;
      expect(english.id, label).toBe(spanish.id);
      expect(english.source, label).toBe(spanish.source);
      expect(english.announce, label).toBe(spanish.announce);
      expect(english.ask?.intent, label).toBe(spanish.ask?.intent);
      expect(english.ask?.craftingState, label).toEqual(spanish.ask?.craftingState);
      expect(`${english.eyebrow} ${english.title} ${english.message}`, label).not.toMatch(SPANISH_LETTERS);
      expect(english.eyebrow, label).not.toBe(spanish.eyebrow);
      if (english.ask) {
        expect(english.ask.question, label).not.toMatch(SPANISH_LETTERS);
        // El servidor vuelve a clasificar la pregunta: debe dar la misma intención.
        expect(classifyMentorQuestion(english.ask.question).intent, english.ask.question).toBe(english.ask.intent);
      }
    }
  });

  it("rotula desde el id aunque el aviso se lanzara en español", () => {
    const cue = englishMentorCue(direction);
    expect(cue.title).toBe("Damage · Doom Song");
    expect(cue.message).toContain("a middle or high roll");
    expect(cue.message).toContain("2 steps");
    expect(cue.message).toContain("2 existing lines");
    expect(cue.message).toContain("1 protection still isn't linked");

    const action = englishMentorCue({
      type: "craftingAction",
      itemName: "Doom Song",
      actionLabel: "Orbe exaltado",
      actionId: "exalted",
    });
    expect(action.title).toBe("Exalted Orb");

    const stop = englishMentorCue({
      type: "craftingStop",
      itemName: "Doom Song",
      criterionLabel: "Al menos 4 afijos de daño",
      criterion: { kind: "goal-affix-count", category: "damage", minimumCount: 4 },
    });
    expect(stop.title).not.toMatch(/afijos/);
  });

  it("los valores por defecto del personaje no se cuelan en español", () => {
    expect(englishMentorCue({ type: "ready", profileName: "Nuevo personaje" }).title).toBe("New character is loaded");
    expect(
      englishMentorCue({ type: "profileIncomplete", profileName: "Nuevo personaje", missing: [] }).title,
    ).toContain("New character");
  });

  it("cuenta en singular y plural sin «(s)»", () => {
    const one = englishMentorCue({ type: "market", quoteCount: 1, verifiedCount: 1, degraded: false });
    const many = englishMentorCue({ type: "market", quoteCount: 3, verifiedCount: 2, degraded: false });
    expect(one.title).toBe("1 of 1 price verified");
    expect(many.title).toBe("2 of 3 prices verified");
  });
});
