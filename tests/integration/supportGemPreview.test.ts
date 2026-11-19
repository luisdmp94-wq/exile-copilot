import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp } from "../../server/app.js";
import { mainSkillOf, teaserGradeFor } from "../../src/lib/skillGemTeaser.js";

const TOKEN = "clave-de-prueba-de-vista-previa-123456";

describe("«gemas para tu habilidad»: la vista previa del consejero", () => {
  let server: Server;
  let base: string;
  let aiCalls = 0;

  beforeAll(async () => {
    const app = createApiApp({
      dbPath: ":memory:",
      config: { poeNinjaOffline: true, statsToken: TOKEN },
      // Una IA que deja rastro si alguien la llama.
      supportPlanExplainer: async ({ pairs }) => {
        aiCalls += 1;
        return pairs.map((pair) => ({ skill: pair.skill.name, support: pair.support.name, reason: "Explicación de la IA para la prueba." }));
      },
    });
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/131.0" },
      body: JSON.stringify(body),
    });
  const request = { skill: "tempest flurry", maxGrade: 2, attributes: ["Int", "Des", "Fue"], lang: "en" };
  const uses = async () => {
    const response = await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const { days } = (await response.json()) as { days: Array<{ uses: Record<string, number> }> };
    return days[0]?.uses ?? {};
  };

  it("responde con las reglas, sin IA, aunque la habilidad venga en minúsculas", async () => {
    const response = await post("/advice/support-gem/preview", request);
    expect(response.status).toBe(200);
    const answer = (await response.json()) as { skill: { name: string }; recommended: { name: string; reason: string } | null; mode: string; alternatives: unknown[] };
    expect(answer.skill.name).toBe("Tempest Flurry");
    expect(answer.recommended?.name).toBeTruthy();
    expect(answer.recommended?.reason.length).toBeGreaterThan(10);
    expect(answer.mode).toBe("rules");
    expect(answer.alternatives.length).toBeGreaterThan(0);
    expect(aiCalls).toBe(0);
  });

  it("no cuenta como uso; el consejero de verdad sí", async () => {
    expect((await uses()).gema).toBeUndefined();
    expect((await post("/advice/support-gem", request)).status).toBe(200);
    expect((await uses()).gema).toBe(1);
    expect(aiCalls).toBe(1);
    await post("/advice/support-gem/preview", request);
    expect((await uses()).gema).toBe(1);
  });

  it("una habilidad que la web no conoce no es un error: responde «nada que enseñar»", async () => {
    const response = await post("/advice/support-gem/preview", { ...request, skill: "Golpe inventado" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ recommended: null, alternatives: [] });
    // El consejero de verdad sí avisa de que no la conoce.
    expect((await post("/advice/support-gem", { ...request, skill: "Golpe inventado" })).status).toBe(404);
  });
});

describe("«gemas para tu habilidad»: qué habilidad y qué grado", () => {
  const skill = (mainSkill: string, label = "") => ({ mainSkill, label }) as never;

  it("usa la primera habilidad que el jugador apuntó", () => {
    expect(mainSkillOf({ skills: [skill("Tempest Flurry"), skill("Killing Palm")] })).toBe("Tempest Flurry");
    expect(mainSkillOf({ skills: [skill("  "), skill("", "Contagio")] })).toBe("Contagio");
    expect(mainSkillOf({ skills: [] })).toBeNull();
  });

  it("al empezar enseña grado I; más adelante, hasta grado II", () => {
    expect(teaserGradeFor(null)).toBe(1);
    expect(teaserGradeFor(6)).toBe(1);
    expect(teaserGradeFor(15)).toBe(2);
    expect(teaserGradeFor(90)).toBe(2);
  });
});

describe("lo que la asistencia da, en una línea", () => {
  it("salta lo que quita y cuenta lo que aporta", async () => {
    const { supportMainBenefit } = await import("../../shared/supportGemAdvice.js");
    expect(
      supportMainBenefit({
        description: "Asiste ataques…",
        effects: ["Las habilidades asistidas no pueden quemar", "Los ataques asistidos ganan el 30% del daño como daño de fuego"],
      }),
    ).toBe("Los ataques asistidos ganan el 30% del daño como daño de fuego");
    expect(supportMainBenefit({ description: "Supported skills always Chain…", effects: ["Supported Skills Cannot inflict Shock"] })).toBe(
      "Supported skills always Chain…",
    );
    expect(supportMainBenefit({ description: "", effects: ["Las habilidades asistidas infligen un 30% más de daño"] })).toBe(
      "Las habilidades asistidas infligen un 30% más de daño",
    );
  });
});

describe("lo que la asistencia da, cuando solo lo cuenta su descripción", () => {
  it("se salta la frase de «a qué asiste» y cuenta lo que hace", async () => {
    const { supportMainBenefit } = await import("../../shared/supportGemAdvice.js");
    expect(
      supportMainBenefit({
        description:
          "Asiste habilidades de proyectiles y habilidades que pueden encadenarse. Las habilidades asistidas siempre se encadenan cuando impactan inicialmente a un enemigo electrocutado. No asiste habilidades que no puedan encadenarse.",
        effects: ["Las habilidades asistidas no pueden aplicar electrocución"],
      }),
    ).toBe("Las habilidades asistidas siempre se encadenan cuando impactan inicialmente a un enemigo electrocutado.");
  });
});
