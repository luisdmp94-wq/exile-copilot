import { describe, expect, it } from "vitest";
import { mentorReviewAnswer } from "../../src/lib/mentorReviewAnswer.js";
import type { QuickReviewFinding } from "../../shared/quickReview.js";

const finding = (id: string, severity: number): QuickReviewFinding => ({ id, severity, title: id, action: id });

// Como el personaje de ejemplo sin equipo: el arma frena más que las resistencias.
const review = {
  top: [finding("weapon", 90), finding("gem", 80), finding("asc-first", 85)],
  rest: [finding("res", 60)],
};
const ids = (result: ReturnType<typeof mentorReviewAnswer>) => result.findings.map((item) => item.id);

describe("mentorReviewAnswer: sin equipo, la respuesta depende de la pregunta", () => {
  it("«¿Por qué muero tanto?» pone primero las resistencias aunque no sean lo que más frena", () => {
    const answer = mentorReviewAnswer(review, "¿Por qué muero tanto?");
    expect(answer.mode).toBe("survival");
    expect(ids(answer)).toEqual(["res", "weapon", "gem"]);
    expect(mentorReviewAnswer(review, "Why do I keep dying?").mode).toBe("survival");
  });

  it("«me falta daño» da solo lo que hace pegar más, sin resistencias", () => {
    const withRes = { top: [finding("res", 95), finding("gem", 80)], rest: [finding("asc-first", 70), finding("weapon", 60)] };
    const answer = mentorReviewAnswer(withRes, "me falta daño");
    expect(answer.mode).toBe("damage");
    expect(ids(answer)).toEqual(["gem", "asc-first", "weapon"]);
    expect(mentorReviewAnswer(withRes, "I need more damage").mode).toBe("damage");
  });

  it("si no hay nada de daño que decir, no promete «por qué te falta daño»", () => {
    const answer = mentorReviewAnswer({ top: [finding("res", 90)], rest: [] }, "me falta daño");
    expect(answer.mode).toBe("list");
    expect(ids(answer)).toEqual(["res"]);
  });

  it("«¿Cuál es mi principal problema?» da solo el primero", () => {
    const answer = mentorReviewAnswer(review, "¿Cuál es mi principal problema?");
    expect(answer.mode).toBe("main");
    expect(ids(answer)).toEqual(["weapon"]);
    expect(mentorReviewAnswer(review, "What's my main problem?").mode).toBe("main");
  });

  it("«¿Qué mejoro ahora?» y sin pregunta: los 3 que más frenan", () => {
    expect(mentorReviewAnswer(review, "¿Qué mejoro ahora?")).toEqual({ mode: "list", findings: review.top });
    expect(mentorReviewAnswer(review, null)).toEqual({ mode: "list", findings: review.top });
  });

  it("si no hay nada de aguante que decir, no promete «por qué mueres»", () => {
    const answer = mentorReviewAnswer({ top: review.top, rest: [] }, "¿Por qué muero tanto?");
    expect(answer.mode).toBe("list");
    expect(ids(answer)).toEqual(["weapon", "gem", "asc-first"]);
  });

  it("sin hallazgos devuelve la lista vacía, sin modo especial", () => {
    expect(mentorReviewAnswer({ top: [], rest: [] }, "¿Cuál es mi principal problema?")).toEqual({ mode: "list", findings: [] });
  });
});
