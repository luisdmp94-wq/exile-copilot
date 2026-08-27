import { describe, expect, it } from "vitest";
import { assessCraftingBudget } from "../../shared/craftingBudget.js";

describe("presupuesto del guía de crafting", () => {
  it("autoriza un contrato de Exaltados que cabe en la misma unidad", () => {
    const result = assessCraftingBudget({
      budget: { amount: 3, currency: "exalted" },
      actionId: "exalted",
      plannedAttempts: 2,
    });

    expect(result.status).toBe("within-budget");
    expect(result.blocksAction).toBe(false);
    expect(result.requiredAmount).toBe(2);
    expect(result.detail).toContain("2 exaltados de un límite de 3 exaltados");
  });

  it("bloquea el gasto exacto que supera el límite declarado", () => {
    const result = assessCraftingBudget({
      budget: { amount: 1, currency: "exalted" },
      actionId: "exalted",
      plannedAttempts: 2,
    });

    expect(result.status).toBe("over-budget");
    expect(result.blocksAction).toBe(true);
    expect(result.requiredAmount).toBe(2);
    expect(result.detail).toContain("Reduce pasos o cambia el presupuesto");
  });

  it("no inventa una conversión para Aumento, Regio o Transmutación", () => {
    for (const actionId of ["augmentation", "regal", "transmutation"] as const) {
      const result = assessCraftingBudget({
        budget: { amount: 50, currency: "exalted" },
        actionId,
        plannedAttempts: 3,
      });

      expect(result.status).toBe("not-comparable");
      expect(result.blocksAction).toBe(false);
      expect(result.requiredAmount).toBeNull();
      expect(result.detail).toContain("Sin inventario o conversión verificados");
    }
  });

  it("tampoco compara Exaltado contra otra moneda del presupuesto", () => {
    const result = assessCraftingBudget({
      budget: { amount: 100, currency: "chaos" },
      actionId: "exalted",
      plannedAttempts: 1,
    });

    expect(result.status).toBe("not-comparable");
    expect(result.blocksAction).toBe(false);
    expect(result.detail).toContain("100 caos");
  });

  it("nombra el límite singular sin errores visibles", () => {
    const result = assessCraftingBudget({
      budget: { amount: 1, currency: "exalted" },
      actionId: "exalted",
      plannedAttempts: 1,
    });

    expect(result.detail).toContain("1 exaltado de un límite de 1 exaltado");
  });
});
