import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import { assessCraftingImportIssue } from "../../shared/craftingImportReport.js";
import {
  ItemTextCorpusAuditSchema,
  ItemTextCorpusLocaleSchema,
  ItemTextCorpusProvenanceMethodSchema,
  type ItemTextCorpusAudit,
} from "../../shared/itemTextCorpus.js";
import { parseItemText } from "./itemTextParser.js";

export const ItemTextCorpusExpectedSchema = z.object({
  name: z.string(),
  baseType: z.string(),
  slot: z.string(),
  rarity: z.string(),
  itemLevel: z.number().int(),
  quality: z.number().int().optional(),
  requirements: z.record(z.string(), z.number()).optional(),
  modifierCount: z.number().int().nonnegative(),
  explicitCount: z.number().int().nonnegative(),
  prefixCount: z.number().int().nonnegative(),
  suffixCount: z.number().int().nonnegative(),
  unclassifiedExplicitCount: z.number().int().nonnegative(),
  diagnosisState: z.enum(["complete", "partial", "blocked"]),
  importIssueKind: z.string().optional(),
  craftingState: z.record(z.string(), z.boolean()).optional(),
  specialModifierCounts: z
    .object({
      fractured: z.number().int().nonnegative().optional(),
      desecrated: z.number().int().nonnegative().optional(),
      mutated: z.number().int().nonnegative().optional(),
    })
    .optional(),
  warningCount: z.number().int().nonnegative(),
});
export type ItemTextCorpusExpected = z.infer<
  typeof ItemTextCorpusExpectedSchema
>;

export const ItemTextCorpusManifestSchema = z.object({
  schemaVersion: z.literal(1),
  supportedLocales: z
    .array(ItemTextCorpusLocaleSchema)
    .min(1)
    .refine((locales) => new Set(locales).size === locales.length),
  cases: z
    .array(
      z.object({
        id: z.string().min(1),
        fixture: z.string().min(1),
        locale: ItemTextCorpusLocaleSchema,
        patch: z.string().min(1),
        provenance: z.object({
          method: ItemTextCorpusProvenanceMethodSchema,
          observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          source: z.string().min(1),
        }),
        expected: ItemTextCorpusExpectedSchema,
      }),
    ),
});

const defaultCorpusRoot = fileURLToPath(
  new URL("../fixtures/itemText/", import.meta.url),
);

function isInsideRepository(repositoryRoot: string, path: string): boolean {
  const fromRoot = relative(repositoryRoot, path);
  return fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}

function compare(
  issues: string[],
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push(`${label}: se obtuvo ${JSON.stringify(actual)}, se esperaba ${JSON.stringify(expected)}.`);
  }
}

/**
 * Reproduce el corpus desde los textos fuente y devuelve un resumen puro para
 * la barrera de lanzamiento. El manifiesto no puede autodeclararse correcto.
 */
export function loadItemTextCorpusAudit(
  corpusRoot = defaultCorpusRoot,
): ItemTextCorpusAudit {
  const repositoryRoot = resolve(corpusRoot, "../../..");
  let manifest: z.infer<typeof ItemTextCorpusManifestSchema>;
  try {
    manifest = ItemTextCorpusManifestSchema.parse(
      JSON.parse(readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")),
    );
  } catch (error) {
    return ItemTextCorpusAuditSchema.parse({
      schemaVersion: 1,
      supportedLocales: ["es", "en"],
      issues: [
        `No se pudo cargar un manifiesto de corpus válido: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      ],
      cases: [],
    });
  }
  const manifestIssues: string[] = [];
  const ids = manifest.cases.map((entry) => entry.id);
  const fixtures = manifest.cases.map((entry) => entry.fixture);
  if (new Set(ids).size !== ids.length) manifestIssues.push("Hay ids de corpus duplicados.");
  if (new Set(fixtures).size !== fixtures.length) {
    manifestIssues.push("Hay rutas de fixture duplicadas.");
  }
  for (const entry of manifest.cases) {
    if (
      entry.provenance.method === "in-game-clipboard" &&
      entry.patch === "not-stated"
    ) {
      manifestIssues.push(`${entry.id}: una copia del juego debe declarar su parche.`);
    }
    if (
      entry.provenance.method === "official-forum-derived-regression" &&
      !entry.provenance.source.startsWith("https://")
    ) {
      manifestIssues.push(`${entry.id}: la regresión derivada debe enlazar su fuente HTTPS.`);
    }
  }

  const cases = manifest.cases.map((entry) => {
    const issues: string[] = [];
    const fixturePath = resolve(corpusRoot, entry.fixture);
    if (!isInsideRepository(repositoryRoot, fixturePath)) {
      issues.push("La ruta del fixture sale del repositorio.");
    } else {
      try {
        const parsed = parseItemText(readFileSync(fixturePath, "utf8"));
        const diagnosis = diagnoseCraftingItem(parsed.item);
        const explicit = parsed.item.modifiers.filter(
          (modifier) => modifier.kind === "explicit",
        );

        compare(issues, "name", parsed.item.name, entry.expected.name);
        compare(issues, "baseType", parsed.item.baseType, entry.expected.baseType);
        compare(issues, "slot", parsed.item.slot, entry.expected.slot);
        compare(issues, "rarity", parsed.item.rarity, entry.expected.rarity);
        compare(issues, "itemLevel", parsed.item.itemLevel, entry.expected.itemLevel);
        if (entry.expected.quality !== undefined) {
          compare(issues, "quality", parsed.item.quality, entry.expected.quality);
        }
        if (entry.expected.requirements !== undefined) {
          compare(issues, "requirements", parsed.item.requirements, entry.expected.requirements);
        }
        if (entry.expected.craftingState !== undefined) {
          for (const [flag, expected] of Object.entries(entry.expected.craftingState)) {
            compare(
              issues,
              `craftingState.${flag}`,
              parsed.item.craftingState?.[flag as keyof NonNullable<typeof parsed.item.craftingState>],
              expected,
            );
          }
        }
        compare(issues, "modifierCount", parsed.item.modifiers.length, entry.expected.modifierCount);
        compare(issues, "explicitCount", diagnosis.explicitCount, entry.expected.explicitCount);
        compare(issues, "prefixCount", diagnosis.prefixCount, entry.expected.prefixCount);
        compare(issues, "suffixCount", diagnosis.suffixCount, entry.expected.suffixCount);
        compare(
          issues,
          "unclassifiedExplicitCount",
          diagnosis.unclassifiedExplicitCount,
          entry.expected.unclassifiedExplicitCount,
        );
        compare(issues, "diagnosisState", diagnosis.state, entry.expected.diagnosisState);
        compare(issues, "warningCount", parsed.warnings.length, entry.expected.warningCount);
        if (entry.expected.importIssueKind !== undefined) {
          compare(
            issues,
            "importIssueKind",
            assessCraftingImportIssue(parsed.item, diagnosis).kind,
            entry.expected.importIssueKind,
          );
        }
        for (const [flag, expected] of Object.entries(
          entry.expected.specialModifierCounts ?? {},
        )) {
          compare(
            issues,
            `specialModifierCounts.${flag}`,
            explicit.filter(
              (modifier) => modifier[flag as "fractured" | "desecrated" | "mutated"],
            ).length,
            expected,
          );
        }
      } catch (error) {
        issues.push(error instanceof Error ? error.message : "No se pudo reproducir el fixture.");
      }
    }
    return {
      id: entry.id,
      locale: entry.locale,
      patch: entry.patch,
      provenance: entry.provenance,
      replayPassed: issues.length === 0,
      issues,
    };
  });

  return ItemTextCorpusAuditSchema.parse({
    schemaVersion: manifest.schemaVersion,
    supportedLocales: manifest.supportedLocales,
    issues: manifestIssues,
    cases,
  });
}
