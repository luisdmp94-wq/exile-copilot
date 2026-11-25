import { describe, expect, it, vi } from "vitest";
import { CharacterProfileSchema, RecommendationMemorySchema } from "../../shared/domain.js";
import { classifyMentorQuestion } from "../../shared/mentorIntent.js";
import { loadConfig } from "../../server/config.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { loadPassiveTree } from "../../server/advice/passiveTreeAdvisor.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { MentorAiError, ResponsesMentorSelector, type MentorDecisionSelector } from "../../server/mentor/mentorAi.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import {
  ROUTE_TOPICS,
  routedQuestion,
  understoodLine,
  type MentorRouteDecision,
  type MentorRouteInput,
  type RouteTopic,
} from "../../server/mentor/questionRouter.js";

/**
 * Paso 1 de la tarea 12: la IA dice de qué tema es la pregunta y contesta la
 * regla de ese tema. Aquí la IA es de mentira: lo que se comprueba es que su
 * decisión nunca pone datos, solo elige qué regla contesta.
 */

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };
const tree = { tree: loadPassiveTree(), gems: gems.data, locale: gems.locale };

const warrior = CharacterProfileSchema.parse({
  id: "guerrero",
  name: "Mi guerrero",
  characterClass: "Guerrero",
  level: 14,
  levelSource: "observed",
  league: "Runes of Aldur",
  patch: "0.5.5",
  importedAt: "2026-11-24T19:00:00.000Z",
  items: [{ id: "g-arma", name: "Mazo de guerra pesado", baseType: "Mazo de guerra", slot: "weapon", rarity: "magic", itemLevel: 9 }],
  skills: ["Embate rodante", "Terremoto", "Rompearmaduras", "Grito infernal"].map((name, index) => ({
    id: `g${index}`,
    label: "",
    mainSkill: name,
  })),
  attributes: { str: 38, dex: 12, int: 9 },
  resistances: { fire: 15, cold: 0, lightning: 0, chaos: 0 },
});

const memory = RecommendationMemorySchema.parse({
  revision: "journal-memory-v1:0000000000000000",
  primaryEntry: null,
  recentCompleted: [],
});

const decision = (topic: RouteTopic, extra: Partial<MentorRouteDecision> = {}): MentorRouteDecision => ({
  topic,
  skill: null,
  support: null,
  wish: null,
  ...extra,
});

function selector(route: NonNullable<MentorDecisionSelector["route"]>): MentorDecisionSelector & {
  select: ReturnType<typeof vi.fn<MentorDecisionSelector["select"]>>;
} {
  return { name: "modelo-prueba", select: vi.fn<MentorDecisionSelector["select"]>(), route };
}

function ask(question: string, fake: MentorDecisionSelector | null, extra: Record<string, unknown> = {}) {
  return answerMentorQuery(
    {
      question,
      profile: warrior,
      budget: null,
      goal: { kind: "balanced" },
      league: warrior.league,
      patch: warrior.patch,
      memory,
      lang: "es",
      // Sin equipo completo: «por qué muero» lo contesta la revisión rápida, sin motor.
      gameOnly: true,
      ...extra,
    },
    { selector: fake, gems, tree },
  );
}

/** Una frase que ninguna regla reconoce, por tema, y un trozo de la respuesta de su regla. */
const CASES: ReadonlyArray<[Exclude<RouteTopic, "none">, string, Partial<MentorRouteDecision>, RegExp]> = [
  ["support_gems", "que le acoplo a mi golpe gordo", { skill: "Terremoto" }, /Para Terremoto, las asistencias/],
  ["support_sockets", "como le acoplo mas cosas a un golpe", {}, /joyero/i],
  ["support_grade_compare", "brutalida la 1 o la 2", { support: "Brutalidad" }, /Brutalidad I\b[\s\S]*Brutalidad II\b/],
  ["uncut_skill_gem", "me ha caido una piedra de nivel 5, en que la gasto", {}, /nivel 5|gema sin tallar/i],
  ["uncut_spirit_gem", "que heraldos me puedo poner", {}, /esp[ií]ritu/i],
  ["improve_skill", "mi terremoto se queda corto, como lo subo", { skill: "Terremoto" }, /Terremoto mejora por tres sitios/],
  ["passive_tree", "en que me gasto los talentos", {}, /Tu árbol de pasivas/],
  ["attributes", "que es mejor subir, la roja o la verde", {}, /fuerza/i],
  ["curses", "hay algun hechizo que debilite al jefe", {}, /maldici/i],
  ["minions", "quiero ir con bichos que peleen por mi", {}, /esbirro/i],
  ["resistances", "que resis llevo al segundo acto", {}, /30 ?%[\s\S]*75 ?%/],
  ["red_requirement", "no me deja equiparla, pone que no cumplo", {}, /rojo/i],
  ["spirit", "lo azul ese que reservan los heraldos que es", {}, /Con las palabras del juego/],
  ["ascendancy", "cuando puedo elegir subclase", {}, /ascendencia/i],
  ["exalted_orb", "para que valen las monedas doradas que meten una linea", {}, /Orbe exaltado/],
  ["shield_or_two_handed", "voy con tabla o con el martillo grande", {}, /escudo/i],
  ["compare_items", "me ha salido un mazo nuevo, me lo pongo", {}, /¿Cuál de estas dos es mejor\?/],
  ["why_dying", "duro dos telediarios", {}, /revisión rápida|revisi[oó]n/i],
  ["lacks_damage", "los jefes me duran una eternidad", {}, /revisión rápida|revisi[oó]n/i],
  ["next_improvement", "mi personaje va regular, que le toca ya", {}, /revisión rápida|revisi[oó]n/i],
];

describe("la IA dice el tema y contesta la regla de ese tema", () => {
  it("la lista de casos cubre todos los temas", () => {
    expect(CASES.map(([topic]) => topic).sort()).toEqual(ROUTE_TOPICS.filter((topic) => topic !== "none").sort());
  });

  for (const [topic, question, slots, expected] of CASES) {
    it(`${topic}: «${question}»`, async () => {
      // Sin IA, ninguna regla la reconoce: es justo el caso que arregla el paso 1.
      const before = await ask(question, null);
      expect(before.intent, "sin IA").toBe("unsupported");

      const route = vi.fn(async () => decision(topic, slots));
      const fake = selector(route);
      const answer = await ask(question, fake);

      expect(route).toHaveBeenCalledTimes(1);
      expect(answer.intent).not.toBe("unsupported");
      expect(answer.answer.startsWith(`${understoodLine(topic, "es")}\n\n`)).toBe(true);
      expect(answer.answer).toMatch(expected);
      expect(answer.responseMode).toBe("ai");
      expect(answer.model).toBe("modelo-prueba");
      // La pregunta que se guarda y se enseña es la del jugador, no la reescrita.
      expect(answer.normalizedQuestion).toBe(classifyMentorQuestion(question).normalizedQuestion);
      // La IA solo entendió: no redactó ni eligió entre recomendaciones.
      expect(fake.select).not.toHaveBeenCalled();
    });
  }

  it("a la IA solo le llegan la pregunta, la clase, el nivel y los nombres de las habilidades", async () => {
    let seen: MentorRouteInput | null = null;
    await ask(
      "cuando puedo elegir subclase",
      selector(async (input) => {
        seen = input;
        return decision("ascendancy");
      }),
      { conversation: [{ role: "player", text: "hola" }, { role: "mentor", text: "¡Hola!" }] },
    );
    expect(seen).toEqual({
      question: "cuando puedo elegir subclase",
      lang: "es",
      characterClass: "Guerrero",
      level: 14,
      skills: ["Embate rodante", "Terremoto", "Rompearmaduras", "Grito infernal"],
      conversation: [{ role: "player", text: "hola" }, { role: "mentor", text: "¡Hola!" }],
    });
  });

  it("en inglés contesta en inglés", async () => {
    const answer = await ask("when can I pick a subclass", selector(async () => decision("ascendancy")), { lang: "en" });
    expect(answer.answer.startsWith(`${understoodLine("ascendancy", "en")}\n\n`)).toBe(true);
    expect(answer.answer).toMatch(/ascendanc/i);
  });
});

describe("la IA no decide nada más", () => {
  it("si dice que no es de ningún tema, sigue el «no lo sé»", async () => {
    const answer = await ask("donde farmeo oro rapido", selector(async () => decision("none")));
    expect(answer.intent).toBe("unsupported");
    expect(answer.answer).toContain("no me lo voy a inventar");
    expect(answer.responseMode).toBe("ai");
  });

  it("si la IA falla, contesta como sin IA y dice por qué", async () => {
    const answer = await ask(
      "cuando puedo elegir subclase",
      selector(async () => {
        throw new MentorAiError("El servicio de IA respondió con estado 429; se usaron las reglas.");
      }),
    );
    expect(answer.intent).toBe("unsupported");
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.fallbackReason).toContain("429");
  });

  it("si las reglas ya reconocen la frase, no se pregunta a la IA", async () => {
    const route = vi.fn(async () => decision("none"));
    const answer = await ask("que ascendencia me cojo?", selector(route));
    expect(route).not.toHaveBeenCalled();
    expect(answer.responseMode).toBe("rules");
    expect(answer.answer).not.toContain("Entiendo que");
  });

  it("un botón de la web y un área en revisión no pasan por la IA", async () => {
    const route = vi.fn(async () => decision("ascendancy"));
    await ask("cuando puedo elegir subclase", selector(route), { intentHint: "next_improvement" });
    await ask("cuando puedo elegir subclase", selector(route), {
      gameOnly: false,
      patchFeatureBlock: { featureId: "crafting-essences", label: "Essences", patch: "0.5.5", note: "en revisión" },
    });
    expect(route).not.toHaveBeenCalled();
  });

  it("una habilidad que el jugador ni tiene ni nombra se descarta", () => {
    // La IA se inventa «Bola de fuego»: la pregunta no la nombra y el guerrero no la lleva.
    const invented = routedQuestion(decision("support_gems", { skill: "Bola de fuego" }), {
      gems,
      profile: warrior,
      question: "que le acoplo a mi golpe gordo",
    });
    expect(invented).toEqual({ topic: "support_gems", question: "que gema de asistencia le pongo" });
    // Una que sí lleva, aunque no la nombre bien, vale.
    const owned = routedQuestion(decision("support_gems", { skill: "Terremoto" }), {
      gems,
      profile: warrior,
      question: "que le acoplo a mi golpe gordo",
    });
    expect(owned?.question).toBe("que gema de asistencia le pongo a Terremoto");
    // Y una que no es del juego, tampoco.
    const unknown = routedQuestion(decision("improve_skill", { skill: "Golpe gordo definitivo" }), {
      gems,
      profile: warrior,
      question: "como mejoro mi golpe gordo",
    });
    expect(unknown).toEqual({ topic: "lacks_damage", question: "me falta dano" });
  });

  it("una asistencia que no está en la pregunta se descarta, y los números salen de la pregunta", () => {
    const invented = routedQuestion(decision("support_grade_compare", { support: "Brutalidad" }), {
      gems,
      profile: warrior,
      question: "cual pongo, la 1 o la 2",
    });
    expect(invented?.topic).toBe("support_gems");
    const asked = routedQuestion(decision("support_grade_compare", { support: "Brutalidad" }), {
      gems,
      profile: warrior,
      question: "brutalida la 1 o la 2",
    });
    expect(asked).toEqual({ topic: "support_grade_compare", question: "que pongo Brutalidad 1 o 2" });
    const level = routedQuestion(decision("uncut_skill_gem"), {
      gems,
      profile: warrior,
      question: "me ha caido una piedra de nivel 5, en que la gasto",
    });
    expect(level?.question).toBe("tengo una gema sin tallar de nivel 5 cual cojo");
  });
});

describe("la petición de «entender» al proveedor", () => {
  const config = { ...loadConfig({}), mentorAiEnabled: true, mentorAiProvider: "groq" as const, mentorAiApiKey: "test-key" };
  const input: MentorRouteInput = {
    question: "cuando puedo elegir subclase",
    lang: "es",
    characterClass: "Guerrero",
    level: 14,
    skills: ["Terremoto"],
    conversation: [],
  };
  const reply = (text: string) =>
    new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("pide una salida cerrada: solo un tema de la lista", async () => {
    let body: { input: Array<{ content: string }>; text: { format: { name: string; schema: { properties: { topic: { enum: string[] } } } } } } | null = null;
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return reply(JSON.stringify(decision("ascendancy")));
    });
    const result = await new ResponsesMentorSelector(config, fetchImpl).route(input, "semilla");
    expect(result.topic).toBe("ascendancy");
    expect(body!.text.format.name).toBe("exile_copilot_mentor_route");
    expect(body!.text.format.schema.properties.topic.enum).toEqual([...ROUTE_TOPICS]);
    expect(body!.input[1]!.content).toContain("cuando puedo elegir subclase");
  });

  it("un tema fuera de la lista no pasa", async () => {
    const fetchImpl = vi.fn(async () => reply(JSON.stringify({ ...decision("none"), topic: "farmeo" })));
    await expect(new ResponsesMentorSelector(config, fetchImpl).route(input, "semilla")).rejects.toBeInstanceOf(MentorAiError);
  });
});
