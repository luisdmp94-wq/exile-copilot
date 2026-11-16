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
