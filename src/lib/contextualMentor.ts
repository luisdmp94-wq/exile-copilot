import type { CurrencyKind, GoalKind, Item, Recommendation } from "@shared/domain.js";
import { CURRENCY_LABELS, GOAL_LABELS, SLOT_LABELS } from "./format.js";

export type ContextualMentorSource = "guide" | "engine" | "market" | "ai";

export interface ContextualMentorCue {
  id: string;
  source: ContextualMentorSource;
  eyebrow: string;
  title: string;
  message: string;
  /** Pregunta contextual lista para el mentor supervisado. */
  question: string | null;
}

export type ContextualMentorEvent =
  | { type: "ready"; profileName: string }
  | { type: "workspace"; workspace: "expediente" | "plan" }
  | { type: "item"; item: Item }
  | { type: "editor" }
  | { type: "goal"; goal: GoalKind }
  | { type: "budget"; amount: number; currency: CurrencyKind }
  | { type: "league"; league: string }
  | { type: "recommendations"; recommendations: Recommendation[] }
  | { type: "market"; quoteCount: number; verifiedCount: number; degraded: boolean }
  | { type: "tracked"; title: string }
  | { type: "session"; title: string }
  | { type: "ai"; answer: string };

export function contextualMentorCue(event: ContextualMentorEvent): ContextualMentorCue {
  switch (event.type) {
    case "ready":
      return {
        id: `ready:${event.profileName}`,
        source: "guide",
        eyebrow: "Mentor presente",
        title: `He cargado el expediente de ${event.profileName}`,
        message:
          "Abre una pieza, cambia tu objetivo o genera recomendaciones: te explicaré qué significa cada decisión sin perder el contexto.",
        question: "¿Qué debería revisar primero en mi personaje actual?",
      };
    case "workspace":
      return event.workspace === "plan"
        ? {
            id: "workspace:plan",
            source: "guide",
            eyebrow: "Cambio de contexto",
            title: "Estás en Plan y mercado",
            message:
              "Aquí defines hacia dónde quieres llevar la build y cuánto puedes gastar. Cambiar estos valores puede alterar la prioridad del diagnóstico.",
            question: "Con mi objetivo y presupuesto actuales, ¿qué decisión debería evitar?",
          }
        : {
            id: "workspace:expediente",
            source: "guide",
            eyebrow: "Cambio de contexto",
            title: "Has vuelto al expediente",
            message:
              "Aquí manda tu personaje real: equipo, memoria, caso abierto y la única próxima acción.",
            question: "¿Cuál es ahora mismo el principal problema de mi personaje?",
          };
    case "item": {
      const name = event.item.name || event.item.baseType || "esta pieza";
      const slot = SLOT_LABELS[event.item.slot];
      return {
        id: `item:${event.item.id}`,
        source: "guide",
        eyebrow: `Inspeccionando ${slot.toLowerCase()}`,
        title: name,
        message:
          "No juzgues la pieza aislada: comprueba qué problema resuelve, qué perderías al sustituirla y si está vinculada al caso abierto.",
        question: `Estoy mirando ${name} en ${slot}. ¿Qué papel tiene en mi problema actual y qué dato debo comprobar antes de cambiarla?`,
      };
    }
    case "editor":
      return {
        id: "editor:open",
        source: "guide",
        eyebrow: "Calidad del diagnóstico",
        title: "Cuanto mejor sea el expediente, mejor será el consejo",
        message:
          "Corrige solo datos que puedas confirmar. Un valor desconocido es más útil que un cero inventado.",
        question: "¿Qué dato de mi expediente falta y cambiaría más el diagnóstico?",
      };
    case "goal":
      return {
        id: `goal:${event.goal}`,
        source: "guide",
        eyebrow: "Objetivo actualizado",
        title: GOAL_LABELS[event.goal],
        message:
          "El motor volverá a ponderar las mejoras con este objetivo. Las recomendaciones anteriores dejan de ser vigentes.",
        question: `He cambiado mi objetivo a ${GOAL_LABELS[event.goal]}. ¿Qué prioridad debería cambiar en mi build?`,
      };
    case "budget":
      return {
        id: `budget:${event.amount}:${event.currency}`,
        source: "market",
        eyebrow: "Presupuesto actualizado",
        title: `${event.amount} ${CURRENCY_LABELS[event.currency]}`,
        message:
          "Este límite solo permite confirmar costes cuando existen precios y conversiones verificables; no convierte estimaciones en compras seguras.",
        question: `Con un presupuesto de ${event.amount} ${CURRENCY_LABELS[event.currency]}, ¿qué mejora verificable debería priorizar?`,
      };
    case "league":
      return {
        id: `league:${event.league}`,
        source: "market",
        eyebrow: "Mercado actualizado",
        title: event.league,
        message:
          "Los precios dependen de la liga. Vuelve a consultar el mercado antes de usar una referencia anterior.",
        question: `Estoy jugando en ${event.league}. ¿Qué dato de mercado necesito verificar para mi siguiente mejora?`,
      };
    case "recommendations": {
      const first = event.recommendations[0] ?? null;
      return {
        id: `recommendations:${event.recommendations.map((rec) => rec.id).join(",")}`,
        source: "engine",
        eyebrow: "Diagnóstico actualizado",
        title: first ? `Prioridad: ${first.title}` : "No apareció una mejora accionable",
        message: first
          ? `El motor encontró ${event.recommendations.length} posibilidad(es), pero solo una debe guiar el siguiente paso. Abre la prioridad para revisar evidencia, coste y riesgo.`
          : "No voy a inventar una tarea. Revisa los datos desconocidos o cambia el objetivo antes de intentarlo de nuevo.",
        question: first
          ? `¿Por qué ${first.title} debe ser mi siguiente paso y qué tengo que comprobar antes?`
          : "¿Qué dato me falta para obtener una recomendación útil?",
      };
    }
    case "market":
      return {
        id: `market:${event.quoteCount}:${event.verifiedCount}:${event.degraded}`,
        source: "market",
        eyebrow: event.degraded ? "Mercado degradado" : "Consulta terminada",
        title: `${event.verifiedCount} de ${event.quoteCount} precio(s) verificado(s)`,
        message: event.degraded
          ? "Hay datos de caché o ejemplo. Úsalos para orientarte, nunca para justificar una compra irreversible."
          : "Los precios verificados ya pueden acotar la decisión, pero todavía hay que comprobar que la pieza encaja en tu personaje.",
        question: "Con estos precios, ¿qué compra es relevante para mi caso abierto y cuál debería ignorar?",
      };
    case "tracked":
      return {
        id: `tracked:${event.title}`,
        source: "engine",
        eyebrow: "Memoria actualizada",
        title: `Has guardado «${event.title}»`,
        message:
          "El mentor la tratará como tu única acción activa y evitará proponerte tareas paralelas hasta que registres el resultado.",
        question: `He guardado ${event.title}. ¿Qué resultado debo observar para saber si funcionó?`,
      };
    case "session":
      return {
        id: `session:${event.title}`,
        source: "engine",
        eyebrow: "Sesión guiada iniciada",
        title: event.title,
        message:
          "Antes de cambiar nada, fija qué esperas que mejore y qué señal te haría detenerte. El resultado quedará en el diario.",
        question: `Voy a probar ${event.title}. ¿Qué debería observar antes y después?`,
      };
    case "ai":
      return {
        id: `ai:${event.answer}`,
        source: "ai",
        eyebrow: "Groq ha revisado este contexto",
        title: "Respuesta contextual",
        message: event.answer,
        question: null,
      };
  }
}
