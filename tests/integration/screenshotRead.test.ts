import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../../server/app.js";
import { parseReaderOutput, type ScreenshotReader } from "../../server/advice/screenshotReader.js";
import { tidySkillName } from "../../shared/screenshotRead.js";

const TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

let server: Server | null = null;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

async function start(reader: ScreenshotReader | null) {
  const app = createApiApp({ dbPath: ":memory:", config: { poeNinjaOffline: true }, supportPlanExplainer: null, screenshotReader: reader });
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const post = (base: string, body: unknown) =>
  fetch(`${base}/quick-review/screenshot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("lectura de capturas: lo que devuelve la IA", () => {
  it("la hoja de la Liche de Luis (respuesta real de Qwen, 18-11-2026)", () => {
    const result = parseReaderOutput(`{"screen":"character","sheet":{"level":34,"className":"Liche","life":584,"energyShield":187,"mana":533,"spirit":167,"str":7,"dex":12,"int":126,"fire":28,"cold":23,"lightning":44,"chaos":0},"skills":[]}`);
    expect(result.screen).toBe("character");
    expect(result.sheet).toMatchObject({ level: 34, className: "Liche", fire: 28, cold: 23, lightning: 44 });
  });

  it("quita el ```json que añade a veces y deja los nombres como los escribe un jugador", () => {
    const result = parseReaderOutput("```json\n{\"screen\":\"skills\",\"sheet\":null,\"skills\":[{\"name\":\"DESCARGA DE CAOS\",\"level\":9},{\"name\":\"CONTAGIO\",\"level\":8}]}\n```");
    expect(result.skills).toEqual([
      { name: "Descarga de caos", level: 9 },
      { name: "Contagio", level: 8 },
    ]);
  });

  it("si la IA inventa un nivel imposible, falla en vez de rellenar basura", () => {
    expect(() => parseReaderOutput(`{"screen":"character","sheet":{"level":250},"skills":[]}`)).toThrow();
  });

  it("un nombre con mayúsculas normales se respeta", () => {
    expect(tidySkillName("Essence Drain")).toBe("Essence Drain");
  });
});

describe("lectura de capturas: la ruta", () => {
  it("devuelve lo que lee el lector y cuenta el uso", async () => {
    const base = await start(async () => ({ screen: "skills", sheet: null, skills: [{ name: "Contagio", level: 8 }] }));
    const response = await post(base, { image: TINY_JPEG });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ screen: "skills", sheet: null, skills: [{ name: "Contagio", level: 8 }] });
  });

  it("sin IA configurada responde 503 con un mensaje para rellenar a mano", async () => {
    const base = await start(null);
    const response = await post(base, { image: TINY_JPEG });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toContain("Rellena los datos a mano");
  });

  it("si la IA falla, 502 y el mismo consejo", async () => {
    const base = await start(async () => {
      throw new Error("modelo retirado");
    });
    expect((await post(base, { image: TINY_JPEG })).status).toBe(502);
  });

  it("rechaza lo que no es una imagen", async () => {
    const base = await start(async () => ({ screen: "other", sheet: null, skills: [] }));
    expect((await post(base, { image: "data:text/html;base64,PGgxPg==" })).status).toBe(400);
    expect((await post(base, { image: "hola" })).status).toBe(400);
  });
});
