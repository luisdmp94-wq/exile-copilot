import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CharacterProfileSchema } from "../../shared/domain.js";
import { JournalResponseSchema } from "../../shared/api.js";
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

/** Los types de Node 24 tipan res.json() como unknown: casteamos en tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonOf(res: globalThis.Response): Promise<any> {
  return res.json();
}

async function postJson(path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const demoProfile = CharacterProfileSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
      "utf8",
    ),
  ),
);

describe("API de sesiones adaptativas", () => {
  it("GET /journal incluye sesión nula sin romper el contrato 5A/5B", async () => {
    const profile = { ...demoProfile, id: "sesion-api-vacio" };
    await postJson("/character", { profile });
    const res = await fetch(`${base}/journal/${profile.id}`);
    expect(res.status).toBe(200);
    const journal = JournalResponseSchema.parse(await jsonOf(res));
    expect(journal.session).toBeNull();
    expect(journal.sessionEvents).toEqual([]);
    expect(journal.primaryEntry).toBeNull();
  });

  it("POST /journal/:id/session crea la decisión, envuelve el diario y es idempotente", async () => {
    const profile = { ...demoProfile, id: "sesion-api-start" };
    await postJson("/character", { profile });
    const empty = JournalResponseSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const revision = buildRecommendationMemory(empty).revision;
    const body = {
      journalRevision: revision,
      idempotencyKey: "idem-start-1",
      kind: "guided_decision",
      objective: "Comprobar supervivencia",
      hypothesis: "Un anillo nuevo sube la supervivencia",
      expectedResult: "Aguanto más en un mapa",
      observationMethod: "Juega un mapa y anótalo",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "survival",
    };
    const first = await postJson(`/journal/${profile.id}/session`, body);
    expect(first.status).toBe(201);
    const created = JournalResponseSchema.parse(await jsonOf(first));
    expect(created.session?.status).toBe("waiting_result");
    expect(created.primaryEntryId).toBe(created.session?.activeAction?.journalEntryId);
    expect(created.sessionEvents).toHaveLength(1);

    const replay = await postJson(`/journal/${profile.id}/session`, body);
    expect(replay.status).toBe(201);
    const replayed = JournalResponseSchema.parse(await jsonOf(replay));
    expect(replayed.session?.id).toBe(created.session?.id);

    const second = await postJson(`/journal/${profile.id}/session`, {
      ...body,
      idempotencyKey: "idem-start-2",
      journalRevision: buildRecommendationMemory(created).revision,
    });
    expect(second.status).toBe(400);
    expect((await jsonOf(second)).error).toBe("sesion-ya-activa");
  });

  it("rechaza una revisión obsoleta con 409 memoria-diario-obsoleta", async () => {
    const profile = { ...demoProfile, id: "sesion-api-409" };
    await postJson("/character", { profile });
    const empty = JournalResponseSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const started = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session`, {
          journalRevision: buildRecommendationMemory(empty).revision,
          idempotencyKey: "idem-409-start",
          kind: "guided_decision",
          objective: "Probar",
          hypothesis: "Hipótesis",
          expectedResult: "Resultado",
          observationMethod: "Observa",
          profile,
          budget: { amount: 50, currency: "exalted" },
          goal: "balanced",
        }),
      ),
    );
    const stale = await postJson(`/journal/${profile.id}/session/constraints`, {
      journalRevision: buildRecommendationMemory(empty).revision,
      idempotencyKey: "idem-409-const",
      label: "Barrera voltaica",
      relatedItemIds: [],
      profile,
    });
    expect(stale.status).toBe(409);
    expect((await jsonOf(stale)).error).toBe("memoria-diario-obsoleta");

    const ok = await postJson(`/journal/${profile.id}/session/constraints`, {
      journalRevision: buildRecommendationMemory(started).revision,
      idempotencyKey: "idem-409-ok",
      label: "Barrera voltaica",
      relatedItemIds: [],
      profile,
    });
    expect(ok.status).toBe(200);
    const updated = JournalResponseSchema.parse(await jsonOf(ok));
    expect(updated.session?.constraints[0]?.label).toBe("Barrera voltaica");
  });

  it("registra un resultado subjetivo y un descarte con reapertura candidata", async () => {
    const profile = { ...demoProfile, id: "sesion-api-result" };
    await postJson("/character", { profile });
    const empty = JournalResponseSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const started = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session`, {
          journalRevision: buildRecommendationMemory(empty).revision,
          idempotencyKey: "idem-result-start",
          kind: "skill_experiment",
          objective: "Probar un support",
          hypothesis: "Se siente más fluido",
          expectedResult: "Sensación de fluidez",
          observationMethod: "Un mapa",
          profile,
          budget: { amount: 50, currency: "exalted" },
          goal: "damage",
        }),
      ),
    );
    const subjective = await postJson(`/journal/${profile.id}/session/result`, {
      journalRevision: buildRecommendationMemory(started).revision,
      idempotencyKey: "idem-result-subj",
      result: "Se siente mejor, no lo he medido.",
      subjective: true,
      profile,
    });
    expect(subjective.status).toBe(200);
    const continued = JournalResponseSchema.parse(await jsonOf(subjective));
    expect(continued.session?.conclusion?.kind).toBe("continue");
    expect(continued.session?.lastResult?.subjective).toBe(true);

    const discarded = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session/result`, {
          journalRevision: buildRecommendationMemory(continued).revision,
          idempotencyKey: "idem-result-discard",
          result: "La premisa no encaja con el tooltip.",
          subjective: false,
          conclusion: "discard",
          reopenWhen: "el tooltip vuelve a ser consistente",
          profile,
        }),
      ),
    );
    expect(discarded.session?.status).toBe("discarded");
    const evidence = await postJson(`/journal/${profile.id}/session/evidence`, {
      journalRevision: buildRecommendationMemory(discarded).revision,
      idempotencyKey: "idem-result-ev",
      kind: "confirmed",
      text: "Ahora el tooltip vuelve a ser consistente con el plan.",
      profile,
    });
    expect(evidence.status).toBe(200);
    const candidate = JournalResponseSchema.parse(await jsonOf(evidence));
    expect(candidate.session?.status).toBe("reopening");
    expect(candidate.sessionEvents.at(-1)?.summary).toMatch(/no está demostrada/i);
  });

  it("el regreso rápido mantiene el caso parcial y solo cierra el resuelto", async () => {
    const profile = { ...demoProfile, id: "sesion-api-return-loop" };
    await postJson("/character", { profile });
    const empty = JournalResponseSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const started = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session`, {
          journalRevision: buildRecommendationMemory(empty).revision,
          idempotencyKey: "idem-return-start",
          kind: "guided_decision",
          objective: "Cubrir resistencias",
          hypothesis: "Reducir muertes evitables",
          expectedResult: "Más supervivencia",
          observationMethod: "Jugar un encuentro representativo",
          profile,
          budget: { amount: 50, currency: "exalted" },
          goal: "survival",
        }),
      ),
    );

    const improved = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session/result`, {
          journalRevision: buildRecommendationMemory(started).revision,
          idempotencyKey: "idem-return-improved",
          result: "Mejoró, pero los bosses siguen alcanzándome.",
          subjective: true,
          outcome: "improved",
          profile,
        }),
      ),
    );
    expect(improved.session?.status).toBe("waiting_result");
    expect(improved.session?.lastResult?.outcome).toBe("improved");
    expect(improved.session?.conclusion?.kind).toBe("continue");
    expect(improved.session?.activeAction?.journalEntryId).toBe(
      improved.primaryEntryId,
    );

    const resolved = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session/result`, {
          journalRevision: buildRecommendationMemory(improved).revision,
          idempotencyKey: "idem-return-resolved",
          result: "El problema quedó resuelto.",
          subjective: true,
          outcome: "resolved",
          profile,
        }),
      ),
    );
    expect(resolved.session?.status).toBe("completed");
    expect(resolved.session?.lastResult?.outcome).toBe("resolved");
    expect(resolved.session?.conclusion?.kind).toBe("complete");
    expect(resolved.primaryEntryId).toBeNull();
  });

  it("no inventa un segundo diario: guardar otro paso con sesión abierta falla", async () => {
    const profile = { ...demoProfile, id: "sesion-api-primary" };
    await postJson("/character", { profile });
    const empty = JournalResponseSchema.parse(
      await jsonOf(await fetch(`${base}/journal/${profile.id}`)),
    );
    const started = JournalResponseSchema.parse(
      await jsonOf(
        await postJson(`/journal/${profile.id}/session`, {
          journalRevision: buildRecommendationMemory(empty).revision,
          idempotencyKey: "idem-primary-start",
          kind: "guided_decision",
          objective: "Un solo paso",
          hypothesis: "Solo uno",
          expectedResult: "Uno",
          observationMethod: "Ver",
          profile,
          budget: { amount: 50, currency: "exalted" },
          goal: "balanced",
        }),
      ),
    );
    const blocked = await postJson(`/journal/${profile.id}/entries`, {
      kind: "decision",
      title: "Otro paso",
      summary: "No debería coexistir",
      nextAction: "Hacer otra cosa",
      makePrimary: true,
      context: {
        characterLevel: profile.level,
        league: profile.league,
        patch: profile.patch,
        budget: { amount: 50, currency: "exalted" },
        goal: "balanced",
      },
      journalRevision: buildRecommendationMemory(started).revision,
    });
    expect(blocked.status).toBe(400);
    expect((await jsonOf(blocked)).error).toBe("sesion-ya-activa");
  });

  it("SQLite manda: una pestaña con el snapshot antiguo recibe 409 aunque lo reenvíe", async () => {
    const profile = { ...demoProfile, id: "sesion-api-autoridad" };
    await postJson("/character", { profile });
    const bundle = await jsonOf(await fetch(`${base}/journal/${profile.id}`));
    const started = await postJson(`/journal/${profile.id}/session`, {
      journalRevision: buildRecommendationMemory(bundle, bundle.session).revision,
      idempotencyKey: "api-autoridad-start",
      kind: "guided_decision",
      objective: "Comprobar autoridad de SQLite",
      hypothesis: "El servidor decide con lo guardado",
      expectedResult: "Un resultado observable",
      observationMethod: "Juega un encuentro",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    expect(started.status).toBe(201);
    const startedBody = await jsonOf(started);

    // El personaje cambia DE VERDAD (segundo snapshot, distinto del primero).
    const evolved = { ...profile, level: profile.level + 7, life: (profile.life ?? 0) + 400 };
    const saved = await postJson("/character", { profile: evolved });
    expect(saved.status).toBe(200);

    // La pestaña antigua reenvía SU snapshot: no puede eludir la reconciliación.
    // Se usa la revisión VIGENTE para que el único motivo de 409 sea el perfil.
    const fresh = await jsonOf(await fetch(`${base}/journal/${profile.id}`));
    void startedBody;
    const stale = await postJson(`/journal/${profile.id}/session/constraints`, {
      journalRevision: buildRecommendationMemory(fresh, fresh.session).revision,
      idempotencyKey: "api-autoridad-stale",
      label: "Pieza core",
      relatedItemIds: [],
      profile,
    });
    expect(stale.status).toBe(409);
    expect((await jsonOf(stale)).error).toBe("sesion-incompatible-con-perfil");
  });

  it("una clave idempotente reutilizada con otra operación o payload da 409", async () => {
    const profile = { ...demoProfile, id: "sesion-api-idempotencia" };
    await postJson("/character", { profile });
    const bundle = await jsonOf(await fetch(`${base}/journal/${profile.id}`));
    const revision = buildRecommendationMemory(bundle, bundle.session).revision;
    const payload = {
      journalRevision: revision,
      idempotencyKey: "api-idem-compartida",
      kind: "guided_decision" as const,
      objective: "Primera intención",
      hypothesis: "Primera hipótesis",
      expectedResult: "Un resultado observable",
      observationMethod: "Juega un encuentro",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    };
    expect((await postJson(`/journal/${profile.id}/session`, payload)).status).toBe(201);
    // Mismo payload: reintento honesto.
    expect((await postJson(`/journal/${profile.id}/session`, payload)).status).toBe(201);
    // Payload distinto con la misma clave: conflicto explícito.
    const conflict = await postJson(`/journal/${profile.id}/session`, {
      ...payload,
      objective: "Otra intención completamente distinta",
    });
    expect(conflict.status).toBe(409);
    expect((await jsonOf(conflict)).error).toBe("clave-de-idempotencia-reutilizada");
    // Otra ruta con la misma clave: también conflicto.
    const otherRoute = await postJson(`/journal/${profile.id}/session/constraints`, {
      journalRevision: revision,
      idempotencyKey: "api-idem-compartida",
      label: "Pieza core",
      relatedItemIds: [],
      profile,
    });
    expect(otherRoute.status).toBe(409);
    expect((await jsonOf(otherRoute)).error).toBe("clave-de-idempotencia-reutilizada");
  });
});
