/**
 * «¿Por dónde sigo en el árbol?»: carga el árbol oficial que genera
 * `npm run data:tree` y lo cruza con las habilidades del personaje.
 *
 * Solo reglas (shared/passiveTreeAdvice.ts): no se gasta IA y la misma
 * respuesta sale en la tarjeta del árbol y en el Mentor.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildTreeGraph,
  readAllocated,
  treeForClass,
  treeVersionFamily,
  type PassiveTreeData,
  type TreeGraph,
} from "../../shared/passiveTree.js";
import { adviseTree, skillRole, type TreeSkill } from "../../shared/passiveTreeAdvice.js";
import type { PassiveTreeAdviceRequest, PassiveTreeAdviceResponse } from "../../shared/passiveTreeRequest.js";
import type { GemData } from "../../shared/supportGemAdvice.js";
import { findSkillAnyLang, localizeSkill, type GemLocale } from "./gemLocale.js";

let cachedTree: PassiveTreeData | null = null;
const graphs = new Map<string, TreeGraph>();

export function loadPassiveTree(): PassiveTreeData {
  if (cachedTree === null) {
    const raw = readFileSync(fileURLToPath(new URL("../data/passives/tree.json", import.meta.url)), "utf8");
    const data = JSON.parse(raw) as PassiveTreeData;
    if (data.version !== 1 || !data.nodes || !data.edges) {
      throw new Error("server/data/passives/tree.json no tiene el formato esperado: regenéralo con «npm run data:tree».");
    }
    cachedTree = data;
  }
  return cachedTree;
}

/** El grafo de la clase (con sus versiones de nodo), hecho una vez por clase. */
function graphFor(tree: PassiveTreeData, characterClass: string | null): TreeGraph {
  const key = (characterClass ?? "").trim().toLowerCase();
  const known = graphs.get(key);
  if (known) return known;
  const graph = buildTreeGraph(treeForClass(tree, characterClass));
  graphs.set(key, graph);
  return graph;
}

export interface TreeKnowledge {
  tree: PassiveTreeData;
  gems: GemData;
  locale: GemLocale;
}

export function advisePassiveTree(knowledge: TreeKnowledge, request: PassiveTreeAdviceRequest): PassiveTreeAdviceResponse {
  const { tree, gems, locale } = knowledge;
  const lang = request.lang;
  const graph = graphFor(tree, request.characterClass);
  const read = readAllocated(graph, request.passives, request.characterClass);

  const skills: TreeSkill[] = [];
  const seen = new Set<string>();
  request.skills.forEach((name, index) => {
    const skill = findSkillAnyLang(gems, locale, name);
    if (!skill || seen.has(skill.slug)) return;
    seen.add(skill.slug);
    skills.push({
      name: localizeSkill(skill, lang, locale).name,
      tags: skill.tags,
      description: [skill.description, ...skill.effects].join(" "),
      main: index === 0,
    });
  });

  const codeFamily = treeVersionFamily(request.treeVersion);
  const treeFamily = treeVersionFamily(tree.source.commitMessage);
  const versionMismatch =
    codeFamily !== null && treeFamily !== null && codeFamily !== treeFamily ? { code: codeFamily, tree: treeFamily } : null;

  const empty = read.allocated.size === 0 || skills.length === 0;
  const advice = empty
    ? { offence: [], defence: null }
    : adviseTree(graph, read.allocated, read.start, {
        skills,
        weapons: request.weapons,
        defence: request.defence,
        usesArmour: request.usesArmour,
        usesEvasion: request.usesEvasion,
        lang,
      });

  return {
    tree: { version: tree.source.commitMessage, commit: tree.source.commit },
    allocated: [...read.allocated],
    start: read.start,
    ascendancyCount: read.ascendancyCount,
    unknownCount: read.unknown.length,
    versionMismatch,
    // Las que hacen daño, que son a las que se refiere «lo que más ayuda a…»;
    // si no hay ninguna (una build de esbirros), todas.
    skills: (skills.some((skill) => skillRole(skill) === "damage")
      ? skills.filter((skill) => skillRole(skill) === "damage")
      : skills
    ).map((skill) => skill.name),
    offence: advice.offence,
    defence: advice.defence,
  };
}
