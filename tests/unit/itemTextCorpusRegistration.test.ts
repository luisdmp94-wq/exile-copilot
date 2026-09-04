import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadItemTextCorpusAudit } from "../../server/importers/itemTextCorpus.js";
import {
  registerDirectItemTextSample,
  registerDirectItemTextSampleBatch,
  validateDirectItemTextSampleBatch,
} from "../../server/importers/itemTextCorpusRegistration.js";

const rawTooltip = readFileSync(
  fileURLToPath(
    new URL(
      "../../server/fixtures/itemText/observedFocusedAmuletAdvanced.en.txt",
      import.meta.url,
    ),
  ),
  "utf8",
);

function projectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "exile-item-corpus-registration-"));
  const corpusRoot = join(root, "server/fixtures/itemText");
  mkdirSync(corpusRoot, { recursive: true });
  writeFileSync(
    join(corpusRoot, "corpus.json"),
    `${JSON.stringify(
      { schemaVersion: 1, supportedLocales: ["es", "en"], cases: [] },
      null,
      2,
    )}\n`,
  );
  return root;
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    id: "focused-amulet-en-1.0-2026-12-11",
    locale: "en",
    patch: "1.0",
    observedAt: "2026-12-11",
    source: "Copia directa anonimizada del cliente de PoE2 1.0.",
    expected: {
      name: "Observed Pendant",
      baseType: "Focused Amulet",
      slot: "amulet",
      rarity: "rare",
      itemLevel: 86,
      quality: 20,
      prefixCount: 1,
      suffixCount: 1,
      diagnosisState: "partial",
      specialStates: ["fractured"],
    },
    ...overrides,
  };
}

describe("registro reproducible de tooltips directos", () => {
  it("ensaya un lote completo sin escribir fixtures ni modificar el manifiesto", () => {
    const root = projectRoot();
    const registered = validateDirectItemTextSampleBatch(
      {
        schemaVersion: 1,
        samples: [
          { submission: submission(), rawText: rawTooltip },
          {
            submission: submission({ id: "focused-amulet-en-1.0-2026-12-12" }),
            rawText: rawTooltip,
          },
        ],
      },
      root,
    );

    expect(registered).toHaveLength(2);
    expect(loadItemTextCorpusAudit(join(root, "server/fixtures/itemText"))).toMatchObject({
      issues: [],
      cases: [],
    });
    for (const sample of registered) {
      expect(existsSync(join(root, "server/fixtures/itemText", sample.fixture))).toBe(
        false,
      );
    }
  });

  it("registra varias copias confirmadas en una sola operación", () => {
    const root = projectRoot();
    const registered = registerDirectItemTextSampleBatch(
      {
        schemaVersion: 1,
        samples: [
          { submission: submission(), rawText: rawTooltip },
          {
            submission: submission({ id: "focused-amulet-en-1.0-2026-12-12" }),
            rawText: rawTooltip,
          },
        ],
      },
      root,
    );

    expect(registered).toHaveLength(2);
    expect(
      loadItemTextCorpusAudit(join(root, "server/fixtures/itemText")),
    ).toMatchObject({
      issues: [],
      cases: [
        { id: "focused-amulet-en-1.0-2026-12-11", replayPassed: true },
        { id: "focused-amulet-en-1.0-2026-12-12", replayPassed: true },
      ],
    });
  });

  it("rechaza el lote completo si una muestra contradice su tooltip", () => {
    const root = projectRoot();
    const invalid = submission({
      id: "focused-amulet-en-1.0-2026-12-12",
      expected: {
        ...(submission().expected as Record<string, unknown>),
        itemLevel: 85,
      },
    });

    expect(() =>
      registerDirectItemTextSampleBatch(
        {
          schemaVersion: 1,
          samples: [
            { submission: submission(), rawText: rawTooltip },
            { submission: invalid, rawText: rawTooltip },
          ],
        },
        root,
      ),
    ).toThrow("confirmación no coincide");
    expect(loadItemTextCorpusAudit(join(root, "server/fixtures/itemText")).cases).toEqual(
      [],
    );
    expect(
      existsSync(
        join(
          root,
          "server/fixtures/itemText/direct/1.0/focused-amulet-en-1.0-2026-12-11.en.txt",
        ),
      ),
    ).toBe(false);
  });

  it("rechaza ids repetidos dentro del lote antes de escribir", () => {
    const root = projectRoot();

    expect(() =>
      registerDirectItemTextSampleBatch(
        {
          schemaVersion: 1,
          samples: [
            { submission: submission(), rawText: rawTooltip },
            { submission: submission(), rawText: rawTooltip },
          ],
        },
        root,
      ),
    ).toThrow("ids únicos");
    expect(loadItemTextCorpusAudit(join(root, "server/fixtures/itemText")).cases).toEqual(
      [],
    );
  });

  it("contrasta la lectura humana, preserva el texto y reproduce el corpus", () => {
    const root = projectRoot();
    const registered = registerDirectItemTextSample(
      submission(),
      rawTooltip,
      root,
    );
    const corpusRoot = join(root, "server/fixtures/itemText");

    expect(registered.fixture).toBe(
      "direct/1.0/focused-amulet-en-1.0-2026-12-11.en.txt",
    );
    expect(readFileSync(join(corpusRoot, registered.fixture), "utf8")).toContain(
      "Focused Amulet",
    );
    expect(loadItemTextCorpusAudit(corpusRoot)).toMatchObject({
      issues: [],
      cases: [{ id: registered.id, replayPassed: true, issues: [] }],
    });
  });

  it("rechaza una confirmación que contradice el tooltip sin escribir", () => {
    const root = projectRoot();
    const base = submission();
    const invalid = submission({
      expected: {
        ...(base.expected as Record<string, unknown>),
        itemLevel: 85,
        prefixCount: 2,
      },
    });

    expect(() =>
      registerDirectItemTextSample(invalid, rawTooltip, root),
    ).toThrow("confirmación no coincide");
    expect(
      existsSync(
        join(
          root,
          "server/fixtures/itemText/direct/1.0/focused-amulet-en-1.0-2026-12-11.en.txt",
        ),
      ),
    ).toBe(false);
    expect(loadItemTextCorpusAudit(join(root, "server/fixtures/itemText")).cases).toEqual(
      [],
    );
  });

  it("no sobrescribe muestras y rechaza ids o textos inseguros", () => {
    const root = projectRoot();
    const first = registerDirectItemTextSample(submission(), rawTooltip, root);
    const fixturePath = join(root, "server/fixtures/itemText", first.fixture);
    const original = readFileSync(fixturePath, "utf8");

    expect(() =>
      registerDirectItemTextSample(submission(), rawTooltip, root),
    ).toThrow("Ya existe la muestra");
    expect(readFileSync(fixturePath, "utf8")).toBe(original);
    expect(() =>
      registerDirectItemTextSample(
        submission({ id: "../fuera" }),
        rawTooltip,
        root,
      ),
    ).toThrow();
    expect(() =>
      registerDirectItemTextSample(
        submission({ id: "frances", locale: "fr" }),
        rawTooltip,
        root,
      ),
    ).toThrow();
    expect(() =>
      registerDirectItemTextSample(
        submission({ id: "sin-fuente", source: "sin datos" }),
        rawTooltip,
        root,
      ),
    ).toThrow();
    expect(() =>
      registerDirectItemTextSample(
        submission({ id: "corto" }),
        "Objeto raro",
        root,
      ),
    ).toThrow("demasiado corto");
  });
});
