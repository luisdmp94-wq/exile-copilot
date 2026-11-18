/**
 * Recalcula los puntos de las rutas de «Tus puntos del árbol» sobre el export
 * oficial de GGG y comprueba que coinciden con lo escrito en
 * src/guides/passiveRoutes.ts.
 *
 *   npx tsx scripts/compute-passive-route.ts --input <ruta a data.json>
 *   npx tsx scripts/compute-passive-route.ts --download
 *
 * Proceso OFFLINE: no se ejecuta al servir la web. Sirve para revisar las
 * rutas cuando cambie el árbol (por ejemplo, con la 1.0): se fija el commit
 * nuevo en cada ruta, se ejecuta esto y se corrigen los puntos que cambien.
 *
 * «Puntos» es el camino más corto por las conexiones del árbol, sin pasar por
 * nodos de ascendencia, cogiendo los nodos de la ruta en su orden.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PASSIVE_ROUTES, cleanOfficialStat, type PassiveRoute } from "../src/guides/passiveRoutes.js";

const SOURCE_REPOSITORY = "grindinggear/poe2-skilltree-export";

interface ExportNode {
  id?: string;
  name?: string;
  stats?: string[];
  ascendancyId?: string;
  ascendancyName?: string;
}
interface TreeExport {
  nodes: Record<string, ExportNode>;
  edges: Array<{ from: string | number; to: string | number }>;
}

function fail(message: string): never {
  console.error(`\n[compute-passive-route] ERROR: ${message}\n`);
  process.exit(1);
}

async function loadExport(commit: string): Promise<TreeExport> {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  if (inputIndex !== -1) {
    const path = args[inputIndex + 1];
    if (path === undefined) fail("--input requiere una ruta al data.json oficial.");
    return JSON.parse(readFileSync(resolve(path), "utf8")) as TreeExport;
  }
  if (args.includes("--download")) {
    const url = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${commit}/data.json`;
    console.log(`[compute-passive-route] descargando ${url}`);
    const response = await fetch(url);
    if (!response.ok) fail(`la descarga devolvió HTTP ${response.status}.`);
    return (await response.json()) as TreeExport;
  }
  fail("indica el origen: --input <ruta a data.json> o --download.");
}

function checkRoute(route: PassiveRoute, tree: TreeExport): boolean {
  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const edge of tree.edges) {
    link(String(edge.from), String(edge.to));
    link(String(edge.to), String(edge.from));
  }
  const walkable = (key: string) => {
    const node = tree.nodes[key];
    return key !== "root" && node !== undefined && !node.ascendancyId && !node.ascendancyName;
  };
  const start = Object.keys(tree.nodes).find((key) => tree.nodes[key]?.name === route.classEn.toUpperCase());
  if (start === undefined) fail(`no encuentro el inicio de la clase ${route.classEn}.`);
  const keyOfId = new Map<string, string>();
  for (const [key, node] of Object.entries(tree.nodes)) {
    if (typeof node.id === "string") keyOfId.set(node.id, key);
  }

  const taken = new Set<string>([start]);
  let total = 0;
  let ok = true;
  console.log(`\n${route.id} (${route.classEn}, árbol ${route.checkedPatch})`);
  for (const step of route.steps) {
    const target = keyOfId.get(step.nodeId);
    if (target === undefined) fail(`el nodo ${step.nodeId} (${step.nameEn}) no está en el árbol.`);
    // Búsqueda en anchura desde todo lo ya cogido hasta el nodo.
    const previous = new Map<string, string | null>([...taken].map((key) => [key, null]));
    const queue = [...taken];
    let found = false;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === target) {
        found = true;
        break;
      }
      for (const next of neighbours.get(current) ?? []) {
        if (previous.has(next) || !walkable(next)) continue;
        previous.set(next, current);
        queue.push(next);
      }
    }
    if (!found) fail(`no hay camino hasta ${step.nameEn}.`);
    let cost = 0;
    for (let key: string | null = target; key !== null && !taken.has(key); key = previous.get(key) ?? null) {
      taken.add(key);
      cost += 1;
    }
    total += cost;
    const node = tree.nodes[target];
    const official = (node.stats ?? []).map(cleanOfficialStat);
    const samePoints = total === step.points;
    const sameText = JSON.stringify(official) === JSON.stringify(step.official) && node.name === step.nameEn;
    if (!samePoints || !sameText) ok = false;
    console.log(
      `  ${samePoints ? "ok " : "MAL"} +${String(cost).padStart(2)} = ${String(total).padStart(3)}` +
        ` (escrito: ${step.points})  ${step.nameEn}${sameText ? "" : "  ← el texto oficial ha cambiado"}`,
    );
  }
  return ok;
}

async function main(): Promise<void> {
  let allOk = true;
  for (const route of PASSIVE_ROUTES) {
    const tree = await loadExport(route.sourceCommit);
    if (!checkRoute(route, tree)) allOk = false;
  }
  if (!allOk) fail("alguna ruta no coincide con el árbol. Corrige src/guides/passiveRoutes.ts.");
  console.log("\n[compute-passive-route] todas las rutas coinciden con el árbol oficial.");
}

void main();
