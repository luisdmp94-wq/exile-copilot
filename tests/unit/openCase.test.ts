import { describe, expect, it } from "vitest";
import { openCaseLimitations, selectOpenCase } from "../../src/lib/openCase.js";
import { JournalResponseSchema } from "../../shared/api.js";
import {
  JournalEntrySchema,
  RecommendationSchema,
  type JournalEntry,
  type Recommendation,
} from "../../shared/domain.js";
import {
  DecisionSessionSchema,
  type DecisionSession,
  type DecisionSessionStatus,
} from "../../shared/decisionSession.js";

/**
 * Fase Visual 1 §3 — jerarquía del Caso Abierto.
 *
 * Es lógica pura a propósito: elige el contenido dominante mirando el estado
 * que YA existe (sesión, diario, recomendaciones) sin montar la interfaz.
 */

function recommendation(overrides: Record<string, unknown> = {}): Recommendation {
  return RecommendationSchema.parse({
    id: "rec-1",
    priority: 1,
    title: "Mejorar el arma",
    action: "Busca una base similar con mejores mods.",
    reason: "El arma es la principal palanca de daño.",
    cost: { min: null, max: null, currency: "exalted", known: false },
    impact: {
      metric: "daño del arma",
      description: "Impacto estimado en daño.",
      magnitude: "high",
    },
    risk: { level: "medium", description: "Puede consumir el presupuesto." },
    mayLoseValuableMods: false,
    irreversible: false,
    patch: "0.5.4f",
    sources: [],
    dataUpdatedAt: "2026-08-19T09:00:00.000Z",
    confidence: "medium",
    ...overrides,
  });
}

function entry(overrides: Record<string, unknown> = {}): JournalEntry {
  return JournalEntrySchema.parse({
    id: "entry-1",
    characterId: "char-1",
    kind: "decision",
    status: "active",
    title: "Cambiar el arma",
    summary: "Estamos probando una ballesta con más mods.",
    nextAction: "Compra la base y prueba una zona.",
    context: {},
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
    ...overrides,
  });
}

function session(
  status: DecisionSessionStatus,
  overrides: Record<string, unknown> = {},
): DecisionSession {
  return DecisionSessionSchema.parse({
    id: "ses-1",
    characterId: "char-1",
    kind: "guided_decision",
    status,
    objective: "Comprobar el arma nueva",
    hypothesis: "Más mods explícitos deberían subir el daño.",
    characterFingerprint: "fp-1",
    createdAt: "2026-08-19T09:00:00.000Z",
    updatedAt: "2026-08-19T09:00:00.000Z",
    ...overrides,
  });
}

function journal(overrides: Record<string, unknown> = {}) {
  return JournalResponseSchema.parse({
    characterId: "char-1",
    primaryEntryId: null,
    primaryEntry: null,
    entries: [],
    ...overrides,
  });
}

describe("jerarquía del Caso Abierto", () => {
  it("sin personaje solo cabe la bienvenida", () => {
    const selection = selectOpenCase({
      hasProfile: false,
      journal: null,
      recommendations: [recommendation()],
    });
    expect(selection.kind).toBe("welcome");
    expect(selection.relatedItemIds).toEqual([]);
  });

  it("con personaje y sin nada más, ofrece generar", () => {
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal(),
      recommendations: [],
    });
    expect(selection.kind).toBe("generate");
  });

  it.each<DecisionSessionStatus>(["active", "waiting_result", "paused", "reopening"])(
    "una sesión %s domina sobre el diario y las recomendaciones",
    (status) => {
      const primary = entry();
      const selection = selectOpenCase({
        hasProfile: true,
        journal: journal({
          session: session(status),
          primaryEntryId: primary.id,
          primaryEntry: primary,
          entries: [primary],
        }),
        recommendations: [recommendation()],
      });
      expect(selection.kind).toBe("session");
    },
  );

  it.each<DecisionSessionStatus>(["completed", "discarded"])(
    "una sesión %s NO domina: manda el diario",
    (status) => {
      const primary = entry();
      const selection = selectOpenCase({
        hasProfile: true,
        journal: journal({
          session: session(status),
          primaryEntryId: primary.id,
          primaryEntry: primary,
          entries: [primary],
        }),
        recommendations: [recommendation()],
      });
      expect(selection.kind).toBe("journal");
      expect(selection.journalEntry?.id).toBe("entry-1");
    },
  );

  it("una entrada sin próxima acción no domina: pasa la recomendación", () => {
    const primary = entry({ nextAction: null });
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal({
        primaryEntryId: primary.id,
        primaryEntry: primary,
        entries: [primary],
      }),
      recommendations: [recommendation()],
    });
    expect(selection.kind).toBe("recommendation");
  });

  it("elige la recomendación de menor prioridad y no la duplica en las otras", () => {
    const uno = recommendation({ id: "rec-a", priority: 2 });
    const dos = recommendation({ id: "rec-b", priority: 1 });
    const tres = recommendation({ id: "rec-c", priority: 3 });
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal(),
      recommendations: [uno, dos, tres],
    });
    expect(selection.kind).toBe("recommendation");
    expect(selection.recommendation?.id).toBe("rec-b");
    expect(selection.otherRecommendations.map((rec) => rec.id)).toEqual([
      "rec-a",
      "rec-c",
    ]);
  });
});

describe("vínculo con el paperdoll", () => {
  it("una recomendación aporta sus propios relatedItemIds", () => {
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal(),
      recommendations: [recommendation({ relatedItemIds: ["demo-item-weapon"] })],
    });
    expect(selection.relatedItemIds).toEqual(["demo-item-weapon"]);
  });

  it("sin vínculo estructurado no se señala ninguna celda", () => {
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal(),
      recommendations: [recommendation({ relatedItemIds: [] })],
    });
    expect(selection.relatedItemIds).toEqual([]);
  });

  it("una entrada del diario aporta los suyos", () => {
    const primary = entry({ relatedItemIds: ["demo-item-helmet"] });
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal({
        primaryEntryId: primary.id,
        primaryEntry: primary,
        entries: [primary],
      }),
      recommendations: [recommendation({ relatedItemIds: ["demo-item-weapon"] })],
    });
    // Manda el diario: los ids de la recomendación NO se cuelan.
    expect(selection.relatedItemIds).toEqual(["demo-item-helmet"]);
  });

  it("la sesión no inventa ids: usa los de la entrada de su acción activa", () => {
    const primary = entry({ id: "entry-9", relatedItemIds: ["demo-item-boots"] });
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal({
        session: session("active", {
          activeAction: {
            journalEntryId: "entry-9",
            summary: "Comprar la base",
            irreversible: false,
            riskLevel: "low",
            expectedResult: "Más daño",
            observationMethod: "Anota lo que cambió.",
          },
        }),
        primaryEntryId: primary.id,
        primaryEntry: primary,
        entries: [primary],
      }),
      recommendations: [],
    });
    expect(selection.kind).toBe("session");
    expect(selection.relatedItemIds).toEqual(["demo-item-boots"]);
  });

  it("una sesión sin acción activa no señala nada", () => {
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal({ session: session("paused") }),
      recommendations: [recommendation({ relatedItemIds: ["demo-item-weapon"] })],
    });
    expect(selection.relatedItemIds).toEqual([]);
  });
});

describe("aviso de limitaciones", () => {
  it("sale de unverified de la recomendación", () => {
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal(),
      recommendations: [recommendation({ unverified: ["No verificado — precio"] })],
    });
    expect(openCaseLimitations(selection)).toEqual(["No verificado — precio"]);
  });

  it("para el diario sale del snapshot, no de otro sitio", () => {
    const primary = entry({
      recommendationSnapshot: recommendation({ unverified: ["No verificado — mods"] }),
    });
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal({
        primaryEntryId: primary.id,
        primaryEntry: primary,
        entries: [primary],
      }),
      recommendations: [],
    });
    expect(openCaseLimitations(selection)).toEqual(["No verificado — mods"]);
  });

  it("una sesión no usa unverified: tiene sus propias incógnitas", () => {
    const selection = selectOpenCase({
      hasProfile: true,
      journal: journal({ session: session("active") }),
      recommendations: [recommendation({ unverified: ["No verificado — precio"] })],
    });
    expect(openCaseLimitations(selection)).toEqual([]);
  });
});
