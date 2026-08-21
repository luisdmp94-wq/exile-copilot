import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GggBuildPlannerV1Schema } from "../../shared/gggBuildPlanner.js";
import { CharacterJournalSchema, CharacterProfileSchema } from "../../shared/domain.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
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

async function patchJson(path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Los types de Node 24 tipan res.json() como unknown: casteamos en tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonOf(res: globalThis.Response): Promise<any> {
  return res.json();
}

const titanBuildContent = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/ggg/titanWarrior.build.json", import.meta.url)),
  "utf8",
);
const demoItemText = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/demoItemText.txt", import.meta.url)),
  "utf8",
);

describe("api (integración, app Express con db :memory:)", () => {
  it("GET /health responde ok con patch objeto {content, hotfix, asOf, source}", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.ok).toBe(true);
    expect(body.patch).toEqual({
      content: "0.5.4",
      hotfix: "f",
      asOf: "2026-08-12",
      source: expect.stringContaining("0.5.4f Hotfix"),
    });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /meta: ligas desde poe.ninja (fixture offline) y parches versionados", async () => {
    const res = await fetch(`${base}/meta`);
    const body = await jsonOf(res);
    expect(body.leagues).toContain("Runes of Aldur");
    expect(body.leagues).toContain("Standard");
    expect(body.patches.map((p: { id: string }) => p.id)).toEqual(["0.5.4f", "0.5.0", "0.3.0"]);
    expect(body.patches[0].asOf).toBe("2026-08-12");
    expect(body.patches[0].source).toContain("pathofexile.com");
    expect(body.goals).toContain("survival");
    expect(body.currencies).toEqual(["chaos", "exalted", "divine", "gold"]);
  });

  it("POST /import/build con el ejemplo oficial de GGG devuelve PLAN (nunca perfil)", async () => {
    const res = await postJson("/import/build", { content: titanBuildContent });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.detectedFormat).toBe("ggg-build-planner-v1");
    // Un .build oficial es un plan objetivo: plan presente, profile ausente.
    expect(body.profile).toBeUndefined();
    expect(body.plan).toBeDefined();
    expect(body.plan.build.name).toBe("Titan Warrior");
    expect(body.plan.build.ascendancy).toBe("Warrior1");
    expect(typeof body.plan.importedAt).toBe("string");
    // El plan crudo no fabrica stats del personaje.
    expect(JSON.stringify(body.plan)).not.toContain("resistances");
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it("POST /import/build resuelve ids contra el registro oficial sin tocar el plan crudo", async () => {
    const res = await postJson("/import/build", { content: titanBuildContent });
    const body = await jsonOf(res);

    // Resolución PARALELA al plan: 34/34 pasivas y ascendencia oficial.
    expect(body.resolution).toBeDefined();
    expect(body.resolution.totalCount).toBe(34);
    expect(body.resolution.resolvedCount).toBe(34);
    expect(body.resolution.ascendancy).toEqual({
      id: "Warrior1",
      name: "Titan",
      className: "Warrior",
      verified: true,
    });
    expect(body.resolution.source.sourceCommit).toBe(
      "1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6",
    );
    expect(body.resolution.source.testedAgainstPatch).toBe("0.5.4f");

    // El `.build` crudo del plan sigue siendo idéntico al archivo original.
    const original = JSON.parse(titanBuildContent);
    expect(body.plan.build).toEqual(original);
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

  it("POST /character + GET /character/:id: el personaje se recupera tras guardarlo", async () => {
    const demoRes = await fetch(`${base}/character/demo`);
    const { profile } = await jsonOf(demoRes);
    // Corrección manual del usuario: vida exacta que debe sobrevivir al round-trip.
    profile.life = 2150;
    const save = await postJson("/character", { profile });
    expect(save.status).toBe(200);

    // Recuperación (el frontend guarda el id y recarga)
    const get = await fetch(`${base}/character/${profile.id}`);
    expect(get.status).toBe(200);
    const body = await jsonOf(get);
    expect(body.profile.id).toBe(profile.id);
    expect(body.profile.name).toBe(profile.name);
    expect(body.profile.life).toBe(2150); // exacto, sin truncar ni "mejorar"
    expect(body.profile.resistances).toEqual(profile.resistances);
    expect(body.profile.skills).toEqual(profile.skills);

    // Segunda lectura: persiste más allá de la primera recuperación
    const getAgain = await fetch(`${base}/character/${profile.id}`);
    expect(getAgain.status).toBe(200);

    const missing = await fetch(`${base}/character/no-existo`);
    expect(missing.status).toBe(404);
    const missingBody = await jsonOf(missing);
    expect(missingBody.error).toBe("personaje-no-encontrado");
  });

  it("GET /character/demo devuelve el snapshot de demostración", async () => {
    const res = await fetch(`${base}/character/demo`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(CharacterProfileSchema.safeParse(body.profile).success).toBe(true);
    expect(body.profile.characterClass).toBe("Mercenary");
    expect(body.profile.resistances.lightning).toBe(40);
  });

  it("Character Journal persiste una única próxima acción y conserva el resultado", async () => {
    const characterId = "journal-character";

    const emptyRes = await fetch(`${base}/journal/${characterId}`);
    expect(emptyRes.status).toBe(200);
    const empty = await jsonOf(emptyRes);
    expect(empty).toEqual({
      characterId,
      primaryEntryId: null,
      primaryEntry: null,
      entries: [],
      session: null,
      sessionEvents: [],
    });

    const createRes = await postJson(`/journal/${characterId}/entries`, {
      kind: "decision",
      title: "Cubrir resistencia de rayo",
      summary: "Rayo está en 40%; es el cuello de botella defensivo conocido.",
      nextAction: "Enséñame el primer anillo candidato antes de comprarlo.",
      relatedItemIds: ["demo-item-ring1"],
      sources: [
        {
          kind: "user",
          label: "Perfil del personaje",
          retrievedAt: "2026-08-20T10:00:00.000Z",
        },
      ],
      context: {
        characterLevel: 70,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: { amount: 50, currency: "exalted" },
        goal: "survival",
      },
      recommendationSnapshot: null,
      makePrimary: true,
    });
    expect(createRes.status).toBe(201);
    const created = await jsonOf(createRes);
    expect(created.entry.status).toBe("active");
    expect(created.entry.result).toBeNull();
    expect(created.journal.primaryEntryId).toBe(created.entry.id);
    expect(created.journal.primaryEntry.nextAction).toContain("anillo candidato");

    // Una nota secundaria se conserva sin reemplazar la próxima acción.
    const noteRes = await postJson(`/journal/${characterId}/entries`, {
      kind: "note",
      title: "Restricción de la build",
      summary: "No perder Lightning Infusion durante la prueba.",
      nextAction: null,
      relatedItemIds: [],
      sources: [],
      context: {
        characterLevel: 70,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      makePrimary: false,
    });
    expect(noteRes.status).toBe(201);
    const note = await jsonOf(noteRes);
    expect(note.journal.primaryEntryId).toBe(created.entry.id);
    expect(note.journal.entries).toHaveLength(2);

    const waitingRes = await patchJson(
      `/journal/${characterId}/entries/${created.entry.id}`,
      { status: "waiting_result" },
    );
    expect(waitingRes.status).toBe(200);
    const waiting = await jsonOf(waitingRes);
    expect(waiting.entry.status).toBe("waiting_result");
    expect(waiting.journal.primaryEntryId).toBe(created.entry.id);

    const completedRes = await patchJson(
      `/journal/${characterId}/entries/${created.entry.id}`,
      {
        status: "completed",
        result: "El anillo dejó rayo en 75% sin perder vida.",
      },
    );
    expect(completedRes.status).toBe(200);
    const completed = await jsonOf(completedRes);
    expect(completed.entry.status).toBe("completed");
    expect(completed.entry.resolvedAt).toEqual(expect.any(String));
    expect(completed.journal.primaryEntryId).toBeNull();
    expect(completed.journal.primaryEntry).toBeNull();

    const persistedRes = await fetch(`${base}/journal/${characterId}`);
    const persisted = await jsonOf(persistedRes);
    expect(persisted.entries).toHaveLength(2);
    expect(
      persisted.entries.find((entry: { id: string }) => entry.id === created.entry.id).result,
    ).toContain("75%");

    const wrongCharacter = await patchJson(
      `/journal/otro-personaje/entries/${created.entry.id}`,
      { status: "cancelled" },
    );
    expect(wrongCharacter.status).toBe(404);

    const reopenResolvedAsPrimary = await patchJson(
      `/journal/${characterId}/entries/${created.entry.id}`,
      { makePrimary: true },
    );
    expect(reopenResolvedAsPrimary.status).toBe(400);
  });

  it("Character Journal no completa sin resultado ni espera una acción inexistente", async () => {
    const characterId = "journal-invariants";
    const noteRes = await postJson(`/journal/${characterId}/entries`, {
      kind: "note",
      title: "Dato pendiente",
      summary: "Todavía no hay una acción definida.",
      nextAction: null,
      relatedItemIds: [],
      sources: [],
      context: {
        characterLevel: 70,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      makePrimary: false,
    });
    const note = await jsonOf(noteRes);

    const waitingWithoutAction = await patchJson(
      `/journal/${characterId}/entries/${note.entry.id}`,
      { status: "waiting_result" },
    );
    expect(waitingWithoutAction.status).toBe(400);

    const actionRes = await postJson(`/journal/${characterId}/entries`, {
      kind: "experiment",
      title: "Probar el anillo",
      summary: "La hipótesis todavía necesita un resultado real.",
      nextAction: "Equipar el anillo y comprobar las resistencias.",
      relatedItemIds: [],
      sources: [],
      context: {
        characterLevel: 70,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: null,
        goal: "survival",
      },
      recommendationSnapshot: null,
      makePrimary: true,
    });
    const action = await jsonOf(actionRes);
    const completedWithoutResult = await patchJson(
      `/journal/${characterId}/entries/${action.entry.id}`,
      { status: "completed" },
    );
    expect(completedWithoutResult.status).toBe(400);
    const body = await jsonOf(completedWithoutResult);
    expect(body.error).toBe("resultado-requerido");
  });

  it("Character Journal no permite una próxima acción principal vacía", async () => {
    const res = await postJson("/journal/demo-gemling/entries", {
      kind: "note",
      title: "Nota sin acción",
      summary: "Información de contexto.",
      nextAction: null,
      relatedItemIds: [],
      sources: [],
      context: {
        characterLevel: 70,
        league: "Runes of Aldur",
        patch: "0.5.4f",
        budget: null,
        goal: null,
      },
      recommendationSnapshot: null,
      makePrimary: true,
    });
    expect(res.status).toBe(400);
    const body = await jsonOf(res);
    expect(body.error).toBe("validacion-fallida");
    expect(body.detail).toContain("próxima acción");
  });

  it("GET /market/prices offline: fixtures degradados + primaryCurrency + rates (objeto con origen)", async () => {
    const res = await fetch(`${base}/market/prices?names=Divine%20Orb,Cosa%20Inventada`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.degraded).toBe(true);
    expect(body.primaryCurrency).toBe("divine");
    // rates es un objeto {values, origin, verified, fetchedAt}; fixture → NO verificado
    expect(body.rates.values).toEqual({ exalted: 105, chaos: 35.44 });
    expect(body.rates.origin).toBe("fixture");
    expect(body.rates.verified).toBe(false);
    expect(typeof body.rates.fetchedAt).toBe("string");
    expect(body.quotes[0].value).toBe(1); // Divine Orb = primaria del fixture
    expect(body.quotes[0].currency).toBe("divine");
    expect(body.quotes[0].verified).toBe(false); // fixture → No verificado aunque tenga valor
    expect(body.quotes[1].value).toBeNull();
    expect(body.quotes[1].detail).toContain("No verificado");
  });

  it("GET /market/prices sin names devuelve 400", async () => {
    const res = await fetch(`${base}/market/prices`);
    expect(res.status).toBe(400);
  });

  it("POST /recommendations devuelve hasta 3 recomendaciones + inputFingerprint", async () => {
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
    expect(body.engineVersion).toBe("1.1.0");
    expect(body.inputFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations.length).toBeLessThanOrEqual(3);
    expect(body.recommendations[0].id).toBe("rec-resistencias-elementales");
    for (const rec of body.recommendations) {
      expect(rec.impact.isPartialMetric).toBe(true);
      expect(rec.sources.some((s: { kind: string }) => s.kind === "calculation")).toBe(true);
    }
  });

  it("POST /recommendations se detiene con acción activa y reconcilia un resultado previo", async () => {
    const demoRes = await fetch(`${base}/character/demo`);
    const { profile } = await jsonOf(demoRes);
    profile.id = "memory-api-character";
    const request = {
      profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: profile.league,
      patch: profile.patch,
    };

    const initialRes = await postJson("/recommendations", request);
    const initial = await jsonOf(initialRes);
    const original = initial.recommendations.find(
      (entry: { id: string }) => entry.id === "rec-resistencias-elementales",
    );
    expect(original).toBeDefined();

    const createRes = await postJson(`/journal/${profile.id}/entries`, {
      kind: "decision",
      title: original.title,
      summary: original.reason,
      nextAction: original.action,
      relatedItemIds: original.relatedItemIds,
      sources: original.sources,
      context: {
        characterLevel: profile.level,
        league: profile.league,
        patch: profile.patch,
        budget: request.budget,
        goal: "survival",
      },
      recommendationSnapshot: original,
      makePrimary: true,
    });
    expect(createRes.status).toBe(201);
    const activeJournal = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const activeMemory = buildRecommendationMemory(activeJournal);

    const blockedRes = await postJson("/recommendations", {
      ...request,
      journalRevision: activeMemory.revision,
    });
    expect(blockedRes.status).toBe(200);
    const blocked = await jsonOf(blockedRes);
    expect(blocked.recommendations).toEqual([]);
    expect(blocked.memoryImpact.blockedByPrimaryEntryId).toBe(
      activeJournal.primaryEntryId,
    );

    const completedRes = await patchJson(
      `/journal/${profile.id}/entries/${activeJournal.primaryEntryId}`,
      {
        status: "completed",
        result: "La prueba terminó; todavía debo actualizar el perfil.",
      },
    );
    expect(completedRes.status).toBe(200);

    const staleRes = await postJson("/recommendations", {
      ...request,
      journalRevision: activeMemory.revision,
    });
    expect(staleRes.status).toBe(409);
    expect((await jsonOf(staleRes)).error).toBe("memoria-diario-obsoleta");

    const completedJournal = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const completedMemory = buildRecommendationMemory(completedJournal);
    const reconciledRes = await postJson("/recommendations", {
      ...request,
      journalRevision: completedMemory.revision,
    });
    expect(reconciledRes.status).toBe(200);
    const reconciled = await jsonOf(reconciledRes);
    expect(reconciled.memoryImpact.repeatedRecommendationIds).toContain(
      "rec-resistencias-elementales",
    );
    expect(
      reconciled.recommendations.some(
        (entry: { id: string }) =>
          entry.id === "rec-memoria-resistencias-elementales",
      ),
    ).toBe(true);
  });

  it("POST /recommendations rechaza una decisión si el diario cambia durante el cálculo", async () => {
    let releaseExplainer!: () => void;
    let markExplainerStarted!: () => void;
    const explainerGate = new Promise<void>((resolve) => {
      releaseExplainer = resolve;
    });
    const explainerStarted = new Promise<void>((resolve) => {
      markExplainerStarted = resolve;
    });
    const raceApp = createApiApp({
      dbPath: ":memory:",
      config: { poeNinjaOffline: true },
      explainer: {
        name: "delayed-test",
        explain: async (recommendation) => {
          markExplainerStarted();
          await explainerGate;
          return recommendation.reason;
        },
      },
    });
    const raceServer = await new Promise<Server>((resolve) => {
      const listening = raceApp.listen(0, () => resolve(listening));
    });
    const racePort = (raceServer.address() as AddressInfo).port;
    const raceBase = `http://127.0.0.1:${racePort}`;

    try {
      const { profile } = await jsonOf(await fetch(`${raceBase}/character/demo`));
      profile.id = "toctou-character";
      const pendingRecommendation = fetch(`${raceBase}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          budget: { amount: 50, currency: "chaos" },
          goal: { kind: "survival" },
          league: profile.league,
          patch: profile.patch,
        }),
      });

      await explainerStarted;
      const createPrimary = await fetch(
        `${raceBase}/journal/${profile.id}/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "craft",
            title: "Acción creada desde otra pestaña",
            summary: "Debe invalidar el cálculo que ya estaba esperando.",
            nextAction: "Esperar el resultado de esta acción.",
            relatedItemIds: [],
            sources: [],
            context: {
              characterLevel: profile.level,
              league: profile.league,
              patch: profile.patch,
              budget: null,
              goal: null,
            },
            recommendationSnapshot: null,
            makePrimary: true,
          }),
        },
      );
      expect(createPrimary.status).toBe(201);
      releaseExplainer();

      const response = await pendingRecommendation;
      expect(response.status).toBe(409);
      expect((await jsonOf(response)).error).toBe("memoria-diario-obsoleta");
    } finally {
      releaseExplainer();
      await new Promise<void>((resolve, reject) =>
        raceServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("POST /export/build devuelve JSON {fileName .build, content, report} con mejoras legibles", async () => {
    const demoRes = await fetch(`${base}/character/demo`);
    const { profile } = await jsonOf(demoRes);
    const res = await postJson("/export/build", {
      profile,
      appliedRecommendations: ["rec-resistencias-elementales"],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await jsonOf(res);

    expect(body.fileName.endsWith(".build")).toBe(true);
    expect(GggBuildPlannerV1Schema.safeParse(JSON.parse(body.content)).success).toBe(true);
    expect(body.report.notExportable.length).toBeGreaterThan(0);
    expect(body.report.skippedUnverified.length).toBeGreaterThan(0); // pasivas/skills del demo sin id oficial
    expect(body.report.exported.inventorySlots).toBeGreaterThan(0);
    // La recomendación aplicada aparece como texto legible en el .build
    expect(body.content).toContain("Mejoras planificadas:");
    expect(body.content).toContain("Cubrir resistencias elementales hasta el cap");
  });
});
