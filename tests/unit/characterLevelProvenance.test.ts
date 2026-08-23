import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import { evaluateCraftingCharacterContext } from "../../shared/craftingCharacterContext.js";
import type { CraftingComparison } from "../../shared/craftingComparison.js";
import { evaluateCraftingGoalSignal } from "../../shared/craftingGoal.js";
import {
  CharacterProfileSchema,
  ItemSchema,
  PLACEHOLDER_CHARACTER_LEVEL,
  readCharacterLevel,
  type CharacterProfile,
  type Item,
  type Modifier,
} from "../../shared/domain.js";

function mod(id: string, tags: string[]): Modifier {
  return {
    id,
    text: `Modificador ${id}`,
    kind: "explicit",
    values: [],
    verified: true,
    tags,
  };
}

/** Ballesta suelta con requisito de nivel 70 y sin requisito de atributos. */
function looseItem(overrides: Partial<Item> = {}): Item {
  return ItemSchema.parse({
    id: "suelto",
    name: "Núcleo de prueba",
    baseType: "Ballesta barnizada",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 82,
    requirements: { level: 70 },
    modifiers: [],
    sources: [],
    ...overrides,
  });
}

function comparison(overrides: Partial<CraftingComparison> = {}): CraftingComparison {
  return {
    status: "confirmed",
    title: "Cambio confirmado",
    summary: "Aparece un modificador.",
    identityMatches: true,
    itemLevelMatches: true,
    rarityMatches: true,
    addedModifiers: [mod("damage", ["Daño", "Ataque"])],
    removedModifiers: [],
    protectionStatus: "not-requested",
    protectedModifiers: [],
    lostProtectedModifiers: [],
    warnings: [],
    ...overrides,
  };
}

/** Perfil sin `levelSource`: exactamente la forma guardada antes del contrato. */
function legacyProfileInput(original: Item, overrides: Record<string, unknown> = {}) {
  return {
    id: "personaje",
    name: "Personaje",
    characterClass: "Desconocida",
    ascendancy: null,
    ascendancyId: null,
    level: 90,
    archetype: null,
    league: "Liga",
    patch: "0.5.4f",
    items: [original],
    skills: [],
    passives: { allocated: [] },
    attributes: { str: null, dex: null, int: null },
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    sources: [],
    importedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

function profile(original: Item, overrides: Record<string, unknown> = {}): CharacterProfile {
  return CharacterProfileSchema.parse(legacyProfileInput(original, overrides));
}

function contextFor(profileUnderTest: CharacterProfile, original: Item) {
  const observed = comparison();
  return evaluateCraftingCharacterContext({
    profile: profileUnderTest,
    profileGoal: "damage",
    originalItem: original,
    resultItem: looseItem({ modifiers: [mod("damage", ["Daño", "Ataque"])] }),
    comparison: observed,
    goalCategory: "damage",
    goalSignal: evaluateCraftingGoalSignal("damage", observed.addedModifiers),
  });
}

function allText(context: ReturnType<typeof contextFor>): string {
  return [
    context.title,
    context.summary,
    context.requirementLabel,
    ...context.facts,
    ...context.limitations,
  ].join(" ");
}

describe("procedencia del nivel del personaje", () => {
  it("un objeto suelto sin nivel declarado no afirma ni compatibilidad ni incompatibilidad", () => {
    const original = looseItem();
    // Perfil mínimo creado desde un objeto suelto: el número es el mínimo
    // técnico, no un nivel observado.
    const minimal = profile(original, {
      level: PLACEHOLDER_CHARACTER_LEVEL,
      levelSource: "placeholder",
    });
    expect(readCharacterLevel(minimal)).toEqual({
      known: false,
      level: null,
      provenance: "placeholder",
    });

    const context = contextFor(minimal, original);

    expect(context.requirementStatus).toBe("unknown");
    expect(context.requirementStatus).not.toBe("met");
    expect(context.requirementStatus).not.toBe("unmet");
    expect(context.requirementLabel).toBe("Nivel del personaje desconocido");
    expect(context.limitations).toContain(
      "No se puede comprobar el requisito de nivel porque no conocemos el nivel de tu personaje.",
    );
    // Nunca aparece el mínimo técnico presentado como nivel del jugador.
    expect(allText(context)).not.toMatch(/nivel 1\b/i);
    expect(allText(context)).not.toMatch(/nivel 1\/70/);
    expect(allText(context)).not.toContain("No cumple");
    expect(context.facts).not.toContain(
      "El nivel y los atributos conocidos cumplen los requisitos mostrados.",
    );
    // Un nivel desconocido no puede provocar el bloqueo por requisitos.
    expect(context.verdict).not.toBe("stop");
  });

  it("detecta la incompatibilidad cuando el nivel real está por debajo del requisito", () => {
    const original = looseItem();
    const under = profile(original, { level: 40, levelSource: "observed" });
    expect(readCharacterLevel(under)).toEqual({
      known: true,
      level: 40,
      provenance: "observed",
    });

    const context = contextFor(under, original);

    expect(context.requirementStatus).toBe("unmet");
    expect(context.requirementLabel).toBe("Requisitos no cumplidos");
    expect(context.facts.join(" ")).toContain("nivel 40/70");
    expect(context.verdict).toBe("stop");
  });

  it("reconoce el nivel real suficiente y mantiene la confirmación existente", () => {
    const original = looseItem();
    const enough = profile(original, { level: 90, levelSource: "observed" });

    const context = contextFor(enough, original);

    expect(context.requirementStatus).toBe("met");
    expect(context.requirementLabel).toBe("Requisitos cumplidos");
    expect(context.facts).toContain(
      "El nivel y los atributos conocidos cumplen los requisitos mostrados.",
    );
  });

  it("carga perfiles legacy sin procedencia y no los convierte en dato observado", () => {
    const original = looseItem();

    // Legacy con nivel declarado: sigue siendo comparable, pero NUNCA se
    // etiqueta como observado.
    const legacyDeclared = profile(original);
    expect(legacyDeclared.levelSource).toBeUndefined();
    const declaredReading = readCharacterLevel(legacyDeclared);
    expect(declaredReading.provenance).toBe("legacy-declared");
    expect(declaredReading.provenance).not.toBe("observed");
    expect(declaredReading.known).toBe(true);
    expect(contextFor(legacyDeclared, original).requirementStatus).toBe("met");

    // Legacy con el mínimo técnico: indistinguible de un placeholder, así que
    // no se asciende a nivel real.
    const legacyPlaceholder = profile(original, { level: PLACEHOLDER_CHARACTER_LEVEL });
    expect(legacyPlaceholder.levelSource).toBeUndefined();
    const placeholderReading = readCharacterLevel(legacyPlaceholder);
    expect(placeholderReading.provenance).toBe("legacy-placeholder");
    expect(placeholderReading.provenance).not.toBe("observed");
    expect(placeholderReading.known).toBe(false);

    const context = contextFor(legacyPlaceholder, original);
    expect(context.requirementStatus).toBe("unknown");
    expect(allText(context)).not.toMatch(/nivel 1\b/i);
    expect(context.limitations).toContain(
      "No se puede comprobar el requisito de nivel porque no conocemos el nivel de tu personaje.",
    );
  });

  it("conserva la procedencia al serializar y restaurar el expediente", () => {
    const original = looseItem();
    const minimal = profile(original, {
      level: PLACEHOLDER_CHARACTER_LEVEL,
      levelSource: "placeholder",
    });

    const restored = CharacterProfileSchema.parse(JSON.parse(JSON.stringify(minimal)));

    expect(restored.levelSource).toBe("placeholder");
    expect(readCharacterLevel(restored).known).toBe(false);
    expect(contextFor(restored, original).requirementStatus).toBe("unknown");

    const observed = CharacterProfileSchema.parse(
      JSON.parse(JSON.stringify(profile(original, { level: 90, levelSource: "observed" }))),
    );
    expect(observed.levelSource).toBe("observed");
    expect(readCharacterLevel(observed)).toEqual({
      known: true,
      level: 90,
      provenance: "observed",
    });
  });
});

function pobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("procedencia del nivel en la importación PoB", () => {
  const defaults = { league: "Liga", patch: "0.5.4f" };

  it("marca como observado el nivel que trae el código", () => {
    const result = importBuild(
      pobCode('<PathOfBuilding><Build level="70" className="Mercenary"/></PathOfBuilding>'),
      defaults,
    );
    expect(result.profile?.level).toBe(70);
    expect(result.profile?.levelSource).toBe("observed");
    expect(readCharacterLevel(result.profile!).known).toBe(true);
  });

  it("no inventa un nivel observado cuando el código no lo declara", () => {
    const result = importBuild(
      pobCode('<PathOfBuilding><Build className="Mercenary"/></PathOfBuilding>'),
      defaults,
    );
    expect(result.profile?.level).toBe(PLACEHOLDER_CHARACTER_LEVEL);
    expect(result.profile?.levelSource).toBe("placeholder");
    expect(readCharacterLevel(result.profile!).known).toBe(false);
  });
});
