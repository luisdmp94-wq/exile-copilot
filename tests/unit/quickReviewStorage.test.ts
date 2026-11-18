import { describe, expect, it } from "vitest";
import {
  QUICK_REVIEW_STORAGE_KEY,
  quickReviewKey,
  readQuickReviewForm,
  writeQuickReviewForm,
  type QuickReviewStore,
} from "../../src/lib/quickReviewStorage";

function fakeStore(initial: Record<string, string> = {}): QuickReviewStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("revisión rápida: lo escrito se recuerda por personaje", () => {
  it("lo de un personaje no aparece en otro", () => {
    const store = fakeStore();
    writeQuickReviewForm(store, "bruja", { level: "45", mainSkill: "Contagio" });
    expect(readQuickReviewForm(store, "arquera")).toEqual({});
    expect(readQuickReviewForm(store, "bruja")).toEqual({ level: "45", mainSkill: "Contagio" });
  });

  it("el borrador de la portada pasa al primer personaje sin copia, una sola vez", () => {
    const store = fakeStore();
    writeQuickReviewForm(store, null, { level: "12", fire: "20" });
    expect(readQuickReviewForm(store, "nueva")).toEqual({ level: "12", fire: "20" });
    // Ya es suyo: el siguiente personaje empieza limpio.
    expect(store.data.has(QUICK_REVIEW_STORAGE_KEY)).toBe(false);
    expect(readQuickReviewForm(store, "otra")).toEqual({});
    expect(readQuickReviewForm(store, "nueva")).toEqual({ level: "12", fire: "20" });
  });

  it("un personaje con copia propia no toca el borrador", () => {
    const store = fakeStore();
    writeQuickReviewForm(store, "bruja", { level: "45" });
    writeQuickReviewForm(store, null, { level: "3" });
    expect(readQuickReviewForm(store, "bruja")).toEqual({ level: "45" });
    expect(readQuickReviewForm(store, null)).toEqual({ level: "3" });
  });

  it("lo guardado antes de este cambio (una sola clave) no se pierde", () => {
    const store = fakeStore({ [QUICK_REVIEW_STORAGE_KEY]: JSON.stringify({ level: "45", mainSkill: "Contagio" }) });
    expect(readQuickReviewForm(store, "bruja")).toEqual({ level: "45", mainSkill: "Contagio" });
    expect(store.data.get(quickReviewKey("bruja"))).toBe(JSON.stringify({ level: "45", mainSkill: "Contagio" }));
  });

  it("basura en el almacenamiento no rompe nada", () => {
    const store = fakeStore({ [quickReviewKey("bruja")]: "{no es json", [quickReviewKey("x")]: JSON.stringify([1, 2]) });
    expect(readQuickReviewForm(store, "bruja")).toEqual({});
    expect(readQuickReviewForm(store, "x")).toEqual({});
    expect(readQuickReviewForm(fakeStore({ [quickReviewKey("y")]: JSON.stringify({ level: 45, act: "2" }) }), "y")).toEqual({ act: "2" });
  });
});
