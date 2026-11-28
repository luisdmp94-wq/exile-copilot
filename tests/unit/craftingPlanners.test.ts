import { describe, expect, it } from "vitest";
import { EMOTION_DATA } from "../../shared/craftingEmotionData.js";
import { EMOTION_SOURCE, evaluateEmotionPlan } from "../../shared/craftingEmotions.js";
import { FLUXES, evaluateFluxPlan } from "../../shared/craftingFluxes.js";
import { HINEKORA_LOCK_SOURCE, evaluateForesightPlan } from "../../shared/craftingForesight.js";
import { jewelOf } from "../../shared/craftingPlannerRules.js";
import { SACRIFICE_ORBS, evaluateSacrificePlan } from "../../shared/craftingSacrifice.js";
import type { Item, Modifier } from "../../shared/domain.js";

/**
 * Planificadores de crafteo avanzado de la tarea 19: previsión (Mechón de
 * Hinekora), Orbes de sacrificio, emociones líquidas y flujos. Las reglas
 * salen del texto de cada objeto en el juego (poe2db, 28-11-2026); lo que el
 * texto no dice, el planificador lo dice y no lo inventa.
 */

function modifier(id: string, patch: Partial<Modifier> = {}): Modifier {
  return { id, text: id, kind: "explicit", affix: "prefix", values: [], verified: false, ...patch };
}

const CLEAN = { corrupted: false, mirrored: false, split: false, unidentified: false };
const CORRUPTED = { ...CLEAN, corrupted: true };
const FOUR = ["vida", "mana", "velocidad", "evasion"].map((id) => modifier(id));

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "pieza",
    name: "Pieza de prueba",
    baseType: "Botas de prueba",
    slot: "boots",
    rarity: "rare",
    itemLevel: 70,
    modifiers: FOUR,
    craftingState: CLEAN,
    sources: [],
    ...patch,
  };
}

const jewel = (patch: Partial<Item> = {}): Item =>
  item({ itemClass: "Joyas", baseType: "Rubí", slot: "other", modifiers: FOUR.slice(0, 3), ...patch });

const PATCH = "0.5.5";

describe("joyas: qué es una joya y cuál", () => {
  it("manda la clase de objeto; la base dice cuál de las cuatro es", () => {
    expect(jewelOf(jewel())).toEqual({ base: "ruby", timeLost: false });
    expect(jewelOf(jewel({ itemClass: "Jewels", baseType: "Time-Lost Sapphire" }))).toEqual({ base: "sapphire", timeLost: true });
    expect(jewelOf(jewel({ baseType: "Esmeralda perdida en el tiempo" }))).toEqual({ base: "emerald", timeLost: true });
  });

  it("un anillo de rubí no es una joya", () => {
    expect(jewelOf(item({ itemClass: "Anillos", baseType: "Anillo de rubí", slot: "ring1" }))).toBeNull();
    expect(jewelOf(item({ itemClass: undefined, baseType: "Anillo de rubí", slot: "ring1" }))).toBeNull();
  });

  it("sin clase de objeto, solo cuenta una base que sea la joya y nada más", () => {
    expect(jewelOf(item({ itemClass: undefined, baseType: "Diamante", slot: "other" }))).toEqual({ base: "diamond", timeLost: false });
  });
});

describe("Mechón de Hinekora (previsión)", () => {
  const plan = { patch: PATCH, protectedModifierIds: [] as string[] };

  it("lleva el nombre y el texto del juego en los dos idiomas", () => {
    expect(HINEKORA_LOCK_SOURCE.name).toEqual({ es: "Mechón de Hinekora", en: "Hinekora's Lock" });
    expect(HINEKORA_LOCK_SOURCE.text.es[0]).toContain("anticipe el resultado del próximo objeto monetario");
    expect(HINEKORA_LOCK_SOURCE.text.en[1]).toBe("Modifying the item in any way removes the ability to foresee");
  });

  it("en una pieza limpia se puede usar y dice que no la cambia", () => {
    const result = evaluateForesightPlan(item(), plan);
    expect(result.status).toBe("compatible");
    expect(result.reason).toBe("Se puede usar: el Mechón de Hinekora no cambia la pieza. Le deja ver el resultado de la próxima moneda antes de gastarla.");
    expect(result.changesItem).toBe(false);
    expect(result.outlook[1]).toContain("una sola moneda");
    expect(result.outlook.at(-1)).toContain("No lo doy por hecho");
  });

  it("con modificadores marcados dice para qué monedas le sirve", () => {
    const result = evaluateForesightPlan(item(), { ...plan, protectedModifierIds: ["vida", "mana"] });
    expect(result.wantedModifierCount).toBe(2);
    expect(result.outlook.join(" ")).toContain("Tienes 2 modificadores marcados para conservar");
    expect(result.outlook.join(" ")).toContain("Orbe de anulación");
  });

  it("en una pieza corrupta no afirma nada: el texto no lo dice", () => {
    const result = evaluateForesightPlan(item({ craftingState: CORRUPTED }), plan);
    expect(result.status).toBe("needs-data");
    expect(result.reason).toContain("no dice si se puede poner en una pieza corrupta");
  });

  it("reflejada, no; sin estados en el texto, faltan datos", () => {
    expect(evaluateForesightPlan(item({ craftingState: { ...CLEAN, mirrored: true } }), plan).status).toBe("blocked");
    expect(evaluateForesightPlan(item({ craftingState: undefined }), plan).status).toBe("needs-data");
  });

  it("para otro parche no da la regla por buena", () => {
    const result = evaluateForesightPlan(item(), { ...plan, patch: "1.0.0" });
    expect(result.status).toBe("needs-data");
    expect(result.reason).toContain("No está revisada para 1.0.0");
  });

  it("contesta en inglés", () => {
    expect(evaluateForesightPlan(item(), plan, "en").reason).toContain("Hinekora's Lock doesn't change the item");
  });
});

describe("Orbes de sacrificio", () => {
  const enchant = modifier("encantamiento", { kind: "enchant", text: "+1 al nivel de todas las habilidades" });
  const corrupted = (patch: Partial<Item> = {}): Item => item({ craftingState: CORRUPTED, modifiers: [enchant, ...FOUR], ...patch });
  const plan = { patch: PATCH, protectedModifierIds: [] as string[] };

  it("son cuatro, con su texto del juego", () => {
    expect(Object.keys(SACRIFICE_ORBS)).toEqual(["yaomac", "kopec", "kamasa", "yugul"]);
    expect(SACRIFICE_ORBS.kamasa.text.en[0]).toBe("Upgrades a Corruption Enchantment on a Rare Amulet, Ring or Belt");
    expect(SACRIFICE_ORBS.yaomac.text.es).toEqual(["Mejora un encantamiento corrupto de un arma o un carcaj raros", "Y elimina un modificador aleatorio"]);
  });

  it("a cada pieza le toca su orbe", () => {
    expect(evaluateSacrificePlan(corrupted(), plan).orb?.id).toBe("kopec");
    expect(evaluateSacrificePlan(corrupted({ slot: "weapon" }), plan).orb?.id).toBe("yaomac");
    expect(evaluateSacrificePlan(corrupted({ slot: "offhand", itemClass: "Carcajes", baseType: "Carcaj ancho" }), plan).orb?.id).toBe("yaomac");
    expect(evaluateSacrificePlan(corrupted({ slot: "ring2" }), plan).orb?.id).toBe("kamasa");
    expect(evaluateSacrificePlan(corrupted({ slot: "other", itemClass: "Joyas", baseType: "Zafiro" }), plan).orb?.id).toBe("yugul");
  });

  it("en unas botas corruptas con encantamiento se puede, y dice qué arriesga", () => {
    const result = evaluateSacrificePlan(corrupted(), { ...plan, protectedModifierIds: ["vida"] });
    expect(result.status).toBe("compatible");
    expect(result.reason).toBe("A esta pieza le toca el Orbe de sacrificio de Kopec: mejora su encantamiento corrupto y, a cambio, le quita un modificador al azar.");
    expect(result.outlook[0]).toContain("No sé en qué se convierte");
    expect(result.outlook[1]).toBe("Eliminará al azar 1 de los 4 modificadores explícitos: cada uno tiene 1 de 4 (25 %) de desaparecer.");
    expect(result.outlook[2]).toContain("1 de 4 (25 %) de perder uno de ellos");
    expect(result.lossOdds).toEqual({ wanted: 1, of: 4 });
    expect(result.irreversible).toBe(true);
  });

  it("si la pieza no está corrupta, no", () => {
    const result = evaluateSacrificePlan(item({ modifiers: [enchant, ...FOUR] }), plan);
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("no está corrupta");
  });

  it("corrupta pero sin encantamiento, no hay nada que mejorar", () => {
    const result = evaluateSacrificePlan(item({ craftingState: CORRUPTED }), plan);
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("no veo ningún encantamiento");
  });

  it("no vale en una pieza que no es rara ni en un tipo que ningún orbe nombra", () => {
    expect(evaluateSacrificePlan(corrupted({ rarity: "unique" }), plan).reason).toBe("Los Orbes de sacrificio solo valen en piezas raras, y esta es única.");
    const flask = evaluateSacrificePlan(corrupted({ slot: "flask" }), plan);
    expect(flask.status).toBe("blocked");
    expect(flask.orb).toBeNull();
  });

  it("con un escudo no afirma cuál toca", () => {
    const result = evaluateSacrificePlan(corrupted({ slot: "offhand", itemClass: "Escudos", baseType: "Escudo de torre" }), plan);
    expect(result.status).toBe("needs-data");
    expect(result.reason).toContain("no sé cuál toca");
  });

  it("con un modificador fracturado no da probabilidades", () => {
    const result = evaluateSacrificePlan(corrupted({ modifiers: [enchant, modifier("fijo", { fractured: true }), ...FOUR] }), { ...plan, protectedModifierIds: ["vida"] });
    expect(result.status).toBe("compatible");
    expect(result.lossOdds).toBeNull();
    expect(result.outlook.join(" ")).toContain("no te doy probabilidades");
  });

  it("en una joya avisa de que el texto en español del juego no coincide con el inglés", () => {
    const result = evaluateSacrificePlan(corrupted({ slot: "other", itemClass: "Joyas", baseType: "Zafiro" }), plan);
    expect(result.translationNote).toContain("armadura rara");
    expect(evaluateSacrificePlan(corrupted({ slot: "other", itemClass: "Jewels", baseType: "Sapphire" }), plan, "en").translationNote).toBeNull();
  });

  it("antes de 0.5.4 los orbes no existían", () => {
    expect(evaluateSacrificePlan(corrupted(), { ...plan, patch: "0.5.3" }).status).toBe("needs-data");
    expect(evaluateSacrificePlan(corrupted(), { ...plan, patch: "0.5.4f" }).status).toBe("compatible");
  });
});

describe("Emociones líquidas", () => {
  const plan = { patch: PATCH, protectedModifierIds: [] as string[] };

  it("los datos traen las 26 emociones del juego, la mitad antiguas", () => {
    expect(EMOTION_DATA).toHaveLength(26);
    expect(EMOTION_DATA.filter((emotion) => emotion.target === "time-lost")).toHaveLength(13);
    const ire = EMOTION_DATA.find((emotion) => emotion.id === "diluted-liquid-ire");
    expect(ire?.name).toEqual({ es: "Ira líquida diluida", en: "Diluted Liquid Ire" });
    expect(ire?.outcomes[0]).toEqual({
      jewel: "ruby",
      affix: "prefix",
      text: { es: "Armadura aumentada un (10—20)%", en: "(10—20)% increased Armour" },
    });
    expect(EMOTION_SOURCE.text.basic.en).toContain("Rare Basic Jewel");
  });

  it("en un rubí raro se puede, y ofrece las 13 emociones normales", () => {
    const result = evaluateEmotionPlan(jewel(), plan);
    expect(result.status).toBe("compatible");
    expect(result.reason).toBe("Se puede usar una emoción líquida: la joya es rara y de base rubí. Le quita un modificador al azar y le pone uno fijo.");
    expect(result.options).toHaveLength(13);
    expect(result.options.every((option) => !option.id.startsWith("ancient"))).toBe(true);
    expect(result.outlook[0]).toContain("Elige abajo la emoción");
  });

  it("con la emoción elegida dice qué modificador pone en ESTA joya", () => {
    const result = evaluateEmotionPlan(jewel(), { ...plan, emotionId: "diluted-liquid-ire", protectedModifierIds: ["vida", "mana"] });
    expect(result.selected?.name).toBe("Ira líquida diluida");
    expect(result.outlook[0]).toBe("Le pondrá este prefijo: «Armadura aumentada un (10—20)%».");
    expect(result.outlook[1]).toBe("Eliminará al azar 1 de los 3 modificadores explícitos: cada uno tiene 1 de 3 (33 %) de desaparecer.");
    expect(result.lossOdds).toEqual({ wanted: 2, of: 3 });
    const sapphire = evaluateEmotionPlan(jewel({ baseType: "Zafiro" }), { ...plan, emotionId: "diluted-liquid-ire" });
    expect(sapphire.outlook[0]).toContain("Escudo de energía máximo aumentado");
  });

  it("si la emoción nombra prefijo y sufijo para esa joya, dice los dos", () => {
    const result = evaluateEmotionPlan(jewel(), { ...plan, emotionId: "potent-liquid-contempt" });
    expect(result.selected?.outcomes).toHaveLength(2);
    expect(result.outlook[0]).toContain("uno de estos");
  });

  it("si la emoción no nombra esa joya, lo dice", () => {
    const result = evaluateEmotionPlan(jewel({ baseType: "Diamante" }), { ...plan, emotionId: "diluted-liquid-ire" });
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("no dice nada para joyas de base diamante");
  });

  it("una joya perdida en el tiempo pide emociones antiguas", () => {
    const result = evaluateEmotionPlan(jewel({ baseType: "Rubí perdido en el tiempo" }), plan);
    expect(result.status).toBe("compatible");
    expect(result.reason).toContain("emoción antigua");
    expect(result.options).toHaveLength(13);
    expect(result.options.every((option) => option.id.startsWith("ancient"))).toBe(true);
  });

  it("no vale en lo que no es una joya, ni en una joya que no es rara, ni corrupta", () => {
    expect(evaluateEmotionPlan(item(), plan).reason).toContain("esta pieza no es una joya");
    expect(evaluateEmotionPlan(jewel({ rarity: "magic" }), plan).reason).toBe("Las emociones líquidas solo valen en joyas raras, y esta es mágica.");
    expect(evaluateEmotionPlan(jewel({ craftingState: CORRUPTED }), plan).status).toBe("blocked");
  });

  it("si ya tiene un modificador de fabricación, avisa sin afirmar", () => {
    const result = evaluateEmotionPlan(jewel({ modifiers: [modifier("hecho", { crafted: true }), ...FOUR.slice(0, 2)] }), plan);
    expect(result.outlook.join(" ")).toContain("No sé si admite otro");
  });
});

describe("Flujos de resistencias", () => {
  const plan = { patch: PATCH };
  const fire = modifier("fuego", { text: "+28(26-30)% a la resistencia al fuego", affix: "suffix" });
  const cold = modifier("hielo", { text: "+12(11-15)% a la resistencia al hielo", affix: "suffix" });
  const chaos = modifier("caos", { text: "+9(8-11)% a la resistencia al caos", affix: "suffix" });
  const life = modifier("vida", { text: "+80 a la vida máxima" });
  const option = (result: ReturnType<typeof evaluateFluxPlan>, id: string) => result.options.find((each) => each.id === id)!;

  it("son cuatro, con el texto del juego", () => {
    expect(FLUXES.map((flux) => flux.name.es)).toEqual(["Flujo ardiente", "Flujo escarchante", "Flujo electrizante", "Flujo del vacío"]);
    expect(FLUXES[0]!.text.en).toBe("Transforms all Cold and Lightning Resistance modifiers on an item to equivalent Fire Resistance modifiers");
  });

  it("dice qué haría cada flujo con las resistencias de la pieza", () => {
    const result = evaluateFluxPlan(item({ modifiers: [life, fire, cold] }), plan);
    expect(result.status).toBe("compatible");
    expect(result.reason).toBe("Se puede usar un flujo: esta pieza tiene 2 modificadores de resistencia elemental que pueden cambiar de elemento.");
    expect(option(result, "crackling").changes).toEqual([
      { modifierId: "fuego", from: "+28% a la resistencia al fuego", to: "resistencia al rayo, mismo rango" },
      { modifierId: "hielo", from: "+12% a la resistencia al hielo", to: "resistencia al rayo, mismo rango" },
    ]);
    expect(option(result, "blazing").changes.map((change) => change.modifierId)).toEqual(["hielo"]);
  });

  it("avisa cuando quedarían dos líneas iguales: el texto no dice qué pasa", () => {
    const result = evaluateFluxPlan(item({ modifiers: [life, fire, cold] }), plan);
    expect(option(result, "blazing").warnings[0]).toContain("Quedarían dos líneas iguales de resistencia al fuego");
    expect(option(result, "crackling").warnings[0]).toContain("resistencia al rayo");
    const single = evaluateFluxPlan(item({ modifiers: [life, cold] }), plan);
    expect(option(single, "blazing").warnings).toEqual([]);
  });

  it("hacia caos usa la tabla de equivalencias del juego", () => {
    const result = evaluateFluxPlan(item({ modifiers: [life, fire, cold] }), plan);
    expect(option(result, "void").changes.map((change) => change.to)).toEqual([
      "+(16—19)% a la resistencia al caos",
      "+(8—11)% a la resistencia al caos",
    ]);
  });

  it("sin el rango en el texto, busca la fila por el valor", () => {
    const plain = modifier("fuego", { text: "+33% a la resistencia al fuego" });
    expect(option(evaluateFluxPlan(item({ modifiers: [plain] }), plan), "void").changes[0]!.to).toBe("+(20—23)% a la resistencia al caos");
    const off = modifier("fuego", { text: "+52% a la resistencia al fuego" });
    expect(option(evaluateFluxPlan(item({ modifiers: [off] }), plan), "void").changes[0]!.to).toContain("no encuentro su rango");
  });

  it("la resistencia al caos no la cambia ningún flujo", () => {
    const result = evaluateFluxPlan(item({ modifiers: [fire, chaos] }), plan);
    expect(result.options.flatMap((each) => each.changes).some((change) => change.modifierId === "caos")).toBe(false);
    expect(option(result, "void").warnings[0]).toContain("dos líneas iguales de resistencia al caos");
  });

  it("lee también las líneas en inglés, la máxima y la que va con caos", () => {
    const result = evaluateFluxPlan(
      item({
        modifiers: [
          modifier("max", { text: "+2% to Maximum Cold Resistance" }),
          modifier("mixta", { text: "+15(13-17)% to Lightning and Chaos Resistances" }),
        ],
      }),
      plan,
      "en",
    );
    expect(option(result, "blazing").changes.map((change) => change.to)).toEqual([
      "+2% to Maximum Fire Resistance",
      "Fire and Chaos Resistances, same range",
    ]);
    expect(option(result, "void").changes.map((change) => change.to)).toEqual([
      "+2% to Maximum Chaos Resistance",
      "+(24—27)% to Chaos Resistance (a single line)",
    ]);
  });

  it("«todas las resistencias elementales» no sale en la tabla: lo dice y no afirma", () => {
    const all = modifier("todas", { text: "+10% a todas las resistencias elementales" });
    const alone = evaluateFluxPlan(item({ modifiers: [life, all] }), plan);
    expect(alone.status).toBe("needs-data");
    const mixed = evaluateFluxPlan(item({ modifiers: [fire, all] }), plan);
    expect(mixed.status).toBe("compatible");
    expect(mixed.unknownLines).toEqual(["+10% a todas las resistencias elementales"]);
    expect(mixed.outlook.join(" ")).toContain("No sé si un flujo la cambia");
  });

  it("sin resistencias elementales, ningún flujo cambia nada", () => {
    const result = evaluateFluxPlan(item({ modifiers: [life, chaos] }), plan);
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("ningún flujo le cambiaría nada");
  });

  it("una resistencia implícita no se da por cambiada", () => {
    const implicit = modifier("implicita", { kind: "implicit", text: "+25% a la resistencia al fuego" });
    expect(evaluateFluxPlan(item({ modifiers: [life, implicit] }), plan).status).toBe("needs-data");
    expect(evaluateFluxPlan(item({ modifiers: [cold, implicit] }), plan).outlook.join(" ")).toContain("implícita o de runa");
  });

  it("solo vale en piezas mágicas o raras, y no en corruptas", () => {
    expect(evaluateFluxPlan(item({ modifiers: [fire], rarity: "magic" }), plan).status).toBe("compatible");
    expect(evaluateFluxPlan(item({ modifiers: [fire], rarity: "unique" }), plan).reason).toBe("Los flujos solo valen en piezas mágicas o raras, y esta es única.");
    expect(evaluateFluxPlan(item({ modifiers: [fire], craftingState: CORRUPTED }), plan).status).toBe("blocked");
  });

  it("una línea fracturada no se da por cambiada", () => {
    const locked = modifier("hielo", { text: "+12% a la resistencia al hielo", fractured: true });
    expect(option(evaluateFluxPlan(item({ modifiers: [locked] }), plan), "blazing").warnings[0]).toContain("fracturada");
  });
});
