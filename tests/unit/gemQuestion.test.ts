import { describe, expect, it } from "vitest";
import { CharacterProfileSchema } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { RecommendationMemorySchema } from "../../shared/domain.js";
import { MentorAnswerSchema } from "../../shared/mentorQuery.js";
import { answerNeedsCharacter } from "../../src/lib/mentorReviewAnswer.js";
import { answerMentorQuery } from "../../server/mentor/mentorService.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import {
  answerImproveSkillQuestion,
  asksToImproveNamedSkill,
  answerSupportGemQuestion,
  isSupportGemQuestion,
  skillInQuestion,
} from "../../server/mentor/gemQuestion.js";

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };

function witch(skills: string[] = ["Descarga de caos", "Contagio", "Guerrero esqueleto"]) {
  return CharacterProfileSchema.parse({
    id: "bruja",
    name: "Likewow",
    characterClass: "Bruja",
    level: 44,
    levelSource: "observed",
    league: "Forbidden Rites",
    patch: "0.5.5",
    importedAt: "2026-11-20T00:00:00.000Z",
    archetype: "Bruja de caos con esbirros",
    skills: skills.map((name, index) => ({ id: `s${index}`, label: name, mainSkill: name })),
  });
}

const ask = (question: string, profile = witch(), lang: "es" | "en" = "es") =>
  answerSupportGemQuestion(gems, question, profile, lang);

describe("el Mentor reconoce preguntas de gemas de asistencia", () => {
  it("las que hablan de gemas de asistencia, en los dos idiomas", () => {
    for (const question of [
      "hay alguna gema de asistencia para disparo de caos que haga que se puede multiplicar?",
      "¿Qué gema de asistencia le pongo a Contagio?",
      "que gemas de soporte van bien con descarga de caos",
      "which support gem for Chaos Bolt?",
      "best supports gems for my skill",
    ]) {
      expect(isSupportGemQuestion(normalizeQuestion(question)), question).toBe(true);
    }
  });

  it("y deja en paz las que no", () => {
    for (const question of ["¿Qué mejoro ahora?", "¿por qué muero?", "hola", "qué gema subo de nivel", "necesito asistencia"]) {
      expect(isSupportGemQuestion(normalizeQuestion(question)), question).toBe(false);
      expect(ask(question)).toBeNull();
    }
  });
});

describe("de qué habilidad habla la pregunta", () => {
  it("si la nombra tal cual, esa", () => {
    const found = skillInQuestion(gems, normalizeQuestion("gema de asistencia para Contagio"), witch());
    expect(found?.how).toBe("named");
    expect(found?.skill.name).toBe("Contagio");
  });

  it("si la nombra a medias, la del personaje que más se parece", () => {
    const found = skillInQuestion(gems, normalizeQuestion("gema de asistencia para disparo de caos"), witch());
    expect(found?.how).toBe("similar");
    expect(found?.skill.name).toBe("Descarga de caos");
  });

  it("si no dice ninguna, la principal del personaje", () => {
    const found = skillInQuestion(gems, normalizeQuestion("qué gema de asistencia me pongo"), witch());
    expect(found?.how).toBe("main");
    expect(found?.skill.name).toBe("Descarga de caos");
  });

  it("sin personaje ni nombre, no la adivina", () => {
    expect(skillInQuestion(gems, normalizeQuestion("qué gema de asistencia me pongo"), null)).toBeNull();
    expect(ask("qué gema de asistencia me pongo", witch([]))).toContain("Dime para qué habilidad");
  });
});

describe("la respuesta a una pregunta de gemas", () => {
  it("el caso real: más proyectiles para «disparo de caos»", () => {
    const answer = ask("hay alguna gema de asistencia para disparo de caos que haga que se puede multiplicar?");
    expect(answer).not.toBeNull();
    expect(answer).toContain("Entiendo que hablas de Descarga de caos");
    expect(answer).toContain("Sí. Para Descarga de caos, estas asistencias hacen eso:");
    // Solo propone asistencias que de verdad dan proyectiles, bifurcan o encadenan.
    expect(answer).toMatch(/proyectiles? adicional|bifurc|encaden/i);
    expect(answer).toContain("Disparo múltiple");
    expect(answer).toContain("sin IA");
    // Como mucho tres, una por línea.
    expect(answer!.split("\n").filter((line) => line.startsWith("• ")).length).toBeLessThanOrEqual(3);
  });

  it("sin pedir nada concreto, las que mejor le van", () => {
    const answer = ask("¿Qué gema de asistencia le pongo a Contagio?");
    expect(answer).toContain("Para Contagio, las asistencias que mejor le van son:");
    expect(answer).not.toContain("Entiendo que hablas");
  });

  it("no propone lo que el personaje ya lleva puesto", () => {
    const base = ask("gema de asistencia para Descarga de caos con más proyectiles")!;
    const first = /• ([^(]+) \(/.exec(base)?.[1]?.trim();
    expect(first).toBeTruthy();
    const profile = witch();
    profile.skills[0].supports = [{ name: first!, gemId: null }];
    const again = ask("gema de asistencia para Descarga de caos con más proyectiles", profile)!;
    expect(again).not.toContain(`• ${first} (`);
  });

  it("en inglés contesta en inglés, con los nombres en inglés", () => {
    const answer = ask("is there a support gem for Chaos Bolt that gives more projectiles?", witch(), "en");
    expect(answer).toContain("Yes. For Chaos Bolt, these supports do that:");
    expect(answer).toMatch(/additional projectile|fork|chain/i);
    expect(answer).toContain("no AI");
    expect(answer).not.toMatch(/asistencia|habilidad|grado/);
  });
});

describe("no propone lo que el personaje no puede usar todavía", () => {
  const grades = (answer: string | null) =>
    [...(answer ?? "").matchAll(/\((?:grado|tier) ([IV]+),/g)].map((match) => match[1]);
  const novice = (level: number, skills: string[], archetype?: string) =>
    CharacterProfileSchema.parse({ ...witch(skills), level, ...(archetype ? { archetype } : { archetype: undefined }) });

  it("el caso real: la primera gema para Descarga de caos no es de veneno ni pide un cadáver", () => {
    const answer = ask("tengo mi primera gema de asistencia donde la pongo?")!;
    expect(answer).toContain("Ponla en tu habilidad principal, Descarga de caos.");
    expect(answer).not.toMatch(/veneno|cad[aá]ver/i);
    expect(answer).toContain("Destrucción controlada");
    expect(grades(answer)).toEqual(["I", "I", "I"]);
    // El grado no se ha supuesto por el nivel: no hace falta avisar.
    expect(answer).not.toContain("Solo te enseño");
  });

  it("el caso real: a nivel 14 solo asistencias de grado I, y lo dice", () => {
    const warrior = novice(14, ["Embate rodante", "Terremoto"], "mazo a dos manos, golpes lentos y fuertes");
    const answer = ask("que gema de asistencia le pongo a embate rodante?", warrior)!;
    expect(grades(answer)).toEqual(["I", "I", "I"]);
    expect(answer).toContain("Solo te enseño las de grado I: a nivel 14 son las que seguro puedes tallar.");
    expect(answer).toContain("dímelo en la pregunta");
    // Un mazo no hace daño elemental por sí solo, y Brío le quita el aturdimiento total.
    expect(answer).not.toMatch(/Armamento elemental|Brío/);
  });

  it("desde nivel 15 enseña hasta grado II, nunca más sin que lo pida", () => {
    const answer = ask("¿Qué gema de asistencia le pongo a Contagio?")!;
    expect(grades(answer).every((grade) => grade === "I" || grade === "II")).toBe(true);
    expect(answer).toContain("Solo te enseño hasta grado II.");
  });

  it("si dice el grado de su gema sin tallar, ese manda y no hay aviso", () => {
    const warrior = novice(14, ["Embate rodante"]);
    for (const question of [
      "que gema de asistencia de grado 4 le pongo a embate rodante?",
      "tengo una gema de asistencia sin tallar de nivel 4, cual le pongo a embate rodante?",
      "which tier IV support gem for Rolling Slam?",
    ]) {
      const lang = question.startsWith("which") ? "en" : "es";
      const answer = ask(question, warrior, lang)!;
      expect(grades(answer), question).toContain("IV");
      expect(answer, question).not.toMatch(/Solo te enseño|only showing/);
    }
    // «Soy nivel 5» no es un grado.
    expect(ask("soy nivel 5, que gema de asistencia le pongo a embate rodante?", novice(5, ["Embate rodante"]))).toContain(
      "Solo te enseño las de grado I",
    );
  });

  it("si pide algo concreto, primero las que ya puede tallar", () => {
    const archer = novice(22, ["Flecha de rayo"]);
    const answer = ask("hay alguna gema de asistencia para que flecha de rayo dispare mas flechas?", archer)!;
    const shown = grades(answer);
    expect(shown.length).toBeGreaterThan(0);
    expect(["I", "II"]).toContain(shown[0]);
  });

  it("en inglés avisa en inglés", () => {
    const answer = ask("which support gem for Rolling Slam?", novice(14, ["Embate rodante"]), "en")!;
    expect(answer).toContain("I'm only showing tier I: at level 14 those are the ones you can surely engrave.");
    expect(answer).not.toMatch(/asistencia|grado/);
  });
});

describe("el Mentor completo contesta preguntas de gemas", () => {
  const memory = RecommendationMemorySchema.parse({
    revision: "journal-memory-v1:0000000000000000",
    primaryEntry: null,
    recentCompleted: [],
  });
  const query = (question: string, intentHint?: "next_improvement") => ({
    question,
    ...(intentHint ? { intentHint } : {}),
    // Sin equipo: antes de este cambio el Mentor ni siquiera llegaba a contestar.
    profile: witch(),
    budget: { amount: 50, currency: "chaos" as const },
    goal: { kind: "survival" as const },
    league: "Forbidden Rites",
    patch: "0.5.5",
    memory,
  });

  it("sin IA, sin equipo y sin pasar por el motor", async () => {
    const answer = await answerMentorQuery(
      query("hay alguna gema de asistencia para disparo de caos que haga que se puede multiplicar?"),
      { gems },
    );
    expect(MentorAnswerSchema.safeParse(answer).success).toBe(true);
    expect(answer.unsupported).toBeNull();
    expect(answer.responseMode).toBe("rules");
    expect(answer.nextAction).toBeNull();
    expect(answer.usedRecommendationIds).toEqual([]);
    expect(answer.answer).toContain("Disparo múltiple");
    expect(answer.answer).toContain("A cambio:");
  });

  it("sin los datos de gemas, se comporta como antes", async () => {
    const answer = await answerMentorQuery(query("¿qué gema de asistencia le pongo a Contagio?"), {});
    expect(answer.unsupported).not.toBeNull();
  });

  it("un botón de la web (intención fijada) nunca se toma por una pregunta de gemas", async () => {
    const answer = await answerMentorQuery(query("gema de asistencia para Contagio", "next_improvement"), { gems });
    expect(answer.answer).not.toContain("las asistencias que mejor le van");
  });
});

describe("el Mentor contesta «ayúdame a mejorar <habilidad>»", () => {
  const improve = (question: string, profile = witch(), lang: "es" | "en" = "es") =>
    answerImproveSkillQuestion(gems, question, profile, lang);

  it("la pregunta real de Luis: nivel de la gema, árbol y asistencias", () => {
    const answer = improve("necesito ayuda para mejorar drenar esencia")!;
    expect(answer).toContain("Drenar esencia mejora por tres sitios:");
    // Nivel 44 de personaje: la tabla del juego deja la gema a nivel 11.
    expect(answer).toContain("A tu nivel (44) puedes tenerla a nivel 11");
    expect(answer).toContain("«Tu árbol de pasivas»");
    expect(answer).toContain("Para Drenar esencia, las asistencias que mejor le van son:");
    expect(answer).toContain("sin IA");
  });

  it("si sabe el nivel de la gema, dice cuánto le falta o que ya está al día", () => {
    const withGem = (level: number) =>
      CharacterProfileSchema.parse({
        ...witch(["Drenar esencia"]),
        skills: [{ id: "s0", label: "Drenar esencia", mainSkill: "Drenar esencia", level }],
      });
    expect(improve("como mejoro drenar esencia", withGem(8))).toContain("La llevas a nivel 8 y a tu nivel (44) puedes tenerla a 11");
    expect(improve("como mejoro drenar esencia", withGem(11))).toContain("lo máximo que te deja tu nivel (44)");
  });

  it("en inglés, y solo cuando nombra una habilidad y pide mejorarla", () => {
    expect(improve("how do I improve Essence Drain?", witch(), "en")).toContain("Essence Drain gets better in three places:");
    expect(improve("¿qué mejoro ahora?")).toBeNull();
    expect(improve("¿qué es mejor, drenar esencia o contagio?")).toBeNull();
    expect(asksToImproveNamedSkill(gems, normalizeQuestion("quiero potenciar contagio"))).toBe(true);
  });

  it("llega hasta el jugador por el Mentor, sin «todavía no sé responder eso»", async () => {
    const answer = await answerMentorQuery(
      {
        question: "necesito ayuda para mejorar drenar esencia",
        profile: witch(),
        budget: { amount: 50, currency: "chaos" as const },
        goal: { kind: "survival" as const },
        league: "Forbidden Rites",
        patch: "0.5.5",
        memory: RecommendationMemorySchema.parse({
          revision: "journal-memory-v1:0000000000000000",
          primaryEntry: null,
          recentCompleted: [],
        }),
      },
      { gems },
    );
    expect(answer.unsupported).toBeNull();
    expect(answer.answer).toContain("Drenar esencia mejora por tres sitios:");
  });
});

describe("sin equipo, el Mentor contesta solo lo que es del juego (gameOnly)", () => {
  const ask = (question: string, extra: Record<string, unknown> = {}) =>
    answerMentorQuery(
      {
        question,
        profile: witch(),
        budget: { amount: 50, currency: "chaos" as const },
        goal: { kind: "survival" as const },
        league: "Forbidden Rites",
        patch: "0.5.5",
        memory: RecommendationMemorySchema.parse({
          revision: "journal-memory-v1:0000000000000000",
          primaryEntry: null,
          recentCompleted: [],
        }),
        gameOnly: true,
        ...extra,
      },
      { gems },
    );

  it("una pregunta de gemas se contesta igual que con equipo", async () => {
    const answer = await ask("¿qué gema de asistencia le pongo a Contagio?");
    expect(answer.unsupported).toBeNull();
    expect(answer.answer).toContain("Para Contagio, las asistencias que mejor le van son:");
    expect(answerNeedsCharacter(answer)).toBe(false);
  });

  it("elegir una mejora no pasa por el motor: la web contesta con la revisión rápida", async () => {
    for (const question of ["¿Qué mejoro ahora?", "¿Por qué muero tanto?", "me falta daño"]) {
      const answer = await ask(question);
      expect(answer.nextAction).toBeNull();
      expect(answer.usedRecommendationIds).toEqual([]);
      expect(answer.responseMode).toBe("rules");
      expect(answer.answer).toContain("revisión rápida");
      // Es la señal que usa el chat para enseñar la revisión rápida en su lugar.
      expect(answerNeedsCharacter(answer)).toBe(true);
    }
  });

  it("lo que no sabe lo dice, y un saludo sigue siendo un saludo", async () => {
    const unknown = await ask("¿cuánto cuesta un espejo de Kalandra?");
    expect(unknown.unsupported).not.toBeNull();
    expect(answerNeedsCharacter(unknown)).toBe(false);
    expect((await ask("hola")).intent).toBe("conversation");
  });
});
