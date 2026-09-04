import { describe, expect, it } from "vitest";
import {
  emptyCraftingCoachProgress,
  loadCraftingCoachProgress,
  phaseAfterObservedResult,
  protectSimulatedCraftingProgress,
  saveCraftingCoachProgress,
} from "../../src/lib/craftingCoachProgress.js";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("contrato persistido del Coach de crafting", () => {
  it("no restaura una espera de resultado real sobre una pieza de demostración", () => {
    const identity = {
      profileId: "demo-gemling",
      itemId: "demo-item-weapon",
      baseType: "Varnished Crossbow",
    };
    const before = {
      id: identity.itemId,
      name: "Doom Song",
      baseType: identity.baseType,
      slot: "weapon" as const,
      rarity: "rare" as const,
      modifiers: [],
      sources: [],
    };
    const staleProgress = {
      ...emptyCraftingCoachProgress(identity),
      direction: "damage" as const,
      focus: "maximum-life" as const,
      goalText: "vida máxima",
      directionChosen: true,
      phase: "await-result" as const,
      pendingAttempt: {
        before,
        actionId: "exalted" as const,
        rollMinimum: "middle" as const,
        attemptNumber: 1,
        attemptLimit: 1,
      },
      resultText: "texto que nunca pudo salir de PoE2",
    };

    expect(protectSimulatedCraftingProgress(staleProgress, "example")).toMatchObject({
      simulationMode: "example",
      phase: "recommend",
      pendingAttempt: null,
      resultItem: null,
      resultText: "",
    });
  });

  it("cierra el flujo observado cuando ya se consumió el límite", () => {
    expect(phaseAfterObservedResult(1, 1)).toBe("hold");
    expect(phaseAfterObservedResult(1, 2)).toBe("recommend");
    expect(phaseAfterObservedResult(2, 2)).toBe("hold");
  });

  it("recupera objetivo y protecciones únicamente para la misma pieza", () => {
    const storage = fakeStorage();
    const identity = {
      itemId: "ballesta-seguida",
      baseType: "Ballesta barnizada",
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      direction: "damage" as const,
      focus: "cold" as const,
      goalText: "Quiero más daño de hielo sin perder velocidad de ataque",
      directionChosen: true,
      directionNote: "Objetivo principal: daño de hielo.",
      protectedModifiers: [
        { id: "velocidad", text: "Velocidad de ataque aumentada un 13%" },
      ],
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    expect(loadCraftingCoachProgress(identity, storage)).toEqual(progress);
    expect(
      loadCraftingCoachProgress(
        { itemId: identity.itemId, baseType: "Arco distinto" },
        storage,
      ),
    ).toBeNull();
  });

  it("conserva el modo práctica al recargar para no autorizar gasto real", () => {
    const storage = fakeStorage();
    const identity = {
      profileId: "demo-gemling",
      itemId: "arma-demo",
      baseType: "Doom Song",
    };
    const practiceItem = {
      id: identity.itemId,
      name: "Maza de procesión de victoria",
      baseType: "Maza ritual",
      slot: "weapon" as const,
      rarity: "magic" as const,
      modifiers: [],
      sources: [],
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      goalText: "Quiero practicar sin gastar",
      directionChosen: true,
      phase: "recommend" as const,
      workingItem: practiceItem,
      simulationMode: "practice" as const,
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const restored = loadCraftingCoachProgress(identity, storage);

    expect(restored?.simulationMode).toBe("practice");
    expect(restored?.workingItem?.name).toBe(practiceItem.name);
  });

  it("migra una sustitución didáctica antigua sin inferirla por su nombre", () => {
    const storage = fakeStorage();
    const identity = {
      profileId: "demo-gemling",
      itemId: "arma-demo-antigua",
      baseType: "Doom Song",
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      goalText: "Contrato anterior",
      directionChosen: true,
      phase: "recommend" as const,
      workingItem: {
        id: identity.itemId,
        name: "Cualquier nombre",
        baseType: "Base temporal distinta",
        slot: "weapon" as const,
        rarity: "magic" as const,
        modifiers: [],
        sources: [],
      },
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const restored = loadCraftingCoachProgress(identity, storage);

    expect(restored?.simulationMode).toBe("practice");
  });

  it("aísla el contrato cuando dos personajes reutilizan el mismo id de objeto", () => {
    const storage = fakeStorage();
    const ritualista = {
      profileId: "ritualista",
      itemId: "arma-1",
      baseType: "Arco geminiano",
    };
    const guerrero = { ...ritualista, profileId: "guerrero" };
    const progress = {
      ...emptyCraftingCoachProgress(ritualista),
      goalText: "Quiero más daño de hielo",
      directionChosen: true,
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    expect(loadCraftingCoachProgress(ritualista, storage)?.goalText).toContain("hielo");
    expect(loadCraftingCoachProgress(guerrero, storage)).toBeNull();
  });

  it("repara contadores antiguos que superan el límite declarado", () => {
    const storage = fakeStorage();
    const identity = {
      profileId: "ritualista",
      itemId: "arma-contador-antiguo",
      baseType: "Arco geminiano",
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      goalText: "Quiero más daño",
      directionChosen: true,
      attemptLimit: 1 as const,
      confirmedAttemptCount: 2,
      phase: "recommend" as const,
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const restored = loadCraftingCoachProgress(identity, storage);
    expect(restored?.confirmedAttemptCount).toBe(1);
    expect(restored?.phase).toBe("hold");
  });

  it("migra una vez el contrato v1 al personaje que abre la misma pieza", () => {
    const storage = fakeStorage();
    const legacyIdentity = {
      itemId: "arma-legada",
      baseType: "Arco geminiano",
    };
    const currentIdentity = { ...legacyIdentity, profileId: "ritualista" };
    const legacyProgress = {
      ...emptyCraftingCoachProgress(legacyIdentity),
      contentVersion: "coach-contract-v1",
      goalText: "Quiero conservar este contrato",
      directionChosen: true,
    };
    const legacyKey = `exile-copilot:crafting-coach:v1:${encodeURIComponent(legacyIdentity.itemId)}`;
    storage.setItem(legacyKey, JSON.stringify(legacyProgress));

    const restored = loadCraftingCoachProgress(currentIdentity, storage);

    expect(restored?.identity.profileId).toBe("ritualista");
    expect(restored?.contentVersion).toBe("coach-contract-v2");
    expect(restored?.goalText).toContain("conservar");
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(loadCraftingCoachProgress({ ...legacyIdentity, profileId: "guerrero" }, storage)).toBeNull();
  });

  it("recupera el snapshot y la moneda mientras espera el resultado de PoE2", () => {
    const storage = fakeStorage();
    const identity = {
      itemId: "ballesta-seguida",
      baseType: "Ballesta barnizada",
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      direction: "damage" as const,
      focus: "cold" as const,
      goalText: "Quiero mejorar daño de hielo",
      directionChosen: true,
      phase: "await-result" as const,
      pendingAttempt: {
        before: {
          id: identity.itemId,
          name: "Núcleo de fénix",
          baseType: identity.baseType,
          itemClass: "Ballestas",
          slot: "weapon" as const,
          rarity: "rare" as const,
          itemLevel: 32,
          modifiers: [],
          sources: [],
          rawText: "Rareza: Raro",
        },
        actionId: "exalted" as const,
        rollMinimum: "middle" as const,
        attemptNumber: 1,
        attemptLimit: 1,
      },
      resultText: "copia parcial todavía no enviada",
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const restored = loadCraftingCoachProgress(identity, storage);
    expect(restored?.phase).toBe("await-result");
    expect(restored?.pendingAttempt?.actionId).toBe("exalted");
    expect(restored?.pendingAttempt?.before.name).toBe("Núcleo de fénix");
    expect(restored?.resultText).toBe(progress.resultText);
  });

  it("tolera requisitos nulos de una pieza ya guardada mientras espera el resultado", () => {
    const storage = fakeStorage();
    const identity = {
      itemId: "ballesta-legada",
      baseType: "Ballesta barnizada",
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      direction: "damage" as const,
      focus: "cold" as const,
      goalText: "Quiero mejorar daño de hielo",
      directionChosen: true,
      phase: "await-result" as const,
      pendingAttempt: {
        before: {
          id: identity.itemId,
          name: "Núcleo de fénix",
          baseType: identity.baseType,
          slot: "weapon" as const,
          rarity: "rare" as const,
          modifiers: [],
          sources: [],
        },
        actionId: "exalted" as const,
        rollMinimum: "middle" as const,
        attemptNumber: 1,
        attemptLimit: 1,
      },
      resultText: "copia parcial",
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const [key, raw] = [...storage.data.entries()][0];
    const serialized = JSON.parse(raw);
    serialized.pendingAttempt.before.requirements = null;
    storage.setItem(key, JSON.stringify(serialized));

    expect(loadCraftingCoachProgress(identity, storage)?.phase).toBe("await-result");
  });

  it("recupera la pieza final para reconstruir una comparación ya cerrada", () => {
    const storage = fakeStorage();
    const identity = {
      itemId: "ballesta-comparada",
      baseType: "Ballesta barnizada",
    };
    const before = {
      id: identity.itemId,
      name: "Núcleo de fénix",
      baseType: identity.baseType,
      slot: "weapon" as const,
      rarity: "rare" as const,
      modifiers: [],
      sources: [],
    };
    const resultItem = {
      ...before,
      modifiers: [
        {
          id: "frio-nuevo",
          kind: "explicit" as const,
          text: "Agrega de 3 a 7 de daño de hielo",
          values: [3, 7],
          verified: true,
        },
      ],
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      direction: "damage" as const,
      focus: "cold" as const,
      goalText: "Quiero mejorar daño de hielo",
      directionChosen: true,
      phase: "result" as const,
      pendingAttempt: {
        before,
        actionId: "exalted" as const,
        rollMinimum: "middle" as const,
        attemptNumber: 1,
        attemptLimit: 1,
      },
      workingItem: resultItem,
      resultItem,
      resultText: "objeto completo después del intento",
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const restored = loadCraftingCoachProgress(identity, storage);
    expect(restored?.phase).toBe("result");
    expect(restored?.pendingAttempt?.before.name).toBe("Núcleo de fénix");
    expect(restored?.workingItem?.modifiers[0]?.text).toContain("daño de hielo");
    expect(restored?.resultItem?.modifiers[0]?.text).toContain("daño de hielo");
    expect(restored?.resultText).toBe(progress.resultText);
  });

  it("descarta un supuesto resultado que no conserva antes y después", () => {
    const storage = fakeStorage();
    const identity = {
      itemId: "resultado-incompleto",
      baseType: "Ballesta barnizada",
    };
    const progress = {
      ...emptyCraftingCoachProgress(identity),
      goalText: "Quiero mejorar esta pieza",
      directionChosen: true,
    };

    expect(saveCraftingCoachProgress(progress, storage)).toBe(true);
    const [key, raw] = [...storage.data.entries()][0];
    const serialized = JSON.parse(raw);
    serialized.phase = "result";
    storage.setItem(key, JSON.stringify(serialized));

    expect(loadCraftingCoachProgress(identity, storage)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });
});
