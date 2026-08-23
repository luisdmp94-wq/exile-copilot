import { describe, expect, it } from "vitest";
import {
  ACADEMY_STORAGE_KEY,
  AcademyProgressSchema,
  discardAcademyProgress,
  emptyAcademyProgress,
  loadAcademyProgress,
  saveAcademyProgress,
} from "../../src/lib/craftingAcademyProgress.js";
import {
  CRAFTING_ACADEMY_CONTENT_VERSION,
  CRAFTING_ACADEMY_EXAM,
} from "../../shared/craftingAcademy.js";

/** `localStorage` mínimo, para probar la restauración sin navegador. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const examIds = CRAFTING_ACADEMY_EXAM.map((scenario) => scenario.id);

describe("progreso de la Academia — persistencia", () => {
  it("sobrevive a una recarga: lo guardado se restaura igual", () => {
    const storage = fakeStorage();
    const progress = {
      ...emptyAcademyProgress([...examIds]),
      stage: "exam" as const,
      cursor: 2,
      answers: { [examIds[0]]: { optionId: "regal", correct: false } },
    };
    expect(saveAcademyProgress(progress, storage)).toBe(true);

    const restored = loadAcademyProgress(storage);
    expect(restored).toEqual(progress);
    expect(restored?.answers[examIds[0]].correct).toBe(false);
  });

  it("sin nada guardado devuelve null, que significa empezar de cero", () => {
    expect(loadAcademyProgress(fakeStorage())).toBeNull();
  });

  it("usa una clave propia y versionada que no colisiona con el personaje", () => {
    expect(ACADEMY_STORAGE_KEY).toBe("exile-copilot:academia-crafting:v1");
    expect(ACADEMY_STORAGE_KEY).not.toContain("characterId");
    const storage = fakeStorage({ "exile-copilot:characterId": "perfil-real" });
    saveAcademyProgress(emptyAcademyProgress([...examIds]), storage);
    expect(storage.getItem("exile-copilot:characterId")).toBe("perfil-real");
    discardAcademyProgress(storage);
    expect(storage.getItem("exile-copilot:characterId")).toBe("perfil-real");
  });
});

describe("progreso de la Academia — recuperación segura", () => {
  it("descarta un JSON ilegible y limpia la clave corrupta", () => {
    const storage = fakeStorage({ [ACADEMY_STORAGE_KEY]: "{esto no es json" });
    expect(loadAcademyProgress(storage)).toBeNull();
    expect(storage.getItem(ACADEMY_STORAGE_KEY)).toBeNull();
  });

  it("descarta un objeto con forma inválida sin lanzar", () => {
    const storage = fakeStorage({
      [ACADEMY_STORAGE_KEY]: JSON.stringify({ schemaVersion: 9, stage: "otro", cursor: -3 }),
    });
    expect(() => loadAcademyProgress(storage)).not.toThrow();
    expect(loadAcademyProgress(storage)).toBeNull();
    expect(storage.getItem(ACADEMY_STORAGE_KEY)).toBeNull();
  });

  it("descarta el progreso de una versión de contenido distinta", () => {
    const storage = fakeStorage({
      [ACADEMY_STORAGE_KEY]: JSON.stringify({
        ...emptyAcademyProgress([...examIds]),
        contentVersion: "otra-version-antigua",
      }),
    });
    expect(loadAcademyProgress(storage)).toBeNull();
  });

  it("ignora respuestas de escenarios que ya no existen sin perder las válidas", () => {
    const storage = fakeStorage({
      [ACADEMY_STORAGE_KEY]: JSON.stringify({
        ...emptyAcademyProgress([...examIds, "escenario-fantasma"]),
        stage: "exam",
        answers: {
          [examIds[0]]: { optionId: "transmutation", correct: true },
          "escenario-fantasma": { optionId: "loquesea", correct: true },
        },
      }),
    });
    const restored = loadAcademyProgress(storage);
    expect(restored).not.toBeNull();
    expect(Object.keys(restored!.answers)).toEqual([examIds[0]]);
    expect(restored!.examScenarioIds).not.toContain("escenario-fantasma");
  });

  it("un cursor fuera de rango no pasa la validación", () => {
    const parsed = AcademyProgressSchema.safeParse({
      ...emptyAcademyProgress([...examIds]),
      cursor: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it("sobrevive a un almacenamiento que lanza al leer o escribir", () => {
    const roto = {
      getItem: () => {
        throw new Error("almacenamiento bloqueado");
      },
      setItem: () => {
        throw new Error("cuota llena");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(loadAcademyProgress(roto)).toBeNull();
    expect(saveAcademyProgress(emptyAcademyProgress([...examIds]), roto)).toBe(false);
    expect(() => discardAcademyProgress(roto)).not.toThrow();
  });

  it("sin almacenamiento disponible la Academia sigue siendo jugable", () => {
    expect(loadAcademyProgress(null)).toBeNull();
    expect(saveAcademyProgress(emptyAcademyProgress([...examIds]), null)).toBe(false);
    expect(() => discardAcademyProgress(null)).not.toThrow();
  });
});

describe("progreso de la Academia — reinicio", () => {
  it("descartar borra el progreso guardado y deja empezar limpio", () => {
    const storage = fakeStorage();
    saveAcademyProgress(
      { ...emptyAcademyProgress([...examIds]), stage: "results", cursor: 5 },
      storage,
    );
    expect(loadAcademyProgress(storage)).not.toBeNull();

    discardAcademyProgress(storage);

    expect(storage.getItem(ACADEMY_STORAGE_KEY)).toBeNull();
    expect(loadAcademyProgress(storage)).toBeNull();
    const fresh = emptyAcademyProgress([...examIds]);
    expect(fresh.stage).toBe("intro");
    expect(fresh.cursor).toBe(0);
    expect(fresh.answers).toEqual({});
    expect(fresh.contentVersion).toBe(CRAFTING_ACADEMY_CONTENT_VERSION);
  });
});
