import { describe, expect, it } from "vitest";
import {
  chooseNextStep,
  readCraftResult,
  suggestDirectionFromCharacter,
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

describe("guía de crafting — legalidad, orientación y ajuste son ejes distintos", () => {
  const casos = [
    ["normal", pieza({ rarity: "normal", modifiers: [] })],
    [
      "mágico con hueco",
      pieza({ rarity: "magic", modifiers: [mod("a", "+31 vida", "prefix", ["Vida"])] }),
    ],
    ["raro con hueco", pieza({ modifiers: [mod("a", "+55 vida", "prefix", ["Vida"])] })],
  ] as const;

  it("elegir daño o defensa no cambia la acción legal", () => {
    for (const [etiqueta, item] of casos) {
      const sinDireccion = chooseNextStep(item, null);
      const conDano = chooseNextStep(item, "damage");
      const conDefensa = chooseNextStep(item, "defence");
      expect(sinDireccion.kind, etiqueta).toBe("use-currency");
      if (
        sinDireccion.kind !== "use-currency" ||
        conDano.kind !== "use-currency" ||
        conDefensa.kind !== "use-currency"
      ) {
        continue;
      }
      expect(conDano.actionId, etiqueta).toBe(sinDireccion.actionId);
      expect(conDefensa.actionId, etiqueta).toBe(sinDireccion.actionId);
      expect(conDano.why, etiqueta).toBe(sinDireccion.why);
    }
  });

  it("ninguna moneda observada se etiqueta como dirigida", () => {
    for (const [etiqueta, item] of casos) {
      const step = chooseNextStep(item, "damage");
      if (step.kind !== "use-currency") continue;
      expect(step.legality, etiqueta).toBe("legal");
      expect(step.steering, etiqueta).not.toBe("directed");
      expect(["random-declared", "undeclared"], etiqueta).toContain(step.steering);
    }
  });

  it("ser legal nunca se confunde con encajar en el objetivo", () => {
    const step = chooseNextStep(casos[2][1], "damage");
    expect(step.kind).toBe("use-currency");
    if (step.kind !== "use-currency") return;
    expect(step.legality).toBe("legal");
    // Antes de craftear un resultado aleatorio, el ajuste no puede confirmarse.
    expect(step.goalFit).toBe("not-confirmed");
    const sinDireccion = chooseNextStep(casos[2][1], null);
    expect(sinDireccion.kind).toBe("use-currency");
    if (sinDireccion.kind !== "use-currency") return;
    expect(sinDireccion.goalFit).toBe("not-evaluable");
  });

  it("declara el límite de dirección con la palabra que el jugador eligió", () => {
    const dano = chooseNextStep(casos[2][1], "damage");
    const defensa = chooseNextStep(casos[2][1], "defence");
    if (dano.kind !== "use-currency" || defensa.kind !== "use-currency") return;
    expect(dano.directionNotice).toBe(
      "Esta moneda puede añadir un modificador, pero no puedo dirigirlo hacia daño.",
    );
    expect(defensa.directionNotice).toBe(
      "Esta moneda puede añadir un modificador, pero no puedo dirigirlo hacia defensa.",
    );

  });

  it("la aleatoriedad se afirma fuera del detalle plegado", () => {
    for (const [etiqueta, item] of casos) {
      const step = chooseNextStep(item, "damage");
      if (step.kind !== "use-currency") continue;
      // `randomnessNotice` es un campo de primer nivel: la interfaz lo pinta
      // siempre. `whatCanHappen` es el detalle que sí puede ir plegado.
      expect(step.randomnessNotice, etiqueta).toMatch(/aleatorio|no se puede saber/i);
      expect(step.randomnessNotice, etiqueta).not.toBe("");
    }
  });
});

describe("guía de crafting — «No sé qué necesita»", () => {
  const conResistenciasBajas = {
    resistances: { fire: 40, cold: 76, lightning: 75, chaos: null },
  };

  it("no deduce nada de los modificadores de la propia pieza", () => {
    // Una pieza cargada de daño NO demuestra que el personaje necesite daño.
    const guess = suggestDirectionFromCharacter(null);
    expect(guess.direction).toBeNull();
    expect(guess.reason).toBe("No puedo decidirlo mirando solo esta pieza.");
  });

  it("sin expediente o sin carencia comprobable no inventa una necesidad", () => {
    expect(suggestDirectionFromCharacter(null).direction).toBeNull();
    expect(
      suggestDirectionFromCharacter({
        resistances: { fire: 75, cold: 80, lightning: 90, chaos: -20 },
      }).direction,
    ).toBeNull();
    expect(
      suggestDirectionFromCharacter({
        resistances: { fire: null, cold: null, lightning: null, chaos: null },
      }).reason,
    ).toBe("No puedo decidirlo mirando solo esta pieza.");
  });

  it("con una carencia declarada en el expediente cita el dato exacto", () => {
    const guess = suggestDirectionFromCharacter(conResistenciasBajas);
    expect(guess.direction).toBe("defence");
    expect(guess.reason).toContain("fuego 40%");
    expect(guess.reason).toContain("75%");
    // Solo se citan las que están por debajo del umbral.
    expect(guess.reason).not.toContain("frío");
    expect(guess.reason).not.toContain("rayo");
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
    expect(reading.goalFit).toBe("confirmed");
    expect(reading.directionNote).toBe("El nuevo modificador está relacionado con defensa.");
    expect(reading.improvementCaveat).toContain("no demuestra todavía");
  });

  it("relaciona el resultado con la dirección elegida sin declararlo útil", () => {
    const comparison = compareCraftingResult(antes, despues, "augmentation", {
      protectedModifierIds: [],
    });
    const reading = readCraftResult({ comparison, resultItem: despues, direction: "damage" });
    expect(reading.goalFit).toBe("not-confirmed");
    expect(reading.directionNote).toBe("El nuevo modificador no está relacionado con daño.");
    expect(reading.directionNote).not.toMatch(/mejora|garantiz/i);
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
