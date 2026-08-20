import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildEquipmentLayout,
  collectHighlightedItemIds,
  computeEquipmentDiagnostics,
  describeItemDataState,
  describeRequirements,
  EQUIPMENT_SLOTS,
  formatOptionalInt,
  formatQuality,
  groupModifiersByKind,
  rarityStyle,
} from "../../src/lib/equipment.js";
import { ItemSchema, CharacterProfileSchema, type Item } from "../../shared/domain.js";
import { GggBuildPlannerV1Schema } from "../../shared/gggBuildPlanner.js";

/**
 * Hito 4B — helpers del panel de equipamiento.
 * Datos reales del CharacterProfileSnapshot; nada inventado.
 */

function item(overrides: Record<string, unknown> = {}): Item {
  return ItemSchema.parse({
    id: "it-1",
    name: "Objeto",
    baseType: "Base",
    slot: "weapon",
    rarity: "rare",
    ...overrides,
  });
}

describe("layout de equipamiento", () => {
  it("coloca cada objeto en su hueco y deja el resto vacío", () => {
    const layout = buildEquipmentLayout([
      item({ id: "w", slot: "weapon" }),
      item({ id: "h", slot: "helmet" }),
    ]);
    expect(layout.cells).toHaveLength(EQUIPMENT_SLOTS.length);
    expect(layout.cells.find((c) => c.slot === "weapon")?.item?.id).toBe("w");
    expect(layout.cells.find((c) => c.slot === "helmet")?.item?.id).toBe("h");
    // Huecos sin objeto → null explícito (estado vacío), nunca un objeto ficticio.
    expect(layout.cells.find((c) => c.slot === "boots")?.item).toBeNull();
    expect(layout.emptyCount).toBe(EQUIPMENT_SLOTS.length - 2);
    expect(layout.filledCount).toBe(2);
  });

  it("perfil sin objetos: todos los huecos vacíos y ningún frasco", () => {
    const layout = buildEquipmentLayout([]);
    expect(layout.filledCount).toBe(0);
    expect(layout.emptyCount).toBe(EQUIPMENT_SLOTS.length);
    expect(layout.cells.every((c) => c.item === null)).toBe(true);
    expect(layout.flaskItems).toEqual([]);
    expect(layout.extraItems).toEqual([]);
  });

  it("no presupone un número fijo de frascos: agrupa los que existan de verdad", () => {
    // Sin frascos: lista vacía (la interfaz dirá «Sin información de frascos»).
    expect(buildEquipmentLayout([item({ id: "w", slot: "weapon" })]).flaskItems).toEqual([]);

    // Con tres frascos reales: los tres, ni cinco huecos ni recorte.
    const conFrascos = buildEquipmentLayout([
      item({ id: "f1", slot: "flask", name: "Frasco 1" }),
      item({ id: "f2", slot: "flask", name: "Frasco 2" }),
      item({ id: "f3", slot: "flask", name: "Frasco 3" }),
    ]);
    expect(conFrascos.flaskItems.map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(conFrascos.extraItems).toEqual([]);
    expect(conFrascos.filledCount).toBe(3);
  });

  it("duplicados y slot 'other' se muestran aparte, nunca se pierden", () => {
    const layout = buildEquipmentLayout([
      item({ id: "r1", slot: "ring1" }),
      item({ id: "r1-bis", slot: "ring1" }),
      item({ id: "o1", slot: "other" }),
    ]);
    expect(layout.cells.find((c) => c.slot === "ring1")?.item?.id).toBe("r1");
    expect(layout.extraItems.map((i) => i.id)).toEqual(["r1-bis", "o1"]);
  });
});

describe("rareza", () => {
  it("cada rareza del dominio tiene estilo propio y hay respaldo seguro", () => {
    for (const rarity of ["normal", "magic", "rare", "unique", "currency", "gem", "other"] as const) {
      expect(rarityStyle(rarity).border).toBeTruthy();
      expect(rarityStyle(rarity).text).toBeTruthy();
    }
    // Un objeto único tiene estilo distinto al de uno raro (color + texto, no solo color).
    expect(rarityStyle("unique")).not.toEqual(rarityStyle("rare"));
  });
});

describe("datos desconocidos", () => {
  it("nivel de objeto y calidad ausentes son «Desconocido», nunca 0", () => {
    expect(formatOptionalInt(undefined)).toBe("Desconocido");
    expect(formatOptionalInt(0)).toBe("0");
    expect(formatOptionalInt(82)).toBe("82");
    expect(formatQuality(undefined)).toBe("Desconocido");
    // 0 es un dato real: «sin calidad» no es «desconocido».
    expect(formatQuality(0)).toBe("0%");
    expect(formatQuality(20)).toBe("20%");
  });

  it("objeto con datos parciales: se declara lo que falta sin rellenarlo", () => {
    const parcial = item({ id: "p", itemLevel: undefined, quality: undefined, requirements: undefined });
    expect(formatOptionalInt(parcial.itemLevel)).toBe("Desconocido");
    expect(formatQuality(parcial.quality)).toBe("Desconocido");
    expect(describeRequirements(parcial)).toEqual([]);
    expect(groupModifiersByKind(parcial)).toEqual([]);
  });

  it("requisitos: solo los declarados", () => {
    expect(describeRequirements(item({ requirements: { level: 68, dex: 210 } }))).toEqual([
      "Nivel 68",
      "Destreza 210",
    ]);
  });
});

describe("procedencia y verificación", () => {
  it("sin sources → «Fuente no disponible» (nunca «pendiente»)", () => {
    const state = describeItemDataState(item({ sources: [] }));
    expect(state.origin).toBe("sin-fuente");
    expect(state.label).toBe("Fuente no disponible");
  });

  it("kind user → indicado por el usuario, no verificado", () => {
    const state = describeItemDataState(
      item({ sources: [{ kind: "user", label: "Pegado por el usuario", retrievedAt: "2026-08-20T10:00:00.000Z" }] }),
    );
    expect(state.origin).toBe("usuario");
    expect(state.label).toBe("Lo has indicado tú");
    expect(state.detail).toContain("no está verificado");
  });

  it("kind ggg → fuente oficial", () => {
    const state = describeItemDataState(
      item({ sources: [{ kind: "ggg", label: "API oficial", retrievedAt: "2026-08-20T10:00:00.000Z" }] }),
    );
    expect(state.origin).toBe("oficial");
    expect(state.label).toBe("Fuente oficial");
  });

  it("otras procedencias → No verificado", () => {
    const state = describeItemDataState(
      item({ sources: [{ kind: "community", label: "Guía", retrievedAt: "2026-08-20T10:00:00.000Z" }] }),
    );
    expect(state.origin).toBe("no-verificado");
    expect(state.label).toBe("No verificado");
  });

  it("importar no verifica los mods: cada modifier.verified se respeta por separado", () => {
    const unico = item({
      id: "u",
      rarity: "unique",
      name: "Objeto único de prueba",
      sources: [{ kind: "user", label: "Importado por el usuario", retrievedAt: "2026-08-20T10:00:00.000Z" }],
      modifiers: [
        { id: "m1", text: "mod A", kind: "implicit", values: [], verified: true },
        { id: "m2", text: "mod B", kind: "explicit", values: [], verified: false },
      ],
    });
    // El objeto viene del usuario...
    expect(describeItemDataState(unico).origin).toBe("usuario");
    // ...y los mods conservan su propio estado de verificación.
    const grupos = groupModifiersByKind(unico);
    expect(grupos.map((g) => g.kind)).toEqual(["implicit", "explicit"]); // orden estable
    expect(grupos[0]?.mods[0]?.verified).toBe(true);
    expect(grupos[1]?.mods[0]?.verified).toBe(false);
  });
});

describe("vínculo recomendación → objeto (solo estructurado)", () => {
  it("usa relatedItemIds y nada más", () => {
    const ids = collectHighlightedItemIds([
      { relatedItemIds: ["demo-item-weapon"] },
      { relatedItemIds: [] },
      { relatedItemIds: ["demo-item-weapon", "demo-item-boots"] },
    ]);
    expect([...ids].sort()).toEqual(["demo-item-boots", "demo-item-weapon"]);
  });

  it("sin vínculo estructurado no se marca ningún hueco", () => {
    // Recomendaciones cuyo texto menciona «anillo» o «casco» pero sin relatedItemIds:
    // no deben resaltar nada (prohibido deducir el hueco por el texto).
    const ids = collectHighlightedItemIds([{ relatedItemIds: [] }, { relatedItemIds: [] }]);
    expect(ids.size).toBe(0);
    const layout = buildEquipmentLayout([item({ id: "anillo", slot: "ring1", name: "Anillo del casco" })]);
    const diag = computeEquipmentDiagnostics(layout, ids);
    expect(diag.highlighted).toBe(0);
  });
});

describe("diagnóstico contextual (recuentos reales, sin puntuaciones)", () => {
  it("cuenta objetos, ranuras vacías, origen y mods sin verificar", () => {
    const layout = buildEquipmentLayout([
      item({
        id: "w",
        slot: "weapon",
        sources: [{ kind: "user", label: "u", retrievedAt: "2026-08-20T10:00:00.000Z" }],
        modifiers: [
          { id: "m1", text: "a", kind: "explicit", values: [], verified: false },
          { id: "m2", text: "b", kind: "explicit", values: [], verified: true },
        ],
      }),
      item({ id: "h", slot: "helmet", sources: [] }),
    ]);
    const diag = computeEquipmentDiagnostics(layout, new Set(["w"]));
    expect(diag.equipped).toBe(2);
    expect(diag.emptySlots).toBe(EQUIPMENT_SLOTS.length - 2);
    expect(diag.userProvided).toBe(1);
    expect(diag.withoutSource).toBe(1);
    expect(diag.unverifiedModifiers).toBe(1);
    expect(diag.highlighted).toBe(1);
  });
});

describe("separación: el plan `.build` NUNCA es equipo del personaje", () => {
  it("los inventory_slots del plan Titan Warrior no producen ningún objeto equipado", () => {
    const titanRaw = readFileSync(
      fileURLToPath(new URL("../../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
      "utf8",
    );
    const plan = GggBuildPlannerV1Schema.parse(JSON.parse(titanRaw));
    expect((plan.inventory_slots ?? []).length).toBeGreaterThan(0);

    // Un perfil recién creado no tiene equipo, por mucho que exista un plan importado.
    const profile = CharacterProfileSchema.parse({
      id: "sin-equipo",
      name: "Personaje sin equipo",
      characterClass: "Warrior",
      league: "Runes of Aldur",
      patch: "0.5.4f",
      importedAt: "2026-08-20T10:00:00.000Z",
    });
    const layout = buildEquipmentLayout(profile.items);
    expect(layout.filledCount).toBe(0);
    expect(layout.cells.every((cell) => cell.item === null)).toBe(true);

    // El panel solo acepta `Item`s: las pistas del plan no son convertibles.
    const planTexts = (plan.inventory_slots ?? [])
      .map((slot) => slot.additional_text ?? "")
      .join(" ");
    const panelText = JSON.stringify(layout);
    for (const marca of ["Any Two Handed Mace", "Stat Priority", "Armour (Str Base)"]) {
      expect(planTexts).toContain(marca);
      expect(panelText).not.toContain(marca);
    }
  });
});
