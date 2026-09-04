import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  registerCraftingKnowledgeBatch,
  validateCraftingKnowledgeBatch,
} from "../../server/crafting/knowledgeRegistration.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "exile-copilot-crafting-knowledge-"));
  roots.push(root);
  const data = join(root, "server/data/crafting");
  mkdirSync(data, { recursive: true });
  writeFileSync(
    join(data, "manifest.json"),
    `${JSON.stringify({ schemaVersion: 1, files: [] }, null, 2)}\n`,
  );
  return root;
}

function snapshot(snapshotId: string): Record<string, unknown> {
  return {
    snapshotId,
    game: "poe2",
    patch: "0.5.4f",
    leagueScope: null,
    asOf: "2026-09-01",
    completeness: "observed-only",
    scope: { itemClasses: null, baseTypes: null },
    sources: [
      {
        id: `${snapshotId}-source`,
        label: "Tooltip del cliente",
        url: null,
        consultedAt: "2026-09-01",
        version: "0.5.4f",
        method: "in-game-tooltip",
        terms: "Evidencia local; no redistribuible.",
        redistributionAllowed: false,
        fingerprint: "sha256:12345678",
        extracts: "Una observación acotada.",
        risk: "No demuestra un pool completo.",
      },
    ],
    modCandidates: [],
    observedActions: [],
    limitations: ["No contiene pools, pesos ni probabilidades."],
    redistributionAllowed: false,
  };
}

describe("alta por lotes del conocimiento de Crafting", () => {
  it("ensaya el lote completo sin escribir snapshots ni modificar el manifiesto", () => {
    const root = project();
    const registered = validateCraftingKnowledgeBatch(
      {
        schemaVersion: 1,
        snapshots: [snapshot("bases-observadas"), snapshot("essences-observadas")],
      },
      root,
    );

    expect(registered).toEqual([
      { snapshotId: "bases-observadas", file: "bases-observadas.json" },
      { snapshotId: "essences-observadas", file: "essences-observadas.json" },
    ]);
    const manifest = JSON.parse(
      readFileSync(join(root, "server/data/crafting/manifest.json"), "utf8"),
    ) as { files: string[] };
    expect(manifest.files).toEqual([]);
    for (const entry of registered) {
      expect(existsSync(join(root, "server/data/crafting", entry.file))).toBe(false);
    }
  });

  it("incorpora varios snapshots y actualiza el manifiesto una sola vez", () => {
    const root = project();
    const registered = registerCraftingKnowledgeBatch(
      { schemaVersion: 1, snapshots: [snapshot("bases-observadas"), snapshot("essences-observadas")] },
      root,
    );

    expect(registered).toHaveLength(2);
    const manifest = JSON.parse(
      readFileSync(join(root, "server/data/crafting/manifest.json"), "utf8"),
    ) as { files: string[] };
    expect(manifest.files).toEqual(["bases-observadas.json", "essences-observadas.json"]);
    expect(existsSync(join(root, "server/data/crafting/bases-observadas.json"))).toBe(true);
    expect(existsSync(join(root, "server/data/crafting/essences-observadas.json"))).toBe(true);
  });

  it("rechaza el lote completo si una entrada es insegura o de PoE1", () => {
    const root = project();
    const invalid = snapshot("poe1-contaminado");
    const sources = invalid.sources as Array<Record<string, unknown>>;
    sources[0] = { ...sources[0], url: "https://www.poewiki.net/wiki/Modifier" };

    expect(() =>
      registerCraftingKnowledgeBatch(
        { schemaVersion: 1, snapshots: [snapshot("valido"), invalid] },
        root,
      ),
    ).toThrow(/fuente de PoE1/i);
    expect(existsSync(join(root, "server/data/crafting/valido.json"))).toBe(false);
    const manifest = JSON.parse(
      readFileSync(join(root, "server/data/crafting/manifest.json"), "utf8"),
    ) as { files: string[] };
    expect(manifest.files).toEqual([]);
  });

  it("no sobrescribe ids o archivos ya registrados", () => {
    const root = project();
    const batch = { schemaVersion: 1, snapshots: [snapshot("repetido")] };
    registerCraftingKnowledgeBatch(batch, root);
    expect(() => registerCraftingKnowledgeBatch(batch, root)).toThrow(/duplicados|ya existe/i);
  });
});
