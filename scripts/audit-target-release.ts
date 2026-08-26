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
const passiveProvenance = getRegistryProvenance();
const report = evaluateReleaseReadiness({
  targetPatch,
  defaultPatch: loadConfig().defaultPatch,
  patches,
  compatibility,
  passiveRegistry: {
    testedAgainstPatch: passiveProvenance.testedAgainstPatch,
    evidenceId: PASSIVE_REGISTRY_EVIDENCE_ID,
  },
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
