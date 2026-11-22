/**
 * El árbol de pasivas oficial tal como lo guarda `scripts/build-passive-tree.ts`
 * en `server/data/passives/tree.json`, y las cuentas que se hacen sobre él:
 * qué nodos tiene cogidos un personaje y cuántos puntos cuesta llegar a otro.
 *
 * Sin dependencias de Node ni del navegador: lo usan el consejero del
 * servidor (y el Mentor) y el dibujo del árbol en la web.
 */

export type TreeNodeKind = "small" | "notable" | "keystone" | "jewel" | "start" | "attribute";
export type SpriteRect = [x: number, y: number, w: number, h: number];

export interface TreeNodeData {
  /** Id de la tabla PassiveSkills («chaos31»). La clave del mapa es el número de PoB2. */
  id: string;
  kind: TreeNodeKind;
  x: number;
  y: number;
  group: number;
  orbit: number;
  icon: string;
  nameEn: string;
  nameEs: string | null;
  statsEn: string[];
  statsEs: string[] | null;
  /** No se coge por camino normal (lo abre una ascendencia o es de la Plaga). */
  locked?: true;
  /** Opción de un nodo «elige una» (Implantes, Infusiones…): cuelga de este. */
  choiceOf?: string;
  /** Clases que empiezan en este nodo (nombres en inglés del export). */
  classes?: string[];
}

/** Versión de un nodo para una clase o ascendencia («Daño de hechizos y de esbirros» en la Bruja). */
export interface TreeNodeOverride {
  nameEn: string;
  nameEs: string | null;
  statsEn: string[];
  statsEs: string[] | null;
  icon?: string;
}

export interface PassiveTreeData {
  version: 1;
  source: {
    repository: string;
    commit: string;
    /** Etiqueta del commit de GGG: la versión del árbol («0.5.5»). */
    commitMessage: string;
    commitDate: string;
    spanishFrom: string;
    generatedAt: string;
    generatedBy: string;
  };
  orbitRadii: number[];
  sheets: { skills: { w: number; h: number }; frame: { w: number; h: number } };
  icons: Record<string, { on: SpriteRect; off: SpriteRect }>;
  frames: Record<string, SpriteRect>;
  groups: Record<string, [number, number]>;
  nodes: Record<string, TreeNodeData>;
  edges: Array<[string, string]>;
  ascendancyNodes: string[];
  /** Por nombre inglés de clase o ascendencia: nodo → su versión. */
  overrides: Record<string, Record<string, TreeNodeOverride>>;
}

export interface TreeGraph {
  data: PassiveTreeData;
  neighbours: Map<string, string[]>;
  /** «chaos31» → «63074». */
  keyById: Map<string, string>;
  ascendancy: Set<string>;
}

export function buildTreeGraph(data: PassiveTreeData): TreeGraph {
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = neighbours.get(a);
    if (list) list.push(b);
    else neighbours.set(a, [b]);
  };
  for (const [a, b] of data.edges) {
    link(a, b);
    link(b, a);
  }
  const keyById = new Map<string, string>();
  for (const [key, node] of Object.entries(data.nodes)) keyById.set(node.id, key);
  return { data, neighbours, keyById, ascendancy: new Set(data.ascendancyNodes) };
}

/** Las clases de la web (en español o en inglés) → el nombre del export. */
const CLASS_EXPORT_NAME: Record<string, string> = {
  bruja: "Witch",
  witch: "Witch",
  hechicera: "Sorceress",
  sorceress: "Sorceress",
  guerrero: "Warrior",
  warrior: "Warrior",
  monje: "Monk",
  monk: "Monk",
  mercenario: "Mercenary",
  mercenary: "Mercenary",
  exploradora: "Ranger",
  ranger: "Ranger",
  cazadora: "Huntress",
  huntress: "Huntress",
  druida: "Druid",
  druid: "Druid",
};

/** «Bruja» o «Witch» → «Witch»; null si no se reconoce. */
export function exportClassName(characterClass: string | null | undefined): string | null {
  return CLASS_EXPORT_NAME[(characterClass ?? "").trim().toLowerCase()] ?? null;
}

/**
 * El árbol tal como lo ve esta clase: algunos nodos cambian de nombre y de
 * texto para la Bruja, la Cazadora o la Druida. Devuelve otro objeto: el
 * original no se toca.
 */
export function treeForClass(data: PassiveTreeData, characterClass: string | null | undefined): PassiveTreeData {
  const owner = exportClassName(characterClass);
  const byNode = owner ? data.overrides[owner] : undefined;
  if (!byNode) return data;
  const nodes = { ...data.nodes };
  for (const [key, override] of Object.entries(byNode)) {
    const base = nodes[key];
    if (!base) continue;
    nodes[key] = {
      ...base,
      nameEn: override.nameEn,
      nameEs: override.nameEs ?? (override.nameEn === base.nameEn ? base.nameEs : null),
      statsEn: override.statsEn,
      statsEs: override.statsEs,
      icon: override.icon ?? base.icon,
    };
  }
  return { ...data, nodes };
}

/** Nodo de inicio de una clase, o null si la clase no se reconoce. */
export function classStartFor(graph: TreeGraph, characterClass: string | null | undefined): string | null {
  const name = exportClassName(characterClass);
  if (!name) return null;
  for (const [key, node] of Object.entries(graph.data.nodes)) {
    if (node.kind === "start" && node.classes?.includes(name)) return key;
  }
  return null;
}

export interface AllocatedRead {
  /** Nodos del árbol principal que tiene cogidos. */
  allocated: Set<string>;
  /** Cuántos son de la ascendencia (no se dibujan). */
  ascendancyCount: number;
  /** Lo que no casa con este árbol: otra versión, o un código raro. */
  unknown: string[];
  /** Nodo de inicio de su clase, sacado de lo cogido o de la clase. */
  start: string | null;
}

/**
 * Lo que trae el personaje → nodos de este árbol. Acepta los números de PoB2
 * («63074») y los ids oficiales de un `.build` («chaos31»).
 */
export function readAllocated(
  graph: TreeGraph,
  refs: readonly string[],
  characterClass: string | null | undefined,
): AllocatedRead {
  const allocated = new Set<string>();
  const unknown: string[] = [];
  let ascendancyCount = 0;
  for (const raw of refs) {
    const ref = raw.trim();
    if (!ref) continue;
    const key = ref in graph.data.nodes ? ref : graph.keyById.get(ref);
    if (key !== undefined) allocated.add(key);
    else if (graph.ascendancy.has(ref)) ascendancyCount += 1;
    else unknown.push(ref);
  }
  const startFromTree = [...allocated].find((key) => graph.data.nodes[key]?.kind === "start") ?? null;
  const start = startFromTree ?? classStartFor(graph, characterClass);
  if (start !== null && allocated.size > 0) allocated.add(start);
  return { allocated, ascendancyCount, unknown, start };
}

/**
 * ¿Se puede pasar por este nodo camino de otro? No por el inicio de otra
 * clase, ni por nodos bloqueados, ni por las opciones de un «elige una».
 */
function walkable(node: TreeNodeData, start: string | null, key: string): boolean {
  if (node.locked || node.choiceOf !== undefined) return false;
  if (node.kind === "start") return key === start;
  return true;
}

export interface Reach {
  /** Puntos para llegar a cada nodo (0 = ya cogido). */
  dist: Map<string, number>;
  prev: Map<string, string>;
}

/** Camino más corto desde lo cogido a todo el árbol (cada nodo cuesta un punto). */
export function reachFrom(graph: TreeGraph, allocated: ReadonlySet<string>, start: string | null): Reach {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue: string[] = [];
  for (const key of allocated) {
    dist.set(key, 0);
    queue.push(key);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const base = dist.get(current) ?? 0;
    for (const next of graph.neighbours.get(current) ?? []) {
      if (dist.has(next)) continue;
      const node = graph.data.nodes[next];
      if (!node || !walkable(node, start, next)) continue;
      dist.set(next, base + 1);
      prev.set(next, current);
      queue.push(next);
    }
  }
  return { dist, prev };
}

/** Los nodos nuevos que hay que coger, en orden, hasta `target` (incluido). */
export function pathTo(reach: Reach, target: string): string[] {
  const path: string[] = [];
  let current: string | undefined = target;
  while (current !== undefined && (reach.dist.get(current) ?? 0) > 0) {
    path.push(current);
    current = reach.prev.get(current);
  }
  return path.reverse();
}

/** «0_5», «0.5.5» → «0.5». */
export function treeVersionFamily(value: string | null | undefined): string | null {
  const match = /^\s*(\d+)[_.](\d+)/.exec(value ?? "");
  return match ? `${match[1]}.${match[2]}` : null;
}

/** Nombre del nodo en el idioma de la web. */
export function nodeName(node: TreeNodeData, lang: "es" | "en"): string {
  return lang === "es" ? (node.nameEs ?? node.nameEn) : node.nameEn;
}

/** Lo que da el nodo en el idioma de la web (inglés si no hay traducción). */
export function nodeStats(node: TreeNodeData, lang: "es" | "en"): string[] {
  return lang === "es" ? (node.statsEs ?? node.statsEn) : node.statsEn;
}
