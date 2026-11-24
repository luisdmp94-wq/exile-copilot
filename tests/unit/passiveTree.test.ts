import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile } from "../../shared/domain.js";
import {
  buildTreeGraph,
  classStartFor,
  exportClassName,
  pathTo,
  reachFrom,
  readAllocated,
  treeForClass,
  treeVersionFamily,
} from "../../shared/passiveTree.js";
import { adviseTree, buildProfile, lineValue, type TreeAdviceContext, type TreeSkill } from "../../shared/passiveTreeAdvice.js";
import { PassiveTreeAdviceResponseSchema, treeRequestFromProfile, weaponKindOf } from "../../shared/passiveTreeRequest.js";
import { loadPassiveTree, advisePassiveTree, graphCacheKey } from "../../server/advice/passiveTreeAdvisor.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { answerPassiveTreeQuestion, isPassiveTreeQuestion } from "../../server/mentor/treeQuestion.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";

const tree = loadPassiveTree();
const gems = loadGemData();
const locale = loadEnglishGemLocale();
const knowledge = { tree, gems, locale };

const keyByName = (name: string) => {
  const entry = Object.entries(tree.nodes).find(([, node]) => node.nameEn === name);
  if (!entry) throw new Error(`No está ${name}`);
  return entry[0];
};

function skill(slug: string, main = false): TreeSkill {
  const gem = gems.skills.find((candidate) => candidate.slug === slug);
  if (!gem) throw new Error(`No está la gema ${slug}`);
  return { name: gem.name, tags: gem.tags, description: [gem.description, ...gem.effects].join(" "), main };
}

function context(skills: TreeSkill[], extra: Partial<TreeAdviceContext> = {}): TreeAdviceContext {
  return { skills, weapons: ["wand"], defence: "life", usesArmour: false, usesEvasion: false, lang: "es", ...extra };
}

/** Una bruja recién empezada: solo el inicio de su clase. */
function freshWitch() {
  const graph = buildTreeGraph(treeForClass(tree, "Bruja"));
  const start = classStartFor(graph, "Bruja");
  if (!start) throw new Error("Sin inicio de bruja");
  return { graph, start, allocated: new Set([start]) };
}

describe("el árbol oficial que genera npm run data:tree", () => {
  it("trae el árbol entero con nombres en español de todos los notables", () => {
    expect(tree.version).toBe(1);
    expect(Object.keys(tree.nodes).length).toBeGreaterThan(4000);
    expect(tree.edges.length).toBeGreaterThan(4000);
    const notables = Object.values(tree.nodes).filter((node) => node.kind === "notable" || node.kind === "keystone");
    expect(notables.length).toBeGreaterThan(900);
    expect(notables.filter((node) => node.nameEs === null)).toEqual([]);
    const darkEntries = tree.nodes[keyByName("Dark Entries")];
    expect(darkEntries.nameEs).toBe("Entradas oscuras");
    expect(darkEntries.statsEs).toEqual(["+1 al nivel de todas las habilidades de caos"]);
  });

  it("cada conexión une dos nodos que existen", () => {
    for (const [a, b] of tree.edges) {
      expect(tree.nodes[a], a).toBeDefined();
      expect(tree.nodes[b], b).toBeDefined();
    }
  });

  it("la Bruja ve sus propias versiones de algunos nodos («Entropía», «Poder de los muertos»)", () => {
    const witch = treeForClass(tree, "Bruja");
    const changed = Object.entries(tree.overrides.Witch);
    expect(changed.length).toBeGreaterThan(10);
    const [key, override] = changed.find(([, value]) => value.nameEn === "Power of the Dead")!;
    expect(witch.nodes[key].nameEs).toBe("Poder de los muertos");
    expect(witch.nodes[key].statsEn).toEqual(override.statsEn);
    // El árbol de las demás clases no cambia.
    expect(treeForClass(tree, "Guerrero").nodes[key].nameEn).toBe(tree.nodes[key].nameEn);
    expect(tree.nodes[key].nameEn).not.toBe("Power of the Dead");
  });

  it("reconoce las clases en español y en inglés", () => {
    expect(exportClassName("Bruja")).toBe("Witch");
    expect(exportClassName("witch")).toBe("Witch");
    expect(exportClassName("Exploradora")).toBe("Ranger");
    expect(exportClassName("Templario")).toBeNull();
    expect(treeVersionFamily("0_5")).toBe("0.5");
    expect(treeVersionFamily("0.5.5")).toBe("0.5");
  });
});

describe("lo cogido y los caminos", () => {
  it("lee los números de PoB2 y los ids oficiales, y aparta la ascendencia", () => {
    const graph = buildTreeGraph(tree);
    const darkEntries = keyByName("Dark Entries");
    const read = readAllocated(graph, [darkEntries, "chaos31", tree.ascendancyNodes[0], "999999999"], "Bruja");
    expect(read.allocated.has(darkEntries)).toBe(true);
    expect(read.ascendancyCount).toBe(1);
    expect(read.unknown).toEqual(["999999999"]);
    expect(read.start).toBe(classStartFor(graph, "Bruja"));
    expect(read.allocated.has(read.start!)).toBe(true);
  });

  it("el camino más corto va nodo a nodo desde lo cogido y no pasa por el inicio de otra clase", () => {
    const { graph, start, allocated } = freshWitch();
    const reach = reachFrom(graph, allocated, start);
    const target = keyByName("Dark Entries");
    const path = pathTo(reach, target);
    expect(path.at(-1)).toBe(target);
    expect(path.length).toBe(reach.dist.get(target));
    let previous = start;
    for (const key of path) {
      expect(graph.neighbours.get(previous)).toContain(key);
      expect(graph.data.nodes[key].kind === "start").toBe(false);
      previous = key;
    }
  });
});

describe("las reglas que valoran cada línea", () => {
  const witchBuild = buildProfile(context([skill("Essence_Drain", true), skill("Contagion"), skill("Despair")]));

  it("lo que resta cuenta en contra", () => {
    expect(lineValue("5% reduced Attack Speed", buildProfile(context([skill("Boneshatter", true)], { weapons: ["mace"] }))).offence).toBeLessThan(0);
    expect(lineValue("10% reduced Projectile Speed for Spell Skills", witchBuild).offence).toBeLessThanOrEqual(0);
  });

  it("las líneas de esbirros, armas o tótems que no usa no valen nada", () => {
    expect(lineValue("Minions deal 15% increased Damage", witchBuild).offence).toBe(0);
    expect(lineValue("20% increased Damage with Bows", witchBuild).offence).toBe(0);
    expect(lineValue("Spells Cast by Totems have 5% increased Cast Speed", witchBuild).offence).toBe(0);
  });

  it("la vida de las ofrendas no es la vida del personaje", () => {
    expect(lineValue("Offerings have 30% increased Maximum Life", witchBuild).defence).toBe(0);
    expect(lineValue("8% increased maximum Life", witchBuild).defence).toBeGreaterThan(0.5);
  });

  it("el «Por qué» no dice lo contrario de lo que hace el nodo", () => {
    const warrior = buildProfile(context([skill("Boneshatter", true)], { weapons: ["mace"], usesArmour: true }));
    // Líneas tal cual están en el árbol del juego.
    // Romper la armadura del enemigo no es «más armadura».
    for (const line of ["Break 40% increased Armour", "25% increased Armour Break Duration"]) {
      const value = lineValue(line, warrior);
      expect(value.reasons, line).not.toContain("armour");
      expect(value.defence, line).toBe(0);
    }
    expect(lineValue("25% reduced Armour Break taken", warrior).defence).toBeGreaterThan(0);
    expect(lineValue("20% increased Armour", warrior).reasons).toContain("armour");
    // Umbral sacado del escudo de energía no es «más escudo de energía».
    const hallowed = lineValue("Gain additional Ailment Threshold equal to 20% of maximum Energy Shield", witchBuild);
    expect(hallowed.reasons).toEqual([]);
    expect(hallowed.defence).toBeGreaterThan(0);
    // Maldiciones sobre ti no son «tus maldiciones pegan más fuerte».
    expect(lineValue("30% increased Damage per Curse on you", witchBuild)).toMatchObject({ offence: 0, reasons: [] });
    expect(lineValue("30% reduced effect of Curses on you", witchBuild).reasons).not.toContain("curse");
    expect(lineValue("30% reduced effect of Curses on you", witchBuild).defence).toBeGreaterThan(0);
    // La exposición baja las resistencias del enemigo.
    expect(lineValue("Exposure you inflict lowers Resistances by an additional 5%", witchBuild).reasons).not.toContain("resist");
    // Lo que te quita no suma: resistencia negativa y perder vida.
    for (const line of ["-7% to Chaos Resistance", "-10% to all Elemental Resistances", "Lose 3% of maximum Life and Energy Shield when you use a Chaos Skill"]) {
      const value = lineValue(line, witchBuild);
      expect(value.defence, line).toBeLessThanOrEqual(0);
      expect(value.reasons, line).toEqual([]);
    }
    // La vida que explota es la del enemigo.
    const explode = lineValue("Burning Enemies you kill have a 5% chance to Explode, dealing a tenth of their maximum Life as Fire Damage", witchBuild);
    expect(explode.reasons).not.toContain("life");
    // Y lo normal sigue igual.
    expect(lineValue("+10% to Fire Resistance", witchBuild).reasons).toContain("resist");
    expect(lineValue("8% increased maximum Life", witchBuild).reasons).toContain("life");
  });

  it("un daño con el tiempo apenas gana con críticos", () => {
    const crit = lineValue("16% increased Critical Hit Chance for Spells", witchBuild).offence;
    const chaos = lineValue("12% increased Chaos Damage", witchBuild).offence;
    expect(crit).toBeLessThan(chaos / 3);
  });

  it("subir el nivel de sus habilidades es lo que más vale", () => {
    expect(lineValue("+1 to Level of all Chaos Skills", witchBuild).offence).toBeGreaterThan(2);
    expect(lineValue("+1 to Level of all Cold Skills", witchBuild).offence).toBe(0);
  });
});

describe("los próximos notables", () => {
  it("a una bruja de caos con el tiempo le propone caos y hechizos, no críticos", () => {
    const { graph, start, allocated } = freshWitch();
    const advice = adviseTree(graph, allocated, start, context([skill("Essence_Drain", true), skill("Contagion"), skill("Despair")]));
    expect(advice.offence.length).toBe(3);
    for (const step of advice.offence) {
      expect(step.points).toBeGreaterThan(0);
      expect(step.path.at(-1)).toBe(step.key);
      expect(step.stats.join(" ")).not.toMatch(/crítico/i);
      expect(step.reasons.length).toBeGreaterThan(0);
    }
    expect(advice.defence?.kind).toBe("defence");
  });

  it("los pasos se encadenan: el segundo cuenta desde el camino del primero", () => {
    const { graph, start, allocated } = freshWitch();
    const advice = adviseTree(graph, allocated, start, context([skill("Essence_Drain", true)]));
    const [first, second] = advice.offence;
    const taken = new Set([...allocated, ...first.path]);
    const reach = reachFrom(graph, taken, start);
    expect(reach.dist.get(second.key)).toBe(second.points);
  });

  it("a un guerrero de maza le propone cosas de ataque, nunca de hechizos ni de esbirros", () => {
    const graph = buildTreeGraph(treeForClass(tree, "Guerrero"));
    const start = classStartFor(graph, "Guerrero")!;
    const advice = adviseTree(graph, new Set([start]), start, context([skill("Boneshatter", true)], { weapons: ["mace"] }));
    expect(advice.offence.length).toBeGreaterThan(0);
    for (const step of advice.offence) expect(step.stats.join(" ")).not.toMatch(/hechizo|esbirro/i);
  });
});

function profile(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "bruja-arbol",
    name: "Bruja",
    characterClass: "Witch",
    level: 49,
    levelSource: "observed",
    league: "Rise of the Abyssal",
    patch: "0.5.5",
    importedAt: "2026-11-22T00:00:00.000Z",
    skills: [
      { id: "a", label: "a", mainSkill: "Essence Drain" },
      { id: "b", label: "b", mainSkill: "Contagion" },
      { id: "c", label: "c", mainSkill: "Despair" },
    ],
    items: [
      { id: "w", name: "Varita", baseType: "Withered Wand", itemClass: "Weapons", slot: "weapon" },
      { id: "o", name: "Cetro", baseType: "Rattling Sceptre", itemClass: "Off Hands", slot: "offhand" },
    ],
    life: 833,
    energyShield: 318,
    passives: { allocated: [{ ref: classStartFor(buildTreeGraph(tree), "Bruja")! }] },
    pobImport: { passiveTreeVersion: "0_5" },
    ...overrides,
  });
}

describe("la petición sale del personaje", () => {
  it("armas, defensa, habilidades y pasivas", () => {
    const request = treeRequestFromProfile(profile(), "es");
    expect(request.weapons).toEqual(["wand", "sceptre"]);
    expect(request.defence).toBe("life");
    expect(request.skills[0]).toBe("Essence Drain");
    expect(request.passives.length).toBe(1);
    expect(request.treeVersion).toBe("0_5");
    expect(treeRequestFromProfile(profile({ life: 300, energyShield: 900 }), "es").defence).toBe("energyShield");
  });

  it("reconoce las armas en español y en inglés", () => {
    expect(weaponKindOf({ name: "x", baseType: "Ballesta de asalto", itemClass: "Ballestas" })).toBe("crossbow");
    expect(weaponKindOf({ name: "x", baseType: "Escudo de torre", itemClass: "Escudos" })).toBe("shield");
    expect(weaponKindOf({ name: "x", baseType: "Withered Wand" })).toBe("wand");
    expect(weaponKindOf({ name: "Anillo", baseType: "Ruby Ring", itemClass: "Rings" })).toBeNull();
  });

  it("el servidor responde con los nombres en español y la versión del árbol", () => {
    const answer = PassiveTreeAdviceResponseSchema.parse(advisePassiveTree(knowledge, treeRequestFromProfile(profile(), "es")));
    expect(answer.tree.version).toBe(tree.source.commitMessage);
    expect(answer.versionMismatch).toBeNull();
    expect(answer.skills).toContain("Drenar esencia");
    expect(answer.skills).not.toContain("Desesperación");
    expect(answer.offence.length).toBe(3);
    expect(answer.offence.every((step) => step.name === tree.nodes[step.key].nameEs || Object.values(tree.overrides.Witch).some((o) => o.nameEs === step.name))).toBe(true);
  });

  it("avisa si el código es de otra versión del árbol", () => {
    const answer = advisePassiveTree(knowledge, treeRequestFromProfile(profile({ pobImport: { passiveTreeVersion: "0_4" } }), "es"));
    expect(answer.versionMismatch).toEqual({ code: "0.4", tree: treeVersionFamily(tree.source.commitMessage) });
  });

  it("en inglés usa los nombres del juego en inglés", () => {
    const answer = advisePassiveTree(knowledge, treeRequestFromProfile(profile(), "en"));
    expect(answer.skills).toContain("Essence Drain");
    expect(answer.offence.every((step) => /^[\x20-\x7e]+$/.test(step.name))).toBe(true);
  });
});

describe("el Mentor contesta «¿por dónde sigo en el árbol?»", () => {
  it("reconoce la pregunta y no la confunde con una de gemas", () => {
    for (const question of ["¿por dónde sigo en el árbol?", "qué notables cojo", "dónde pongo los puntos de pasiva", "which passives should I take next"]) {
      expect(isPassiveTreeQuestion(normalizeQuestion(question)), question).toBe(true);
    }
    for (const question of ["¿qué gema de asistencia le pongo a Contagio?", "me falta daño", "¿qué hago ahora?"]) {
      expect(isPassiveTreeQuestion(normalizeQuestion(question)), question).toBe(false);
    }
  });

  it("«notable» y «passive» como palabras corrientes no son preguntas del árbol", () => {
    for (const question of [
      "¿Hay una diferencia notable entre estas dos armas?",
      "no noto una mejora notable con el anillo nuevo",
      "is a passive playstyle like minions good for a beginner?",
      "¿qué hace la pasiva Entradas oscuras?",
    ]) {
      expect(isPassiveTreeQuestion(normalizeQuestion(question)), question).toBe(false);
    }
    for (const question of ["¿qué notable cojo ahora?", "cuál es la siguiente pasiva", "which notable next?", "where do I put my passive points", "qué keystone me conviene"]) {
      expect(isPassiveTreeQuestion(normalizeQuestion(question)), question).toBe(true);
    }
  });

  it("sin árbol, explica cómo meterlo: a mano primero, que un novato no tiene PoB2", () => {
    const answer = answerPassiveTreeQuestion(knowledge, "¿por dónde sigo en el árbol?", profile({ passives: { allocated: [] } }), "es");
    expect(answer).toContain("«Tu árbol de pasivas»");
    expect(answer).toContain("«Marcarlo yo en el árbol»");
    expect(answer).toContain("No hace falta ningún programa");
    expect(answer).toContain("«Pegar mi código de PoB2»");
    const english = answerPassiveTreeQuestion(knowledge, "where do I put my passive points", profile({ passives: { allocated: [] } }), "en");
    expect(english).toContain("“Mark it myself on the tree”");
  });

  it("con pasivas escritas a mano que no son nodos, dice que no las ha leído, no que no hay nada cerca", () => {
    const typed = profile({ passives: { allocated: [{ ref: "Entradas oscuras", isOfficialId: false }, { ref: "vida +10", isOfficialId: false }] } });
    const advice = advisePassiveTree(knowledge, treeRequestFromProfile(typed, "es"));
    expect(advice.unknownCount).toBe(2);
    expect(advice.allocated).toEqual([]);
    // Un código con el inicio de la clase y un nodo que no existe sí se ha leído: no es este caso.
    const partly = profile({ passives: { allocated: [{ ref: classStartFor(buildTreeGraph(tree), "Bruja")!, isOfficialId: false }, { ref: "999999999", isOfficialId: false }] } });
    const read = advisePassiveTree(knowledge, treeRequestFromProfile(partly, "es"));
    expect(read.unknownCount).toBe(1);
    expect(read.allocated.length).toBeGreaterThan(0);
    expect(answerPassiveTreeQuestion(knowledge, "¿por dónde sigo en el árbol?", partly, "es")).not.toMatch(/No he sabido leer/);
    const answer = answerPassiveTreeQuestion(knowledge, "¿por dónde sigo en el árbol?", typed, "es")!;
    expect(answer).toMatch(/No he sabido leer tus pasivas/);
    expect(answer).not.toMatch(/No veo ningún notable/);
    expect(answerPassiveTreeQuestion(knowledge, "which passives should I take next", typed, "en")).toMatch(/couldn't read your passives/);
  });

  it("la ascendencia de un .build oficial (por nombre) cuenta como ascendencia, no como nodo desconocido", () => {
    const graph = buildTreeGraph(tree);
    const read = readAllocated(graph, [keyByName("Dark Entries"), "AscendancyDruid1Notable1", "AscendancyWitch2Start"], "Bruja");
    expect(read.ascendancyCount).toBe(2);
    expect(read.unknown).toEqual([]);
  });

  it("con árbol, da los notables en orden con sus puntos", () => {
    const answer = answerPassiveTreeQuestion(knowledge, "¿por dónde sigo en el árbol?", profile(), "es")!;
    expect(answer).toMatch(/^Por dónde seguir en tu árbol \(para Drenar esencia/);
    expect(answer).toMatch(/\n1\. .+ \(\d+ puntos?\): /);
    expect(answer).toMatch(/Busca aquí/);
  });

  it("no contesta lo que no es del árbol", () => {
    expect(answerPassiveTreeQuestion(knowledge, "me falta daño", profile(), "es")).toBeNull();
  });
});

describe("árbol de pasivas: la memoria no depende de lo que escriba un desconocido", () => {
  it("guarda un grafo por clase reconocida, en español o en inglés", () => {
    expect(graphCacheKey("Bruja")).toBe("Witch");
    expect(graphCacheKey("  witch ")).toBe("Witch");
    expect(graphCacheKey("Cazadora")).toBe("Huntress");
  });

  it("mil clases inventadas comparten el mismo grafo sin clase", () => {
    // La petición es pública y la clase es texto libre de hasta 60 letras:
    // cada texto distinto guardaba para siempre un grafo de 1 MB.
    const keys = new Set(Array.from({ length: 1000 }, (_, index) => graphCacheKey(`clase-inventada-${index}`)));
    expect([...keys]).toEqual([""]);
    expect(graphCacheKey(null)).toBe("");
  });
});
