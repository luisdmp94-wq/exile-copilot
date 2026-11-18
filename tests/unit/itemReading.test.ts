import { describe, expect, it } from "vitest";
import { ItemSchema, type Item } from "../../shared/domain.js";
import { extractObservedModifierRolls } from "../../shared/craftingRollQuality.js";
import { readItemForPlayer } from "../../src/lib/itemReading.js";

const CLEAN = { corrupted: false, mirrored: false, split: false, unidentified: false };

function mod(id: string, text: string, affix: "prefix" | "suffix" = "suffix") {
  return { id, text, kind: "explicit" as const, values: [], verified: false, affix, observedRolls: extractObservedModifierRolls(text) };
}

function item(overrides: Record<string, unknown>): Item {
  return ItemSchema.parse({
    id: "pieza",
    name: "Paso del eco",
    baseType: "Botas de cuero",
    slot: "boots",
    rarity: "rare",
    itemLevel: 70,
    requirements: { level: 62 },
    modifiers: [],
    craftingState: CLEAN,
    sources: [],
    ...overrides,
  });
}

describe("lectura de una pieza para el jugador", () => {
  it("dice en una frase lo que da, con lo más importante primero", () => {
    const reading = readItemForPlayer(
      item({
        modifiers: [
          mod("a", "+18% a la resistencia al fuego"),
          mod("b", "+12% a la resistencia al hielo"),
          mod("c", "+25 a la vida máxima", "prefix"),
          mod("d", "15% de velocidad de movimiento aumentada", "prefix"),
        ],
      }),
    );

    expect(reading.headline).toBe("Da velocidad de movimiento, vida, resistencia al fuego y resistencia al hielo.");
    expect(reading.lines.map((line) => line.family)).toEqual(["res-fire", "res-cold", "life", "move"]);
    expect(reading.lines[0]).toMatchObject({ label: "Resistencia al fuego", meaning: "Recibes menos daño de fuego. El tope es 75 %." });
  });

  it("no confunde la vida de los esbirros con tu vida, ni un daño con una resistencia", () => {
    const reading = readItemForPlayer(
      item({
        slot: "amulet",
        modifiers: [
          mod("a", "Los esbirros tienen un 20% más de vida máxima"),
          mod("b", "Daño de fuego aumentado un 30%"),
          mod("c", "+1 al nivel de todas las habilidades de esbirros"),
        ],
      }),
    );

    expect(reading.lines.map((line) => line.family)).toEqual(["minions", "damage-type", "skills"]);
    expect(reading.headline).toBe("Da niveles de habilidad, mejoras de esbirros y daño de un tipo concreto.");
  });

  it("en un arma, el daño elemental plano es de ataque, no de hechizos", () => {
    const reading = readItemForPlayer(
      item({
        slot: "weapon",
        baseType: "Ballesta barnizada",
        modifiers: [
          mod("a", "Daño físico aumentado un 81(65-84)%", "prefix"),
          mod("b", "Agrega de 1 a 9(7-10) de daño de rayo", "prefix"),
          mod("c", "Velocidad de ataque aumentada un 13(11-13)%"),
          mod("d", "+49(41-60) a la precisión"),
          mod("e", "Radio de iluminación aumentado un 15%"),
        ],
      }),
    );

    expect(reading.lines.map((line) => line.family)).toEqual(["attacks", "attacks", "attacks", "attacks", "other"]);
    expect(reading.lines[1].meaning).toBe("Hace que esta arma pegue más o mejor.");
    expect(reading.headline).toBe("Da mejoras de ataque y más cosas.");
  });

  it("no explica mal una línea que solo se parece a algo conocido", () => {
    const reading = readItemForPlayer(
      item({
        slot: "ring1",
        modifiers: [
          mod("a", "El daño penetra un 10% de la resistencia al fuego"),
          mod("b", "+2% a la resistencia al fuego máxima"),
          mod("c", "Rompe un 20% más de armadura"),
          mod("d", "Gana un 12% del daño como daño de fuego adicional"),
          mod("e", "Los aliados en tu presencia tienen un 10% más de velocidad de ataque"),
          mod("f", "Damage Penetrates 10% Fire Resistance"),
        ],
      }),
    );

    expect(reading.lines.map((line) => line.family)).toEqual(["other", "other", "other", "other", "other", "other"]);
    expect(reading.lines.every((line) => line.meaning === "")).toBe(true);
  });

  it("solo opina de la tirada cuando el texto trae el rango", () => {
    const withRanges = readItemForPlayer(
      item({
        modifiers: [mod("a", "+44(31-45)% a la resistencia al fuego"), mod("b", "+31(31-45)% a la resistencia al rayo")],
      }),
    );
    expect(withRanges.hasRolls).toBe(true);
    expect(withRanges.lines.map((line) => line.roll)).toEqual(["high", "low"]);
    expect(withRanges.copyTip).toBeNull();

    const plain = readItemForPlayer(item({ modifiers: [mod("a", "+44% a la resistencia al fuego")] }));
    expect(plain.hasRolls).toBe(false);
    expect(plain.lines[0].roll).toBeNull();
    expect(plain.copyTip).toBe("Cópiala con Ctrl+Alt+C y te digo si sus números son altos o bajos.");
  });

  it("avisa de una pieza de nivel bajo", () => {
    const reading = readItemForPlayer(
      item({
        slot: "weapon",
        baseType: "Varita de hueso",
        requirements: { level: 18 },
        itemLevel: 20,
        modifiers: [mod("a", "+32 al maná máximo", "prefix"), mod("b", "+12% a la resistencia al hielo")],
      }),
    );

    expect(reading.notes[0]).toBe("Es de nivel 18: la cambiarás pronto. No gastes monedas caras en ella.");
  });

  it("una línea que no sabe clasificar se enseña tal cual, sin inventar para qué sirve", () => {
    const reading = readItemForPlayer(item({ modifiers: [mod("a", "Los enemigos explotan al morir con estilo")] }));

    expect(reading.lines[0]).toMatchObject({ family: "other", meaning: "", text: "Los enemigos explotan al morir con estilo" });
    expect(reading.headline).toBe("Da efectos que no sé clasificar.");
  });

  it("una pieza sin modificadores lo dice", () => {
    const reading = readItemForPlayer(item({ rarity: "normal", modifiers: [] }));

    expect(reading.headline).toBe("Todavía no tiene modificadores propios.");
    expect(reading.lines).toEqual([]);
    expect(reading.copyTip).toBeNull();
  });

  it("lee un objeto copiado en inglés y contesta en inglés", () => {
    const reading = readItemForPlayer(
      item({
        modifiers: [mod("a", "+40(36-40)% to Fire Resistance"), mod("b", "+85 to maximum Life", "prefix"), mod("c", "30% increased Movement Speed", "prefix")],
      }),
      "en",
    );

    expect(reading.headline).toBe("It gives movement speed, life and fire resistance.");
    expect(reading.lines[0]).toMatchObject({ family: "res-fire", label: "Fire resistance", roll: "high" });
    expect(`${reading.headline} ${reading.notes.join(" ")} ${reading.copyTip ?? ""} ${reading.lines.map((line) => `${line.label} ${line.meaning}`).join(" ")}`).not.toMatch(
      /[ñ¿¡áéíóú«»]/,
    );
  });
});
