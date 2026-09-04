import { describe, expect, it } from "vitest";
import {
  CRAFTING_IMPORT_REPORT_VERSION,
  assessCraftingImportIssue,
  buildCraftingImportReport,
  craftingTooltipFingerprint,
  summarizeCraftingImportEvidence,
} from "../../shared/craftingImportReport.js";
import type { Item } from "../../shared/domain.js";

function item(patch: Partial<Item> = {}): Item {
  return {
    id: "id-interno-que-no-debe-salir",
    name: "Objeto de prueba",
    itemClass: "Ballestas",
    baseType: "Ballesta de prueba",
    slot: "weapon",
    rarity: "rare",
    itemLevel: 81,
    modifiers: [
      {
        id: "mod-interno",
        text: "+20 a la vida máxima",
        kind: "explicit",
        values: [20],
        verified: false,
      },
    ],
    craftingState: {
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    },
    rawText: [
      "Clase de objeto: Ballestas",
      "Rareza: Raro",
      "Objeto de prueba",
      "Ballesta de prueba",
      "----------------",
      "## Nivel de objeto: 81",
      '{ Mod. de prefijo "observado" (Grado: 1) — Vida }',
      "+20 a la vida máxima",
    ].join("\n"),
    sources: [
      {
        kind: "user",
        label: "Texto copiado",
        retrievedAt: "2026-08-27T00:00:00.000Z",
      },
    ],
    ...patch,
  };
}

describe("informe local de lectura de crafting", () => {
  it("separa un límite del parser de una copia sin descripciones avanzadas", () => {
    expect(assessCraftingImportIssue(item()).kind).toBe("parser-gap");
    expect(
      assessCraftingImportIssue(
        item({ rawText: "Rareza: Raro\n+20 a la vida máxima" }),
      ).kind,
    ).toBe("copy-incomplete");
  });

  it("distingue una mecánica no verificada de un bloqueo explícito", () => {
    expect(
      assessCraftingImportIssue(
        item({
          craftingState: {
            corrupted: false,
            mirrored: false,
            split: false,
            unidentified: false,
            mutated: true,
          },
        }),
      ).kind,
    ).toBe("mechanic-unverified");
    expect(
      assessCraftingImportIssue(
        item({
          craftingState: {
            corrupted: true,
            mirrored: false,
            split: false,
            unidentified: false,
          },
        }),
      ).kind,
    ).toBe("verified-blocker");
    expect(
      assessCraftingImportIssue(
        item({
          modifiers: [
            {
              id: "fracturado",
              text: "+20 a la vida máxima",
              kind: "explicit",
              affix: "prefix",
              values: [20],
              verified: false,
              fractured: true,
            },
          ],
        }),
      ).kind,
    ).toBe("mechanic-unverified");
  });

  it("genera un informe reproducible sin ids, personaje ni envío automático", () => {
    const report = buildCraftingImportReport({ item: item(), patch: "0.5.4f" });

    expect(report).toContain(`Formato: ${CRAFTING_IMPORT_REPORT_VERSION}`);
    expect(report).toContain("Parche declarado: 0.5.4f");
    expect(report).toContain("Categoría: parser-gap");
    expect(report).toContain("TEXTO ORIGINAL DEL TOOLTIP");
    expect(report).toContain("+20 a la vida máxima");
    expect(report).toContain("No se ha enviado nada");
    expect(report).not.toContain("id-interno-que-no-debe-salir");
    expect(report).not.toContain("mod-interno");
    expect(report).not.toContain("2026-08-27T00:00:00.000Z");
  });

  it("normaliza saltos y espacios no separables antes de calcular la huella", () => {
    expect(craftingTooltipFingerprint("Línea 1\r\nLínea\u00a02")).toBe(
      craftingTooltipFingerprint("Línea 1\nLínea 2"),
    );
  });

  it("separa la base reconocida de los datos avanzados que todavía faltan", () => {
    const partial = item({
      itemLevel: undefined,
      craftingState: undefined,
      modifiers: [
        {
          id: "mod-sin-posicion",
          text: "+20 a la vida máxima",
          kind: "explicit",
          values: [20],
          verified: false,
        },
      ],
    });
    const summary = summarizeCraftingImportEvidence(partial);

    expect(summary.recognized).toContain("Base: Ballesta de prueba");
    expect(summary.recognized).toContain("Clase: Ballestas");
    expect(summary.missing).toContain("Nivel de objeto");
    expect(summary.missing).toContain("Estados especiales del tooltip");
    expect(summary.missing).toContain("Posición de 1 modificador(es)");
  });
});
