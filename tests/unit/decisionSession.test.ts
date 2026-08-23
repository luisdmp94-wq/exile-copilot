import { describe, expect, it } from "vitest";
import { RecommendationSchema } from "../../shared/domain.js";
import {
  CraftingExperimentSchema,
  DecisionSessionSchema,
  canTransition,
  characterSessionFingerprint,
  evaluateSessionGate,
  evidenceMatchesReopenCondition,
  recommendationConflictsConstraint,
  sessionFingerprintHash,
  sessionIsOpen,
  sessionMemoryDigest,
} from "../../shared/decisionSession.js";
import { CharacterProfileSchema } from "../../shared/domain.js";

const rec = RecommendationSchema.parse({
  id: "rec-test",
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
});

describe("evaluateSessionGate", () => {
  const openView = {
    unresolvedBlockingUnknowns: [] as string[],
    constraintLabels: [] as string[],
    constraintItemIds: [] as string[],
    soonReplacedItemIds: [] as string[],
    status: "active" as const,
    budget: { amount: 50, currency: "exalted" },
  };

  it("no autoriza un paso irreversible si falta un dato crítico", () => {
    const gate = evaluateSessionGate(rec, {
      ...openView,
      unresolvedBlockingUnknowns: ["tooltip exacto de la herramienta"],
    });
    expect(gate).toEqual({
      kind: "irreversible_missing_evidence",
      label: "tooltip exacto de la herramienta",
    });
  });

  it("muestra el conflicto de una pieza protegida y no sigue a la siguiente puntuada", () => {
    const gate = evaluateSessionGate(rec, {
      ...openView,
      constraintLabels: ["Barrera voltaica"],
    });
    expect(gate).toEqual({
      kind: "protected_constraint",
      label: "Barrera voltaica",
    });
  });

  it("pausa si la pieza se sustituirá pronto", () => {
    const gate = evaluateSessionGate(rec, {
      ...openView,
      soonReplacedItemIds: ["demo-item-ring1"],
    });
    expect(gate?.kind).toBe("opportunity_cost");
  });

  it("pausa si el coste conocido supera el presupuesto en la misma moneda", () => {
    const gate = evaluateSessionGate(rec, openView);
    expect(gate?.kind).toBe("over_budget");
  });

  it("no afirma un exceso de presupuesto con otra moneda", () => {
    const gate = evaluateSessionGate(rec, {
      ...openView,
      budget: { amount: 10, currency: "divine" },
    });
    expect(gate).toBeNull();
  });

  it("no aplica frenos a una sesión ya cerrada", () => {
    const gate = evaluateSessionGate(rec, {
      ...openView,
      status: "completed",
      unresolvedBlockingUnknowns: ["dato"],
    });
    expect(gate).toBeNull();
  });
});

describe("transiciones de sesión", () => {
  it("rechaza transiciones ilegales", () => {
    expect(canTransition("completed", "active")).toBe(false);
    expect(canTransition("completed", "reopening")).toBe(true);
    expect(canTransition("discarded", "paused")).toBe(false);
    expect(canTransition("active", "waiting_result")).toBe(true);
  });

  it("considera abiertas solo las que aún se pueden trabajar", () => {
    expect(sessionIsOpen("active")).toBe(true);
    expect(sessionIsOpen("paused")).toBe(true);
    expect(sessionIsOpen("completed")).toBe(false);
    expect(sessionIsOpen("discarded")).toBe(false);
  });
});

describe("reapertura y huella", () => {
  it("la evidencia compatible reabre como candidata, no como hecho demostrado", () => {
    expect(
      evidenceMatchesReopenCondition(
        "El tooltip de la herramienta ya es consistente con el plan",
        "tooltip de la herramienta ya es consistente",
      ),
    ).toBe(true);
    expect(evidenceMatchesReopenCondition("otra cosa", "tooltip de la herramienta")).toBe(
      false,
    );
  });

  it("la huella cambia si cambia el equipo y no se reutiliza en silencio", () => {
    const base = CharacterProfileSchema.parse({
      id: "char-1",
      name: "Demo",
      characterClass: "Mercenary",
      level: 70,
      league: "Runes of Aldur",
      patch: "0.5.4f",
      items: [{ id: "demo-item-ring1", name: "Anillo", baseType: "Ring" }],
      importedAt: "2026-08-20T10:00:00.000Z",
    });
    const changed = { ...base, items: [] };
    expect(characterSessionFingerprint(base)).not.toBe(
      characterSessionFingerprint(changed),
    );
    expect(sessionFingerprintHash("a")).toBe(sessionFingerprintHash("a"));
  });

  it("la huella cambia si el objeto pasa a estar corrupto", () => {
    const base = CharacterProfileSchema.parse({
      id: "char-crafting-state",
      name: "Demo",
      characterClass: "Mercenary",
      level: 70,
      league: "Runes of Aldur",
      patch: "0.5.4f",
      items: [
        {
          id: "weapon",
          name: "Ballesta",
          baseType: "Ballesta barnizada",
          rarity: "rare",
          craftingState: {
            corrupted: false,
            mirrored: false,
            split: false,
            unidentified: false,
          },
        },
      ],
      importedAt: "2026-08-22T10:00:00.000Z",
    });
    const changed = CharacterProfileSchema.parse({
      ...base,
      items: base.items.map((item) => ({
        ...item,
        craftingState: { ...item.craftingState!, corrupted: true },
      })),
    });

    expect(characterSessionFingerprint(changed)).not.toBe(
      characterSessionFingerprint(base),
    );
  });

  it("el digest solo incluye restricciones protegidas", () => {
    const digest = sessionMemoryDigest({
      id: "s1",
      characterId: "c1",
      kind: "guided_decision",
      status: "active",
      objective: "obj",
      hypothesis: "hip",
      unknowns: [],
      constraints: [
        {
          id: "a",
          label: "Barrera voltaica",
          relatedItemIds: ["demo-item-ring1"],
          protected: true,
        },
        {
          id: "b",
          label: "ignorada",
          relatedItemIds: ["demo-item-weapon"],
          protected: false,
        },
      ],
      evidence: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      activeAction: null,
    blockedRecommendation: null,
    budget: null,
    goal: null,
      lastResult: null,
      conclusion: null,
      characterFingerprint: "abc",
      needsReconciliation: false,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    });
    expect(digest.constraintLabels).toEqual(["Barrera voltaica"]);
    expect(digest.constraintItemIds).toEqual(["demo-item-ring1"]);
  });

  it("detecta conflicto por id de objeto protegido", () => {
    expect(
      recommendationConflictsConstraint(rec, {
        id: "c1",
        label: "anillo actual",
        relatedItemIds: ["demo-item-ring1"],
        protected: true,
      }),
    ).toBe(true);
  });

  it("mantiene retrocompatibilidad con sesiones anteriores al crafting estructurado", () => {
    const parsed = DecisionSessionSchema.parse({
      id: "legacy",
      characterId: "c1",
      kind: "guided_decision",
      status: "completed",
      objective: "Objetivo antiguo",
      hypothesis: "Hipótesis antigua",
      unknowns: [],
      constraints: [],
      evidence: [],
      soonReplacedItemIds: [],
      protectedResources: [],
      activeAction: null,
      blockedRecommendation: null,
      budget: null,
      goal: null,
      lastResult: null,
      conclusion: null,
      characterFingerprint: "abc",
      needsReconciliation: false,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    });
    expect(parsed.craftingExperiment).toBeUndefined();
  });

  it("persiste la variante exacta de la moneda sin reinterpretar su mínimo observado", () => {
    const experiment = CraftingExperimentSchema.parse({
      actionId: "exalted",
      actionLabel: "Orbe exaltado superior",
      variantId: "greater",
      variantLabel: "Superior",
      minimumModifierLevel: 35,
      desiredOutcome: "Añadir un modificador útil",
      originalItem: {
        id: "weapon",
        name: "Núcleo de fénix",
        baseType: "Ballesta barnizada",
        rarity: "rare",
      },
    });
    expect(experiment).toMatchObject({
      actionLabel: "Orbe exaltado superior",
      variantId: "greater",
      variantLabel: "Superior",
      minimumModifierLevel: 35,
    });

    const legacy = CraftingExperimentSchema.parse({
      actionId: "exalted",
      actionLabel: "Orbe exaltado",
      desiredOutcome: "Añadir un modificador útil",
      originalItem: {
        id: "weapon",
        name: "Núcleo de fénix",
        baseType: "Ballesta barnizada",
        rarity: "rare",
      },
    });
    expect(legacy.variantId).toBeUndefined();
    expect(legacy.minimumModifierLevel).toBeUndefined();
  });

  it("persiste una Essence de reemplazo sin convertirla en una moneda básica", () => {
    const experiment = CraftingExperimentSchema.parse({
      actionId: "essence",
      actionLabel: "Essence observada (Perfecta)",
      variantId: "perfect",
      variantLabel: "Perfecta",
      resultRarity: "rare",
      expectedRemovedModifierCount: 1,
      guaranteedModifierText: "Efecto exacto del tooltip",
      resultUnknownLabel: "Falta comprobar el reemplazo.",
      desiredOutcome: "Conservar el afijo principal",
      originalItem: {
        id: "weapon",
        name: "Núcleo de fénix",
        baseType: "Ballesta barnizada",
        rarity: "rare",
      },
    });
    expect(experiment).toMatchObject({
      actionId: "essence",
      variantId: "perfect",
      expectedRemovedModifierCount: 1,
      guaranteedModifierText: "Efecto exacto del tooltip",
    });
  });

  it("persiste un Alloy con su contrato de reemplazo fabricado", () => {
    const experiment = CraftingExperimentSchema.parse({
      actionId: "alloy",
      actionLabel: "Alloy observado",
      resultRarity: "rare",
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
      guaranteedModifierText: "Fabricado garantizado",
      resultUnknownLabel: "Falta comprobar el resultado.",
      desiredOutcome: "Conservar el afijo principal",
      originalItem: {
        id: "weapon",
        name: "Núcleo de fénix",
        baseType: "Ballesta barnizada",
        rarity: "rare",
      },
    });
    expect(experiment).toMatchObject({
      actionId: "alloy",
      expectedRemovedModifierCount: 1,
      expectedAddedCrafted: true,
      maximumCraftedModifierCount: 1,
    });
  });
});
