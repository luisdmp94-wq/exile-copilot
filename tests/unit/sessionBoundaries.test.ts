import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile } from "../../shared/domain.js";
import {
  MAX_SESSION_CONSTRAINTS,
  MAX_SESSION_EVENTS,
  MAX_SESSIONS_PER_CHARACTER,
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

/**
 * Fronteras duras del Hito 6B.
 *
 * Los límites solo sirven si están probados EN el borde: 39 y 40 eventos, 8 y 9
 * sesiones. Un tope que se comprueba «por encima» deja pasar el caso real en el
 * que el jugador queda atrapado.
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

function startManual(
  db: ReturnType<typeof createDatabase>,
  profile: CharacterProfile,
  key: string,
) {
  return startDecisionSession(db, profile.id, {
    journalRevision: readJournalBundle(db, profile.id).memoryRevision,
    idempotencyKey: key,
    kind: "guided_decision",
    objective: "Comprobar una frontera",
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

/**
 * Rellena el historial hasta `target` eventos.
 *
 * Se alternan restricciones y evidencia porque cada tipo tiene su propio tope
 * (20 y 30): con uno solo no se llega a los 40 eventos del historial.
 */
function fillEvents(
  db: ReturnType<typeof createDatabase>,
  profile: CharacterProfile,
  bundle: ReturnType<typeof startManual>,
  target: number,
  prefix: string,
) {
  let current = bundle;
  let constraints = 0;
  let evidence = 0;
  while (current.journal.sessionEvents.length < target) {
    if (constraints < MAX_SESSION_CONSTRAINTS - 1) {
      current = addSessionConstraint(db, profile.id, {
        journalRevision: current.memoryRevision,
        idempotencyKey: `${prefix}-c-${constraints}`,
        label: `Restricción ${constraints}`,
        relatedItemIds: [],
        profile,
      });
      constraints += 1;
      continue;
    }
    current = addSessionEvidence(db, profile.id, {
      journalRevision: current.memoryRevision,
      idempotencyKey: `${prefix}-e-${evidence}`,
      kind: "confirmed",
      text: `Evidencia ${evidence}`,
      resolvesUnknownLabel: null,
      profile,
    });
    evidence += 1;
  }
  return current;
}

describe("frontera del historial de eventos", () => {
  it("con 39 eventos todavía se puede añadir material", () => {
    const { db, profile } = setup("frontera-39");
    const started = startManual(db, profile, "f39-start");
    const filled = fillEvents(db, profile, started, MAX_SESSION_EVENTS - 1, "f39");
    expect(filled.journal.sessionEvents).toHaveLength(MAX_SESSION_EVENTS - 1);

    const one = addSessionConstraint(db, profile.id, {
      journalRevision: filled.memoryRevision,
      idempotencyKey: "f39-una-mas",
      label: "Cabe una más",
      relatedItemIds: [],
      profile,
    });
    expect(one.journal.sessionEvents).toHaveLength(MAX_SESSION_EVENTS);
  });

  it("con 40 eventos se rechaza el material pero NUNCA el cierre", () => {
    const { db, profile } = setup("frontera-40");
    const started = startManual(db, profile, "f40-start");
    const filled = fillEvents(db, profile, started, MAX_SESSION_EVENTS, "f40");
    expect(filled.journal.sessionEvents).toHaveLength(MAX_SESSION_EVENTS);

    // Añadir material sí se rechaza…
    expect(() =>
      addSessionConstraint(db, profile.id, {
        journalRevision: filled.memoryRevision,
        idempotencyKey: "f40-material",
        label: "Ya no cabe",
        relatedItemIds: [],
        profile,
      }),
    ).toThrowError(/historial-de-sesion-lleno/);

    // …y el mensaje describe acciones que el servidor SÍ permite.
    try {
      addSessionConstraint(db, profile.id, {
        journalRevision: filled.memoryRevision,
        idempotencyKey: "f40-material-mensaje",
        label: "Ya no cabe",
        relatedItemIds: [],
        profile,
      });
      throw new Error("debería haber lanzado");
    } catch (error) {
      const detail = (error as { detail?: string }).detail ?? "";
      expect(detail).toMatch(/pausarla|resultado|descartarla/);
    }

    // La reserva garantiza que la sesión no queda atrapada.
    const paused = pauseSession(db, profile.id, {
      journalRevision: filled.memoryRevision,
      idempotencyKey: "f40-cierre",
      reason: "Cerrar de forma segura con el historial lleno.",
      profile,
    });
    expect(paused.journal.session?.status).toBe("paused");
  });
});

describe("frontera de sesiones por personaje", () => {
  function completeOne(
    db: ReturnType<typeof createDatabase>,
    profile: CharacterProfile,
    index: number,
  ) {
    const started = startManual(db, profile, `cap-${index}-start`);
    recordSessionResult(db, profile.id, {
      journalRevision: started.memoryRevision,
      idempotencyKey: `cap-${index}-complete`,
      result: `Resultado ${index}`,
      subjective: false,
      unexpectedValuable: null,
      conclusion: "complete",
      reopenWhen: null,
      profile,
    });
  }

  const count = (db: ReturnType<typeof createDatabase>, characterId: string): number =>
    Number(
      (
        db
          .prepare("SELECT COUNT(*) AS n FROM decision_sessions WHERE character_id = ?")
          .get(characterId) as { n: number }
      ).n,
    );

  it("con 8 sesiones completadas se conservan las 8", () => {
    const { db, profile } = setup("frontera-8");
    for (let index = 0; index < MAX_SESSIONS_PER_CHARACTER; index += 1) {
      completeOne(db, profile, index);
    }
    expect(count(db, profile.id)).toBe(MAX_SESSIONS_PER_CHARACTER);
  });

  it("con 9 la retención se aplica de verdad y nunca se supera el máximo", () => {
    const { db, profile } = setup("frontera-9");
    for (let index = 0; index < MAX_SESSIONS_PER_CHARACTER + 1; index += 1) {
      completeOne(db, profile, index);
      expect(count(db, profile.id)).toBeLessThanOrEqual(MAX_SESSIONS_PER_CHARACTER);
    }
    expect(count(db, profile.id)).toBe(MAX_SESSIONS_PER_CHARACTER);

    // La sesión viva (la última) sobrevive: la retención solo toca cerradas.
    const bundle = readJournalBundle(db, profile.id, profile);
    expect(bundle.journal.session).not.toBeNull();
  });
});
