import { describe, expect, it } from "vitest";
import type { CharacterProfile, Item } from "../../shared/domain.js";
import { checkRequirements, foundVerdict, hasWornGear, isWearable, wornInSlot } from "../../src/lib/foundItem.js";

// Solo los campos que mira la tarjeta: el resto de la pieza no interviene.
const piece = (id: string, slot: Item["slot"], requirements?: Item["requirements"]): Item =>
  ({
    id,
    name: id,
    baseType: id,
    slot,
    rarity: "rare",
    modifiers: [],
    ...(requirements ? { requirements } : {}),
  }) as unknown as Item;

type TestCharacter = Pick<CharacterProfile, "items" | "level" | "levelSource" | "attributes">;

const character = (items: Item[], extra: Partial<TestCharacter> = {}): TestCharacter =>
  ({
    items,
    level: 22,
    levelSource: "observed",
    attributes: { str: 30, dex: null, int: 12 },
    ...extra,
  }) as unknown as TestCharacter;

describe("«¿Me sirve lo que he encontrado?»: con qué pieza se compara", () => {
  it("un casco se compara con el casco puesto, no con otra cosa", () => {
    const profile = character([piece("casco", "helmet"), piece("botas", "boots")]);
    expect(wornInSlot(profile, piece("nuevo", "helmet")).map((item) => item.id)).toEqual(["casco"]);
  });

  it("un anillo puede ir en cualquiera de los dos huecos: salen los dos", () => {
    const profile = character([piece("anillo-1", "ring1"), piece("anillo-2", "ring2"), piece("casco", "helmet")]);
    expect(wornInSlot(profile, piece("nuevo", "ring1")).map((item) => item.id)).toEqual(["anillo-1", "anillo-2"]);
  });

  it("con un solo anillo puesto queda un hueco libre: no sustituye a ninguno", () => {
    const profile = character([piece("anillo-1", "ring1"), piece("casco", "helmet")]);
    expect(wornInSlot(profile, piece("nuevo", "ring1"))).toEqual([]);
    expect(wornInSlot(profile, piece("nuevo", "ring2"))).toEqual([]);
  });

  it("sin nada en ese hueco no hay con qué comparar", () => {
    expect(wornInSlot(character([piece("casco", "helmet")]), piece("nuevo", "gloves"))).toEqual([]);
  });

  it("un frasco no es una pieza que se lleve puesta", () => {
    expect(isWearable(piece("frasco", "flask"))).toBe(false);
    expect(wornInSlot(character([piece("frasco-1", "flask")]), piece("frasco-2", "flask"))).toEqual([]);
    expect(hasWornGear(character([piece("frasco-1", "flask")]))).toBe(false);
    expect(hasWornGear(character([piece("casco", "helmet")]))).toBe(true);
    expect(hasWornGear(null)).toBe(false);
  });

  it("la misma pieza no se compara consigo misma", () => {
    const worn = piece("casco", "helmet");
    expect(wornInSlot(character([worn]), worn)).toEqual([]);
  });
});

describe("«¿Me sirve lo que he encontrado?»: requisitos", () => {
  it("pide más nivel del que tiene: no se la puede poner, con los dos números", () => {
    const check = checkRequirements(piece("nuevo", "helmet", { level: 30 }), character([]));
    expect(check.blocked).toEqual(["Pide nivel 30 y eres nivel 22."]);
  });

  it("pide más atributo del que tiene", () => {
    const check = checkRequirements(piece("nuevo", "helmet", { level: 10, str: 45 }), character([]));
    expect(check.blocked).toEqual(["Pide 45 de fuerza y tienes 30."]);
  });

  it("un atributo sin apuntar no bloquea: se avisa para que lo mire", () => {
    const check = checkRequirements(piece("nuevo", "helmet", { dex: 40 }), character([]));
    expect(check.blocked).toEqual([]);
    expect(check.unchecked).toEqual(["Pide 40 de destreza: mira en el juego si llegas."]);
  });

  it("sin nivel conocido no se inventa que no llega", () => {
    const profile = character([], { level: 1, levelSource: "placeholder" });
    expect(checkRequirements(piece("nuevo", "helmet", { level: 30 }), profile).blocked).toEqual([]);
  });

  it("sin requisitos en el texto pegado no dice nada", () => {
    expect(checkRequirements(piece("nuevo", "helmet"), character([]))).toEqual({ blocked: [], unchecked: [] });
  });

  it("en inglés", () => {
    const check = checkRequirements(piece("nuevo", "helmet", { level: 30, int: 20 }), character([]), "en");
    expect(check.blocked).toEqual(["It needs level 30 and you are level 22.", "It needs 20 intelligence and you have 12."]);
  });
});

describe("«¿Me sirve lo que he encontrado?»: la respuesta", () => {
  const fine = { blocked: [], unchecked: [] };

  it("si no puede ponérsela, eso manda aunque sea mejor", () => {
    expect(foundVerdict({ blocked: ["Pide nivel 30 y eres nivel 22."], unchecked: [] }, { winner: "b" })).toBe("blocked");
  });

  it("sin pieza puesta en ese hueco, suma", () => {
    expect(foundVerdict(fine, null)).toBe("empty");
  });

  it("la puesta es A y la encontrada es B", () => {
    expect(foundVerdict(fine, { winner: "b" })).toBe("better");
    expect(foundVerdict(fine, { winner: "a" })).toBe("worse");
    expect(foundVerdict(fine, { winner: "tie" })).toBe("tie");
  });
});
