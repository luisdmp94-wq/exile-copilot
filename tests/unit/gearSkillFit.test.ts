import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, ItemSchema, type Item } from "../../shared/domain.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { gearReading, gearRulesAnswer } from "../../server/mentor/gearQuestion.js";
import { lineNeeds, skillFitLines } from "../../server/mentor/gearSkillFit.js";

/**
 * «¿Le sirve a mi habilidad?» (Mentor de equipo, tarea 18): a qué habilidad le
 * llega cada línea de daño de una pieza, con las etiquetas de la gema.
 */

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };

function piece(id: string, name: string, slot: Item["slot"], lines: string[]): Item {
  return ItemSchema.parse({
    id,
    name,
    baseType: name,
    slot,
    rarity: "rare",
    itemLevel: 30,
    modifiers: lines.map((text, index) => ({ id: `${id}-m${index}`, text, kind: "explicit", values: [], verified: true })),
    sources: [],
  });
}

describe("lineNeeds: lo que una línea le pide a la habilidad", () => {
  it("lo de ataques pide un ataque; lo de hechizos, un hechizo", () => {
    expect(lineNeeds("Añade de 3 a 7 de daño de fuego a los ataques")).toEqual(["Ataque"]);
    expect(lineNeeds("14% increased Attack Speed")).toEqual(["Ataque"]);
    expect(lineNeeds("+12 a la precisión")).toEqual(["Ataque"]);
    expect(lineNeeds("Daño de hechizos aumentado un 25%")).toEqual(["Hechizo"]);
    expect(lineNeeds("12% increased Cast Speed")).toEqual(["Hechizo"]);
  });

  it("un aumento de un elemento solo sube ese elemento", () => {
    expect(lineNeeds("Daño de hielo aumentado un 20(18-22)%")).toEqual(["Hielo"]);
    expect(lineNeeds("30% increased Lightning Damage")).toEqual(["Rayo"]);
    expect(lineNeeds("+2 al nivel de todas las habilidades de hechizos de fuego")).toEqual(["Hechizo", "Fuego"]);
  });

  it("lo de esbirros es para ellos, hable de lo que hable", () => {
    expect(lineNeeds("Los esbirros infligen un 20% más de daño de fuego")).toEqual(["Esbirro"]);
  });

  it("no juzga lo que no es de pegar ni lo que no dice a qué se aplica", () => {
    expect(lineNeeds("+90 a la vida máxima")).toEqual([]);
    expect(lineNeeds("+25% a la resistencia al hielo")).toEqual([]);
    expect(lineNeeds("Daño físico aumentado un 40%")).toEqual([]);
    expect(lineNeeds("Los aliados en tu presencia infligen un 10% más de daño de ataques")).toEqual([]);
    expect(lineNeeds("Daño recibido de fuego reducido un 5%")).toEqual([]);
  });
});

describe("skillFitLines: a qué habilidad le llega", () => {
  const tagsOf = (name: string) => gems.data.skills.find((skill) => skill.name === name)!.tags;

  it("a un hechizo de caos no le llega lo de ataques ni lo de fuego", () => {
    const found = piece("f", "Guantes", "gloves", ["Añade de 3 a 7 de daño físico a los ataques", "Daño de fuego aumentado un 20%", "Daño de hechizos aumentado un 15%"]);
    const lines = skillFitLines("Descarga de caos", tagsOf("Descarga de caos"), found, null);
    expect(lines.map((line) => line.reaches)).toEqual([false, false, true]);
    expect(lines[0]?.texto).toBe(
      "A Descarga de caos no le llega «Añade de 3 a 7 de daño físico a los ataques», de la encontrada: es para ataques y Descarga de caos no es un ataque.",
    );
    expect(lines[1]?.texto).toContain("sube solo lo de fuego y Descarga de caos no es de fuego");
    expect(lines[2]?.texto).toBe("A Descarga de caos sí le llega «Daño de hechizos aumentado un 15%», de la encontrada.");
  });

  it("a un ataque de rayo con arco le llega lo de ataques, proyectiles y rayo", () => {
    const found = piece("f", "Carcaj", "offhand", ["Daño de proyectiles aumentado un 18%", "30% increased Lightning Damage", "Daño cuerpo a cuerpo aumentado un 12%"]);
    const lines = skillFitLines("Flecha de rayo", tagsOf("Flecha de rayo"), found, null);
    expect(lines.map((line) => line.reaches)).toEqual([true, true, false]);
    expect(lines[2]?.texto).toContain("es para golpes cuerpo a cuerpo y Flecha de rayo no pega cuerpo a cuerpo");
  });

  it("sin elemento en la gema no se juzga el elemento (Terremoto)", () => {
    const found = piece("f", "Maza", "weapon", ["Daño de fuego aumentado un 20%", "Velocidad de ataque aumentada un 8%"]);
    const lines = skillFitLines("Terremoto", tagsOf("Terremoto"), found, null);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.texto).toBe("A Terremoto sí le llega «Velocidad de ataque aumentada un 8%», de la encontrada.");
  });

  it("también mira lo que se va con la pieza que llevas, y lo dice en inglés", () => {
    const found = piece("f", "New gloves", "gloves", ["+40 to maximum Life"]);
    const worn = piece("w", "Old gloves", "gloves", ["14% increased Attack Speed"]);
    const lines = skillFitLines("Lightning Arrow", tagsOf("Flecha de rayo"), found, worn, "en");
    expect(lines).toEqual([
      { side: "worn", reaches: true, texto: "With the swap you lose “14% increased Attack Speed”, from the one you wear, which Lightning Arrow did get." },
    ]);
  });
});

describe("Mentor de equipo: «¿le sirve a mi habilidad?»", () => {
  const worn = piece("puestos", "Guantes viejos", "gloves", ["+30 a la vida máxima"]);
  const witch = CharacterProfileSchema.parse({
    id: "prueba-bruja",
    name: "Mi bruja",
    characterClass: "Bruja",
    ascendancy: null,
    ascendancyId: null,
    level: 30,
    levelSource: "observed",
    archetype: "hechizos de caos",
    league: "Runes of Aldur",
    patch: "0.5.5",
    items: [worn],
    skills: [{ id: "s1", label: "", mainSkill: "Chaos Bolt", mainSkillGemId: null, supports: [] }],
    passives: { allocated: [] },
    attributes: { str: 10, dex: 20, int: 80 },
    resistances: { fire: 10, cold: 10, lightning: 10, chaos: 0 },
    sources: [],
    importedAt: "2026-11-28T12:00:00.000Z",
  });
  const found = piece("nuevos", "Guantes de duelista", "gloves", ["+60 a la vida máxima", "Añade de 3 a 7 de daño físico a los ataques", "+25 a la precisión"]);
  const ask = { found, wornId: worn.id, style: "caster" as const, minions: false };

  it("nombra la habilidad en el idioma de la web aunque el personaje la traiga en inglés", () => {
    const reading = gearReading(witch, ask, "es", gems);
    expect(reading.skillName).toBe("Descarga de caos");
    const fit = reading.lines.filter((line) => line.tema.includes("su habilidad principal, Descarga de caos"));
    expect(fit.map((line) => line.texto)).toEqual([
      "A Descarga de caos no le llega «Añade de 3 a 7 de daño físico a los ataques», de la encontrada: es para ataques y Descarga de caos no es un ataque.",
      "A Descarga de caos no le llega «+25 a la precisión», de la encontrada: es para ataques y Descarga de caos no es un ataque.",
    ]);
  });

  it("la respuesta sin IA va a la habilidad", () => {
    const answer = gearRulesAnswer(gearReading(witch, ask, "es", gems), "le sirve a mi habilidad?");
    expect(answer.split("\n")[0]).toBe("Para Descarga de caos, esto es lo que cuenta de las dos piezas:");
    expect(answer).toContain("• A Descarga de caos no le llega «+25 a la precisión»");
  });

  it("si ninguna línea depende de la habilidad, lo dice", () => {
    const plain = piece("plano", "Guantes lisos", "gloves", ["+80 a la vida máxima"]);
    const answer = gearRulesAnswer(gearReading(witch, { ...ask, found: plain }, "es", gems), "y para mi build?");
    expect(answer).toBe(
      "Ninguna línea de estas dos piezas depende de Descarga de caos: lo que dan (vida, resistencias, defensa) te sirve juegues con lo que juegues.",
    );
  });

  it("sin datos de gemas no se inventa la habilidad", () => {
    const reading = gearReading(witch, ask, "es", null);
    expect(reading.skillName).toBeNull();
    expect(gearRulesAnswer(reading, "le sirve a mi habilidad?")).toBe(
      "No sé cuál es tu habilidad principal: apúntala en tu personaje y te digo qué líneas le llegan.",
    );
  });
});
