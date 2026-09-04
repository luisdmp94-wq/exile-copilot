import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PatchVersionSchema } from "../shared/domain.js";
import { PatchCompatibilityRegistrySchema } from "../shared/patchCompatibility.js";
import { evaluateReleaseReadiness } from "../shared/releaseReadiness.js";
import { loadConfig } from "../server/config.js";
import {
  PASSIVE_REGISTRY_EVIDENCE_ID,
  getRegistryProvenance,
} from "../server/registry/passiveRegistry.js";
import { loadReleaseEvidenceCatalog } from "../server/releaseEvidenceCatalog.js";
import { loadItemTextCorpusAudit } from "../server/importers/itemTextCorpus.js";
import { loadPlayerWalkthroughAudit } from "../server/playerWalkthroughCatalog.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function json(relativePath: string): unknown {
  const path = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8"));
}

const targetPatch = argument("--target") ?? "1.0";
const strict = process.argv.includes("--strict");
const patches = z.array(PatchVersionSchema).parse(json("server/data/patches.json"));
const compatibility = PatchCompatibilityRegistrySchema.parse(
  json("server/data/patchCompatibility.json"),
);
const declaredTarget = compatibility.targetRelease;
const targetMetadata = patches.find((candidate) => candidate.id === targetPatch);
const releaseTarget = targetPatch === declaredTarget.version
  ? declaredTarget
  : (() => {
      if (!targetMetadata?.releaseDate || !targetMetadata.status) {
        throw new Error(
          `El parche ${targetPatch} necesita status y releaseDate en server/data/patches.json antes de auditarse.`,
        );
      }
      return {
        version: targetMetadata.id,
        releaseDate: targetMetadata.releaseDate,
        status: targetMetadata.status,
      };
    })();
const passiveProvenance = getRegistryProvenance();
const report = evaluateReleaseReadiness({
  targetPatch,
  defaultPatch: loadConfig().defaultPatch,
  auditDate: new Date().toISOString().slice(0, 10),
  releaseTarget,
  patches,
  compatibility,
  passiveRegistry: {
    testedAgainstPatch: passiveProvenance.testedAgainstPatch,
    evidenceId: PASSIVE_REGISTRY_EVIDENCE_ID,
  },
  evidenceCatalog: loadReleaseEvidenceCatalog(),
  itemTextCorpus: loadItemTextCorpusAudit(),
  playerWalkthroughs: loadPlayerWalkthroughAudit(),
});

console.log(`\nPreparación PoE2 ${targetPatch}: ${report.ready ? "APROBABLE" : "BLOQUEADA"}\n`);
for (const item of report.checks) {
  console.log(`${item.status === "pass" ? "✅" : "❌"} ${item.label}`);
  console.log(`   ${item.detail}`);
}
console.log(
  report.ready
    ? "\nLa evidencia está lista para ejecutar la barrera completa de publicación."
    : "\nNo se ha activado ningún dato. Corrige únicamente los puntos marcados y vuelve a auditar.",
);

if (strict && !report.ready) process.exitCode = 1;
