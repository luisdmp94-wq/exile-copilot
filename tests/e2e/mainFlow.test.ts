import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GggBuildPlannerV1Schema } from "../../shared/gggBuildPlanner.js";
import { createApiApp } from "../../server/app.js";

/**
 * E2E del flujo principal contra un servidor real en puerto efímero:
 * demo → recommendations (budget+goal) → export (.build oficial) → reimport.
 * El formato oficial NO hace round-trip sin pérdida: el e2e verifica que el
 * informe lo declara y que el reimport es honesto (datos ausentes = null).
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
  it("recorre el flujo completo con honestidad de formato oficial", async () => {
    // 1. Cargar el snapshot demo
    const demoRes = await fetch(`${base}/character/demo`);
    expect(demoRes.status).toBe(200);
    const { profile } = await jsonOf(demoRes);
    expect(profile.name).toBe("Demo Gemling");

    // 2. Recomendaciones con presupuesto y objetivo
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
    expect(recBody.inputFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(recBody.recommendations[0].id).toBe("rec-resistencias-elementales");

    // 3. Exportar al formato oficial .build (con las recomendaciones aplicadas)
    const exportRes = await postJson("/export/build", {
      profile,
      appliedRecommendations: recBody.recommendations.map((r: { id: string }) => r.id),
    });
    expect(exportRes.status).toBe(200);
    const exportBody = await jsonOf(exportRes);
    expect(exportBody.fileName.endsWith(".build")).toBe(true);
    expect(GggBuildPlannerV1Schema.safeParse(JSON.parse(exportBody.content)).success).toBe(true);
    // El informe declara lo no exportable: nivel, resistencias, mods, presupuesto...
    expect(exportBody.report.notExportable.length).toBeGreaterThan(0);
    expect(exportBody.report.skippedUnverified.length).toBeGreaterThan(0);
    // Las recomendaciones aplicadas viajan como texto legible, nunca como dato estructurado
    expect(exportBody.content).toContain("Mejoras planificadas:");
    expect(exportBody.content).toContain("Cubrir resistencias elementales hasta el cap");

    // 4. Reimportar el .build exportado → vuelve como PLAN (un .build oficial es un plan,
    //    no una captura del personaje): plan presente, profile ausente.
    const reimportRes = await postJson("/import/build", {
      content: exportBody.content,
      patch: "0.5.4f",
    });
    expect(reimportRes.status).toBe(200);
    const reimportBody = await jsonOf(reimportRes);
    expect(reimportBody.detectedFormat).toBe("ggg-build-planner-v1");
    expect(reimportBody.warnings.length).toBeGreaterThan(0);
    expect(reimportBody.profile).toBeUndefined();
    expect(reimportBody.plan).toBeDefined();
    expect(reimportBody.plan.build.name).toBe(profile.name);
    // Las mejoras planificadas sobreviven al round-trip como texto legible
    expect(reimportBody.plan.build.description).toContain("Mejoras planificadas:");
    // El plan no fabrica stats del personaje
    expect(JSON.stringify(reimportBody.plan)).not.toContain("resistances");

    // 5. El motor sigue funcionando sobre el snapshot demo original (el plan importado
    //    puede usarse como target de referencia, nunca como personaje)
    const recRes2 = await postJson("/recommendations", {
      profile,
      target: {
        name: reimportBody.plan.build.name,
        referenceOnly: true,
        desiredMods: [],
        plan: reimportBody.plan,
      },
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: profile.league,
      patch: profile.patch,
    });
    expect(recRes2.status).toBe(200);
    const recBody2 = await jsonOf(recRes2);
    expect(recBody2.recommendations.length).toBeGreaterThan(0);
    expect(recBody2.recommendations.length).toBeLessThanOrEqual(3);
    for (const rec of recBody2.recommendations) {
      expect(rec.impact.isPartialMetric).toBe(true);
      expect(rec.sources.some((s: { kind: string }) => s.kind === "calculation")).toBe(true);
    }
  });
});
