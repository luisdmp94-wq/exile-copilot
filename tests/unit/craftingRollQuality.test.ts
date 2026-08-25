import { describe, expect, it } from "vitest";
import {
  assessObservedModifierRoll,
  extractObservedModifierRolls,
} from "../../shared/craftingRollQuality.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";

describe("calidad observable de una tirada", () => {
  it("lee la tirada física real y la sitúa solo dentro de sus rangos impresos", () => {
    const text = "Agrega de 15(10-15) a 24(18-26) de daño físico";
    const rolls = extractObservedModifierRolls(text);
    const quality = assessObservedModifierRoll({ text, observedRolls: rolls });

    expect(rolls).toEqual([
      { value: 15, min: 10, max: 15 },
      { value: 24, min: 18, max: 26 },
    ]);
    expect(quality).toMatchObject({
      band: "high",
      positionPercent: 88,
      observedCount: 2,
    });
    expect(quality.label).toBe("Tirada alta · 88% del rango");
    expect(quality.detail).not.toMatch(/probabilidad|DPS|pool/i);
  });

  it("distingue una tirada baja y no inventa calidad sin rango", () => {
    expect(
      assessObservedModifierRoll({ text: "Daño físico aumentado un 35(35-44)%" }),
    ).toMatchObject({ band: "low", positionPercent: 0 });
    expect(
      assessObservedModifierRoll({ text: "+2 al nivel de habilidades de proyectiles" }),
    ).toMatchObject({ band: "unknown", positionPercent: null });
  });

  it("el parser conserva grado y rangos del Ctrl+Alt+C", () => {
    const parsed = parseItemText([
      "Clase de objeto: Mazas a una mano",
      "Rareza: Raro",
      "Destructor de venganza",
      "Maza de procesión",
      "----------------",
      "## Nivel de objeto: 64",
      "----------------",
      '{ Mod. de prefijo "férreo" (Grado: 5) — Daño, Físico, Ataque }',
      "Agrega de 15(10-15) a 24(18-26) de daño físico",
    ].join("\n"));

    expect(parsed.item.modifiers[0]).toMatchObject({
      tier: 5,
      tags: ["Daño", "Físico", "Ataque"],
      observedRolls: [
        { value: 15, min: 10, max: 15 },
        { value: 24, min: 18, max: 26 },
      ],
    });
  });
});
