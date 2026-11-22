/**
 * Marcar el árbol a mano, como en Path of Building: tocar un nodo coge el
 * camino más corto hasta él; quitar uno suelta también lo que se quede sin
 * conexión con el inicio de la clase.
 */
import { pathTo, reachFrom, type TreeGraph } from "./passiveTree.js";

export type EditResult =
  | { ok: true; allocated: Set<string>; added: string[]; removed: string[] }
  | { ok: false; reason: "locked" | "unreachable" | "start" | "choice" };

/** ¿Se puede coger este nodo? (los bloqueados los abre un objeto o una ascendencia) */
export function editableNode(graph: TreeGraph, key: string): boolean {
  const node = graph.data.nodes[key];
  return node !== undefined && node.kind !== "start" && !node.locked;
}

/** Lo que cuesta llegar a `target` desde lo cogido (sin cogerlo todavía). */
export function previewPath(graph: TreeGraph, allocated: ReadonlySet<string>, start: string, target: string): string[] | null {
  if (allocated.has(target)) return [];
  const node = graph.data.nodes[target];
  if (!node || node.locked || node.kind === "start") return null;
  if (node.choiceOf !== undefined) return allocated.has(node.choiceOf) ? [target] : null;
  const seeds = new Set(allocated);
  seeds.add(start);
  const reach = reachFrom(graph, seeds, start);
  if (!reach.dist.has(target)) return null;
  return pathTo(reach, target);
}

/** Coge `target` y el camino hasta él. */
export function allocateNode(graph: TreeGraph, allocated: ReadonlySet<string>, start: string, target: string): EditResult {
  const node = graph.data.nodes[target];
  if (!node) return { ok: false, reason: "unreachable" };
  if (node.kind === "start") return { ok: false, reason: "start" };
  if (node.locked) return { ok: false, reason: "locked" };
  if (allocated.has(target)) return { ok: true, allocated: new Set(allocated), added: [], removed: [] };
  const path = previewPath(graph, allocated, start, target);
  if (path === null) return { ok: false, reason: node.choiceOf !== undefined ? "choice" : "unreachable" };
  const next = new Set(allocated);
  next.add(start);
  const removed: string[] = [];
  // De un «elige uno» solo vale una opción.
  if (node.choiceOf !== undefined) {
    for (const key of next) {
      if (graph.data.nodes[key]?.choiceOf === node.choiceOf) {
        next.delete(key);
        removed.push(key);
      }
    }
  }
  for (const key of path) next.add(key);
  return { ok: true, allocated: next, added: path, removed };
}

/** Lo que sigue unido al inicio de la clase. */
function connected(graph: TreeGraph, allocated: ReadonlySet<string>, start: string): Set<string> {
  const seen = new Set<string>();
  if (!allocated.has(start)) return seen;
  const queue = [start];
  seen.add(start);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const next of graph.neighbours.get(current) ?? []) {
      if (seen.has(next) || !allocated.has(next)) continue;
      const node = graph.data.nodes[next];
      // Las opciones de un «elige uno» cuelgan de su nodo, no hacen de puente.
      if (node?.choiceOf !== undefined) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  for (const key of allocated) {
    const parent = graph.data.nodes[key]?.choiceOf;
    if (parent !== undefined && seen.has(parent)) seen.add(key);
  }
  return seen;
}

/** Quita `target` y lo que se quede suelto. */
export function deallocateNode(graph: TreeGraph, allocated: ReadonlySet<string>, start: string, target: string): EditResult {
  if (target === start || graph.data.nodes[target]?.kind === "start") return { ok: false, reason: "start" };
  if (!allocated.has(target)) return { ok: true, allocated: new Set(allocated), added: [], removed: [] };
  const remaining = new Set(allocated);
  remaining.delete(target);
  remaining.add(start);
  const kept = connected(graph, remaining, start);
  const removed = [target, ...[...remaining].filter((key) => !kept.has(key))];
  return { ok: true, allocated: kept, added: [], removed };
}

/** Puntos gastados: todo menos el inicio de la clase. */
export function pointsSpent(graph: TreeGraph, allocated: ReadonlySet<string>): number {
  let points = 0;
  for (const key of allocated) {
    const node = graph.data.nodes[key];
    if (node && node.kind !== "start") points++;
  }
  return points;
}

/**
 * Puntos de pasiva que puede tener un personaje: uno por nivel a partir del 2
 * y hasta 24 de las misiones de la campaña. Es un tope orientativo: el editor
 * avisa si se pasa, no lo impide.
 */
export function maxPassivePoints(level: number): number {
  return Math.max(0, Math.min(100, level) - 1) + 24;
}

/** Atributo por defecto de un nodo «+5 a cualquier atributo» según la clase. */
export function defaultAttribute(characterClass: string | null | undefined): "str" | "dex" | "int" {
  const name = (characterClass ?? "").toLowerCase();
  if (/warrior|guerrero|mercenar|druid/.test(name)) return "str";
  if (/ranger|exploradora|huntress|cazadora|monk|monje/.test(name)) return "dex";
  return "int";
}
