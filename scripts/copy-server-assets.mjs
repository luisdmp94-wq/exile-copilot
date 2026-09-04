import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function copyRepositoryFiles(root, distRoot, sources, label) {
  const copies = sources.map((source) => {
    const repositoryRelation = relative(root, source);
    if (
      repositoryRelation.length === 0 ||
      repositoryRelation.startsWith("..") ||
      isAbsolute(repositoryRelation)
    ) {
      throw new Error(`Ruta de ${label} fuera del repositorio: ${source}`);
    }
    const destination = resolve(distRoot, repositoryRelation);
    const distRelation = relative(distRoot, destination);
    if (
      distRelation.length === 0 ||
      distRelation.startsWith("..") ||
      isAbsolute(distRelation)
    ) {
      throw new Error(`Ruta de ${label} fuera de dist-server: ${source}`);
    }
    return { source, destination };
  });
  for (const { source, destination } of copies) {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}

export function copyCatalogEvidenceFiles(root, distRoot, catalog) {
  const sources = (catalog.records ?? []).flatMap((record) =>
    [record.artifactPath, record.subjectPath]
      .filter((evidencePath) => typeof evidencePath === "string")
      .map((evidencePath) => resolve(root, evidencePath)),
  );
  copyRepositoryFiles(root, distRoot, sources, "evidencia");
}

export function copyCorpusFixtureFiles(root, distRoot, corpusRoot, manifest) {
  const sources = (manifest.cases ?? [])
    .filter((entry) => typeof entry.fixture === "string")
    .map((entry) => resolve(corpusRoot, entry.fixture));
  copyRepositoryFiles(root, distRoot, sources, "fixture de corpus");
}

export function copyServerAssets(root) {
  const distRoot = resolve(root, "dist-server");
  const target = resolve(distRoot, "server");

  mkdirSync(target, { recursive: true });
  for (const directory of ["data", "fixtures"]) {
    const destination = resolve(target, directory);
    rmSync(destination, { recursive: true, force: true });
    cpSync(resolve(root, "server", directory), destination, { recursive: true });
  }

  // Los auditores resuelven evidencias y fixtures desde la raíz del artefacto
  // compilado. Ambos manifiestos pueden apuntar a `docs/`, fuera del árbol del
  // servidor que acabamos de copiar.
  const evidenceCatalog = JSON.parse(
    readFileSync(resolve(root, "server", "data", "releaseEvidence.json"), "utf8"),
  );
  copyCatalogEvidenceFiles(root, distRoot, evidenceCatalog);
  const corpusRoot = resolve(root, "server", "fixtures", "itemText");
  const corpusManifest = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8"),
  );
  copyCorpusFixtureFiles(root, distRoot, corpusRoot, corpusManifest);
}

const directEntry = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (directEntry) copyServerAssets(process.cwd());
