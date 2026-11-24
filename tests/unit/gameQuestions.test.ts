import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, RecommendationMemorySchema } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import { MentorAnswerSchema } from "../../shared/mentorQuery.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import {
  EXTRA_CURSE_PASSIVE_TEXT,
  answerAttributeQuestion,
  answerCurseQuestion,
  answerDamageQuestion,
  answerMinionQuestion,
  answerSkillChoiceQuestion,
  answerSupportCompareQuestion,
  isAttributeQuestion,
  isCurseQuestion,
  isMinionQuestion,
  isSkillChoiceQuestion,
} from "../../server/mentor/gameQuestions.js";
import { answerSupportGemQuestion } from "../../server/mentor/gemQuestion.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };

interface Setup {
  name: string;
  supports?: string[];
  level?: number;
}

/** Una bruja de caos con esbirros, como la del caso real del que salieron estas preguntas. */
function witch(
  setups: Setup[] = [
    { name: "Descarga de caos" },
    { name: "Drenar esencia", supports: ["Encadenamiento II"] },
    { name: "Contagio" },
    { name: "Guerrero esqueleto" },
    { name: "Blasfemia", supports: ["Desesperación"] },
  ],
  extra: Record<string, unknown> = {},
) {
  return CharacterProfileSchema.parse({
    id: "bruja",
    name: "Bruja de prueba",
    characterClass: "Bruja",
    ascendancy: "Liche",
    level: 44,
    levelSource: "observed",
    league: "Forbidden Rites",
    patch: "0.5.5",
    importedAt: "2026-11-24T00:00:00.000Z",
    skills: setups.map((setup, index) => ({
      id: `s${index}`,
      label: setup.name,
      mainSkill: setup.name,
      supports: (setup.supports ?? []).map((name) => ({ name, gemId: null })),
      ...(setup.level !== undefined ? { level: setup.level } : {}),
    })),
    ...extra,
  });
}

const bullets = (answer: string | null) =>
  (answer ?? "").split("\n").filter((line) => line.startsWith("• ")).map((line) => /• ([^(]+) \(/.exec(line)?.[1]?.trim() ?? line);
const skillByName = (name: string) => gems.data.skills.find((skill) => skill.name === name)!;

// Las preguntas, tal como las escribió un jugador de verdad mientras jugaba (con sus erratas).
const REAL = {
  skill: "tengo una gema de nivel 7 que hechizo escojo?",
  chain: "que pongo encadenamiento 1 o 2?",
  curse: "en blasfemia solo tengo desesperacion pongo algo mas?",
  minion: "hay algun esbirro que ataque con caos del acto 1 ?",
  versus: "que es mejor el esbirro o la sucubo?",
  attributes: "y en atributos que subo?",
};

describe("qué habilidad tallar con una gema sin tallar", () => {
  it("reconoce la pregunta y deja en paz las demás", () => {
    expect(isSkillChoiceQuestion(normalizeQuestion(REAL.skill))).toBe(true);
    expect(isSkillChoiceQuestion(normalizeQuestion("I have a level 9 uncut skill gem, which spell do I pick?"))).toBe(true);
    for (const other of ["¿Qué mejoro ahora?", "qué gema subo de nivel", "¿Qué gema de asistencia le pongo a Contagio?", "soy nivel 7 qué hago", REAL.chain]) {
      expect(isSkillChoiceQuestion(normalizeQuestion(other)), other).toBe(false);
    }
  });

  it("el caso real: hechizos de nivel de gema 7 o menos que encajan con una bruja de caos", () => {
    const answer = answerSkillChoiceQuestion(gems, REAL.skill, witch(), "es");
    expect(answer).toContain("gema de habilidad sin tallar de nivel 7");
    const names = bullets(answer);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThanOrEqual(4);
    for (const name of names) {
      const skill = skillByName(name);
      // Pidió un hechizo, de nivel 7 o menos, que se talle (no de ascendencia) y que no tenga ya.
      expect(skill.tags, name).toContain("Hechizo");
      expect(skill.grade!, name).toBeLessThanOrEqual(7);
      expect(skill.attribute, name).not.toBeNull();
      expect(["Descarga de caos", "Drenar esencia", "Contagio"]).not.toContain(name);
      // Ya lleva una maldición: otra no es el «hechizo nuevo» que busca.
      expect(skill.tags, name).not.toContain("Maldición");
      expect(skill.tags, name).not.toContain("Persistente");
    }
    // Lo suyo es el caos: lo primero que se le propone es de caos.
    expect(skillByName(names[0]!).tags).toContain("Caos");
    // No sabe a qué nivel lleva sus gemas: lo ofrece solo «si está por debajo».
    expect(answer).toContain("subir a nivel 7 una habilidad que ya tienes, si está por debajo");
    expect(answer).toContain("sin IA");
  });

  it("solo propone lo que sale al tallar, con el arma que ya usa (medición del 24-11-2026)", () => {
    const warrior = witch(
      [
        { name: "Embate rodante", level: 5 },
        { name: "Terremoto", level: 3 },
        { name: "Rompearmaduras", level: 3 },
        { name: "Grito infernal", level: 3 },
      ],
      {
        characterClass: "Guerrero",
        ascendancy: null,
        items: [{ id: "arma", name: "Mazo de guerra pesado", baseType: "Mazo de guerra", slot: "weapon", rarity: "magic" }],
      },
    );
    const answer = answerSkillChoiceQuestion(gems, "tengo una gema sin tallar de nivel 5, cual cojo?", warrior, "es");
    const names = bullets(answer);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      // Todas de maza: ni de lanza (Asalto rápido) ni de escudo (lleva un arma a dos manos).
      expect(skillByName(name).cutGroups, name).toContain("Maza");
    }
    expect(names).not.toContain("Asalto rápido");
    expect(names).not.toContain("Escudo resonante");
    // Embate rodante ya está a nivel 5: no se propone subirla; las que van a 3, sí.
    expect(answer).toContain("Terremoto (ahora nivel 3)");
    expect(answer).not.toContain("Embate rodante (ahora");
  });

  it("«qué me pongo» con una gema de espíritu sin tallar: solo gemas de espíritu, las más bajas", () => {
    const question = "tengo una gema de espiritu sin tallar, que me pongo?";
    expect(isSkillChoiceQuestion(normalizeQuestion(question))).toBe(true);
    const ranger = witch([{ name: "Flecha de rayo" }, { name: "Pararrayos" }, { name: "Heraldo de trueno" }], {
      characterClass: "Exploradora",
      ascendancy: null,
    });
    const answer = answerSkillChoiceQuestion(gems, question, ranger, "es");
    const names = bullets(answer);
    expect(names.length).toBeGreaterThan(0);
    const lowest = Math.min(...gems.data.skills.filter((skill) => skill.cutGroups?.includes("Espíritu")).map((skill) => skill.grade ?? 99));
    for (const name of names) {
      expect(skillByName(name).cutGroups, name).toContain("Espíritu");
      expect(skillByName(name).grade, name).toBe(lowest);
      expect(name).not.toBe("Heraldo de trueno");
    }
    // Las gemas de espíritu empiezan en nivel 4 (Heraldo de hielo incluida): lo dice su lista en poe2db.
    expect(lowest).toBe(4);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(answer).toContain("No me dices de qué nivel es");
  });

  it("a quien no usa ataques no le propone ataques de arma, salvo que los pida", () => {
    for (const name of bullets(answerSkillChoiceQuestion(gems, "tengo una gema de nivel 13 que habilidad escojo?", witch(), "es"))) {
      expect(skillByName(name).tags, name).not.toContain("Ataque");
    }
  });

  it("sin el nivel de la gema, lo dice y enseña las más bajas en vez de callarse", () => {
    const answer = answerSkillChoiceQuestion(gems, "tengo una gema sin tallar, qué hechizo escojo?", witch(), "es");
    expect(answer).toContain("No me dices de qué nivel es tu gema de habilidad sin tallar");
    expect(bullets(answer).length).toBeGreaterThan(0);
    for (const name of bullets(answer)) expect(skillByName(name).grade, name).toBeLessThanOrEqual(3);
  });

  it("sin saber qué lleva, lo dice en vez de fingir que encaja", () => {
    const answer = answerSkillChoiceQuestion(gems, REAL.skill, witch([]), "es");
    expect(answer).toContain("Aún no sé qué habilidades llevas");
    expect(answer).not.toContain("encajan con lo que ya llevas");
  });

  it("en inglés, con los nombres en inglés", () => {
    const answer = answerSkillChoiceQuestion(gems, "I have a level 7 uncut skill gem, which spell do I pick?", witch(), "en");
    expect(answer).toContain("level 7 uncut skill gem");
    expect(answer).toContain("no AI");
    expect(answer).not.toMatch(/nivel de gema|hechizo|habilidad/);
  });
});

describe("la misma asistencia en dos grados", () => {
  it("el caso real: Encadenamiento I o II, con lo que da y lo que quita cada una", () => {
    const answer = answerSupportCompareQuestion(gems, REAL.chain, witch(), "es");
    expect(bullets(answer)).toEqual(["Encadenamiento I", "Encadenamiento II"]);
    expect(answer).toContain("se encadenan +1 veces");
    expect(answer).toContain("se encadenan +2 veces");
    expect(answer).toContain("30% menos de daño");
    expect(answer).toContain("50% menos de daño");
    // La II hace más y penaliza más: se dice con sus propias líneas.
    expect(answer).toContain("Encadenamiento II cambia el efecto");
    expect(answer).toContain("pero penaliza más: «infligen un 50% menos de daño con impactos» en vez de «infligen un 30% menos de daño con impactos»");
    expect(answer).toContain("Ahora mismo llevas puesta Encadenamiento II");
  });

  it("el veredicto sale de los datos: Disparo múltiple II penaliza MENOS que la I (medición del 24-11-2026)", () => {
    const answer = answerSupportCompareQuestion(gems, "que pongo, disparo multiple 1 o 2?", witch(), "es");
    expect(bullets(answer)).toEqual(["Disparo múltiple I", "Disparo múltiple II"]);
    expect(answer).toContain("Disparo múltiple II hace lo mismo y penaliza menos");
    expect(answer).toContain("«infligen un 25% menos de daño» en vez de «infligen un 35% menos de daño»");
    expect(answer).toContain("pon Disparo múltiple II");
    expect(answer).not.toContain("penaliza más");
    expect(answer).not.toContain("su penalización también es mayor");
  });

  it("nunca concluye lo contrario de lo que dicen las cifras, en ninguna asistencia con grados", () => {
    const families = new Map<string, string[]>();
    for (const support of gems.data.supports) {
      const base = support.name.replace(/\s+[IVX]+$/, "");
      if (base !== support.name) families.set(base, [...(families.get(base) ?? []), support.name]);
    }
    let checked = 0;
    for (const [base, names] of families) {
      if (names.length < 2 || normalizeQuestion(base).length < 5) continue;
      const answer = answerSupportCompareQuestion(gems, `${base} 1 o 2?`, witch(), "es");
      if (!answer) continue;
      checked += 1;
      // Si dice «penaliza menos», la línea citada de la más alta lleva una cifra menor; y al revés.
      for (const match of answer.matchAll(/penaliza (menos|más): «([^»]+)» en vez de «([^»]+)»/g)) {
        const total = (text: string) => [...text.matchAll(/\d+(?:[.,]\d+)?/g)].reduce((sum, hit) => sum + Number(hit[0].replace(",", ".")), 0);
        const [, direction, after, before] = match;
        if (direction === "menos") expect(total(after!), `${base}: ${match[0]}`).toBeLessThan(total(before!));
        else expect(total(after!), `${base}: ${match[0]}`).toBeGreaterThan(total(before!));
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("sin decir grados, enseña todos los de esa asistencia", () => {
    const answer = answerSupportCompareQuestion(gems, "que hace encadenamiento?", witch(), "es");
    expect(bullets(answer).length).toBeGreaterThanOrEqual(3);
  });

  it("en inglés", () => {
    const answer = answerSupportCompareQuestion(gems, "chain 1 or 2?", witch(), "en");
    expect(bullets(answer)).toEqual(["Chain I", "Chain II"]);
    expect(answer).toContain("Chain II changes the effect");
    expect(answer).toContain("but its penalty is bigger");
  });

  it("no se mete en preguntas que no nombran una asistencia", () => {
    for (const other of ["¿Qué mejoro ahora?", "hola", "me falta daño", REAL.skill, REAL.attributes]) {
      expect(answerSupportCompareQuestion(gems, other, witch(), "es"), other).toBeNull();
    }
  });
});

describe("maldiciones", () => {
  it("reconoce la pregunta", () => {
    expect(isCurseQuestion(gems, normalizeQuestion(REAL.curse))).toBe(true);
    expect(isCurseQuestion(gems, normalizeQuestion("should I add another curse?"))).toBe(true);
    expect(isCurseQuestion(gems, normalizeQuestion("¿Qué mejoro ahora?"))).toBe(false);
  });

  it("el caso real: qué lleva, qué más hay y lo que cuesta añadir otra en Blasfemia", () => {
    const answer = answerCurseQuestion(gems, REAL.curse, witch(), "es")!;
    expect(answer).toContain("Llevas: Desesperación (y Blasfemia).");
    const others = bullets(answer);
    expect(others).not.toContain("Desesperación");
    expect(others).toEqual(expect.arrayContaining(["Debilitar", "Vulnerabilidad", "Cadenas temporales", "Debilidad elemental"]));
    // El precio se cita de la propia gema, no se resume de memoria.
    expect(answer).toContain("«Reserva 60 de espíritu por cada maldición engarzada»");
    expect(answer).toContain(`«${EXTRA_CURSE_PASSIVE_TEXT}»`);
  });

  it("la frase del límite de maldiciones sigue estando en el árbol oficial", () => {
    // Si un parche quita esa pasiva, este test avisa: la respuesta la cita como prueba.
    const tree = readFileSync(new URL("../../server/data/passives/tree.json", import.meta.url), "utf8");
    expect(tree).toContain(EXTRA_CURSE_PASSIVE_TEXT);
  });

  it("sin maldiciones en el personaje, lo dice", () => {
    expect(answerCurseQuestion(gems, "qué maldición me pongo?", witch([{ name: "Descarga de caos" }]), "es")).toContain(
      "No veo ninguna maldición en tu personaje.",
    );
  });
});

describe("esbirros", () => {
  it("reconoce la pregunta", () => {
    expect(isMinionQuestion(normalizeQuestion(REAL.minion))).toBe(true);
    expect(isMinionQuestion(normalizeQuestion(REAL.versus))).toBe(true);
    expect(isMinionQuestion(normalizeQuestion("¿Qué gema de asistencia le pongo a mis esbirros?"))).toBe(false);
    expect(isMinionQuestion(normalizeQuestion("¿Qué mejoro ahora?"))).toBe(false);
  });

  it("el caso real: gemas de esbirro con daño de caos, y lo que la web no sabe", () => {
    const answer = answerMinionQuestion(gems, REAL.minion, witch(), "es")!;
    expect(answer).toContain("Gemas de esbirro con daño de caos:");
    for (const name of bullets(answer)) {
      const skill = skillByName(name);
      expect(skill.tags, name).toContain("Esbirro");
      expect(
        skill.tags.includes("Caos") || [skill.description, ...skill.effects].some((text) => /daño de caos/i.test(text)),
        name,
      ).toBe(true);
    }
    expect(answer).toContain("Tus habilidades de esbirro ahora: Guerrero esqueleto.");
    // De espectros y bestias no hay datos: se dice, no se inventa cuál sale en el acto 1.
    expect(answer).toContain("Lo que no tengo es la lista de monstruos");
    expect(answer).not.toMatch(/acto 1/i);
  });

  it("comparar dos que no conoce: lo admite", () => {
    const answer = answerMinionQuestion(gems, REAL.versus, witch(), "es")!;
    expect(answer).toContain("No puedo comparar esos dos con los datos que tengo");
    expect(bullets(answer)).toEqual([]);
  });
});

describe("atributos", () => {
  it("reconoce la pregunta", () => {
    expect(isAttributeQuestion(normalizeQuestion(REAL.attributes))).toBe(true);
    expect(isAttributeQuestion(normalizeQuestion("subo fuerza o inteligencia?"))).toBe(true);
    expect(isAttributeQuestion(normalizeQuestion("me falta fuerza"))).toBe(false);
  });

  it("el caso real: lo que tiene, de qué color son sus gemas y la regla", () => {
    const profile = witch(undefined, { attributes: { str: 7, dex: 25, int: 131 } });
    const answer = answerAttributeQuestion(gems, REAL.attributes, profile, "es")!;
    expect(answer).toContain("Tienes fuerza 7 · destreza 25 · inteligencia 131.");
    expect(answer).toMatch(/Tus gemas: \d+ de inteligencia/);
    expect(answer).toContain("el atributo de la mayoría de tus gemas: inteligencia");
  });

  it("si una pieza pide más de lo que tiene, eso va primero", () => {
    const profile = witch(undefined, {
      attributes: { str: 7, dex: 25, int: 131 },
      items: [
        {
          id: "casco",
          name: "Yelmo de hierro",
          baseType: "Yelmo",
          slot: "helmet",
          rarity: "rare",
          requirements: { level: 30, str: 40 },
          modifiers: [],
          sources: [],
        },
      ],
    });
    const answer = answerAttributeQuestion(gems, REAL.attributes, profile, "es")!;
    expect(answer).toContain("No cumples: Yelmo de hierro pide 40 de fuerza (tienes 7).");
    expect(answer).toContain("Sube eso primero");
  });

  it("sin habilidades ni atributos no afirma nada del personaje", () => {
    const answer = answerAttributeQuestion(gems, REAL.attributes, witch([]), "es")!;
    expect(answer).not.toContain("Tienes ");
    expect(answer).toContain("Aún no sé qué habilidades llevas");
  });
});

describe("«me falta daño» con la revisión rápida", () => {
  it("la gema principal atrasada es lo primero", () => {
    const answer = answerDamageQuestion(gems, witch([{ name: "Descarga de caos", level: 3 }, { name: "Desesperación" }]), "es")!;
    expect(answer).toContain("Lo que más te frena el daño");
    expect(answer).toMatch(/1\. Tu gema principal está a nivel 3 y puedes llevarla a \d+/);
  });

  it("Contagio sin Drenar esencia y Liche sin maldición", () => {
    const answer = answerDamageQuestion(gems, witch([{ name: "Contagio" }, { name: "Guerrero esqueleto" }]), "es")!;
    expect(answer).toContain("Contagio solo reparte el daño");
    expect(answer).toContain("Tu ascendencia Liche no hace nada sin una maldición");
    // No sabe el nivel de la gema: lo dice en vez de callarlo.
    expect(answer).toContain("No sé el nivel de tu gema principal");
  });

  it("si no ve nada de daño, no contesta: sigue el motor de siempre", () => {
    expect(answerDamageQuestion(gems, witch(), "es")).toBeNull();
    expect(answerDamageQuestion(gems, witch([]), "es")).toBeNull();
  });
});

describe("el Mentor completo contesta estas dudas sin IA", () => {
  const memory = RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:0000000000000000",
    primaryEntry: null,
    recentCompleted: [],
  });
  const query = (question: string, intentHint?: "next_improvement") => ({
    question,
    ...(intentHint ? { intentHint } : {}),
    profile: witch(),
    budget: null,
    goal: { kind: "damage" as const },
    league: "Forbidden Rites",
    patch: "0.5.5",
    memory,
  });

  it("las seis preguntas reales reciben respuesta de reglas, cada una la suya", async () => {
    const expected: Array<[string, string]> = [
      [REAL.skill, "gema de habilidad sin tallar de nivel 7"],
      [REAL.chain, "Encadenamiento, por grados:"],
      [REAL.curse, "Llevas: Desesperación"],
      [REAL.minion, "Gemas de esbirro con daño de caos:"],
      [REAL.versus, "No puedo comparar esos dos"],
      [REAL.attributes, "Regla: primero lo que te falte"],
    ];
    for (const [question, fragment] of expected) {
      const answer = await answerMentorQuery(query(question), { gems });
      expect(MentorAnswerSchema.safeParse(answer).success, question).toBe(true);
      expect(answer.answer, question).toContain(fragment);
      expect(answer.responseMode, question).toBe("rules");
      expect(answer.unsupported, question).toBeNull();
    }
  });

  it("las preguntas de gemas de asistencia de siempre siguen yendo a su consejero", async () => {
    const answer = await answerMentorQuery(query("¿Qué gema de asistencia le pongo a Contagio?"), { gems });
    expect(answer.answer).toContain("Para Contagio, las asistencias que mejor le van son:");
  });

  it("«mi primera gema de asistencia» (aunque lo escriba mal) solo propone las de grado I", () => {
    const answer = answerSupportGemQuestion(gems, "tengo mi primega gema de asistencia donde la pongo?", witch(), "es")!;
    expect(answer).toContain("grado I,");
    expect(answer).not.toMatch(/grado (II|III|IV|V),/);
  });

  it("un botón de la web (intención fijada) no se toma por una duda del juego", async () => {
    const answer = await answerMentorQuery(query(REAL.attributes, "next_improvement"), { gems });
    expect(answer.answer).not.toContain("Regla: primero lo que te falte");
  });

  it("«me falta daño» sin nada de daño que corregir: lo dice y señala lo que sí ve, sin pasar por la IA", async () => {
    const profile = witch(
      [
        { name: "Descarga de caos", supports: ["Lanzamiento rápido I", "Destrucción controlada", "Maestría de caos"] },
        { name: "Drenar esencia" },
        { name: "Desesperación" },
      ],
      {
        life: 833,
        attributes: { str: 7, dex: 25, int: 131 },
        resistances: { fire: 17, cold: -42, lightning: 9, chaos: 9 },
        items: [
          { id: "arma", name: "La pluma perversa", baseType: "Varita", slot: "weapon", rarity: "unique", itemLevel: 70, requirements: { level: 15 }, modifiers: [], sources: [] },
          { id: "casco", name: "Rostro de horror", baseType: "Casco", slot: "helmet", rarity: "rare", itemLevel: 45, requirements: { level: 40 }, modifiers: [], sources: [] },
        ],
      },
    );
    let asked = 0;
    const answer = await answerMentorQuery(
      { ...query("siento que me falta daño"), profile },
      {
        gems,
        selector: {
          name: "no-debe-usarse",
          select: async () => {
            asked += 1;
            throw new Error("la IA no tiene de dónde sacar una respuesta de daño");
          },
        },
      },
    );
    expect(asked).toBe(0);
    expect(answer.intent).toBe("explain_priority");
    expect(answer.responseMode).toBe("rules");
    expect(answer.answer).toContain("no veo una causa clara");
    // No se calla lo que sí ve, aunque sea de aguante.
    expect(answer.answer).toContain("No es de daño, pero sí veo otra cosa que te hace morir antes: «");
    expect(answer.usedRecommendationIds).toHaveLength(1);
  });

  it("sin los datos de gemas dice que no sabe, y qué sí sabe contestar", async () => {
    const answer = await answerMentorQuery(query(REAL.versus), {});
    expect(answer.unsupported).not.toBeNull();
    expect(answer.answer).toContain("no me lo voy a inventar");
    expect(answer.answer).toContain("qué habilidad tallar con una gema sin tallar");
  });
});
