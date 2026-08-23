import { describe, expect, it } from "vitest";
import type { Item } from "../../shared/domain.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { buildCraftingMentorReading } from "../../src/lib/craftingMentorReading.js";

const bow: Item = {
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
    {
      id: "cold",
      kind: "explicit",
      affix: "prefix",
      tier: 1,
      text: "Agrega daño de hielo",
      tags: ["Daño", "Hielo", "Ataque"],
      values: [79, 117],
      verified: false,
    },
    {
      id: "dex",
      kind: "explicit",
      affix: "suffix",
      tier: 1,
      text: "+33 a la destreza",
      tags: ["Atributo"],
      values: [33],
      verified: false,
    },
  ],
  sources: [],
};

describe("lectura compacta del mentor de crafting", () => {
  it("separa coincidencias literales sin llamar malo a lo demás", () => {
    const result = buildCraftingMentorReading(bow, diagnoseCraftingItem(bow), "damage");
    expect(result.verdict).toBe("controlled-test");
    expect(result.matchingModifiers.map((modifier) => modifier.id)).toEqual(["cold"]);
    expect(result.unmatchedModifiers.map((modifier) => modifier.id)).toEqual(["dex"]);
    expect(result.protectCandidates).toHaveLength(2);
  });

  it("frena cuando la estructura del objeto aún no es fiable", () => {
    const partial = { ...bow, craftingState: undefined };
    const result = buildCraftingMentorReading(partial, diagnoseCraftingItem(partial), "damage");
    expect(result.verdict).toBe("wait");
    expect(result.verdictDetail).toContain("Faltan datos");
  });

  it("no invita a probar sobre el arco real lleno con afijos de grado alto", () => {
    const fullBow: Item = {
      ...bow,
      modifiers: [
        ...bow.modifiers,
        {
          id: "physical",
          kind: "explicit",
          affix: "prefix",
          tier: 5,
          text: "Daño físico aumentado",
          tags: ["Daño", "Físico", "Ataque"],
          values: [40],
          verified: false,
        },
        {
          id: "flat-physical",
          kind: "explicit",
          affix: "prefix",
          tier: 3,
          text: "Agrega daño físico",
          tags: ["Daño", "Físico", "Ataque"],
          values: [19, 37],
          verified: false,
        },
        {
          id: "speed",
          kind: "explicit",
          affix: "suffix",
          tier: 1,
          text: "Velocidad de ataque aumentada",
          tags: ["Velocidad", "Ataque"],
          values: [16],
          verified: false,
        },
        {
          id: "skills",
          kind: "explicit",
          affix: "suffix",
          tier: 3,
          text: "+2 al nivel de habilidades de proyectiles",
          tags: ["Habilidades", "Proyectiles"],
          values: [2],
          verified: false,
        },
      ],
    };
    const result = buildCraftingMentorReading(
      fullBow,
      diagnoseCraftingItem(fullBow),
      "damage",
    );

    expect(result.verdict).toBe("protect");
    expect(result.verdictLabel).toBe("No arriesgues aún");
    expect(result.verdictDetail).toContain("grado 1–2");
    expect(result.matchingModifiers.length).toBeGreaterThan(0);
  });
});
