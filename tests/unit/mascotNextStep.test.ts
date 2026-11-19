import { describe, expect, it } from "vitest";
import { mascotNextStep, reviewKnowsBasics } from "../../src/lib/mascotNextStep";

describe("el siguiente paso que propone la mascota", () => {
  it("sin personaje: crearlo", () => {
    expect(mascotNextStep({ hasProfile: false, itemCount: 0, reviewKnowsBasics: false })).toBe("create");
  });

  it("recién creado, sin equipo ni datos del juego: la revisión rápida", () => {
    expect(mascotNextStep({ hasProfile: true, itemCount: 0, reviewKnowsBasics: false })).toBe("review");
  });

  it("con la revisión contestada y sin equipo: pegar una pieza", () => {
    expect(mascotNextStep({ hasProfile: true, itemCount: 0, reviewKnowsBasics: true })).toBe("gear");
  });

  it("con equipo: ver la siguiente mejora, aunque no haya contestado la revisión", () => {
    expect(mascotNextStep({ hasProfile: true, itemCount: 3, reviewKnowsBasics: false })).toBe("plan");
    expect(mascotNextStep({ hasProfile: true, itemCount: 9, reviewKnowsBasics: true })).toBe("plan");
  });

  it("la revisión «sabe lo básico» con el acto y alguna resistencia", () => {
    expect(reviewKnowsBasics({})).toBe(false);
    expect(reviewKnowsBasics({ act: "2" })).toBe(false);
    expect(reviewKnowsBasics({ fire: "30" })).toBe(false);
    expect(reviewKnowsBasics({ act: "2", fire: "30" })).toBe(true);
    expect(reviewKnowsBasics({ act: " ", fire: "30" })).toBe(false);
    // La resistencia también vale si la web ya la conoce del personaje.
    expect(reviewKnowsBasics({ act: "3" }, { fire: null, cold: 12, lightning: null })).toBe(true);
    expect(reviewKnowsBasics({ act: "3" }, { fire: null, cold: null, lightning: null })).toBe(false);
  });
});
