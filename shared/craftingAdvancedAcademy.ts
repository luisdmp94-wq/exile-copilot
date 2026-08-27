/**
 * ACADEMIA DE CRAFTING — NIVEL AVANZADO.
 *
 * Este contenido entrena decisiones estructurales que el jugador aplica en PoE2:
 * completar datos, definir objetivo y salida, conservar opciones, detenerse al
 * cumplir su plan y no aceptar reemplazos sin leer la descripción real.
 * No contiene recetas, pools, pesos, probabilidades ni precios.
 */

import type { Item } from "./domain.js";
import { createAcademyAffix, createAcademyExerciseItem } from "./craftingAcademy.js";

export const CRAFTING_ADVANCED_ACADEMY_VERSION = "avanzado-2026-08-28";

export const CRAFTING_ADVANCED_ACADEMY_EVIDENCE =
  "Ejercicios sintéticos para aprender a decidir dentro de PoE2. No representan un drop, una receta, un pool ni una probabilidad.";

export type AdvancedAcademyDecision =
  | "complete-data"
  | "define-objective"
  | "define-stop"
  | "stop"
  | "change-base"
  | "request-tooltip"
  | "simulate-transformation"
  | "simulate-equipment-swap"
  | "transmutation"
  | "augmentation"
  | "regal"
  | "exalted"
  | "compare-risks";

export type AdvancedRouteRisk = "adds" | "stage-change" | "replacement" | "transformation";

export interface AdvancedAcademyRouteFact {
  id: "transmutation" | "augmentation" | "regal" | "exalted" | "essence" | "alloy" | "flux";
  label: string;
  legal: boolean;
  risk: AdvancedRouteRisk;
  tooltipVerified: boolean;
  consequence: string;
}

export interface AdvancedAcademyFacts {
  itemDataComplete: boolean;
  objectiveDefined: boolean;
  stopDefined: boolean;
  stopFulfilled: boolean;
  /** Límite de pérdida o intentos declarado por el propio jugador. */
  abandonConditionFulfilled?: boolean;
  protectedLineCount: number;
  /** Operación cuyo resultado depende de todas las líneas afectadas del objeto elegido. */
  transformation?: {
    tooltipVerified: boolean;
    simulated: boolean;
  };
  /** Sustitución de equipo cuyo impacto depende del personaje completo. */
  equipmentSwap?: {
    dependenciesKnown: boolean;
    simulated: boolean;
  };
  routes: AdvancedAcademyRouteFact[];
}

export interface AdvancedAcademyOption {
  id: string;
  decision: AdvancedAcademyDecision;
  label: string;
  hint: string;
}

export interface AdvancedAcademyScenario {
  id: string;
  order: number;
  title: string;
  skill: string;
  situation: string;
  item: Item;
  contract: {
    objective: string;
    protect: string[];
    stop: string;
  };
  facts: AdvancedAcademyFacts;
  question: string;
  options: AdvancedAcademyOption[];
  expectedDecision: AdvancedAcademyDecision;
  explanation: string;
  lesson: string;
  gameSteps: string[];
}

/**
 * La misma jerarquía conservadora que gobierna el plano experto.
 * Devuelve una decisión, no una valoración de la build ni una receta.
 */
export function resolveAdvancedAcademyDecision(
  facts: AdvancedAcademyFacts,
): AdvancedAcademyDecision {
  if (!facts.itemDataComplete) return "complete-data";
  if (!facts.objectiveDefined) return "define-objective";
  if (!facts.stopDefined) return "define-stop";
  if (facts.stopFulfilled) return "stop";
  if (facts.abandonConditionFulfilled) return "change-base";

  const unverifiedReplacement = facts.routes.some(
    (route) => route.risk === "replacement" && !route.tooltipVerified,
  );
  if (unverifiedReplacement) return "request-tooltip";

  if (facts.transformation !== undefined) {
    if (!facts.transformation.tooltipVerified) return "request-tooltip";
    if (!facts.transformation.simulated) return "simulate-transformation";
  }

  if (facts.equipmentSwap !== undefined) {
    if (!facts.equipmentSwap.dependenciesKnown) return "complete-data";
    if (!facts.equipmentSwap.simulated) return "simulate-equipment-swap";
  }

  const legal = facts.routes.filter((route) => route.legal);
  const hasAugmentation = legal.some((route) => route.id === "augmentation");
  const hasRegal = legal.some((route) => route.id === "regal");
  if (hasAugmentation && hasRegal) return "augmentation";

  if (legal.length === 1) {
    const only = legal[0]!.id;
    if (
      only === "transmutation" ||
      only === "augmentation" ||
      only === "regal" ||
      only === "exalted"
    ) {
      return only;
    }
  }

  return "compare-risks";
}

const option = (
  id: string,
  decision: AdvancedAcademyDecision,
  label: string,
  hint: string,
): AdvancedAcademyOption => ({ id, decision, label, hint });

const advancedAffix = createAcademyAffix;

const ITEM_CONTRATO_ABIERTO = createAcademyExerciseItem({
  id: "avanzado-contrato-abierto",
  name: "Botas del proyecto abierto",
  baseType: "Botas de paso veloz",
  slot: "boots",
  rarity: "rare",
  itemLevel: 78,
  modifiers: [
    advancedAffix("av-c1", "+96 a la vida máxima", "prefix", ["Vida"]),
    advancedAffix("av-c2", "Velocidad de movimiento aumentada", "suffix", ["Velocidad"]),
    advancedAffix("av-c3", "+27% a la resistencia al fuego", "suffix", ["Resistencias"]),
  ],
});

const ITEM_CONSERVAR_OPCIONES = createAcademyExerciseItem({
  id: "avanzado-conservar-opciones",
  name: "Guantes prometedores",
  baseType: "Guantes de acechador",
  slot: "gloves",
  rarity: "magic",
  itemLevel: 78,
  modifiers: [advancedAffix("av-o1", "+88 a la vida máxima", "prefix", ["Vida"])],
});

const ITEM_REEMPLAZO = createAcademyExerciseItem({
  id: "avanzado-reemplazo",
  name: "Amuleto con línea protegida",
  baseType: "Amuleto de lapislázuli",
  slot: "amulet",
  rarity: "rare",
  itemLevel: 80,
  modifiers: [
    advancedAffix("av-r1", "+108 a la vida máxima", "prefix", ["Vida"]),
    advancedAffix("av-r2", "+24 a la destreza", "suffix", ["Atributo"]),
    advancedAffix("av-r3", "+29% a la resistencia al hielo", "suffix", ["Resistencias"]),
  ],
});

const ITEM_SALIDA_CUMPLIDA = createAcademyExerciseItem({
  id: "avanzado-salida-cumplida",
  name: "Cinturón de la meta cumplida",
  baseType: "Cinturón de cuero crudo",
  slot: "belt",
  rarity: "rare",
  itemLevel: 80,
  modifiers: [
    advancedAffix("av-s1", "+122 a la vida máxima", "prefix", ["Vida"]),
    advancedAffix("av-s2", "+31% a la resistencia al fuego", "suffix", ["Resistencias"]),
    advancedAffix("av-s3", "+28% a la resistencia al hielo", "suffix", ["Resistencias"]),
    advancedAffix("av-s4", "+25 a la fuerza", "suffix", ["Atributo"]),
  ],
});

const ITEM_LECTURA_INCOMPLETA = createAcademyExerciseItem({
  id: "avanzado-lectura-incompleta",
  name: "Yelmo copiado a medias",
  baseType: "Yelmo de cazador",
  slot: "helmet",
  rarity: "magic",
  itemLevel: 76,
  withState: false,
  modifiers: [advancedAffix("av-d1", "+74 a la vida máxima", "prefix", ["Vida"])],
});

const ITEM_RIESGOS_EMPATE = createAcademyExerciseItem({
  id: "avanzado-riesgos-empate",
  name: "Anillo en la encrucijada",
  baseType: "Anillo inconcluso",
  slot: "ring1",
  rarity: "rare",
  itemLevel: 81,
  modifiers: [
    advancedAffix("av-e1", "+92 a la vida máxima", "prefix", ["Vida"]),
    advancedAffix("av-e2", "+32% a la resistencia al rayo", "suffix", ["Resistencias"]),
    advancedAffix("av-e3", "+20 a la destreza", "suffix", ["Atributo"]),
  ],
});

const ITEM_BASE_AGOTADA = createAcademyExerciseItem({
  id: "avanzado-base-agotada",
  name: "Botas del último intento",
  baseType: "Botas de paso veloz",
  slot: "boots",
  rarity: "magic",
  itemLevel: 78,
  modifiers: [advancedAffix("av-b1", "+19 al maná máximo", "prefix", ["Maná"])],
});

const ITEM_TRANSFORMACION = createAcademyExerciseItem({
  id: "avanzado-transformacion",
  name: "Anillo antes del Flux",
  baseType: "Anillo de lapislázuli",
  slot: "ring1",
  rarity: "rare",
  itemLevel: 81,
  modifiers: [
    advancedAffix("av-f1", "+103 a la vida máxima", "prefix", ["Vida"]),
    advancedAffix("av-f2", "+27 a la fuerza", "suffix", ["Atributo"]),
    advancedAffix("av-f3", "+30% a la resistencia al fuego", "suffix", ["Resistencias"]),
  ],
});

const ITEM_SUSTITUCION = createAcademyExerciseItem({
  id: "avanzado-sustitucion",
  name: "Amuleto candidato",
  baseType: "Amuleto de lapislázuli",
  slot: "amulet",
  rarity: "rare",
  itemLevel: 82,
  modifiers: [
    advancedAffix("av-x1", "Daño de proyectiles aumentado", "prefix", ["Daño", "Proyectil"]),
    advancedAffix("av-x2", "+91 a la vida máxima", "prefix", ["Vida"]),
    advancedAffix("av-x3", "+18 a la destreza", "suffix", ["Atributo"]),
  ],
});

export const CRAFTING_ADVANCED_ACADEMY_SCENARIOS: readonly AdvancedAcademyScenario[] = [
  {
    id: "avanzado-contrato-sin-salida",
    order: 1,
    title: "Decidir cuándo vas a parar",
    skill: "No empezar sin saber cuándo parar",
    situation:
      "Has elegido la mejora que buscas y una línea que no quieres perder, pero todavía no has decidido qué resultado considerarás suficiente.",
    item: ITEM_CONTRATO_ABIERTO,
    contract: {
      objective: "Añadir otra línea útil de defensa",
      protect: ["Conservar la resistencia ya presente"],
      stop: "Sin definir",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: false,
      stopFulfilled: false,
      protectedLineCount: 1,
      routes: [],
    },
    question: "¿Cuál es el siguiente paso correcto?",
    options: [
      option("av-definir-salida", "define-stop", "Definir una condición de parada", "Algo que puedas comprobar al mirar el siguiente resultado en el juego"),
      option("av-gastar-primero", "exalted", "Gastar y decidir después", "La pieza todavía tiene hueco"),
      option("av-quitar-proteccion", "compare-risks", "Quitar la línea intocable", "Así habrá menos restricciones"),
    ],
    expectedDecision: "define-stop",
    explanation:
      "Sin salida no hay forma objetiva de declarar el craft terminado. Define primero una condición observable; después compara acciones.",
    lesson: "Un objetivo dice hacia dónde vas. La condición de parada decide cuándo dejas de pagar por seguir.",
    gameSteps: [
      "Antes de tocar una moneda, mira la pieza y decide qué mejora concreta buscas.",
      "Elige qué línea actual no aceptarías perder.",
      "Fija un resultado o un número máximo de intentos y respétalo mientras juegas.",
    ],
  },
  {
    id: "avanzado-conservar-etapa",
    order: 2,
    title: "Conservar opciones",
    skill: "Ordenar dos acciones legales",
    situation:
      "La pieza es mágica y tiene un solo modificador. Aumento y Regio son legales, pero Regio cambia la etapa del craft.",
    item: ITEM_CONSERVAR_OPCIONES,
    contract: {
      objective: "Completar la etapa mágica antes de pasar a raro",
      protect: ["Conservar el modificador actual"],
      stop: "Revisar la pieza al completar sus dos líneas mágicas",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      protectedLineCount: 1,
      routes: [
        {
          id: "augmentation",
          label: "Orbe de aumento",
          legal: true,
          risk: "adds",
          tooltipVerified: true,
          consequence: "Añade una línea y mantiene la pieza mágica.",
        },
        {
          id: "regal",
          label: "Orbe regio",
          legal: true,
          risk: "stage-change",
          tooltipVerified: true,
          consequence: "Añade una línea y convierte la pieza en rara.",
        },
      ],
    },
    question: "¿Qué acción conserva más decisiones posteriores?",
    options: [
      option("av-aumento", "augmentation", "Aumento primero", "Regio seguirá disponible después"),
      option("av-regio", "regal", "Regio directamente", "Avanza ya a la etapa rara"),
      option("av-indiferente", "compare-risks", "Da igual el orden", "Las dos añaden una línea"),
    ],
    expectedDecision: "augmentation",
    explanation:
      "Aumento mantiene la etapa mágica y deja Regio como decisión posterior. Usar Regio primero cierra la opción de Aumento.",
    lesson: "Cuando dos rutas son legales, una ruta conservadora mantiene abiertas más decisiones verificadas.",
    gameSteps: [
      "Comprueba que la pieza mágica tiene una sola línea y que te resulta útil.",
      "Usa Aumento sobre la pieza dentro del juego y lee la segunda línea.",
      "Solo después decide si quieres usar Regio para convertirla en rara.",
    ],
  },
  {
    id: "avanzado-reemplazo-no-demostrado",
    order: 3,
    title: "Frenar un reemplazo",
    skill: "No arriesgar una línea protegida a ciegas",
    situation:
      "La pieza rara está llena. Tienes una Essence y un Alloy, pero todavía no has leído su descripción completa dentro del juego.",
    item: ITEM_REEMPLAZO,
    contract: {
      objective: "Sustituir una línea prescindible",
      protect: ["Velocidad de ataque", "Nivel de habilidades"],
      stop: "Parar si cualquiera de las dos líneas protegidas queda en riesgo",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      protectedLineCount: 2,
      routes: [
        {
          id: "essence",
          label: "Essence",
          legal: false,
          risk: "replacement",
          tooltipVerified: false,
          consequence: "Puede reemplazar una línea; falta comprobar su texto exacto.",
        },
        {
          id: "alloy",
          label: "Alloy",
          legal: false,
          risk: "replacement",
          tooltipVerified: false,
          consequence: "Puede reemplazar una línea; falta comprobar su texto exacto.",
        },
      ],
    },
    question: "¿Qué haces antes de elegir herramienta?",
    options: [
      option("av-pedir-tooltip", "request-tooltip", "Leer ambos recursos dentro del juego", "Comprobar efecto, compatibilidad y riesgo antes de usarlos"),
      option("av-essence", "compare-risks", "Elegir Essence por el nombre", "Parece más específica"),
      option("av-alloy", "compare-risks", "Elegir Alloy por descarte", "La otra no inspira confianza"),
    ],
    expectedDecision: "request-tooltip",
    explanation:
      "No hay una ruta segura sin leer la descripción completa. En una operación de reemplazo, el nombre del recurso no demuestra qué línea puede desaparecer.",
    lesson: "La incertidumbre aceptable para añadir no es la misma que para reemplazar algo que ya quieres conservar.",
    gameSteps: [
      "Pon la pieza y los dos recursos juntos en el inventario o alijo.",
      "Lee la descripción completa de cada recurso y localiza qué añade y qué puede reemplazar.",
      "No uses ninguno si la descripción no te permite proteger las líneas importantes.",
    ],
  },
  {
    id: "avanzado-salida-cumplida",
    order: 4,
    title: "Reconocer el final",
    skill: "No convertir un éxito en otra apuesta",
    situation:
      "Después del último uso, apareció la línea exacta que buscabas y las líneas importantes siguen presentes.",
    item: ITEM_SALIDA_CUMPLIDA,
    contract: {
      objective: "Conseguir la línea exacta definida por el jugador",
      protect: ["Las dos líneas marcadas siguen presentes"],
      stop: "La línea exacta aparece en el resultado",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: true,
      protectedLineCount: 2,
      routes: [
        {
          id: "exalted",
          label: "Orbe exaltado",
          legal: true,
          risk: "adds",
          tooltipVerified: true,
          consequence: "Ocuparía otro hueco, aunque el objetivo ya está cumplido.",
        },
      ],
    },
    question: "¿Cuál es la decisión avanzada?",
    options: [
      option("av-parar", "stop", "Parar y conservar el resultado", "La condición que elegiste ya se cumple"),
      option("av-otro-exaltado", "exalted", "Añadir otra línea", "Todavía queda un hueco"),
      option("av-subir-objetivo", "define-objective", "Cambiar el objetivo ahora", "Buscar un resultado todavía mejor"),
    ],
    expectedDecision: "stop",
    explanation:
      "La mejora que planeaste ya está terminada. Que exista otra acción legal no obliga a usarla; hacerlo abriría un riesgo que tu objetivo no necesitaba.",
    lesson: "Una condición de salida solo sirve si se respeta cuando llega el momento de parar.",
    gameSteps: [
      "Vuelve a leer la pieza completa después de cada moneda.",
      "Comprueba que apareció tu objetivo y que las líneas importantes siguen ahí.",
      "Guarda la pieza o equípala; no uses otra moneda solo porque todavía exista un hueco.",
    ],
  },
  {
    id: "avanzado-datos-incompletos",
    order: 5,
    title: "Recuperar evidencia",
    skill: "Distinguir bloqueo de mala suerte",
    situation:
      "No estás viendo la descripción completa de la pieza dentro del juego. Su aspecto sugiere que podría quedar un hueco, pero no puedes confirmarlo.",
    item: ITEM_LECTURA_INCOMPLETA,
    contract: {
      objective: "Añadir una línea sin perder las actuales",
      protect: ["Todos los modificadores observados"],
      stop: "Revisar el resultado tras una sola acción legal",
    },
    facts: {
      itemDataComplete: false,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      protectedLineCount: 2,
      routes: [],
    },
    question: "¿Qué resuelve primero el bloqueo?",
    options: [
      option("av-recopiar", "complete-data", "Revisar la descripción completa en el juego", "Confirmar rareza, modificadores, afijos y estados"),
      option("av-probar-moneda", "exalted", "Probar una moneda barata", "Si no funciona, no pasa nada"),
      option("av-deducir", "compare-risks", "Deducir el hueco por la apariencia", "Parece una pieza incompleta"),
    ],
    expectedDecision: "complete-data",
    explanation:
      "La siguiente acción es leer bien la pieza, no elegir una moneda. Si no puedes confirmar su estado, no debes asumir que el hueco existe.",
    lesson: "Un bloqueo por datos protege el objeto. No es una recomendación negativa ni un fallo del craft.",
    gameSteps: [
      "Abre la descripción avanzada del objeto dentro de PoE2.",
      "Confirma su rareza, número de modificadores, prefijos, sufijos y estados especiales.",
      "Si todavía falta información, no uses ninguna moneda sobre esa pieza.",
    ],
  },
  {
    id: "avanzado-sin-ganador",
    order: 6,
    title: "Aceptar que no hay ganador",
    skill: "Comparar riesgos sin inventar una receta",
    situation:
      "Dos rutas de reemplazo tienen su descripción verificada y ambas son compatibles, pero cada una arriesga una consecuencia distinta. No hay pesos ni probabilidades verificadas.",
    item: ITEM_RIESGOS_EMPATE,
    contract: {
      objective: "Cambiar una línea prescindible",
      protect: ["Conservar la línea principal del objeto"],
      stop: "Aceptar solo un resultado que conserve la línea principal",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      protectedLineCount: 1,
      routes: [
        {
          id: "essence",
          label: "Essence verificada",
          legal: true,
          risk: "replacement",
          tooltipVerified: true,
          consequence: "Garantiza su propia línea y reemplaza otra al azar.",
        },
        {
          id: "alloy",
          label: "Alloy verificado",
          legal: true,
          risk: "replacement",
          tooltipVerified: true,
          consequence: "Aplica su efecto observado y reemplaza otra línea.",
        },
      ],
    },
    question: "¿Qué puede afirmar honestamente el mentor?",
    options: [
      option("av-comparar", "compare-risks", "Comparar consecuencias y dejarme elegir", "No hay un ganador demostrado"),
      option("av-elegir-essence", "request-tooltip", "Essence es siempre mejor", "Su línea está garantizada"),
      option("av-elegir-alloy", "request-tooltip", "Alloy es siempre más avanzado", "Tiene más condiciones"),
    ],
    expectedDecision: "compare-risks",
    explanation:
      "Con dos rutas compatibles y sin una ventaja demostrable, debes comparar qué conserva y qué arriesga cada una, no asumir que existe un ganador.",
    lesson: "Una respuesta avanzada también puede ser: no existe información suficiente para declarar una ruta superior.",
    gameSteps: [
      "Coloca la pieza y ambos recursos juntos para poder leerlos sin prisas.",
      "Para cada recurso, identifica qué conserva, qué añade y qué puede eliminar.",
      "Elige según la pérdida que aceptarías; si ninguna te compensa, guarda los recursos.",
    ],
  },
  {
    id: "avanzado-retirar-base",
    order: 7,
    title: "Retirar una base a tiempo",
    skill: "Respetar también la salida de fracaso",
    situation:
      "Ya registraste el segundo resultado. La línea objetivo no apareció y has alcanzado el límite de intentos que escribiste antes de empezar.",
    item: ITEM_BASE_AGOTADA,
    contract: {
      objective: "Conseguir la línea objetivo conservando la principal",
      protect: ["Conservar la línea principal"],
      stop: "Máximo dos intentos; si ambos fallan, cambiar de base",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      abandonConditionFulfilled: true,
      protectedLineCount: 1,
      routes: [
        {
          id: "essence",
          label: "Otro intento verificado",
          legal: true,
          risk: "replacement",
          tooltipVerified: true,
          consequence: "La acción existe, pero quedaría fuera del límite declarado.",
        },
      ],
    },
    question: "¿Qué decisión respeta el límite que elegiste?",
    options: [
      option(
        "av-cambiar-base",
        "change-base",
        "Cerrar este craft y cambiar de base",
        "El límite acordado ya se alcanzó",
      ),
      option(
        "av-intento-extra",
        "compare-risks",
        "Conceder un intento extra",
        "La acción todavía es compatible",
      ),
      option(
        "av-borrar-limite",
        "define-stop",
        "Borrar la condición de parada",
        "Así el craft puede continuar",
      ),
    ],
    expectedDecision: "change-base",
    explanation:
      "Una acción compatible no invalida el límite que elegiste. Cierra este intento y cambia de base; ampliar el límite después de fallar elimina la protección que debía darte.",
    lesson: "Tu plan debe decir cuándo conservar un éxito y cuándo dejar de invertir en una base.",
    gameSteps: [
      "Cuenta los intentos mientras trabajas la pieza dentro del juego.",
      "Cuando alcances el límite que elegiste, mueve esa pieza fuera de la zona de trabajo.",
      "Empieza con otra base; no cambies la regla solo porque el intento anterior falló.",
    ],
  },
  {
    id: "avanzado-simular-flux",
    order: 8,
    title: "Simular antes de transformar",
    skill: "Elegir la pieza por el resultado completo",
    situation:
      "Tienes fuego por debajo del límite, frío sobrante y rayo justo. La descripción del Flux afecta dos resistencias de la pieza elegida: tus guantes solo aportan frío, pero tus botas aportan frío y rayo.",
    item: ITEM_TRANSFORMACION,
    contract: {
      objective: "Reequilibrar resistencias sin abrir otra carencia",
      protect: ["Mantener fuego, frío y rayo en su límite"],
      stop: "La simulación deja las tres resistencias cubiertas",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      protectedLineCount: 3,
      transformation: {
        tooltipVerified: true,
        simulated: false,
      },
      routes: [
        {
          id: "flux",
          label: "Flux con descripción comprobada",
          legal: true,
          risk: "transformation",
          tooltipVerified: true,
          consequence:
            "Transforma todas las líneas que nombra su descripción en la pieza elegida; no solo la que quieres aprovechar.",
        },
      ],
    },
    question: "¿Qué haces antes de consumir el Flux?",
    options: [
      option(
        "av-simular-ambas",
        "simulate-transformation",
        "Simular guantes y botas por separado",
        "Recalcular las tres resistencias tras cada resultado",
      ),
      option(
        "av-elegir-mayor-frio",
        "compare-risks",
        "Usarlo donde haya más frío",
        "Así obtendré la mayor conversión posible",
      ),
      option(
        "av-usar-botas",
        "compare-risks",
        "Usarlo directamente en las botas",
        "Tienen dos resistencias y parecen más aprovechables",
      ),
    ],
    expectedDecision: "simulate-transformation",
    explanation:
      "El excedente aislado no basta para elegir. Primero simula el objeto entero: transformar las botas también puede tocar el rayo que estaba justo; una pieza con solo frío puede conservar más equilibrio.",
    lesson:
      "Una transformación global se evalúa por el estado final del personaje, no por la línea que quieres convertir.",
    gameSteps: [
      "Lee el Flux y las dos piezas dentro del juego antes de seleccionar ninguna.",
      "Calcula cómo quedarían fuego, frío y rayo si lo usas sobre cada candidata.",
      "Usa el Flux únicamente sobre la pieza cuyo resultado mantenga cubiertas las tres resistencias.",
    ],
  },
  {
    id: "avanzado-simular-sustitucion",
    order: 9,
    title: "Comprobar la sustitución completa",
    skill: "No romper dependencias por una mejora aislada",
    situation:
      "Una pieza candidata mejora la línea ofensiva que buscas, pero la equipada aporta atributos y resistencias que pueden sostener requisitos de habilidades y límites defensivos. Ambas piezas están leídas, pero todavía no has recalculado el personaje sin la actual.",
    item: ITEM_SUSTITUCION,
    contract: {
      objective: "Sustituir la pieza sin romper el resto del equipo",
      protect: ["Mantener requisitos de habilidades", "No abrir huecos de resistencias"],
      stop: "El personaje completo sigue cumpliendo sus dependencias",
    },
    facts: {
      itemDataComplete: true,
      objectiveDefined: true,
      stopDefined: true,
      stopFulfilled: false,
      protectedLineCount: 2,
      equipmentSwap: {
        dependenciesKnown: true,
        simulated: false,
      },
      routes: [],
    },
    question: "¿Qué haces antes de equipar la candidata?",
    options: [
      option(
        "av-simular-cambio",
        "simulate-equipment-swap",
        "Comparar el personaje antes y después",
        "Recalcular atributos, resistencias y requisitos",
      ),
      option(
        "av-equipar-mejora",
        "compare-risks",
        "Equiparla por su mejora principal",
        "La línea buscada es claramente superior",
      ),
      option(
        "av-descartar-candidata",
        "stop",
        "Descartarla sin comprobar",
        "La pieza actual ya mantiene todo estable",
      ),
    ],
    expectedDecision: "simulate-equipment-swap",
    explanation:
      "La pieza no se evalúa aislada. Compara el personaje completo antes y después: una ganancia local no compensa perder un requisito de habilidad o abrir una resistencia sin darte cuenta.",
    lesson:
      "Antes de sustituir equipo, protege las dependencias que la pieza actual sostiene aunque no formen parte de tu objetivo principal.",
    gameSteps: [
      "Abre la ficha del personaje y anota atributos y resistencias con la pieza actual equipada.",
      "Equipa la candidata dentro del juego y revisa de nuevo esos valores y tus habilidades.",
      "Conserva el cambio solo si sigues cumpliendo requisitos y límites defensivos.",
    ],
  },
];

export function validateAdvancedAcademyScenario(scenario: AdvancedAcademyScenario): boolean {
  const decisions = scenario.options.map((entry) => entry.decision);
  return (
    resolveAdvancedAcademyDecision(scenario.facts) === scenario.expectedDecision &&
    decisions.includes(scenario.expectedDecision)
  );
}
