/**
 * ACADEMIA DE CRAFTING — NIVEL AVANZADO.
 *
 * Este contenido entrena decisiones estructurales que ya aplica el laboratorio:
 * completar datos, definir objetivo y salida, conservar opciones, detenerse al
 * cumplir el contrato y no aceptar reemplazos sin leer su tooltip real.
 * No contiene recetas, pools, pesos, probabilidades ni precios.
 */

export const CRAFTING_ADVANCED_ACADEMY_VERSION = "avanzado-2026-08-26";

export const CRAFTING_ADVANCED_ACADEMY_EVIDENCE =
  "Basado en los contratos locales de diagnóstico, rutas y condiciones de salida. Los casos son sintéticos y no representan un drop ni una receta.";

export type AdvancedAcademyDecision =
  | "complete-data"
  | "define-objective"
  | "define-stop"
  | "stop"
  | "change-base"
  | "request-tooltip"
  | "transmutation"
  | "augmentation"
  | "regal"
  | "exalted"
  | "compare-risks";

export type AdvancedRouteRisk = "adds" | "stage-change" | "replacement";

export interface AdvancedAcademyRouteFact {
  id: "transmutation" | "augmentation" | "regal" | "exalted" | "essence" | "alloy";
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

export const CRAFTING_ADVANCED_ACADEMY_SCENARIOS: readonly AdvancedAcademyScenario[] = [
  {
    id: "avanzado-contrato-sin-salida",
    order: 1,
    title: "Cerrar el contrato",
    skill: "No empezar sin saber cuándo parar",
    situation:
      "Has descrito la mejora y marcado una línea intocable, pero todavía no existe una condición comprobable de salida.",
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
      option("av-definir-salida", "define-stop", "Definir una condición de parada", "Algo que puedas comprobar en el siguiente texto pegado"),
      option("av-gastar-primero", "exalted", "Gastar y decidir después", "La pieza todavía tiene hueco"),
      option("av-quitar-proteccion", "compare-risks", "Quitar la línea intocable", "Así habrá menos restricciones"),
    ],
    expectedDecision: "define-stop",
    explanation:
      "Sin salida no hay forma objetiva de declarar el craft terminado. Define primero una condición observable; después compara acciones.",
    lesson: "Un objetivo dice hacia dónde vas. La condición de parada decide cuándo dejas de pagar por seguir.",
  },
  {
    id: "avanzado-conservar-etapa",
    order: 2,
    title: "Conservar opciones",
    skill: "Ordenar dos acciones legales",
    situation:
      "La pieza es mágica y tiene un solo modificador. Aumento y Regio son legales, pero Regio cambia la etapa del craft.",
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
  },
  {
    id: "avanzado-reemplazo-no-demostrado",
    order: 3,
    title: "Frenar un reemplazo",
    skill: "No arriesgar una línea protegida a ciegas",
    situation:
      "La pieza rara está llena. Essence y Alloy aparecen como herramientas de reemplazo, pero todavía no has pegado el tooltip del recurso real.",
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
      option("av-pedir-tooltip", "request-tooltip", "Pegar el tooltip real", "Comprobar efecto, compatibilidad y riesgo"),
      option("av-essence", "compare-risks", "Elegir Essence por el nombre", "Parece más específica"),
      option("av-alloy", "compare-risks", "Elegir Alloy por descarte", "La otra no inspira confianza"),
    ],
    expectedDecision: "request-tooltip",
    explanation:
      "No hay una ruta demostrada sin el tooltip. En una operación de reemplazo, el nombre del recurso no prueba qué línea puede desaparecer.",
    lesson: "La incertidumbre aceptable para añadir no es la misma que para reemplazar algo que ya quieres conservar.",
  },
  {
    id: "avanzado-salida-cumplida",
    order: 4,
    title: "Reconocer el final",
    skill: "No convertir un éxito en otra apuesta",
    situation:
      "Tras registrar el resultado, la línea exacta que pedía tu contrato aparece y las líneas intocables siguen presentes.",
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
          consequence: "Ocuparía otro hueco, aunque el contrato ya está cumplido.",
        },
      ],
    },
    question: "¿Cuál es la decisión avanzada?",
    options: [
      option("av-parar", "stop", "Parar y conservar el resultado", "El contrato de salida ya se cumple"),
      option("av-otro-exaltado", "exalted", "Añadir otra línea", "Todavía queda un hueco"),
      option("av-subir-objetivo", "define-objective", "Cambiar el objetivo ahora", "Buscar un resultado todavía mejor"),
    ],
    expectedDecision: "stop",
    explanation:
      "El craft definido ya terminó. Que exista otra acción legal no obliga a usarla; hacerlo abriría un riesgo que el contrato no pedía.",
    lesson: "Una condición de salida solo sirve si se respeta cuando llega el momento de parar.",
  },
  {
    id: "avanzado-datos-incompletos",
    order: 5,
    title: "Recuperar evidencia",
    skill: "Distinguir bloqueo de mala suerte",
    situation:
      "El texto copiado no permite confirmar el estado completo de la pieza. Aun así, la forma visual sugiere que podría quedar un hueco.",
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
      option("av-recopiar", "complete-data", "Volver a copiar el objeto completo", "Con Ctrl+Alt+C"),
      option("av-probar-moneda", "exalted", "Probar una moneda barata", "Si no funciona, no pasa nada"),
      option("av-deducir", "compare-risks", "Deducir el hueco por la apariencia", "Parece una pieza incompleta"),
    ],
    expectedDecision: "complete-data",
    explanation:
      "La siguiente acción es recuperar evidencia, no elegir moneda. El laboratorio no convierte un dato ausente en una restricción descartada.",
    lesson: "Un bloqueo por datos protege el objeto. No es una recomendación negativa ni un fallo del craft.",
  },
  {
    id: "avanzado-sin-ganador",
    order: 6,
    title: "Aceptar que no hay ganador",
    skill: "Comparar riesgos sin inventar una receta",
    situation:
      "Dos rutas de reemplazo tienen tooltip verificado y ambas son compatibles, pero cada una arriesga una consecuencia distinta. No hay pesos ni probabilidades verificadas.",
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
      "Con dos rutas compatibles y sin una ventaja demostrable, el mentor debe exponer qué conserva y qué arriesga cada una, no fabricar un ranking.",
    lesson: "Una respuesta avanzada también puede ser: no existe información suficiente para declarar una ruta superior.",
  },
  {
    id: "avanzado-retirar-base",
    order: 7,
    title: "Retirar una base a tiempo",
    skill: "Respetar también la salida de fracaso",
    situation:
      "Ya registraste el segundo resultado. La línea objetivo no apareció y has alcanzado el límite de intentos que escribiste antes de empezar.",
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
    question: "¿Qué decisión respeta tu contrato?",
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
    lesson: "El contrato debe decir cuándo conservar un éxito y cuándo dejar de invertir en una base.",
  },
];

export function validateAdvancedAcademyScenario(scenario: AdvancedAcademyScenario): boolean {
  const decisions = scenario.options.map((entry) => entry.decision);
  return (
    resolveAdvancedAcademyDecision(scenario.facts) === scenario.expectedDecision &&
    decisions.includes(scenario.expectedDecision)
  );
}
