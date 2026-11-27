import { describe, expect, it, vi } from "vitest";
import { CharacterProfileSchema, RecommendationMemorySchema } from "../../shared/domain.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { loadConfig } from "../../server/config.js";
import { createDatabase } from "../../server/db/database.js";
import { MentorAiError, type MentorDecisionSelector } from "../../server/mentor/mentorAi.js";
import { classifyMentorQuestion } from "../../shared/mentorIntent.js";
import { answerBasicsQuestion } from "../../server/mentor/basicsQuestions.js";
import { answerGuideQuestion, guideInQuestion, loadGuideKnowledge, stepsNamedIn } from "../../server/mentor/guideKnowledge.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import {
  buildFichas,
  checkWrittenMessage,
  composeWrittenAnswer,
  isOffer,
  UnverifiedWriting,
  writerVocabulary,
  type MentorWriteDecision,
  type MentorWriteInput,
} from "../../server/mentor/mentorWriter.js";
import { PoeNinjaClient, PriceService } from "../../server/services/poeninja.js";
import { buildGuideKnowledge } from "../../scripts/lib/guideKnowledge.js";

/**
 * Tarea 13 del plan (25-11-2026): el Mentor conversa. Las reglas ponen los
 * datos, la IA elige cuáles enseñar y escribe la entrada, y nada que no esté
 * en los datos llega al jugador.
 */

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };
const guides = loadGuideKnowledge();
const vocabulary = writerVocabulary(gems, guides);

const skill = (id: string, mainSkill: string, supports: string[] = []) => ({
  id,
  label: "",
  mainSkill,
  mainSkillGemId: null,
  supports: supports.map((name) => ({ name, gemId: null })),
});

const witch = CharacterProfileSchema.parse({
  id: "prueba-bruja",
  name: "Mi bruja",
  characterClass: "Bruja",
  ascendancy: "Liche",
  ascendancyId: null,
  level: 49,
  levelSource: "observed",
  archetype: "Bruja de caos con esbirros",
  league: "Runes of Aldur",
  patch: "0.5.5",
  items: [
    { id: "b-arma", name: "Varita de hueso", baseType: "Varita de hueso", slot: "weapon", rarity: "magic", itemLevel: 44, modifiers: [], sources: [] },
    { id: "b-pecho", name: "Túnica de seda", baseType: "Túnica de seda", slot: "body", rarity: "magic", itemLevel: 45, modifiers: [], sources: [] },
  ],
  skills: [
    skill("s1", "Descarga de caos", ["Lanzamiento rápido I"]),
    skill("s2", "Guerrero esqueleto", ["Último aliento"]),
  ],
  passives: { allocated: [] },
  attributes: { str: 7, dex: 25, int: 131 },
  resistances: { fire: 17, cold: -42, lightning: 9, chaos: 9 },
  life: 833,
  energyShield: 318,
  sources: [],
  importedAt: "2026-11-25T19:00:00.000Z",
});

const BASE = {
  profile: witch,
  budget: null,
  goal: { kind: "balanced" as const },
  league: "Runes of Aldur",
  patch: "0.5.5",
  memory: RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:0000000000000000",
    primaryEntry: null,
    recentCompleted: [],
  }),
};

function deps(selector: MentorDecisionSelector) {
  const config = { ...loadConfig({}), poeNinjaOffline: true };
  return {
    priceService: new PriceService(new PoeNinjaClient({ db: createDatabase(":memory:"), config })),
    selector,
    gems,
    guides,
  };
}

/** Una IA de mentira que redacta lo que le diga la prueba, viendo lo que recibe. */
function writer(decide: (input: MentorWriteInput) => MentorWriteDecision | Promise<MentorWriteDecision>) {
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

const GEM_QUESTION = "que gema de asistencia le pongo a descarga de caos?";

describe("las guías por acto como datos del Mentor", () => {
  it("el archivo de datos está al día con las guías de la web", () => {
    // Si falla: `npm run data:guides` después de tocar una guía.
    expect(loadGuideKnowledge()).toEqual(buildGuideKnowledge());
  });

  it("contesta por el jefe final de un acto con las frases de su guía", () => {
    const answer = answerGuideQuestion(guides, "como mato al jefe del acto 3?", "es");
    const act = guides.es.find((guide) => guide.act === 3)!;
    const bosses = act.blocks.find((block) => block.id === "jefes")!;
    expect(answer).toContain(bosses.intro);
    for (const card of bosses.cards) expect(answer).toContain(card);
    expect(answer).toContain("Guías → acto 3");
  });

  it("reconoce el acto por el nombre de un jefe y no por palabras corrientes", () => {
    expect(guideInQuestion(guides, "como mato a doryani", "es")?.guide.act).toBe(3);
    expect(guideInQuestion(guides, "el conde geonor me mata", "es")?.guide.act).toBe(1);
    expect(guideInQuestion(guides, "soy bruja y me matan mucho", "es")).toBeNull();
    expect(guideInQuestion(guides, "que hago en el campamento", "es")).toBeNull();
    expect(answerGuideQuestion(guides, "mis esbirros se mueren enseguida", "es")).toBeNull();
  });

  it("sin IA, el Mentor ya no dice «no lo sé» al jefe del acto 3", async () => {
    const answer = await answerMentorQuery({ ...BASE, question: "como mato al jefe del acto 3?" }, { gems, guides });
    expect(answer.intent).toBe("conversation");
    expect(answer.responseMode).toBe("rules");
    expect(answer.answer).toContain("Doryani");
  });
});

describe("el filtro de lo que escribe la IA", () => {
  const allowed = "Impulso (grado II, destreza): inflige un 40% más de daño. Doryani, Taumaturgo real, pega con rayo.";

  it("deja pasar lo que está en los datos", () => {
    expect(checkWrittenMessage("Prueba con Impulso: da un 40% más de daño. Cuidado con Doryani.", allowed, vocabulary)).toContain("Impulso");
  });

  it("tira una cifra, un grado, una gema o un nombre que no estén en los datos", () => {
    expect(() => checkWrittenMessage("Da un 55% más de daño.", allowed, vocabulary)).toThrow(UnverifiedWriting);
    expect(() => checkWrittenMessage("Mejor la de grado IV.", allowed, vocabulary)).toThrow(UnverifiedWriting);
    expect(() => checkWrittenMessage("Mejor ponle Rebote.", allowed, vocabulary)).toThrow(UnverifiedWriting);
    expect(() => checkWrittenMessage("Eso es como pelear contra Kitava.", allowed, vocabulary)).toThrow(UnverifiedWriting);
    // Al empezar la frase también, si es un nombre de las guías.
    expect(() => checkWrittenMessage("Jamanra pega con rayo.", allowed, vocabulary)).toThrow(UnverifiedWriting);
  });

  it("no confunde una palabra corriente con una gema, ni el inicio de una frase con un nombre", () => {
    expect(checkWrittenMessage("Primero mira esto. Coge impulso y sigue.", allowed, vocabulary)).toContain("impulso");
  });

  it("no deja salir enlaces ni nombres internos", () => {
    expect(() => checkWrittenMessage("Mira https://ejemplo.test", allowed, vocabulary)).toThrow(UnverifiedWriting);
    expect(() => checkWrittenMessage("Según la ficha f3, sí.", allowed, vocabulary)).toThrow(UnverifiedWriting);
  });
});

describe("la respuesta se monta con las fichas copiadas tal cual", () => {
  const fichas = buildFichas(
    [
      { origen: "tema", lines: [{ tema: "asistencias", texto: "Impulso (grado II, destreza): inflige un 40% más de daño." }] },
      { origen: "guia", lines: [{ tema: "guía del acto 3", texto: "Descarga estática: ponte dentro del círculo y no te hace daño." }] },
    ],
    6000,
  );

  it("enseña la ficha entera, no lo que la IA diga de ella", () => {
    const written = composeWrittenAnswer(
      { intro: "Para ese ataque, haz esto.", fichas: ["f2"], cierre: "¿Te vale?", enough: true },
      fichas,
      "",
      vocabulary,
    );
    expect(written.message).toBe("Para ese ataque, haz esto.\n\n• Descarga estática: ponte dentro del círculo y no te hace daño.\n\n¿Te vale?");
    expect([...written.origins]).toEqual(["guia"]);
  });

  it("acepta la frase en vez del id solo si es una ficha, y tira un id que no existe", () => {
    const byText = composeWrittenAnswer(
      { intro: "Esta.", fichas: ["Impulso (grado II, destreza): inflige un 40% más de daño."], cierre: null, enough: true },
      fichas,
      "",
      vocabulary,
    );
    expect(byText.message).toContain("• Impulso (grado II, destreza)");
    expect(() =>
      composeWrittenAnswer({ intro: "Esta.", fichas: ["Evita los círculos de descarga estática."], cierre: null, enough: true }, fichas, "", vocabulary),
    ).toThrow(UnverifiedWriting);
    expect(() => composeWrittenAnswer({ intro: "Esta.", fichas: ["f9"], cierre: null, enough: true }, fichas, "", vocabulary)).toThrow(UnverifiedWriting);
  });

  it("un cierre que no es una pregunta no se enseña: un consejo ahí no se puede comprobar", () => {
    const written = composeWrittenAnswer(
      { intro: "Esta.", fichas: ["f1"], cierre: "Usa tus esbirros para distraerlo.", enough: true },
      fichas,
      "",
      vocabulary,
    );
    expect(written.message).not.toContain("distraerlo");
  });

  it("un cierre que ofrece no se enseña: nadie ha comprobado que el Mentor sepa cumplirlo", () => {
    const withClosing = (cierre: string) =>
      composeWrittenAnswer({ intro: "Esta.", fichas: ["f1"], cierre, enough: true }, fichas, "", vocabulary).message;
    expect(withClosing("¿Quieres que te explique cómo enlazarlas?")).not.toContain("enlazarlas");
    expect(withClosing("¿Te interesan también los pasivos que ya tienes?")).not.toContain("pasivos");
    expect(withClosing("¿Te explico cómo llegar?")).not.toContain("llegar");
    expect(isOffer("Do you want tips for the first phase?")).toBe(true);
    // Preguntar por su partida sí vale.
    expect(withClosing("¿Qué fase te cuesta más?")).toContain("¿Qué fase te cuesta más?");
    expect(isOffer("¿Cuál de esas tienes ya?")).toBe(false);
  });
});

describe("lo flojo de la charla (tarea 14)", () => {
  /** Pregunta con la charla anterior y devuelve las fichas que vio la IA. */
  async function offeredFor(question: string, conversation: Array<{ role: "player" | "mentor"; text: string }>) {
    let offered: MentorWriteInput["fichas"] = [];
    const { selector } = writer((input) => {
      offered = input.fichas;
      return { intro: "Mira esto.", fichas: [input.fichas[0]!.id], cierre: null, enough: true };
    });
    const answer = await answerMentorQuery({ ...BASE, question, conversation }, deps(selector));
    return { offered, answer };
  }

  it("con un jefe en la charla, «¿y qué hago en la pelea?» ve primero la pelea y el equipo al final", async () => {
    const { offered } = await offeredFor("vale, y que hago en la pelea?", [
      { role: "player", text: "como mato al jefe del acto 3?" },
      { role: "mentor", text: "Doryani, Taumaturgo real, al final, en Las cámaras negras." },
    ]);
    expect(offered[0]!.tema).toContain("la pelea contra el jefe final");
    expect(offered[0]!.texto).toContain("Doryani");
    const loose = offered.findIndex((ficha) => ficha.tema.startsWith("frase suelta"));
    const lastFight = offered.map((ficha) => ficha.tema.includes("la pelea contra el jefe final")).lastIndexOf(true);
    expect(loose).toBeGreaterThan(lastFight);
  });

  it("«¿y eso dónde está?» trae primero una zona por cada cosa que se acaba de nombrar", async () => {
    const { offered } = await offeredFor("y eso donde esta?", [
      { role: "player", text: "que cosas para siempre me llevo del acto 3?" },
      {
        role: "mentor",
        text:
          "• No te saltes a Quijada negra (+10 % de fuego para siempre) ni a Ignagduk (+30 de espíritu para siempre).\n" +
          "• Hay 4 puntos de pasiva de set de arma: Puñoplateado poderoso y el Corazón sacrificial de Aggorat.",
      },
    ]);
    const named = offered.filter((ficha) => ficha.tema.includes("acaba de nombrar"));
    expect(named.map((ficha) => ficha.texto.split(":")[0])).toEqual([
      "Taller de máquinas de Jiquani",
      "El pantano de los azak (opcional)",
      "Ruinas de la jungla",
      "Aggorat (pasado)",
    ]);
    expect(offered.slice(0, 4)).toEqual(named);
  });

  it("las zonas se buscan por nombres que solo salen en una: un texto sin nombres no sitúa nada", () => {
    const act3 = guides.es.find((guide) => guide.act === 3)!;
    expect(stepsNamedIn(guides, act3, "es", "Busca bien y coge todo lo que puedas del acto.")).toEqual([]);
    expect(stepsNamedIn(guides, act3, "es", "ignagduk da espíritu").map((step) => step.zone)).toEqual(["El pantano de los azak"]);
  });

  it("«hace poco daño»: lo que le falla a su arma llega a la IA y no sale dos veces", async () => {
    let offered: MentorWriteInput["fichas"] = [];
    const { selector } = writer((input) => {
      offered = input.fichas;
      const step = input.fichas.find((ficha) => ficha.texto.startsWith("Siguiente paso:"));
      return { intro: "Antes que las gemas, mira esto.", fichas: [step?.id ?? input.fichas[0]!.id], cierre: null, enough: true };
    });
    const answer = await answerMentorQuery({ ...BASE, question: "descarga de caos hace poco daño" }, deps(selector));
    const step = offered.find((ficha) => ficha.texto.startsWith("Siguiente paso:"));
    expect(step).toBeDefined();
    expect(step!.tema).toContain("revisión de este personaje");
    expect(answer.answer).toContain(step!.texto);
    // Ya va escrito en la respuesta: la tarjeta de «tu próxima acción» lo repetiría.
    expect(answer.nextAction).toBeNull();
  });

  it("«¿cuál pongo primero?» tiene una ficha que nombra una sola gema: la primera de la lista", async () => {
    const { offered } = await offeredFor("cual pongo primero?", [
      { role: "player", text: GEM_QUESTION },
      { role: "mentor", text: "Para Descarga de caos, estas." },
    ]);
    const first = offered.find((ficha) => ficha.tema.includes("cuál poner primero en Descarga de caos"))!;
    const list = offered.filter((ficha) => ficha.tema.includes("asistencias que le van a Descarga de caos"));
    expect(first.texto).toContain(`la primera de la lista es ${list[0]!.texto.split(" (")[0]}:`);
    // Si no lo pregunta, esa ficha no está: «¿qué le pongo?» recibía una sola gema.
    const plain = await offeredFor(GEM_QUESTION, []);
    expect(plain.offered.some((ficha) => ficha.tema.includes("cuál poner primero"))).toBe(false);
  });

  it("un encabezado de las reglas («…son:») no es una ficha", async () => {
    const { offered } = await offeredFor(GEM_QUESTION, []);
    expect(offered.length).toBeGreaterThan(3);
    expect(offered.some((ficha) => ficha.texto.endsWith(":"))).toBe(false);
  });

  it("en mitad de una charla, «eso no lo tengo» con lo más cercano vale más que repetir la lista", async () => {
    const rulesAnswer = await answerMentorQuery({ ...BASE, question: GEM_QUESTION }, { gems, guides });
    const { selector } = writer((input) => {
      const others = input.fichas.filter(
        (ficha) => ficha.tema.includes("asistencias que le van a Descarga de caos") && !rulesAnswer.answer.includes(ficha.texto.split(" (")[0]!),
      );
      return { intro: "Dónde sale no lo sé, pero esta otra también encaja.", fichas: [others[0]!.id], cierre: null, enough: false };
    });
    const answer = await answerMentorQuery(
      {
        ...BASE,
        question: "y si esa no me ha salido?",
        conversation: [
          { role: "player", text: GEM_QUESTION },
          { role: "mentor", text: rulesAnswer.answer.slice(0, 800) },
        ],
      },
      deps(selector),
    );
    expect(answer.answer.startsWith("Dónde sale no lo sé, pero esta otra también encaja.\n\n• ")).toBe(true);
    expect(answer.answer).not.toContain("Entiendo que preguntas");
    // Sin charla detrás, el «no lo sé» de siempre.
    const alone = writer(() => ({ intro: "Eso no lo tengo.", fichas: [], cierre: null, enough: false }));
    const lost = await answerMentorQuery({ ...BASE, question: "y si esa no me ha salido?" }, deps(alone.selector));
    expect(lost.intent).toBe("unsupported");
  });

  it("«vale, ¿y de gemas qué le pongo?» es una pregunta, no un saludo", () => {
    expect(classifyMentorQuestion("vale, y de gemas que le pongo?").intent).not.toBe("conversation");
    expect(classifyMentorQuestion("ok y cual pongo").intent).not.toBe("conversation");
    expect(classifyMentorQuestion("vale, muchas gracias").intent).toBe("conversation");
    expect(classifyMentorQuestion("hola, ¿qué tal?").intent).toBe("conversation");
  });

  it("la charla de cortesía no nombra gemas ni cifras que no estén en el contexto", async () => {
    const select = vi.fn(async () => ({
      kind: "conversation" as const,
      recommendationId: null,
      missingFactId: null,
      message: "¡Claro! Lo típico es usar Rayo de Relámpago y alguna de apoyo como Hipnosis.",
      followUpQuestion: null,
    }));
    const selector: MentorDecisionSelector = { name: "ia-de-prueba", select };
    const answer = await answerMentorQuery({ ...BASE, question: "hola" }, deps(selector));
    expect(select).toHaveBeenCalledTimes(1);
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.answer).not.toContain("Hipnosis");
  });

  it("«¿y de resistencias voy bien?» contesta con las suyas", () => {
    const answer = answerBasicsQuestion(gems, "y de resistencias voy bien?", witch, "es");
    expect(answer).toContain("Tu personaje tiene: fuego 17 %, hielo -42 %, rayo 9 %.");
  });
});

describe("el Mentor conversa", () => {
  it("una repregunta recibe las asistencias del tema anterior, más de las tres de la regla", async () => {
    const rulesAnswer = await answerMentorQuery({ ...BASE, question: GEM_QUESTION }, { gems, guides });
    let offered: MentorWriteInput["fichas"] = [];
    const { selector, write } = writer((input) => {
      offered = input.fichas;
      const fresh = input.fichas.filter(
        (ficha) => ficha.tema.includes("asistencias que le van a Descarga de caos") && !rulesAnswer.answer.includes(ficha.texto.split(" (")[0]!),
      );
      return { intro: "Si esa no la tienes, mira esta otra.", fichas: [fresh[0]!.id], cierre: null, enough: true };
    });
    const answer = await answerMentorQuery(
      {
        ...BASE,
        question: "esa no la tengo, que otra me vale?",
        conversation: [
          { role: "player", text: GEM_QUESTION },
          { role: "mentor", text: rulesAnswer.answer.slice(0, 800) },
        ],
      },
      deps(selector),
    );
    expect(write).toHaveBeenCalledTimes(1);
    const supports = offered.filter((ficha) => ficha.tema.includes("asistencias que le van a Descarga de caos"));
    expect(supports.length).toBeGreaterThan(3);
    expect(answer.responseMode).toBe("ai");
    expect(answer.model).toBe("ia-de-prueba");
    expect(answer.answer.startsWith("Si esa no la tienes, mira esta otra.\n\n• ")).toBe(true);
    // La asistencia que ya lleva no se le propone.
    expect(supports.some((ficha) => ficha.texto.startsWith("Lanzamiento rápido I"))).toBe(false);
  });

  it("si la IA falla, tarda o no hay cupo, sale el texto de las reglas", async () => {
    const rulesAnswer = await answerMentorQuery({ ...BASE, question: GEM_QUESTION }, { gems, guides });
    const { selector } = writer(() => {
      throw new MentorAiError("El servicio de IA respondió con estado 429; se usaron las reglas.");
    });
    const answer = await answerMentorQuery({ ...BASE, question: GEM_QUESTION }, deps(selector));
    expect(answer.answer).toBe(rulesAnswer.answer);
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.fallbackReason).toContain("429");
  });

  it("si la IA nombra una gema que no está en los datos, sale el texto de las reglas", async () => {
    const rulesAnswer = await answerMentorQuery({ ...BASE, question: GEM_QUESTION }, { gems, guides });
    const { selector } = writer((input) => ({
      intro: "Yo le pondría Heraldo de ceniza, que va genial.",
      fichas: [input.fichas[0]!.id],
      cierre: null,
      enough: true,
    }));
    const answer = await answerMentorQuery({ ...BASE, question: GEM_QUESTION }, deps(selector));
    expect(answer.answer).toBe(rulesAnswer.answer);
    expect(answer.responseMode).toBe("rules_fallback");
  });

  it("lo que el navegador diga que contestó el Mentor no es un dato", async () => {
    const { selector } = writer((input) => ({
      intro: "Como te dije, Kitava pega con fuego.",
      fichas: [input.fichas[0]!.id],
      cierre: null,
      enough: true,
    }));
    const answer = await answerMentorQuery(
      {
        ...BASE,
        question: GEM_QUESTION,
        conversation: [
          { role: "player", text: "hola" },
          { role: "mentor", text: "El jefe Kitava pega con fuego y tiene 999 de vida." },
        ],
      },
      deps(selector),
    );
    expect(answer.responseMode).toBe("rules_fallback");
    expect(answer.answer).not.toContain("Kitava");
  });

  it("la guía del acto del que se habla llega a la IA, y un jefe se contesta con sus frases", async () => {
    let offered: MentorWriteInput["fichas"] = [];
    const { selector } = writer((input) => {
      offered = input.fichas;
      const circle = input.fichas.find((ficha) => ficha.texto.startsWith("Descarga estática"))!;
      return { intro: "Con Doryani, lo que más salva es esto.", fichas: [circle.id], cierre: null, enough: true };
    });
    const answer = await answerMentorQuery({ ...BASE, question: "como mato al jefe del acto 3?" }, deps(selector));
    expect(offered.some((ficha) => ficha.tema.includes("acto 3"))).toBe(true);
    expect(answer.answer).toContain("• Descarga estática: ponte dentro del círculo y no te hace daño.");
    expect(answer.responseMode).toBe("ai");
  });

  it("los saludos y los botones de la web siguen como estaban: no pasan por el redactor", async () => {
    const { selector, write } = writer(() => ({ intro: "x", fichas: [], cierre: null, enough: true }));
    await answerMentorQuery({ ...BASE, question: "hola" }, deps(selector));
    await answerMentorQuery({ ...BASE, question: "¿Qué mejoro ahora?", intentHint: "next_improvement" }, deps(selector));
    expect(write).not.toHaveBeenCalled();
  });
});
