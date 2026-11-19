import { describe, expect, it } from "vitest";
import { hatRequested, isChristmasSeason } from "../../src/lib/season";

describe("gorro de Navidad de la mascota", () => {
  it("sale del 1 de diciembre al 6 de enero", () => {
    expect(isChristmasSeason(new Date(2026, 10, 30))).toBe(false);
    expect(isChristmasSeason(new Date(2026, 11, 1))).toBe(true);
    expect(isChristmasSeason(new Date(2026, 11, 11))).toBe(true);
    expect(isChristmasSeason(new Date(2026, 11, 31))).toBe(true);
    expect(isChristmasSeason(new Date(2027, 0, 6))).toBe(true);
    expect(isChristmasSeason(new Date(2027, 0, 7))).toBe(false);
    expect(isChristmasSeason(new Date(2027, 5, 15))).toBe(false);
  });

  it("?gorro=1 lo enseña antes de tiempo, para verlo", () => {
    expect(hatRequested("?gorro=1")).toBe(true);
    expect(hatRequested("?lang=en&hat=1")).toBe(true);
    expect(hatRequested("?gorro=0")).toBe(false);
    expect(hatRequested("")).toBe(false);
  });
});
