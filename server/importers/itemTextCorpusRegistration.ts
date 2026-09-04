import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { assessCraftingImportIssue } from "../../shared/craftingImportReport.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import {
  DirectItemTextCorpusBatchSchema,
  DirectItemTextCorpusSubmissionSchema,
  type DirectItemTextCorpusBatch,
  type DirectItemTextCorpusSubmission,
} from "../../shared/itemTextCorpus.js";
import {
  ItemTextCorpusManifestSchema,
  type ItemTextCorpusExpected,
} from "./itemTextCorpus.js";
import { parseItemText } from "./itemTextParser.js";

type CorpusExpected = ItemTextCorpusExpected;
const CORPUS_RELATIVE_ROOT = "server/fixtures/itemText";
const SPECIAL_STATES = ["fractured", "desecrated", "mutated"] as const;

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

function normalizeTooltip(rawText: string): string {
  return rawText.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
}

function same(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function confirmedSpecialStates(item: ReturnType<typeof parseItemText>["item"]): string[] {
  return SPECIAL_STATES.filter(
    (state) =>
      item.craftingState?.[state] ||
      item.modifiers.some((modifier) => modifier[state]),
  );
}

function buildExpected(rawText: string, confirmation: DirectItemTextCorpusSubmission["expected"]): CorpusExpected {
  const parsed = parseItemText(rawText);
  const diagnosis = diagnoseCraftingItem(parsed.item);
  const independentChecks: Array<[string, unknown, unknown]> = [
    ["name", parsed.item.name, confirmation.name],
    ["baseType", parsed.item.baseType, confirmation.baseType],
    ["slot", parsed.item.slot, confirmation.slot],
    ["rarity", parsed.item.rarity, confirmation.rarity],
    ["itemLevel", parsed.item.itemLevel, confirmation.itemLevel],
    ["quality", parsed.item.quality ?? 0, confirmation.quality],
    ["prefixCount", diagnosis.prefixCount, confirmation.prefixCount],
    ["suffixCount", diagnosis.suffixCount, confirmation.suffixCount],
    ["diagnosisState", diagnosis.state, confirmation.diagnosisState],
    [
      "specialStates",
      confirmedSpecialStates(parsed.item),
      [...confirmation.specialStates].sort(
        (left, right) => SPECIAL_STATES.indexOf(left) - SPECIAL_STATES.indexOf(right),
      ),
    ],
  ];
  const mismatches = independentChecks.filter(
    ([, actual, expected]) => !same(actual, expected),
  );
  if (mismatches.length > 0) {
    throw new Error(
      `La confirmación no coincide con el parser: ${mismatches
        .map(([label, actual, expected]) =>
          `${label}=${JSON.stringify(actual)} (esperado ${JSON.stringify(expected)})`,
        )
        .join("; ")}`,
    );
  }
  if (parsed.warnings.length > 0) {
    throw new Error(
      `La muestra conserva avisos del parser y no puede demostrar compatibilidad: ${parsed.warnings.join("; ")}`,
    );
  }

  const explicit = parsed.item.modifiers.filter(
    (modifier) => modifier.kind === "explicit",
  );
  const requirements = parsed.item.requirements;
  const activeCraftingState = Object.fromEntries(
    Object.entries(parsed.item.craftingState ?? {}).filter(([, value]) => value),
  ) as Record<string, boolean>;
  const specialModifierCounts = Object.fromEntries(
    SPECIAL_STATES.map((state) => [
      state,
      explicit.filter((modifier) => modifier[state]).length,
    ]).filter(([, count]) => Number(count) > 0),
  ) as Record<string, number>;
  const expected: CorpusExpected = {
    name: parsed.item.name,
    baseType: parsed.item.baseType,
    slot: parsed.item.slot,
    rarity: parsed.item.rarity,
    itemLevel: parsed.item.itemLevel!,
    quality: parsed.item.quality ?? 0,
    modifierCount: parsed.item.modifiers.length,
    explicitCount: diagnosis.explicitCount,
    prefixCount: diagnosis.prefixCount,
    suffixCount: diagnosis.suffixCount,
    unclassifiedExplicitCount: diagnosis.unclassifiedExplicitCount,
    diagnosisState: diagnosis.state,
    warningCount: 0,
  };
  if (requirements && Object.keys(requirements).length > 0) {
    expected.requirements = requirements;
  }
  if (Object.keys(activeCraftingState).length > 0) {
    expected.craftingState = activeCraftingState;
  }
  if (Object.keys(specialModifierCounts).length > 0) {
    expected.specialModifierCounts = specialModifierCounts;
  }
  if (diagnosis.state !== "complete") {
    expected.importIssueKind = assessCraftingImportIssue(
      parsed.item,
      diagnosis,
    ).kind;
  }
  return expected;
}

export interface RegisteredDirectItemTextSample {
  id: string;
  fixture: string;
  expected: CorpusExpected;
}

interface PreparedDirectItemTextSample extends RegisteredDirectItemTextSample {
  rawText: string;
  fixturePath: string;
  manifestEntry: {
    id: string;
    fixture: string;
    locale: DirectItemTextCorpusSubmission["locale"];
    patch: string;
    provenance: {
      method: "in-game-clipboard";
      observedAt: string;
      source: string;
    };
    expected: CorpusExpected;
  };
}

function prepareDirectItemTextSample(
  sample: DirectItemTextCorpusBatch["samples"][number],
  corpusRoot: string,
  existingIds: Set<string>,
  existingFixtures: Set<string>,
): PreparedDirectItemTextSample {
  const submission = DirectItemTextCorpusSubmissionSchema.parse(sample.submission);
  const rawText = normalizeTooltip(sample.rawText);
  if (rawText.length < 40) {
    throw new Error("El texto copiado es demasiado corto para ser un tooltip reproducible.");
  }
  if (existingIds.has(submission.id)) {
    throw new Error(`Ya existe la muestra ${submission.id}.`);
  }
  const fixture = `direct/${submission.patch}/${submission.id}.${submission.locale}.txt`;
  const fixturePath = resolve(corpusRoot, fixture);
  if (
    !isInside(corpusRoot, fixturePath) ||
    existingFixtures.has(fixture) ||
    existsSync(fixturePath)
  ) {
    throw new Error(`El fixture ${fixture} ya existe o no es seguro.`);
  }
  const expected = buildExpected(rawText, submission.expected);
  return {
    id: submission.id,
    fixture,
    expected,
    rawText,
    fixturePath,
    manifestEntry: {
      id: submission.id,
      fixture,
      locale: submission.locale,
      patch: submission.patch,
      provenance: {
        method: "in-game-clipboard",
        observedAt: submission.observedAt,
        source: submission.source,
      },
      expected,
    },
  };
}

function prepareDirectItemTextSampleBatch(
  rawBatch: unknown,
  projectRoot: string,
) {
  const batch = DirectItemTextCorpusBatchSchema.parse(rawBatch);
  const root = resolve(projectRoot);
  const corpusRoot = resolve(root, CORPUS_RELATIVE_ROOT);
  const manifestPath = resolve(corpusRoot, "corpus.json");
  if (!isInside(root, manifestPath) || !existsSync(manifestPath)) {
    throw new Error("No existe el manifiesto autorizado del corpus.");
  }
  const manifest = ItemTextCorpusManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
  );
  const existingIds = new Set(manifest.cases.map((entry) => entry.id));
  const existingFixtures = new Set(manifest.cases.map((entry) => entry.fixture));
  const prepared = batch.samples.map((sample) =>
    prepareDirectItemTextSample(
      sample,
      corpusRoot,
      existingIds,
      existingFixtures,
    ),
  );
  const nextManifest = ItemTextCorpusManifestSchema.parse({
    ...manifest,
    cases: [...manifest.cases, ...prepared.map((sample) => sample.manifestEntry)],
  });

  return { manifestPath, nextManifest, prepared };
}

function registrationResult(
  prepared: PreparedDirectItemTextSample[],
): RegisteredDirectItemTextSample[] {
  return prepared.map(({ id, fixture, expected }) => ({ id, fixture, expected }));
}

/**
 * Ejecuta exactamente las validaciones previas al alta sin crear fixtures ni
 * sustituir el manifiesto. Permite comprobar lotes grandes antes de registrar
 * evidencia observada durante un cambio de parche.
 */
export function validateDirectItemTextSampleBatch(
  rawBatch: unknown,
  projectRoot: string,
): RegisteredDirectItemTextSample[] {
  const { prepared } = prepareDirectItemTextSampleBatch(rawBatch, projectRoot);
  return registrationResult(prepared);
}

export function registerDirectItemTextSampleBatch(
  rawBatch: unknown,
  projectRoot: string,
): RegisteredDirectItemTextSample[] {
  const { manifestPath, nextManifest, prepared } =
    prepareDirectItemTextSampleBatch(rawBatch, projectRoot);
  const temporaryManifest = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  const createdFixtures: string[] = [];
  try {
    for (const sample of prepared) {
      mkdirSync(dirname(sample.fixturePath), { recursive: true });
      writeFileSync(sample.fixturePath, sample.rawText, {
        encoding: "utf8",
        flag: "wx",
      });
      createdFixtures.push(sample.fixturePath);
    }
    writeFileSync(temporaryManifest, `${JSON.stringify(nextManifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    ItemTextCorpusManifestSchema.parse(
      JSON.parse(readFileSync(temporaryManifest, "utf8")) as unknown,
    );
    renameSync(temporaryManifest, manifestPath);
  } catch (error) {
    if (existsSync(temporaryManifest)) rmSync(temporaryManifest);
    for (const fixturePath of createdFixtures) {
      if (existsSync(fixturePath)) rmSync(fixturePath);
    }
    throw error;
  }
  return registrationResult(prepared);
}

export function registerDirectItemTextSample(
  rawSubmission: unknown,
  rawTextInput: string,
  projectRoot: string,
): RegisteredDirectItemTextSample {
  const [registered] = registerDirectItemTextSampleBatch(
    {
      schemaVersion: 1,
      samples: [{ submission: rawSubmission, rawText: rawTextInput }],
    },
    projectRoot,
  );
  if (!registered) throw new Error("No se pudo registrar la muestra.");
  return registered;
}
