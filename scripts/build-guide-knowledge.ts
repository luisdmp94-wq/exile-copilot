/**
 * Escribe `server/data/guideKnowledge.json` a partir de las guías por acto
 * (ver scripts/lib/guideKnowledge.ts). Lanzarlo después de tocar una guía:
 *   npm run data:guides
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildGuideKnowledge } from "./lib/guideKnowledge.js";

const target = resolve(process.cwd(), "server", "data", "guideKnowledge.json");
const knowledge = buildGuideKnowledge();
writeFileSync(target, `${JSON.stringify(knowledge, null, 1)}\n`, "utf8");
console.log(`[guías] ${knowledge.es.length} actos en español y ${knowledge.en.length} en inglés → server/data/guideKnowledge.json`);
