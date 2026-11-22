import treeUrl from "../../server/data/passives/tree.json?url";
import { buildTreeGraph, type PassiveTreeData, type TreeGraph } from "@shared/passiveTree.js";

/**
 * El árbol oficial (unos 300 KB comprimido): se pide una vez por visita y lo
 * comparten el mapa, el editor y el motor de PoB2.
 */
let treePromise: Promise<PassiveTreeData> | null = null;
let graphPromise: Promise<TreeGraph> | null = null;

export function loadPassiveTree(): Promise<PassiveTreeData> {
  treePromise ??= fetch(treeUrl).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as PassiveTreeData;
  });
  treePromise.catch(() => {
    treePromise = null;
    graphPromise = null;
  });
  return treePromise;
}

/** El árbol con sus conexiones, sin las versiones de ninguna clase. */
export function loadPassiveGraph(): Promise<TreeGraph> {
  graphPromise ??= loadPassiveTree().then(buildTreeGraph);
  return graphPromise;
}
