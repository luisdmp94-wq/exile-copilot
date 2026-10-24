import { describe, expect, it } from "vitest";
import { CharacterProfileSchema } from "../../shared/domain.js";
import type { BuildCheckInput } from "../../src/lib/buildPriorities.js";
import { prioritiesForInput } from "../../src/lib/buildPriorities.js";
import {
  clearCheckHistory,
  compareChecks,
  isSameCharacter,
  loadCheckHistory,
  saveCheck,
  snapshotForCheck,
  timeSince,
  type CheckSnapshot,
} from "../../src/lib/checkHistory.js";

const ALL_SLOTS = ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"] as const;

function input(
  resistances: Partial<BuildCheckInput["resistances"]>,
  equippedSlots: BuildCheckInput["equippedSlots"] = [...ALL_SLOTS],
): BuildCheckInput {
  return {
    resistances: { fire: 75, cold: 75, lightning: 75, chaos: 0, ...resistances },
    equippedSlots,
  };
}

function snapshot(
  checkInput: BuildCheckInput,
  checkedAt: string,
  character?: { characterClass: string; ascendancy: string; level: number },
): CheckSnapshot {
  const profile = character
    ? CharacterProfileSchema.parse({
        id: "historial",
        name: "Prueba",
        characterClass: character.characterClass,
        ascendancy: character.ascendancy,
        level: character.level,
        levelSource: "observed",
        league: "Standard",
        patch: "0.5.5",
        importedAt: checkedAt,
      })
    : null;
  return snapshotForCheck(checkInput, prioritiesForInput(checkInput, "es", "maps"), profile, new Date(checkedAt));
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const now = new Date("2026-10-26T12:00:00.000Z");
const ranger = { characterClass: "Ranger", ascendancy: "Deadeye", level: 45 };

describe("memoria del mentor — comparar con el chequeo anterior", () => {
  it("cuenta lo que mejoró, con el nivel y lo que ya está resuelto", () => {
    const before = snapshot(
      input({ fire: 52, chaos: -24 }, ALL_SLOTS.filter((slot) => slot !== "ring2")),
      "2026-10-24T12:00:00.000Z",
      ranger,
    );
    const after = snapshot(
      input({ fire: 75, chaos: -10 }),
      now.toISOString(),
      { ...ranger, level: 52 },
    );

    const comparison = compareChecks(before, after, now, "es");
    expect(comparison.trend).toBe("better");
    expect(comparison.headline).toBe("Vas mejorando desde tu último chequeo (anteayer).");
    expect(comparison.changes).toEqual([
      { text: "Nivel 45 → 52", direction: "info" },
      { text: "Fuego 52% → 75% (+23)", direction: "better" },
      { text: "Caos −24% → −10% (+14)", direction: "better" },
      { text: "Ya llevas: Anillo 2", direction: "better" },
      { text: "Resuelto: resistencias elementales", direction: "better" },
      { text: "Resuelto: huecos de equipo vacíos", direction: "better" },
    ]);
  });

  it("avisa de lo que empeoró y distingue los cambios mezclados", () => {
    const before = snapshot(input({ fire: 75, cold: 70 }), "2026-10-26T09:00:00.000Z");
    const after = snapshot(
      input({ fire: 60, cold: 75 }, ALL_SLOTS.filter((slot) => slot !== "helmet")),
      now.toISOString(),
    );

    const comparison = compareChecks(before, after, now, "en");
    expect(comparison.trend).toBe("mixed");
    expect(comparison.headline).toBe(
      "Things changed since your last check (3 hours ago): some better, some worse.",
    );
    expect(comparison.changes).toEqual([
      { text: "Fire 75% → 60% (−15)", direction: "worse" },
      { text: "Cold 70% → 75% (+5)", direction: "better" },
      { text: "Now empty: Helmet", direction: "worse" },
    ]);
  });

  it("si nada cambió lo dice, sin inventar progreso", () => {
    const same = input({ fire: 60 });
    const comparison = compareChecks(
      snapshot(same, "2026-10-26T11:58:00.000Z"),
      snapshot(same, now.toISOString()),
      now,
      "es",
    );
    expect(comparison).toEqual({
      trend: "same",
      headline: "Nada ha cambiado en lo que compruebo desde tu último chequeo (hace 2 minutos).",
      changes: [],
    });
  });

  it("no compara datos que faltan en uno de los dos chequeos", () => {
    const comparison = compareChecks(
      snapshot(input({ fire: null }, null), "2026-10-26T10:00:00.000Z"),
      snapshot(input({ fire: 70 }), now.toISOString()),
      now,
      "es",
    );
    expect(comparison.changes.some((change) => change.text.startsWith("Fuego"))).toBe(false);
    expect(comparison.changes.some((change) => change.text.startsWith("Ya llevas"))).toBe(false);
  });

  it("dos códigos PoB2 de clase o ascendencia distinta son otro personaje; el modo manual no se separa", () => {
    const deadeye = snapshot(input({}), "2026-10-25T12:00:00.000Z", ranger);
    const witch = snapshot(input({}), now.toISOString(), { characterClass: "Witch", ascendancy: "Infernalist", level: 40 });
    const manual = snapshot(input({}), now.toISOString());
    expect(isSameCharacter(deadeye, witch)).toBe(false);
    expect(isSameCharacter(deadeye, snapshot(input({}), now.toISOString(), { ...ranger, level: 60 }))).toBe(true);
    expect(isSameCharacter(deadeye, manual)).toBe(true);
  });

  it("el tiempo transcurrido sale en el idioma de la página", () => {
    expect(timeSince(new Date("2026-10-25T12:00:00.000Z"), now, "es")).toBe("ayer");
    expect(timeSince(new Date("2026-10-25T12:00:00.000Z"), now, "en")).toBe("yesterday");
    expect(timeSince(new Date("2026-10-26T11:59:40.000Z"), now, "en")).toBe("just now");
  });
});

describe("memoria del mentor — guardar en el navegador", () => {
  it("guarda del más reciente al más antiguo y como mucho 20", () => {
    const storage = memoryStorage();
    for (let day = 1; day <= 25; day++) {
      saveCheck(storage, snapshot(input({ fire: day }), `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`));
    }
    const history = loadCheckHistory(storage);
    expect(history).toHaveLength(20);
    expect(history[0].input.resistances.fire).toBe(25);
  });

  it("borrar deja la memoria vacía", () => {
    const storage = memoryStorage();
    saveCheck(storage, snapshot(input({}), now.toISOString()));
    clearCheckHistory(storage);
    expect(loadCheckHistory(storage)).toEqual([]);
  });

  it("datos dañados o sin almacenamiento no rompen el chequeo", () => {
    const storage = memoryStorage();
    storage.setItem("exile-copilot.check.history", "{no es json");
    expect(loadCheckHistory(storage)).toEqual([]);
    storage.setItem("exile-copilot.check.history", JSON.stringify([{ version: 99 }, "basura"]));
    expect(loadCheckHistory(storage)).toEqual([]);
    expect(loadCheckHistory(null)).toEqual([]);
    expect(() => saveCheck(null, snapshot(input({}), now.toISOString()))).not.toThrow();

    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => saveCheck(failing, snapshot(input({}), now.toISOString()))).not.toThrow();
  });
});
