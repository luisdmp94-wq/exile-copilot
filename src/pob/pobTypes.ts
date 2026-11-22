/** Lo que viaja entre la web y el motor de Path of Building 2. */

export interface PobBundleMeta {
  /** Repositorio y commit de PoB2 empaquetado. */
  repository: string;
  commit: string;
  commitDate: string;
  /** Versión que declara PoB2 (manifest.xml), p. ej. «0.23.1». */
  pobVersion: string;
  /** Versión del árbol que lleva el paquete (la última de PoB2), p. ej. «0_5». */
  treeVersion: string;
  generatedAt: string;
  files: number;
  bytes: number;
}

export interface PobBundle {
  meta: PobBundleMeta;
  files: Record<string, string>;
}

export interface PobResist {
  value: number;
  max: number;
  /** Sin tope (lo que sobra por encima del máximo cuenta en penalizaciones). */
  total: number;
}

export interface PobSummary {
  dps: number;
  hitDps: number;
  dotDps: number;
  minionDps: number;
  averageHit: number;
  speed: number;
  critChance: number;
  life: number;
  energyShield: number;
  mana: number;
  spirit: number;
  armour: number;
  evasion: number;
  ehp: number;
  blockChance: number;
  movementSpeed: number;
  resists: Record<"fire" | "cold" | "lightning" | "chaos", PobResist>;
}

export interface PobCandidate {
  /** Lo que la web llama al camino (la clave del notable). */
  id: string;
  /** Nodos del árbol (claves numéricas de PoB2) que se cogerían. */
  path: string[];
}

export interface PobAnalyseArgs {
  xml: string;
  candidates?: PobCandidate[];
  /** Buscar los mejores notables a como mucho `maxPoints` puntos. */
  explore?: { maxPoints: number };
}

export interface PobGroup {
  index: number;
  label: string;
  enabled: boolean;
  main: boolean;
  gems: string[];
}

export interface PobAnalysis {
  main: PobSummary;
  skill: { name: string | null; level: number | null };
  groups: PobGroup[];
  /** Líneas de los objetos equipados que PoB2 no entiende. */
  unsupported: Array<{ item: string; line: string }>;
  candidates: Array<{ id: string; points: number; after: PobSummary }>;
  explore: Array<{ id: string; points: number; path: string[]; after: PobSummary }>;
  scanned?: number;
}
