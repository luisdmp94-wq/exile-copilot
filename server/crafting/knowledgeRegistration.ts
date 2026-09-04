import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import {
  CraftingKnowledgeManifestSchema,
  CraftingKnowledgeSnapshotSchema,
  loadCraftingKnowledge,
  type CraftingKnowledgeSnapshot,
} from "./knowledgeRegistry.js";

const BATCH_LIMIT = 100;
const MANIFEST_RELATIVE_PATH = "server/data/crafting/manifest.json";
const DATA_RELATIVE_PATH = "server/data/crafting";

export const CraftingKnowledgeBatchSchema = z.strictObject({
  schemaVersion: z.literal(1),
  snapshots: z.array(CraftingKnowledgeSnapshotSchema).min(1).max(BATCH_LIMIT),
});

export interface RegisteredCraftingKnowledge {
  snapshotId: string;
  file: string;
}

interface PreparedCraftingKnowledgeBatch {
  batch: z.infer<typeof CraftingKnowledgeBatchSchema>;
  dataDirectory: string;
  destinations: string[];
  files: string[];
  manifestPath: string;
  nextManifest: z.infer<typeof CraftingKnowledgeManifestSchema>;
}

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

function filenameFor(snapshot: CraftingKnowledgeSnapshot): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(snapshot.snapshotId)) {
    throw new Error(
      `El snapshotId «${snapshot.snapshotId}» no puede convertirse en un nombre de archivo seguro.`,
    );
  }
  return `${snapshot.snapshotId}.json`;
}

function prepareCraftingKnowledgeBatch(
  rawBatch: unknown,
  projectRoot: string,
): PreparedCraftingKnowledgeBatch {
  const batch = CraftingKnowledgeBatchSchema.parse(rawBatch);
  const root = resolve(projectRoot);
  const dataDirectory = resolve(root, DATA_RELATIVE_PATH);
  const manifestPath = resolve(root, MANIFEST_RELATIVE_PATH);
  if (
    !isInside(root, dataDirectory) ||
    !isInside(root, manifestPath) ||
    !existsSync(manifestPath)
  ) {
    throw new Error("No existe el manifiesto autorizado de Crafting.");
  }

  const manifest = CraftingKnowledgeManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
  );
  const currentRaw = manifest.files.map((file) =>
    JSON.parse(readFileSync(resolve(dataDirectory, file), "utf8")) as unknown,
  );
  // También detecta ids duplicados entre el lote y los datos ya activos.
  loadCraftingKnowledge([...currentRaw, ...batch.snapshots]);

  const files = batch.snapshots.map(filenameFor);
  if (new Set(files).size !== files.length) {
    throw new Error("El lote intenta escribir dos snapshots en el mismo archivo.");
  }
  const destinations = files.map((file) => resolve(dataDirectory, file));
  for (const destination of destinations) {
    if (!isInside(dataDirectory, destination) || existsSync(destination)) {
      throw new Error(`El archivo ${destination} ya existe o no es seguro.`);
    }
  }

  const nextManifest = CraftingKnowledgeManifestSchema.parse({
    ...manifest,
    files: [...manifest.files, ...files],
  });

  return {
    batch,
    dataDirectory,
    destinations,
    files,
    manifestPath,
    nextManifest,
  };
}

function registrationResult(
  batch: z.infer<typeof CraftingKnowledgeBatchSchema>,
  files: string[],
): RegisteredCraftingKnowledge[] {
  return batch.snapshots.map((snapshot, index) => ({
    snapshotId: snapshot.snapshotId,
    file: files[index]!,
  }));
}

/** Valida un lote completo contra el registro activo sin escribir archivos. */
export function validateCraftingKnowledgeBatch(
  rawBatch: unknown,
  projectRoot: string,
): RegisteredCraftingKnowledge[] {
  const { batch, files } = prepareCraftingKnowledgeBatch(rawBatch, projectRoot);
  return registrationResult(batch, files);
}

/**
 * Incorpora hasta cien snapshots en una sola operación. Todo el lote se valida
 * contra el registro ya activo antes de escribir el primer archivo. Si falla
 * una escritura o el manifiesto final, elimina cualquier alta parcial.
 */
export function registerCraftingKnowledgeBatch(
  rawBatch: unknown,
  projectRoot: string,
): RegisteredCraftingKnowledge[] {
  const { batch, dataDirectory, destinations, files, manifestPath, nextManifest } =
    prepareCraftingKnowledgeBatch(rawBatch, projectRoot);
  const temporaryManifest = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  const created: string[] = [];
  try {
    mkdirSync(dataDirectory, { recursive: true });
    batch.snapshots.forEach((snapshot, index) => {
      const destination = destinations[index]!;
      writeFileSync(destination, `${JSON.stringify(snapshot, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      created.push(destination);
    });
    writeFileSync(temporaryManifest, `${JSON.stringify(nextManifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    CraftingKnowledgeManifestSchema.parse(
      JSON.parse(readFileSync(temporaryManifest, "utf8")) as unknown,
    );
    renameSync(temporaryManifest, manifestPath);
  } catch (error) {
    if (existsSync(temporaryManifest)) rmSync(temporaryManifest);
    for (const path of created) {
      if (existsSync(path)) rmSync(path);
    }
    throw error;
  }

  return registrationResult(batch, files);
}
