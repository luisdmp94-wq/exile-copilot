import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import {
  checkForGuide,
  guideInputFromItems,
  placePastedItem,
  resistancesFromItems,
  looksLikeItemText,
  splitPastedItems,
  withArticle,
} from "../../src/lib/guideCheck.js";
import type { Item } from "../../shared/domain.js";

const TARGETS = { elemental: 30, nextAct: "acto 2" };

function parse(text: string): Item {
  const parsed = parseItemText(text);
  expect(parsed.recognized).toBe(true);
  return parsed.item;
}

// Copia normal (Ctrl+C) del cliente en español: sin cabeceras `{ Mod. ... }`.
const HELMET_ES = `Clase de objeto: Yelmos
Rareza: Mágico
Yelmo de hierro de la salamandra
--------
Armadura: 40
--------
Requiere: Nivel 8
--------
Nivel de objeto: 12
--------
+12% a la resistencia al fuego
+9% a la resistencia al hielo
`;

const BOOTS_EN = `Item Class: Boots
Rarity: Rare
Gale Stride
Leather Boots
--------
Evasion Rating: 30
--------
Item Level: 14
--------
10% increased Movement Speed
+8% to Lightning Resistance
+5% to all Elemental Resistances
+1% to Maximum Fire Resistance
`;

// Copia avanzada (Ctrl+Alt+C): la tirada lleva su rango entre paréntesis.
const RING_ES_ADVANCED = `Clase de objeto: Anillos
Rareza: Mágico
Anillo de hierro del caos
--------
Nivel de objeto: 10
--------
{ Mod. de sufijo "de la víbora" (Grado: 8) — Caos, Resistencias }
+7(6-10)% a la resistencia al caos
`;

describe("resistancesFromItems", () => {
  it("suma resistencias de piezas en español, inglés y copia avanzada", () => {
    const items = [parse(HELMET_ES), parse(BOOTS_EN), parse(RING_ES_ADVANCED)];
    expect(resistancesFromItems(items)).toEqual({ fire: 17, cold: 14, lightning: 13, chaos: 7 });
  });

  it("no suma la resistencia máxima ni líneas que no son resistencias", () => {
    const boots = parse(BOOTS_EN);
    expect(resistancesFromItems([boots]).fire).toBe(5);
  });
});

describe("looksLikeItemText", () => {
  it("reconoce un objeto copiado del juego, en español o en inglés", () => {
    expect(looksLikeItemText(HELMET_ES)).toBe(true);
    expect(looksLikeItemText(BOOTS_EN)).toBe(true);
    expect(looksLikeItemText("Clase de objeto: Varitas\r\nRareza: Normal\r\nVarita marchita")).toBe(true);
  });

  it("no confunde un texto cualquiera con un objeto", () => {
    expect(looksLikeItemText("hola")).toBe(false);
    expect(looksLikeItemText("")).toBe(false);
    expect(looksLikeItemText("Rareza: Normal\nVarita marchita")).toBe(false);
  });
});

describe("splitPastedItems", () => {
  it("separa varias piezas pegadas seguidas, en español e inglés", () => {
    const chunks = splitPastedItems(`${HELMET_ES}\n${BOOTS_EN}\r\n${RING_ES_ADVANCED}`);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => parse(chunk).slot)).toEqual(["helmet", "boots", "ring1"]);
  });

  it("una sola pieza o un texto sin cabecera se devuelven enteros", () => {
    expect(splitPastedItems(HELMET_ES)).toEqual([HELMET_ES.trim()]);
    expect(splitPastedItems("hola")).toEqual(["hola"]);
    expect(splitPastedItems("   ")).toEqual([]);
  });
});

describe("placePastedItem", () => {
  it("el segundo anillo ocupa el segundo hueco y un casco nuevo sustituye al viejo", () => {
    let items: Item[] = [];
    items = placePastedItem(items, parse(RING_ES_ADVANCED)).items;
    items = placePastedItem(items, parse(RING_ES_ADVANCED)).items;
    expect(items.map((item) => item.slot)).toEqual(["ring1", "ring2"]);

    items = placePastedItem(items, parse(HELMET_ES)).items;
    const second = placePastedItem(items, parse(HELMET_ES));
    expect(second.replaced?.slot).toBe("helmet");
    expect(second.items.filter((item) => item.slot === "helmet")).toHaveLength(1);
  });
});

describe("checkForGuide", () => {
  it("la resistencia que castiga el jefe va primero aunque no sea la más baja", () => {
    const lines = checkForGuide(
      {
        source: "profile",
        resistances: { fire: 5, cold: 20, lightning: 40, chaos: 0 },
        filledSlots: ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"],
      },
      { ...TARGETS, focus: { element: "cold", minimum: 30, note: "Geonor pega con frío." } },
    );
    expect(lines.map((line) => line.id).slice(0, 2)).toEqual(["res-cold", "res-fire"]);
    expect(lines[0]).toMatchObject({ tone: "danger", text: expect.stringContaining("Geonor") });
  });

  it("avisa de la resistencia más baja primero y de los huecos sin pegar", () => {
    const lines = checkForGuide(guideInputFromItems([parse(HELMET_ES)]), TARGETS);
    expect(lines[0].id).toBe("res-lightning");
    expect(lines[0].tone).toBe("danger");
    expect(lines[0].text).toContain("te faltan 30 puntos");
    expect(lines.find((line) => line.id === "slots")?.text).toContain("arma");
  });

  it("da el visto bueno cuando las tres llegan al objetivo", () => {
    const lines = checkForGuide(
      {
        source: "profile",
        resistances: { fire: 40, cold: 35, lightning: 30, chaos: 0 },
        filledSlots: ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"],
      },
      TARGETS,
    );
    expect(lines).toEqual([expect.objectContaining({ id: "res-ok", tone: "ok" })]);
  });

  it("sin dato de una resistencia lo dice en vez de suponer 0", () => {
    const lines = checkForGuide(
      {
        source: "profile",
        resistances: { fire: null, cold: 40, lightning: 40, chaos: null },
        filledSlots: [],
      },
      TARGETS,
    );
    expect(lines.some((line) => line.id === "res-fire")).toBe(false);
    expect(lines.find((line) => line.id === "res-unknown")?.text).toContain("fuego");
  });
});

describe("la frase del acto siguiente", () => {
  const ready = {
    source: "profile" as const,
    resistances: { fire: 40, cold: 35, lightning: 30, chaos: 0 },
    filledSlots: ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"] as const,
  };

  it("pone el artículo a «acto 2» y respeta el que ya trae «los interludios»", () => {
    expect(withArticle("acto 2")).toBe("el acto 2");
    expect(withArticle("los interludios")).toBe("los interludios");
  });

  it("tras el acto 4 dice «para los interludios», no «para el los interludios»", () => {
    const interludes = { elemental: 30, nextAct: "los interludios" };
    const [line] = checkForGuide({ ...ready, filledSlots: [...ready.filledSlots] }, interludes);
    expect(line?.text).toContain("vas bien para los interludios.");
    const low = checkForGuide(
      { ...ready, resistances: { ...ready.resistances, fire: 10 }, filledSlots: [...ready.filledSlots] },
      interludes,
    );
    expect(low.map((item) => item.text).join(" ")).toContain("Para los interludios conviene");
    expect(low.map((item) => item.text).join(" ")).not.toContain("el los");
  });

  it("las guías de los actos 1 a 3 siguen diciendo «para el acto N»", () => {
    const [line] = checkForGuide({ ...ready, filledSlots: [...ready.filledSlots] }, TARGETS);
    expect(line?.text).toContain("vas bien para el acto 2.");
  });
});
