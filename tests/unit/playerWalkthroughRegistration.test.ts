import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlayerWalkthroughManifestSchema } from "../../shared/playerWalkthrough.js";
import { auditPlayerWalkthroughManifest } from "../../server/playerWalkthroughCatalog.js";
import { registerPlayerWalkthrough } from "../../server/playerWalkthroughRegistration.js";

const checkpoints = {
  foundStartingAction: true,
  importedGameItem: true,
  understoodInGameBoundary: true,
  returnedObservedResult: true,
  explainedStopDecision: true,
};

const observations = [
  "Encontró la entrada principal sin recibir instrucciones del observador.",
  "Explicó que la moneda se utiliza dentro del juego y no en la página.",
  "Volvió con el resultado completo y justificó por qué debía detenerse.",
];

function projectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "exile-copilot-registration-"));
  const data = join(root, "server/data");
  mkdirSync(data, { recursive: true });
  writeFileSync(
    join(data, "playerWalkthroughs.json"),
    `${JSON.stringify({ schemaVersion: 1, runs: [] }, null, 2)}\n`,
  );
  return root;
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    id: "new-player-1.0-2026-12-11-a",
    role: "new-player",
    patch: "1.0",
    locale: "es",
    observedAt: "2026-12-11",
    outcome: "pass",
    checkpoints,
    blockers: [],
    observations,
    ...overrides,
  };
}

describe("registro seguro de recorridos reales", () => {
  it("genera el informe, calcula la huella y deja el manifiesto auditable", () => {
    const root = projectRoot();
    const registered = registerPlayerWalkthrough(submission(), root);
    const manifest = PlayerWalkthroughManifestSchema.parse(
      JSON.parse(
        readFileSync(join(root, "server/data/playerWalkthroughs.json"), "utf8"),
      ) as unknown,
    );

    expect(registered.artifactPath).toBe(
      "docs/evidence/player-walkthroughs/1.0/new-player-1.0-2026-12-11-a.md",
    );
    expect(readFileSync(join(root, registered.artifactPath), "utf8")).toContain(
      "Formato: EC-PLAYER-WALKTHROUGH-1",
    );
    expect(manifest.runs).toHaveLength(1);
    expect(auditPlayerWalkthroughManifest(manifest, root).runs[0]).toMatchObject({
      artifactVerified: true,
      artifactIssue: null,
    });
  });

  it("rechaza aprobaciones incompletas y no escribe archivos parciales", () => {
    const root = projectRoot();
    const invalid = submission({
      checkpoints: { ...checkpoints, importedGameItem: false },
      observations: ["Solo una nota"],
    });

    expect(() => registerPlayerWalkthrough(invalid, root)).toThrow();
    expect(
      existsSync(
        join(
          root,
          "docs/evidence/player-walkthroughs/1.0/new-player-1.0-2026-12-11-a.md",
        ),
      ),
    ).toBe(false);
    const manifest = JSON.parse(
      readFileSync(join(root, "server/data/playerWalkthroughs.json"), "utf8"),
    ) as { runs: unknown[] };
    expect(manifest.runs).toHaveLength(0);
  });

  it("no sobrescribe ids, artefactos ni rutas manipuladas", () => {
    const root = projectRoot();
    const first = registerPlayerWalkthrough(submission(), root);
    const original = readFileSync(join(root, first.artifactPath), "utf8");

    expect(() =>
      registerPlayerWalkthrough(
        submission({ observations: observations.map((line) => `${line} Repetido.`) }),
        root,
      ),
    ).toThrow("Ya existe un recorrido");
    expect(readFileSync(join(root, first.artifactPath), "utf8")).toBe(original);
    expect(() =>
      registerPlayerWalkthrough(submission({ id: "../fuera" }), root),
    ).toThrow();
    expect(() =>
      registerPlayerWalkthrough(submission({ id: "otro", patch: "../1.0" }), root),
    ).toThrow();
  });
});
