import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CharacterProfileSchema,
  type CharacterProfile,
  type GoalKind,
} from "../../shared/domain.js";
import { DecisionSessionSchema } from "../../shared/decisionSession.js";
import { StartDecisionSessionRequestSchema } from "../../shared/api.js";
import { createDatabase } from "../../server/db/database.js";
import { saveCharacter } from "../../server/db/repositories.js";
import {
  readJournalBundle,
  startDecisionSession,
} from "../../server/decision/sessionService.js";

/**
 * El objetivo del jugador es CONTEXTO de la decisión.
 *
 * Antes: el contrato aceptaba un string libre, la interfaz enviaba «balanced»
 * fijo y el servidor ni siquiera pasaba el valor al servicio, así que la entrada
 * del diario acababa con `goal: null`. El cliente mandaba un dato que se
 * descartaba en silencio.
 */

function profileFor(id: string): CharacterProfile {
  const raw = readFileSync(
    fileURLToPath(new URL("../../server/fixtures/demoSnapshot.json", import.meta.url)),
    "utf8",
  );
  return CharacterProfileSchema.parse({ ...JSON.parse(raw), id });
}

function setup(id: string) {
  const profile = profileFor(id);
  const db = createDatabase(":memory:");
  saveCharacter(db, profile.id, JSON.stringify(profile));
  return { db, profile };
}

function startWithGoal(
  db: ReturnType<typeof createDatabase>,
  profile: CharacterProfile,
  key: string,
  goal: GoalKind,
) {
  return startDecisionSession(db, profile.id, {
    journalRevision: readJournalBundle(db, profile.id).memoryRevision,
    idempotencyKey: key,
    kind: "guided_decision",
    objective: "Comprobar que el objetivo se conserva",
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
    goal,
  });
}

describe("objetivo de la sesión de decisión", () => {
  it("abrir con «survival» conserva survival", () => {
    const { db, profile } = setup("goal-survival");
    const bundle = startWithGoal(db, profile, "goal-survival-start", "survival");
    expect(bundle.journal.session?.goal).toBe("survival");
  });

  it("abrir con «damage» conserva damage", () => {
    const { db, profile } = setup("goal-damage");
    const bundle = startWithGoal(db, profile, "goal-damage-start", "damage");
    expect(bundle.journal.session?.goal).toBe("damage");
  });

  it("la entrada del diario creada por la sesión hereda el objetivo, no null", () => {
    const { db, profile } = setup("goal-entrada");
    const bundle = startWithGoal(db, profile, "goal-entrada-start", "survival");

    const primary = bundle.journal.primaryEntry;
    expect(primary).not.toBeNull();
    // Esta es la aserción que fallaba antes: el contexto llegaba con null.
    expect(primary?.context.goal).toBe("survival");
    expect(bundle.journal.session?.activeAction?.journalEntryId).toBe(primary?.id);
  });

  it("el contrato rechaza objetivos que no son del dominio", () => {
    const profile = profileFor("goal-contrato");
    const base = {
      journalRevision: "journal-memory-v1:0000000000000000",
      idempotencyKey: "goal-contrato-key",
      kind: "guided_decision" as const,
      objective: "Objetivo",
      hypothesis: "Hipótesis",
      expectedResult: "Resultado",
      observationMethod: "Observa",
      unknowns: [],
      constraints: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      recommendation: null,
      profile,
      budget: { amount: 50, currency: "exalted" as const },
    };
    // Antes `goal` era `z.string().min(1).max(40)`: esto se aceptaba.
    expect(
      StartDecisionSessionRequestSchema.safeParse({ ...base, goal: "cualquier-cosa" })
        .success,
    ).toBe(false);
    expect(
      StartDecisionSessionRequestSchema.safeParse({ ...base, goal: "bossing" }).success,
    ).toBe(true);
  });

  it("una sesión guardada ANTES de este campo se sigue cargando, con goal desconocido", () => {
    // Payload legacy: exactamente el que escribía la versión anterior, sin `goal`.
    const legacy = {
      id: "sesion-legacy",
      characterId: "goal-legacy",
      kind: "guided_decision",
      status: "active",
      objective: "Decisión anterior a este campo",
      hypothesis: "Hipótesis anterior",
      unknowns: [],
      constraints: [],
      evidence: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      activeAction: null,
      blockedRecommendation: null,
      budget: null,
      lastResult: null,
      conclusion: null,
      characterFingerprint: "abc",
      needsReconciliation: false,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    };
    const parsed = DecisionSessionSchema.parse(legacy);
    // `null` = desconocido. No se le inventa «balanced».
    expect(parsed.goal).toBeNull();
    expect(parsed.objective).toBe("Decisión anterior a este campo");
  });

  it("la misma clave idempotente con OTRO objetivo da conflicto", () => {
    const { db, profile } = setup("goal-idempotencia");
    const first = startWithGoal(db, profile, "goal-idem", "survival");
    expect(first.journal.session?.goal).toBe("survival");

    // Mismo payload y mismo objetivo: reintento honesto, misma sesión.
    const replay = startWithGoal(db, profile, "goal-idem", "survival");
    expect(replay.journal.session?.id).toBe(first.journal.session?.id);

    // Cambiar SOLO el objetivo es otra intención: no puede devolver éxito
    // silencioso con el resultado de la anterior.
    expect(() => startWithGoal(db, profile, "goal-idem", "damage")).toThrowError(
      /clave-de-idempotencia-reutilizada/,
    );
  });
});
