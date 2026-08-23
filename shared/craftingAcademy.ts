import type { CraftingActionId } from "./craftingActions.js";
import {
  OBSERVED_CRAFTING_ACTIONS,
  evaluateObservedCraftingActions,
} from "./craftingActions.js";
import { diagnoseCraftingItem } from "./craftingDiagnosis.js";
import { ItemSchema, type Item, type ItemRarity } from "./domain.js";

/**
 * ACADEMIA DE CRAFTING — NIVEL BÁSICO (contenido versionado).
 *
 * Reglas de este módulo:
 *
 *  1. Ningún escenario inventa mecánicas. Todo lo que se afirma sale de
 *     `OBSERVED_CRAFTING_ACTIONS` y `diagnoseCraftingItem`, es decir, del
 *     snapshot local observado el 22/08/2026, el MISMO que usa el banco real.
 *  2. Los objetos son sintéticos y se marcan como ejercicio. No son drops, no
 *     representan un pool y no llevan probabilidad asociada.
 *  3. La respuesta correcta se declara aquí y `resolveAcademyAnswer()` la
 *     recalcula desde el motor. Las pruebas exigen que coincidan, de modo que
 *     el texto no puede alejarse del motor sin romper la suite.
 */

export const CRAFTING_ACADEMY_CONTENT_VERSION = "basico-2026-08-23";

export const CRAFTING_ACADEMY_EVIDENCE =
  "Evidencia local observada el 22/08/2026 (tooltips del cliente). No incluye pools, pesos ni probabilidades.";

export const CRAFTING_ACADEMY_EXERCISE_NOTICE =
  "Ejercicio de aprendizaje: objeto sintético creado para practicar la lectura. No es un drop real ni describe resultados posibles.";

// ---------------------------------------------------------------------------
// Conceptos
// ---------------------------------------------------------------------------

export const ACADEMY_CONCEPT_IDS = [
  "rareza",
  "afijos",
  "huecos",
  "transmutacion",
  "aumento",
  "limite-magico",
  "regio",
  "parar-datos",
  "exaltado",
  "parar-limite",
] as const;
export type AcademyConceptId = (typeof ACADEMY_CONCEPT_IDS)[number];

export const ACADEMY_CONCEPTS: Record<AcademyConceptId, { label: string; recap: string }> = {
  rareza: {
    label: "Leer la rareza",
    recap: "Normal, mágico y raro no son adornos: deciden qué moneda es compatible.",
  },
  afijos: {
    label: "Prefijos y sufijos",
    recap: "Los modificadores explícitos ocupan dos familias distintas y el juego las muestra por separado.",
  },
  huecos: {
    label: "Huecos disponibles",
    recap: "Un hueco libre dice que cabe algo más, nunca que lo que venga te sirva.",
  },
  transmutacion: {
    label: "Cuándo usar Transmutación",
    recap: "Es la acción observada para pasar de normal a mágico con 1 modificador.",
  },
  aumento: {
    label: "Cuándo usar Aumento",
    recap: "Añade 1 modificador a un objeto mágico sin cambiar su rareza.",
  },
  "limite-magico": {
    label: "El límite del mágico",
    recap: "El tooltip observado declara un máximo de 2 modificadores en objetos mágicos.",
  },
  regio: {
    label: "Cuándo usar Regio",
    recap: "Convierte un mágico en raro conservando lo que ya tiene y añadiendo 1 modificador.",
  },
  "parar-datos": {
    label: "Parar por falta de datos",
    recap: "Si el texto no confirma el estado del objeto, la respuesta correcta es no gastar todavía.",
  },
  exaltado: {
    label: "Cuándo usar Exaltado",
    recap: "Añade 1 modificador a un objeto raro; el límite total observado es 6.",
  },
  "parar-limite": {
    label: "Parar por límite alcanzado",
    recap: "Sin huecos según el límite observado, ninguna de estas monedas es compatible.",
  },
};

// ---------------------------------------------------------------------------
// Modelo de escenario
// ---------------------------------------------------------------------------

/**
 * Qué debe comprobar el motor para que una opción sea la correcta.
 *
 * `claim` es el único tipo sin respaldo del motor y SIEMPRE es un distractor:
 * describe justo las afirmaciones que la aplicación se niega a hacer
 * (resultado garantizado, valor, probabilidad).
 */
export type AcademyCheck =
  | { kind: "action"; actionId: CraftingActionId }
  | { kind: "stop" }
  | { kind: "rarity"; value: ItemRarity }
  | { kind: "prefixCount"; value: number }
  | { kind: "openSlots"; value: number }
  | { kind: "claim"; truth: false };

export interface AcademyOption {
  id: string;
  label: string;
  /** Frase corta bajo la etiqueta. Nunca contiene la corrección. */
  hint?: string;
  check: AcademyCheck;
}

export interface AcademyScenario {
  id: string;
  conceptId: AcademyConceptId;
  /** Situación concreta, 1–2 líneas. */
  situation: string;
  /** Una sola pregunta principal. */
  question: string;
  item: Item;
  options: AcademyOption[];
  expectedOptionId: string;
  /** Corrección inmediata, 2–4 líneas. */
  explanation: string;
  /** Detalle plegado bajo «Por qué». */
  why: string[];
  /** Qué se ve mal si eliges otra cosa. Se muestra solo al fallar. */
  misconception: string;
}

export interface AcademyLesson {
  id: string;
  order: number;
  title: string;
  goal: string;
  scenarios: AcademyScenario[];
}

// ---------------------------------------------------------------------------
// Objetos de ejercicio
// ---------------------------------------------------------------------------

const EXERCISE_SOURCE = {
  kind: "internal" as const,
  label: "Ejercicio de aprendizaje de la Academia (objeto sintético)",
  retrievedAt: "2026-08-23",
};

const CLEAN_STATE = {
  corrupted: false,
  mirrored: false,
  split: false,
  unidentified: false,
};

function affix(
  id: string,
  text: string,
  kindOfAffix: "prefix" | "suffix",
  tags: string[],
) {
  return {
    id,
    text,
    kind: "explicit" as const,
    values: [],
    verified: true,
    affix: kindOfAffix,
    tags,
  };
}

function exerciseItem(input: {
  id: string;
  name: string;
  baseType: string;
  slot: Item["slot"];
  rarity: ItemRarity;
  itemLevel: number;
  modifiers?: ReturnType<typeof affix>[];
  /** Omitido a propósito en el escenario que enseña a parar por falta de datos. */
  withState?: boolean;
}): Item {
  return ItemSchema.parse({
    id: input.id,
    name: input.name,
    baseType: input.baseType,
    slot: input.slot,
    rarity: input.rarity,
    itemLevel: input.itemLevel,
    modifiers: input.modifiers ?? [],
    ...(input.withState === false ? {} : { craftingState: { ...CLEAN_STATE } }),
    sources: [EXERCISE_SOURCE],
  });
}

const YELMO_RARO = exerciseItem({
  id: "academia-yelmo-raro",
  name: "Yelmo de prácticas",
  baseType: "Yelmo de escamas",
  slot: "helmet",
  rarity: "rare",
  itemLevel: 65,
  modifiers: [
    affix("aca-y1", "+68 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-y2", "+21% a la armadura", "prefix", ["Defensa"]),
    affix("aca-y3", "+28% a la resistencia al fuego", "suffix", ["Resistencias"]),
  ],
});

const GUANTES_NORMALES = exerciseItem({
  id: "academia-guantes-normales",
  name: "Guantes de prácticas",
  baseType: "Guantes de cuero endurecido",
  slot: "gloves",
  rarity: "normal",
  itemLevel: 52,
});

const ANILLO_MAGICO_1 = exerciseItem({
  id: "academia-anillo-magico-1",
  name: "Anillo de prácticas",
  baseType: "Anillo de zafiro",
  slot: "ring1",
  rarity: "magic",
  itemLevel: 58,
  modifiers: [affix("aca-a1", "+24% a la resistencia al frío", "suffix", ["Resistencias"])],
});

const ANILLO_MAGICO_2 = exerciseItem({
  id: "academia-anillo-magico-2",
  name: "Anillo de prácticas lleno",
  baseType: "Anillo de zafiro",
  slot: "ring1",
  rarity: "magic",
  itemLevel: 58,
  modifiers: [
    affix("aca-a2", "+31 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-a3", "+24% a la resistencia al frío", "suffix", ["Resistencias"]),
  ],
});

const CINTURON_SIN_DATOS = exerciseItem({
  id: "academia-cinturon-sin-datos",
  name: "Cinturón copiado a medias",
  baseType: "Cinturón de cuero",
  slot: "belt",
  rarity: "magic",
  itemLevel: 61,
  withState: false,
  modifiers: [affix("aca-c1", "+42 a la vida máxima", "prefix", ["Vida"])],
});

const BOTAS_RARAS_HUECO = exerciseItem({
  id: "academia-botas-raras",
  name: "Botas de prácticas",
  baseType: "Botas de malla",
  slot: "boots",
  rarity: "rare",
  itemLevel: 72,
  modifiers: [
    affix("aca-b1", "+55 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-b2", "+18% a la evasión", "prefix", ["Defensa"]),
    affix("aca-b3", "+25% a la velocidad de movimiento", "suffix", ["Velocidad"]),
  ],
});

const PECHO_RARO_LLENO = exerciseItem({
  id: "academia-pecho-lleno",
  name: "Coraza de prácticas completa",
  baseType: "Coraza de placas",
  slot: "body",
  rarity: "rare",
  itemLevel: 78,
  modifiers: [
    affix("aca-p1", "+110 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-p2", "+240 a la armadura", "prefix", ["Defensa"]),
    affix("aca-p3", "+12% a la vida máxima", "prefix", ["Vida"]),
    affix("aca-p4", "+31% a la resistencia al fuego", "suffix", ["Resistencias"]),
    affix("aca-p5", "+28% a la resistencia al rayo", "suffix", ["Resistencias"]),
    affix("aca-p6", "+17% a la resistencia al caos", "suffix", ["Resistencias"]),
  ],
});

const AMULETO_NORMAL = exerciseItem({
  id: "academia-amuleto-normal",
  name: "Amuleto de examen",
  baseType: "Amuleto de ámbar",
  slot: "amulet",
  rarity: "normal",
  itemLevel: 44,
});

const ARMA_MAGICA_1 = exerciseItem({
  id: "academia-arma-magica",
  name: "Maza de examen",
  baseType: "Maza de hierro",
  slot: "weapon",
  rarity: "magic",
  itemLevel: 49,
  modifiers: [affix("aca-w1", "+37% al daño físico", "prefix", ["Daño"])],
});

const ANILLO_EXAMEN_LLENO = exerciseItem({
  id: "academia-anillo-examen",
  name: "Sello de examen",
  baseType: "Anillo de oro",
  slot: "ring2",
  rarity: "magic",
  itemLevel: 66,
  modifiers: [
    affix("aca-r1", "+29 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-r2", "+19% a la resistencia al rayo", "suffix", ["Resistencias"]),
  ],
});

const ESCUDO_RARO_EXAMEN = exerciseItem({
  id: "academia-escudo-examen",
  name: "Escudo de examen",
  baseType: "Escudo torreón",
  slot: "offhand",
  rarity: "rare",
  itemLevel: 70,
  modifiers: [
    affix("aca-e1", "+92 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-e2", "+180 a la armadura", "prefix", ["Defensa"]),
    affix("aca-e3", "+26% a la resistencia al frío", "suffix", ["Resistencias"]),
    affix("aca-e4", "+22% a la resistencia al caos", "suffix", ["Resistencias"]),
  ],
});

const CASCO_EXAMEN_LLENO = exerciseItem({
  id: "academia-casco-examen",
  name: "Yelmo de examen completo",
  baseType: "Yelmo de guerra",
  slot: "helmet",
  rarity: "rare",
  itemLevel: 74,
  modifiers: [
    affix("aca-h1", "+84 a la vida máxima", "prefix", ["Vida"]),
    affix("aca-h2", "+150 a la evasión", "prefix", ["Defensa"]),
    affix("aca-h3", "+9% a la vida máxima", "prefix", ["Vida"]),
    affix("aca-h4", "+30% a la resistencia al fuego", "suffix", ["Resistencias"]),
    affix("aca-h5", "+27% a la resistencia al frío", "suffix", ["Resistencias"]),
    affix("aca-h6", "+15 a la destreza", "suffix", ["Atributo"]),
  ],
});

const BOTAS_EXAMEN_SIN_DATOS = exerciseItem({
  id: "academia-botas-examen-sin-datos",
  name: "Botas copiadas a medias",
  baseType: "Botas de cuero",
  slot: "boots",
  rarity: "magic",
  itemLevel: 55,
  withState: false,
  modifiers: [affix("aca-x1", "+18% a la velocidad de movimiento", "suffix", ["Velocidad"])],
});

// ---------------------------------------------------------------------------
// Opciones reutilizables
// ---------------------------------------------------------------------------

const OPTION_LABELS: Record<CraftingActionId, string> = {
  transmutation: "Orbe de transmutación",
  augmentation: "Orbe de aumento",
  regal: "Orbe regio",
  exalted: "Orbe exaltado",
};

const OPTION_HINTS: Record<CraftingActionId, string> = {
  transmutation: "Normal → mágico, con 1 modificador",
  augmentation: "Añade 1 modificador a un mágico",
  regal: "Mágico → raro conservando lo que hay",
  exalted: "Añade 1 modificador a un raro",
};

function currencyOption(actionId: CraftingActionId): AcademyOption {
  return {
    id: actionId,
    label: OPTION_LABELS[actionId],
    hint: OPTION_HINTS[actionId],
    check: { kind: "action", actionId },
  };
}

function stopOption(hint: string): AcademyOption {
  return { id: "stop", label: "Parar y no gastar", hint, check: { kind: "stop" } };
}

// ---------------------------------------------------------------------------
// Lecciones
// ---------------------------------------------------------------------------

export const CRAFTING_ACADEMY_LESSONS: readonly AcademyLesson[] = [
  {
    id: "leccion-1",
    order: 1,
    title: "Leer un objeto",
    goal: "Antes de gastar nada, saber qué tienes delante.",
    scenarios: [
      {
        id: "l1-rareza",
        conceptId: "rareza",
        situation:
          "Acabas de recoger este yelmo. En el juego el color del nombre y el número de modificadores te dicen su rareza.",
        question: "¿Qué rareza tiene este objeto?",
        item: YELMO_RARO,
        options: [
          { id: "normal", label: "Normal", hint: "Sin modificadores explícitos", check: { kind: "rarity", value: "normal" } },
          { id: "magic", label: "Mágico", hint: "Hasta 2 modificadores", check: { kind: "rarity", value: "magic" } },
          { id: "rare", label: "Raro", hint: "Hasta 6 modificadores", check: { kind: "rarity", value: "rare" } },
        ],
        expectedOptionId: "rare",
        explanation:
          "Es un objeto raro. Tiene 3 modificadores explícitos, y el límite total observado para un raro es 6. Un mágico no podría pasar de 2.",
        why: [
          "El tooltip observado de Orbe de aumento declara que los objetos mágicos pueden tener hasta dos modificadores aleatorios.",
          "El tooltip observado de Orbe exaltado declara que los objetos raros pueden tener hasta seis.",
          "La rareza decide qué monedas son siquiera compatibles: cada una exige una rareza de partida concreta.",
        ],
        misconception:
          "Contar modificadores es la forma rápida de comprobarlo: con 3 explícitos no puede ser normal ni mágico.",
      },
      {
        id: "l1-afijos",
        conceptId: "afijos",
        situation:
          "El mismo yelmo, ahora con las descripciones avanzadas activadas: el juego separa los modificadores en prefijos y sufijos.",
        question: "¿Cuántos prefijos tiene este yelmo?",
        item: YELMO_RARO,
        options: [
          { id: "uno", label: "1 prefijo", check: { kind: "prefixCount", value: 1 } },
          { id: "dos", label: "2 prefijos", check: { kind: "prefixCount", value: 2 } },
          { id: "tres", label: "3 prefijos", check: { kind: "prefixCount", value: 3 } },
        ],
        expectedOptionId: "dos",
        explanation:
          "Dos prefijos y un sufijo. Vida y armadura ocupan la familia de prefijos; la resistencia al fuego, la de sufijos.",
        why: [
          "Exile Copilot solo separa prefijos de sufijos cuando el texto copiado lo declara. Si no lo declara, lo dice y no lo adivina.",
          "Un modificador sin clasificar bloquea el diagnóstico: el banco pide volver a copiar el objeto con las descripciones avanzadas activadas.",
          "Exile Copilot no dispone de una lista verificada de modificadores posibles: solo lee los que ya están en tu objeto.",
        ],
        misconception:
          "El reparto entre prefijos y sufijos no es la mitad y la mitad: depende de qué modificador tocó, y aquí hay 2 y 1.",
      },
      {
        id: "l1-huecos",
        conceptId: "huecos",
        situation:
          "Ese yelmo raro tiene 3 modificadores explícitos y el límite total observado para un raro es 6.",
        question: "¿Qué significa exactamente que le queden 3 huecos?",
        item: YELMO_RARO,
        options: [
          {
            id: "caben",
            label: "Que caben hasta 3 modificadores más",
            hint: "Según el límite total observado",
            check: { kind: "openSlots", value: 3 },
          },
          {
            id: "seran-buenos",
            label: "Que los próximos 3 serán útiles para mi build",
            check: { kind: "claim", truth: false },
          },
          {
            id: "no-falla",
            label: "Que la moneda que use no puede fallar",
            check: { kind: "claim", truth: false },
          },
        ],
        expectedOptionId: "caben",
        explanation:
          "Un hueco es espacio, no calidad. Dice cuántos modificadores caben todavía; no dice cuál saldrá ni si te servirá.",
        why: [
          "Esta es la limitación que el banco repite en cada diagnóstico: un hueco libre no garantiza que una moneda concreta pueda o deba usarse.",
          "Exile Copilot no muestra probabilidades, pesos ni costes porque no están verificados con las fuentes locales disponibles.",
          "El límite total (2 en mágicos, 6 en raros) procede de los tooltips observados y puede cambiar con un parche.",
        ],
        misconception:
          "Confundir «hay sitio» con «va a salir bien» es la forma más rápida de gastar monedas sin un motivo.",
      },
    ],
  },
  {
    id: "leccion-2",
    order: 2,
    title: "De normal a mágico",
    goal: "Dar el primer paso cuando el objeto todavía no tiene nada.",
    scenarios: [
      {
        id: "l2-transmutacion",
        conceptId: "transmutacion",
        situation:
          "Estos guantes son normales: no tienen ningún modificador explícito. Quieres empezar a trabajarlos.",
        question: "¿Qué acción es compatible con este objeto?",
        item: GUANTES_NORMALES,
        options: [
          currencyOption("transmutation"),
          currencyOption("augmentation"),
          currencyOption("regal"),
          stopOption("No hay nada que hacer todavía"),
        ],
        expectedOptionId: "transmutation",
        explanation:
          "Transmutación es la acción compatible: convierte un objeto normal en mágico y le otorga 1 modificador. Las otras dos exigen un objeto que ya sea mágico.",
        why: [
          "Efecto observado de la Transmutación: mejora un objeto de normal a mágico y le otorga 1 modificador.",
          "Aumento y Regio parten de un objeto mágico, así que sobre un normal quedan bloqueados por rareza.",
          "Cuál será ese modificador no se puede anticipar aquí: no hay pool ni pesos verificados en las fuentes locales.",
        ],
        misconception:
          "Cada moneda exige una rareza de partida. Elegir la moneda antes de mirar la rareza es el error más común al empezar.",
      },
    ],
  },
  {
    id: "leccion-3",
    order: 3,
    title: "Completar un mágico",
    goal: "Añadir sin cambiar de rareza, y saber cuándo ya no cabe más.",
    scenarios: [
      {
        id: "l3-aumento",
        conceptId: "aumento",
        situation:
          "El anillo ya es mágico y tiene 1 modificador. Quieres que tenga otro sin cambiar todavía de rareza.",
        question: "¿Qué acción es compatible con este objeto?",
        item: ANILLO_MAGICO_1,
        options: [
          currencyOption("augmentation"),
          currencyOption("transmutation"),
          currencyOption("exalted"),
          stopOption("Está lleno, no cabe nada"),
        ],
        expectedOptionId: "augmentation",
        explanation:
          "Aumento añade 1 modificador aleatorio a un objeto mágico y lo deja mágico. Transmutación necesita un normal y Exaltado un raro.",
        why: [
          "Efecto observado del Aumento: mejora un objeto mágico agregándole un nuevo modificador aleatorio.",
          "Añadir un modificador y cambiar de rareza son cosas distintas: Aumento hace lo primero, Regio hace las dos a la vez.",
          "Con 1 de los 2 modificadores observados como límite, todavía queda un hueco.",
        ],
        misconception:
          "Aumento no sube la rareza. Si lo que buscas es pasar a raro, Aumento no es la acción.",
      },
      {
        id: "l3-limite",
        conceptId: "limite-magico",
        situation:
          "Este otro anillo también es mágico, pero ya tiene 2 modificadores: un prefijo y un sufijo.",
        question: "¿Puedes usar otro Orbe de aumento sobre él?",
        item: ANILLO_MAGICO_2,
        options: [
          {
            id: "no-limite",
            label: "No: un mágico admite como máximo 2 modificadores",
            hint: "Ya no quedan huecos",
            check: { kind: "openSlots", value: 0 },
          },
          {
            id: "si-siempre",
            label: "Sí: siempre cabe uno más si el objeto es de nivel alto",
            check: { kind: "claim", truth: false },
          },
          {
            id: "si-reemplaza",
            label: "Sí: reemplazará el peor de los dos",
            check: { kind: "claim", truth: false },
          },
        ],
        expectedOptionId: "no-limite",
        explanation:
          "No quedan huecos. El tooltip observado declara un máximo de 2 modificadores en objetos mágicos, y este ya los tiene.",
        why: [
          "El límite total observado para mágicos es 2; para raros, 6. Ambos proceden de los tooltips del 22/08/2026.",
          "Aumento AÑADE un modificador; ninguna evidencia local dice que reemplace uno existente.",
          "El nivel del objeto no aparece en ninguna fuente local como forma de superar ese límite.",
        ],
        misconception:
          "Cuando una moneda «no hace nada», casi siempre es porque el estado del objeto no la admite, no porque haya fallado.",
      },
    ],
  },
  {
    id: "leccion-4",
    order: 4,
    title: "Pasar a raro",
    goal: "Subir de rareza conservando lo conseguido — y saber cuándo esperar.",
    scenarios: [
      {
        id: "l4-regio",
        conceptId: "regio",
        situation:
          "El anillo mágico está lleno: 2 de 2 modificadores. Quieres seguir mejorándolo.",
        question: "¿Qué acción es compatible ahora?",
        item: ANILLO_MAGICO_2,
        options: [
          currencyOption("regal"),
          currencyOption("augmentation"),
          currencyOption("exalted"),
          stopOption("Ya no se puede hacer nada con él"),
        ],
        expectedOptionId: "regal",
        explanation:
          "Regio convierte el objeto de mágico a raro, mantiene los modificadores que ya tiene y le agrega 1. Es la vía cuando el mágico se queda sin huecos.",
        why: [
          "Efecto observado del Regio: mejora un objeto de mágico a raro y le agrega 1 modificador; los modificadores actuales se mantienen.",
          "Aumento queda bloqueado porque el objeto ya alcanzó el límite total observado de 2.",
          "Exaltado exige que el objeto ya sea raro, así que todavía no aplica.",
        ],
        misconception:
          "Que Aumento esté bloqueado no significa que el objeto esté acabado: cambia la acción, no el objeto.",
      },
      {
        id: "l4-todavia-no",
        conceptId: "parar-datos",
        situation:
          "Este cinturón es mágico y le queda un hueco, pero el texto que pegaste no confirma si está corrupto, dividido o sin identificar.",
        question: "¿Qué haces?",
        item: CINTURON_SIN_DATOS,
        options: [
          currencyOption("augmentation"),
          currencyOption("regal"),
          stopOption("Vuelve a copiar el objeto completo antes de gastar"),
        ],
        expectedOptionId: "stop",
        explanation:
          "Todavía no. Sin confirmar el estado del objeto no se puede afirmar que ninguna moneda sea legal sobre él. Vuelve a copiarlo con las descripciones avanzadas activadas.",
        why: [
          "Un objeto corrupto, reflejado o santificado bloquea estas monedas; si el texto no lo declara, la aplicación no lo da por descartado.",
          "«No mostrado» nunca se traduce como «sin restricción». Es la misma regla que aplica el banco real.",
          "Parar aquí no es perder el turno: es evitar gastar una moneda sobre un objeto que quizá no la admite.",
        ],
        misconception:
          "Que el objeto se vea bien y tenga hueco no basta. Si falta información, la respuesta prudente es conseguirla, no gastar.",
      },
    ],
  },
  {
    id: "leccion-5",
    order: 5,
    title: "Añadir a un raro",
    goal: "Usar Exaltado con criterio y reconocer cuándo parar.",
    scenarios: [
      {
        id: "l5-exaltado",
        conceptId: "exaltado",
        situation:
          "Estas botas ya son raras: 3 modificadores de los 6 del límite observado. Quieres una resistencia más.",
        question: "¿Qué acción es compatible con este objeto?",
        item: BOTAS_RARAS_HUECO,
        options: [
          currencyOption("exalted"),
          currencyOption("regal"),
          currencyOption("augmentation"),
          stopOption("No queda hueco"),
        ],
        expectedOptionId: "exalted",
        explanation:
          "Exaltado es la acción compatible: añade 1 modificador aleatorio a un objeto raro. Hay hueco, pero eso no significa que salga la resistencia que quieres.",
        why: [
          "Efecto observado del Exaltado: mejora un objeto raro agregándole un nuevo modificador aleatorio.",
          "Regio parte de un mágico y Aumento también, así que sobre un raro quedan bloqueados por rareza.",
          "La aplicación no puede decirte qué modificador aparecerá: no hay pool ni pesos verificados. Tener espacio y tener suerte son cosas distintas.",
        ],
        misconception:
          "«Compatible» significa que la acción es legal sobre este objeto, no que vaya a darte lo que buscas.",
      },
      {
        id: "l5-parar",
        conceptId: "parar-limite",
        situation:
          "Esta coraza rara tiene 6 modificadores: 3 prefijos y 3 sufijos. Es exactamente el límite total observado.",
        question: "¿Qué haces con ella?",
        item: PECHO_RARO_LLENO,
        options: [
          currencyOption("exalted"),
          currencyOption("regal"),
          stopOption("Consérvala y no gastes más en ella"),
        ],
        expectedOptionId: "stop",
        explanation:
          "Parar. No quedan huecos según el límite observado, así que Exaltado no es compatible, y Regio necesita un objeto mágico. Añadir algo exigiría reemplazar lo que ya tienes.",
        why: [
          "Con 6 modificadores explícitos, el banco bloquea las acciones que añaden otro hasta verificar una vía legal.",
          "Reemplazar un modificador es una operación distinta y con riesgo: puede quitarte algo que ya te servía.",
          "Parar es una decisión válida y frecuente. Ninguna de estas cuatro monedas mejora un objeto que ya está lleno.",
        ],
        misconception:
          "Un objeto lleno no es un objeto a medias: si te sirve, gastar más monedas solo puede quitarte lo que ya tienes.",
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Prueba final
// ---------------------------------------------------------------------------

export const CRAFTING_ACADEMY_EXAM: readonly AcademyScenario[] = [
  {
    id: "examen-1",
    conceptId: "transmutacion",
    situation: "Amuleto normal, sin ningún modificador explícito.",
    question: "¿Qué haces?",
    item: AMULETO_NORMAL,
    options: [
      currencyOption("transmutation"),
      currencyOption("augmentation"),
      currencyOption("regal"),
      stopOption("No tocarlo"),
    ],
    expectedOptionId: "transmutation",
    explanation: "Normal con 0 modificadores: Transmutación lo convierte en mágico con 1 modificador.",
    why: ["Aumento y Regio exigen un objeto que ya sea mágico."],
    misconception: "Repasa qué rareza exige cada moneda antes de elegirla.",
  },
  {
    id: "examen-2",
    conceptId: "aumento",
    situation: "Maza mágica con 1 modificador y 1 hueco libre.",
    question: "¿Qué haces?",
    item: ARMA_MAGICA_1,
    options: [
      currencyOption("augmentation"),
      currencyOption("transmutation"),
      currencyOption("exalted"),
      stopOption("No tocarla"),
    ],
    expectedOptionId: "augmentation",
    explanation: "Mágico con hueco: Aumento añade 1 modificador y la deja mágica.",
    why: ["Transmutación parte de un normal; Exaltado, de un raro."],
    misconception: "Aumento es la acción del mágico con hueco libre.",
  },
  {
    id: "examen-3",
    conceptId: "regio",
    situation: "Sello mágico con 2 modificadores: ha alcanzado el límite observado.",
    question: "¿Qué haces?",
    item: ANILLO_EXAMEN_LLENO,
    options: [
      currencyOption("regal"),
      currencyOption("augmentation"),
      currencyOption("exalted"),
      stopOption("No tocarlo"),
    ],
    expectedOptionId: "regal",
    explanation: "Mágico lleno: Regio lo pasa a raro conservando los dos modificadores y añade 1.",
    why: ["Aumento está bloqueado por el límite de 2; Exaltado exige un raro."],
    misconception: "Cuando el mágico se llena, la vía observada para seguir es Regio.",
  },
  {
    id: "examen-4",
    conceptId: "exaltado",
    situation: "Escudo raro con 4 modificadores de los 6 del límite observado.",
    question: "¿Qué haces?",
    item: ESCUDO_RARO_EXAMEN,
    options: [
      currencyOption("exalted"),
      currencyOption("regal"),
      currencyOption("transmutation"),
      stopOption("No tocarlo"),
    ],
    expectedOptionId: "exalted",
    explanation: "Raro con hueco: Exaltado añade 1 modificador. Cuál saldrá sigue sin poder anticiparse.",
    why: ["Regio parte de un mágico; Transmutación, de un normal."],
    misconception: "Exaltado es la acción del raro con hueco libre.",
  },
  {
    id: "examen-5",
    conceptId: "parar-limite",
    situation: "Yelmo raro con 6 modificadores: 3 prefijos y 3 sufijos.",
    question: "¿Qué haces?",
    item: CASCO_EXAMEN_LLENO,
    options: [
      currencyOption("exalted"),
      currencyOption("regal"),
      stopOption("Conservarlo tal y como está"),
    ],
    expectedOptionId: "stop",
    explanation: "Sin huecos según el límite observado, ninguna de estas monedas es compatible. Parar es la respuesta.",
    why: ["Añadir exigiría reemplazar, que es otra operación y tiene riesgo."],
    misconception: "Un objeto lleno no se mejora con estas cuatro monedas.",
  },
  {
    id: "examen-6",
    conceptId: "parar-datos",
    situation: "Botas mágicas con hueco, pero el texto copiado no confirma su estado.",
    question: "¿Qué haces?",
    item: BOTAS_EXAMEN_SIN_DATOS,
    options: [
      currencyOption("augmentation"),
      currencyOption("regal"),
      stopOption("Volver a copiar el objeto antes de gastar"),
    ],
    expectedOptionId: "stop",
    explanation: "Falta información sobre corrupción, división o identificación. Sin ella no se puede afirmar que la moneda sea legal.",
    why: ["«No mostrado» nunca significa «sin restricción»."],
    misconception: "Cuando faltan datos, la respuesta prudente es conseguirlos, no gastar.",
  },
] as const;

// ---------------------------------------------------------------------------
// Resolución contra el motor real
// ---------------------------------------------------------------------------

export interface AcademyOptionResolution {
  optionId: string;
  correct: boolean;
  /** Motivo textual devuelto por el motor, cuando la opción es una moneda. */
  engineReason: string | null;
}

export interface AcademyAnswerResolution {
  correctOptionIds: string[];
  options: AcademyOptionResolution[];
}

/**
 * Recalcula la respuesta correcta desde `evaluateObservedCraftingActions` y
 * `diagnoseCraftingItem`. La Academia no tiene una verdad propia: usa el mismo
 * motor que el banco. Las pruebas comparan esto con `expectedOptionId`.
 */
export function resolveAcademyAnswer(scenario: AcademyScenario): AcademyAnswerResolution {
  const diagnosis = diagnoseCraftingItem(scenario.item);
  const evaluations = evaluateObservedCraftingActions(scenario.item);
  const offeredActionIds = scenario.options
    .map((option) => (option.check.kind === "action" ? option.check.actionId : null))
    .filter((value): value is CraftingActionId => value !== null);
  const someOfferedIsCompatible = evaluations.some(
    (evaluation) =>
      offeredActionIds.includes(evaluation.action.id) && evaluation.status === "compatible",
  );

  const options = scenario.options.map<AcademyOptionResolution>((option) => {
    switch (option.check.kind) {
      case "action": {
        const actionId = option.check.actionId;
        const evaluation = evaluations.find((candidate) => candidate.action.id === actionId);
        return {
          optionId: option.id,
          correct: evaluation?.status === "compatible",
          engineReason: evaluation?.reason ?? null,
        };
      }
      case "stop":
        return {
          optionId: option.id,
          // Parar es correcto exactamente cuando ninguna moneda ofrecida es
          // compatible con el objeto según el motor.
          correct: !someOfferedIsCompatible,
          engineReason: null,
        };
      case "rarity":
        return {
          optionId: option.id,
          correct: scenario.item.rarity === option.check.value,
          engineReason: null,
        };
      case "prefixCount":
        return {
          optionId: option.id,
          correct: diagnosis.prefixCount === option.check.value,
          engineReason: null,
        };
      case "openSlots":
        return {
          optionId: option.id,
          correct: diagnosis.observedOpenSlots === option.check.value,
          engineReason: null,
        };
      case "claim":
        // Afirmaciones que la aplicación se niega a hacer. Nunca son correctas.
        return { optionId: option.id, correct: false, engineReason: null };
    }
  });

  return {
    correctOptionIds: options.filter((option) => option.correct).map((option) => option.optionId),
    options,
  };
}

/**
 * Conceptos que la prueba deja pendientes.
 *
 * Solo cuenta lo que el jugador ha respondido MAL en la tanda indicada. Un
 * escenario sin responder todavía no es un concepto fallado.
 */
export function pendingAcademyConcepts(
  answers: Readonly<Record<string, { correct: boolean }>>,
  scenarios: readonly AcademyScenario[] = CRAFTING_ACADEMY_EXAM,
): AcademyConceptId[] {
  const failed: AcademyConceptId[] = [];
  for (const scenario of scenarios) {
    const record = answers[scenario.id];
    if (record && !record.correct && !failed.includes(scenario.conceptId)) {
      failed.push(scenario.conceptId);
    }
  }
  return failed;
}

/** Todos los escenarios del nivel básico, en el orden en que se recorren. */
export function allAcademyScenarios(): AcademyScenario[] {
  return [
    ...CRAFTING_ACADEMY_LESSONS.flatMap((lesson) => lesson.scenarios),
    ...CRAFTING_ACADEMY_EXAM,
  ];
}

/** Monedas observadas que la Academia usa, para comprobar cobertura. */
export const ACADEMY_COVERED_ACTION_IDS: readonly CraftingActionId[] =
  OBSERVED_CRAFTING_ACTIONS.map((action) => action.id);
