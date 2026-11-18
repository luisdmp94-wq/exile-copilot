/**
 * «Tus puntos del árbol»: rutas de pasivas escritas a mano sobre el árbol
 * oficial de GGG (grindinggear/poe2-skilltree-export).
 *
 * Reglas de este archivo:
 *  - `official` es el texto del nodo tal como lo publica GGG, sin marcas. Una
 *    prueba (tests/unit/passiveRoutes.test.ts) lo compara con el registro
 *    oficial que ya usa la web: la web no puede decir que un nodo da algo que
 *    no da.
 *  - `points` son los puntos acumulados desde el inicio de la clase por el
 *    camino más corto, calculados sobre las conexiones del export `sourceCommit`.
 *  - `nameEs` es el nombre del cliente en español (poe2db.tw/sp). El export
 *    oficial solo trae nombres en inglés.
 *  - `gives.es` es nuestra traducción del texto oficial, con las palabras del
 *    cliente («aumentado un 20 %»), nunca una interpretación.
 */
export type PassiveFamily = "hechizos" | "defensa" | "caos" | "esbirros" | "mixto";

export interface LocalText {
  es: string;
  en: string;
}

export interface PassiveRouteStep {
  /** Id del nodo en el árbol oficial. */
  nodeId: string;
  nameEn: string;
  nameEs: string;
  family: PassiveFamily;
  /** Texto oficial en inglés, una línea por efecto. */
  official: string[];
  /** Lo mismo en español, traducido por nosotros. */
  givesEs: string;
  /** Por qué va en esta ruta, en una frase. */
  why: LocalText;
  /** Puntos acumulados desde el inicio de la clase al coger este nodo. */
  points: number;
}

export interface PassiveRoute {
  id: string;
  /** Clase tal como la guarda el alta (CHARACTER_CLASSES) y en inglés. */
  classEs: string;
  classEn: string;
  title: LocalText;
  lead: LocalText;
  /** Versión del árbol con la que se calculó. */
  checkedPatch: string;
  sourceCommit: string;
  steps: PassiveRouteStep[];
}

export const WITCH_CHAOS_MINIONS: PassiveRoute = {
  id: "bruja-caos-esbirros",
  classEs: "Bruja",
  classEn: "Witch",
  title: {
    es: "Bruja · caos y esbirros",
    en: "Witch · chaos and minions",
  },
  lead: {
    es: "Primero el caos, que te queda más cerca; después los esbirros. Mezclar las dos cosas avanza más despacio que centrarse en una.",
    en: "Chaos first, because it's closer; minions after. Mixing the two is slower than focusing on one.",
  },
  checkedPatch: "0.5.5",
  sourceCommit: "bd87e6512c92b868542eddfb1ba4ea8b6dc2da36",
  steps: [
    {
      nodeId: "witch_sorceress_notable1",
      nameEn: "Raw Power",
      nameEs: "Poder bruto",
      family: "hechizos",
      official: ["20% increased Spell Damage", "+10 to Intelligence"],
      givesEs: "Daño de hechizos aumentado un 20 % · +10 a la inteligencia",
      why: {
        es: "Tus habilidades de caos son hechizos: sube el daño de todas.",
        en: "Your chaos skills are spells: this raises the damage of all of them.",
      },
      points: 5,
    },
    {
      nodeId: "witch_sorceress_notable2",
      nameEn: "Pure Energy",
      nameEs: "Energía pura",
      family: "defensa",
      official: ["30% increased maximum Energy Shield", "+10 to Intelligence"],
      givesEs: "Escudo de energía máximo aumentado un 30 % · +10 a la inteligencia",
      why: {
        es: "Aguantas más: la bruja se defiende con escudo de energía.",
        en: "You survive more: the Witch defends herself with energy shield.",
      },
      points: 9,
    },
    {
      nodeId: "chaos37",
      nameEn: "Lingering Horror",
      nameEs: "Horror persistente",
      family: "caos",
      official: ["23% increased Chaos Damage", "15% increased Skill Effect Duration"],
      givesEs: "Daño de caos aumentado un 23 % · Duración del efecto de habilidad aumentada un 15 %",
      why: {
        es: "Tu caos hace daño con el tiempo: aquí la duración no es un punto perdido.",
        en: "Your chaos deals damage over time: duration isn't a wasted point here.",
      },
      points: 18,
    },
    {
      nodeId: "chaos34__",
      nameEn: "Spiral into Insanity",
      nameEs: "Espiral de locura",
      family: "caos",
      official: ["29% increased Chaos Damage", "20% increased Armour, Evasion and Energy Shield"],
      givesEs: "Daño de caos aumentado un 29 % · Armadura, evasión y escudo de energía aumentados un 20 %",
      why: {
        es: "Más caos y, de paso, más defensa.",
        en: "More chaos and, along the way, more defence.",
      },
      points: 25,
    },
    {
      nodeId: "spells59",
      nameEn: "Emboldening Lead",
      nameEs: "Liderazgo audaz",
      family: "esbirros",
      official: ["Minions deal 30% increased Damage if you've Hit Recently"],
      givesEs: "El daño de tus esbirros aumenta un 30 % si has golpeado recientemente",
      why: {
        es: "Tu primer nodo de esbirros: pegan más mientras tú también atacas.",
        en: "Your first minion node: they hit harder while you keep attacking too.",
      },
      points: 31,
    },
    {
      nodeId: "minion_offence13",
      nameEn: "Deadly Swarm",
      nameEs: "Enjambre mortal",
      family: "esbirros",
      official: ["Minions deal 15% increased Damage", "Minions have 20% increased Critical Hit Chance"],
      givesEs: "El daño de tus esbirros aumenta un 15 % · Su probabilidad de golpe crítico aumenta un 20 %",
      why: {
        es: "Más daño de esbirros, siempre activo.",
        en: "More minion damage, always on.",
      },
      points: 37,
    },
    {
      nodeId: "minion_defence15",
      nameEn: "Necrotised Flesh",
      nameEs: "Carne necrosada",
      family: "esbirros",
      official: ["Minions have 40% increased maximum Life", "Minions have 10% reduced Life Recovery rate"],
      givesEs: "La vida máxima de tus esbirros aumenta un 40 % · Su recuperación de vida se reduce un 10 %",
      why: {
        es: "Tus esbirros aguantan mucho más y mueren menos.",
        en: "Your minions last much longer and die less.",
      },
      points: 42,
    },
    {
      nodeId: "spells60",
      nameEn: "Empowering Remains",
      nameEs: "Restos potenciados",
      family: "mixto",
      official: ["40% increased Spell Damage if one of your Minions has died Recently"],
      givesEs: "Daño de hechizos aumentado un 40 % si uno de tus esbirros ha muerto recientemente",
      why: {
        es: "Une las dos mitades: tus hechizos pegan más cuando cae un esbirro.",
        en: "It ties both halves together: your spells hit harder when a minion falls.",
      },
      points: 44,
    },
    {
      nodeId: "chaos36",
      nameEn: "Void",
      nameEs: "Vacío",
      family: "caos",
      official: ["29% increased Chaos Damage", "Enemies you Curse have -3% to Chaos Resistance"],
      givesEs: "Daño de caos aumentado un 29 % · Los enemigos que maldices tienen −3 % de resistencia al caos",
      why: {
        es: "Más caos, y tus maldiciones bajan la resistencia al caos del enemigo.",
        en: "More chaos, and your curses lower the enemy's chaos resistance.",
      },
      points: 54,
    },
  ],
};

export const PASSIVE_ROUTES: PassiveRoute[] = [WITCH_CHAOS_MINIONS];

/** Quita las marcas del export oficial: `[Tag|Texto]` → «Texto», `[Tag]` → «Tag». */
export function cleanOfficialStat(stat: string): string {
  return stat
    .replace(/\[[^\]|]*\|([^\]]*)\]/g, "$1")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\s*\n\s*/g, " / ");
}

/**
 * Puntos de pasiva que da el nivel: uno por nivel a partir del 2. Las
 * misiones dan más; como no sabemos cuáles ha hecho el jugador, este número
 * es el mínimo seguro.
 */
export function passivePointsFromLevel(level: number): number {
  return Math.max(0, Math.min(100, Math.floor(level)) - 1);
}

/** Cuántos nodos de la ruta alcanzan esos puntos (0 si ninguno). */
export function stepsWithinPoints(route: PassiveRoute, points: number): number {
  return route.steps.filter((step) => step.points <= points).length;
}
