import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import { ACT_ONE_GUIDE } from "../../src/guides/actOne.js";
import { ACT_TWO_GUIDE } from "../../src/guides/actTwo.js";
import { ACT_THREE_GUIDE } from "../../src/guides/actThree.js";
import { ACT_FOUR_GUIDE } from "../../src/guides/actFour.js";
import { checkRewards, rewardInputsNeeded, type RewardCheckInput } from "../../src/lib/rewardCheck.js";

const piece = (itemClass: string, name: string, lines: string[] = [], properties: string[] = []) =>
  parseItemText(
    [`Clase de objeto: ${itemClass}`, "Rareza: Raro", name, "Base de prueba", "--------", ...properties, "--------", "Nivel de objeto: 12", "--------", ...lines].join(
      "\n",
    ),
  ).item;

// El equipo de Luis del 11-11-2026: 17 % de hielo, 6 % de rayo y un cetro con 100 de espíritu.
const GEAR = [
  piece("Cetros", "Cetro traqueteante", [], ["Espíritu: 100"]),
  piece("Cascos", "Gran yelmo oxidado"),
  piece("Armaduras corporales", "Piel de apocalipsis", ["+8% a la resistencia al fuego", "+7% a la resistencia al hielo", "+6% a la resistencia al rayo"]),
  piece("Guantes", "Manoplas gruesas", ["+10% a la resistencia al hielo"]),
  piece("Botas", "Sandalias de paja"),
  piece("Cinturones", "Cinturón de lino", ["+7% a la resistencia al fuego"]),
  piece("Amuletos", "Amuleto azur"),
  piece("Anillos", "Anillo de lapislázuli"),
  { ...piece("Anillos", "Anillo de lapislázuli vibrante"), slot: "ring2" as const },
];

const base: RewardCheckInput = {
  items: GEAR,
  expectedPieces: 9,
  currentAct: 1,
  sheetResistance: {},
  sheetSpirit: null,
  weaponSetPoints: null,
  answers: {},
};

const line = (lines: ReturnType<typeof checkRewards>, zone: string) => {
  const found = lines.find((item) => item.zone === zone);
  if (!found) throw new Error(`No hay línea para ${zone}`);
  return found;
};

describe("checkRewards — acto 1", () => {
  it("pide los números que hacen falta y nada más", () => {
    expect(rewardInputsNeeded(ACT_ONE_GUIDE)).toEqual({ resistances: ["cold"], spirit: true, weaponSetPoints: true });
    expect(rewardInputsNeeded(ACT_TWO_GUIDE)).toEqual({ resistances: ["lightning"], spirit: false, weaponSetPoints: true });
  });

  it("Beira: si la hoja dice 10 más de hielo que el equipo, está hecha", () => {
    const done = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetResistance: { cold: 27 } }), "Sierraclara");
    expect(done.status).toBe("ok");
    expect(done.text).toContain("17 %");
    expect(done.text).toContain("27 %");
    const missing = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetResistance: { cold: 17 } }), "Sierraclara");
    expect(missing.status).toBe("missing");
    expect(missing.text).toContain("Sierraclara");
  });

  it("ya en el acto 2 descuenta los 10 puntos que quita el acto", () => {
    const done = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, currentAct: 2, sheetResistance: { cold: 17 } }), "Sierraclara");
    expect(done.status).toBe("ok");
    expect(done.text).toContain("el acto 2 te quita 10");
    const missing = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, currentAct: 2, sheetResistance: { cold: 7 } }), "Sierraclara");
    expect(missing.status).toBe("missing");
  });

  it("sin saber en qué acto estás no hace la resta de resistencias, y lo pide (caso de Luis del 14-11-2026)", () => {
    const asked = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, currentAct: null, sheetResistance: { cold: 17 } }), "Sierraclara");
    expect(asked.status).toBe("unsure");
    expect(asked.text).toContain("si sigues en el acto 1 o ya has pasado al 2");
    expect(asked.text).toContain("te quita 10 puntos");
    // Lo demás no depende del acto y se sigue comprobando.
    expect(line(checkRewards(ACT_ONE_GUIDE, [], { ...base, currentAct: null, sheetSpirit: 130 }), "Villafrey").status).toBe("ok");
  });

  it("cuando dice «te falta» estando en el acto de la guía, avisa del descuento del acto siguiente", () => {
    const stillAct1 = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetResistance: { cold: 17 } }), "Sierraclara");
    expect(stillAct1.status).toBe("missing");
    expect(stillAct1.text).toContain("si ya has entrado en el acto 2, márcalo arriba");
    // Ya dicho que está en el acto 2, el aviso sobra.
    const act2 = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, currentAct: 2, sheetResistance: { cold: 7 } }), "Sierraclara");
    expect(act2.status).toBe("missing");
    expect(act2.text).not.toContain("márcalo arriba");
  });

  it("si la resta no cuadra o falta equipo, no afirma nada", () => {
    const odd = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetResistance: { cold: 22 } }), "Sierraclara");
    expect(odd.status).toBe("unsure");
    expect(odd.text).toContain("árbol de pasivas");
    const partial = line(
      checkRewards(ACT_ONE_GUIDE, [], { ...base, items: GEAR.slice(0, 5), sheetResistance: { cold: 27 } }),
      "Sierraclara",
    );
    expect(partial.status).toBe("unsure");
    const noGear = line(checkRewards(ACT_ONE_GUIDE, [], { ...base, items: [], sheetResistance: { cold: 27 } }), "Sierraclara");
    expect(noGear.status).toBe("unsure");
    expect(noGear.text).toContain("Pega primero tu equipo");
  });

  it("el rey de las nieblas: compara el espíritu de la hoja con el del cetro", () => {
    expect(line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetSpirit: 130 }), "Villafrey").status).toBe("ok");
    expect(line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetSpirit: 100 }), "Villafrey").status).toBe("missing");
    expect(line(checkRewards(ACT_ONE_GUIDE, [], { ...base, sheetSpirit: 115 }), "Villafrey").status).toBe("unsure");
  });

  it("libros: con 4 puntos están los dos, con 2 falta uno y no sabe cuál, con 0 faltan los dos", () => {
    const zones = ["Terrenos de caza", "Tierras de cultivo de Ogham"];
    const both = checkRewards(ACT_ONE_GUIDE, [], { ...base, weaponSetPoints: 4 });
    expect(zones.map((zone) => line(both, zone).status)).toEqual(["ok", "ok"]);
    const one = checkRewards(ACT_ONE_GUIDE, [], { ...base, weaponSetPoints: 2 });
    expect(zones.map((zone) => line(one, zone).status)).toEqual(["unsure", "unsure"]);
    expect(line(one, "Terrenos de caza").text).toContain("Terrenos de caza o Tierras de cultivo de Ogham");
    const none = checkRewards(ACT_ONE_GUIDE, [], { ...base, weaponSetPoints: 0 });
    expect(zones.map((zone) => line(none, zone).status)).toEqual(["missing", "missing"]);
    expect(line(none, "Terrenos de caza").text).toContain("úsalo");
  });

  it("lo que no deja huella en un número se pregunta", () => {
    const asked = line(checkRewards(ACT_ONE_GUIDE, [], base), "Mansión de Ogham");
    expect(asked.status).toBe("ask");
    expect(asked.question).toContain("Cirio");
    expect(line(checkRewards(ACT_ONE_GUIDE, [], { ...base, answers: { "Mansión de Ogham": true } }), "Mansión de Ogham").status).toBe("ok");
    expect(line(checkRewards(ACT_ONE_GUIDE, [], { ...base, answers: { "Mansión de Ogham": false } }), "Mansión de Ogham").status).toBe(
      "missing",
    );
  });
});

describe("checkRewards — acto 2", () => {
  const act2: RewardCheckInput = { ...base, currentAct: 2 };

  it("los libros se cuentan con los del acto 1: 8 puntos en total", () => {
    const zones = ["Keth", "Deshar"];
    const all = checkRewards(ACT_TWO_GUIDE, [ACT_ONE_GUIDE], { ...act2, weaponSetPoints: 8 });
    expect(zones.map((zone) => line(all, zone).status)).toEqual(["ok", "ok"]);
    const one = checkRewards(ACT_TWO_GUIDE, [ACT_ONE_GUIDE], { ...act2, weaponSetPoints: 6 });
    expect(zones.map((zone) => line(one, zone).status)).toEqual(["unsure", "unsure"]);
    expect(line(one, "Keth").text).toContain("Tienes 6 y con los libros hasta aquí serían 8");
    const none = checkRewards(ACT_TWO_GUIDE, [ACT_ONE_GUIDE], { ...act2, weaponSetPoints: 4 });
    expect(zones.map((zone) => line(none, zone).status)).toEqual(["missing", "missing"]);
  });

  it("Hermanas de Garukhan: rayo de la hoja frente al del equipo, con la penalización del acto", () => {
    // Equipo 6 % − 10 del acto 2 = −4; con las hermanas, +6.
    expect(line(checkRewards(ACT_TWO_GUIDE, [ACT_ONE_GUIDE], { ...act2, sheetResistance: { lightning: 6 } }), "Las torres de Deshar").status).toBe("ok");
    expect(line(checkRewards(ACT_TWO_GUIDE, [ACT_ONE_GUIDE], { ...act2, sheetResistance: { lightning: -4 } }), "Las torres de Deshar").status).toBe(
      "missing",
    );
  });

  it("ascendencia y viales se preguntan", () => {
    const lines = checkRewards(ACT_TWO_GUIDE, [ACT_ONE_GUIDE], act2);
    expect(line(lines, "Prueba de las sekhemas").status).toBe("ask");
    expect(line(lines, "Valle de los titanes").question).toContain("reliquias");
  });
});

describe("checkRewards — acto 4", () => {
  const earlier = [ACT_ONE_GUIDE, ACT_TWO_GUIDE, ACT_THREE_GUIDE];
  const act4: RewardCheckInput = { ...base, currentAct: null };
  const books = ["El final del viaje", "La prueba de los ancestros"];

  it("los tatuajes se eligen: no pide resistencias ni en qué acto estás", () => {
    // Sin resistencias que restar, la tarjeta no pregunta el acto (tras el
    // acto 4 vienen los interludios, no un «acto 5»).
    expect(rewardInputsNeeded(ACT_FOUR_GUIDE)).toEqual({ resistances: [], spirit: false, weaponSetPoints: true });
    const lines = checkRewards(ACT_FOUR_GUIDE, earlier, act4);
    expect(line(lines, "Salones de los muertos").status).toBe("ask");
    expect(line(lines, "Salones de los muertos").question).toContain("tatuajes de resistencia");
  });

  it("los libros se cuentan con los de los actos 1 a 3: 16 puntos en total", () => {
    const all = checkRewards(ACT_FOUR_GUIDE, earlier, { ...act4, weaponSetPoints: 16 });
    expect(books.map((zone) => line(all, zone).status)).toEqual(["ok", "ok"]);
    const one = checkRewards(ACT_FOUR_GUIDE, earlier, { ...act4, weaponSetPoints: 14 });
    expect(line(one, books[0]).text).toContain("Tienes 14 y con los libros hasta aquí serían 16");
    const none = checkRewards(ACT_FOUR_GUIDE, earlier, { ...act4, weaponSetPoints: 12 });
    expect(books.map((zone) => line(none, zone).status)).toEqual(["missing", "missing"]);
  });
});
