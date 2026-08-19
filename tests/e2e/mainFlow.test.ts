import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuildFileSchema } from "../../shared/buildFile.js";
import { createApiApp } from "../../server/app.js";

/**
 * E2E del flujo principal contra un servidor real en puerto efímero:
 * demo → recommendations (budget+goal) → export → reimport → perfil equivalente.
 */

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
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

/** Los types de Node 24 tipan res.json() como unknown: casteamos en tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonOf(res: globalThis.Response): Promise<any> {
  return res.json();
}

describe("e2e: flujo principal (demo → recomendaciones → export → reimport)", () => {
  it("recorre el flujo completo sin errores y con equivalencia de perfil", async () => {
    // 1. Cargar el perfil demo
    const demoRes = await fetch(`${base}/character/demo`);
    expect(demoRes.status).toBe(200);
    const { profile } = await jsonOf(demoRes);
    expect(profile.name).toBe("Demo Gemling");

    // 2. Pedir recomendaciones con presupuesto y objetivo
    const recRes = await postJson("/recommendations", {
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: profile.league,
      patch: profile.patch,
    });
    expect(recRes.status).toBe(200);
    const recBody = await jsonOf(recRes);
    expect(recBody.recommendations).toHaveLength(3);
    const appliedIds: string[] = recBody.recommendations.map((r: { id: string }) => r.id);
    expect(appliedIds[0]).toBe("rec-resistencias-elementales");

    // 3. Exportar el .build con las recomendaciones aplicadas
    const exportRes = await postJson("/export/build", {
      profile,
      appliedRecommendations: appliedIds,
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-disposition")).toContain("attachment");
    const exportedText = await exportRes.text();
    expect(BuildFileSchema.safeParse(JSON.parse(exportedText)).success).toBe(true);

    // 4. Reimportar el archivo exportado
    const reimportRes = await postJson("/import/build", { content: exportedText });
    expect(reimportRes.status).toBe(200);
    const reimportBody = await jsonOf(reimportRes);
    expect(reimportBody.detectedFormat).toBe("build-json");
    expect(reimportBody.warnings).toHaveLength(0);

    // 5. Verificar equivalencia del perfil (ignorando ids/ importedAt regenerados)
    const p = reimportBody.profile;
    expect(p.name).toBe(profile.name);
    expect(p.characterClass).toBe(profile.characterClass);
    expect(p.ascendancy).toBe(profile.ascendancy);
    expect(p.level).toBe(profile.level);
    expect(p.league).toBe(profile.league);
    expect(p.patch).toBe(profile.patch);
    expect(p.attributes).toEqual(profile.attributes);
    expect(p.resistances).toEqual(profile.resistances);
    expect(p.life).toBe(profile.life);
    expect(p.items).toHaveLength(profile.items.length);
    expect(p.skills).toEqual(profile.skills);
    expect(p.passives).toEqual(profile.passives);

    // 6. Las recomendaciones reaplicadas sobre el perfil reimportado son idénticas
    const recRes2 = await postJson("/recommendations", {
      profile: p,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: p.league,
      patch: p.patch,
    });
    const recBody2 = await jsonOf(recRes2);
    expect(recBody2.recommendations.map((r: { id: string }) => r.id)).toEqual(appliedIds);
  });
});
