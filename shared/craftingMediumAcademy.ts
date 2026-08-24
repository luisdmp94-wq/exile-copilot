/**
 * ACADEMIA DE CRAFTING — NIVEL MEDIO.
 *
 * El nivel básico enseña a elegir una acción legal y el avanzado a diseñar un
 * contrato. Este puente enseña la parte que ocurre entre ambos: leer el texto
 * DESPUÉS de una acción, compararlo con el snapshot y decidir si conservar,
 * parar, continuar o recuperar datos.
 *
 * Solo clasifica hechos que ya expone `compareCraftingResult`. No valora mods,
 * no estima probabilidades y no inventa resultados de PoE2.
 */

export const CRAFTING_MEDIUM_ACADEMY_VERSION = "medio-2026-08-24";

export const CRAFTING_MEDIUM_ACADEMY_EVIDENCE =
  "Casos sintéticos basados en los estados del comparador local. No representan drops, pools, pesos ni probabilidades.";

export type MediumAcademyDecision =
  | "recopy-result"
  | "reject-different-item"
  | "review-mismatch"
  | "protect-and-stop"
  | "keep-and-stop"
  | "continue-contract";

export interface MediumAcademyFacts {
  resultDataComplete: boolean;
  identityMatches: boolean;
  actionStructureMatches: boolean;
  protectedLineLost: boolean;
  stopConditionFulfilled: boolean;
}

export interface MediumAcademyOption {
  id: string;
  decision: MediumAcademyDecision;
  label: string;
  hint: string;
}

export interface MediumAcademyScenario {
  id: string;
  order: number;
  title: string;
  situation: string;
  before: string;
  after: string;
  facts: MediumAcademyFacts;
  question: string;
  options: MediumAcademyOption[];
  expectedDecision: MediumAcademyDecision;
  explanation: string;
  takeaway: string;
}

/** Orden conservador del comparador: primero identidad y estructura, después valor contractual. */
export function resolveMediumAcademyDecision(
  facts: MediumAcademyFacts,
): MediumAcademyDecision {
  if (!facts.resultDataComplete) return "recopy-result";
  if (!facts.identityMatches) return "reject-different-item";
  if (!facts.actionStructureMatches) return "review-mismatch";
  if (facts.protectedLineLost) return "protect-and-stop";
  if (facts.stopConditionFulfilled) return "keep-and-stop";
  return "continue-contract";
}

const option = (
  id: string,
  decision: MediumAcademyDecision,
  label: string,
  hint: string,
): MediumAcademyOption => ({ id, decision, label, hint });

export const CRAFTING_MEDIUM_ACADEMY_SCENARIOS: readonly MediumAcademyScenario[] = [
  {
    id: "medio-resultado-incompleto",
    order: 1,
    title: "Primero confirma el resultado",
    situation: "Has usado una acción, pero el texto nuevo no incluye nivel de objeto ni todos los modificadores.",
    before: "Snapshot completo guardado",
    after: "Texto parcial; identidad sin confirmar",
    facts: { resultDataComplete: false, identityMatches: false, actionStructureMatches: false, protectedLineLost: false, stopConditionFulfilled: false },
    question: "¿Qué haces ahora?",
    options: [
      option("med-recopiar", "recopy-result", "Copiar el resultado completo", "Sin gastar otra moneda"),
      option("med-continuar-a-ciegas", "continue-contract", "Continuar el craft", "La pieza parece la misma"),
      option("med-dar-por-bueno", "keep-and-stop", "Dar el resultado por bueno", "No se ve ningún problema"),
    ],
    expectedDecision: "recopy-result",
    explanation: "Sin un resultado completo no puedes comparar identidad, líneas añadidas ni pérdidas. Recupera el texto antes de decidir.",
    takeaway: "Un resultado incompleto es un bloqueo de datos, no una tirada mala.",
  },
  {
    id: "medio-objeto-distinto",
    order: 2,
    title: "No compares otra pieza",
    situation: "El resultado pegado tiene otra base o un nivel de objeto distinto al snapshot.",
    before: "Ballesta barnizada · ilvl 32",
    after: "Otra base o ilvl diferente",
    facts: { resultDataComplete: true, identityMatches: false, actionStructureMatches: false, protectedLineLost: false, stopConditionFulfilled: false },
    question: "¿Qué significa esta comparación?",
    options: [
      option("med-rechazar-identidad", "reject-different-item", "No es una comparación válida", "Vuelve a la pieza original"),
      option("med-aceptar-base", "continue-contract", "La base no importa", "Solo cuentan los mods"),
      option("med-parar-identidad", "keep-and-stop", "El craft ha terminado", "El texto cambió mucho"),
    ],
    expectedDecision: "reject-different-item",
    explanation: "La identidad del objeto es el primer control. Si no coincide, el resto de diferencias no demuestra qué hizo la acción.",
    takeaway: "Antes y después deben pertenecer al mismo objeto.",
  },
  {
    id: "medio-estructura-inesperada",
    order: 3,
    title: "Detecta un paso distinto",
    situation: "Esperabas una sola línea nueva, pero desaparecen dos y aparecen dos.",
    before: "Una acción preparada sobre el snapshot",
    after: "La estructura cambia más de lo esperado",
    facts: { resultDataComplete: true, identityMatches: true, actionStructureMatches: false, protectedLineLost: false, stopConditionFulfilled: false },
    question: "¿Qué puede afirmar el mentor?",
    options: [
      option("med-revisar", "review-mismatch", "El resultado no coincide con el paso", "Revisa moneda y texto"),
      option("med-mejora-doble", "continue-contract", "Ha sido una mejora doble", "Aparecieron dos líneas"),
      option("med-terminar-raro", "keep-and-stop", "Es mejor, así que parar", "Tiene más texto"),
    ],
    expectedDecision: "review-mismatch",
    explanation: "El comparador confirma estructura, no calidad. Si cambian más líneas de las previstas, hay que revisar qué ocurrió.",
    takeaway: "Más cambios no significa automáticamente un mejor resultado.",
  },
  {
    id: "medio-protegido-perdido",
    order: 4,
    title: "Respeta lo intocable",
    situation: "La acción produjo la estructura esperada, pero una línea marcada como intocable ya no aparece.",
    before: "Velocidad de ataque protegida",
    after: "La línea protegida desaparece",
    facts: { resultDataComplete: true, identityMatches: true, actionStructureMatches: true, protectedLineLost: true, stopConditionFulfilled: false },
    question: "¿Cuál es la decisión correcta?",
    options: [
      option("med-frenar-protegido", "protect-and-stop", "Frenar y registrar la pérdida", "No encadenes otra acción"),
      option("med-compensar", "continue-contract", "Intentar compensarla", "Quizá salga otra línea"),
      option("med-ignorar-protegido", "keep-and-stop", "Aceptar sin anotarlo", "La acción fue legal"),
    ],
    expectedDecision: "protect-and-stop",
    explanation: "La acción puede ser estructuralmente válida y aun incumplir tu contrato. La pérdida protegida debe quedar visible antes de seguir.",
    takeaway: "Legal no significa aceptable para tu plan.",
  },
  {
    id: "medio-salida-cumplida",
    order: 5,
    title: "Reconoce cuándo parar",
    situation: "El resultado conserva lo protegido y cumple la condición exacta que habías escrito.",
    before: "Contrato abierto",
    after: "Condición de parada cumplida",
    facts: { resultDataComplete: true, identityMatches: true, actionStructureMatches: true, protectedLineLost: false, stopConditionFulfilled: true },
    question: "¿Qué haces aunque aún exista otra acción legal?",
    options: [
      option("med-conservar-parar", "keep-and-stop", "Conservar y parar", "El contrato ya terminó"),
      option("med-una-mas", "continue-contract", "Probar una vez más", "Todavía cabe otro mod"),
      option("med-cambiar-meta", "review-mismatch", "Cambiar la condición ahora", "Buscar algo todavía mejor"),
    ],
    expectedDecision: "keep-and-stop",
    explanation: "La condición de salida existe para evitar convertir un éxito en otra apuesta. Registra el resultado y termina.",
    takeaway: "Una acción disponible no es una acción obligatoria.",
  },
  {
    id: "medio-continuar",
    order: 6,
    title: "Continúa solo dentro del contrato",
    situation: "La comparación es válida, no se pierde nada protegido y la salida aún no se cumple.",
    before: "Snapshot y contrato confirmados",
    after: "Cambio válido, objetivo todavía pendiente",
    facts: { resultDataComplete: true, identityMatches: true, actionStructureMatches: true, protectedLineLost: false, stopConditionFulfilled: false },
    question: "¿Qué decisión queda abierta?",
    options: [
      option("med-continuar-contrato", "continue-contract", "Volver al plan y elegir el siguiente paso", "Sin inventar una receta"),
      option("med-fracaso", "review-mismatch", "Declarar que el craft falló", "No salió el objetivo"),
      option("med-gastar-automatico", "keep-and-stop", "Repetir automáticamente", "La comparación fue válida"),
    ],
    expectedDecision: "continue-contract",
    explanation: "El resultado es compatible, pero no decide por sí solo la siguiente moneda. Vuelve al contrato y compara las rutas todavía legales.",
    takeaway: "Continuar es una nueva decisión; nunca una repetición automática.",
  },
];

export function validateMediumAcademyScenario(scenario: MediumAcademyScenario): boolean {
  return (
    resolveMediumAcademyDecision(scenario.facts) === scenario.expectedDecision &&
    scenario.options.some((entry) => entry.decision === scenario.expectedDecision)
  );
}
