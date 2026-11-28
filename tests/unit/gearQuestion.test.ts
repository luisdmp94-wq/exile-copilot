import { describe, expect, it, vi } from "vitest";
import { CharacterProfileSchema, ItemSchema, RecommendationMemorySchema, type Item } from "../../shared/domain.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { loadConfig } from "../../server/config.js";
import { createDatabase } from "../../server/db/database.js";
import { gearReading, gearRulesAnswer } from "../../server/mentor/gearQuestion.js";
import { MentorAiError, type MentorDecisionSelector } from "../../server/mentor/mentorAi.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import type { MentorWriteDecision, MentorWriteInput } from "../../server/mentor/mentorWriter.js";
import { PoeNinjaClient, PriceService } from "../../server/services/poeninja.js";
import { MentorQueryRequestSchema, type MentorGearAsk } from "../../shared/mentorQuery.js";

/**
 * El Mentor de equipo (tarea 18 del plan, 28-11-2026): preguntas sobre una
 * comparación de dos piezas. Las reglas comparan; la IA, si la hay, solo elige
 * frases y escribe la entrada.
 */

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };

function piece(id: string, name: string, slot: Item["slot"], lines: string[], requirements?: Item["requirements"]): Item {
  return ItemSchema.parse({
    id,
    name,
    baseType: name,
    slot,
    rarity: "rare",
    itemLevel: 30,
    modifiers: lines.map((text, index) => ({ id: `${id}-m${index}`, text, kind: "explicit", values: [], verified: true })),
    sources: [],
    ...(requirements ? { requirements } : {}),
  });
}

const wornGloves = piece("puestos", "Garras del alba", "gloves", ["+45 a la vida máxima", "+17 a la destreza"]);
const boots = piece("botas", "Botas del cazador", "boots", ["+10% a la resistencia al fuego"], { dex: 60 });
const bow = piece("arco", "Arco corto de caza", "weapon", []);

const ranger = CharacterProfileSchema.parse({
  id: "prueba-exploradora",
  name: "Mi exploradora",
  characterClass: "Exploradora",
  ascendancy: null,
  ascendancyId: null,
  level: 22,
  levelSource: "observed",
  archetype: "arco de rayo",
  league: "Runes of Aldur",
  patch: "0.5.5",
  items: [bow, wornGloves, boots],
  skills: [{ id: "s1", label: "", mainSkill: "Flecha de rayo", mainSkillGemId: null, supports: [] }],
  passives: { allocated: [] },
  attributes: { str: 14, dex: 61, int: 22 },
  resistances: { fire: 20, cold: 5, lightning: 31, chaos: 0 },
  life: 640,
  sources: [],
  importedAt: "2026-11-28T12:00:00.000Z",
});

const better = piece("mejor", "Zarpas de tormenta", "gloves", ["+90 a la vida máxima", "+20% a la resistencia al hielo", "+12 a la precisión de hechizos"]);
const worse = piece("peor", "Guantes raídos", "gloves", ["+12 a la vida máxima"]);
const tooHigh = piece("alta", "Guanteletes del coloso", "gloves", ["+120 a la vida máxima"], { level: 40, str: 50 });

const ask = (found: Item, wornId: string | null = wornGloves.id): MentorGearAsk => ({ found, wornId, style: "ranged", minions: false });

const BASE = {
  profile: ranger,
  budget: null,
  goal: { kind: "balanced" as const },
  league: "Runes of Aldur",
  patch: "0.5.5",
  memory: RecommendationMemorySchema.parse({ revision: "journal-memory-v1:0000000000000000", primaryEntry: null, recentCompleted: [] }),
};

function deps(selector: MentorDecisionSelector | null) {
  const config = { ...loadConfig({}), poeNinjaOffline: true };
  return { priceService: new PriceService(new PoeNinjaClient({ db: createDatabase(":memory:"), config })), selector, gems };
}

function writer(decide: (input: MentorWriteInput) => MentorWriteDecision) {
  const write = vi.fn(async (input: MentorWriteInput) => decide(input));
  const selector: MentorDecisionSelector = {
    name: "ia-de-prueba",
    select: vi.fn(async () => {
      throw new MentorAiError("no debería elegir; se usaron las reglas.");
    }),
    route: vi.fn(async () => ({ topic: "none" as const, skill: null, support: null, wish: null })),
    write,
  };
  return { selector, write };
}

const idOf = (input: MentorWriteInput, part: string) => input.fichas.find((ficha) => ficha.tema.includes(part))?.id ?? "f0";

describe("Mentor de equipo: lo que deciden las reglas", () => {
  it("dice que sí con una pieza mejor, y qué gana y qué pierde", () => {
    const reading = gearReading(ranger, ask(better));
    expect(reading.verdict).toBe("better");
    const text = reading.lines.map((line) => `${line.tema} → ${line.texto}`).join("\n");
    expect(text).toContain("Sí: «Zarpas de tormenta» te conviene más que «Garras del alba»");
    expect(text).toContain("lo que GANA si se pone la encontrada → Vida máxima: la que llevas da +45 y la encontrada +90.");
    expect(text).toContain("lo que PIERDE si se pone la encontrada → Atributos: la que llevas da +17 y la encontrada, nada.");
  });

  it("avisa de la pieza que se queda sin requisito al cambiar", () => {
    const text = gearReading(ranger, ask(better)).lines.map((line) => line.texto).join("\n");
    expect(text).toContain("«Garras del alba» te da destreza: sin ella bajas de 61 a 44, y «Botas del cazador» pide 60.");
  });

  it("dice que no con una pieza peor", () => {
    const reading = gearReading(ranger, ask(worse));
    expect(reading.verdict).toBe("worse");
    expect(reading.lines[0]?.texto).toBe("No: «Garras del alba», la que llevas, te conviene más que «Guantes raídos».");
  });

  it("si no llega de nivel o de atributo, lo dice antes que nada", () => {
    const reading = gearReading(ranger, ask(tooHigh));
    expect(reading.verdict).toBe("blocked");
    expect(reading.lines[0]?.texto).toContain("Todavía no te puedes poner «Guanteletes del coloso». Pide nivel 40 y eres nivel 22. Pide 50 de fuerza y tienes 14.");
  });

  it("con el hueco vacío no hay comparación: suma", () => {
    const helmet = piece("casco", "Yelmo de cuero", "helmet", ["+30 a la vida máxima"]);
    const reading = gearReading(ranger, ask(helmet, null));
    expect(reading.verdict).toBe("empty");
    expect(reading.result).toBeNull();
    expect(reading.lines[0]?.texto).toBe("No llevas nada en ese hueco: «Yelmo de cuero» suma, póntela.");
  });

  it("no se fía del navegador: una pieza de otro hueco no vale de comparación", () => {
    const reading = gearReading(ranger, ask(better, boots.id));
    expect(reading.worn).toBeNull();
    expect(reading.verdict).toBe("empty");
  });

  it("contesta en inglés a quien usa la web en inglés", () => {
    const reading = gearReading(ranger, ask(better), "en");
    expect(reading.lines[0]?.texto).toBe("Yes: “Zarpas de tormenta” suits you better than “Garras del alba”, the one you wear in that slot.");
    expect(gearRulesAnswer(reading, "what do I lose?", "en")).toContain("drop from 61 to 44");
  });
});

describe("Mentor de equipo: la respuesta sin IA", () => {
  const reading = gearReading(ranger, ask(better));

  it("«¿qué pierdo?» enseña el aviso de atributos y lo que da de menos", () => {
    const answer = gearRulesAnswer(reading, "y que pierdo si me la pongo?");
    // El veredicto ya está encima, en la tarjeta: la respuesta va a lo que pregunta.
    expect(answer.split("\n")[0]).toBe("Si te pones «Zarpas de tormenta», esto es lo que pierdes:");
    expect(answer).toContain("• «Garras del alba» te da destreza");
    expect(answer).toContain("• Atributos: la que llevas da +17");
    expect(answer).not.toContain("Vida máxima");
  });

  it("«¿por qué?» da el motivo y lo que gana", () => {
    const answer = gearRulesAnswer(reading, "por que?");
    expect(answer).toContain("te da más");
    expect(answer).toContain("• Vida máxima: la que llevas da +45 y la encontrada +90.");
  });

  it("«¿me la puedo poner?» mira requisitos y atributos", () => {
    expect(gearRulesAnswer(gearReading(ranger, ask(tooHigh)), "me la puedo poner ya?").split("\n")[0]).toContain(
      "Todavía no te puedes poner «Guanteletes del coloso». Pide nivel 40 y eres nivel 22. Pide 50 de fuerza y tienes 14.",
    );
    const sameDex = piece("igual", "Guantes gemelos", "gloves", ["+20 a la vida máxima", "+17 a la destreza"]);
    expect(gearRulesAnswer(gearReading(ranger, ask(sameDex)), "me la puedo poner?")).toContain(
      "• Al cambiarla no pierdes atributo que le haga falta a otra pieza de las que llevas.",
    );
  });

  it("sin IA configurada, el Mentor contesta con las reglas", async () => {
    const answer = await answerMentorQuery({ ...BASE, question: "que pierdo?", gear: ask(better) }, deps(null));
    expect(answer.responseMode).toBe("rules");
    expect(answer.intent).toBe("conversation");
    expect(answer.answer).toContain("bajas de 61 a 44");
  });
});

describe("Mentor de equipo: con la IA redactando", () => {
  it("con la redacción apagada (`MENTOR_GEAR_AI_ENABLED`) contestan las reglas y la IA no se llama", async () => {
    const { selector, write } = writer(() => ({ intro: "No debería salir.", fichas: [], cierre: null, enough: true }));
    const question = { ...BASE, question: "y que pierdo si me la pongo?", gear: ask(better) };
    const answer = await answerMentorQuery({ ...question, gearRulesOnly: true }, deps(selector));
    expect(write).not.toHaveBeenCalled();
    expect(answer.answer).toBe((await answerMentorQuery(question, deps(null))).answer);
  });

  it("la IA ve las frases de la comparación y enseña las que elige, copiadas tal cual", async () => {
    const { selector, write } = writer((input) => ({
      intro: "Te compensa el cambio, pero ojo con la destreza.",
      fichas: [idOf(input, "cuidado al cambiarla"), input.fichas.find((ficha) => ficha.texto.startsWith("Vida máxima"))?.id ?? "f0"],
      cierre: null,
      enough: true,
    }));
    const answer = await answerMentorQuery({ ...BASE, question: "y que pierdo si me la pongo?", gear: ask(better) }, deps(selector));
    expect(write).toHaveBeenCalledTimes(1);
    const seen = write.mock.calls[0]![0];
    expect(seen.fichas.every((ficha) => ficha.tema.startsWith("comparación de equipo"))).toBe(true);
    expect(answer.responseMode).toBe("ai");
    expect(answer.answer).toBe(
      [
        "Te compensa el cambio, pero ojo con la destreza.",
        "• «Garras del alba» te da destreza: sin ella bajas de 61 a 44, y «Botas del cazador» pide 60. Míralo en el juego antes de cambiarla.\n• Vida máxima: la que llevas da +45 y la encontrada +90.",
      ].join("\n\n"),
    );
  });

  it("una cifra que no está en la comparación tira la redacción: salen las reglas", async () => {
    const { selector } = writer((input) => ({
      intro: "Ganas un 35 % más de daño con esos guantes.",
      fichas: [idOf(input, "lo que GANA")],
      cierre: null,
      enough: true,
    }));
    const answer = await answerMentorQuery({ ...BASE, question: "por que?", gear: ask(better) }, deps(selector));
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.answer).not.toContain("35");
    expect(answer.answer.split("\n")[0]).toBe("«Zarpas de tormenta» te da más resistencias y vida máxima.");
  });

  it("si la IA no elige ninguna frase, contestan las reglas", async () => {
    const { selector } = writer(() => ({ intro: "De eso no tengo nada.", fichas: [], cierre: null, enough: false }));
    const answer = await answerMentorQuery({ ...BASE, question: "y esto que tal?", gear: ask(better) }, deps(selector));
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.answer).toContain("Sí: «Zarpas de tormenta»");
  });

  it("si la IA falla, contestan las reglas y se dice por qué", async () => {
    const { selector } = writer(() => {
      throw new MentorAiError("La IA no respondió a tiempo; se usaron las reglas.");
    });
    const answer = await answerMentorQuery({ ...BASE, question: "por que?", gear: ask(worse) }, deps(selector));
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.fallbackReason).toBe("La IA no respondió a tiempo; se usaron las reglas.");
    expect(answer.answer.split("\n")[0]).toBe("«Garras del alba» te da más vida máxima y atributos.");
  });

  it("la fila de daño dice qué líneas son, no cuántas", () => {
    const wornBow = piece("arco-puesto", "Arco gastado", "weapon", ["Añade de 3 a 7 de daño físico a los ataques"]);
    const foundBow = piece("arco-nuevo", "Arco nuevo", "weapon", ["+40 a la vida máxima", "+12% a la resistencia al fuego"]);
    const profile = { ...ranger, items: [wornBow, wornGloves, boots] };
    const text = gearReading(profile, { ...ask(foundBow), wornId: wornBow.id }).lines.map((line) => line.texto).join("\n");
    expect(text).toContain("Daño de ataques: la que llevas da «Añade de 3 a 7 de daño físico a los ataques» y la encontrada, nada.");
    expect(text).not.toContain("1 línea");
  });

  it("lo ya dicho en la charla se marca, y «¿qué más pierdo?» lo quita si queda algo nuevo", async () => {
    const twoLosses = piece("dos", "Mitones finos", "gloves", ["+140 a la vida máxima", "+25% a la resistencia al hielo"]);
    const wornTwo = piece("puestos2", "Garras viejas", "gloves", ["+17 a la destreza", "+30 a la evasión"]);
    const profile = { ...ranger, items: [bow, wornTwo, boots] };
    const { selector, write } = writer((input) => ({ intro: "Esto es lo otro que pierdes.", fichas: [input.fichas.find((f) => f.tema.includes("PIERDE"))!.id], cierre: null, enough: true }));
    const first = gearRulesAnswer(gearReading(profile, { ...ask(twoLosses), wornId: wornTwo.id }), "que pierdo?");
    await answerMentorQuery(
      {
        ...BASE,
        profile,
        question: "y que mas pierdo?",
        gear: { ...ask(twoLosses), wornId: wornTwo.id },
        conversation: [
          { role: "player", text: "que pierdo?" },
          { role: "mentor", text: first },
        ],
      },
      deps(selector),
    );
    const seen = write.mock.calls[0]![0];
    const loses = seen.fichas.filter((ficha) => ficha.tema.includes("PIERDE"));
    // Las dos pérdidas ya estaban dichas: no queda nada nuevo, así que se quedan, marcadas.
    expect(loses.length).toBeGreaterThan(0);
    expect(loses.every((ficha) => ficha.tema.startsWith("YA DICHO"))).toBe(true);
  });
});

describe("Mentor de equipo: lo que acepta la API", () => {
  it("la petición lleva la pieza encontrada y con cuál se compara", () => {
    const parsed = MentorQueryRequestSchema.parse({
      question: "¿por qué?",
      profile: ranger,
      budget: null,
      goal: { kind: "balanced" },
      league: "Runes of Aldur",
      patch: "0.5.5",
      gear: ask(better),
    });
    expect(parsed.gear?.found.name).toBe("Zarpas de tormenta");
  });

  it("rechaza un estilo que no existe", () => {
    expect(() =>
      MentorQueryRequestSchema.parse({
        question: "¿por qué?",
        profile: ranger,
        budget: null,
        goal: { kind: "balanced" },
        league: "Runes of Aldur",
        patch: "0.5.5",
        gear: { ...ask(better), style: "mago" },
      }),
    ).toThrow();
  });
});
