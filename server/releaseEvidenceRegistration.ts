import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
  buildReleaseEvidenceReceipt,
  ReleaseEvidenceCatalogSchema,
  ReleaseEvidenceSubmissionSchema,
  type ReleaseEvidenceCatalog,
  type ReleaseEvidenceRecord,
  type ReleaseEvidenceSubmission,
} from "../shared/releaseEvidence.js";
import { auditReleaseEvidenceCatalog } from "./releaseEvidenceCatalog.js";

const CATALOG_RELATIVE_PATH = "server/data/releaseEvidence.json";

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export interface RegisteredReleaseEvidence {
  receiptPath: string;
  receiptSha256: string;
  subjectSha256: string;
  record: ReleaseEvidenceRecord;
}

/**
 * Registra una fuente ya preservada en el repositorio y deriva tanto el recibo
 * semántico como las dos huellas. El operador nunca suministra hashes o rutas
 * de salida.
 */
export function registerReleaseEvidence(
  rawSubmission: unknown,
  projectRoot: string,
): RegisteredReleaseEvidence {
  const submission: ReleaseEvidenceSubmission =
    ReleaseEvidenceSubmissionSchema.parse(rawSubmission);
  const root = resolve(projectRoot);
  const catalogPath = resolve(root, CATALOG_RELATIVE_PATH);
  if (!isInside(root, catalogPath) || !existsSync(catalogPath)) {
    throw new Error("No existe el catálogo autorizado de evidencias.");
  }

  const subjectPath = submission.subjectPath.replace(/\\/g, "/");
  const absoluteSubject = resolve(root, subjectPath);
  if (!isInside(root, absoluteSubject) || !existsSync(absoluteSubject)) {
    throw new Error("La fuente no existe dentro del repositorio autorizado.");
  }
  if (!statSync(absoluteSubject).isFile()) {
    throw new Error("La fuente de evidencia debe ser un archivo.");
  }
  if (absoluteSubject === catalogPath) {
    throw new Error("El catálogo no puede utilizarse como fuente de evidencia.");
  }

  const catalog: ReleaseEvidenceCatalog = ReleaseEvidenceCatalogSchema.parse(
    JSON.parse(readFileSync(catalogPath, "utf8")) as unknown,
  );
  if (catalog.records.some((record) => record.evidenceId === submission.evidenceId)) {
    throw new Error(`Ya existe la evidencia ${submission.evidenceId}.`);
  }

  const patchSegment = submission.patch ?? "unknown";
  const receiptPath = [
    "docs/evidence/release",
    patchSegment,
    `${submission.evidenceId}.md`,
  ].join("/");
  const absoluteReceipt = resolve(root, receiptPath);
  if (
    !isInside(root, absoluteReceipt) ||
    absoluteReceipt === absoluteSubject ||
    existsSync(absoluteReceipt)
  ) {
    throw new Error(`El recibo ${receiptPath} ya existe o no es seguro.`);
  }

  const normalizedSubmission = { ...submission, subjectPath };
  const subjectSha256 = sha256(readFileSync(absoluteSubject));
  const receipt = buildReleaseEvidenceReceipt(
    normalizedSubmission,
    subjectSha256,
  );
  const record: ReleaseEvidenceRecord = {
    evidenceId: submission.evidenceId,
    featureId: submission.featureId,
    patch: submission.patch,
    asOf: submission.asOf,
    method: submission.method,
    artifactPath: receiptPath,
    artifactSha256: sha256(receipt),
    note: submission.note,
    subjectPath,
    subjectSha256,
  };
  const nextCatalog = ReleaseEvidenceCatalogSchema.parse({
    ...catalog,
    records: [...catalog.records, record],
  });
  const catalogContent = `${JSON.stringify(nextCatalog, null, 2)}\n`;
  const temporaryCatalog = `${catalogPath}.tmp-${process.pid}-${Date.now()}`;
  let receiptCreated = false;
  try {
    mkdirSync(dirname(absoluteReceipt), { recursive: true });
    writeFileSync(absoluteReceipt, receipt, { encoding: "utf8", flag: "wx" });
    receiptCreated = true;
    const audited = auditReleaseEvidenceCatalog(nextCatalog, root).find(
      (candidate) => candidate.evidenceId === record.evidenceId,
    );
    if (!audited?.artifactVerified) {
      throw new Error(
        audited?.artifactIssue ?? "La evidencia generada no supera su auditoría.",
      );
    }
    writeFileSync(temporaryCatalog, catalogContent, {
      encoding: "utf8",
      flag: "wx",
    });
    ReleaseEvidenceCatalogSchema.parse(
      JSON.parse(readFileSync(temporaryCatalog, "utf8")) as unknown,
    );
    renameSync(temporaryCatalog, catalogPath);
  } catch (error) {
    if (existsSync(temporaryCatalog)) rmSync(temporaryCatalog);
    if (receiptCreated && existsSync(absoluteReceipt)) rmSync(absoluteReceipt);
    throw error;
  }

  return {
    receiptPath,
    receiptSha256: record.artifactSha256,
    subjectSha256,
    record,
  };
}
