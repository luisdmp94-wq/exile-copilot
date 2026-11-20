import { describe, expect, it } from "vitest";
import { reviewCharacter } from "../../shared/quickReview.js";
import { CharacterProfileSchema, PLACEHOLDER_CHARACTER_LEVEL } from "../../shared/domain.js";
import { EMPTY, quickReviewFormFor, toInput } from "../../src/lib/quickReviewForm";
import { QUICK_REVIEW_STORAGE_KEY, peekQuickReviewForm, quickReviewKey } from "../../src/lib/quickReviewStorage";

function profile(overrides: Record<string, unknown> = {}) {
  return CharacterProfileSchema.parse({
    id: "bruja",
    name: "Mi bruja",
    characterClass: "Bruja",
    level: PLACEHOLDER_CHARACTER_LEVEL,
    levelSource: "placeholder",
    league: "Runes of Aldur",
    patch: "0.5.5",
    importedAt: "2026-11-19T00:00:00.000Z",
    ...overrides,
  });
}

describe("el formulario de la revisión rápida, fuera de su tarjeta", () => {
  it("sin personaje ni nada escrito, está vacío", () => {
    expect(quickReviewFormFor(null, {})).toEqual(EMPTY);
  });

  it("lo que escribe el jugador manda sobre lo que sabe la web; lo vacío no pisa nada", () => {
    const form = quickReviewFormFor(profile({ resistances: { fire: 10, cold: null, lightning: null, chaos: null } }), {
      fire: "35",
      cold: "  ",
      act: "2",
    });
    expect(form.fire).toBe("35");
    expect(form.cold).toBe("");
    expect(form.act).toBe("2");
  });

  it("un nivel de relleno no cuenta como nivel conocido", () => {
    expect(quickReviewFormFor(profile(), {}).level).toBe("");
  });

  it("con un arma única equipada, el nivel de objeto va vacío aunque quedara uno guardado", () => {
    const weapon = (rarity: string) => ({
      id: "arma",
      name: "Mordida de destino",
      baseType: "Varita marchita",
      slot: "weapon",
      rarity,
      itemLevel: 76,
    });
    // Única: ni lo que sabe la web ni lo guardado de un arma anterior.
    const unique = profile({ items: [weapon("unique")] });
    expect(quickReviewFormFor(unique, {}).weapon).toBe("");
    expect(quickReviewFormFor(unique, { weapon: "76", act: "3" }).weapon).toBe("");
    expect(quickReviewFormFor(unique, { weapon: "76", act: "3" }).act).toBe("3");
    expect(toInput(quickReviewFormFor(unique, { weapon: "76" })).weaponItemLevel).toBeNull();
    // Rara: se sigue usando, y lo que escribe el jugador manda.
    const rare = profile({ items: [weapon("rare")] });
    expect(quickReviewFormFor(rare, {}).weapon).toBe("76");
    expect(quickReviewFormFor(rare, { weapon: "40" }).weapon).toBe("40");
    // Sin arma guardada no se toca lo escrito.
    expect(quickReviewFormFor(profile(), { weapon: "40" }).weapon).toBe("40");
  });

  it("un número imposible no llega a las reglas", () => {
    const input = toInput({ ...EMPTY, level: "300", fire: "abc", act: "3" });
    expect(input.level).toBeNull();
    expect(input.resistances.fire).toBeNull();
    expect(input.act).toBe(3);
  });

  it("recién creado, la revisión pide datos; con ellos, encuentra las resistencias cortas", () => {
    const fresh = reviewCharacter(toInput(quickReviewFormFor(profile(), {})), "es");
    expect(fresh.top).toEqual([]);
    expect(fresh.missingKeys).toContain("level");

    const filled = reviewCharacter(
      toInput(quickReviewFormFor(profile(), { level: "30", act: "3", fire: "-10", cold: "0", lightning: "5" })),
      "es",
    );
    expect(filled.top.length).toBeGreaterThan(0);
  });
});

describe("mirar la revisión guardada sin tocarla", () => {
  const store = (data: Record<string, string>) => ({ getItem: (key: string) => data[key] ?? null });

  it("ve la copia del personaje", () => {
    expect(peekQuickReviewForm(store({ [quickReviewKey("bruja")]: JSON.stringify({ act: "2" }) }), "bruja")).toEqual({ act: "2" });
  });

  it("sin copia propia ve el borrador de la portada, y no lo mueve", () => {
    const data = { [QUICK_REVIEW_STORAGE_KEY]: JSON.stringify({ level: "12" }) };
    expect(peekQuickReviewForm(store(data), "nueva")).toEqual({ level: "12" });
    expect(Object.keys(data)).toEqual([QUICK_REVIEW_STORAGE_KEY]);
  });

  it("con copia propia no mira el borrador", () => {
    const data = {
      [quickReviewKey("bruja")]: JSON.stringify({ level: "45" }),
      [QUICK_REVIEW_STORAGE_KEY]: JSON.stringify({ level: "3" }),
    };
    expect(peekQuickReviewForm(store(data), "bruja")).toEqual({ level: "45" });
  });
});
