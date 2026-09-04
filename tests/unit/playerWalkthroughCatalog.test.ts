import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPlayerWalkthroughArtifact,
  PlayerWalkthroughManifestSchema,
  type PlayerWalkthroughArtifactInput,
} from "../../shared/playerWalkthrough.js";
import { auditPlayerWalkthroughManifest } from "../../server/playerWalkthroughCatalog.js";

const checkpoints = {
  foundStartingAction: true,
  importedGameItem: true,
  understoodInGameBoundary: true,
  returnedObservedResult: true,
  explainedStopDecision: true,
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const observations = [
  "Encontró la entrada principal sin recibir instrucciones del observador.",
  "Explicó que la moneda se utiliza dentro del juego y no en la página.",
  "Volvió con el resultado completo y justificó por qué debía detenerse.",
];

function buildArtifact(
  overrides: Partial<PlayerWalkthroughArtifactInput> = {},
): string {
  return buildPlayerWalkthroughArtifact({
    role: "new-player",
    patch: "1.0",
    locale: "es",
    observedAt: "2026-12-11",
    outcome: "pass",
    checkpoints,
    blockers: [],
    observations,
    ...overrides,
  });
}

describe("catálogo de recorridos reales", () => {
  it("verifica los bytes del informe y no confía solo en el manifiesto", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copilot-walkthrough-"));
    const relativePath = "docs/evidence/player-walkthroughs/1.0/new-player.md";
    const absolutePath = join(root, relativePath);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    const content = buildArtifact();
    writeFileSync(absolutePath, content);
    const manifest = PlayerWalkthroughManifestSchema.parse({
      schemaVersion: 1,
      runs: [
        {
          id: "new-player-1.0",
          role: "new-player",
          patch: "1.0",
          locale: "es",
          observedAt: "2026-12-11",
          outcome: "pass",
          checkpoints,
          blockers: [],
          artifactPath: relativePath,
          artifactSha256: sha256(content),
        },
      ],
    });

    expect(auditPlayerWalkthroughManifest(manifest, root).runs[0]).toMatchObject({
      artifactVerified: true,
      artifactIssue: null,
    });

    writeFileSync(absolutePath, "contenido cambiado");
    expect(auditPlayerWalkthroughManifest(manifest, root).runs[0]).toMatchObject({
      artifactVerified: false,
      artifactIssue: expect.stringContaining("huella"),
    });
  });

  it("rechaza un archivo vacío aunque su huella sea correcta", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copilot-walkthrough-"));
    const relativePath = "docs/evidence/player-walkthroughs/1.0/empty.md";
    const absolutePath = join(root, relativePath);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, "");
    const manifest = PlayerWalkthroughManifestSchema.parse({
      schemaVersion: 1,
      runs: [
        {
          id: "empty-new-player-1.0",
          role: "new-player",
          patch: "1.0",
          locale: "es",
          observedAt: "2026-12-11",
          outcome: "pass",
          checkpoints,
          blockers: [],
          artifactPath: relativePath,
          artifactSha256: sha256(""),
        },
      ],
    });

    const audited = auditPlayerWalkthroughManifest(manifest, root).runs[0];
    expect(audited).toMatchObject({ artifactVerified: false });
    expect(audited?.artifactIssue).toContain("cabecera");
    expect(audited?.artifactIssue).toContain("tres observaciones");
  });

  it("contrasta metadatos, puntos y observaciones con el manifiesto", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copilot-walkthrough-"));
    const relativePath = "docs/evidence/player-walkthroughs/1.0/tampered.md";
    const absolutePath = join(root, relativePath);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    const content = buildArtifact({
      patch: "0.5.4f",
      checkpoints: { ...checkpoints, importedGameItem: false },
      observations: ["Demasiado breve"],
    });
    writeFileSync(absolutePath, content);
    const manifest = PlayerWalkthroughManifestSchema.parse({
      schemaVersion: 1,
      runs: [
        {
          id: "tampered-new-player-1.0",
          role: "new-player",
          patch: "1.0",
          locale: "es",
          observedAt: "2026-12-11",
          outcome: "pass",
          checkpoints,
          blockers: [],
          artifactPath: relativePath,
          artifactSha256: sha256(content),
        },
      ],
    });

    const audited = auditPlayerWalkthroughManifest(manifest, root).runs[0];
    expect(audited).toMatchObject({ artifactVerified: false });
    expect(audited?.artifactIssue).toContain("Parche no coincide");
    expect(audited?.artifactIssue).toContain(
      "importedGameItem no coincide con el manifiesto",
    );
    expect(audited?.artifactIssue).toContain("tres observaciones");
  });

  it("rechaza rutas exteriores y artefactos compartidos entre roles", () => {
    const root = mkdtempSync(join(tmpdir(), "exile-copilot-walkthrough-"));
    const common = {
      patch: "1.0",
      locale: "es",
      observedAt: "2026-12-11",
      outcome: "pass" as const,
      checkpoints,
      blockers: [],
      artifactPath: "../fuera.md",
      artifactSha256: "a".repeat(64),
    };
    const manifest = PlayerWalkthroughManifestSchema.parse({
      schemaVersion: 1,
      runs: [
        { ...common, id: "new", role: "new-player" },
        { ...common, id: "expert", role: "expert-player" },
      ],
    });
    const audit = auditPlayerWalkthroughManifest(manifest, root);

    expect(audit.issues).toContain(
      "Dos recorridos no pueden usar el mismo artefacto como prueba independiente.",
    );
    expect(audit.runs.every((run) => !run.artifactVerified)).toBe(true);
  });
});
