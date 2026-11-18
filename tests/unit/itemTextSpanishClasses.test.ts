import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";

function header(itemClass: string, name: string): string {
  return [`Clase de objeto: ${itemClass}`, "Rareza: Normal", name, "--------", "Nivel de objeto: 1"].join("\n");
}

describe("clases de objeto del cliente en español", () => {
  it("reconoce la varita real copiada del juego (11-11-2026)", () => {
    const text = [
      "Clase de objeto: Varitas",
      "Rareza: Normal",
      "Varita marchita",
      "--------",
      "Nivel de objeto: 1",
      "--------",
      "Otorga la habilidad: Descarga de caos de nivel 1",
    ].join("\r\n");
    const { item, recognized } = parseItemText(text);
    expect(recognized).toBe(true);
    expect(item.name).toBe("Varita marchita");
    expect(item.slot).toBe("weapon");
  });

  it("la habilidad que otorga la varita no cuenta como afijo sin clasificar (17-11-2026)", () => {
    const text = [
      "Clase de objeto: Varitas",
      "Rareza: Raro",
      "Mordida de destino",
      "Varita marchita",
      "--------",
      "Requiere: Nivel 14",
      "--------",
      "Nivel de objeto: 18",
      "--------",
      "Daño de hechizos aumentado un 20% (rune)",
      "--------",
      "Otorga la habilidad: Descarga de caos de nivel 6 ",
      "--------",
      '{ Mod. de prefijo "" (Grado: 6) — Daño, Elemental, Fuego }',
      "Ganas el 14(13-15)% del daño como daño de fuego extra",
      '{ Mod. de prefijo "nublada" (Grado: 6) — Daño, Caos }',
      "Daño de caos aumentado un 47(45-54)%",
      '{ Mod. de sufijo "de ira" (Grado: 6) — Lanzador de hechizos, Crítico }',
      "Bonificación de daño crítico de los hechizos aumentada un 13(10-14)%",
    ].join("\r\n");
    const result = parseItemText(text);
    const granted = result.item.modifiers.find((mod) => mod.text.startsWith("Otorga la habilidad"));
    expect(granted?.kind).toBe("implicit");
    expect(result.item.modifiers.filter((mod) => mod.kind === "explicit")).toHaveLength(3);
    expect(result.item.modifiers.filter((mod) => mod.kind === "explicit").every((mod) => mod.affix)).toBe(true);
    // Con todos los explícitos clasificados, el estado de crafting queda afirmado.
    expect(result.item.craftingState).toBeDefined();
  });

  it.each([
    ["Garras", "weapon"],
    ["Dagas", "weapon"],
    ["Varitas", "weapon"],
    ["Espadas a una mano", "weapon"],
    ["Hachas a una mano", "weapon"],
    ["Mazas a una mano", "weapon"],
    ["Cetros", "weapon"],
    ["Lanzas", "weapon"],
    ["Manguales", "weapon"],
    ["Arcos", "weapon"],
    ["Báculos", "weapon"],
    ["Espadas a dos manos", "weapon"],
    ["Hachas a dos manos", "weapon"],
    ["Mazas a dos manos", "weapon"],
    ["Bastones", "weapon"],
    ["Ballestas", "weapon"],
    ["Trampas", "weapon"],
    ["Talismanes", "weapon"],
    ["Carcajes", "offhand"],
    ["Escudos", "offhand"],
    ["Broqueles", "offhand"],
    ["Focos", "offhand"],
    ["Guantes", "gloves"],
    ["Botas", "boots"],
    ["Armaduras corporales", "body"],
    ["Cascos", "helmet"],
    ["Amuletos", "amulet"],
    ["Anillos", "ring1"],
    ["Cinturones", "belt"],
    ["Frascos de vida", "flask"],
    ["Frascos de maná", "flask"],
  ] as const)("«%s» va al hueco %s", (itemClass, slot) => {
    expect(parseItemText(header(itemClass, "Objeto de prueba")).item.slot).toBe(slot);
  });

  it.each([
    ["Staves", "weapon"],
    ["Quarterstaves", "weapon"],
    ["Flails", "weapon"],
    ["Bucklers", "offhand"],
    ["Foci", "offhand"],
  ] as const)("clase en inglés «%s» va al hueco %s", (itemClass, slot) => {
    const text = [`Item Class: ${itemClass}`, "Rarity: Normal", "Test Item", "--------", "Item Level: 1"].join("\n");
    expect(parseItemText(text).item.slot).toBe(slot);
  });

  it("la clase manda sobre una palabra suelta del nombre", () => {
    expect(parseItemText(header("Botas", "Botas de lanza")).item.slot).toBe("boots");
    expect(parseItemText(header("Anillos", "Anillo del arco")).item.slot).toBe("ring1");
  });
});

describe("viales / charms (comentario de un jugador en Steam, 18-11-2026)", () => {
  it.each([
    ["Item Class: Charms\nRarity: Magic\nThawing Ruby Charm\n--------\nItem Level: 30", "en"],
    ["Clase de objeto: Viales\nRareza: Mágico\nVial de rubí descongelante\n--------\nNivel de objeto: 30", "es"],
  ])("un vial se reconoce como vial, sin aviso de hueco desconocido (%#)", (text) => {
    const result = parseItemText(text);
    expect(result.item.slot).toBe("charm");
    expect(result.warnings.join(" ")).not.toContain("no se pudo inferir el slot");
  });

  it("en el panel de equipo van con los frascos", async () => {
    const { buildEquipmentLayout } = await import("../../src/lib/equipment.js");
    const charm = parseItemText("Item Class: Charms\nRarity: Magic\nThawing Ruby Charm\n--------\nItem Level: 30").item;
    const layout = buildEquipmentLayout([charm]);
    expect(layout.flaskItems).toHaveLength(1);
    expect(layout.extraItems).toHaveLength(0);
  });
});
