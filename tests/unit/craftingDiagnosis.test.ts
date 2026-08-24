import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import type { Item } from "../../shared/domain.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";

const crossbowText = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/phoenixCoreCrossbowAdvanced.es.txt", import.meta.url)),
  "utf8",
);
const bowText = readFileSync(
  fileURLToPath(
    new URL("../../docs/evidence/crafting/2026-08-22/soul-branch-advanced.es.txt", import.meta.url),
  ),
  "utf8",
);

describe("diagnoseCraftingItem", () => {
  it("resume la ballesta real sin deducir un hueco de prefijo o sufijo", () => {
    const item = parseItemText(crossbowText).item;
    const diagnosis = diagnoseCraftingItem(item);

    expect(diagnosis).toMatchObject({
      state: "complete",
      prefixCount: 3,
      suffixCount: 2,
      explicitCount: 5,
      auxiliaryCount: 0,
      observedTotalLimit: 6,
      observedOpenSlots: 1,
      blockers: [],
    });
    expect(diagnosis.summary).toContain("1 hueco total");
    expect(diagnosis.summary).not.toMatch(/hueco de (prefijo|sufijo)/i);
  });

  it("bloquea acciones de adición cuando el arco observado ya tiene seis afijos", () => {
    const item = parseItemText(bowText).item;
    const diagnosis = diagnoseCraftingItem(item);

    expect(diagnosis).toMatchObject({
      state: "complete",
      prefixCount: 3,
      suffixCount: 3,
      explicitCount: 6,
      auxiliaryCount: 3,
      observedOpenSlots: 0,
    });
    expect(diagnosis.nextAction).toContain("bloquear acciones");
  });

  it("considera completo un objeto normal bien identificado y lo dirige a Transmutación", () => {
    const item: Item = {
      id: "normal",
      name: "Base normal",
      baseType: "Ballesta",
      slot: "weapon",
      rarity: "normal",
      itemLevel: 25,
      modifiers: [],
      craftingState: {
        corrupted: false,
        mirrored: false,
        split: false,
        unidentified: false,
      },
      sources: [],
    };

    const diagnosis = diagnoseCraftingItem(item);
    expect(diagnosis).toMatchObject({
      state: "complete",
      explicitCount: 0,
      observedTotalLimit: null,
      observedOpenSlots: null,
      blockers: [],
    });
    expect(diagnosis.summary).toContain("Objeto normal");
    expect(diagnosis.nextAction).toContain("Transmutación");
  });

  it("no declara una pieza lista si faltan sus estados especiales", () => {
    const item = parseItemText(crossbowText).item;
    delete item.craftingState;

    const diagnosis = diagnoseCraftingItem(item);
    expect(diagnosis.state).toBe("partial");
    expect(diagnosis.blockers).toContain(
      "El texto no confirma todavía los estados especiales que pueden impedir el crafting.",
    );
    expect(diagnosis.nextAction).toContain("confirmar si puede modificarse");
  });

  it("declara lectura parcial si el texto no identifica prefijos y sufijos", () => {
    const item: Item = {
      id: "simple",
      name: "Objeto parcial",
      baseType: "Ballesta",
      slot: "weapon",
      rarity: "rare",
      itemLevel: 50,
      modifiers: [
        {
          id: "unknown-affix",
          text: "+20 a la vida máxima",
          kind: "explicit",
          values: [20],
          verified: false,
        },
      ],
      craftingState: {
        corrupted: false,
        mirrored: false,
        split: false,
        unidentified: false,
      },
      sources: [],
    };

    const diagnosis = diagnoseCraftingItem(item);
    expect(diagnosis.state).toBe("partial");
    expect(diagnosis.unclassifiedExplicitCount).toBe(1);
    expect(diagnosis.blockers[0]).toContain("sin clasificar");
    expect(diagnosis.nextAction).toContain("descripciones avanzadas");
    expect(diagnosis.nextAction).toContain("prefijo y sufijo");
  });

  it("dice exactamente que falta el nivel de objeto cuando ese es el dato ausente", () => {
    const item = parseItemText(crossbowText).item;
    delete item.itemLevel;

    const diagnosis = diagnoseCraftingItem(item);
    expect(diagnosis.state).toBe("blocked");
    expect(diagnosis.nextAction).toContain("Nivel de objeto");
    expect(diagnosis.blockers).toContain("Falta el nivel de objeto.");
  });

  it("no inventa capacidad para rarezas fuera del alcance inicial", () => {
    const item: Item = {
      id: "unique",
      name: "Único",
      baseType: "Objeto único",
      slot: "other",
      rarity: "unique",
      itemLevel: 70,
      modifiers: [],
      sources: [],
    };

    const diagnosis = diagnoseCraftingItem(item);
    expect(diagnosis.state).toBe("blocked");
    expect(diagnosis.observedTotalLimit).toBeNull();
    expect(diagnosis.observedOpenSlots).toBeNull();
  });
});
