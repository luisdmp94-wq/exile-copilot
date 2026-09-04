import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseItemText } from "../../server/importers/itemTextParser.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { assessCraftingImportIssue } from "../../shared/craftingImportReport.js";
import { loadItemTextCorpusAudit } from "../../server/importers/itemTextCorpus.js";

interface CorpusExpected {
  name: string;
  baseType: string;
  slot: string;
  rarity: string;
  itemLevel: number;
  quality?: number;
  requirements?: Record<string, number>;
  modifierCount: number;
  explicitCount: number;
  prefixCount: number;
  suffixCount: number;
  unclassifiedExplicitCount: number;
  diagnosisState: "complete" | "partial" | "blocked";
  importIssueKind?: string;
  craftingState?: Record<string, boolean>;
  specialModifierCounts?: Partial<Record<"fractured" | "desecrated" | "mutated", number>>;
  warningCount: number;
}

interface CorpusCase {
  id: string;
  fixture: string;
  locale: "es" | "en";
  patch: string;
  provenance: {
    method: "in-game-clipboard" | "official-forum-derived-regression";
    observedAt: string;
    source: string;
  };
  expected: CorpusExpected;
}

interface CorpusManifest {
  schemaVersion: number;
  supportedLocales: Array<"es" | "en">;
  cases: CorpusCase[];
}

const corpusRoot = fileURLToPath(
  new URL("../../server/fixtures/itemText/", import.meta.url),
);
const repositoryRoot = resolve(corpusRoot, "../../..");
const manifest = JSON.parse(
  readFileSync(resolve(corpusRoot, "corpus.json"), "utf8"),
) as CorpusManifest;

describe("corpus reproducible de tooltips", () => {
  it("mantiene ids, fixtures y procedencia únicos y trazables", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.supportedLocales).toEqual(["es", "en"]);
    expect(manifest.cases.length).toBeGreaterThan(0);
    expect(new Set(manifest.cases.map((entry) => entry.id)).size).toBe(
      manifest.cases.length,
    );
    expect(new Set(manifest.cases.map((entry) => entry.fixture)).size).toBe(
      manifest.cases.length,
    );

    for (const entry of manifest.cases) {
      const fixturePath = resolve(corpusRoot, entry.fixture);
      expect(
        fixturePath === repositoryRoot ||
          fixturePath.startsWith(`${repositoryRoot}\\`),
        entry.id,
      ).toBe(true);
      expect(readFileSync(fixturePath, "utf8").trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.patch.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.provenance.source.trim().length, entry.id).toBeGreaterThan(0);
      expect(entry.provenance.observedAt, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (entry.provenance.method === "in-game-clipboard") {
        expect(entry.patch, entry.id).not.toBe("not-stated");
      } else {
        expect(entry.provenance.source, entry.id).toMatch(/^https:\/\//);
      }
    }
  });

  it("audita el corpus completo reproduciendo sus textos fuente", () => {
    const audit = loadItemTextCorpusAudit();
    expect(audit.issues).toEqual([]);
    expect(audit.cases.every((entry) => entry.replayPassed)).toBe(true);
  });

  for (const entry of manifest.cases) {
    it(`reproduce ${entry.id}`, () => {
      const text = readFileSync(resolve(corpusRoot, entry.fixture), "utf8");
      const parsed = parseItemText(text);
      const diagnosis = diagnoseCraftingItem(parsed.item);
      const explicit = parsed.item.modifiers.filter((modifier) => modifier.kind === "explicit");

      expect(parsed.item).toMatchObject({
        name: entry.expected.name,
        baseType: entry.expected.baseType,
        slot: entry.expected.slot,
        rarity: entry.expected.rarity,
        itemLevel: entry.expected.itemLevel,
      });
      if (entry.expected.quality !== undefined) {
        expect(parsed.item.quality).toBe(entry.expected.quality);
      }
      if (entry.expected.requirements !== undefined) {
        expect(parsed.item.requirements).toEqual(entry.expected.requirements);
      }
      if (entry.expected.craftingState !== undefined) {
        expect(parsed.item.craftingState).toMatchObject(entry.expected.craftingState);
      }

      expect(parsed.item.modifiers).toHaveLength(entry.expected.modifierCount);
      expect(diagnosis).toMatchObject({
        state: entry.expected.diagnosisState,
        explicitCount: entry.expected.explicitCount,
        prefixCount: entry.expected.prefixCount,
        suffixCount: entry.expected.suffixCount,
        unclassifiedExplicitCount: entry.expected.unclassifiedExplicitCount,
      });
      expect(parsed.warnings).toHaveLength(entry.expected.warningCount);

      if (entry.expected.importIssueKind !== undefined) {
        expect(assessCraftingImportIssue(parsed.item, diagnosis).kind).toBe(
          entry.expected.importIssueKind,
        );
      }
      for (const [flag, count] of Object.entries(
        entry.expected.specialModifierCounts ?? {},
      )) {
        expect(
          explicit.filter(
            (modifier) => modifier[flag as "fractured" | "desecrated" | "mutated"],
          ),
          `${entry.id}:${flag}`,
        ).toHaveLength(count);
      }
    });
  }
});
