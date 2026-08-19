import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuildFileSchema } from "../../shared/buildFile.js";
import { CharacterProfileSchema } from "../../shared/domain.js";
import { createApiApp } from "../../server/app.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApiApp({
    dbPath: ":memory:",
    config: { poeNinjaOffline: true },
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

async function postJson(path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Los types de Node 24 tipan res.json() como unknown: casteamos en tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonOf(res: globalThis.Response): Promise<any> {
  return res.json();
}

const demoBuildContent = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/demoBuild.build.json", import.meta.url)),
  "utf8",
);
const demoItemText = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/demoItemText.txt", import.meta.url)),
  "utf8",
);

describe("api (integración, app Express con db :memory:)", () => {
  it("GET /health responde ok con parche", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.ok).toBe(true);
    expect(body.patch).toBe("0.5.0");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /meta devuelve ligas, parches, goals y divisas", async () => {
    const res = await fetch(`${base}/meta`);
    const body = await jsonOf(res);
    expect(body.leagues).toContain("Runes of Aldur");
    expect(body.goals).toContain("survival");
    expect(body.currencies).toEqual(["chaos", "exalted", "divine", "gold"]);
    expect(body.archetypes[0].id).toBe("mercenary-crossbow");
  });

  it("POST /import/build con el fixture devuelve perfil válido", async () => {
    const res = await postJson("/import/build", { content: demoBuildContent });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.detectedFormat).toBe("build-json");
    expect(CharacterProfileSchema.safeParse(body.profile).success).toBe(true);
    expect(body.profile.name).toBe("Demo Gemling");
  });

  it("POST /import/build con basura devuelve 400 con ApiError", async () => {
    const res = await postJson("/import/build", { content: "basura total" });
    expect(res.status).toBe(400);
    const body = await jsonOf(res);
    expect(body.error).toBeTruthy();
  });

  it("POST /import/build sin content devuelve 400", async () => {
    const res = await postJson("/import/build", {});
    expect(res.status).toBe(400);
    const body = await jsonOf(res);
    expect(body.error).toBe("validacion-fallida");
  });

  it("POST /import/item-text parsea texto del juego", async () => {
    const res = await postJson("/import/item-text", { text: demoItemText });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.item.slot).toBe("weapon");
    expect(body.item.baseType).toBe("Varnished Crossbow");
  });

  it("POST /character guarda y GET /character/:id recupera", async () => {
    const demoRes = await fetch(`${base}/character/demo`);
    const { profile } = await jsonOf(demoRes);
    const save = await postJson("/character", { profile });
    expect(save.status).toBe(200);

    const get = await fetch(`${base}/character/${profile.id}`);
    expect(get.status).toBe(200);
    const body = await jsonOf(get);
    expect(body.profile.id).toBe(profile.id);
    expect(body.profile.name).toBe(profile.name);
  });

  it("GET /character/demo devuelve el perfil de demostración", async () => {
    const res = await fetch(`${base}/character/demo`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(CharacterProfileSchema.safeParse(body.profile).success).toBe(true);
    expect(body.profile.characterClass).toBe("Mercenary");
  });

  it("GET /market/prices offline usa fixtures (degraded) y nunca inventa precios", async () => {
    const res = await fetch(`${base}/market/prices?names=Divine%20Orb,Cosa%20Inventada`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.degraded).toBe(true);
    expect(body.quotes[0].value).toBe(1); // Divine Orb = moneda primaria del fixture
    expect(body.quotes[0].currency).toBe("divine");
    expect(body.quotes[0].verified).toBe(false);
    expect(body.quotes[1].value).toBeNull();
    expect(body.quotes[1].detail).toContain("No verificado");
  });

  it("GET /market/prices sin names devuelve 400", async () => {
    const res = await fetch(`${base}/market/prices`);
    expect(res.status).toBe(400);
  });

  it("POST /recommendations devuelve hasta 3 recomendaciones válidas", async () => {
    const demoRes = await fetch(`${base}/character/demo`);
    const { profile } = await jsonOf(demoRes);
    const res = await postJson("/recommendations", {
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: profile.league,
      patch: profile.patch,
    });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.engineVersion).toBe("1.0.0");
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations.length).toBeLessThanOrEqual(3);
    expect(body.recommendations[0].id).toBe("rec-resistencias-elementales");
    for (const rec of body.recommendations) {
      expect(rec.impact.isPartialMetric).toBe(true);
      expect(rec.sources.some((s: { kind: string }) => s.kind === "calculation")).toBe(true);
    }
  });

  it("POST /export/build descarga JSON válido con Content-Disposition", async () => {
    const demoRes = await fetch(`${base}/character/demo`);
    const { profile } = await jsonOf(demoRes);
    const res = await postJson("/export/build", { profile, appliedRecommendations: ["rec-resistencias-elementales"] });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="exile-copilot.build.json"');
    expect(res.headers.get("content-type")).toContain("application/json");
    const text = await res.text();
    const parsed = BuildFileSchema.safeParse(JSON.parse(text));
    expect(parsed.success).toBe(true);
  });
});
