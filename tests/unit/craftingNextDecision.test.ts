import { describe, expect, it } from "vitest";
import type { CraftingCharacterContext } from "../../shared/craftingCharacterContext.js";
import type { CraftingComparison } from "../../shared/craftingComparison.js";
import { decideCraftingNextStep } from "../../shared/craftingNextDecision.js";
import { evaluateCraftingGoalSignal } from "../../shared/craftingGoal.js";
import { ItemSchema, type Item, type Modifier } from "../../shared/domain.js";

function modifier(id: string, tags: string[]): Modifier {
  return {
    id,
    text: `Modificador ${id}`,
    kind: "explicit",
    affix: id.startsWith("p") ? "prefix" : "suffix",
    tier: 3,
    values: [],
    verified: true,
    tags,
  };
}

function item(modifiers: Modifier[]): Item {
  return ItemSchema.parse({
    id: "result",
    name: "Resultado",
    itemClass: "Ballestas",
    baseType: "Ballesta barnizada",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 80,
    craftingState: {
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    },
    modifiers,
    sources: [],
  });
}

function comparison(added: Modifier[]): CraftingComparison {
  return {
    status: "confirmed",
    title: "Cambio confirmado",
    summary: "Cambio confirmado.",
    identityMatches: true,
    itemLevelMatches: true,
    rarityMatches: true,
    addedModifiers: added,
    removedModifiers: [],
    protectionStatus: "not-requested",
    protectedModifiers: [],
    lostProtectedModifiers: [],
    warnings: [],
  };
}

function context(
  verdict: CraftingCharacterContext["verdict"] = "candidate",
): CraftingCharacterContext {
  return {
    verdict,
    title: verdict === "stop" ? "Detente: bloqueo" : "Candidato coherente",
    summary: verdict === "stop" ? "Existe un bloqueo." : "No aparece un bloqueo conocido.",
    requirementStatus: verdict === "stop" ? "unmet" : "met",
    requirementLabel: verdict === "stop" ? "Requisitos no cumplidos" : "Requisitos cumplidos",
    protectionLabel: "Sin protección declarada",
    facts: [],
    limitations: [],
  };
}

describe("decisión siguiente tras observar un craft", () => {
  it("continúa solo si el cambio apunta al objetivo y aún queda espacio", () => {
    const added = modifier("p-damage", ["Daño", "Ataque"]);
    const result = item([
      modifier("p-one", ["Daño"]),
      modifier("p-two", ["Daño"]),
      modifier("s-one", ["Velocidad"]),
      modifier("s-two", ["Atributo"]),
      added,
    ]);
    const observed = comparison([added]);
    const signal = evaluateCraftingGoalSignal("damage", observed.addedModifiers);
    const decision = decideCraftingNextStep({
      resultItem: result,
      comparison: observed,
      characterContext: context(),
      addedGoalSignal: signal,
      goalCategory: "damage",
    });

    expect(decision.kind).toBe("continue");
    expect(decision.observedOpenSlots).toBe(1);
    expect(decision.nextAction).toContain("siguiente acción legal");
  });

  it("para y conserva cuando el resultado útil ya ocupa los seis huecos", () => {
    const added = modifier("s-damage", ["Daño"]);
    const result = item([
      modifier("p-one", ["Daño"]),
      modifier("p-two", ["Daño"]),
      modifier("p-three", ["Daño"]),
      modifier("s-one", ["Velocidad"]),
      modifier("s-two", ["Atributo"]),
      added,
    ]);
    const observed = comparison([added]);
    const decision = decideCraftingNextStep({
      resultItem: result,
      comparison: observed,
      characterContext: context(),
      addedGoalSignal: evaluateCraftingGoalSignal("damage", observed.addedModifiers),
      goalCategory: "damage",
    });

    expect(decision.kind).toBe("stop");
    expect(decision.tone).toBe("positive");
    expect(decision.title).toContain("conserva");
  });

  it("replantea una pieza llena sin ninguna señal literal del objetivo", () => {
    const added = modifier("s-attribute", ["Atributo"]);
    const result = item([
      modifier("p-one", ["Atributo"]),
      modifier("p-two", ["Atributo"]),
      modifier("p-three", ["Atributo"]),
      modifier("s-one", ["Velocidad"]),
      modifier("s-two", ["Velocidad"]),
      added,
    ]);
    const observed = comparison([added]);
    const decision = decideCraftingNextStep({
      resultItem: result,
      comparison: observed,
      characterContext: context("review"),
      addedGoalSignal: evaluateCraftingGoalSignal("damage", observed.addedModifiers),
      goalCategory: "damage",
    });

    expect(decision.kind).toBe("restart");
    expect(decision.title).toContain("Replantea");
    expect(decision.nextAction).toContain("No destruyas nada");
  });

  it("un bloqueo del personaje siempre frena aunque el afijo coincida", () => {
    const added = modifier("p-damage", ["Daño"]);
    const result = item([added]);
    const observed = comparison([added]);
    const decision = decideCraftingNextStep({
      resultItem: result,
      comparison: observed,
      characterContext: context("stop"),
      addedGoalSignal: evaluateCraftingGoalSignal("damage", observed.addedModifiers),
      goalCategory: "damage",
    });

    expect(decision.kind).toBe("stop");
    expect(decision.tone).toBe("danger");
    expect(decision.nextAction).toContain("No gastes otra moneda");
  });
});
