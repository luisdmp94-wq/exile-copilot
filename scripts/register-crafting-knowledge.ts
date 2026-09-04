import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerCraftingKnowledgeBatch,
  validateCraftingKnowledgeBatch,
} from "../server/crafting/knowledgeRegistration.js";

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function printHelp(): void {
  console.log(
    "Uso: npm run record:crafting-knowledge -- --input <lote.json>\n" +
      "Ensayo: npm run record:crafting-knowledge -- --check --input <lote.json>\n" +
      "Valida e incorpora de forma atómica hasta 100 snapshots de Crafting con procedencia.",
  );
}

export function main(): void {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }
  const input = argument("--input");
  if (!input) throw new Error("Falta --input <lote.json>.");
  const checkOnly = process.argv.includes("--check");
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), input), "utf8")) as unknown;
  const registered = checkOnly
    ? validateCraftingKnowledgeBatch(raw, projectRoot)
    : registerCraftingKnowledgeBatch(raw, projectRoot);
  console.log(
    checkOnly
      ? `Snapshots válidos sin escribir: ${registered.length}`
      : `Snapshots de Crafting registrados: ${registered.length}`,
  );
  for (const entry of registered) {
    console.log(`- ${entry.snapshotId}: server/data/crafting/${entry.file}`);
  }
}

const directEntry = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (directEntry) main();
