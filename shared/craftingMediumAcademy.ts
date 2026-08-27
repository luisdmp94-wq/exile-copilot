/**
 * ACADEMIA DE CRAFTING — NIVEL MEDIO.
 *
 * El nivel básico enseña qué hace cada moneda observada. Este nivel enseña
 * cuándo merece la pena usarla durante una partida: elegir una base útil,
 * decidir qué necesita el personaje, reconocer una pieza prometedora y parar
 * cuando el objetivo ya está cumplido.
 *
 * Las situaciones ocurren dentro de PoE2. No enseñan a manejar el comparador,
 * pegar tooltips ni operar ninguna pantalla de Exile Copilot.
 */

import type { Item } from "./domain.js";
import { createAcademyAffix, createAcademyExerciseItem } from "./craftingAcademy.js";

export const CRAFTING_MEDIUM_ACADEMY_VERSION = "medio-juego-2026-08-27";

export const CRAFTING_MEDIUM_ACADEMY_EVIDENCE =
  "Ejercicios sintéticos apoyados en los efectos de moneda observados en el cliente el 22/08/2026. No representan drops, pools, pesos, probabilidades ni precios.";

export type MediumAcademyDecision =
  | "choose-fitting-base"
  | "define-one-goal"
  | "change-unhelpful-base"
  | "use-augmentation"
  | "use-regal"
  | "consider-exalted"
  | "equip-test-stop";

export type MediumAcademySituation =
  | "base-selection"
  | "goal-selection"
  | "first-magic-mod"
  | "magic-open-slot"
  | "magic-ready-for-regal"
  | "rare-open-slot"
  | "goal-complete";

export interface MediumAcademyFacts {
  situation: MediumAcademySituation;
  baseFitsCharacter?: boolean;
  goalDefined?: boolean;
  usefulModifierPresent?: boolean;
  rarity?: "normal" | "magic" | "rare";
  openModifierSlots?: number;
  goalFulfilled?: boolean;
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
  gameState: string;
  playerGoal: string;
  item: Item;
  facts: MediumAcademyFacts;
  question: string;
  options: MediumAcademyOption[];
  expectedDecision: MediumAcademyDecision;
  explanation: string;
  takeaway: string;
}

/** Cada decisión deriva de algo que el jugador puede comprobar dentro del juego. */
export function resolveMediumAcademyDecision(
  facts: MediumAcademyFacts,
): MediumAcademyDecision {
  switch (facts.situation) {
    case "base-selection":
      return "choose-fitting-base";
    case "goal-selection":
      return "define-one-goal";
    case "first-magic-mod":
      return facts.usefulModifierPresent ? "use-augmentation" : "change-unhelpful-base";
    case "magic-open-slot":
      return facts.rarity === "magic" && facts.usefulModifierPresent && (facts.openModifierSlots ?? 0) > 0
        ? "use-augmentation"
        : "change-unhelpful-base";
    case "magic-ready-for-regal":
      return facts.rarity === "magic" && facts.usefulModifierPresent && facts.openModifierSlots === 0
        ? "use-regal"
        : "change-unhelpful-base";
    case "rare-open-slot":
      return facts.rarity === "rare" && facts.usefulModifierPresent && (facts.openModifierSlots ?? 0) > 0
        ? "consider-exalted"
        : "equip-test-stop";
    case "goal-complete":
      return facts.goalDefined && facts.goalFulfilled ? "equip-test-stop" : "define-one-goal";
  }
}

const option = (
  id: string,
  decision: MediumAcademyDecision,
  label: string,
  hint: string,
): MediumAcademyOption => ({ id, decision, label, hint });

const mediumAffix = createAcademyAffix;

const BASE_ADECUADA = createAcademyExerciseItem({
  id: "medio-base-adecuada",
  name: "Arco de prácticas",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "normal",
  itemLevel: 72,
});

const MAGICO_SIN_OBJETIVO = createAcademyExerciseItem({
  id: "medio-magico-sin-objetivo",
  name: "Arco incierto",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "magic",
  itemLevel: 72,
  modifiers: [mediumAffix("med-o1", "+31 a la precisión", "suffix", ["Ataque"])],
});

const MAGICO_INUTIL = createAcademyExerciseItem({
  id: "medio-magico-inutil",
  name: "Arco del desvío",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "magic",
  itemLevel: 72,
  modifiers: [mediumAffix("med-i1", "+22 al maná máximo", "prefix", ["Maná"])],
});

const MAGICO_PROMETEDOR = createAcademyExerciseItem({
  id: "medio-magico-prometedor",
  name: "Arco del filo",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "magic",
  itemLevel: 72,
  modifiers: [mediumAffix("med-p1", "Daño físico aumentado", "prefix", ["Daño", "Físico"])],
});

const MAGICO_COMPLETO = createAcademyExerciseItem({
  id: "medio-magico-completo",
  name: "Arco del filo veloz",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "magic",
  itemLevel: 72,
  modifiers: [
    mediumAffix("med-c1", "Daño físico aumentado", "prefix", ["Daño", "Físico"]),
    mediumAffix("med-c2", "Velocidad de ataque aumentada", "suffix", ["Ataque", "Velocidad"]),
  ],
});

const RARO_CON_HUECOS = createAcademyExerciseItem({
  id: "medio-raro-con-huecos",
  name: "Arco de avance",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "rare",
  itemLevel: 72,
  modifiers: [
    mediumAffix("med-r1", "Daño físico aumentado", "prefix", ["Daño", "Físico"]),
    mediumAffix("med-r2", "Agrega daño físico a los ataques", "prefix", ["Daño", "Físico"]),
    mediumAffix("med-r3", "Velocidad de ataque aumentada", "suffix", ["Ataque", "Velocidad"]),
  ],
});

const RARO_OBJETIVO_CUMPLIDO = createAcademyExerciseItem({
  id: "medio-raro-objetivo-cumplido",
  name: "Arco de la prueba superada",
  baseType: "Arco geminiano",
  slot: "weapon",
  rarity: "rare",
  itemLevel: 72,
  modifiers: [
    mediumAffix("med-f1", "Daño físico aumentado", "prefix", ["Daño", "Físico"]),
    mediumAffix("med-f2", "Agrega daño físico a los ataques", "prefix", ["Daño", "Físico"]),
    mediumAffix("med-f3", "Velocidad de ataque aumentada", "suffix", ["Ataque", "Velocidad"]),
    mediumAffix("med-f4", "+18 a la destreza", "suffix", ["Atributo"]),
  ],
});

export const CRAFTING_MEDIUM_ACADEMY_SCENARIOS: readonly MediumAcademyScenario[] = [
  {
    id: "medio-elegir-base",
    order: 1,
    title: "Empieza por una base que te sirva",
    situation:
      "Estás en tu alijo y tienes varias piezas del mismo hueco. Una coincide con el tipo de arma o defensa que usa tu personaje; las otras no.",
    gameState: "Varias bases disponibles",
    playerGoal: "Mejorar el hueco que realmente usa tu personaje",
    item: BASE_ADECUADA,
    facts: { situation: "base-selection", baseFitsCharacter: true },
    question: "¿Con cuál empiezas a gastar monedas?",
    options: [
      option("med-base-correcta", "choose-fitting-base", "Con la base que encaja con mi personaje", "Primero debe servirte el objeto"),
      option("med-base-rara", "consider-exalted", "Con la que tenga el nombre más llamativo", "El nombre no define si te sirve"),
      option("med-base-cualquiera", "define-one-goal", "Con cualquiera; luego la arreglo", "La moneda no cambia el tipo de base"),
    ],
    expectedDecision: "choose-fitting-base",
    explanation:
      "El crafting empieza antes de usar una moneda. Si la base no encaja con tu personaje, incluso una buena tirada puede terminar en una pieza que no quieres equipar.",
    takeaway: "Primero eliges la base; después decides cómo mejorarla.",
  },
  {
    id: "medio-definir-objetivo",
    order: 2,
    title: "Decide qué problema quieres resolver",
    situation:
      "La base sí te sirve, pero todavía no has decidido qué esperas obtener de ella para tu personaje actual.",
    gameState: "Base correcta, objetivo todavía abierto",
    playerGoal: "Salir del alijo con una mejora reconocible",
    item: MAGICO_SIN_OBJETIVO,
    facts: { situation: "goal-selection", baseFitsCharacter: true, goalDefined: false },
    question: "¿Qué haces antes de usar la primera moneda?",
    options: [
      option("med-objetivo-concreto", "define-one-goal", "Elijo una mejora concreta", "Por ejemplo: daño, defensa o una resistencia que me falta"),
      option("med-objeto-perfecto", "consider-exalted", "Intento crear el objeto perfecto", "No define cuándo una tirada ya te sirve"),
      option("med-gastar-primero", "use-augmentation", "Empiezo a gastar y decido después", "La moneda aleatoria no conoce tu intención"),
    ],
    expectedDecision: "define-one-goal",
    explanation:
      "Una meta concreta te permite juzgar cada resultado. «Mejorar mi resistencia al fuego» o «conseguir más daño físico» se puede comprobar; «hacerla perfecta» no te dice cuándo parar.",
    takeaway: "Una pieza, un problema principal.",
  },
  {
    id: "medio-primer-mod-inutil",
    order: 3,
    title: "No persigas una salida mala",
    situation:
      "Usaste una Transmutación. La pieza ahora es mágica, pero su primer modificador no ayuda al objetivo que elegiste.",
    gameState: "Objeto mágico con un modificador que no te sirve",
    playerGoal: "Conservar monedas para una base prometedora",
    item: MAGICO_INUTIL,
    facts: { situation: "first-magic-mod", usefulModifierPresent: false, rarity: "magic", openModifierSlots: 1 },
    question: "¿Cuál es la decisión con más sentido?",
    options: [
      option("med-cambiar-base", "change-unhelpful-base", "Pruebo otra base", "No tengo nada útil que proteger todavía"),
      option("med-regio-inutil", "use-regal", "Uso Regio porque puede arreglarla", "Subir la rareza conserva también el mal inicio"),
      option("med-exaltado-inutil", "consider-exalted", "Uso Exaltado hasta que mejore", "Exaltado requiere un objeto raro"),
    ],
    expectedDecision: "change-unhelpful-base",
    explanation:
      "Que quede un hueco no obliga a continuar. Si el primer resultado no aporta nada a tu objetivo, abandonar esa salida y empezar con otra base evita invertir más en una pieza sin una ventaja inicial.",
    takeaway: "Un hueco libre no convierte una mala salida en un proyecto prometedor.",
  },
  {
    id: "medio-completar-magico",
    order: 4,
    title: "Completa el mágico antes de subirlo",
    situation:
      "Esta vez la Transmutación sí dejó un modificador útil. El objeto es mágico y todavía admite otro modificador.",
    gameState: "Objeto mágico con una línea útil y un hueco",
    playerGoal: "Aprovechar el último hueco de la rareza mágica",
    item: MAGICO_PROMETEDOR,
    facts: { situation: "magic-open-slot", usefulModifierPresent: true, rarity: "magic", openModifierSlots: 1 },
    question: "¿Qué moneda usas ahora?",
    options: [
      option("med-usar-aumento", "use-augmentation", "Orbe de aumento", "Añade un modificador al objeto mágico"),
      option("med-usar-regio-pronto", "use-regal", "Orbe regio", "Lo subiría a raro sin aprovechar primero ese hueco"),
      option("med-parar-magico", "equip-test-stop", "Paro siempre al primer mod útil", "Todavía existe una acción compatible y limitada"),
    ],
    expectedDecision: "use-augmentation",
    explanation:
      "Aumento añade un modificador aleatorio a un objeto mágico. Usarlo aquí te deja ver el segundo modificador antes de decidir si merece la pena convertir la pieza en rara.",
    takeaway: "Si el mágico promete y aún tiene hueco, completa esa etapa primero.",
  },
  {
    id: "medio-cuando-regio",
    order: 5,
    title: "Usa Regio sobre algo que quieras conservar",
    situation:
      "El objeto mágico ya tiene sus dos modificadores. Al menos uno contribuye al objetivo de tu personaje y quieres seguir trabajando la misma pieza.",
    gameState: "Objeto mágico completo con una línea útil",
    playerGoal: "Pasarlo a raro sin perder lo que ya funciona",
    item: MAGICO_COMPLETO,
    facts: { situation: "magic-ready-for-regal", usefulModifierPresent: true, rarity: "magic", openModifierSlots: 0 },
    question: "¿Cuándo tiene sentido usar el Orbe regio?",
    options: [
      option("med-regio-prometedor", "use-regal", "Ahora: quiero conservar esta salida", "Regio mantiene los modificadores y añade uno"),
      option("med-regio-cualquier-magico", "consider-exalted", "En cualquier mágico, aunque nada me sirva", "La rareza no convierte sus líneas en útiles"),
      option("med-aumento-lleno", "use-augmentation", "Uso otro Aumento primero", "El mágico ya alcanzó su límite observado"),
    ],
    expectedDecision: "use-regal",
    explanation:
      "Regio convierte el mágico en raro, conserva sus modificadores y agrega uno. Estratégicamente merece la pena cuando ya existe algo que quieres mantener, no solo porque la acción sea legal.",
    takeaway: "No subas de rareza una pieza que ya querías abandonar.",
  },
  {
    id: "medio-cuando-exaltado",
    order: 6,
    title: "Exaltado es una apuesta, no un acabado automático",
    situation:
      "La pieza ya es rara, conserva una mejora que te sirve y todavía tiene espacio para otro modificador.",
    gameState: "Objeto raro útil con al menos un hueco",
    playerGoal: "Intentar una mejora adicional sin esperar un resultado concreto",
    item: RARO_CON_HUECOS,
    facts: { situation: "rare-open-slot", usefulModifierPresent: true, rarity: "rare", openModifierSlots: 1 },
    question: "¿Qué debes aceptar antes de usar Exaltado?",
    options: [
      option("med-exaltado-consciente", "consider-exalted", "Que añadirá algo aleatorio", "Hay hueco, pero no una mejora garantizada"),
      option("med-exaltado-garantiza", "equip-test-stop", "Que completará exactamente mi objetivo", "El efecto observado no promete un afijo concreto"),
      option("med-exaltado-repite", "use-regal", "Que puedo repetirlo hasta acertar", "Cada hueco gastado cambia el estado de la pieza"),
    ],
    expectedDecision: "consider-exalted",
    explanation:
      "El efecto observado del Exaltado es añadir un modificador aleatorio a un objeto raro. Tener sitio hace posible la acción; no garantiza que el resultado encaje con tu personaje.",
    takeaway: "Antes de Exaltado decides si la pieza merece esa apuesta.",
  },
  {
    id: "medio-probar-y-parar",
    order: 7,
    title: "Equipa, prueba y aprende a parar",
    situation:
      "La pieza ya aporta la mejora concreta que buscabas. Aún podría quedar espacio, pero tu problema principal está resuelto.",
    gameState: "El objetivo elegido ya aparece en la pieza",
    playerGoal: "Comprobar la mejora durante el juego",
    item: RARO_OBJETIVO_CUMPLIDO,
    facts: { situation: "goal-complete", usefulModifierPresent: true, goalDefined: true, goalFulfilled: true, rarity: "rare" },
    question: "¿Qué haces ahora?",
    options: [
      option("med-equipar-probar", "equip-test-stop", "La equipo y la pruebo", "Compruebo si mejora realmente a mi personaje"),
      option("med-llenar-siempre", "consider-exalted", "Lleno todos los huecos porque existen", "Espacio libre no significa necesidad"),
      option("med-cambiar-meta", "define-one-goal", "Cambio el objetivo para seguir gastando", "Mover la meta impide reconocer un éxito"),
    ],
    expectedDecision: "equip-test-stop",
    explanation:
      "El propósito del crafting es mejorar lo que juegas, no llenar siempre el objeto. Equípalo, prueba el personaje y solo vuelve al banco si detectas una necesidad nueva.",
    takeaway: "El craft termina en el juego, no cuando desaparece el último hueco.",
  },
];

export function validateMediumAcademyScenario(scenario: MediumAcademyScenario): boolean {
  return (
    resolveMediumAcademyDecision(scenario.facts) === scenario.expectedDecision &&
    scenario.options.some((entry) => entry.decision === scenario.expectedDecision)
  );
}
