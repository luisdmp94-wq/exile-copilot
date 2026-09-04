import { describe, expect, it } from "vitest";
import {
  MAX_PERSISTED_MENTOR_TURNS,
  SaveMentorThreadRequestSchema,
} from "../../shared/mentorThreadPersistence.js";

describe("contrato de persistencia del Mentor", () => {
  it("rechaza turnos incompletos o con autoridad en el rol equivocado", () => {
    expect(
      SaveMentorThreadRequestSchema.safeParse({
        threadInputsKey: "inputs",
        turns: [{ id: "p", role: "player", text: "hola", answer: {} }],
      }).success,
    ).toBe(false);
    expect(
      SaveMentorThreadRequestSchema.safeParse({
        threadInputsKey: "inputs",
        turns: [{ id: "m", role: "mentor", text: "respuesta", answer: null }],
      }).success,
    ).toBe(false);
  });

  it("limita el hilo estable a ocho turnos", () => {
    const turns = Array.from({ length: MAX_PERSISTED_MENTOR_TURNS + 1 }, (_, index) => ({
      id: `p-${index}`,
      role: "player",
      text: "pregunta",
      answer: null,
    }));
    expect(
      SaveMentorThreadRequestSchema.safeParse({
        threadInputsKey: "inputs",
        turns,
      }).success,
    ).toBe(false);
  });
});
