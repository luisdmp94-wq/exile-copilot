import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
  buildPlayerWalkthroughArtifact,
  PlayerWalkthroughManifestSchema,
  PlayerWalkthroughSubmissionSchema,
  type PlayerWalkthroughManifest,
  type PlayerWalkthroughRecord,
  type PlayerWalkthroughSubmission,
} from "../shared/playerWalkthrough.js";
import { auditPlayerWalkthroughArtifact } from "./playerWalkthroughCatalog.js";

const MANIFEST_RELATIVE_PATH = "server/data/playerWalkthroughs.json";

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export interface RegisteredPlayerWalkthrough {
  artifactPath: string;
  artifactSha256: string;
  record: PlayerWalkthroughRecord;
}

/**
 * Registra una observación sin permitir sobrescrituras ni manifiestos parciales.
 * El único dato aceptado es el contrato compartido; informe y SHA se derivan.
 */
export function registerPlayerWalkthrough(
  rawSubmission: unknown,
  projectRoot: string,
): RegisteredPlayerWalkthrough {
  const submission: PlayerWalkthroughSubmission =
    PlayerWalkthroughSubmissionSchema.parse(rawSubmission);
  const root = resolve(projectRoot);
  const manifestPath = resolve(root, MANIFEST_RELATIVE_PATH);
  if (!isInside(root, manifestPath) || !existsSync(manifestPath)) {
    throw new Error("No existe el manifiesto autorizado de recorridos reales.");
  }

  const manifest: PlayerWalkthroughManifest = PlayerWalkthroughManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
  );
  if (manifest.runs.some((run) => run.id === submission.id)) {
    throw new Error(`Ya existe un recorrido con id ${submission.id}.`);
  }

  const artifactPath = [
    "docs/evidence/player-walkthroughs",
    submission.patch,
    `${submission.id}.md`,
  ].join("/");
  const absoluteArtifactPath = resolve(root, artifactPath);
  if (!isInside(root, absoluteArtifactPath) || existsSync(absoluteArtifactPath)) {
    throw new Error(`El artefacto ${artifactPath} ya existe o no es seguro.`);
  }

  const { id, ...artifactInput } = submission;
  const content = buildPlayerWalkthroughArtifact(artifactInput);
  const record: PlayerWalkthroughRecord = {
    id,
    role: submission.role,
    patch: submission.patch,
    locale: submission.locale,
    observedAt: submission.observedAt,
    outcome: submission.outcome,
    checkpoints: submission.checkpoints,
    blockers: submission.blockers,
    artifactPath,
    artifactSha256: sha256(content),
  };
  const contentIssues = auditPlayerWalkthroughArtifact(record, content);
  if (contentIssues.length > 0) {
    throw new Error(`El informe generado no supera su auditoría: ${contentIssues.join(" ")}`);
  }

  const nextManifest = PlayerWalkthroughManifestSchema.parse({
    ...manifest,
    runs: [...manifest.runs, record],
  });
  const manifestContent = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const temporaryManifest = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  let artifactCreated = false;
  try {
    mkdirSync(dirname(absoluteArtifactPath), { recursive: true });
    writeFileSync(absoluteArtifactPath, content, { encoding: "utf8", flag: "wx" });
    artifactCreated = true;
    writeFileSync(temporaryManifest, manifestContent, {
      encoding: "utf8",
      flag: "wx",
    });
    PlayerWalkthroughManifestSchema.parse(
      JSON.parse(readFileSync(temporaryManifest, "utf8")) as unknown,
    );
    renameSync(temporaryManifest, manifestPath);
  } catch (error) {
    if (existsSync(temporaryManifest)) rmSync(temporaryManifest);
    if (artifactCreated && existsSync(absoluteArtifactPath)) {
      rmSync(absoluteArtifactPath);
    }
    throw error;
  }

  return { artifactPath, artifactSha256: record.artifactSha256, record };
}
