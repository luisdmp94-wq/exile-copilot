import { describe, expect, it } from "vitest";
import {
  isCraftingExampleItem,
  isCraftingExampleProfile,
} from "../../src/lib/craftingSimulation.js";

describe("isCraftingExampleItem", () => {
  it("reconoce cualquier pieza procedente del personaje de demostración", () => {
    expect(
      isCraftingExampleItem({
        sources: [
          {
            kind: "user",
            label: "Build de demostración",
            retrievedAt: "2026-08-19T09:00:00.000Z",
          },
        ],
      }),
    ).toBe(true);
  });

  it("no convierte una pieza importada por el jugador en simulación", () => {
    expect(
      isCraftingExampleItem({
        sources: [
          {
            kind: "user",
            label: "Texto copiado de Path of Exile 2",
            retrievedAt: "2026-09-01T09:00:00.000Z",
          },
        ],
      }),
    ).toBe(false);
  });

  it("reconoce una demo restaurada solo cuando todo su equipo sigue siendo didáctico", () => {
    const demoSource = {
      kind: "user" as const,
      label: "Build de demostración",
      retrievedAt: "2026-08-19T09:00:00.000Z",
    };
    const realSource = {
      kind: "user" as const,
      label: "Texto copiado de Path of Exile 2",
      retrievedAt: "2026-09-01T09:00:00.000Z",
    };

    expect(
      isCraftingExampleProfile({
        items: [
          { sources: [demoSource] },
          { sources: [demoSource] },
        ],
      }),
    ).toBe(true);
    expect(
      isCraftingExampleProfile({
        items: [
          { sources: [demoSource] },
          { sources: [realSource] },
        ],
      }),
    ).toBe(false);
  });
});
