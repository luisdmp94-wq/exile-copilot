import { describe, expect, it } from "vitest";
import { craftingLaboratoryRouteLabel } from "../../shared/craftingProjectRoute.js";

describe("estado de la ruta del Taller avanzado", () => {
  it("no presenta como lista una ruta con lectura parcial aunque el contrato esté completo", () => {
    expect(
      craftingLaboratoryRouteLabel({
        diagnosisState: "partial",
        objectiveReady: true,
        successCriteriaReady: true,
        stopAlreadyReached: false,
      }),
    ).toBe("Bloqueada");
  });

  it("solo presenta la ruta como lista con lectura y contrato completos", () => {
    expect(
      craftingLaboratoryRouteLabel({
        diagnosisState: "complete",
        objectiveReady: true,
        successCriteriaReady: true,
        stopAlreadyReached: false,
      }),
    ).toBe("Lista");
  });
});
