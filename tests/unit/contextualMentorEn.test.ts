import { describe, expect, it } from "vitest";
import { contextualMentorCue, type ContextualMentorEvent } from "../../src/lib/contextualMentor.js";
import { englishMentorCue } from "../../src/lib/contextualMentorEn.js";

const TRANSLATED: ContextualMentorEvent[] = [
  { type: "welcome" },
  { type: "ready", profileName: "Text" },
  { type: "profileIncomplete", profileName: "Text", missing: ["nivel"] },
  { type: "workspace", workspace: "guias" },
  { type: "workspace", workspace: "expediente" },
  { type: "editor" },
  { type: "profileSaved" },
  { type: "error", area: "mentor", message: "x" },
];

describe("mascota del Mentor en inglés", () => {
  it("los avisos traducidos guardan el mismo id, tipo y pregunta que en español", () => {
    for (const event of TRANSLATED) {
      const english = englishMentorCue(event);
      const spanish = contextualMentorCue(event);
      expect(english, event.type).not.toBeNull();
      expect(english!.id).toBe(spanish.id);
      expect(english!.source).toBe(spanish.source);
      expect(english!.ask?.intent).toBe(spanish.ask?.intent);
      expect(Boolean(english!.ask)).toBe(Boolean(spanish.ask));
      expect(`${english!.title} ${english!.message} ${english!.eyebrow}`).not.toMatch(/[ñ¿¡áéíóú]/);
    }
  });

  it("lo que aún no está traducido devuelve null y se queda en español", () => {
    expect(englishMentorCue({ type: "workspace", workspace: "crafting" })).toBeNull();
    expect(englishMentorCue({ type: "league", league: "Standard" })).toBeNull();
  });
});
