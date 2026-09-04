import { describe, expect, it } from "vitest";
import {
  loadPlanningWorkspaceProgress,
  savePlanningWorkspaceProgress,
} from "../../src/lib/planningWorkspaceProgress.js";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

const emptyTarget = {
  name: "",
  sourceUrl: "",
  summary: "",
  desiredModsText: "",
  plan: null,
};

describe("memoria de Plan y mercado", () => {
  it("conserva el plan objetivo y distingue un presupuesto no declarado", () => {
    const storage = fakeStorage();
    const progress = {
      schemaVersion: 1 as const,
      targetDraft: {
        ...emptyTarget,
        name: "Titan Warrior",
        plan: {
          build: { name: "Titan Warrior", passives: ["123"] },
          importedAt: "2026-08-31T10:00:00.000Z",
        },
      },
      targetWarnings: ["Un id no se pudo resolver"],
      targetResolution: null,
      budget: null,
      goal: "balanced" as const,
      activeWorkspace: "plan" as const,
    };

    expect(savePlanningWorkspaceProgress(progress, storage)).toBe(true);
    expect(loadPlanningWorkspaceProgress(storage)).toEqual(progress);
  });

  it("conserva un presupuesto solo después de que exista como dato explícito", () => {
    const storage = fakeStorage();
    expect(
      savePlanningWorkspaceProgress(
        {
          schemaVersion: 1,
          targetDraft: emptyTarget,
          targetWarnings: [],
          targetResolution: null,
          budget: { amount: 25, currency: "exalted" },
          goal: "survival",
          activeWorkspace: "expediente",
        },
        storage,
      ),
    ).toBe(true);
    expect(loadPlanningWorkspaceProgress(storage)?.budget).toEqual({
      amount: 25,
      currency: "exalted",
    });
  });

  it("no recrea una clave vacía tras borrar los datos del navegador", () => {
    const storage = fakeStorage();
    storage.setItem("exile-copilot:planning-workspace:v1", "resto anterior");

    expect(
      savePlanningWorkspaceProgress(
        {
          schemaVersion: 1,
          targetDraft: emptyTarget,
          targetWarnings: [],
          targetResolution: null,
          budget: null,
          goal: "balanced",
          activeWorkspace: "expediente",
        },
        storage,
      ),
    ).toBe(true);
    expect(storage.data.size).toBe(0);
    expect(loadPlanningWorkspaceProgress(storage)).toBeNull();
  });

  it("descarta almacenamiento dañado sin bloquear la aplicación", () => {
    const storage = fakeStorage();
    storage.setItem("exile-copilot:planning-workspace:v1", "{no-json");
    expect(loadPlanningWorkspaceProgress(storage)).toBeNull();
    expect(storage.data.size).toBe(0);
  });
});
