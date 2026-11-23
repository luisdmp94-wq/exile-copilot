import { describe, expect, it } from "vitest";
import { buildTreeGraph, classStartFor, reachFrom } from "../../shared/passiveTree.js";
import { orderStepsByGain, standalonePaths } from "../../shared/passiveTreeOrder.js";
import { loadPassiveTree } from "../../server/advice/passiveTreeAdvisor.js";

const graph = buildTreeGraph(loadPassiveTree());
const start = classStartFor(graph, "Bruja")!;

/** Dos notables cerca del inicio de la Bruja, en ramas distintas. */
function twoNotables(): [string, string] {
  const reach = reachFrom(graph, new Set([start]), start);
  const notables = [...reach.dist.entries()]
    .filter(([key, distance]) => distance > 2 && graph.data.nodes[key]?.kind === "notable")
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key);
  return [notables[0], notables[notables.length > 6 ? 6 : notables.length - 1]];
}

describe("el orden de los notables con los números de PoB2", () => {
  const [near, far] = twoNotables();
  const own = standalonePaths(graph, [], start, [near, far]);
  const steps = [near, far].map((key) => ({ key, path: own.get(key)!, points: own.get(key)!.length, onTheWay: [] }));

  it("el camino de cada paso sale del árbol de hoy, sin contar los otros", () => {
    expect(own.get(near)!.at(-1)).toBe(near);
    expect(own.get(far)!.at(-1)).toBe(far);
  });

  it("primero lo que más daño da por punto, y los caminos se rehacen en ese orden", () => {
    const gains = new Map([
      [near, { damage: 1, points: own.get(near)!.length }],
      [far, { damage: 40, points: own.get(far)!.length }],
    ]);
    const result = orderStepsByGain(steps, gains, graph, [], start, "es");
    expect(result.reordered).toBe(true);
    expect(result.steps.map((step) => step.key)).toEqual([far, near]);
    // El primero sale del árbol de hoy; el segundo, desde donde acaba el primero.
    expect(result.steps[0].points).toBe(own.get(far)!.length);
    expect(result.steps[1].points).toBeLessThanOrEqual(own.get(near)!.length);
    expect(result.steps[1].path.at(-1)).toBe(near);
  });

  it("si ya van en buen orden o falta algún dato, se deja el de las reglas", () => {
    const already = new Map([
      [near, { damage: 40, points: 3 }],
      [far, { damage: 1, points: 3 }],
    ]);
    expect(orderStepsByGain(steps, already, graph, [], start, "es")).toEqual({ steps, reordered: false });
    const missing = new Map([[near, { damage: 1, points: 3 }]]);
    expect(orderStepsByGain(steps, missing, graph, [], start, "es").reordered).toBe(false);
  });
});

describe("un notable que queda de camino a otro", () => {
  /** Dos notables de la Bruja en la misma rama: para llegar al segundo se pasa por el primero. */
  function inLine(): [string, string] {
    const reach = reachFrom(graph, new Set([start]), start);
    const notables = [...reach.dist.keys()].filter((key) => graph.data.nodes[key]?.kind === "notable");
    for (const behind of notables) {
      const path = standalonePaths(graph, [], start, [behind]).get(behind)!;
      const before = path.slice(0, -1).find((key) => graph.data.nodes[key]?.kind === "notable");
      if (before) return [before, behind];
    }
    throw new Error("El árbol no tiene dos notables en línea desde el inicio de la Bruja.");
  }

  it("aunque PoB2 prefiera el de detrás, ningún paso sale con «+0 puntos»", () => {
    const [first, behind] = inLine();
    const own = standalonePaths(graph, [], start, [first, behind]);
    // Las reglas: primero el que pilla de paso, y desde él, el de detrás.
    const rules = [
      { key: first, path: own.get(first)!, points: own.get(first)!.length, onTheWay: [] },
      { key: behind, path: own.get(behind)!.slice(own.get(first)!.length), points: own.get(behind)!.length - own.get(first)!.length, onTheWay: [] },
    ];
    const gains = new Map([
      [first, { damage: 1, points: own.get(first)!.length }],
      [behind, { damage: 90, points: own.get(behind)!.length }],
    ]);
    const result = orderStepsByGain(rules, gains, graph, [], start, "es");
    expect(result.steps.every((step) => step.points > 0 && step.path.length > 0)).toBe(true);
    expect(result).toEqual({ steps: rules, reordered: false });
  });
});
