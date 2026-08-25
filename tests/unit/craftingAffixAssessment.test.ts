import { describe, expect, it } from "vitest";
import { assessCraftingAffixes } from "../../shared/craftingAffixAssessment.js";
import { ItemSchema, type Modifier } from "../../shared/domain.js";

function mod(
  id: string,
  tags: string[] | undefined,
  tier: number | undefined,
  affix: "prefix" | "suffix",
): Modifier {
  return {
    id,
    text: `Modificador ${id}`,
    kind: "explicit",
    affix,
    ...(tags ? { tags } : {}),
    ...(tier ? { tier } : {}),
    values: [],
    verified: false,
  };
}

const bow = ItemSchema.parse({
  id: "soul-branch",
  name: "Rama de alma",
  itemClass: "Arcos",
  baseType: "Arco obliterador",
  slot: "weapon",
  rarity: "rare",
  itemLevel: 81,
  craftingState: {
    corrupted: false,
    mirrored: false,
    split: false,
    unidentified: false,
  },
  modifiers: [
    mod("cold", ["Daño", "Elemental", "Hielo", "Ataque"], 1, "prefix"),
    mod("phys-percent", ["Daño", "Físico", "Ataque"], 5, "prefix"),
    mod("phys-flat", ["Daño", "Físico", "Ataque"], 3, "prefix"),
    mod("dex", ["Atributo"], 1, "suffix"),
    mod("speed", undefined, 1, "suffix"),
    mod("skills", undefined, 3, "suffix"),
  ],
  sources: [],
});

describe("lectura observable de afijos", () => {
  it("encuentra el núcleo de daño del arco sin convertir etiquetas en DPS", () => {
    const result = assessCraftingAffixes(bow, "damage");

    expect(result.headline).toBe("3 afijos apuntan a daño");
    expect(result.alignedCount).toBe(3);
    expect(result.leadingAlignedCount).toBe(1);
    expect(result.clusters).toEqual([
      { tag: "Físico", count: 2 },
    ]);
    expect(result.entries.find((entry) => entry.modifier.id === "cold")?.kind).toBe(
      "protect-first",
    );
    expect(
      result.entries.find((entry) => entry.modifier.id === "cold")?.rollQuality.band,
    ).toBe("unknown");
    expect(JSON.stringify(result)).not.toMatch(/DPS estimado|probabilidad de éxito|precio/i);
  });

  it("separa el grado de la posición observada dentro del rango", () => {
    const physical = {
      ...mod("physical-roll", ["Daño", "Físico", "Ataque"], 5, "prefix"),
      text: "Agrega de 15(10-15) a 24(18-26) de daño físico",
    };
    const result = assessCraftingAffixes(
      ItemSchema.parse({ ...bow, modifiers: [physical] }),
      "damage",
    );
    const entry = result.entries[0];

    expect(entry?.kind).toBe("goal-aligned");
    expect(entry?.reason).toContain("grado 5");
    expect(entry?.rollQuality).toMatchObject({ band: "high", positionPercent: 88 });
  });

  it("no llama inútil a un grado alto que no coincide con el objetivo", () => {
    const result = assessCraftingAffixes(bow, "damage");
    const dexterity = result.entries.find((entry) => entry.modifier.id === "dex");

    expect(dexterity).toMatchObject({
      kind: "review-fit",
      label: "Revisa su encaje",
    });
    expect(dexterity?.reason).toContain("no coinciden directamente");
  });

  it("declara la falta de objetivo y conserva todos los afijos como contexto", () => {
    const result = assessCraftingAffixes(bow, "other");

    expect(result.headline).toBe("Define qué quieres conseguir");
    expect(result.alignedCount).toBe(0);
    expect(result.entries.every((entry) => entry.kind !== "goal-aligned")).toBe(true);
  });

  it("mantiene visibles las restricciones elegidas aunque no coincidan con el objetivo principal", () => {
    const result = assessCraftingAffixes(bow, "damage", ["speed", "skills"]);

    expect(result.protectedCount).toBe(2);
    expect(
      result.entries
        .filter((entry) => entry.protected)
        .map((entry) => entry.modifier.id),
    ).toEqual(["speed", "skills"]);
    expect(result.entries.find((entry) => entry.modifier.id === "speed")?.kind).toBe(
      "review-fit",
    );
  });
});
