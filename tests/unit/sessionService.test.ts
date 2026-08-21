import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CharacterProfileSchema,
  RecommendationSchema,
  type CharacterProfile,
  type Recommendation,
} from "../../shared/domain.js";
import { buildRecommendationMemory } from "../../shared/journalMemory.js";
import { createDatabase } from "../../server/db/database.js";
import { saveCharacter } from "../../server/db/repositories.js";
import {
  addSessionConstraint,
  addSessionEvidence,
  pauseSession,
  readJournalBundle,
  recordSessionResult,
  reconcileSession,
  reopenSession,
  startDecisionSession,
} from "../../server/decision/sessionService.js";
import { ApiHttpError } from "../../server/errors.js";

function demoProfile(): CharacterProfile {
  const raw = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  );
  return CharacterProfileSchema.parse(JSON.parse(raw));
}

function rec(overrides: Record<string, unknown> = {}): Recommendation {
  return RecommendationSchema.parse({
    id: "rec-test-sesion",
    priority: 1,
    title: "Comprar un anillo nuevo",
    action: "Sustituye el anillo y no toques Barrera voltaica.",
    reason: "Mejora de supervivencia con coste conocido.",
    cost: { min: 80, max: 90, currency: "exalted", known: true },
    impact: {
      metric: "supervivencia",
      description: "Más vida.",
      magnitude: "medium",
      isPartialMetric: true,
    },
    risk: { level: "high", description: "Irreversible si se gasta el recurso." },
    mayLoseValuableMods: true,
    irreversible: true,
    patch: "0.5.4f",
    sources: [
      { kind: "user", label: "Prueba", retrievedAt: "2026-08-20T10:00:00.000Z" },
    ],
    dataUpdatedAt: "2026-08-20T10:00:00.000Z",
    confidence: "medium",
    unverified: [],
    relatedItemIds: ["demo-item-ring1"],
    ...overrides,
  });
}

/**
 * SQLite es la fuente autoritativa del personaje: las operaciones de sesión
 * leen el perfil guardado, no el que envía la pestaña. Por eso el escenario
 * empieza guardándolo, igual que hace la aplicación real con POST /character.
 */
function emptyRevision(profile: CharacterProfile, db = createDatabase(":memory:")) {
  saveCharacter(db, profile.id, JSON.stringify(profile));
  return {
    db,
    revision: readJournalBundle(db, profile.id).memoryRevision,
  };
}

describe("sessionService — criterios 6B", () => {
  it("1. incógnita crítica + irreversible: no autoriza, pide la evidencia", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    saveCharacter(db, profile.id, JSON.stringify(profile));
    const bundle = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-evidencia",
      kind: "guided_decision",
      objective: "Comprobar un anillo",
      hypothesis: "El anillo nuevo sube la supervivencia",
      expectedResult: "Más vida en un mapa",
      observationMethod: "Juega un mapa y anota",
      unknowns: [{ label: "tooltip exacto de la herramienta", blockingIrreversible: true }],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: rec(),
      profile,
      budget: { amount: 200, currency: "exalted" },
      goal: "balanced",
    });
    expect(bundle.journal.session?.activeAction?.blockedReason).toMatch(/tooltip exacto/);
    expect(bundle.journal.session?.activeAction?.irreversible).toBe(false);
    expect(bundle.journal.session?.status).toBe("active");
    expect(bundle.journal.primaryEntry?.nextAction).toMatch(/anota exactamente/i);
    expect(bundle.journal.sessionEvents[0]?.summary).toMatch(/no se autoriza/i);
  });

  it("2. restricción core: conflicto explícito, no sustituye por la siguiente", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const bundle = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-core",
      kind: "guided_decision",
      objective: "Comprobar un anillo",
      hypothesis: "El anillo nuevo sube la supervivencia",
      expectedResult: "Más vida",
      observationMethod: "Juega un mapa",
      unknowns: [],
      constraints: [{ label: "Barrera voltaica", relatedItemIds: [] }],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: rec({ irreversible: false, cost: { min: null, max: null, currency: "exalted", known: false } }),
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    expect(bundle.journal.session?.activeAction?.blockedReason).toMatch(/Barrera voltaica/);
    expect(bundle.journal.session?.activeAction?.summary).toMatch(/conflicto/i);
    expect(bundle.journal.primaryEntry?.recommendationSnapshot).toBeNull();
  });

  it("3. resultado inesperado valioso: se protege y cambia el plan", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const started = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-valioso-start",
      kind: "guided_decision",
      objective: "Probar un support",
      hypothesis: "El support sube el daño",
      expectedResult: "Más daño",
      observationMethod: "Un boss",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    const next = recordSessionResult(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "k-valioso-result",
      result: "El daño no subió, pero apareció una interacción que quiero conservar.",
      subjective: false,
      unexpectedValuable: "interacción rara del totem",
      conclusion: "change_strategy",
      reopenWhen: null,
      profile,
    });
    expect(next.journal.session?.conclusion?.kind).toBe("change_strategy");
    expect(next.journal.session?.constraints.some((c) => c.label === "interacción rara del totem")).toBe(
      true,
    );
    expect(next.journal.session?.hypothesis).toMatch(/interacción rara del totem/);
    expect(next.journal.primaryEntry?.nextAction).toMatch(/interacción rara del totem/);
  });

  it("4. descarte causal + evidencia compatible → candidata, no demostrada", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const started = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-discard-start",
      kind: "guided_decision",
      objective: "Probar un cambio",
      hypothesis: "Esa premisa es necesaria",
      expectedResult: "La premisa se cumple",
      observationMethod: "Lee el tooltip",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    const discarded = recordSessionResult(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "k-discard",
      result: "La premisa era inconsistente con el tooltip.",
      subjective: false,
      unexpectedValuable: null,
      conclusion: "discard",
      reopenWhen: "el tooltip vuelve a ser consistente",
      profile,
    });
    expect(discarded.journal.session?.status).toBe("discarded");
    const reopened = addSessionEvidence(db, profile.id, {
      journalRevision: discarded.memoryRevision,
      idempotencyKey: "k-reopen-ev",
      kind: "confirmed",
      text: "Ahora el tooltip vuelve a ser consistente con el plan.",
      resolvesUnknownLabel: null,
      profile,
    });
    expect(reopened.journal.session?.status).toBe("reopening");
    expect(reopened.journal.session?.conclusion?.kind).toBe("reopen");
    expect(reopened.journal.sessionEvents.at(-1)?.summary).toMatch(/no está demostrada/i);
  });

  it("5. pieza a sustituir o presupuesto → pausa, no fracaso", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const paused = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-budget",
      kind: "equipment_investment",
      objective: "Comprar anillo",
      hypothesis: "El anillo merece el gasto",
      expectedResult: "Entra en presupuesto",
      observationMethod: "Revisa el coste",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: rec({ irreversible: false }),
      profile,
      budget: { amount: 10, currency: "exalted" },
      goal: "balanced",
    });
    expect(paused.journal.session?.status).toBe("paused");
    expect(paused.journal.session?.conclusion?.kind).toBe("pause");
    expect(paused.journal.session?.conclusion?.reason).toMatch(/no es un fracaso/i);
  });

  it("6. feedback subjetivo no se trata como medición", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const started = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-subj-start",
      kind: "skill_experiment",
      objective: "Probar un support",
      hypothesis: "Se siente más fluido",
      expectedResult: "Sensación de fluidez",
      observationMethod: "Juega un mapa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    const next = recordSessionResult(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "k-subj",
      result: "Se siente mejor, pero no lo he medido.",
      subjective: true,
      unexpectedValuable: null,
      reopenWhen: null,
      profile,
    });
    expect(next.journal.session?.conclusion?.kind).toBe("continue");
    expect(next.journal.session?.lastResult?.subjective).toBe(true);
    expect(next.journal.session?.evidence.some((e) => e.kind === "player_subjective")).toBe(
      true,
    );
    expect(next.journal.session?.conclusion?.reason).toMatch(/no queda medida/i);
  });

  it("7. huella distinta: no reutiliza la sesión en silencio", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const started = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-fp-start",
      kind: "guided_decision",
      objective: "Probar",
      hypothesis: "Hipótesis",
      expectedResult: "Resultado",
      observationMethod: "Observa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    // El personaje cambia DE VERDAD: se guarda mutado en SQLite. Reenviar el
    // snapshot antiguo desde la pestaña no puede eludir la reconciliación.
    const mutated = { ...profile, items: [] };
    saveCharacter(db, profile.id, JSON.stringify(mutated));
    expect(() =>
      addSessionConstraint(db, profile.id, {
        journalRevision: started.memoryRevision,
        idempotencyKey: "k-fp-fail",
        label: "pieza core",
        relatedItemIds: [],
        profile,
      }),
    ).toThrow(ApiHttpError);
    const reconciled = reconcileSession(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "k-fp-ok",
      profile: mutated,
    });
    expect(reconciled.journal.session?.needsReconciliation).toBe(false);
    const added = addSessionConstraint(db, profile.id, {
      journalRevision: reconciled.memoryRevision,
      idempotencyKey: "k-fp-after",
      label: "pieza core",
      relatedItemIds: [],
      profile: mutated,
    });
    expect(added.journal.session?.constraints.some((c) => c.label === "pieza core")).toBe(
      true,
    );
  });

  it("9 y 10. 409 por revisión obsoleta e idempotencia de la misma clave", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const first = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-idem",
      kind: "guided_decision",
      objective: "Probar",
      hypothesis: "Hipótesis",
      expectedResult: "Resultado",
      observationMethod: "Observa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    // Reintento HONESTO: misma clave y mismo payload (la revisión no entra en la
    // huella, porque una pestaña que reintenta ya no la tiene fresca).
    const replay = startDecisionSession(db, profile.id, {
      journalRevision: "journal-memory-v1:deadbeefdeadbeef",
      idempotencyKey: "k-idem",
      kind: "guided_decision",
      objective: "Probar",
      hypothesis: "Hipótesis",
      expectedResult: "Resultado",
      observationMethod: "Observa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    expect(replay.journal.session?.id).toBe(first.journal.session?.id);

    // La MISMA clave con otro payload ya no devuelve éxito silencioso: sería
    // contestar con el resultado de una operación que nadie pidió.
    expect(() =>
      startDecisionSession(db, profile.id, {
        journalRevision: revision,
        idempotencyKey: "k-idem",
        kind: "guided_decision",
        objective: "Otra cosa distinta",
        hypothesis: "Otra hipótesis",
        expectedResult: "Otro resultado",
        observationMethod: "Otro método",
        unknowns: [],
        constraints: [],
        soonReplacedItemIds: [],
        protectedResources: [],
        recommendation: null,
        profile,
        budget: { amount: 50, currency: "exalted" },
        goal: "balanced",
      }),
    ).toThrowError(/clave-de-idempotencia-reutilizada/);

    // Y con OTRA operación tampoco.
    expect(() =>
      addSessionConstraint(db, profile.id, {
        journalRevision: first.memoryRevision,
        idempotencyKey: "k-idem",
        label: "core",
        relatedItemIds: [],
        profile,
      }),
    ).toThrowError(/clave-de-idempotencia-reutilizada/);
    expect(() =>
      addSessionConstraint(db, profile.id, {
        journalRevision: revision,
        idempotencyKey: "k-stale",
        label: "core",
        relatedItemIds: [],
        profile,
      }),
    ).toThrowError(/memoria-diario-obsoleta/);
  });

  it("11 y 13. una sola acción: la sesión envuelve el diario y cierra la anterior", () => {
    const profile = demoProfile();
    const db = createDatabase(":memory:");
    saveCharacter(db, profile.id, JSON.stringify(profile));
    const empty = readJournalBundle(db, profile.id);
    const first = startDecisionSession(db, profile.id, {
      journalRevision: empty.memoryRevision,
      idempotencyKey: "k-wrap-1",
      kind: "guided_decision",
      objective: "Primera",
      hypothesis: "Uno",
      expectedResult: "A",
      observationMethod: "Ver",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    expect(first.journal.primaryEntryId).toBe(
      first.journal.session?.activeAction?.journalEntryId,
    );
    expect(() =>
      startDecisionSession(db, profile.id, {
        journalRevision: first.memoryRevision,
        idempotencyKey: "k-wrap-2",
        kind: "guided_decision",
        objective: "Segunda",
        hypothesis: "Dos",
        expectedResult: "B",
        observationMethod: "Ver",
        unknowns: [],
        constraints: [],
        soonReplacedItemIds: [],
        protectedResources: [],
        recommendation: null,
        profile,
        budget: { amount: 50, currency: "exalted" },
        goal: "balanced",
      }),
    ).toThrowError(/sesion-ya-activa/);
    const paused = pauseSession(db, profile.id, {
      journalRevision: first.memoryRevision,
      idempotencyKey: "k-pause",
      reason: "Pausa para conservar el recurso.",
      profile,
    });
    expect(paused.journal.session?.status).toBe("paused");
  });

  it("12. transiciones ilegales se rechazan con 400", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const started = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-illegal-start",
      kind: "guided_decision",
      objective: "Probar",
      hypothesis: "Hipótesis",
      expectedResult: "Resultado",
      observationMethod: "Observa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    const completed = recordSessionResult(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "k-complete",
      result: "Hecho y medido.",
      subjective: false,
      unexpectedValuable: null,
      conclusion: "complete",
      reopenWhen: null,
      profile,
    });
    expect(completed.journal.session?.status).toBe("completed");
    expect(() =>
      pauseSession(db, profile.id, {
        journalRevision: completed.memoryRevision,
        idempotencyKey: "k-illegal-pause",
        reason: "No debería pausarse.",
        profile,
      }),
    ).toThrowError(/transicion-de-sesion-invalida/);
    const candidate = reopenSession(db, profile.id, {
      journalRevision: completed.memoryRevision,
      idempotencyKey: "k-reopen",
      note: "Volvemos a mirarla.",
      profile,
    });
    expect(candidate.journal.session?.status).toBe("reopening");
    expect(candidate.journal.session?.conclusion?.reason).toMatch(/candidata/);
  });

  it("la revisión de memoria cambia al añadir una restricción", () => {
    const profile = demoProfile();
    const { db, revision } = emptyRevision(profile);
    const started = startDecisionSession(db, profile.id, {
      journalRevision: revision,
      idempotencyKey: "k-rev-start",
      kind: "guided_decision",
      objective: "Probar",
      hypothesis: "Hipótesis",
      expectedResult: "Resultado",
      observationMethod: "Observa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    const before = buildRecommendationMemory(
      started.journal,
      started.journal.session,
    ).revision;
    const after = addSessionConstraint(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "k-rev-const",
      label: "Barrera voltaica",
      relatedItemIds: ["demo-item-ring1"],
      profile,
    });
    expect(after.memoryRevision).not.toBe(before);
  });
});
