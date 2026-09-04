import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerPlayerWalkthrough } from "../server/playerWalkthroughRegistration.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function printHelp(): void {
  console.log(
    "Uso: npm run record:walkthrough -- --input <informe.json>\n" +
      "Genera el artefacto, calcula su SHA-256 y actualiza el manifiesto sin sobrescribir pruebas.",
  );
}

export function main(): void {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }
  const input = argument("--input");
  if (!input) throw new Error("Falta --input <informe.json>.");
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), input), "utf8")) as unknown;
  const registered = registerPlayerWalkthrough(raw, projectRoot);
  console.log(`Recorrido registrado: ${registered.record.id}`);
  console.log(`Artefacto: ${registered.artifactPath}`);
  console.log(`SHA-256: ${registered.artifactSha256}`);
}

const directEntry = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (directEntry) main();
