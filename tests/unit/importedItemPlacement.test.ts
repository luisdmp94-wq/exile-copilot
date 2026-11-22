import { describe, expect, it } from "vitest";
import { ItemSchema, type Item } from "../../shared/domain.js";
import {
  planImportedItemPlacement,
  replaceImportedItem,
} from "../../src/lib/importedItemPlacement.js";

function item(id: string, slot: Item["slot"], name = id): Item {
  return ItemSchema.parse({
    id,
    name,
    baseType: "Base",
    slot,
    rarity: "rare",
  });
}

describe("colocación segura de objetos importados", () => {
  it("añade una pieza cuando su hueco está vacío", () => {
    const result = planImportedItemPlacement([], item("nuevo", "helmet"));
    expect(result).toEqual(expect.objectContaining({ kind: "append" }));
  });

  it("no sustituye ni oculta una pieza cuando el hueco ya está ocupado", () => {
    const equipado = item("actual", "helmet", "Casco actual");
    const result = planImportedItemPlacement(
      [equipado],
      item("nuevo", "helmet", "Casco nuevo"),
    );
    expect(result).toEqual({
      kind: "collision",
      item: expect.objectContaining({ id: "nuevo" }),
      candidates: [equipado],
    });
  });

  it("coloca dos anillos en huecos distintos y pide decidir al llegar un tercero", () => {
    const primero = item("r1", "ring1", "Anillo uno");
    const segundo = item("r2", "ring1", "Anillo dos");
    const colocado = planImportedItemPlacement([primero], segundo);
    expect(colocado).toEqual({
      kind: "append",
      item: expect.objectContaining({ id: "r2", slot: "ring2" }),
    });

    const tercero = item("r3", "ring1", "Anillo tres");
    const collision = planImportedItemPlacement(
      [primero, { ...segundo, slot: "ring2" }],
      tercero,
    );
    expect(collision.kind).toBe("collision");
    if (collision.kind === "collision") {
      expect(collision.candidates.map((candidate) => candidate.id)).toEqual(["r1", "r2"]);
    }
  });

  it("un arma de una mano va a la mano secundaria si la principal está ocupada", () => {
    const varita = { ...item("varita", "weapon", "La pluma cruel"), itemClass: "Varitas" };
    const cetro = { ...item("cetro", "weapon", "Clamor del vórtice"), itemClass: "Cetros" };
    expect(planImportedItemPlacement([varita], cetro)).toEqual({
      kind: "append",
      item: expect.objectContaining({ id: "cetro", slot: "offhand" }),
    });
    // Sin arma, la primera va a la mano principal.
    expect(planImportedItemPlacement([], cetro)).toEqual({
      kind: "append",
      item: expect.objectContaining({ id: "cetro", slot: "weapon" }),
    });
    // También en inglés y por la base si falta la clase.
    const daga = item("daga", "weapon", "Daga");
    const dagger = { ...daga, baseType: "Glass Shank", itemClass: "Daggers" };
    expect(planImportedItemPlacement([varita], dagger).kind).toBe("append");
    const sinClase = { ...item("w2", "weapon"), baseType: "Withered Wand" };
    expect(planImportedItemPlacement([varita], sinClase)).toEqual({
      kind: "append",
      item: expect.objectContaining({ slot: "offhand" }),
    });
  });

  it("con las dos manos ocupadas pregunta cuál sustituir", () => {
    const varita = { ...item("varita", "weapon"), itemClass: "Varitas" };
    const foco = { ...item("foco", "offhand"), itemClass: "Focos" };
    const cetro = { ...item("cetro", "weapon"), itemClass: "Cetros" };
    const result = planImportedItemPlacement([varita, foco], cetro);
    expect(result.kind).toBe("collision");
    if (result.kind === "collision") {
      expect(result.candidates.map((candidate) => candidate.id)).toEqual(["varita", "foco"]);
    }
  });

  it("las armas a dos manos no van a la mano secundaria", () => {
    const bastonActual = { ...item("b1", "weapon"), itemClass: "Bastones" };
    const varita = { ...item("varita", "weapon"), itemClass: "Varitas" };
    const ballesta = { ...item("ballesta", "weapon"), itemClass: "Ballestas" };
    // Una ballesta nueva choca con el arma, no se cuela en la secundaria.
    expect(planImportedItemPlacement([varita], ballesta)).toEqual({
      kind: "collision",
      item: expect.objectContaining({ id: "ballesta" }),
      candidates: [varita],
    });
    // Con un bastón en la mano, una varita tampoco va a la secundaria.
    expect(planImportedItemPlacement([bastonActual], varita).kind).toBe("collision");
  });

  it("agrupa frascos y conserva objetos sin hueco sin pedir una sustitución falsa", () => {
    expect(
      planImportedItemPlacement([item("f1", "flask")], item("f2", "flask")).kind,
    ).toBe("append");
    expect(
      planImportedItemPlacement([item("o1", "other")], item("o2", "other")).kind,
    ).toBe("append");
  });

  it("al sustituir conserva el id y el hueco del objeto elegido", () => {
    const result = replaceImportedItem(
      [item("actual", "ring2", "Anillo actual")],
      item("nuevo", "ring1", "Anillo nuevo"),
      "actual",
    );
    expect(result?.replacement).toEqual(
      expect.objectContaining({ id: "actual", slot: "ring2", name: "Anillo nuevo" }),
    );
    expect(result?.items).toEqual([result?.replacement]);
  });
});
