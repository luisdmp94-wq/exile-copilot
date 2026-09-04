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
