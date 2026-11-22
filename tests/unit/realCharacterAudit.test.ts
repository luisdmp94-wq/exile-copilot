import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile, type Item } from "../../shared/domain.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import { repairStoredItemImport } from "../../server/importers/storedItemMigration.js";
import { elementalResistancesRule, skillLinksRule } from "../../server/engine/rules.js";
import { resistancesFromItems } from "../../shared/itemResistances.js";
import { QUICK_REVIEW_SKILL_ID } from "../../shared/quickReview.js";
import { EMPTY, profileWithQuickReview } from "../../src/lib/quickReviewForm.js";

/**
 * Lo que salió al revisar un personaje real (una bruja de caos en el acto 4):
 * piezas pegadas juntas, un único con su texto decorativo como mods, la
 * revisión rápida que el Mentor no veía y resistencias «desconocidas».
 */

const GLOVES = `Clase de objeto: Guantes
Rareza: Raro
Contacto del vórtice
Guantes de escamas de paua
--------
Escudo de energía: 44 (augmented)
--------
Requiere: Nivel 45, 56 Int
--------
Nivel de objeto: 47
--------
{ Mod. de prefijo "robusto" (Grado: 4) — Vida }
+73(70-84) a la vida máxima
{ Mod. de sufijo "de la borrasca" (Grado: 7) — Elemental, Rayo, Resistencia }
+12(11-15)% a la resistencia al rayo`;

const SCEPTRE = `Clase de objeto: Cetros
Rareza: Raro
Clamor del vórtice
Cetro traqueteante
--------
Espíritu: 145 (augmented)
--------
Requiere: Nivel 32
--------
Nivel de objeto: 44
--------
Otorga la habilidad: Esbirro guerrero esqueleto de nivel 11
--------
{ Mod. de prefijo "del barón" (Grado: 7) }
Espíritu aumentado un 32(27-32)%
{ Mod. de sufijo "de ajuste" (Grado: 6) — Elemental, Fuego, Hielo, Rayo, Resistencia }
Los aliados que están en tu presencia tienen +4(3-5)% a todas las resistencias elementales`;

const WICKED_QUILL = `Clase de objeto: Varitas
Rareza: Único
La pluma cruel
Varita marchita
--------
Requiere: Nivel 63
--------
Nivel de objeto: 70
--------
Otorga la habilidad: Descarga de caos de nivel 12 (nivel máx. 16)
--------
{ Mod. único — Daño, Lanzador de hechizos }
Daño de hechizos aumentado un 76(60-100)%
{ Mod. único — Caos, Resistencia }
+9(7-13)% a la resistencia al caos
--------
Con un movimiento del dedo, sus destinos se escriben
y las páginas se rompen en mil pedazos.`;

function profile(items: Item[] = []): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "bruja",
    name: "Bruja",
    characterClass: "Bruja",
    level: 34,
    levelSource: "observed",
    league: "Standard",
    patch: "0.5.4f",
    items,
    skills: [{ id: "s1", label: "", mainSkill: "Contagio", supports: [{ name: "Aflicción veloz I" }] }],
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    importedAt: "2026-11-22T00:00:00.000Z",
  });
}

describe("dos piezas pegadas en el mismo cuadro", () => {
  it("solo se guarda la primera, sin mods ni requisitos de la segunda, y se avisa", () => {
    const { item, warnings } = parseItemText(`${GLOVES}\n${SCEPTRE}`);
    expect(item.name).toBe("Contacto del vórtice");
    expect(item.slot).toBe("gloves");
    expect(item.itemLevel).toBe(47);
    expect(item.requirements?.level).toBe(45);
    expect(item.modifiers.map((modifier) => modifier.text)).toEqual([
      "+73(70-84) a la vida máxima",
      "+12(11-15)% a la resistencia al rayo",
    ]);
    expect(item.rawText).not.toContain("Cetros");
    expect(warnings.join(" ")).toContain("Pegaste 2 piezas juntas");
  });

  it("una sola pieza no avisa de nada de esto", () => {
    expect(parseItemText(GLOVES).warnings.join(" ")).not.toContain("piezas juntas");
  });

  it("una pieza ya guardada así se repara sola y la reparación no se repite", () => {
    const merged = parseItemText(`${GLOVES}\n${SCEPTRE}`).item;
    // Así quedaba con el importador anterior: el texto entero y los mods mezclados.
    const legacy: Item = {
      ...merged,
      id: "guantes",
      rawText: `${GLOVES}\n${SCEPTRE}`,
      modifiers: [...merged.modifiers, ...parseItemText(SCEPTRE).item.modifiers],
    };
    const repaired = repairStoredItemImport(legacy);
    expect(repaired?.id).toBe("guantes");
    expect(repaired?.slot).toBe("gloves");
    expect(repaired?.modifiers).toHaveLength(2);
    expect(repairStoredItemImport(repaired!)).toBeNull();
  });
});

describe("únicos con descripciones avanzadas", () => {
  it("la cabecera «Mod. único» no es un mod y el texto decorativo tampoco", () => {
    const { item } = parseItemText(WICKED_QUILL);
    expect(item.rarity).toBe("unique");
    expect(item.modifiers.map((modifier) => modifier.text)).toEqual([
      "Otorga la habilidad: Descarga de caos de nivel 12 (nivel máx. 16)",
      "Daño de hechizos aumentado un 76(60-100)%",
      "+9(7-13)% a la resistencia al caos",
    ]);
    // Copia completa: el estado del objeto se puede afirmar.
    expect(item.craftingState).toBeDefined();
  });

  it("un único guardado con cabeceras sueltas se repara", () => {
    const fresh = parseItemText(WICKED_QUILL).item;
    const legacy: Item = {
      ...fresh,
      id: "varita",
      modifiers: [
        ...fresh.modifiers,
        { id: "h1", text: "{ Mod. único — Daño, Lanzador de hechizos }", kind: "explicit", values: [], verified: false },
      ],
    };
    const repaired = repairStoredItemImport(legacy);
    expect(repaired?.id).toBe("varita");
    expect(repaired?.modifiers).toHaveLength(3);
  });

  it("una pieza sana no se toca", () => {
    expect(repairStoredItemImport({ ...parseItemText(GLOVES).item, id: "x" })).toBeNull();
  });
});

describe("resistencias que suma el equipo", () => {
  it("suma las del personaje y no las de aura para los aliados", () => {
    const items = [parseItemText(GLOVES).item, { ...parseItemText(SCEPTRE).item, slot: "offhand" as const }, parseItemText(WICKED_QUILL).item];
    const gear = resistancesFromItems(items);
    expect(gear).toMatchObject({ fire: 0, cold: 0, lightning: 12, chaos: 9, found: true });
  });

  it("entiende «todas las resistencias elementales» y el inglés", () => {
    const item = (text: string): Item => ({
      ...parseItemText(GLOVES).item,
      modifiers: [{ id: text, text, kind: "explicit", values: [], verified: false }],
    });
    expect(resistancesFromItems([item("+10% a todas las resistencias elementales")])).toMatchObject({
      fire: 10,
      cold: 10,
      lightning: 10,
    });
    expect(resistancesFromItems([item("+25% to Cold Resistance"), item("+12% to Fire and Lightning Resistances")])).toMatchObject({
      fire: 12,
      cold: 25,
      lightning: 12,
    });
  });

  it("sin datos del jugador, el consejo dice dónde mirar y cuánto suma el equipo", () => {
    const [gap] = elementalResistancesRule({
      profile: profile([parseItemText(GLOVES).item]),
      league: "Standard",
      patch: "0.5.4f",
    });
    expect(gap?.action).toContain("tecla C");
    expect(gap?.action).toContain("rayo +12 %");
  });
});

describe("la revisión rápida llega al motor y al Mentor", () => {
  const form = { ...EMPTY, level: "44", mainSkill: "Drenar esencia", cold: "18", fire: "65" };

  it("usa el nivel, las resistencias y la habilidad principal que escribió el jugador", () => {
    const next = profileWithQuickReview(profile(), form);
    expect(next.level).toBe(44);
    expect(next.resistances).toEqual({ fire: 65, cold: 18, lightning: null, chaos: null });
    expect(next.skills.map((skill) => skill.mainSkill)).toEqual(["Drenar esencia", "Contagio"]);
    expect(next.skills[0]?.id).toBe(QUICK_REVIEW_SKILL_ID);
  });

  it("si el perfil ya tiene esa habilidad, la adelanta con sus apoyos", () => {
    const base = profile();
    base.skills.push({ id: "s2", label: "", mainSkill: "Drenar esencia", mainSkillGemId: null, supports: [{ name: "A", gemId: null }] });
    const next = profileWithQuickReview(base, { ...EMPTY, mainSkill: "drenar esencia" });
    expect(next.skills[0]?.id).toBe("s2");
    expect(next.skills).toHaveLength(2);
  });

  it("con la revisión vacía, el perfil no cambia", () => {
    const base = profile();
    expect(profileWithQuickReview(base, EMPTY)).toBe(base);
  });

  it("de una habilidad sin apoyos conocidos no se dice «tiene 0 apoyos»", () => {
    const next = profileWithQuickReview(profile(), form);
    expect(skillLinksRule({ profile: next, league: "Standard", patch: "0.5.4f" })).toEqual([]);
  });
});
