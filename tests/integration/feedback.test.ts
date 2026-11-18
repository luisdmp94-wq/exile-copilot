import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp } from "../../server/app.js";
import { summarizeBrowser } from "../../shared/feedback.js";

const TOKEN = "clave-de-prueba-de-avisos-123456789";

const post = (base: string, body: unknown) =>
  fetch(`${base}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("«Avisar de un problema» por la API", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = createApiApp({ dbPath: ":memory:", config: { poeNinjaOffline: true, statsToken: TOKEN }, supportPlanExplainer: null });
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("guarda el aviso y solo el dueño, con su clave, lo puede leer", async () => {
    const report = {
      text: "Al escribir habilidades en la ficha completa el cuadro pierde el foco.",
      area: "expediente",
      lang: "en",
      viewport: "1280×900",
      browser: "Firefox · Windows",
    };
    expect((await post(base, report)).status).toBe(204);

    expect((await fetch(`${base}/feedback`)).status).toBe(401);
    expect((await fetch(`${base}/feedback`, { headers: { Authorization: "Bearer otra-clave" } })).status).toBe(401);

    const response = await fetch(`${base}/feedback`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(response.status).toBe(200);
    const { reports } = (await response.json()) as { reports: Array<Record<string, unknown>> };
    expect(reports[0]).toMatchObject(report);
    // No se guarda nada que identifique a la persona.
    expect(Object.keys(reports[0] ?? {}).sort()).toEqual(
      ["area", "browser", "createdAt", "id", "lang", "text", "viewport"].sort(),
    );
  });

  it("sin los datos técnicos también vale", async () => {
    expect((await post(base, { text: "No me deja pegar un vial.", lang: "es" })).status).toBe(204);
  });

  it("rechaza un aviso vacío, demasiado largo o con campos de más", async () => {
    expect((await post(base, { text: "  ", lang: "es" })).status).toBe(400);
    expect((await post(base, { text: "x".repeat(1001), lang: "es" })).status).toBe(400);
    expect((await post(base, { text: "Hola, falla algo", lang: "es", email: "a@b.c" })).status).toBe(400);
  });
});

describe("navegador en dos palabras", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 OPR/116.0", "Opera · Windows"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox · Windows"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36", "Chrome · Android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Safari · iOS"],
  ])("%s", (ua, expected) => {
    expect(summarizeBrowser(ua)).toBe(expected);
  });
});
