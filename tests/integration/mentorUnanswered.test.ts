import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp, gemNamesWithCraftingWords, mentorRequestedPatchFeature } from "../../server/app.js";
import { MentorAnswerSchema } from "../../shared/mentorQuery.js";
import { UnansweredResponseSchema, scrubQuestion } from "../../shared/mentorUnanswered.js";

const TOKEN = "clave-de-prueba-de-preguntas-123456789";

describe("preguntas que el Mentor no supo contestar", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApiApp({ dbPath: ":memory:", config: { poeNinjaOffline: true, statsToken: TOKEN } });
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const ask = async (question: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) => {
    const { profile } = (await (await fetch(`${base}/character/demo`)).json()) as {
      profile: { league: string; patch: string };
    };
    const response = await fetch(`${base}/mentor/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        question,
        profile,
        budget: { amount: 50, currency: "chaos" },
        goal: { kind: "survival" },
        league: profile.league,
        patch: profile.patch,
        ...extra,
      }),
    });
    expect(response.status).toBe(200);
    return MentorAnswerSchema.parse(((await response.json()) as { answer: unknown }).answer);
  };

  const stored = async () => {
    const response = await fetch(`${base}/mentor/unanswered`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(response.status).toBe(200);
    return UnansweredResponseSchema.parse(await response.json()).questions;
  };

  it("solo el dueño, con su clave, puede leerlas", async () => {
    expect((await fetch(`${base}/mentor/unanswered`)).status).toBe(401);
    expect((await fetch(`${base}/mentor/unanswered`, { headers: { Authorization: "Bearer otra-clave" } })).status).toBe(401);
    expect(await stored()).toEqual([]);
  });

  it("no guarda una pregunta que sí contesta", async () => {
    const answer = await ask("¿Qué mejoro ahora?");
    expect(answer.intent).toBe("next_improvement");
    expect(await stored()).toEqual([]);
  });

  it("guarda la pregunta y el motivo, y nada más", async () => {
    const answer = await ask("¿Dónde consigo el Orbe de Albedrío?");
    expect(answer.intent).toBe("unsupported");

    const questions = await stored();
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      question: "¿Dónde consigo el Orbe de Albedrío?",
      reason: "no-entendida",
      lang: "es",
      count: 1,
    });
    expect(questions[0]?.firstDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Ni sesión, ni personaje, ni hora: solo esto.
    const raw = (await (
      await fetch(`${base}/mentor/unanswered`, { headers: { Authorization: `Bearer ${TOKEN}` } })
    ).json()) as { questions: Array<Record<string, unknown>> };
    expect(Object.keys(raw.questions[0] ?? {}).sort()).toEqual(
      ["count", "firstDay", "lastDay", "lang", "question", "reason"].sort(),
    );
  });

  it("la misma pregunta escrita de otra forma suma, no se repite", async () => {
    await ask("donde consigo el orbe de albedrio");
    const questions = await stored();
    expect(questions).toHaveLength(1);
    expect(questions[0]?.count).toBe(2);
    // Se conserva como se escribió la primera vez.
    expect(questions[0]?.question).toBe("¿Dónde consigo el Orbe de Albedrío?");
  });

  it("quita correos, enlaces y números largos antes de guardar", async () => {
    await ask("Soy pepe@ejemplo.com, mi tel 600123456, mira https://ejemplo.com/yo ¿qué es el honor?");
    const saved = (await stored()).map((entry) => entry.question).join("\n");
    expect(saved).toContain("[correo]");
    expect(saved).toContain("[número]");
    expect(saved).toContain("[enlace]");
    expect(saved).not.toMatch(/pepe@|600123456|ejemplo\.com/);
  });

  it("apunta «sin datos» cuando la regla la reconoce pero la web no tiene el dato", async () => {
    const before = (await stored()).length;
    const answer = await ask("¿Qué espectro es mejor para mi build?");
    expect(answer.intent).toBe("conversation");
    const questions = await stored();
    expect(questions).toHaveLength(before + 1);
    expect(questions.find((entry) => entry.question.includes("espectro"))?.reason).toBe("sin-datos");
  });

  it("apunta la respuesta genérica «no veo una causa clara»", async () => {
    const question = "me falta daño y no se por que";
    const { profile } = (await (await fetch(`${base}/character/demo`)).json()) as {
      profile: { items: Array<{ slot: string }>; skills: unknown[]; attributes?: unknown };
    };
    // Sin arma ni habilidades que revisar, el Mentor no ve nada de daño.
    const answer = await ask(question, {
      profile: { ...profile, items: profile.items.filter((item) => item.slot !== "weapon"), skills: [] },
    });
    expect(answer.answer).toMatch(/no veo una causa clara/);
    expect((await stored()).find((entry) => entry.question === question)?.reason).toBe("sin-causa");
  });

  it("la pregunta real de Luis (comparar dos armas) ya se contesta y no se apunta", async () => {
    // En la web, el 24-11-2026, recibió «no veo una causa clara»: llevaba «daño».
    const question = "tengo un arma unica pero no se si esta bien de daño me lo cambio por una varita amarilla?";
    const before = (await stored()).length;
    const answer = await ask(question);
    expect(answer.answer).toContain("«¿Cuál de estas dos es mejor?»");
    expect(answer.answer).not.toMatch(/no veo una causa clara/);
    expect(await stored()).toHaveLength(before);
  });

  it("«Drenar esencia» es una gema, no crafteo con Essences (pregunta real de Luis)", async () => {
    // En la web, el 24-11-2026, recibió «el área Essences, Alloys… no está revisada».
    const question = "que gemas pondrias en drenar esencia?";
    const names = gemNamesWithCraftingWords(["Drenar esencia", "Essence Drain", "Contagio", "Transmutación explosiva"]);
    expect(names).toEqual(["transmutacion explosiva", "drenar esencia", "essence drain"]);
    expect(mentorRequestedPatchFeature(question, undefined, names)).toBeNull();
    expect(mentorRequestedPatchFeature("what gems go in Essence Drain?", undefined, names)).toBeNull();
    // Preguntar por una Essence de verdad sigue parando en el área de crafteo.
    expect(mentorRequestedPatchFeature("uso una esencia en el arma?", undefined, names)).toBe("advanced-crafting");
    expect(mentorRequestedPatchFeature("drenar esencia con una esencia de fuego", undefined, names)).toBe("advanced-crafting");

    const answer = await ask(question);
    expect(answer.answer).toContain("Para Drenar esencia, las asistencias que mejor le van son:");
    expect(answer.answer).not.toMatch(/Essences|no está revisada/);
  });

  it("una duda del juego bien contestada no se apunta", async () => {
    const before = (await stored()).length;
    const answer = await ask("¿Y en atributos qué subo?");
    expect(answer.intent).toBe("conversation");
    expect(await stored()).toHaveLength(before);
  });

  it("no apunta los botones de la web ni a los robots", async () => {
    const before = (await stored()).length;
    await ask("¿Dónde está el mercader del acto 3?", {}, { "User-Agent": "Googlebot/2.1" });
    await ask("Texto de un botón cualquiera", { intentHint: "next_improvement" });
    expect(await stored()).toHaveLength(before);
  });
});

describe("limpieza de la pregunta", () => {
  it("deja intactos los números del juego", () => {
    expect(scrubQuestion("  tengo 1200 de vida   y 75% de fuego, nivel 49 ")).toBe(
      "tengo 1200 de vida y 75% de fuego, nivel 49",
    );
  });
});
