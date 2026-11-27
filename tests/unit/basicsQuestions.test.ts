import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, RecommendationMemorySchema } from "../../shared/domain.js";
import { classifyMentorQuestion, isItemSwapQuestion, normalizeQuestion } from "../../shared/mentorIntent.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import {
  answerAscendancyQuestion,
  answerBasicsQuestion,
  answerExaltedOrbQuestion,
  answerItemCompareQuestion,
  answerRedRequirementQuestion,
  answerResistanceQuestion,
  answerShieldQuestion,
  answerSpiritQuestion,
  answerSupportSocketQuestion,
  GAME_TEXTS,
  GUIDE_RESISTANCES,
  GUIDE_REWARDS,
  isRedRequirementQuestion,
  isResistanceAmountQuestion,
  isSpiritQuestion,
} from "../../server/mentor/basicsQuestions.js";
import { isSupportGemQuestion, isSupportSocketQuestion } from "../../server/mentor/gemQuestion.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };
const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

const item = (id: string, slot: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  baseType: name,
  slot,
  rarity: "magic",
  ...extra,
});

/** Los dos novatos de la medición (docs/MEDICION-MENTOR-2.md). */
const warrior = CharacterProfileSchema.parse({
  id: "guerrero",
  name: "Mi guerrero",
  characterClass: "Guerrero",
  level: 14,
  levelSource: "observed",
  league: "Runes of Aldur",
  patch: "0.5.5",
  importedAt: "2026-11-24T19:00:00.000Z",
  items: [item("g-arma", "weapon", "Mazo de guerra pesado", { baseType: "Mazo de guerra", itemLevel: 9 })],
  skills: ["Embate rodante", "Terremoto", "Rompearmaduras", "Grito infernal"].map((name, index) => ({
    id: `g${index}`,
    label: "",
    mainSkill: name,
  })),
  attributes: { str: 38, dex: 12, int: 9 },
  resistances: { fire: 15, cold: 0, lightning: 0, chaos: 0 },
});

const ranger = CharacterProfileSchema.parse({
  id: "exploradora",
  name: "Mi exploradora",
  characterClass: "Exploradora",
  level: 22,
  levelSource: "observed",
  league: "Runes of Aldur",
  patch: "0.5.5",
  importedAt: "2026-11-24T19:00:00.000Z",
  items: [
    item("e-arma", "weapon", "Arco corto de caza", { baseType: "Arco corto", itemLevel: 16 }),
    item("e-pecho", "body", "Jubón de cuero", { requirements: { level: 18, str: 30 } }),
  ],
  skills: ["Flecha de rayo", "Pararrayos", "Flecha invocadora de tormentas", "Heraldo de trueno"].map((name, index) => ({
    id: `e${index}`,
    label: "",
    mainSkill: name,
  })),
  attributes: { str: 14, dex: 61, int: 22 },
  resistances: { fire: 20, cold: 5, lightning: 31, chaos: 0 },
});

/** La pregunta de Luis en la web publicada (24-11-2026), con sus erratas. */
const LUIS = "tengo un arma unica pero no se si esta bien de daño me lo cambio por una varita amarilla?";

describe("comparar dos piezas manda al comparador de la web", () => {
  it("reconoce «¿cambio A por B?» y «¿es mejor que el que llevo?»", () => {
    for (const question of [
      LUIS,
      "como se si un arco es mejor que el que llevo?",
      "cambio mi casco por este raro?",
      "cual es mejor de estas dos armas",
      "should I swap my bow for this rare one?",
      "is this wand better than the one I have?",
    ]) {
      expect(isItemSwapQuestion(question), question).toBe(true);
    }
    for (const question of [
      "me falta daño",
      "pego muy poco a los jefes",
      "que pongo, disparo multiple 1 o 2?",
      "me conviene llevar escudo o un mazo a dos manos?",
      "que arma uso",
      "¿por qué muero?",
    ]) {
      expect(isItemSwapQuestion(question), question).toBe(false);
    }
  });

  it("la pregunta real de Luis ya no lleva foco daño", () => {
    expect(classifyMentorQuestion(LUIS).focus).toBeNull();
    // «Me falta daño» lo sigue llevando.
    expect(classifyMentorQuestion("me falta daño").focus).toBe("damage");
  });

  it("contesta con dónde está el comparador, la pieza que lleva y su límite", () => {
    const unique = CharacterProfileSchema.parse({
      ...warrior,
      items: [item("arma", "weapon", "Vara del pecador", { baseType: "Varita de hueso", rarity: "unique", itemLevel: 40 })],
    });
    const answer = answerItemCompareQuestion(LUIS, unique, "es")!;
    expect(answer).toContain("Guías → abre tu acto → «Gemas y piezas» → «¿Cuál de estas dos es mejor?»");
    expect(answer).toContain("Ctrl+Alt+C");
    expect(answer).toContain("Ahora llevas de arma: «Vara del pecador» (Varita de hueso, única, nivel de objeto 40)");
    expect(answer).toContain("Que sea única o amarilla no decide");
    expect(answer).toContain("No calcula el daño por segundo");
    // Nada del consejo de «me falta daño».
    expect(answer).not.toMatch(/no veo una causa clara|resistencias/i);
  });

  it("los nombres que cita existen en la web", () => {
    expect(read("src/components/ItemCompareCard.tsx")).toContain('"¿Cuál de estas dos es mejor?"');
    expect(read("src/components/ItemCompareCard.tsx")).toContain('"Which of these two is better?"');
    expect(read("src/sections/GuidesSection.tsx")).toContain('"Gemas y piezas"');
    expect(read("src/sections/GuidesSection.tsx")).toContain('"Gems and items"');
  });

  it("por el Mentor entero: la pregunta de Luis sale por reglas y sin pasar por «me falta daño»", async () => {
    const answer = await answerMentorQuery(
      {
        question: LUIS,
        profile: warrior,
        budget: null,
        goal: { kind: "balanced" },
        league: warrior.league,
        patch: warrior.patch,
        memory: RecommendationMemorySchema.parse({
          revision: "journal-memory-v1:0000000000000000",
          primaryEntry: null,
          recentCompleted: [],
        }),
        lang: "es",
      },
      { gems },
    );
    expect(answer.responseMode).toBe("rules");
    expect(answer.unsupported).toBeNull();
    expect(answer.answer).toContain("«¿Cuál de estas dos es mejor?»");
    expect(answer.answer).not.toContain("Mejorar el arma");
  });

  it("no es una pregunta de comparar: null", () => {
    expect(answerItemCompareQuestion("me falta daño", warrior, "es")).toBeNull();
  });
});

describe("cuánta resistencia necesito", () => {
  it("reconoce la pregunta y deja en paz «me faltan resistencias»", () => {
    expect(isResistanceAmountQuestion(normalizeQuestion("cuanta resistencia necesito?"))).toBe(true);
    expect(isResistanceAmountQuestion(normalizeQuestion("cual es el tope de resistencias"))).toBe(true);
    expect(isResistanceAmountQuestion(normalizeQuestion("how much resistance do I need?"))).toBe(true);
    expect(isResistanceAmountQuestion(normalizeQuestion("que mejoro primero"))).toBe(false);
  });

  it("da la cifra de las guías, lo que quita cada acto y lo que tiene el personaje", () => {
    const answer = answerResistanceQuestion("cuanta resistencia necesito?", warrior, "es")!;
    expect(answer).toContain("Apunta a un 30 %");
    expect(answer).toContain("no una cifra oficial");
    expect(answer).toContain("El tope normal es un 75 %");
    expect(answer).toContain("acto 2 −10 %, acto 3 −20 %, acto 4 −30 %, interludios −40 % a −50 %, mapas −60 %");
    expect(answer).toContain("fuego 15 %, hielo 0 %, rayo 0 %");
    expect(answer).toContain("Por debajo del 30 %: fuego, hielo, rayo");
    expect(answerResistanceQuestion("cuanta resistencia necesito?", ranger, "es")).toContain("Por debajo del 30 %: fuego, hielo.");
  });

  it("las cifras son las de la guía del acto 1, no otras", () => {
    const guide = read("src/guides/actOne.ts");
    expect(guide).toContain(`title: "${GUIDE_RESISTANCES.guideEs}"`);
    expect(guide).toContain('title: "Resistencias"');
    for (const [act, penalty] of [
      ["Acto 2", "−10 %"],
      ["Acto 3", "−20 %"],
      ["Acto 4", "−30 %"],
      ["Interludios", "−40 % a −50 %"],
      ["Mapas", "−60 %"],
    ]) {
      expect(guide).toContain(`{ title: "${act}", text: "${penalty}" }`);
    }
    expect(GUIDE_RESISTANCES.penalties.map((entry) => entry.value)).toEqual(["−10 %", "−20 %", "−30 %", "−40 % a −50 %", "−60 %"]);
    expect(guide).toContain("Apunta a un 30 % en las tres.");
    expect(guide).toContain(`El tope normal es un ${GUIDE_RESISTANCES.cap} %`);
    expect(read("src/guides/actOneEn.ts")).toContain(`title: "${GUIDE_RESISTANCES.guideEn}"`);
  });
});

describe("una gema que sale en rojo", () => {
  it("reconoce la pregunta", () => {
    expect(isRedRequirementQuestion(normalizeQuestion("no puedo ponerme una gema, me sale en rojo"))).toBe(true);
    expect(isRedRequirementQuestion(normalizeQuestion("the gem shows in red"))).toBe(true);
    expect(isRedRequirementQuestion(normalizeQuestion("que gema roja me pongo"))).toBe(false);
  });

  it("dice qué significa, de qué color es cada atributo y cuál lleva más bajo", () => {
    const answer = answerRedRequirementQuestion(gems, "no puedo ponerme una gema, me sale en rojo", ranger, "es")!;
    expect(answer).toContain("un nivel o un atributo");
    expect(answer).toContain("roja, fuerza; verde, destreza; azul, inteligencia");
    expect(answer).toContain("fuerza 14 · destreza 61 · inteligencia 22");
    expect(answer).toContain("Tu atributo más bajo es fuerza");
    // La pieza que pide más fuerza de la que tiene, con sus cifras.
    expect(answer).toContain("Jubón de cuero pide 30 de fuerza (tienes 14)");
    // Lo que no está en los datos se dice.
    expect(answer).toContain("no lo tengo en mis datos");
  });

  it("si nombra la gema, dice de qué atributo es", () => {
    const answer = answerRedRequirementQuestion(gems, "no puedo ponerme Embate rodante, me sale en rojo la gema", ranger, "es")!;
    expect(answer).toContain("Embate rodante es una gema roja: pide fuerza");
  });
});

describe("huecos para gemas de asistencia", () => {
  const question = "como consigo mas huecos para gemas de asistencia?";

  it("no se confunde con «qué asistencia pongo»", () => {
    expect(isSupportSocketQuestion(normalizeQuestion(question))).toBe(true);
    expect(isSupportGemQuestion(normalizeQuestion(question))).toBe(false);
    expect(isSupportSocketQuestion(normalizeQuestion("que gema de asistencia le pongo a embate rodante?"))).toBe(false);
  });

  it("cita los tres orbes de joyero con el texto del juego y lo que no sabe", () => {
    const answer = answerSupportSocketQuestion(question, ranger, "es")!;
    for (const orb of GAME_TEXTS.jewellers) {
      expect(answer).toContain(`${orb.nameEs}: «${orb.es}»`);
    }
    expect(answer).toContain("nivel de caída 25, 45, 65");
    expect(answer).toContain("Eres nivel 22: es normal que aún no tengas ninguno");
    expect(answer).toContain("no lo tengo en mis datos");
    expect(answer).toContain("poe2db");
    expect(answerSupportSocketQuestion(question, { ...ranger, level: 30 }, "es")).toContain("ya puede caerte el orbe de joyero menor");
  });

  it("en inglés, con el texto inglés del juego", () => {
    const answer = answerSupportSocketQuestion("how do I get more support gem sockets?", ranger, "en")!;
    expect(answer).toContain("Lesser Jeweller's Orb: “Sets a Skill Gem to have 3 Support Gem Sockets”");
    expect(answer).not.toMatch(/engarces|joyero/);
  });
});

describe("qué es el espíritu", () => {
  it("reconoce la pregunta y no pisa la de la gema de espíritu sin tallar", () => {
    expect(isSpiritQuestion(normalizeQuestion("que es el espiritu y para que sirve?"))).toBe(true);
    expect(isSpiritQuestion(normalizeQuestion("como consigo mas espiritu"))).toBe(true);
    expect(isSpiritQuestion(normalizeQuestion("tengo una gema de espiritu sin tallar, que me pongo?"))).toBe(false);
  });

  it("cita el texto del juego, lo que reservan sus gemas y dónde se consigue según las guías", () => {
    const answer = answerSpiritQuestion(gems, "que es el espiritu y para que sirve?", ranger, "es")!;
    expect(answer).toContain(`«${GAME_TEXTS.spirit.es}»`);
    expect(answer).toContain("Heraldo de trueno (reserva 30 espíritu)");
    expect(answer).toContain("El rey de las nieblas da +30 de espíritu para siempre (acto 1)");
    expect(answer).toContain("cetros");
    expect(answerSpiritQuestion(gems, "que es el espiritu?", warrior, "es")).toContain("Ninguna de tus habilidades reserva espíritu");
  });

  it("lo que dice de las guías está en las guías", () => {
    expect(read("src/guides/actOne.ts")).toContain(GUIDE_REWARDS.spirit[0].es);
    expect(read("src/guides/actOneEn.ts")).toContain(GUIDE_REWARDS.spirit[0].en);
    expect(read("src/guides/actThree.ts")).toContain(GUIDE_REWARDS.spirit[1].es);
    expect(read("src/guides/actTwo.ts")).toContain(GUIDE_REWARDS.ascendancy.es);
    expect(read("src/guides/actTwoEn.ts")).toContain(GUIDE_REWARDS.ascendancy.en);
    expect(read("src/guides/actThree.ts")).toContain("Prueba de Caos (puntos de ascendencia 3 y 4)");
  });
});

describe("qué ascendencia me cojo", () => {
  it("lista las de su clase, dónde se consigue y no elige por él", () => {
    const answer = answerAscendancyQuestion(gems, "que ascendencia me cojo?", warrior, "es")!;
    expect(answer).toContain("Como Guerrero eliges entre: Titán, Adalid de guerra, Herrero de Kitava");
    expect(answer).toContain("Prueba de las sekhemas (acto 2)");
    expect(answer).toContain("Prueba de Caos (acto 3) da los puntos de ascendencia 3 y 4");
    expect(answer).toContain("Cuál es la mejor no lo decido yo");
    // Lleva embates: la que más los nombra en sus nodos oficiales va la primera.
    const first = answer.split("\n").find((line) => line.startsWith("• "))!;
    expect(first).toContain("Titán");
    expect(first).toContain("hablan de embates");
  });

  it("sin clase conocida lo dice", () => {
    const answer = answerAscendancyQuestion(gems, "que ascendencia me cojo?", { ...warrior, characterClass: "Desconocida" }, "es")!;
    expect(answer).toContain("No sé tu clase");
  });
});

describe("para qué sirve un orbe exaltado", () => {
  it("cita el juego y mira si el personaje tiene dónde gastarlo", () => {
    const answer = answerExaltedOrbQuestion("para que sirven los orbes exaltados? los gasto ya?", ranger, "es")!;
    expect(answer).toContain(`«${GAME_TEXTS.exalted.es}»`);
    expect(answer).toContain(`«${GAME_TEXTS.exalted.limitEs}»`);
    expect(answer).toContain("No veo ninguna pieza rara en tu personaje");
    expect(answer).toContain("aquí no tengo precios");
    const withRare = CharacterProfileSchema.parse({
      ...ranger,
      items: [item("anillo", "ring1", "Anillo del lobo", { rarity: "rare", modifiers: [{ id: "m1", text: "+20 de vida máxima" }] })],
    });
    expect(answerExaltedOrbQuestion("para que sirve un orbe exaltado", withRare, "es")).toContain("Anillo del lobo (1 modificadores)");
  });

  it("dice lo mismo que la ficha del taller de crafteo", () => {
    const actions = read("shared/craftingActions.ts");
    expect(actions).toContain('label: "Orbe exaltado"');
    expect(actions).toContain("observedTotalLimit: 6");
    expect(GAME_TEXTS.exalted.maxModifiers).toBe(6);
  });
});

describe("escudo o arma a dos manos", () => {
  it("dice lo que se ve en sus habilidades y lo que no sabe", () => {
    const answer = answerShieldQuestion(gems, "me conviene llevar escudo o un mazo a dos manos?", warrior, "es")!;
    expect(answer).toContain("Ninguna de tus 4 habilidades");
    expect(answer).toContain("Con escudo podrías tallar además:");
    expect(answer).toContain("Escudo resonante");
    expect(answer).toContain("esas cifras no las tengo");
  });
});

describe("las reglas de lo básico no pisan otras preguntas", () => {
  it("devuelven null en las preguntas de siempre", () => {
    for (const question of [
      "¿Qué mejoro ahora?",
      "¿por qué muero?",
      "me falta daño",
      "que gema de asistencia le pongo a embate rodante?",
      "tengo una gema sin tallar de nivel 5, cual cojo?",
      "que subo, fuerza o destreza?",
      "hola",
    ]) {
      expect(answerBasicsQuestion(gems, question, warrior, "es"), question).toBeNull();
      expect(answerItemCompareQuestion(question, warrior, "es"), question).toBeNull();
    }
  });

  it("«asistencia» a secas ya se entiende, y «necesito asistencia» no", () => {
    expect(isSupportGemQuestion(normalizeQuestion("hay alguna asistencia para que flecha de rayo dispare mas flechas?"))).toBe(true);
    expect(isSupportGemQuestion(normalizeQuestion("que asistencia le pongo a contagio"))).toBe(true);
    expect(isSupportGemQuestion(normalizeQuestion("necesito asistencia"))).toBe(false);
  });
});
