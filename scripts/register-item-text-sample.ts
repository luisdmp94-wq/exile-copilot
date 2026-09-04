import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerDirectItemTextSample,
  registerDirectItemTextSampleBatch,
  validateDirectItemTextSampleBatch,
} from "../server/importers/itemTextCorpusRegistration.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function printHelp(): void {
  console.log(
    "Una muestra: npm run record:item-sample -- --input <muestra.json> --text <tooltip.txt>\n" +
      "Un lote: npm run record:item-sample -- --batch <lote.json>\n" +
      "Ensayar un lote sin escribir: npm run record:item-sample -- --check --batch <lote.json>\n" +
      "Contrasta cada lectura confirmada, preserva los tooltips y actualiza el corpus sin sobrescribir muestras.",
  );
}

export function main(): void {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }
  const batch = argument("--batch");
  const checkOnly = process.argv.includes("--check");
  if (batch) {
    const projectRoot = fileURLToPath(new URL("../", import.meta.url));
    const rawBatch = JSON.parse(
      readFileSync(resolve(process.cwd(), batch), "utf8"),
    ) as unknown;
    const registered = checkOnly
      ? validateDirectItemTextSampleBatch(rawBatch, projectRoot)
      : registerDirectItemTextSampleBatch(rawBatch, projectRoot);
    console.log(
      checkOnly
        ? `Lote válido sin escribir: ${registered.length} muestra(s)`
        : `Lote registrado: ${registered.length} muestra(s)`,
    );
    for (const sample of registered) {
      console.log(`- ${sample.id} · ${sample.expected.name} · ${sample.fixture}`);
    }
    return;
  }
  if (checkOnly) {
    throw new Error("--check exige --batch <lote.json>.");
  }
  const input = argument("--input");
  const text = argument("--text");
  if (!input || !text) {
    throw new Error("Faltan --input <muestra.json> y --text <tooltip.txt>.");
  }
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const submission = JSON.parse(
    readFileSync(resolve(process.cwd(), input), "utf8"),
  ) as unknown;
  const tooltip = readFileSync(resolve(process.cwd(), text), "utf8");
  const registered = registerDirectItemTextSample(
    submission,
    tooltip,
    projectRoot,
  );
  console.log(`Muestra registrada: ${registered.id}`);
  console.log(`Fixture: ${registered.fixture}`);
  console.log(
    `Lectura fijada: ${registered.expected.name} · ${registered.expected.baseType} · nivel ${registered.expected.itemLevel}`,
  );
}

const directEntry = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (directEntry) main();
