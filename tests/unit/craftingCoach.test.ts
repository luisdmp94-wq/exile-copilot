import { describe, expect, it } from "vitest";
import {
  chooseNextStep,
  guessDirectionFromItem,
  readCraftResult,
  readItemInPlainWords,
} from "../../shared/craftingCoach.js";
import { compareCraftingResult } from "../../shared/craftingComparison.js";
import { evaluateObservedCraftingActions } from "../../shared/craftingActions.js";
import { ItemSchema, type Item, type Modifier } from "../../shared/domain.js";

const ESTADO_LIMPIO = { corrupted: false, mirrored: false, split: false, unidentified: false };

function mod(id: string, text: string, affix: "prefix" | "suffix", tags: string[]): Modifier {
  return { id, text, kind: "explicit", values: [], verified: true, affix, tags };
}

function pieza(overrides: Record<string, unknown> = {}): Item {
  return ItemSchema.parse({
    id: "pieza",
    name: "Yelmo del exiliado",
    baseType: "Yelmo de escamas",
    slot: "helmet",
    rarity: "rare",
    itemLevel: 70,
    modifiers: [],
    craftingState: { ...ESTADO_LIMPIO },
    sources: [],
    ...overrides,
  });
}

/** Todo el texto que el guía enseñaría para este paso. */
function textoDelPaso(step: ReturnType<typeof chooseNextStep>): string {
  const comun = [step.instruction, step.why];
  if (step.kind === "use-currency") {
    return [
      ...comun,
      step.label,
      step.warning ?? "",
      ...step.whatCanHappen,
      ...step.evidence,
    ].join(" ");
  }
  if (step.kind === "stop") return [step.headline, ...comun, ...step.evidence].join(" ");
  return [step.headline, ...comun].join(" ");
}

describe("guía de crafting — la única siguiente acción", () => {
  it("sobre una pieza normal propone la acción compatible y nada más", () => {
    const item = pieza({ rarity: "normal", modifiers: [] });
    const step = chooseNextStep(item);

    expect(step.kind).toBe("use-currency");
    if (step.kind !== "use-currency") return;
    expect(step.actionId).toBe("transmutation");
    expect(step.instruction).toContain("Yelmo del exiliado");
    expect(step.alternatives).toHaveLength(0);
    // Coincide con el motor de legalidad: el guía no tiene una verdad propia.
    const compatibles = evaluateObservedCraftingActions(item).filter(
      (entry) => entry.status === "compatible",
    );
    expect(compatibles.map((entry) => entry.action.id)).toEqual(["transmutation"]);
  });

  it("sobre un mágico con hueco elige la vía que dejará de existir y ofrece la otra", () => {
    const item = pieza({
      rarity: "magic",
      modifiers: [mod("a", "+24% a la resistencia al frío", "suffix", ["Resistencias"])],
    });
    const step = chooseNextStep(item);

    expect(step.kind).toBe("use-currency");
    if (step.kind !== "use-currency") return;
    // Aumento exige un objeto mágico; Regio lo convertiría en raro y cerraría
    // esa puerta. La preferencia es estructural, no un juicio de calidad.
    expect(step.actionId).toBe("augmentation");
    expect(step.alternatives.map((alternative) => alternative.actionId)).toEqual(["regal"]);
    expect(step.why).toContain("seguirá disponible después");
  });

  it("avisa de una consecuencia real y solo cuando existe", () => {
    const conRiesgo = chooseNextStep(
      pieza({
        rarity: "magic",
        modifiers: [
          mod("a", "+31 a la vida máxima", "prefix", ["Vida"]),
          mod("b", "+24% a la resistencia al frío", "suffix", ["Resistencias"]),
        ],
      }),
    );
    expect(conRiesgo.kind).toBe("use-currency");
    if (conRiesgo.kind === "use-currency") {
      expect(conRiesgo.actionId).toBe("regal");
      expect(conRiesgo.warning).toContain("dejarás de poder usar");
    }

    const sinRiesgo = chooseNextStep(
      pieza({
        modifiers: [
          mod("a", "+55 a la vida máxima", "prefix", ["Vida"]),
          mod("b", "+18% a la evasión", "prefix", ["Defensa"]),
          mod("c", "+25% de daño", "suffix", ["Daño"]),
        ],
      }),
    );
    expect(sinRiesgo.kind).toBe("use-currency");
    if (sinRiesgo.kind === "use-currency") {
      expect(sinRiesgo.actionId).toBe("exalted");
      expect(sinRiesgo.warning).toBeNull();
    }
  });

  it("sobre una pieza rara llena manda parar y explica por qué", () => {
    const item = pieza({
      modifiers: ["a", "b", "c", "d", "e", "f"].map((id, index) =>
        mod(id, `+${index + 1} a la vida máxima`, index < 3 ? "prefix" : "suffix", ["Vida"]),
      ),
    });
    const step = chooseNextStep(item);

    expect(step.kind).toBe("stop");
    if (step.kind !== "stop") return;
    expect(step.headline).toContain("llena");
    expect(step.why).toContain("6");
    expect(step.needsAdvancedTools).toBe(true);
  });

  it("con datos incompletos pide la evidencia que falta en vez de gastar", () => {
    // Sin `craftingState` no se puede afirmar que ninguna moneda sea legal.
    const item = pieza({
      rarity: "magic",
      craftingState: undefined,
      modifiers: [mod("a", "+24% a la resistencia al frío", "suffix", ["Resistencias"])],
    });
    const step = chooseNextStep(item);

    expect(step.kind).toBe("needs-data");
    if (step.kind !== "needs-data") return;
    expect(step.instruction).toContain("descripciones avanzadas");
    expect(textoDelPaso(step)).not.toMatch(/usa un orbe/i);
  });

  it("nunca promete un resultado ni menciona probabilidades o precios", () => {
    const casos = [
      pieza({ rarity: "normal", modifiers: [] }),
      pieza({ rarity: "magic", modifiers: [mod("a", "+31 vida", "prefix", ["Vida"])] }),
      pieza({ modifiers: [mod("a", "+55 vida", "prefix", ["Vida"])] }),
    ];
    for (const item of casos) {
      const texto = textoDelPaso(chooseNextStep(item));
      expect(texto).not.toMatch(/garantiz|asegur[ao]|seguro que|probabilidad|precio|\bDPS\b/i);
      expect(texto).toMatch(/aleatorio/i);
    }
  });
});

describe("guía de crafting — leer la pieza en palabras", () => {
  it("resume rareza, prefijos, sufijos y huecos sin jerga", () => {
    const reading = readItemInPlainWords(
      pieza({
        modifiers: [
          mod("a", "+55 a la vida máxima", "prefix", ["Vida"]),
          mod("b", "+25% de daño", "suffix", ["Daño"]),
        ],
      }),
    );
    expect(reading.sentence).toContain("raro");
    expect(reading.sentence).toContain("1 prefijo");
    expect(reading.sentence).toContain("1 sufijo");
    expect(reading.sentence).toContain("caben 4 más");
    expect(reading.sentence).not.toMatch(/compatibilidad|preflight|objetivo|enum/i);
  });

  it("dice que una pieza llena no admite nada más", () => {
    const reading = readItemInPlainWords(
      pieza({
        modifiers: ["a", "b", "c", "d", "e", "f"].map((id, index) =>
          mod(id, `+${index} vida`, index < 3 ? "prefix" : "suffix", ["Vida"]),
        ),
      }),
    );
    expect(reading.sentence).toContain("no cabe nada más");
    expect(reading.openSlots).toBe(0);
  });
});

describe("guía de crafting — «No sé qué necesita»", () => {
  it("deduce la dirección solo desde las etiquetas que la pieza ya muestra", () => {
    const guess = guessDirectionFromItem(
      pieza({
        modifiers: [
          mod("a", "+55 a la vida máxima", "prefix", ["Vida"]),
          mod("b", "+31% a la resistencia al fuego", "suffix", ["Resistencias"]),
          mod("c", "+25% de daño físico", "suffix", ["Daño"]),
        ],
      }),
    );
    expect(guess.direction).toBe("defence");
    expect(guess.reason).toContain("2");
  });

  it("no elige cuando no hay modificadores", () => {
    const guess = guessDirectionFromItem(pieza({ rarity: "normal", modifiers: [] }));
    expect(guess.direction).toBeNull();
    expect(guess.reason).toContain("no puedo deducir");
  });

  it("no elige cuando las etiquetas empatan", () => {
    const guess = guessDirectionFromItem(
      pieza({
        modifiers: [
          mod("a", "+55 a la vida máxima", "prefix", ["Vida"]),
          mod("b", "+25% de daño físico", "suffix", ["Daño"]),
        ],
      }),
    );
    expect(guess.direction).toBeNull();
    expect(guess.reason).toContain("empatado");
  });

  it("no elige cuando las etiquetas no son de daño ni de defensa", () => {
    const guess = guessDirectionFromItem(
      pieza({
        rarity: "magic",
        modifiers: [mod("a", "+18% a la velocidad de movimiento", "suffix", ["Velocidad"])],
      }),
    );
    expect(guess.direction).toBeNull();
  });
});

describe("guía de crafting — antes y después", () => {
  const antes = pieza({
    rarity: "magic",
    modifiers: [mod("a", "+31 a la vida máxima", "prefix", ["Vida"])],
  });
  const despues = pieza({
    rarity: "magic",
    modifiers: [
      mod("a2", "+31 a la vida máxima", "prefix", ["Vida"]),
      mod("b2", "+24% a la resistencia al frío", "suffix", ["Resistencias"]),
    ],
  });

  it("dice qué cambió, qué se conservó y si se puede seguir", () => {
    const comparison = compareCraftingResult(antes, despues, "augmentation", {
      protectedModifierIds: [],
    });
    const reading = readCraftResult({ comparison, resultItem: despues, direction: "defence" });

    expect(comparison.status).toBe("confirmed");
    expect(reading.changed).toEqual(["+24% a la resistencia al frío"]);
    expect(reading.kept).toContain("No se ha perdido nada");
    // Con 2 de 2 modificadores, Aumento deja de valer y aparece Regio.
    expect(reading.verdict).toBe("continue");
    expect(reading.nextStep?.kind).toBe("use-currency");
    expect(reading.directionNote).toContain("la defensa");
  });

  it("relaciona el resultado con la dirección elegida sin declararlo útil", () => {
    const comparison = compareCraftingResult(antes, despues, "augmentation", {
      protectedModifierIds: [],
    });
    const reading = readCraftResult({ comparison, resultItem: despues, direction: "damage" });
    expect(reading.directionNote).toContain("no lo hace inútil");
    expect(reading.directionNote).not.toMatch(/garantiz/i);
  });

  it("si la comparación no cuadra manda parar y volver a copiar", () => {
    const otro = pieza({ id: "otro", name: "Otra pieza", rarity: "rare", modifiers: [] });
    const comparison = compareCraftingResult(antes, otro, "augmentation", {
      protectedModifierIds: [],
    });
    const reading = readCraftResult({ comparison, resultItem: otro, direction: null });

    expect(reading.verdict).toBe("stop");
    expect(reading.verdictText).toContain("Vuelve a copiar");
    expect(reading.nextStep).toBeNull();
  });

  it("tras llenar la pieza el veredicto pasa a parar", () => {
    const casiLleno = pieza({
      modifiers: ["a", "b", "c", "d", "e"].map((id, index) =>
        mod(id, `+${index} a la vida máxima`, index < 3 ? "prefix" : "suffix", ["Vida"]),
      ),
    });
    const lleno = pieza({
      modifiers: ["a", "b", "c", "d", "e", "f"].map((id, index) =>
        mod(id, `+${index} a la vida máxima`, index < 3 ? "prefix" : "suffix", ["Vida"]),
      ),
    });
    const comparison = compareCraftingResult(casiLleno, lleno, "exalted", {
      protectedModifierIds: [],
    });
    const reading = readCraftResult({ comparison, resultItem: lleno, direction: null });

    expect(reading.verdict).toBe("stop");
    expect(reading.nextStep?.kind).toBe("stop");
  });
});
