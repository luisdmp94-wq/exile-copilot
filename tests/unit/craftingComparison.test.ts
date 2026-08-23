import { describe, expect, it } from "vitest";
import { compareCraftingResult } from "../../shared/craftingComparison.js";
import type { Item, Modifier } from "../../shared/domain.js";

function modifier(
  text: string,
  affix: "prefix" | "suffix" = "prefix",
  patch: Partial<Modifier> = {},
): Modifier {
  return {
    id: crypto.randomUUID(),
    text,
    kind: "explicit",
    affix,
    values: [],
    verified: false,
    ...patch,
  };
}

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "tracked-item",
    name: "Objeto de prueba",
    baseType: "Ballesta de prueba",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 80,
    modifiers: [modifier("Modificador original")],
    craftingState: {
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    },
    sources: [],
    ...patch,
  };
}

describe("compareCraftingResult", () => {
  it("confirma un exaltado cuando conserva todo y añade exactamente un explícito", () => {
    const original = item();
    const result = item({
      id: "nuevo-id-del-importador",
      name: "Otro nombre raro permitido",
      modifiers: [
        { ...original.modifiers[0]!, id: "otro-id" },
        modifier("Modificador nuevo", "suffix"),
      ],
    });

    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("confirmed");
    expect(comparison.addedModifiers.map((entry) => entry.text)).toEqual([
      "Modificador nuevo",
    ]);
    expect(comparison.removedModifiers).toEqual([]);
  });

  it("confirma las transiciones de rareza observadas sin depender del nombre", () => {
    const original = item({ rarity: "magic" });
    const result = item({
      rarity: "rare",
      name: "Nombre raro nuevo",
      modifiers: [...original.modifiers, modifier("Afijo del regio", "suffix")],
    });
    expect(compareCraftingResult(original, result, "regal").status).toBe("confirmed");
  });

  it("rechaza un texto de otra base aunque también tenga un mod nuevo", () => {
    const original = item();
    const result = item({
      baseType: "Arco distinto",
      modifiers: [...original.modifiers, modifier("Modificador nuevo")],
    });
    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("mismatch");
    expect(comparison.identityMatches).toBe(false);
    expect(comparison.warnings[0]).toContain("no parece el mismo objeto");
  });

  it("no confirma si desapareció un modificador anterior", () => {
    const original = item({
      modifiers: [modifier("Primero"), modifier("Segundo", "suffix")],
    });
    const result = item({ modifiers: [modifier("Primero"), modifier("Nuevo")] });
    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("mismatch");
    expect(comparison.removedModifiers.map((entry) => entry.text)).toEqual(["Segundo"]);
  });

  it("confirma una Essence Perfecta si desaparece uno al azar y aparece uno nuevo", () => {
    const kept = modifier("Modificador conservado", "suffix");
    const removed = modifier("Modificador retirado");
    const original = item({ modifiers: [kept, removed] });
    const result = item({
      modifiers: [
        { ...kept, id: "reimportado" },
        modifier("Modificador garantizado nuevo"),
      ],
    });

    const comparison = compareCraftingResult(original, result, "essence", {
      expectedRarity: "rare",
      expectedRemovedModifierCount: 1,
    });
    expect(comparison.status).toBe("confirmed");
    expect(comparison.removedModifiers.map((entry) => entry.text)).toEqual([
      "Modificador retirado",
    ]);
    expect(comparison.addedModifiers.map((entry) => entry.text)).toEqual([
      "Modificador garantizado nuevo",
    ]);
  });

  it("confirma por separado si los modificadores protegidos sobrevivieron", () => {
    const kept = modifier("Imprescindible", "suffix");
    const removed = modifier("Prescindible");
    const original = item({ modifiers: [kept, removed] });
    const result = item({
      modifiers: [
        { ...kept, id: "reimportado" },
        modifier("Resultado nuevo"),
      ],
    });
    const comparison = compareCraftingResult(original, result, "essence", {
      expectedRemovedModifierCount: 1,
      protectedModifierIds: [kept.id],
    });
    expect(comparison.status).toBe("confirmed");
    expect(comparison.protectionStatus).toBe("preserved");
    expect(comparison.lostProtectedModifiers).toEqual([]);
  });

  it("señala una pérdida protegida aunque la estructura de la acción sea correcta", () => {
    const kept = modifier("Prescindible", "suffix");
    const protectedModifier = modifier("No perder");
    const original = item({ modifiers: [kept, protectedModifier] });
    const result = item({
      modifiers: [
        { ...kept, id: "reimportado" },
        modifier("Resultado nuevo"),
      ],
    });
    const comparison = compareCraftingResult(original, result, "essence", {
      expectedRemovedModifierCount: 1,
      protectedModifierIds: [protectedModifier.id],
    });
    expect(comparison.status).toBe("confirmed");
    expect(comparison.protectionStatus).toBe("lost");
    expect(comparison.title).toMatch(/perdió algo protegido/i);
    expect(comparison.lostProtectedModifiers.map((entry) => entry.text)).toEqual(["No perder"]);
  });

  it("no confirma una Essence de reemplazo si no desaparece exactamente uno", () => {
    const original = item();
    const result = item({ modifiers: [...original.modifiers, modifier("Nuevo")] });
    const comparison = compareCraftingResult(original, result, "essence", {
      expectedRemovedModifierCount: 1,
    });
    expect(comparison.status).toBe("mismatch");
    expect(comparison.warnings).toContain(
      "Se esperaba que desaparecieran 1 modificadores explícitos y se detectaron 0.",
    );
  });

  it("confirma un Alloy solo si reemplaza uno y añade un fabricado", () => {
    const kept = modifier("Conservado", "suffix");
    const original = item({ modifiers: [kept, modifier("Reemplazado")] });
    const result = item({
      modifiers: [
        { ...kept, id: "reimportado" },
        modifier("Fabricado garantizado", "prefix", { crafted: true }),
      ],
    });
    const comparison = compareCraftingResult(original, result, "alloy", {
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
    });
    expect(comparison.status).toBe("confirmed");
  });

  it("no confirma un Alloy si el nuevo modificador no figura como fabricado", () => {
    const original = item({ modifiers: [modifier("Reemplazado")] });
    const result = item({ modifiers: [modifier("Nuevo sin marca crafted")] });
    const comparison = compareCraftingResult(original, result, "alloy", {
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
    });
    expect(comparison.status).toBe("inconclusive");
    expect(comparison.warnings.some((warning) => warning.includes("fabricado"))).toBe(true);
  });

  it("rechaza un Alloy cuyo añadido no contiene el efecto garantizado", () => {
    const original = item({ modifiers: [modifier("Reemplazado")] });
    const result = item({
      modifiers: [modifier("Fabricado distinto", "prefix", { crafted: true })],
    });
    const comparison = compareCraftingResult(original, result, "alloy", {
      expectedRarity: original.rarity,
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
      expectedAddedModifierText: "Fabricado prometido",
    });
    expect(comparison.status).toBe("mismatch");
    expect(comparison.warnings.some((warning) => warning.includes("efecto garantizado"))).toBe(true);
  });

  it("un Alloy conserva la rareza original si no se proporciona otra", () => {
    const original = item({ rarity: "magic", modifiers: [modifier("Reemplazado")] });
    const result = item({
      rarity: "magic",
      modifiers: [modifier("Fabricado", "prefix", { crafted: true })],
    });
    expect(compareCraftingResult(original, result, "alloy", {
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
    }).status).toBe("confirmed");
  });

  it("rechaza un resultado de Alloy con más de un fabricado", () => {
    const original = item({ modifiers: [modifier("Reemplazado")] });
    const result = item({
      modifiers: [
        modifier("Fabricado A", "prefix", { crafted: true }),
        modifier("Fabricado B", "suffix", { crafted: true }),
      ],
    });
    const comparison = compareCraftingResult(original, result, "alloy", {
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
    });
    expect(comparison.status).toBe("mismatch");
    expect(comparison.warnings.some((warning) => warning.includes("máximo permitido"))).toBe(true);
  });

  it("queda inconcluso si no detecta exactamente un explícito nuevo", () => {
    const original = item();
    const result = item({ modifiers: [...original.modifiers] });
    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("inconclusive");
    expect(comparison.warnings).toContain(
      "Se esperaba 1 modificador explícito nuevo y se detectaron 0.",
    );
  });

  it("no confirma si el resultado omite el nivel de objeto", () => {
    const original = item();
    const result = item({
      itemLevel: undefined,
      modifiers: [...original.modifiers, modifier("Modificador nuevo")],
    });
    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("inconclusive");
    expect(comparison.identityMatches).toBe(false);
    expect(comparison.itemLevelMatches).toBe(false);
    expect(comparison.warnings).toContain(
      "El resultado no incluye el nivel de objeto; no se puede confirmar la identidad.",
    );
  });

  it("no confirma si aparecen dos explícitos nuevos", () => {
    const original = item();
    const result = item({
      modifiers: [
        ...original.modifiers,
        modifier("Modificador nuevo A"),
        modifier("Modificador nuevo B", "suffix"),
      ],
    });
    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("inconclusive");
    expect(comparison.warnings).toContain(
      "Se esperaba 1 modificador explícito nuevo y se detectaron 2.",
    );
  });

  it("tolera líneas reordenadas porque compara un multiconjunto", () => {
    const first = modifier("Primero");
    const second = modifier("Segundo", "suffix");
    const original = item({ modifiers: [first, second] });
    const result = item({
      modifiers: [
        { ...second, id: "second-reimported" },
        modifier("Nuevo"),
        { ...first, id: "first-reimported" },
      ],
    });
    expect(compareCraftingResult(original, result, "exalted").status).toBe("confirmed");
  });

  it("trata una tirada distinta como retirada y adición, nunca como el mismo mod", () => {
    const original = item({ modifiers: [modifier("+49(41-60) a la precisión")] });
    const result = item({
      modifiers: [
        modifier("+52(41-60) a la precisión"),
        modifier("Modificador adicional", "suffix"),
      ],
    });
    const comparison = compareCraftingResult(original, result, "exalted");
    expect(comparison.status).toBe("mismatch");
    expect(comparison.removedModifiers.map((entry) => entry.text)).toEqual([
      "+49(41-60) a la precisión",
    ]);
  });
});
