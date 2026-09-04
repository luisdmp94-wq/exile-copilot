import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerReleaseEvidence } from "../server/releaseEvidenceRegistration.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function printHelp(): void {
  console.log(
    "Uso: npm run record:evidence -- --input <evidencia.json>\n" +
      "Registra una fuente local, genera su recibo y calcula ambas huellas sin sobrescribir pruebas.",
  );
}

export function main(): void {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }
  const input = argument("--input");
  if (!input) throw new Error("Falta --input <evidencia.json>.");
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), input), "utf8")) as unknown;
  const registered = registerReleaseEvidence(raw, projectRoot);
  console.log(`Evidencia registrada: ${registered.record.evidenceId}`);
  console.log(`Recibo: ${registered.receiptPath}`);
  console.log(`SHA-256 recibo: ${registered.receiptSha256}`);
  console.log(`SHA-256 fuente: ${registered.subjectSha256}`);
}

const directEntry = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (directEntry) main();
