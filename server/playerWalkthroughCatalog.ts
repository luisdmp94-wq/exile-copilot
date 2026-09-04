import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAYER_WALKTHROUGH_ARTIFACT_VERSION,
  PLAYER_WALKTHROUGH_CHECKPOINT_KEYS,
  PlayerWalkthroughManifestSchema,
  type AuditedPlayerWalkthrough,
  type PlayerWalkthroughAudit,
  type PlayerWalkthroughManifest,
  type PlayerWalkthroughRecord,
} from "../shared/playerWalkthrough.js";

const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MANIFEST_PATH = fileURLToPath(
  new URL("./data/playerWalkthroughs.json", import.meta.url),
);

function isInside(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation.length > 0 && !relation.startsWith("..") && !isAbsolute(relation);
}

function normalizedLines(content: string): string[] {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trimEnd());
}

function metadataValue(lines: string[], label: string): string | null {
  const prefix = `${label}: `;
  const matches = lines.filter((line) => line.startsWith(prefix));
  return matches.length === 1 ? matches[0]?.slice(prefix.length).trim() ?? null : null;
}

function sectionBullets(
  lines: string[],
  heading: string,
  nextHeading?: string,
): string[] {
  const start = lines.indexOf(heading);
  if (start < 0) return [];
  const end = nextHeading ? lines.indexOf(nextHeading, start + 1) : lines.length;
  const sectionEnd = end < 0 ? lines.length : end;
  return lines
    .slice(start + 1, sectionEnd)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

/** La huella no basta: el informe debe demostrar lo que declara el manifiesto. */
export function auditPlayerWalkthroughArtifact(
  run: PlayerWalkthroughRecord,
  content: string,
): string[] {
  const lines = normalizedLines(content);
  const issues: string[] = [];
  const metadata = {
    Formato: PLAYER_WALKTHROUGH_ARTIFACT_VERSION,
    Rol: run.role,
    Parche: run.patch,
    Idioma: run.locale,
    Fecha: run.observedAt,
    Resultado: run.outcome,
  };
  if (lines[0] !== "EXILE COPILOT — RECORRIDO REAL") {
    issues.push("Falta la cabecera del formato de recorrido real.");
  }
  for (const [label, expected] of Object.entries(metadata)) {
    const actual = metadataValue(lines, label);
    if (actual !== expected) {
      issues.push(`${label} no coincide: se obtuvo ${actual ?? "ausente"}, se esperaba ${expected}.`);
    }
  }

  for (const key of PLAYER_WALKTHROUGH_CHECKPOINT_KEYS) {
    const prefix = `- [`;
    const suffix = `] ${key}`;
    const matches = lines.filter(
      (line) => line.startsWith(prefix) && line.includes(suffix),
    );
    if (matches.length !== 1) {
      issues.push(`El punto ${key} debe aparecer exactamente una vez.`);
      continue;
    }
    const observed = matches[0]?.startsWith("- [x]") ?? false;
    if (observed !== run.checkpoints[key]) {
      issues.push(`El punto ${key} no coincide con el manifiesto.`);
    }
  }

  const blockers = sectionBullets(lines, "BLOQUEOS", "OBSERVACIONES");
  const expectedBlockers = run.blockers.length > 0 ? run.blockers : ["Ninguno"];
  if (JSON.stringify(blockers) !== JSON.stringify(expectedBlockers)) {
    issues.push("Los bloqueos del informe no coinciden con el manifiesto.");
  }

  const observations = sectionBullets(lines, "OBSERVACIONES");
  if (
    observations.length < 3 ||
    observations.some((observation) => observation.trim().length < 12)
  ) {
    issues.push("El informe necesita al menos tres observaciones concretas.");
  }
  return issues;
}

export function auditPlayerWalkthroughManifest(
  manifest: PlayerWalkthroughManifest,
  projectRoot = PROJECT_ROOT,
): PlayerWalkthroughAudit {
  const root = resolve(projectRoot);
  const issues: string[] = [];
  const ids = manifest.runs.map((run) => run.id);
  const artifacts = manifest.runs.map((run) => run.artifactPath);
  if (new Set(ids).size !== ids.length) issues.push("Hay ids de recorrido duplicados.");
  if (new Set(artifacts).size !== artifacts.length) {
    issues.push("Dos recorridos no pueden usar el mismo artefacto como prueba independiente.");
  }

  const runs: AuditedPlayerWalkthrough[] = manifest.runs.map((run) => {
    const artifact = resolve(root, run.artifactPath);
    if (!isInside(root, artifact)) {
      return {
        ...run,
        artifactVerified: false,
        artifactIssue: "La ruta del recorrido sale del repositorio autorizado.",
      };
    }
    if (!existsSync(artifact)) {
      return {
        ...run,
        artifactVerified: false,
        artifactIssue: `No existe ${run.artifactPath}.`,
      };
    }
    const content = readFileSync(artifact, "utf8");
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== run.artifactSha256) {
      return {
        ...run,
        artifactVerified: false,
        artifactIssue: `La huella de ${run.artifactPath} no coincide.`,
      };
    }
    const contentIssues = auditPlayerWalkthroughArtifact(run, content);
    if (contentIssues.length > 0) {
      return {
        ...run,
        artifactVerified: false,
        artifactIssue: contentIssues.join(" "),
      };
    }
    return { ...run, artifactVerified: true, artifactIssue: null };
  });

  return { schemaVersion: 1, issues, runs };
}

export function loadPlayerWalkthroughAudit(): PlayerWalkthroughAudit {
  try {
    const manifest = PlayerWalkthroughManifestSchema.parse(
      JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as unknown,
    );
    return auditPlayerWalkthroughManifest(manifest);
  } catch (error) {
    return {
      schemaVersion: 1,
      issues: [
        `No se pudo cargar el manifiesto de recorridos reales: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      ],
      runs: [],
    };
  }
}
