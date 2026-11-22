import { describe, expect, it } from "vitest";
import { buildTreeGraph, classStartFor, reachFrom } from "../../shared/passiveTree.js";
import {
  allocateNode,
  deallocateNode,
  defaultAttribute,
  maxPassivePoints,
  pointsSpent,
  previewPath,
} from "../../shared/passiveTreeEdit.js";
import { loadPassiveTree } from "../../server/advice/passiveTreeAdvisor.js";

const graph = buildTreeGraph(loadPassiveTree());
const start = classStartFor(graph, "Bruja")!;

const nearestNotable = () => {
  const reach = reachFrom(graph, new Set([start]), start);
  const notables = [...reach.dist.entries()].filter(([key, distance]) => distance > 2 && graph.data.nodes[key]?.kind === "notable");
  notables.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return notables[0][0];
};

describe("marcar el árbol a mano", () => {
  it("coger un notable coge el camino más corto desde el inicio de la clase", () => {
    const target = nearestNotable();
    const preview = previewPath(graph, new Set([start]), start, target)!;
    expect(preview.length).toBeGreaterThan(1);
    expect(preview.at(-1)).toBe(target);
    const result = allocateNode(graph, new Set([start]), start, target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added).toEqual(preview);
    expect(pointsSpent(graph, result.allocated)).toBe(preview.length);
    // Cada nodo nuevo toca a uno que ya estaba cogido.
    for (const key of result.added) {
      expect((graph.neighbours.get(key) ?? []).some((next) => result.allocated.has(next))).toBe(true);
    }
  });

  it("quitar un nodo del camino suelta lo que se queda sin conexión", () => {
    const target = nearestNotable();
    const taken = allocateNode(graph, new Set([start]), start, target);
    if (!taken.ok) throw new Error("no se cogió");
    const first = taken.added[0];
    const removed = deallocateNode(graph, taken.allocated, start, first);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.allocated.has(target)).toBe(false);
    expect(removed.removed).toContain(first);
    expect(removed.removed).toContain(target);
    expect(pointsSpent(graph, removed.allocated)).toBe(0);
  });

  it("quitar el último nodo no toca el resto", () => {
    const target = nearestNotable();
    const taken = allocateNode(graph, new Set([start]), start, target);
    if (!taken.ok) throw new Error("no se cogió");
    const removed = deallocateNode(graph, taken.allocated, start, target);
    if (!removed.ok) throw new Error("no se quitó");
    expect(removed.removed).toEqual([target]);
    expect(pointsSpent(graph, removed.allocated)).toBe(taken.added.length - 1);
  });

  it("no se coge ni se quita el inicio de la clase, ni los nodos bloqueados", () => {
    expect(allocateNode(graph, new Set([start]), start, start)).toEqual({ ok: false, reason: "start" });
    expect(deallocateNode(graph, new Set([start]), start, start)).toEqual({ ok: false, reason: "start" });
    const locked = Object.entries(graph.data.nodes).find(([, node]) => node.locked)?.[0];
    if (locked) expect(allocateNode(graph, new Set([start]), start, locked)).toEqual({ ok: false, reason: "locked" });
  });

  it("puntos orientativos por nivel y atributo por defecto de la clase", () => {
    expect(maxPassivePoints(1)).toBe(24);
    expect(maxPassivePoints(49)).toBe(72);
    expect(defaultAttribute("Bruja")).toBe("int");
    expect(defaultAttribute("Warrior")).toBe("str");
    expect(defaultAttribute("Exploradora")).toBe("dex");
  });
});
