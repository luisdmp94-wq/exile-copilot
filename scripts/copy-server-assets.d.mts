export interface EvidenceCatalogLike {
  records?: Array<{
    artifactPath?: unknown;
    subjectPath?: unknown;
  }>;
}

export interface ItemTextCorpusManifestLike {
  cases?: Array<{ fixture?: unknown }>;
}

export function copyCatalogEvidenceFiles(
  root: string,
  distRoot: string,
  catalog: EvidenceCatalogLike,
): void;

export function copyCorpusFixtureFiles(
  root: string,
  distRoot: string,
  corpusRoot: string,
  manifest: ItemTextCorpusManifestLike,
): void;

export function copyServerAssets(root: string): void;
