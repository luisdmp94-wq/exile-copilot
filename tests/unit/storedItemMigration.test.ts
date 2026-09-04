import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { CharacterProfileSchema, type Modifier } from "../../shared/domain.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import {
  repairStoredItemImport,
  repairStoredItemImports,
} from "../../server/importers/storedItemMigration.js";

const distortedAmuletText = readFileSync(
  fileURLToPath(
    new URL("../../server/fixtures/distortedAmuletAdvanced.es.txt", import.meta.url),
  ),
  "utf8",
);

function legacyDistortedAmulet() {
  const current = parseItemText(distortedAmuletText).item;
  return {
    ...current,
    id: "legacy-distorted-amulet",
    modifiers: current.modifiers.map((modifier): Modifier =>
      modifier.kind === "enchant"
        ? { ...modifier, kind: "explicit", affix: undefined }
        : modifier,
    ),
  };
}

describe("migración de objetos importados guardados", () => {
  it("reprocesa el Amuleto distorsionado antiguo sin cambiar su identidad", () => {
    const legacy = legacyDistortedAmulet();
    expect(diagnoseCraftingItem(legacy).state).toBe("blocked");

    const repaired = repairStoredItemImport(legacy);

    expect(repaired).not.toBeNull();
    expect(repaired).toMatchObject({
      id: "legacy-distorted-amulet",
      name: "Amuleto distorsionado",
      slot: "amulet",
      rarity: "normal",
      itemLevel: 79,
    });
    expect(
      repaired!.modifiers.filter((modifier) => modifier.kind === "explicit"),
    ).toHaveLength(0);
    expect(
      repaired!.modifiers.filter((modifier) => modifier.kind === "enchant"),
    ).toHaveLength(2);
    expect(diagnoseCraftingItem(repaired!).state).toBe("complete");
  });

  it("migra el expediente de forma idempotente", () => {
    const profile = CharacterProfileSchema.parse({
      id: "legacy-profile",
      name: "Ritualista",
      characterClass: "Huntress",
      level: 90,
      league: "Runes of Aldur",
      patch: "0.5.4f",
      items: [legacyDistortedAmulet()],
      importedAt: "2026-08-29T00:00:00.000Z",
    });

    const first = repairStoredItemImports(profile);
    const second = repairStoredItemImports(first.profile);

    expect(first.repairedItemIds).toEqual(["legacy-distorted-amulet"]);
    expect(second.repairedItemIds).toEqual([]);
    expect(second.profile).toBe(first.profile);
  });

  it("no reemplaza una copia que continúa incompleta tras reprocesarla", () => {
    const legacy = {
      ...legacyDistortedAmulet(),
      rawText: [
        "Clase de objeto: Amuletos",
        "Rareza: Normal",
        "Amuleto distorsionado",
        "Asigna Daño de ataques y precisión — Valor fijo",
      ].join("\n"),
    };

    expect(repairStoredItemImport(legacy)).toBeNull();
  });
});
