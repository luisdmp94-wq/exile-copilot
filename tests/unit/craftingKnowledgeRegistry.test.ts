import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CraftingKnowledgeError,
  listBlockedSources,
  listObservedActions,
  loadCraftingKnowledge,
  queryModCandidates,
} from "../../server/crafting/knowledgeRegistry.js";

const readSnapshot = (file: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../server/data/crafting/${file}`, import.meta.url)), "utf8"),
  );

const observedActionsSnapshot = readSnapshot("observedCurrencyActions.2026-08-22.json");
const unavailablePoolsSnapshot = readSnapshot("modPools.unavailable.2026-08-22.json");

/** Fuente mínima válida para los casos sintéticos. */
const source = {
  id: "fuente-prueba",
  label: "Fuente de prueba",
  url: null,
  consultedAt: "2026-08-22",
  version: "0.5.4f",
  method: "official-export" as const,
  terms: "Términos de prueba.",
  redistributionAllowed: true,
  fingerprint: null,
  extracts: "Datos de prueba.",
  risk: "Ninguno: no sale del test.",
};

const provenance = { sourceId: "fuente-prueba", method: "official-export" as const };

const candidate = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  stableId: "Mod1",
  displayName: "Añade daño de fuego",
  affixType: "prefix",
  modGroup: "FireDamage",
  tags: ["fire", "damage"],
  minimumItemLevel: 10,
  weight: 500,
  provenance: {
    stableId: provenance,
    displayName: provenance,
    affixType: provenance,
    modGroup: provenance,
    tags: provenance,
    minimumItemLevel: provenance,
    weight: provenance,
  },
  ...overrides,
});

/**
 * Candidato con un campo sin valor Y sin procedencia, que es como se representa
 * «no lo sé»: la clave desaparece, no se pone `undefined` ni 0.
 */
const candidateWithout = (
  field: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const base = candidate(overrides);
  const provenanceCopy = { ...(base.provenance as Record<string, unknown>) };
  delete provenanceCopy[field];
  return { ...base, [field]: null, provenance: provenanceCopy };
};

const snapshot = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  snapshotId: "prueba-completo",
  game: "poe2",
  patch: "0.5.4f",
  leagueScope: null,
  asOf: "2026-08-22",
  completeness: "verified-complete",
  scope: { itemClasses: ["Anillos"], baseTypes: null },
  sources: [source],
  modCandidates: [candidate()],
  observedActions: [],
  limitations: [],
  redistributionAllowed: true,
  ...overrides,
});

describe("registro de conocimiento de crafting — carga", () => {
  it("1. acepta un snapshot completo válido y permite base de probabilidad", () => {
    const registry = loadCraftingKnowledge([snapshot()]);
    const result = queryModCandidates(registry, { itemClass: "Anillos", patch: "0.5.4f" });

    expect(result.status).toBe("available-complete");
    if (result.status !== "available-complete") throw new Error("estado inesperado");
    expect(result.probabilityBasis).toBe("sufficient");
    expect(result.totalWeight).toBe(500);
    expect(result.candidates).toHaveLength(1);
  });

  it("2. acepta un snapshot parcial válido sin habilitar probabilidad", () => {
    const registry = loadCraftingKnowledge([
      snapshot({
        snapshotId: "prueba-parcial",
        completeness: "verified-partial",
        modCandidates: [candidateWithout("weight")],
      }),
    ]);
    const result = queryModCandidates(registry, { itemClass: "Anillos" });

    expect(result.status).toBe("available-partial");
    if (result.status !== "available-partial") throw new Error("estado inesperado");
    expect(result.probabilityBasis).toBe("insufficient");
    expect(result).not.toHaveProperty("totalWeight");
    expect(result.reasons.join(" ")).toContain("verified-partial");
  });

  it("3. rechaza «verified-complete» sin pesos", () => {
    expect(() =>
      loadCraftingKnowledge([
        snapshot({
          modCandidates: [candidateWithout("weight")],
        }),
      ]),
    ).toThrow(/exige peso en TODOS los candidatos/);
  });

  it("3b. rechaza «verified-complete» sin scope declarado", () => {
    expect(() =>
      loadCraftingKnowledge([snapshot({ scope: { itemClasses: null, baseTypes: null } })]),
    ).toThrow(/exige un scope declarado/);
  });

  it("3c. rechaza «verified-complete» si el peso total no es positivo", () => {
    const zeroWeight = candidate({
      weight: 0,
      provenance: {
        ...(candidate().provenance as object),
        weight: { ...provenance, note: "La fuente declara exclusión para esta base." },
      },
    });
    expect(() => loadCraftingKnowledge([snapshot({ modCandidates: [zeroWeight] })])).toThrow(
      /al menos un peso positivo/,
    );
  });

  it("3d. una fuente sin redistribución nunca habilita probabilidad", () => {
    expect(() =>
      loadCraftingKnowledge([snapshot({ redistributionAllowed: false })]),
    ).toThrow(/redistribución autorizada/);

    expect(() =>
      loadCraftingKnowledge([
        snapshot({
          sources: [{ ...source, redistributionAllowed: null }],
          redistributionAllowed: true,
        }),
      ]),
    ).toThrow(/fuente sin redistribución autorizada/);
  });

  it("4. distingue peso 0 justificado de peso desconocido", () => {
    const justificado = candidate({
      weight: 0,
      provenance: {
        ...(candidate().provenance as object),
        weight: { ...provenance, note: "0 en la etiqueta que aplica a esta base: la excluye." },
      },
    });
    const registry = loadCraftingKnowledge([
      snapshot({ completeness: "verified-partial", modCandidates: [justificado] }),
    ]);
    expect(registry.snapshots[0]?.modCandidates[0]?.weight).toBe(0);

    // Sin justificación, un 0 es indistinguible de «no lo sé» y se rechaza.
    expect(() =>
      loadCraftingKnowledge([
        snapshot({ completeness: "verified-partial", modCandidates: [candidate({ weight: 0 })] }),
      ]),
    ).toThrow(/peso 0 debe explicar/);

    // Y desconocido nunca se representa como 0.
    const desconocido = loadCraftingKnowledge([
      snapshot({
        completeness: "verified-partial",
        modCandidates: [candidateWithout("weight")],
      }),
    ]);
    expect(desconocido.snapshots[0]?.modCandidates[0]?.weight).toBeNull();
  });

  it("5. rechaza pesos negativos", () => {
    expect(() =>
      loadCraftingKnowledge([snapshot({ modCandidates: [candidate({ weight: -1 })] })]),
    ).toThrow(CraftingKnowledgeError);
  });

  it("6. rechaza ids duplicados de candidato y de snapshot", () => {
    expect(() =>
      loadCraftingKnowledge([
        snapshot({ modCandidates: [candidate(), candidate({ displayName: "Otro texto" })] }),
      ]),
    ).toThrow(/Candidato duplicado/);

    expect(() => loadCraftingKnowledge([snapshot(), snapshot()])).toThrow(
      /snapshotId duplicados/,
    );
  });

  it("7. rechaza un candidato con valor pero sin procedencia", () => {
    expect(() =>
      loadCraftingKnowledge([
        snapshot({ modCandidates: [candidate({ provenance: { displayName: provenance } })] }),
      ]),
    ).toThrow(/no declara procedencia/);
  });

  it("7b. rechaza procedencia que cita una fuente inexistente", () => {
    expect(() =>
      loadCraftingKnowledge([
        snapshot({
          modCandidates: [
            candidate({
              provenance: {
                ...(candidate().provenance as object),
                weight: { sourceId: "fuente-fantasma", method: "official-export" },
              },
            }),
          ],
        }),
      ]),
    ).toThrow(/fuente que no está en sources/);
  });

  it("rechaza fechas inválidas y JSON que no cumple el esquema", () => {
    expect(() => loadCraftingKnowledge([snapshot({ asOf: "ayer por la tarde" })])).toThrow(
      /fecha ISO inválida/,
    );
    expect(() => loadCraftingKnowledge([{ snapshotId: "roto" }])).toThrow(CraftingKnowledgeError);
    expect(() => loadCraftingKnowledge([snapshot({ campoInventado: true })])).toThrow(
      CraftingKnowledgeError,
    );
  });
});

describe("registro de conocimiento de crafting — consulta", () => {
  it("8. parche o scope incompatible devuelve «unavailable» con motivo", () => {
    const registry = loadCraftingKnowledge([snapshot()]);

    const otroParche = queryModCandidates(registry, { itemClass: "Anillos", patch: "0.3.0" });
    if (otroParche.status !== "unavailable") throw new Error("se esperaba unavailable");
    expect(otroParche.reasons.join(" ")).toContain("0.3.0");

    const otraClase = queryModCandidates(registry, { itemClass: "Ballestas" });
    if (otraClase.status !== "unavailable") throw new Error("se esperaba unavailable");
    expect(otraClase.reasons.join(" ")).toContain("Ballestas");
  });

  it("8b. un snapshot de bases concretas no cubre una consulta sin base", () => {
    const registry = loadCraftingKnowledge([
      snapshot({ scope: { itemClasses: ["Anillos"], baseTypes: ["Anillo de rubí"] } }),
    ]);

    const sinBase = queryModCandidates(registry, { itemClass: "Anillos" });
    expect(sinBase.status).toBe("unavailable");

    const baseExacta = queryModCandidates(registry, {
      itemClass: "Anillos",
      baseType: "Anillo de rubí",
    });
    expect(baseExacta.status).toBe("available-complete");
  });

  it("9. una consulta parcial jamás se presenta como completa", () => {
    const registry = loadCraftingKnowledge([
      snapshot({
        snapshotId: "solo-observado",
        completeness: "observed-only",
        modCandidates: [candidateWithout("weight")],
      }),
    ]);
    const result = queryModCandidates(registry, { itemClass: "Anillos" });

    expect(result.status).not.toBe("available-complete");
    expect(result.probabilityBasis).toBe("insufficient");
  });

  it("10. el orden de candidatos y acciones es determinista", () => {
    const desordenado = snapshot({
      completeness: "verified-partial",
      modCandidates: [
        candidate({ stableId: "ModZ", displayName: "Z", affixType: "suffix", modGroup: "Z" }),
        candidate({ stableId: "ModA", displayName: "A", affixType: "prefix", modGroup: "A" }),
        candidate({ stableId: "ModM", displayName: "M", affixType: "prefix", modGroup: "M" }),
      ],
    });
    const primera = loadCraftingKnowledge([desordenado]);
    const segunda = loadCraftingKnowledge([JSON.parse(JSON.stringify(desordenado))]);

    const ids = (registry: ReturnType<typeof loadCraftingKnowledge>): (string | null)[] =>
      registry.snapshots[0]?.modCandidates.map((entry) => entry.stableId) ?? [];

    expect(ids(primera)).toEqual(["ModA", "ModM", "ModZ"]);
    expect(ids(primera)).toEqual(ids(segunda));

    const acciones = listObservedActions(loadCraftingKnowledge([observedActionsSnapshot]));
    expect(acciones.map((accion) => accion.id)).toEqual([
      "augmentation",
      "exalted",
      "regal",
      "transmutation",
    ]);
  });

  it("11. las fuentes con redistribución bloqueada quedan señaladas", () => {
    const registry = loadCraftingKnowledge([observedActionsSnapshot, unavailablePoolsSnapshot]);
    const bloqueadas = listBlockedSources(registry);

    expect(bloqueadas.length).toBeGreaterThan(0);
    const repoe = bloqueadas.find((fuente) => fuente.id === "repoe-fork-poe2-export");
    expect(repoe?.redistributionAllowed).toBe(false);
    expect(repoe?.terms).toContain("owned by Grinding Gear Games");
    // Términos indeterminados NO cuentan como permiso.
    expect(bloqueadas.some((fuente) => fuente.redistributionAllowed === null)).toBe(true);
    expect(bloqueadas.every((fuente) => fuente.redistributionAllowed !== true)).toBe(true);
  });
});

describe("registro de conocimiento de crafting — datos reales del repositorio", () => {
  it("12. sin pools reales no se inventa ningún candidato", () => {
    const registry = loadCraftingKnowledge([observedActionsSnapshot, unavailablePoolsSnapshot]);

    for (const entry of registry.snapshots) {
      expect(entry.modCandidates).toHaveLength(0);
    }

    const result = queryModCandidates(registry, { itemClass: "Ballestas" });
    if (result.status !== "unavailable") throw new Error("se esperaba unavailable");
    expect(result.probabilityBasis).toBe("insufficient");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("las cuatro acciones observadas conservan sus mínimos y su procedencia", () => {
    const acciones = listObservedActions(loadCraftingKnowledge([observedActionsSnapshot]));
    const porId = new Map(acciones.map((accion) => [accion.id, accion]));

    expect(porId.get("transmutation")?.labelEnglish).toBe("Orb of Transmutation");
    expect(
      porId.get("transmutation")?.variants.map((variante) => variante.minimumModifierLevel),
    ).toEqual([null, 44, 70]);
    expect(
      porId.get("augmentation")?.variants.map((variante) => variante.minimumModifierLevel),
    ).toEqual([null, 44, 70]);
    expect(porId.get("augmentation")?.declaredTotalLimit).toBe(2);

    // Regio y Exaltado: no se observó variante perfecta, así que no existe.
    expect(porId.get("regal")?.variants.map((variante) => variante.id)).toEqual([
      "base",
      "greater",
    ]);
    expect(porId.get("exalted")?.variants.map((variante) => variante.id)).toEqual([
      "base",
      "greater",
    ]);
    expect(porId.get("exalted")?.declaredTotalLimit).toBe(6);

    // Un mínimo no mostrado es null, nunca 0.
    for (const accion of acciones) {
      for (const variante of accion.variants) {
        expect(variante.minimumModifierLevel).not.toBe(0);
      }
      expect(accion.provenance.method).toBe("in-game-tooltip");
    }
  });

  it("los dos snapshots reales se declaran no redistribuibles", () => {
    const registry = loadCraftingKnowledge([observedActionsSnapshot, unavailablePoolsSnapshot]);
    for (const entry of registry.snapshots) {
      expect(entry.redistributionAllowed).toBe(false);
      expect(entry.limitations.length).toBeGreaterThan(0);
    }
  });
});
