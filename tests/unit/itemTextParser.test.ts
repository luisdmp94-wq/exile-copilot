import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import { evaluateObservedCraftingActions } from "../../shared/craftingActions.js";

const demoText = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/demoItemText.txt", import.meta.url)),
  "utf8",
);
const spanishAdvancedCrossbow = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/phoenixCoreCrossbowAdvanced.es.txt", import.meta.url)),
  "utf8",
);
const spanishAdvancedBow = readFileSync(
  fileURLToPath(
    new URL("../../docs/evidence/crafting/2026-08-22/soul-branch-advanced.es.txt", import.meta.url),
  ),
  "utf8",
);

describe("itemTextParser", () => {
  it("parsea el fixture de ballesta rare del juego", () => {
    const { item, warnings } = parseItemText(demoText);

    expect(item.slot).toBe("weapon");
    expect(item.rarity).toBe("rare");
    expect(item.name).toBe("Doom Song");
    expect(item.baseType).toBe("Varnished Crossbow");
    expect(item.quality).toBe(20);
    expect(item.itemLevel).toBe(82);
    expect(item.requirements).toEqual({ level: 68, str: 90, dex: 200 });

    const implicits = item.modifiers.filter((m) => m.kind === "implicit");
    expect(implicits).toHaveLength(1);
    expect(implicits[0]?.text).toContain("Projectile Skills");
    expect(implicits[0]?.values).toEqual([2]);

    const explicits = item.modifiers.filter((m) => m.kind === "explicit");
    expect(explicits).toHaveLength(4);
    // Los mods no verificados se conservan como texto con verified:false
    for (const mod of item.modifiers) expect(mod.verified).toBe(false);
    expect(warnings).toHaveLength(0);
    expect(item.rawText).toBe(demoText);
  });

  it("parsea un objeto unique (nombre + base)", () => {
    const text = [
      "Item Class: Crossbows",
      "Rarity: Unique",
      "The Coming Calamity",
      "Heavy Crossbow",
      "--------",
      "Physical Damage: 80-120",
      "--------",
      "Item Level: 75",
      "--------",
      "Grants Skill: Galvanic Bolt",
      "+40% to Lightning Resistance",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.rarity).toBe("unique");
    expect(item.name).toBe("The Coming Calamity");
    expect(item.baseType).toBe("Heavy Crossbow");
    expect(item.slot).toBe("weapon");
  });

  it("parsea un objeto magic de una sola línea de nombre", () => {
    const text = [
      "Item Class: Helmets",
      "Rarity: Magic",
      "Gleaming Soldier Helmet",
      "--------",
      "Item Level: 60",
      "--------",
      "+45 to maximum Life",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.rarity).toBe("magic");
    expect(item.name).toBe("Gleaming Soldier Helmet");
    expect(item.slot).toBe("helmet");
    expect(item.modifiers[0]?.values).toEqual([45]);
  });

  it("acepta rareza en español", () => {
    const text = ["Item Class: Crossbows", "Rarity: Raro", "Canción Funesta", "Ballesta"].join("\n");
    const { item } = parseItemText(text);
    expect(item.rarity).toBe("rare");
  });

  it("soporta requisitos en formato combinado de una línea", () => {
    const text = [
      "Item Class: Boots",
      "Rarity: Rare",
      "Trail Treads",
      "Laced Boots",
      "--------",
      "Requirements: Level: 55, Str: 40, Dex: 90",
      "--------",
      "Item Level: 61",
      "--------",
      "25% increased Movement Speed",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.requirements).toEqual({ level: 55, str: 40, dex: 90 });
    expect(item.slot).toBe("boots");
  });

  it("marca mods enchant/rune por su sufijo", () => {
    const text = [
      "Item Class: Amulets",
      "Rarity: Rare",
      "Eye of the Void",
      "Jade Amulet",
      "--------",
      "Item Level: 70",
      "--------",
      "+10% to all Elemental Resistances (enchant)",
      "+20 to Dexterity (rune)",
      "+30 to maximum Life",
    ].join("\n");
    const { item } = parseItemText(text);
    expect(item.modifiers.map((m) => m.kind)).toEqual(["enchant", "rune", "explicit"]);
  });

  it("agrupa afijos multilínea del texto avanzado real en español", () => {
    const { item, warnings } = parseItemText(spanishAdvancedCrossbow);

    expect(item).toMatchObject({
      slot: "weapon",
      rarity: "rare",
      name: "Núcleo de fénix",
      baseType: "Ballesta barnizada",
      itemLevel: 32,
      requirements: { level: 24, str: 19, dex: 19 },
    });
    expect(warnings).toEqual([]);
    expect(item.modifiers).toHaveLength(5);
    expect(item.modifiers.map((mod) => mod.affix)).toEqual([
      "prefix",
      "prefix",
      "prefix",
      "suffix",
      "suffix",
    ]);
    expect(item.modifiers.map((mod) => mod.tier)).toEqual([6, 10, 10, 3, 1]);
    expect(item.modifiers[0]).toMatchObject({
      name: "malvado",
      tags: ["Daño", "Físico", "Ataque"],
      text: "Daño físico aumentado un 81(65-84)%",
      values: [81, 65, 84],
      verified: false,
    });

    const glowSuffix = item.modifiers[4];
    expect(glowSuffix).toMatchObject({ name: "de resplandor", tags: ["Ataque"] });
    expect(glowSuffix?.text).toBe(
      "+49(41-60) a la precisión\nRadio de iluminación aumentado un 15%",
    );
    expect(glowSuffix?.values).toEqual([49, 41, 60, 15]);
  });

  it("distingue runas, implícito, fabricación y profanación del arco real", () => {
    const { item, warnings } = parseItemText(spanishAdvancedBow);

    expect(item).toMatchObject({
      name: "Rama de alma",
      baseType: "Arco obliterador",
      quality: 20,
      itemLevel: 81,
      requirements: { level: 78, dex: 163 },
    });
    expect(warnings).toEqual([]);
    expect(item.modifiers).toHaveLength(9);
    expect(item.modifiers.filter((mod) => mod.kind === "rune")).toHaveLength(2);
    expect(item.modifiers.filter((mod) => mod.kind === "implicit")).toHaveLength(1);

    const explicit = item.modifiers.filter((mod) => mod.kind === "explicit");
    expect(explicit).toHaveLength(6);
    expect(explicit.filter((mod) => mod.affix === "prefix")).toHaveLength(3);
    expect(explicit.filter((mod) => mod.affix === "suffix")).toHaveLength(3);
    expect(explicit.find((mod) => mod.name === "filoso")).toMatchObject({
      tier: 3,
      crafted: true,
    });
    expect(explicit.find((mod) => mod.name === "de Amanamu")).toMatchObject({
      tier: 1,
      desecrated: true,
      text:
        "Velocidad de ataque aumentada un 16(12-18)%\n" +
        "Los compañeros tienen la velocidad de ataque aumentada un 14(12-18)%",
    });
  });
});

/**
 * Regresiones de la frontera estructural.
 *
 * Antes de esta corrección, una cabecera `{ Mod. ... }` absorbía TODAS las
 * líneas siguientes hasta la próxima cabecera o el final de sección. Una marca
 * como «Corrupto» pegada justo después del último afijo acababa dentro de
 * `modifier.text`, `craftingState.corrupted` se quedaba en `false` y el
 * Exaltado se ofrecía como «compatible» sobre un objeto que el propio texto
 * declaraba corrupto.
 */
describe("itemTextParser — fronteras estructurales tras una cabecera avanzada", () => {
  const advancedRareWith = (trailing: string): string =>
    [
      "Clase de objeto: Ballestas",
      "Rareza: Raro",
      "Núcleo de fénix",
      "Ballesta barnizada",
      "------------------",
      "## Nivel de objeto: 32",
      '{ Mod. de prefijo "malvado" (Grado: 6) — Daño, Físico, Ataque }',
      "Daño físico aumentado un 81(65-84)%",
      trailing,
    ].join("\n");

  const statusOf = (text: string, actionId: string): string => {
    const { item } = parseItemText(text);
    const entry = evaluateObservedCraftingActions(item).find(
      (candidate) => candidate.action.id === actionId,
    );
    if (!entry) throw new Error(`Acción no encontrada: ${actionId}`);
    return entry.status;
  };

  it("«Corrupto» pegado tras el último afijo no se absorbe y bloquea el exaltado", () => {
    const text = advancedRareWith("Corrupto");
    const { item } = parseItemText(text);

    expect(item.craftingState?.corrupted).toBe(true);
    expect(item.modifiers).toHaveLength(1);
    expect(item.modifiers[0]?.text).toBe("Daño físico aumentado un 81(65-84)%");
    expect(item.modifiers[0]?.text).not.toContain("Corrupto");
    expect(statusOf(text, "exalted")).not.toBe("compatible");
    expect(statusOf(text, "exalted")).toBe("blocked");
  });

  it.each([
    ["Reflejado", "mirrored" as const, "blocked"],
    ["Dividido", "split" as const, "needs-data"],
    ["Sin identificar", "unidentified" as const, "needs-data"],
  ])("«%s» tampoco se absorbe y retira la compatibilidad", (marca, campo, esperado) => {
    const text = advancedRareWith(marca);
    const { item } = parseItemText(text);

    expect(item.craftingState?.[campo]).toBe(true);
    expect(item.modifiers).toHaveLength(1);
    expect(item.modifiers[0]?.text).not.toContain(marca);
    expect(statusOf(text, "exalted")).not.toBe("compatible");
    expect(statusOf(text, "exalted")).toBe(esperado);
  });

  it("«Nivel de objeto» tras un grupo pendiente se conserva como estructura", () => {
    const text = [
      "Clase de objeto: Ballestas",
      "Rareza: Raro",
      "Núcleo de fénix",
      "Ballesta barnizada",
      "------------------",
      '{ Mod. de prefijo "malvado" (Grado: 6) — Daño }',
      "Daño físico aumentado un 81(65-84)%",
      "## Nivel de objeto: 32",
    ].join("\n");
    const { item } = parseItemText(text);

    expect(item.itemLevel).toBe(32);
    expect(item.modifiers).toHaveLength(1);
    expect(item.modifiers[0]?.text).toBe("Daño físico aumentado un 81(65-84)%");
  });

  it("«Requiere» tras un grupo pendiente no entra en el modificador", () => {
    const text = [
      "Clase de objeto: Ballestas",
      "Rareza: Raro",
      "Núcleo de fénix",
      "Ballesta barnizada",
      "------------------",
      "## Nivel de objeto: 32",
      '{ Mod. de prefijo "malvado" (Grado: 6) — Daño }',
      "Daño físico aumentado un 81(65-84)%",
      "Requiere: Nivel 24, 19 Fue, 19 Des",
    ].join("\n");
    const { item } = parseItemText(text);

    expect(item.requirements).toEqual({ level: 24, str: 19, dex: 19 });
    expect(item.modifiers).toHaveLength(1);
    expect(item.modifiers[0]?.text).toBe("Daño físico aumentado un 81(65-84)%");
  });

  it("ninguna frontera estructural aporta números a modifier.values", () => {
    for (const trailing of [
      "Corrupto",
      "Reflejado",
      "Dividido",
      "Sin identificar",
      "## Nivel de objeto: 77",
      "Requiere: Nivel 24, 19 Fue, 19 Des",
    ]) {
      const { item } = parseItemText(advancedRareWith(trailing));
      expect(item.modifiers).toHaveLength(1);
      // Solo la tirada y su rango; ni el nivel ni los requisitos.
      expect(item.modifiers[0]?.values).toEqual([81, 65, 84]);
    }
  });
});

describe("itemTextParser — evidencia suficiente para craftingState", () => {
  it("los fixtures avanzados completos siguen declarando los cuatro estados en falso", () => {
    for (const text of [spanishAdvancedCrossbow, spanishAdvancedBow]) {
      expect(parseItemText(text).item.craftingState).toEqual({
        corrupted: false,
        mirrored: false,
        split: false,
        unidentified: false,
      });
    }
  });

  it("un texto truncado no afirma ningún estado y deja la acción en «faltan datos»", () => {
    const text = ["Rareza: Mágico", "Anillo de hierro de la llama", "------------------", "Agrega de 3 a 7 de daño de fuego"].join(
      "\n",
    );
    const { item } = parseItemText(text);

    expect(item.craftingState).toBeUndefined();
    const regal = evaluateObservedCraftingActions(item).find(
      (entry) => entry.action.id === "regal",
    );
    expect(regal?.status).toBe("needs-data");
    expect(regal?.status).not.toBe("compatible");
  });

  it("sin descripciones avanzadas tampoco se afirma el estado", () => {
    const text = [
      "Clase de objeto: Anillos",
      "Rareza: Mágico",
      "Anillo de hierro de la llama",
      "------------------",
      "Nivel de objeto: 60",
      "------------------",
      "Agrega de 3 a 7 de daño de fuego",
      "+18% a la resistencia al fuego",
    ].join("\n");
    const { item } = parseItemText(text);

    expect(item.itemLevel).toBe(60);
    expect(item.craftingState).toBeUndefined();
  });

  it("una marca positiva se conserva aunque el texto esté incompleto", () => {
    const text = ["Rareza: Raro", "Núcleo de fénix", "------------------", "Corrupto"].join("\n");
    const { item } = parseItemText(text);

    // La marca es evidencia copiada del juego: se conserva. Los otros tres
    // campos son solo el relleno que exige el esquema; lo único verificado aquí
    // es la corrupción, y basta para que ninguna acción sea compatible.
    expect(item.craftingState?.corrupted).toBe(true);
    for (const entry of evaluateObservedCraftingActions(item)) {
      expect(entry.status).not.toBe("compatible");
    }
  });

  it.each([
    ["Doble corrupción", "doubleCorrupted"],
    ["Santificado", "sanctified"],
    ["No modificable", "unmodifiable"],
    ["No modificable salvo mediante caos", "unmodifiableExceptChaos"],
    ["Mutado", "mutated"],
    ["Profanado", "desecrated"],
  ] as const)("conserva el estado especial «%s» sin convertirlo en modificador", (marker, field) => {
    const text = ["Rareza: Raro", "Objeto de prueba", "------------------", marker].join("\n");
    const { item } = parseItemText(text);

    expect(item.craftingState?.[field]).toBe(true);
    expect(item.modifiers).toHaveLength(0);
  });

  it("distingue modificadores fracturados y mutados en la cabecera avanzada", () => {
    const text = [
      "Clase de objeto: Ballestas",
      "Rareza: Raro",
      "Objeto de prueba",
      "Ballesta de prueba",
      "------------------",
      "Nivel de objeto: 80",
      '{ Mod. de prefijo "firme" fracturado (Grado: 2) — Físico }',
      "Daño físico aumentado un 50%",
      '{ Mod. de sufijo "cambiante" mutado (Grado: 1) — Ataque }',
      "Velocidad de ataque aumentada un 15%",
    ].join("\n");
    const { item } = parseItemText(text);

    expect(item.modifiers[0]?.fractured).toBe(true);
    expect(item.modifiers[0]?.mutated).toBeUndefined();
    expect(item.modifiers[1]?.mutated).toBe(true);
    expect(item.modifiers[1]?.fractured).toBeUndefined();
  });
});
