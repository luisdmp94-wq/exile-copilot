import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assessCharacterReadiness } from "../../shared/characterReadiness.js";
import {
  isEquippedItem,
  withEquippedItemsOnly,
  type CharacterProfile,
  type Item,
} from "../../shared/domain.js";
import { emptySlotsRule } from "../../server/engine/rules.js";
import { buildEquipmentLayout } from "../../src/lib/equipment.js";
import { planImportedItemPlacement } from "../../src/lib/importedItemPlacement.js";
import { marketName } from "../../src/lib/marketNames.js";

/**
 * Revisión del 26-11-2026: pegar una pieza para analizarla la «equipaba», y la
 * web llamaba vacío a todo hueco que aún no había visto. Una bruja de nivel 9
 * acababa con una maza de nivel 54 y el consejo «rellena los huecos vacíos».
 */

function item(partial: Partial<Item> & Pick<Item, "id" | "slot">): Item {
  return {
    name: `Pieza ${partial.id}`,
    baseType: "Base de prueba",
    rarity: "magic",
    modifiers: [],
    sources: [],
    ...partial,
  };
}

function demoProfile(): CharacterProfile {
  const raw = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)), "utf8"),
  );
  return (raw.profile ?? raw) as CharacterProfile;
}

describe("una pieza que solo se mira no es equipo", () => {
  const helmet = item({ id: "casco", slot: "helmet" });
  const looking = item({ id: "maza", slot: "weapon", equipped: false });

  it("solo es falso cuando el jugador dijo que no la lleva", () => {
    expect(isEquippedItem(helmet)).toBe(true);
    expect(isEquippedItem({ equipped: true })).toBe(true);
    expect(isEquippedItem(looking)).toBe(false);
  });

  it("no ocupa un hueco del panel: va aparte", () => {
    const layout = buildEquipmentLayout([helmet, looking]);
    expect(layout.cells.find((cell) => cell.slot === "weapon")?.item).toBeNull();
    expect(layout.cells.find((cell) => cell.slot === "helmet")?.item?.id).toBe("casco");
    expect(layout.extraItems.map((extra) => extra.id)).toEqual(["maza"]);
    expect(layout.filledCount).toBe(1);
  });

  it("no choca con el arma que el jugador pega después en su equipo", () => {
    const placement = planImportedItemPlacement([looking], item({ id: "varita", slot: "weapon" }));
    expect(placement.kind).toBe("append");
  });

  it("no cuenta como equipo observado", () => {
    const profile = { ...demoProfile(), items: [looking] };
    expect(assessCharacterReadiness(profile).equippedItemCount).toBe(0);
  });

  it("el motor y el Mentor reciben solo lo que lleva puesto", () => {
    const profile = { ...demoProfile(), items: [helmet, looking] };
    expect(withEquippedItemsOnly(profile).items.map((entry) => entry.id)).toEqual(["casco"]);
    const allWorn = { ...demoProfile(), items: [helmet] };
    expect(withEquippedItemsOnly(allWorn)).toBe(allWorn);
  });
});

describe("huecos que la web no ha visto no son huecos vacíos", () => {
  it("con dos piezas pegadas no afirma que falten las demás", () => {
    const base = demoProfile();
    const pasted = { ...base, pobImport: undefined, items: base.items.slice(0, 2) };
    expect(emptySlotsRule({ profile: pasted, league: "Standard", patch: "0.5.5" })).toEqual([]);
  });

  it("con el equipo entero importado de PoB sí nombra el hueco vacío", () => {
    const base = demoProfile();
    const imported = {
      ...base,
      items: base.items.slice(0, 2),
      pobImport: base.pobImport ?? ({} as NonNullable<CharacterProfile["pobImport"]>),
    };
    const [candidate] = emptySlotsRule({ profile: imported, league: "Standard", patch: "0.5.5" });
    expect(candidate?.ruleId).toBe("huecos-equipo");
  });
});

describe("nombres de moneda para poe.ninja", () => {
  it("traduce las monedas en español que escribe el jugador", () => {
    expect(marketName("Orbe exaltado")).toBe("Exalted Orb");
    expect(marketName("  orbes exaltados ")).toBe("Exalted Orb");
    expect(marketName("Orbe de transmutación")).toBe("Orb of Transmutation");
    expect(marketName("Orbe del caos")).toBe("Chaos Orb");
    expect(marketName("orbe divino")).toBe("Divine Orb");
  });

  it("deja como estaba lo que no reconoce", () => {
    expect(marketName(" Temporalis ")).toBe("Temporalis");
    expect(marketName("Exalted Orb")).toBe("Exalted Orb");
  });
});
