/**
 * Las reglas eligen los notables que encajan con el personaje; PoB2 dice
 * cuánto da cada uno de verdad. Con los dos, el orden lo pone PoB2: primero
 * lo que más daño da por punto. Los caminos y los puntos se recalculan en ese
 * orden, porque el segundo paso sale desde donde acaba el primero.
 */
import { nodeStats, type TreeGraph } from "./passiveTree.js";
import { previewPath } from "./passiveTreeEdit.js";

export interface OrderableStep {
  key: string;
  path: string[];
  points: number;
  onTheWay: Array<{ count: number; text: string }>;
}

/** El camino de cada paso desde el árbol de hoy, sin contar los demás pasos. */
export function standalonePaths(
  graph: TreeGraph,
  allocated: readonly string[],
  start: string,
  keys: readonly string[],
): Map<string, string[]> {
  const base = new Set(allocated);
  base.add(start);
  const paths = new Map<string, string[]>();
  for (const key of keys) {
    const path = previewPath(graph, base, start, key);
    if (path && path.length > 0) paths.set(key, path);
  }
  return paths;
}

/** Lo que se coge por el camino (sin el notable), agrupado por lo que da. */
export function onTheWayGroups(graph: TreeGraph, path: string[], lang: "es" | "en"): Array<{ count: number; text: string }> {
  const groups = new Map<string, number>();
  for (const key of path.slice(0, -1)) {
    const node = graph.data.nodes[key];
    const text = node ? nodeStats(node, lang).join(" · ") : "";
    if (text) groups.set(text, (groups.get(text) ?? 0) + 1);
  }
  return [...groups.entries()].map(([text, count]) => ({ count, text })).sort((a, b) => b.count - a.count);
}

/**
 * Ordena los pasos por % de daño por punto (según PoB2, con su camino desde el
 * árbol de hoy) y rehace la cadena de caminos. Si falta el dato de algún paso,
 * se deja el orden de las reglas.
 */
export function orderStepsByGain<T extends OrderableStep>(
  steps: readonly T[],
  gains: ReadonlyMap<string, { damage: number; points: number }>,
  graph: TreeGraph,
  allocated: readonly string[],
  start: string,
  lang: "es" | "en",
): { steps: T[]; reordered: boolean } {
  if (steps.length < 2 || steps.some((step) => !gains.has(step.key))) return { steps: [...steps], reordered: false };
  const perPoint = (step: T) => {
    const gain = gains.get(step.key)!;
    return gain.damage / Math.max(1, gain.points);
  };
  const sorted = [...steps].sort((a, b) => perPoint(b) - perPoint(a));
  const reordered = sorted.some((step, index) => step.key !== steps[index].key);
  if (!reordered) return { steps: [...steps], reordered: false };
  const taken = new Set(allocated);
  taken.add(start);
  const chained = sorted.map((step) => {
    const path = previewPath(graph, taken, start, step.key) ?? step.path;
    for (const key of path) taken.add(key);
    return { ...step, path, points: path.length, onTheWay: onTheWayGroups(graph, path, lang) };
  });
  // Si un notable queda de camino a otro que PoB2 pone antes, al llegar a él ya
  // estaría cogido y saldría «+0 puntos», sin camino. El orden de las reglas
  // (primero el que pilla de paso) es el que se puede seguir: se deja ese.
  if (chained.some((step) => step.path.length === 0)) return { steps: [...steps], reordered: false };
  return { steps: chained, reordered: true };
}
