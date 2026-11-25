import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp } from "../../server/app.js";

const TOKEN = "clave-de-prueba-de-estadisticas-123456";

async function start(statsToken: string | null) {
  const app = createApiApp({ dbPath: ":memory:", config: { poeNinjaOffline: true, statsToken }, supportPlanExplainer: null });
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const post = (base: string, path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("contador de visitas por la API", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    ({ server, base } = await start(TOKEN));
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("una visita se apunta y una herramienta usada con éxito también", async () => {
    expect((await post(base, "/visit", { page: "inicio", source: "reddit", firstVisit: true, firstToday: true })).status).toBe(204);
    expect(
      (await post(base, "/advice/support-gem", { skill: "Contagio", maxGrade: 1, attributes: ["Int"] })).status,
    ).toBe(200);
    // Una petición que falla no cuenta como uso.
    expect((await post(base, "/advice/support-gem", { skill: "No existe", maxGrade: 1, attributes: ["Int"] })).status).toBe(404);

    const response = await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(response.status).toBe(200);
    const { days } = (await response.json()) as { days: Array<Record<string, unknown>> };
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ visitors: 1, newVisitors: 1, visits: 1, sources: { reddit: 1 }, uses: { gema: 1 } });
  });

  it("un robot que se identifica como tal no suma visitas", async () => {
    const before = (await (await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as { days: Array<{ visits: number }> };
    const response = await fetch(`${base}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 HeadlessChrome/131.0" },
      body: JSON.stringify({ page: "inicio", source: "directo", firstVisit: true, firstToday: true }),
    });
    expect(response.status).toBe(204);
    const after = (await (await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as { days: Array<{ visits: number }> };
    expect(after.days[0].visits).toBe(before.days[0].visits);
  });

  it("el uso del dueño (su navegador guarda la clave) no se suma a las cifras", async () => {
    const usesNow = async () =>
      ((await (await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as {
        days: Array<{ uses: Record<string, number> }>;
      }).days[0].uses.gema ?? 0;
    const before = await usesNow();
    const owner = await fetch(`${base}/advice/support-gem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-visit-owner": "1" },
      body: JSON.stringify({ skill: "Contagio", maxGrade: 1, attributes: ["Int"] }),
    });
    // La herramienta le responde igual: solo deja de contarse.
    expect(owner.status).toBe(200);
    expect(await usesNow()).toBe(before);
    // Un jugador normal sí cuenta.
    expect((await post(base, "/advice/support-gem", { skill: "Contagio", maxGrade: 1, attributes: ["Int"] })).status).toBe(200);
    expect(await usesNow()).toBe(before + 1);
  });

  it("los usos de PoB2 en el navegador se apuntan por su baliza, con su origen", async () => {
    const usesNow = async () =>
      ((await (await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as {
        days: Array<{ uses: Record<string, number>; bySource: Record<string, { uses: Record<string, number> }> }>;
      }).days[0];
    // «donar» es el clic en el enlace de donación del pie: sale a otra web.
    for (const event of ["codigo-pob", "calculo-pob", "exportar-pob", "donar"]) {
      expect((await post(base, "/visit/use", { event, source: "steam" })).status).toBe(204);
    }
    const today = await usesNow();
    expect(today.uses).toMatchObject({ "codigo-pob": 1, "calculo-pob": 1, "exportar-pob": 1, donar: 1 });
    expect(today.bySource.steam?.uses).toMatchObject({ "codigo-pob": 1, "calculo-pob": 1, "exportar-pob": 1, donar: 1 });

    // Solo la lista cerrada del navegador: lo que cuenta el servidor no se puede inflar por aquí.
    expect((await post(base, "/visit/use", { event: "mentor", source: "steam" })).status).toBe(400);
    expect((await post(base, "/visit/use", { event: "codigo-pob", source: "steam", extra: 1 })).status).toBe(400);
    // Un robot que se identifica como tal no suma.
    const bot = await fetch(`${base}/visit/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 HeadlessChrome/131.0" },
      body: JSON.stringify({ event: "codigo-pob", source: "directo" }),
    });
    expect(bot.status).toBe(204);
    expect((await usesNow()).uses["codigo-pob"]).toBe(1);
  });

  it("«Generar recomendaciones» cuenta solo cuando sale bien", async () => {
    // Sin personaje la petición falla y no suma.
    expect((await post(base, "/recommendations", {})).status).toBeGreaterThanOrEqual(400);
    const countNow = async () =>
      ((await (await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as {
        days: Array<{ uses: Record<string, number> }>;
      }).days[0].uses.recomendaciones ?? 0;
    expect(await countNow()).toBe(0);

    const { profile } = (await (await fetch(`${base}/character/demo`)).json()) as {
      profile: { league: string; patch: string };
    };
    const ok = await post(base, "/recommendations", {
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: profile.league,
      patch: profile.patch,
    });
    expect(ok.status).toBe(200);
    expect(await countNow()).toBe(1);
  });

  it("rechaza visitas con datos que no son de la lista cerrada", async () => {
    expect((await post(base, "/visit", { page: "inicio", source: "foro-de-alguien", firstVisit: true, firstToday: true })).status).toBe(400);
    expect(
      (await post(base, "/visit", { page: "inicio", source: "reddit", firstVisit: true, firstToday: true, ip: "1.2.3.4" })).status,
    ).toBe(400);
  });

  it("las cifras solo se ven con la clave buena", async () => {
    expect((await fetch(`${base}/stats`)).status).toBe(401);
    expect((await fetch(`${base}/stats`, { headers: { Authorization: "Bearer otra-clave-cualquiera-de-prueba" } })).status).toBe(401);
  });
});

describe("sin clave configurada", () => {
  it("la ruta de cifras no existe", async () => {
    const { server, base } = await start(null);
    try {
      expect((await fetch(`${base}/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
