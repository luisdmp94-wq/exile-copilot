import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PASSIVE_ROUTES,
  WITCH_CHAOS_MINIONS,
  cleanOfficialStat,
  passivePointsFromLevel,
  stepsWithinPoints,
} from "../../src/guides/passiveRoutes.js";

interface RegistryNode {
  id: string;
  name: string;
  stats: string[];
  nodeType: string;
  ascendancyId: string | null;
}

const registry = JSON.parse(
  readFileSync(new URL("../../server/data/passives/passiveRegistry.1e9eb2d8.json", import.meta.url), "utf8"),
) as { nodes: RegistryNode[] };
const nodesById = new Map(registry.nodes.map((node) => [node.id, node]));

const SPANISH_LETTERS = /[ñ¿¡áéíóú«»]/;

describe("«Tus puntos del árbol»", () => {
  it("cada nodo existe en el árbol oficial y da exactamente lo que dice la web", () => {
    for (const route of PASSIVE_ROUTES) {
      for (const step of route.steps) {
        const node = nodesById.get(step.nodeId);
        expect(node, `${route.id}: ${step.nodeId}`).toBeDefined();
        expect(node!.name, step.nodeId).toBe(step.nameEn);
        // Solo nodos del árbol principal: una ascendencia no vale para toda la clase.
        expect(node!.ascendancyId, step.nameEn).toBeNull();
        expect(["notable", "keystone"], step.nameEn).toContain(node!.nodeType);
        expect(node!.stats.map(cleanOfficialStat), step.nameEn).toEqual(step.official);
      }
    }
  });

  it("la traducción española conserva los números del texto oficial", () => {
    for (const route of PASSIVE_ROUTES) {
      for (const step of route.steps) {
        const numbers = (text: string) => (text.match(/\d+/g) ?? []).sort();
        expect(numbers(step.givesEs), step.nameEn).toEqual(numbers(step.official.join(" ")));
      }
    }
  });

  it("los puntos acumulados crecen y los nodos no se repiten", () => {
    for (const route of PASSIVE_ROUTES) {
      const points = route.steps.map((step) => step.points);
      expect(points[0]).toBeGreaterThan(0);
      for (let index = 1; index < points.length; index += 1) {
        expect(points[index], route.steps[index].nameEn).toBeGreaterThan(points[index - 1]);
      }
      expect(new Set(route.steps.map((step) => step.nodeId)).size).toBe(route.steps.length);
    }
  });

  it("tiene nombre en español y explicación en los dos idiomas", () => {
    for (const route of PASSIVE_ROUTES) {
      expect(`${route.title.en} ${route.lead.en}`).not.toMatch(SPANISH_LETTERS);
      for (const step of route.steps) {
        expect(step.nameEs.trim(), step.nameEn).not.toBe("");
        expect(step.nameEs, step.nameEn).not.toBe(step.nameEn);
        expect(step.why.es.trim(), step.nameEn).not.toBe("");
        expect(step.why.en, step.nameEn).not.toMatch(SPANISH_LETTERS);
      }
    }
  });

  it("dice hasta dónde llegan los puntos de un nivel, sin contar las misiones", () => {
    expect(passivePointsFromLevel(1)).toBe(0);
    expect(passivePointsFromLevel(36)).toBe(35);
    expect(passivePointsFromLevel(250)).toBe(99);
    // Nivel 36: núcleo de caos, defensa y el primer nodo de esbirros.
    expect(stepsWithinPoints(WITCH_CHAOS_MINIONS, 35)).toBe(5);
    expect(WITCH_CHAOS_MINIONS.steps[4].nameEs).toBe("Liderazgo audaz");
    expect(stepsWithinPoints(WITCH_CHAOS_MINIONS, 4)).toBe(0);
    expect(stepsWithinPoints(WITCH_CHAOS_MINIONS, 99)).toBe(WITCH_CHAOS_MINIONS.steps.length);
  });

  it("limpia las marcas del export oficial", () => {
    expect(cleanOfficialStat("[Minion|Minions] deal 30% increased Damage if you've [HitDamage|Hit] [Recently]")).toBe(
      "Minions deal 30% increased Damage if you've Hit Recently",
    );
    expect(cleanOfficialStat("29% increased [Chaos] Damage")).toBe("29% increased Chaos Damage");
  });
});
