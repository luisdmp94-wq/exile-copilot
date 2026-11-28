import { describe, expect, it } from "vitest";
import {
  FRACTURING_MINIMUM_MODIFIERS,
  FRACTURING_ORB_SOURCE,
  evaluateFracturingPlan,
  type FracturingPlanInput,
} from "../../shared/craftingFracturing.js";
import type { Item, Modifier } from "../../shared/domain.js";

/**
 * Planificador del Orbe fracturante (tarea 19 del plan). La regla sale del
 * texto del objeto en el juego: objeto raro, al menos 4 modificadores, uno al
 * azar queda fijo, y no vale en piezas ya fracturadas.
 */

function modifier(id: string, patch: Partial<Modifier> = {}): Modifier {
  return { id, text: id, kind: "explicit", affix: "prefix", values: [], verified: false, ...patch };
}

const FIVE = ["vida", "fuego", "hielo", "rayo", "velocidad"].map((id) => modifier(id));

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "pieza",
    name: "Pieza de prueba",
    baseType: "Botas de prueba",
    slot: "boots",
    rarity: "rare",
    itemLevel: 60,
    modifiers: FIVE,
    craftingState: { corrupted: false, mirrored: false, split: false, unidentified: false },
    sources: [],
    ...patch,
  };
}

const plan = (patch: Partial<FracturingPlanInput> = {}): FracturingPlanInput => ({ patch: "0.5.5", protectedModifierIds: [], ...patch });

describe("Orbe fracturante: lo que dice el juego", () => {
  it("la regla lleva su texto, de dónde sale y cuándo se leyó", () => {
    expect(FRACTURING_ORB_SOURCE.name).toEqual({ es: "Orbe fracturante", en: "Fracturing Orb" });
    expect(FRACTURING_ORB_SOURCE.text.es).toContain("al menos 4 modificadores");
    expect(FRACTURING_ORB_SOURCE.text.en).toContain("at least 4 modifiers");
    expect(FRACTURING_ORB_SOURCE.readAt).toBe("2026-11-28");
    expect(FRACTURING_MINIMUM_MODIFIERS).toBe(4);
  });
});

describe("Orbe fracturante: ¿se puede usar en esta pieza?", () => {
  it("en una rara con cinco modificadores, sí, y dice qué pasa", () => {
    const result = evaluateFracturingPlan(item(), plan());
    expect(result.status).toBe("compatible");
    expect(result.reason).toBe("Se puede usar: el Orbe fracturante dejará fijo, al azar, 1 de los 5 modificadores explícitos de esta pieza.");
    expect(result.explicitModifierCount).toBe(5);
    expect(result.irreversible).toBe(true);
    expect(result.outlook[0]).toBe("Cada uno de los 5 modificadores tiene la misma probabilidad de quedarse fijo: 1 de 5 (20 %).");
    expect(result.outlook.at(-1)).toContain("No tiene vuelta atrás");
  });

  it("con cuatro justos también vale", () => {
    expect(evaluateFracturingPlan(item({ modifiers: FIVE.slice(0, 4) }), plan()).status).toBe("compatible");
  });

  it("no vale en una pieza que no es rara", () => {
    const result = evaluateFracturingPlan(item({ rarity: "magic" }), plan());
    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("El Orbe fracturante solo vale en objetos raros, y esta pieza es mágica.");
  });

  it("con menos de cuatro modificadores, no, y dice cuántos lleva", () => {
    const result = evaluateFracturingPlan(item({ modifiers: FIVE.slice(0, 3) }), plan());
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("pide al menos 4 modificadores y esta pieza tiene 3");
  });

  it("tres explícitos y un implícito: no afirma, manda a mirarlo en el juego", () => {
    const withImplicit = [...FIVE.slice(0, 3), modifier("implícito", { kind: "implicit" })];
    const result = evaluateFracturingPlan(item({ modifiers: withImplicit }), plan());
    expect(result.status).toBe("needs-data");
    expect(result.reason).toContain("No sé si el juego cuenta también los implícitos");
  });

  it("no vale en una pieza ya fracturada, lo diga el estado o un modificador", () => {
    const byState = evaluateFracturingPlan(
      item({ craftingState: { corrupted: false, mirrored: false, split: false, unidentified: false, fractured: true } }),
      plan(),
    );
    expect(byState.status).toBe("blocked");
    expect(byState.reason).toContain("no se puede usar en objetos fracturados");
    const byModifier = evaluateFracturingPlan(item({ modifiers: [...FIVE.slice(0, 4), modifier("fijo", { fractured: true })] }), plan());
    expect(byModifier.status).toBe("blocked");
  });

  it("no vale en una pieza corrupta, reflejada o que no se puede modificar", () => {
    const base = { corrupted: false, mirrored: false, split: false, unidentified: false };
    expect(evaluateFracturingPlan(item({ craftingState: { ...base, corrupted: true } }), plan()).status).toBe("blocked");
    expect(evaluateFracturingPlan(item({ craftingState: { ...base, mirrored: true } }), plan()).status).toBe("blocked");
    expect(evaluateFracturingPlan(item({ craftingState: { ...base, unmodifiable: true } }), plan()).status).toBe("blocked");
  });

  it("con un estado raro o sin saber el estado, pide datos en vez de decidir", () => {
    const base = { corrupted: false, mirrored: false, split: false, unidentified: false };
    expect(evaluateFracturingPlan(item({ craftingState: { ...base, desecrated: true } }), plan()).status).toBe("needs-data");
    const unknown = evaluateFracturingPlan(item({ craftingState: undefined }), plan());
    expect(unknown.status).toBe("needs-data");
    expect(unknown.reason).toContain("Ctrl+Alt+C");
  });

  it("la regla no se da por buena para otro parche", () => {
    const result = evaluateFracturingPlan(item(), plan({ patch: "1.0" }));
    expect(result.status).toBe("needs-data");
    expect(result.reason).toContain("No está revisada para 1.0");
    expect(evaluateFracturingPlan(item(), plan({ patch: "0.5.5h" })).status).toBe("compatible");
  });
});

describe("Orbe fracturante: la probabilidad de que caiga donde quieres", () => {
  it("con dos de cinco marcados: 40 % bien, 60 % mal", () => {
    const result = evaluateFracturingPlan(item(), plan({ protectedModifierIds: ["vida", "velocidad"] }));
    expect(result.wantedOdds).toEqual({ wanted: 2, of: 5 });
    expect(result.outlook[1]).toBe(
      "De los que quieres conservar: 2 de 5 (40 %) de que el fijo sea uno de ellos, y 3 de 5 (60 %) de que se quede fijo uno que no querías.",
    );
  });

  it("sin marcar ninguno, lo pide", () => {
    const result = evaluateFracturingPlan(item(), plan());
    expect(result.wantedOdds).toBeNull();
    expect(result.outlook[1]).toContain("No has marcado qué modificadores quieres conservar");
  });

  it("solo cuentan los explícitos de la pieza: un id que no está no suma", () => {
    const result = evaluateFracturingPlan(item(), plan({ protectedModifierIds: ["vida", "no-existe"] }));
    expect(result.wantedOdds).toEqual({ wanted: 1, of: 5 });
  });

  it("si la pieza no admite el orbe, no hay probabilidad que dar", () => {
    const result = evaluateFracturingPlan(item({ rarity: "normal" }), plan({ protectedModifierIds: ["vida"] }));
    expect(result.wantedOdds).toBeNull();
    expect(result.outlook).toEqual([]);
  });
});

describe("Orbe fracturante: en inglés", () => {
  it("contesta con el nombre del juego en inglés", () => {
    const result = evaluateFracturingPlan(item(), plan({ protectedModifierIds: ["vida"] }), "en");
    expect(result.reason).toBe("You can use it: the Fracturing Orb will lock, at random, 1 of this item's 5 explicit modifiers.");
    expect(result.outlook[1]).toContain("1 in 5 (20%) that the locked one is one of them");
    expect(evaluateFracturingPlan(item({ rarity: "unique" }), plan(), "en").reason).toBe(
      "The Fracturing Orb only works on rare items, and this one is unique.",
    );
  });
});
