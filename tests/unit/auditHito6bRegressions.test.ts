import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CharacterProfileSchema,
  RecommendationSchema,
  type CharacterProfile,
} from "../../shared/domain.js";
import {
  characterSessionFingerprint,
  evaluateSessionGate,
} from "../../shared/decisionSession.js";
import { createDatabase } from "../../server/db/database.js";
import { saveCharacter } from "../../server/db/repositories.js";
import {
  addSessionConstraint,
  addSessionEvidence,
  pauseSession,
  readJournalBundle,
  recordSessionResult,
  startDecisionSession,
} from "../../server/decision/sessionService.js";

function profileFor(id: string): CharacterProfile {
  const raw = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  );
  return CharacterProfileSchema.parse({ ...JSON.parse(raw), id });
}

function startManual(db: ReturnType<typeof createDatabase>, profile: CharacterProfile, key: string) {
  const revision = readJournalBundle(db, profile.id).memoryRevision;
  return startDecisionSession(db, profile.id, {
    journalRevision: revision,
    idempotencyKey: key,
    kind: "guided_decision",
    objective: "Comprobar una decisión",
    hypothesis: "La hipótesis inicial",
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
}

describe("auditoría independiente Hito 6B", () => {
  it("detecta cambios reales del personaje aunque se conserve el id del objeto", () => {
    const profile = profileFor("audit-fingerprint");
    const first = profile.items[0]!;
    const changed = CharacterProfileSchema.parse({
      ...profile,
      life: (profile.life ?? 0) + 500,
      resistances: { ...profile.resistances, cold: 75 },
      items: profile.items.map((item, index) =>
        index === 0
          ? {
              ...item,
              modifiers: [
                ...item.modifiers,
                {
                  id: "audit-mod",
                  text: "+99 a una estadística comprobada",
                  kind: "explicit",
                  values: [99],
                  verified: true,
                },
              ],
            }
          : item,
      ),
    });
    expect(changed.items[0]?.id).toBe(first.id);
    expect(characterSessionFingerprint(changed)).not.toBe(
      characterSessionFingerprint(profile),
    );
  });

  it("continuar tras feedback subjetivo conserva exactamente una próxima acción", () => {
    const profile = profileFor("audit-continue");
    const db = createDatabase(":memory:");
    saveCharacter(db, profile.id, JSON.stringify(profile));
    const started = startManual(db, profile, "audit-continue-start");
    const continued = recordSessionResult(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "audit-continue-result",
      result: "Se siente mejor, pero no está medido.",
      subjective: true,
      unexpectedValuable: null,
      reopenWhen: null,
      profile,
    });
    expect(continued.journal.session?.status).toBe("waiting_result");
    expect(continued.journal.primaryEntryId).toBe(
      continued.journal.session?.activeAction?.journalEntryId,
    );
  });

  it("usa el personaje guardado en SQLite, no una copia antigua enviada por el cliente", () => {
    const profile = profileFor("audit-source-truth");
    const db = createDatabase(":memory:");
    saveCharacter(db, profile.id, JSON.stringify(profile));
    const started = startManual(db, profile, "audit-db-start");

    const storedNow = CharacterProfileSchema.parse({ ...profile, items: [] });
    saveCharacter(db, profile.id, JSON.stringify(storedNow));

    expect(() =>
      addSessionConstraint(db, profile.id, {
        journalRevision: started.memoryRevision,
        idempotencyKey: "audit-db-stale-client",
        label: "Pieza core",
        relatedItemIds: [],
        profile,
      }),
    ).toThrowError(/sesion-incompatible-con-perfil/);
  });

  it("reserva una transición de cierre cuando el historial alcanza el máximo", () => {
    const profile = profileFor("audit-event-cap");
    const db = createDatabase(":memory:");
    saveCharacter(db, profile.id, JSON.stringify(profile));
    let bundle = startManual(db, profile, "audit-cap-start");

    for (let index = 0; index < 20; index += 1) {
      bundle = addSessionConstraint(db, profile.id, {
        journalRevision: bundle.memoryRevision,
        idempotencyKey: `audit-cap-constraint-${index}`,
        label: `Restricción ${index}`,
        relatedItemIds: [],
        profile,
      });
    }
    for (let index = 0; index < 19; index += 1) {
      bundle = addSessionEvidence(db, profile.id, {
        journalRevision: bundle.memoryRevision,
        idempotencyKey: `audit-cap-evidence-${index}`,
        kind: "confirmed",
        text: `Evidencia ${index}`,
        resolvesUnknownLabel: null,
        profile,
      });
    }
    expect(bundle.journal.sessionEvents).toHaveLength(40);
    expect(() =>
      pauseSession(db, profile.id, {
        journalRevision: bundle.memoryRevision,
        idempotencyKey: "audit-cap-pause",
        reason: "Cerrar de forma segura.",
        profile,
      }),
    ).not.toThrow();
  });

  it("asocia el conflicto al label que posee el item protegido", () => {
    const recommendation = RecommendationSchema.parse({
      id: "audit-rec",
      priority: 1,
      title: "Cambiar anillo",
      action: "Cambia el anillo.",
      reason: "Prueba",
      actionKind: "game_change",
      cost: { min: null, max: null, currency: "exalted", known: false },
      impact: { metric: "prueba", description: "Prueba", magnitude: "low", isPartialMetric: true },
      risk: { level: "low", description: "Prueba" },
      mayLoseValuableMods: false,
      irreversible: false,
      patch: "0.5.4f",
      sources: [{ kind: "user", label: "Prueba", retrievedAt: "2026-08-21T00:00:00.000Z" }],
      dataUpdatedAt: "2026-08-21T00:00:00.000Z",
      confidence: "medium",
      unverified: [],
      relatedItemIds: ["item-segundo"],
    });
    const gate = evaluateSessionGate(recommendation, {
      unresolvedBlockingUnknowns: [],
      constraintLabels: ["Primer objeto", "Segundo objeto"],
      constraintItemIds: ["item-primero", "item-segundo"],
      soonReplacedItemIds: [],
      status: "active",
      budget: null,
    });
    expect(gate).toEqual({ kind: "protected_constraint", label: "Segundo objeto" });
  });

  it("mantiene como máximo ocho sesiones por personaje", () => {
    const profile = profileFor("audit-session-cap");
    const db = createDatabase(":memory:");
    saveCharacter(db, profile.id, JSON.stringify(profile));

    for (let index = 0; index < 9; index += 1) {
      const started = startManual(db, profile, `audit-session-${index}-start`);
      recordSessionResult(db, profile.id, {
        journalRevision: started.memoryRevision,
        idempotencyKey: `audit-session-${index}-complete`,
        result: `Resultado ${index}`,
        subjective: false,
        unexpectedValuable: null,
        conclusion: "complete",
        reopenWhen: null,
        profile,
      });
    }

    const stored = db
      .prepare("SELECT COUNT(*) AS n FROM decision_sessions WHERE character_id = ?")
      .get(profile.id) as { n: number };
    expect(Number(stored.n)).toBeLessThanOrEqual(8);
  });

  it("al aportar el dato crítico recupera la acción que estaba bloqueada", () => {
    const profile = profileFor("audit-unblock");
    const db = createDatabase(":memory:");
    saveCharacter(db, profile.id, JSON.stringify(profile));
    const recommendation = RecommendationSchema.parse({
      id: "audit-irreversible-rec",
      priority: 1,
      title: "Usar un recurso irreversible",
      action: "Aplica el recurso al anillo.",
      reason: "Solo cuando el dato esté confirmado.",
      actionKind: "game_change",
      cost: { min: 1, max: 1, currency: "exalted", known: true },
      impact: { metric: "prueba", description: "Resultado observable", magnitude: "medium", isPartialMetric: true },
      risk: { level: "high", description: "No se puede deshacer" },
      mayLoseValuableMods: true,
      irreversible: true,
      patch: "0.5.4f",
      sources: [{ kind: "user", label: "Prueba", retrievedAt: "2026-08-21T00:00:00.000Z" }],
      dataUpdatedAt: "2026-08-21T00:00:00.000Z",
      confidence: "medium",
      unverified: [],
      relatedItemIds: ["demo-item-ring1"],
    });
    const started = startDecisionSession(db, profile.id, {
      journalRevision: readJournalBundle(db, profile.id).memoryRevision,
      idempotencyKey: "audit-unblock-start",
      kind: "guided_decision",
      objective: recommendation.title,
      hypothesis: recommendation.reason,
      expectedResult: recommendation.impact.description,
      observationMethod: "Observar el resultado",
      unknowns: [{ label: "Tooltip exacto", blockingIrreversible: true }],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation,
      profile,
      budget: { amount: 50, currency: "exalted" },
      goal: "balanced",
    });
    expect(started.journal.session?.activeAction?.blockedReason).toMatch(/Tooltip exacto/);

    const unblocked = addSessionEvidence(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: "audit-unblock-evidence",
      kind: "confirmed",
      text: "Tooltip exacto copiado del juego",
      resolvesUnknownLabel: "Tooltip exacto",
      profile,
    });
    expect(unblocked.journal.session?.unknowns[0]?.resolved).toBe(true);
    expect(unblocked.journal.session?.activeAction?.blockedReason).toBeNull();
    expect(unblocked.journal.session?.activeAction?.summary).toBe(recommendation.action);
  });
});
