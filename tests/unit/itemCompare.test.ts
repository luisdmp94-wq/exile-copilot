import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import { compareItems } from "../../src/lib/itemCompare.js";

const parse = (text: string) => parseItemText(text).item;

// Los dos cascos que Luis comparó jugando el 11-11-2026 (texto reconstruido del tooltip).
const DOOM_CREST = parse(
  [
    "Clase de objeto: Cascos",
    "Rareza: Raro",
    "Punta de condenación",
    "Corona de hierro",
    "--------",
    "Armadura: 28 (augmented)",
    "Escudo de energía: 14 (augmented)",
    "--------",
    "Nivel de objeto: 9",
    "--------",
    "Armadura y escudo de energía aumentados un 7(6-13)%",
    "+10(7-10) a la vida máxima",
    "+18(15-24) al maná máximo",
    "Probabilidad de impacto crítico aumentada un 14(10-14)%",
    "Regeneras 2.6(2.1-3) de vida por segundo",
    "+6(6-10)% a la resistencia al rayo",
  ].join("\n"),
);

const RAGE_HALO = parse(
  [
    "Clase de objeto: Cascos",
    "Rareza: Raro",
    "Halo de furia",
    "Capucha gastada",
    "--------",
    "Evasión: 39 (augmented)",
    "--------",
    "Nivel de objeto: 8",
    "--------",
    "Evasión aumentada un 8(6-13)%",
    "+7(6-8) al maná máximo",
    "+17(11-18) a la evasión",
    "+30(11-32) a la precisión",
    "+8(5-8) a la inteligencia",
    "+9(6-10)% a la resistencia al fuego",
    "+8(6-10)% a la resistencia al rayo",
  ].join("\n"),
);

describe("compareItems", () => {
  it("para hechizos y esbirros gana el casco con vida, maná y escudo de energía", () => {
    const result = compareItems(DOOM_CREST, RAGE_HALO, "caster");
    expect(result.winner).toBe("a");
    const row = (id: string) => result.rows.find((item) => item.id === id);
    expect(row("life")).toMatchObject({ a: "+10", b: "nada", winner: "a" });
    expect(row("mana")).toMatchObject({ a: "+18", b: "+7", winner: "a" });
    expect(row("es")).toMatchObject({ a: "14", b: "nada", winner: "a" });
    expect(row("evasion")).toMatchObject({ a: "nada", b: "39", winner: "b" });
    expect(row("regen")).toMatchObject({ a: "+2,6", winner: "a" });
    expect(row("res")).toMatchObject({ a: "+6 % rayo", b: "+9 % fuego, +8 % rayo", winner: "b" });
    // La precisión no sirve para hechizos.
    expect(result.wasted.b).toEqual(["+30(11-32) a la precisión"]);
    expect(result.reasons[0]).toContain("Punta de condenación");
    expect(result.reasons[1]).toContain("resistencias");
  });

  it("solo enseña las filas en las que alguna pieza da algo", () => {
    const ids = compareItems(DOOM_CREST, RAGE_HALO, "caster").rows.map((row) => row.id);
    expect(ids).not.toContain("move");
    expect(ids).not.toContain("spirit");
  });

  it("el orden de pegado no cambia el veredicto", () => {
    expect(compareItems(RAGE_HALO, DOOM_CREST, "caster").winner).toBe("b");
  });

  it("para arco pesa más la evasión y deja de ganar con claridad", () => {
    const result = compareItems(DOOM_CREST, RAGE_HALO, "ranged");
    expect(result.scoreB).toBeGreaterThan(compareItems(DOOM_CREST, RAGE_HALO, "caster").scoreB);
  });

  it("dos piezas iguales empatan", () => {
    const result = compareItems(DOOM_CREST, DOOM_CREST, "caster");
    expect(result.winner).toBe("tie");
    expect(result.reasons[0]).toContain("parejas");
  });

  it("separa el daño de ataques del de hechizos según el estilo", () => {
    const wand = parse(
      ["Item Class: Wands", "Rarity: Rare", "Doom Song", "Withered Wand", "--------", "Item Level: 10", "--------", "42% increased Spell Damage", "+12 to maximum Mana"].join("\n"),
    );
    const mace = parse(
      ["Item Class: One Hand Maces", "Rarity: Rare", "Grim Bane", "Wooden Club", "--------", "Item Level: 10", "--------", "Adds 3 to 7 Fire Damage to Attacks", "12% increased Attack Speed"].join("\n"),
    );
    const caster = compareItems(wand, mace, "caster");
    expect(caster.rows.find((row) => row.id === "damage")).toMatchObject({ a: "1 línea", b: "nada", winner: "a" });
    expect(caster.wasted.b).toHaveLength(2);
    const melee = compareItems(wand, mace, "melee");
    expect(melee.rows.find((row) => row.id === "damage")).toMatchObject({ a: "nada", b: "2 líneas", winner: "b" });
    expect(melee.wasted.a).toEqual(["42% increased Spell Damage"]);
  });

  describe("cetros (caso de Luis del 13-11-2026)", () => {
    const sceptre = (name: string, spirit: number, lines: string[]) =>
      parse(
        ["Clase de objeto: Cetros", "Rareza: Raro", name, "Cetro traqueteante", "--------", `Espíritu: ${spirit}`, "--------", "Nivel de objeto: 14", "--------", ...lines].join(
          "\n",
        ),
      );
    const A = sceptre("Canción de apocalipsis", 100, [
      "Los aliados que están en tu presencia infligen de 2(2-3) a 4(4-6) de daño físico agregado con los ataques",
      "Los esbirros infligen daño aumentado un 24(20-30)%",
      "+24(20-25) al maná máximo",
    ]);
    const B = sceptre("Tejedora de penumbra", 118, ["Los esbirros tienen un 15(12-18)% más de vida máxima", "+16(15-19) al maná máximo"]);

    it("lee el espíritu de la base, que es lo principal de un cetro", () => {
      const row = compareItems(A, B, "caster").rows.find((item) => item.id === "spirit");
      expect(row).toMatchObject({ a: "+100", b: "+118", winner: "b" });
    });

    it("con esbirros, el daño que ganan los aliados cuenta y no aparece como desaprovechado", () => {
      const result = compareItems(A, B, "caster");
      expect(result.wasted.a).toEqual([]);
      expect(result.rows.find((item) => item.id === "damage")).toMatchObject({ a: "2 líneas", winner: "a" });
    });

    it("para un personaje sin esbirros, esas mismas líneas sí se desaprovechan", () => {
      const result = compareItems(A, B, "melee");
      expect(result.wasted.a).toHaveLength(2);
      expect(result.rows.find((item) => item.id === "damage")?.a ?? "nada").toBe("nada");
    });
  });

  it("una diferencia mínima es empate: 22 de escudo frente a 20 no es perderlo (caso del 13-11-2026)", () => {
    const body = (name: string, lines: string[]) =>
      parse(["Clase de objeto: Armaduras corporales", "Rareza: Raro", name, "Túnica", "--------", ...lines].join("\n"));
    const fortress = body("Fortaleza de olvido", [
      "Armadura: 35 (augmented)",
      "Escudo de energía: 22 (augmented)",
      "--------",
      "Nivel de objeto: 12",
      "--------",
      "Regeneras 3.2(2.1-3.5) de vida por segundo",
      "+6(6-10)% a la resistencia al rayo",
    ]);
    const gambeson = body("Gambesón de víbora", [
      "Evasión: 20 (augmented)",
      "Escudo de energía: 20 (augmented)",
      "--------",
      "Nivel de objeto: 12",
      "--------",
      "+10(7-10) a la vida máxima",
      "+7(6-10)% a la resistencia al fuego",
      "+7(6-10)% a la resistencia al hielo",
    ]);
    const result = compareItems(fortress, gambeson, "caster");
    expect(result.winner).toBe("b");
    expect(result.rows.find((row) => row.id === "es")).toMatchObject({ a: "22", b: "20", winner: "tie" });
    expect(result.reasons.join(" ")).not.toContain("escudo de energía");
    expect(result.rows.find((row) => row.id === "res")).toMatchObject({ winner: "b" });
  });

  it("dos piezas con el mismo nombre se distinguen como A y B (caso del 14-11-2026)", () => {
    const gloves = (lines: string[]) =>
      parse(["Clase de objeto: Guantes", "Rareza: Raro", "Apretón de cadáver", "Guanteletes", "--------", ...lines].join("\n"));
    const first = gloves([
      "Armadura: 65 (augmented)",
      "--------",
      "Nivel de objeto: 20",
      "--------",
      "Agrega de 2(1-2) a 3 de daño físico a los ataques",
      "Velocidad de ataque aumentada un 7(5-7)%",
      "+6(5-8) a la fuerza",
      "+9(6-10)% a la resistencia al rayo",
    ]);
    const second = gloves([
      "Escudo de energía: 39 (augmented)",
      "--------",
      "Nivel de objeto: 20",
      "--------",
      "+27(20-29) a la vida máxima",
      "+8(6-10)% a la resistencia al fuego",
    ]);
    const result = compareItems(first, second, "caster");
    expect(result.labels).toEqual({ a: "la pieza A", b: "la pieza B" });
    // Un 9 % frente a un 8 % de resistencia no decide: empate en esa fila.
    expect(result.rows.find((row) => row.id === "res")).toMatchObject({ winner: "tie" });
    // Y entonces sí hay ganadora: vida y escudo de energía para una bruja.
    expect(result.winner).toBe("b");
    expect(result.reasons[0]).toBe("La pieza B te da más vida máxima y escudo de energía.");
    expect(result.reasons[1]).toBe("Pierdes armadura y atributos, que da la pieza A.");
    expect(result.reasons.join(" ")).not.toContain("Apretón de cadáver");
  });

  describe("cascos del 16-11-2026: «+1 a esbirros» frente a vida y escudo", () => {
    // Texto real del Visor de plaga; el Albergue mórbido, reconstruido de la captura.
    const PLAGUE_VISOR = parse(
      [
        "Clase de objeto: Cascos",
        "Rareza: Raro",
        "Visor de plaga",
        "Máscara labrada",
        "--------",
        "Evasión: 20",
        "Escudo de energía: 13",
        "--------",
        "Requiere: Nivel 17",
        "--------",
        "Nivel de objeto: 22",
        "--------",
        '{ Mod. de prefijo "enfocado" (Grado: 7) — Ataque }',
        "+79(61-84) a la precisión",
        '{ Mod. de sufijo "del prodigio " (Grado: 7) — Atributo }',
        "+14(13-16) a la inteligencia",
        '{ Mod. de sufijo "de la foca" (Grado: 8) — Elemental, Hielo, Resistencia }',
        "+10(6-10)% a la resistencia al hielo",
        '{ Mod. de sufijo "del capataz" (Grado: 2) — Esbirro, Gema }',
        "+1 al nivel de todas las habilidades de esbirros",
      ].join("\n"),
    );
    const MORBID_SHELTER = parse(
      [
        "Clase de objeto: Cascos",
        "Rareza: Raro",
        "Albergue mórbido",
        "Diadema",
        "--------",
        "Escudo de energía: 61 (augmented)",
        "--------",
        "Nivel de objeto: 22",
        "--------",
        "+34(30-39) a la vida máxima",
        "Regeneras 1.2(1-2) de vida por segundo",
        "+6(6-10)% a la resistencia al fuego",
      ].join("\n"),
    );

    it("el +1 a esbirros tiene su fila y no cuenta como una línea de daño", () => {
      const result = compareItems(PLAGUE_VISOR, MORBID_SHELTER, "caster");
      expect(result.rows.find((row) => row.id === "skills")).toMatchObject({ a: "+1 esbirros", b: "nada", winner: "a" });
      expect(result.rows.find((row) => row.id === "damage")).toBeUndefined();
    });

    it("para una bruja de esbirros gana el casco con +1, aunque el otro dé más vida", () => {
      const result = compareItems(PLAGUE_VISOR, MORBID_SHELTER, "caster");
      expect(result.winner).toBe("a");
      expect(result.reasons[0]).toMatch(/^«Visor de plaga» te da más nivel de habilidades/);
      expect(result.reasons[1]).toContain("vida máxima");
    });

    it("ganar la resistencia por poco cuenta poco: 10 % frente a 6 % no vale lo que 34 de vida frente a nada", () => {
      const rows = compareItems(PLAGUE_VISOR, MORBID_SHELTER, "caster").rows;
      const res = rows.find((row) => row.id === "res")!;
      const life = rows.find((row) => row.id === "life")!;
      expect(res.margin * res.weight).toBeLessThan(life.margin * life.weight);
    });

    it("cuerpo a cuerpo no aprovecha el +1 a esbirros", () => {
      const result = compareItems(PLAGUE_VISOR, MORBID_SHELTER, "melee");
      expect(result.rows.find((row) => row.id === "skills")).toBeUndefined();
      expect(result.wasted.a).toContain("+1 al nivel de todas las habilidades de esbirros");
      expect(result.winner).toBe("b");
    });
  });

  it("avisa cuando las dos piezas no van en el mismo hueco", () => {
    const boots = parse(
      ["Clase de objeto: Botas", "Rareza: Mágico", "Botas de prueba", "--------", "Nivel de objeto: 5", "--------", "Velocidad de movimiento aumentada un 10%"].join("\n"),
    );
    const result = compareItems(DOOM_CREST, boots, "caster");
    expect(result.slotWarning).toContain("mismo hueco");
    expect(result.rows.find((row) => row.id === "move")).toMatchObject({ a: "nada", b: "+10 %", winner: "b" });
  });
});
