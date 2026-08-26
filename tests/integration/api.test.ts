import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GggBuildPlannerV1Schema } from "../../shared/gggBuildPlanner.js";
import {
  CharacterJournalSchema,
  CharacterProfileSchema,
  PLACEHOLDER_CHARACTER_LEVEL,
  readCharacterLevel,
} from "../../shared/domain.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
import { CraftingKnowledgeResponseSchema } from "../../shared/api.js";
import { closeApiApp, createApiApp } from "../../server/app.js";

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
  it("cierra SQLite una sola vez aunque el lifecycle se invoque repetidamente", () => {
    const managed = createApiApp({
      dbPath: ":memory:",
      config: { poeNinjaOffline: true },
    });
    expect(closeApiApp(managed)).toBe(true);
    expect(closeApiApp(managed)).toBe(false);
  });

  it("conserva la procedencia del nivel al guardar y restaurar un perfil mínimo", async () => {
    const minimal = CharacterProfileSchema.parse({
      id: "nivel-placeholder-api",
      name: "Nuevo personaje",
      characterClass: "Desconocida",
      level: PLACEHOLDER_CHARACTER_LEVEL,
      levelSource: "placeholder",
      league: "Liga",
      patch: "0.5.4f",
      importedAt: "2026-08-23T00:00:00.000Z",
    });
    expect((await postJson("/character", { profile: minimal })).status).toBe(200);

    const restored = CharacterProfileSchema.parse(
      (await jsonOf(await fetch(`${base}/character/${minimal.id}`))).profile,
    );
    expect(restored.levelSource).toBe("placeholder");
    expect(readCharacterLevel(restored).known).toBe(false);

    // Un perfil legacy guardado sin `levelSource` sigue cargando y no asciende
    // su mínimo técnico a nivel observado.
    const legacy = {
      ...JSON.parse(JSON.stringify(minimal)),
      id: "nivel-legacy-api",
    } as Record<string, unknown>;
    delete legacy.levelSource;
    expect((await postJson("/character", { profile: legacy })).status).toBe(200);

    const legacyRestored = CharacterProfileSchema.parse(
      (await jsonOf(await fetch(`${base}/character/nivel-legacy-api`))).profile,
    );
    expect(legacyRestored.levelSource).toBeUndefined();
    expect(readCharacterLevel(legacyRestored)).toEqual({
      known: false,
      level: null,
      provenance: "legacy-placeholder",
    });
  });

  it("persiste la identidad de build y la incluye en la revisión del mentor", async () => {
    const profile = CharacterProfileSchema.parse({
      ...JSON.parse(
        readFileSync(
          fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
          "utf8",
        ),
      ),
      id: "build-memory-api",
    });
    await postJson("/character", { profile });
    const empty = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const initialRevision = buildRecommendationMemory(empty).revision;
    const weapon = profile.items.find((item) => item.slot === "weapon")!;

    const createdResponse = await postJson(`/journal/${profile.id}/build-memory`, {
      kind: "core",
      label: "Mi arma actual",
      reason: "Sostiene la identidad de esta variante.",
      relatedItemIds: [weapon.id],
      reconsiderWhen: null,
      journalRevision: initialRevision,
    });
    expect(createdResponse.status).toBe(201);
    const created = await jsonOf(createdResponse);
    expect(created.journal.buildMemory).toHaveLength(1);
    expect(created.entry.kind).toBe("core");
    const nextRevision = buildRecommendationMemory(created.journal).revision;
    expect(nextRevision).not.toBe(initialRevision);

    const archivedResponse = await patchJson(
      `/journal/${profile.id}/build-memory/${created.entry.id}`,
      { active: false, journalRevision: nextRevision },
    );
    expect(archivedResponse.status).toBe(200);
    const archived = await jsonOf(archivedResponse);
    expect(archived.entry.active).toBe(false);
    expect(archived.journal.buildMemory).toEqual([]);
  });

  it("rechaza carreras entre pestañas y evita duplicar una regla con revisión obsoleta", async () => {
    const profile = CharacterProfileSchema.parse({
      ...JSON.parse(
        readFileSync(
          fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
          "utf8",
        ),
      ),
      id: "build-memory-race",
    });
    await postJson("/character", { profile });
    const initial = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const sharedRevision = buildRecommendationMemory(initial).revision;
    const first = await postJson(`/journal/${profile.id}/build-memory`, {
      kind: "core",
      label: "Regla creada en la pestaña A",
      reason: "Debe ganar la primera escritura válida.",
      relatedItemIds: [],
      reconsiderWhen: null,
      journalRevision: sharedRevision,
    });
    expect(first.status).toBe(201);

    const stale = await postJson(`/journal/${profile.id}/build-memory`, {
      kind: "experimental",
      label: "Regla creada en la pestaña B",
      reason: "Parte de una revisión que ya quedó obsoleta.",
      relatedItemIds: [],
      reconsiderWhen: null,
      journalRevision: sharedRevision,
    });
    expect(stale.status).toBe(409);
    expect((await jsonOf(stale)).error).toBe("memoria-diario-obsoleta");

    const afterRace = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    expect(afterRace.buildMemory.map((entry) => entry.label)).toEqual([
      "Regla creada en la pestaña A",
    ]);
  });

  it("rechaza vincular memoria a un objeto que no pertenece al personaje", async () => {
    const profile = CharacterProfileSchema.parse({
      ...JSON.parse(
        readFileSync(
          fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
          "utf8",
        ),
      ),
      id: "build-memory-unknown-item",
    });
    await postJson("/character", { profile });
    const journal = CharacterJournalSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const response = await postJson(`/journal/${profile.id}/build-memory`, {
      kind: "core",
      label: "Objeto ajeno",
      reason: "No debe aceptarse sin pertenecer al snapshot guardado.",
      relatedItemIds: ["item-que-no-existe"],
      reconsiderWhen: null,
      journalRevision: buildRecommendationMemory(journal).revision,
    });
    expect(response.status).toBe(400);
    expect((await jsonOf(response)).error).toBe("objeto-de-memoria-desconocido");
  });

  it("GET /health responde con el parche completo y su cobertura real", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.ok).toBe(true);
    expect(body.patch).toEqual({
      id: "0.5.4f",
      content: "0.5.4",
      hotfix: "f",
      asOf: "2026-08-12",
      source: expect.stringContaining("0.5.4f Hotfix"),
    });
    expect(body.services).toEqual({
      mentor: { mode: "rules-only", provider: null },
    });
    expect(body.compatibility).toMatchObject({
      patchId: "0.5.4f",
      status: "limited",
      reviewedAt: "2026-08-22",
    });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /health declara la IA externa solo cuando está realmente configurada", async () => {
    const aiApp = createApiApp({
      dbPath: ":memory:",
      config: {
        poeNinjaOffline: true,
        mentorAiEnabled: true,
        mentorAiProvider: "groq",
        mentorAiApiKey: "secreto-que-no-puede-salir",
      },
    });
    const aiServer = await new Promise<Server>((resolve) => {
      const candidate = aiApp.listen(0, () => resolve(candidate));
    });
    try {
      const { port } = aiServer.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const raw = await response.text();
      const body = JSON.parse(raw);
      expect(body.services).toEqual({
        mentor: { mode: "ai-assisted", provider: "groq" },
      });
      expect(raw).not.toContain("secreto-que-no-puede-salir");
      expect(raw).not.toContain("gsk_");
    } finally {
      await new Promise<void>((resolve, reject) =>
        aiServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("importa un .build válido mayor que el límite implícito de Express", async () => {
    const description = "x".repeat(512 * 1024);
    const content = JSON.stringify({
      name: "Build grande de prueba",
      author: "Exile Copilot",
      description,
      passives: ["strength17"],
    });
    const response = await postJson("/import/build", { content, patch: "0.5.4f" });
    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    expect(body.detectedFormat).toBe("ggg-build-planner-v1");
    expect(body.plan.build.description).toHaveLength(description.length);
  });

  it("distingue JSON roto de un error interno sin devolver el contenido", async () => {
    const marker = "CONTENIDO_PRIVADO_NO_REPETIR";
    const response = await fetch(`${base}/import/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: `{"content":"${marker}",`,
    });
    expect(response.status).toBe(400);
    const raw = await response.text();
    expect(JSON.parse(raw)).toMatchObject({ error: "json-no-valido" });
    expect(raw).not.toContain(marker);
  });

  it("rechaza una carga excesiva con 413 y un mensaje público", async () => {
    const limitedApp = createApiApp({
      dbPath: ":memory:",
      config: { poeNinjaOffline: true, requestBodyLimitBytes: 1024 },
    });
    const limitedServer = await new Promise<Server>((resolve) => {
      const candidate = limitedApp.listen(0, () => resolve(candidate));
    });
    try {
      const { port } = limitedServer.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/import/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "x".repeat(2_000), patch: "0.5.4f" }),
      });
      expect(response.status).toBe(413);
      expect(await jsonOf(response)).toMatchObject({
        error: "carga-demasiado-grande",
        detail: expect.stringContaining("tamaño máximo"),
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        limitedServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rechaza ids inválidos y expedientes desmesurados antes de persistir", async () => {
    const demo = await jsonOf(await fetch(`${base}/character/demo`));
    const blankId = await postJson("/character", {
      profile: { ...demo.profile, id: "   " },
    });
    expect(blankId.status).toBe(400);

    const longId = await postJson("/character", {
      profile: { ...demo.profile, id: "x".repeat(201) },
    });
    expect(longId.status).toBe(400);

    const marker = "NOTA_PRIVADA_DE_TAMAÑO";
    const oversized = await postJson("/character", {
      profile: {
        ...demo.profile,
        id: "expediente-demasiado-grande-prueba",
        notes: marker + "x".repeat(600 * 1024),
      },
    });
    expect(oversized.status).toBe(413);
    const raw = await oversized.text();
    expect(JSON.parse(raw)).toMatchObject({ error: "expediente-demasiado-grande" });
    expect(raw).not.toContain(marker);
    expect(
      (await fetch(`${base}/character/expediente-demasiado-grande-prueba`)).status,
    ).toBe(404);
  });

  it("GET /meta: ligas desde poe.ninja (fixture offline) y parches versionados", async () => {
    const res = await fetch(`${base}/meta`);
    const body = await jsonOf(res);
    expect(body.leagues).toContain("Runes of Aldur");
    expect(body.leagues).toContain("Standard");
    expect(body.patches.map((p: { id: string }) => p.id)).toEqual(["0.5.4f", "0.5.0", "0.3.0"]);
    expect(body.patches[0].asOf).toBe("2026-08-12");
    expect(body.patches[0].source).toContain("pathofexile.com");
    expect(body.compatibility.targetRelease).toMatchObject({
      version: "1.0",
      releaseDate: "2026-12-11",
      status: "announced",
    });
    expect(body.compatibility.patches[0].features).toHaveLength(5);
    expect(body.goals).toContain("survival");
    expect(body.currencies).toEqual(["chaos", "exalted", "divine", "gold"]);
  });

  it("un parche nuevo no hereda la cobertura anterior y exige revisión", async () => {
    const unknownApp = createApiApp({
      dbPath: ":memory:",
      config: { poeNinjaOffline: true, defaultPatch: "1.0" },
    });
    const unknownServer = await new Promise<Server>((resolve) => {
      const candidate = unknownApp.listen(0, () => resolve(candidate));
    });
    try {
      const { port } = unknownServer.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await jsonOf(response);
      expect(body.patch.id).toBe("1.0");
      expect(body.compatibility).toMatchObject({
        patchId: "1.0",
        status: "review-required",
        reviewedAt: null,
      });
      expect(body.compatibility.features).toHaveLength(5);
      expect(
        body.compatibility.features.every(
          (feature: { status: string }) => feature.status === "review-required",
        ),
      ).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        unknownServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("recomendaciones y mentor fallan cerrados para un parche sin revisar", async () => {
    const demo = await jsonOf(await fetch(`${base}/character/demo`));
    const futureProfile = { ...demo.profile, patch: "1.0" };
    const common = {
      profile: futureProfile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: futureProfile.league,
      patch: "1.0",
    };

    const recommendations = await postJson("/recommendations", common);
    expect(recommendations.status).toBe(422);
    expect(await jsonOf(recommendations)).toMatchObject({ error: "parche-sin-revisar" });

    const mentor = await postJson("/mentor/query", {
      ...common,
      question: "¿Qué mejoro ahora?",
    });
    expect(mentor.status).toBe(422);
    expect(await jsonOf(mentor)).toMatchObject({ error: "parche-sin-revisar" });
  });

  it("rechaza mezclar el parche del personaje con otro en la petición", async () => {
    const demo = await jsonOf(await fetch(`${base}/character/demo`));
    const response = await postJson("/recommendations", {
      profile: demo.profile,
      budget: { amount: 50, currency: "chaos" },
      goal: { kind: "survival" },
      league: demo.profile.league,
      patch: "1.0",
    });
    expect(response.status).toBe(400);
    expect(await jsonOf(response)).toMatchObject({ error: "parche-no-coincide" });
  });

  it("POST /import/build con el ejemplo oficial de GGG devuelve PLAN (nunca perfil)", async () => {
    const res = await postJson("/import/build", { content: titanBuildContent, patch: "0.5.4f" });
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
    const res = await postJson("/import/build", { content: titanBuildContent, patch: "0.5.4f" });
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
  it("POST /import/build conserva el plan pero no usa pasivas antiguas en 1.0", async () => {
    const res = await postJson("/import/build", { content: titanBuildContent, patch: "1.0" });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.plan.build).toEqual(JSON.parse(titanBuildContent));
    expect(body.resolution).toBeUndefined();
    expect(body.warnings.join(" ")).toContain("no está verificado para el parche 1.0");
  });

  it("POST /import/build exige declarar el parche activo", async () => {
    const res = await postJson("/import/build", { content: titanBuildContent });
    expect(res.status).toBe(400);
    expect(await jsonOf(res)).toMatchObject({ error: "validacion-fallida" });
  });

  it("POST /import/build con basura devuelve 400 con ApiError", async () => {
    const res = await postJson("/import/build", { content: "basura total", patch: "0.5.4f" });
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
    const res = await postJson("/import/item-text", { text: demoItemText, patch: "0.5.4f" });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.item.slot).toBe("weapon");
    expect(body.item.baseType).toBe("Varnished Crossbow");
  });

  it("POST /import/item-text no interpreta objetos con un parche sin revisar", async () => {
    const missingPatch = await postJson("/import/item-text", { text: demoItemText });
    expect(missingPatch.status).toBe(400);

    const future = await postJson("/import/item-text", { text: demoItemText, patch: "1.0" });
    expect(future.status).toBe(422);
    expect(await jsonOf(future)).toMatchObject({ error: "parche-sin-revisar" });
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
    expect(body.profile.id).toMatch(/^demo-[0-9a-f-]{36}$/);
    expect(body.profile.items[0]).toMatchObject({
      id: "demo-item-weapon",
      craftingState: {
        corrupted: false,
        mirrored: false,
        split: false,
        unidentified: false,
      },
    });
    expect(body.profile.items[0].modifiers.map((modifier: { affix?: string }) => modifier.affix)).toEqual([
      "prefix",
      "prefix",
      "suffix",
    ]);

    const second = await jsonOf(await fetch(`${base}/character/demo`));
    expect(second.profile.id).not.toBe(body.profile.id);
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
      buildMemory: [],
      session: null,
      pausedSessions: [],
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

  it("GET /crafting/knowledge expone acciones observadas pero bloquea probabilidades", async () => {
    const res = await fetch(
      `${base}/crafting/knowledge?itemClass=Ballestas&baseType=Ballesta%20barnizada&patch=0.5.4f`,
    );
    expect(res.status).toBe(200);
    const body = CraftingKnowledgeResponseSchema.parse(await jsonOf(res));

    expect(body.requestedPatch).toBe("0.5.4f");
    expect(body.evidencePatch).toBeNull();
    expect(body.coverage).toMatchObject({
      id: "basic-crafting",
      status: "limited",
    });
    expect(body.coverage.evidenceIds).toContain(
      "poe2-observed-currency-actions-2026-08-22",
    );
    expect(body.completeness).toBe("observed-only");
    expect(body.actions.map((action) => action.id)).toEqual([
      "transmutation",
      "augmentation",
      "regal",
      "exalted",
    ]);
    expect(body.modPool.status).toBe("unavailable");
    expect(body.modPool.probabilityBasis).toBe("insufficient");
    expect(body.modPool.limitations.join(" ")).toContain("No existe pool de modificadores");
    expect(body.modPool).not.toHaveProperty("candidates");
  });

  it("GET /crafting/knowledge exige parche y falla cerrado para 1.0", async () => {
    const withoutPatch = await fetch(
      `${base}/crafting/knowledge?itemClass=Ballestas&baseType=Ballesta%20barnizada`,
    );
    expect(withoutPatch.status).toBe(400);
    expect(await jsonOf(withoutPatch)).toMatchObject({ error: "parche-requerido" });

    const future = await fetch(
      `${base}/crafting/knowledge?itemClass=Ballestas&baseType=Ballesta%20barnizada&patch=1.0`,
    );
    expect(future.status).toBe(422);
    expect(await jsonOf(future)).toMatchObject({ error: "parche-sin-revisar" });
  });

  it("GET /market/prices offline: fixtures degradados + primaryCurrency + rates (objeto con origen)", async () => {
    const res = await fetch(
      `${base}/market/prices?names=Divine%20Orb,Cosa%20Inventada&patch=0.5.4f`,
    );
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
    const res = await fetch(`${base}/market/prices?patch=0.5.4f`);
    expect(res.status).toBe(400);
  });

  it("GET /market/prices no mezcla precios con un parche sin revisar", async () => {
    const missingPatch = await fetch(`${base}/market/prices?names=Divine%20Orb`);
    expect(missingPatch.status).toBe(400);
    expect(await jsonOf(missingPatch)).toMatchObject({ error: "parche-requerido" });

    const future = await fetch(`${base}/market/prices?names=Divine%20Orb&patch=1.0`);
    expect(future.status).toBe(422);
    expect(await jsonOf(future)).toMatchObject({ error: "parche-sin-revisar" });
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
