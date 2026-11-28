import { describe, expect, it } from "vitest";
import type { Item } from "../../shared/domain.js";
import { attributeRiskText, attributeSwapRisks, flatAttribute } from "../../shared/gearSwap.js";

function item(id: string, slot: Item["slot"], lines: string[], requirements?: Item["requirements"]): Item {
  return {
    id,
    name: id,
    baseType: id,
    slot,
    rarity: "rare",
    itemLevel: 30,
    modifiers: lines.map((text, index) => ({ id: `${id}-m${index}`, text, kind: "explicit" as const, values: [], verified: true })),
    sources: [],
    ...(requirements ? { requirements } : {}),
  };
}

describe("flatAttribute", () => {
  it("lee la línea plana en español y en inglés, con y sin rango", () => {
    expect(flatAttribute(item("a", "ring1", ["+17(15-20) a la destreza"]), "dex")).toBe(17);
    expect(flatAttribute(item("a", "ring1", ["+25 to Dexterity"]), "dex")).toBe(25);
    expect(flatAttribute(item("a", "ring1", ["+25 to Dexterity"]), "str")).toBe(0);
  });

  it("reparte una línea de dos atributos y la de todos los atributos", () => {
    const both = item("a", "amulet", ["+5 a la fuerza y a la inteligencia", "+3 a todos los atributos"]);
    expect(flatAttribute(both, "str")).toBe(8);
    expect(flatAttribute(both, "int")).toBe(8);
    expect(flatAttribute(both, "dex")).toBe(3);
    expect(flatAttribute(item("a", "amulet", ["+5 to Strength and Dexterity"]), "dex")).toBe(5);
  });

  it("no cuenta lo que cambia los requisitos de la pieza", () => {
    expect(flatAttribute(item("a", "body", ["Requisitos de atributos reducidos un 20%"]), "str")).toBe(0);
    expect(flatAttribute(item("a", "body", ["20% reduced Attribute Requirements"]), "str")).toBe(0);
  });

  it("no supone cero si una línea de atributos no se sabe leer", () => {
    expect(flatAttribute(item("a", "amulet", ["Fuerza aumentada un 6%"]), "str")).toBeNull();
    expect(flatAttribute(item("a", "amulet", ["+10 a la fuerza de los aliados en tu presencia"]), "str")).toBeNull();
  });
});

describe("attributeSwapRisks", () => {
  const worn = item("Anillo viejo", "ring1", ["+17 a la destreza"]);
  const found = item("Anillo nuevo", "ring1", ["+40 a la vida máxima"]);
  const gloves = item("Guantes de cazador", "gloves", [], { dex: 70 });
  const boots = item("Botas ligeras", "boots", [], { dex: 40 });
  const attributes = { str: 20, dex: 72, int: 15 };

  it("avisa de la pieza que se quedaría sin su requisito, con los cuatro números", () => {
    const risks = attributeSwapRisks(worn, found, [worn, gloves, boots], attributes);
    expect(risks).toEqual([
      { attribute: "dex", have: 72, loss: 17, remaining: 55, itemName: "Guantes de cazador", required: 70, isFound: false },
    ]);
    expect(attributeRiskText(risks[0]!, worn.name, "es")).toBe(
      "«Anillo viejo» te da destreza: sin ella bajas de 72 a 55, y «Guantes de cazador» pide 70. Míralo en el juego antes de cambiarla.",
    );
    expect(attributeRiskText(risks[0]!, worn.name, "en")).toContain("drop from 72 to 55");
  });

  it("descuenta lo que da la nueva", () => {
    const similar = item("Anillo parecido", "ring1", ["+15 a la destreza"]);
    expect(attributeSwapRisks(worn, similar, [worn, gloves], attributes)).toEqual([]);
  });

  it("mira también el requisito de la propia pieza nueva", () => {
    const needy = item("Anillo exigente", "ring1", [], { dex: 60 });
    const risks = attributeSwapRisks(worn, needy, [worn], attributes);
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ isFound: true, required: 60, remaining: 55 });
    expect(attributeRiskText(risks[0]!, worn.name, "es")).toContain("la propia pieza nueva pide 60");
  });

  it("se calla sin el atributo del personaje o con una línea que no sabe leer", () => {
    expect(attributeSwapRisks(worn, found, [worn, gloves], { str: null, dex: null, int: null })).toEqual([]);
    const odd = item("Anillo raro", "ring1", ["Destreza aumentada un 5%"]);
    expect(attributeSwapRisks(odd, found, [odd, gloves], attributes)).toEqual([]);
  });

  it("no repite lo que ya no cumplía antes del cambio", () => {
    const tooMuch = item("Peto pesado", "body", [], { dex: 90 });
    expect(attributeSwapRisks(worn, found, [worn, tooMuch], attributes)).toEqual([]);
  });
});
