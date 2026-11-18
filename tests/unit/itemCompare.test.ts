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

  it("en inglés: lee piezas copiadas de un juego en inglés y lo explica en inglés", () => {
    const visor = parse(
      [
        "Item Class: Helmets",
        "Rarity: Rare",
        "Plague Visor",
        "Carved Mask",
        "--------",
        "Evasion Rating: 20",
        "Energy Shield: 13",
        "--------",
        "Item Level: 22",
        "--------",
        "+79 to Accuracy Rating",
        "+14 to Intelligence",
        "+10% to Cold Resistance",
        "+1 to Level of all Minion Skills",
      ].join("\n"),
    );
    const shelter = parse(
      [
        "Item Class: Helmets",
        "Rarity: Rare",
        "Morbid Shelter",
        "Tiara",
        "--------",
        "Energy Shield: 61 (augmented)",
        "--------",
        "Item Level: 22",
        "--------",
        "+34 to maximum Life",
        "Regenerate 1.2 Life per second",
        "+6% to Fire Resistance",
      ].join("\n"),
    );
    const result = compareItems(visor, shelter, "caster", "en");
    expect(result.winner).toBe("a");
    const row = (id: string) => result.rows.find((item) => item.id === id);
    expect(row("skills")).toMatchObject({ label: "Skill levels", a: "+1 minions", b: "none" });
    expect(row("res")).toMatchObject({ a: "+10% cold", b: "+6% fire" });
    expect(row("regen")).toMatchObject({ b: "+1.2" });
    expect(result.reasons[0]).toBe("“Plague Visor” gives you more skill levels, resistances, evasion and attributes.");
    expect(result.reasons[1]).toMatch(/^You lose maximum life/);
    expect(result.wasted.a).toEqual(["+79 to Accuracy Rating"]);
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

describe("con el personaje en cuenta: pecheras y cascos de Luis (17-11-2026)", () => {
  const RAPTURE = parse(
    [
      "Clase de objeto: Armaduras corporales",
      "Rareza: Raro",
      "Capa de arrebato",
      "Toga de seda",
      "--------",
      "Escudo de energía: 118 (augmented)",
      "--------",
      "Nivel de objeto: 25",
      "--------",
      "+13(8-13) al escudo de energía máximo",
      "Escudo de energía aumentado un 36(27-42)%",
      "+30(30-39) a la vida máxima",
      "+16(13-16) a la inteligencia",
      "+12(11-15)% a la resistencia al rayo",
    ].join("\n"),
  );
  const VICTORY = parse(
    [
      "Clase de objeto: Armaduras corporales",
      "Rareza: Raro",
      "Guardián de victoria",
      "Chaleco de seda",
      "--------",
      "Evasión: 253 (augmented)",
      "Escudo de energía: 83 (augmented)",
      "--------",
      "Nivel de objeto: 30",
      "--------",
      "+33 al espíritu",
      "+14(11-15)% a la resistencia al fuego",
    ].join("\n"),
  );
  const LICH = {
    name: "Likewow",
    archetype: null,
    resistances: { fire: 28, cold: 23, lightning: 44, chaos: 0 },
    items: [RAPTURE],
    skills: [{ id: "s1", label: "Guerrero esqueleto", mainSkill: "Guerrero esqueleto", mainSkillGemId: null, supports: [] }],
  };

  it("sin personaje, gana la de más vida y escudo (lo de siempre)", () => {
    expect(compareItems(RAPTURE, VICTORY, "caster").winner).toBe("a");
  });

  it("con esbirros, el Espíritu da la victoria a la pechera con +33", async () => {
    const { contextFromProfile, profileUsesMinions } = await import("../../src/lib/itemCompare.js");
    expect(profileUsesMinions(LICH)).toBe(true);
    const context = { ...contextFromProfile(LICH, "body"), minions: true };
    const result = compareItems(RAPTURE, VICTORY, "caster", "es", context);
    expect(result.winner).toBe("b");
  });

  it("descuenta la pieza que lleva puesta: su +12 % de rayo ya estaba en el 44 %", async () => {
    const { contextFromProfile } = await import("../../src/lib/itemCompare.js");
    const context = contextFromProfile(LICH, "body");
    expect(context.equipped?.name).toBe("Capa de arrebato");
  });

  it("no cuenta la resistencia que pasaría del 75 %", () => {
    const capped = { resistances: { fire: 75, cold: 23, lightning: 44, chaos: 0 } };
    const res = compareItems(RAPTURE, VICTORY, "caster", "es", capped).rows.find((row) => row.id === "res");
    // El +14 % de fuego no cabe: gana el +12 % de rayo.
    expect(res?.winner).toBe("a");
  });
});

// Revisión del 18-11-2026: dos casos que el comparador daba por buenos.
describe("compareItems — niveles de habilidad de un tipo que no conoce, y resistencias que restan", () => {
  const ring = (name: string, lines: string[]) =>
    parse(["Clase de objeto: Anillos", "Rareza: Raro", name, "Anillo de hierro", "--------", "Nivel de objeto: 40", "--------", ...lines].join("\n"));

  const CURSE_RING = ring("Aro maldito", ["+2 al nivel de todas las habilidades de maldición"]);
  const ATTACK_RING = ring("Aro de guerra", ["+1 al nivel de todas las habilidades de ataque"]);
  const ALL_RING = ring("Aro pleno", ["+1 al nivel de todas las habilidades"]);
  const LIFE_RING = ring("Aro vital", ["+12 a la vida máxima"]);

  it("un +nivel a maldiciones no cuenta para un personaje cuerpo a cuerpo", () => {
    const result = compareItems(CURSE_RING, LIFE_RING, "melee");
    expect(result.rows.find((row) => row.id === "skills")).toBeUndefined();
    expect(result.wasted.a).toContain("+2 al nivel de todas las habilidades de maldición");
    expect(result.winner).toBe("b");
  });

  it("tampoco se le regala a hechizos ni a arco", () => {
    for (const style of ["caster", "ranged"] as const) {
      expect(compareItems(CURSE_RING, LIFE_RING, style).rows.find((row) => row.id === "skills")).toBeUndefined();
    }
  });

  it("«todas las habilidades», a secas, vale para cualquier estilo", () => {
    for (const style of ["caster", "melee", "ranged"] as const) {
      expect(compareItems(ALL_RING, LIFE_RING, style).rows.find((row) => row.id === "skills")).toMatchObject({ a: "+1 todas", winner: "a" });
    }
    const english = ring("Full Band", ["+1 to Level of all Skills"]);
    expect(compareItems(english, LIFE_RING, "melee", "en").rows.find((row) => row.id === "skills")).toMatchObject({ a: "+1 all", winner: "a" });
  });

  it("un +nivel a ataques vale a cuerpo a cuerpo y a arco, no a hechizos", () => {
    for (const style of ["melee", "ranged"] as const) {
      expect(compareItems(ATTACK_RING, LIFE_RING, style).rows.find((row) => row.id === "skills")).toMatchObject({ a: "+1 ataques", winner: "a" });
    }
    const caster = compareItems(ATTACK_RING, LIFE_RING, "caster");
    expect(caster.rows.find((row) => row.id === "skills")).toBeUndefined();
    expect(caster.wasted.a).toContain("+1 al nivel de todas las habilidades de ataque");
  });

  const MIXED = ring("Aro de doble filo", ["+30% a la resistencia al fuego", "-20% a la resistencia al rayo"]);
  const PLAIN = ring("Aro templado", ["+25% a la resistencia al fuego"]);

  it("con personaje guardado, la resistencia que quita una pieza resta", () => {
    const context = { resistances: { fire: 10, cold: 30, lightning: 30, chaos: 0 } };
    const res = compareItems(MIXED, PLAIN, "melee", "es", context).rows.find((row) => row.id === "res");
    // +30 de fuego y -20 de rayo son 10 útiles; el otro da 25.
    expect(res?.winner).toBe("b");
  });

  it("sin personaje da el mismo ganador: ya no depende de si hay datos", () => {
    expect(compareItems(MIXED, PLAIN, "melee").rows.find((row) => row.id === "res")?.winner).toBe("b");
  });

  it("lo que pasa del 75 % sigue sin contar, y perder lo que sobraba tampoco resta", () => {
    // Rayo al 90 %: quitarle 10 lo deja en 80, que sigue por encima del tope.
    const context = { resistances: { fire: 70, cold: 30, lightning: 90, chaos: 0 } };
    const spare = ring("Aro de sobra", ["+30% a la resistencia al fuego", "-10% a la resistencia al rayo"]);
    const small = ring("Aro justo", ["+5% a la resistencia al fuego"]);
    // Los dos llenan el hueco de fuego (5 puntos) y ninguno pierde rayo útil: empate.
    expect(compareItems(spare, small, "melee", "es", context).rows.find((row) => row.id === "res")?.winner).toBe("tie");
  });
});
