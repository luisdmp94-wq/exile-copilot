import type { CurrencyKind, GoalKind, Item, Recommendation } from "@shared/domain.js";
import type { MentorIntent } from "@shared/mentorQuery.js";
import { CURRENCY_LABELS, GOAL_LABELS, SLOT_LABELS } from "./format.js";

export type ContextualMentorSource = "guide" | "engine" | "market" | "warning";

export interface ContextualMentorAsk {
  question: string;
  /** Intención conocida por la propia interfaz; el servidor sigue validando la petición. */
  intent: Exclude<MentorIntent, "unsupported">;
}

export interface ContextualMentorCue {
  id: string;
  source: ContextualMentorSource;
  eyebrow: string;
  title: string;
  message: string;
  /** Consulta contextual lista para el mentor supervisado. */
  ask: ContextualMentorAsk | null;
}

export type ContextualMentorEvent =
  | { type: "welcome" }
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
  | { type: "profileSaved" }
  | { type: "planImported"; name: string }
  | { type: "applied"; title: string }
  | { type: "invalidated" }
  | { type: "sessionResult"; title: string }
  | { type: "sessionPaused"; title: string }
  | { type: "error"; area: "mentor" | "mercado" | "recomendaciones" | "diario"; message: string };

export function contextualMentorCue(event: ContextualMentorEvent): ContextualMentorCue {
  switch (event.type) {
    case "welcome":
      return {
        id: "welcome",
        source: "guide",
        eyebrow: "Primer paso",
        title: "Necesito conocer a tu personaje",
        message:
          "Carga un ejemplo o importa tus datos. Hasta entonces no atribuiré equipo, problemas ni decisiones a un personaje que no existe.",
        ask: null,
      };
    case "ready":
      return {
        id: `ready:${event.profileName}`,
        source: "guide",
        eyebrow: "Mentor presente",
        title: `He cargado el expediente de ${event.profileName}`,
        message:
          "Abre una pieza, cambia tu objetivo o genera recomendaciones: te explicaré qué significa cada decisión sin perder el contexto.",
        ask: {
          question: "¿Qué debería mejorar primero en mi personaje actual?",
          intent: "next_improvement",
        },
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
            ask: {
              question: "¿Qué debería mejorar primero con mi objetivo y presupuesto actuales?",
              intent: "next_improvement",
            },
          }
        : {
            id: "workspace:expediente",
            source: "guide",
            eyebrow: "Cambio de contexto",
            title: "Has vuelto al expediente",
            message:
              "Aquí manda tu personaje real: equipo, memoria, caso abierto y la única próxima acción.",
            ask: {
              question: "¿Cuál es ahora mismo el principal problema de mi personaje?",
              intent: "explain_priority",
            },
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
        ask: {
          question: `Estoy mirando ${name} en ${slot}. ¿Por qué está relacionada con mi prioridad y qué dato debo comprobar antes de cambiarla?`,
          intent: "explain_priority",
        },
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
        ask: {
          question: "¿Qué debería mejorar primero al completar mi expediente?",
          intent: "next_improvement",
        },
      };
    case "goal":
      return {
        id: `goal:${event.goal}`,
        source: "guide",
        eyebrow: "Objetivo actualizado",
        title: GOAL_LABELS[event.goal],
        message:
          "El motor volverá a ponderar las mejoras con este objetivo. Las recomendaciones anteriores dejan de ser vigentes.",
        ask: {
          question: `He cambiado mi objetivo a ${GOAL_LABELS[event.goal]}. ¿Qué debería mejorar primero ahora?`,
          intent: "next_improvement",
        },
      };
    case "budget":
      return {
        id: `budget:${event.amount}:${event.currency}`,
        source: "market",
        eyebrow: "Presupuesto actualizado",
        title: `${event.amount} ${CURRENCY_LABELS[event.currency]}`,
        message:
          "Este límite solo permite confirmar costes cuando existen precios y conversiones verificables; no convierte estimaciones en compras seguras.",
        ask: {
          question: `Con un presupuesto de ${event.amount} ${CURRENCY_LABELS[event.currency]}, ¿qué mejora verificable debería priorizar?`,
          intent: "next_improvement",
        },
      };
    case "league":
      return {
        id: `league:${event.league}`,
        source: "market",
        eyebrow: "Mercado actualizado",
        title: event.league,
        message:
          "Los precios dependen de la liga. Vuelve a consultar el mercado antes de usar una referencia anterior.",
        ask: {
          question: `Estoy jugando en ${event.league}. ¿Qué debería mejorar primero con esta liga seleccionada?`,
          intent: "next_improvement",
        },
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
        ask: first
          ? {
              question: `¿Por qué ${first.title} debe ser mi siguiente paso y qué tengo que comprobar antes?`,
              intent: "explain_priority",
            }
          : {
              question: "¿Qué debería mejorar primero para obtener una recomendación útil?",
              intent: "next_improvement",
            },
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
        ask: {
          question: "Con estos precios, ¿qué debería mejorar primero dentro de mi presupuesto?",
          intent: "next_improvement",
        },
      };
    case "tracked":
      return {
        id: `tracked:${event.title}`,
        source: "engine",
        eyebrow: "Memoria actualizada",
        title: `Has guardado «${event.title}»`,
        message:
          "El mentor la tratará como tu única acción activa y evitará proponerte tareas paralelas hasta que registres el resultado.",
        ask: {
          question: `¿Por qué ${event.title} debe seguir siendo mi prioridad mientras observo el resultado?`,
          intent: "explain_priority",
        },
      };
    case "session":
      return {
        id: `session:${event.title}`,
        source: "engine",
        eyebrow: "Sesión guiada iniciada",
        title: event.title,
        message:
          "Antes de cambiar nada, fija qué esperas que mejore y qué señal te haría detenerte. El resultado quedará en el diario.",
        ask: {
          question: `¿Por qué ${event.title} es la decisión que debo comprobar ahora?`,
          intent: "explain_priority",
        },
      };
    case "profileSaved":
      return {
        id: "profile:saved",
        source: "engine",
        eyebrow: "Expediente actualizado",
        title: "Los cambios ya forman parte del diagnóstico",
        message:
          "Las recomendaciones y respuestas anteriores pueden haber quedado obsoletas. Genera un diagnóstico nuevo antes de gastar.",
        ask: {
          question: "He guardado mi expediente. ¿Qué debería mejorar primero ahora?",
          intent: "next_improvement",
        },
      };
    case "planImported":
      return {
        id: `plan:imported:${event.name}`,
        source: "guide",
        eyebrow: "Plan de referencia importado",
        title: event.name,
        message:
          "Esto orienta el destino de la build, pero no describe tu personaje actual. El motor mantendrá ambas cosas separadas.",
        ask: {
          question: `He importado el plan ${event.name}. ¿Qué debería mejorar primero para acercarme sin confundirlo con mi personaje?`,
          intent: "next_improvement",
        },
      };
    case "applied":
      return {
        id: `applied:${event.title}`,
        source: "engine",
        eyebrow: "Cambio marcado",
        title: `Has marcado «${event.title}» como aplicada`,
        message:
          "Esto describe lo que planeas exportar; no demuestra que el resultado haya funcionado en el juego. Registra después lo observado.",
        ask: {
          question: `¿Por qué debo comprobar el resultado de ${event.title} antes de continuar?`,
          intent: "explain_priority",
        },
      };
    case "invalidated":
      return {
        id: "recommendations:invalidated",
        source: "warning",
        eyebrow: "Diagnóstico obsoleto",
        title: "Tus datos cambiaron",
        message:
          "He retirado las prioridades anteriores porque ya no representan el personaje, objetivo o presupuesto actual.",
        ask: {
          question: "Mis datos cambiaron. ¿Qué debería mejorar primero ahora?",
          intent: "next_improvement",
        },
      };
    case "sessionResult":
      return {
        id: `session-result:${event.title}`,
        source: "engine",
        eyebrow: "Resultado registrado",
        title: event.title,
        message:
          "El resultado ya está en el diario. El siguiente diagnóstico debe partir de lo observado, no de la hipótesis anterior.",
        ask: {
          question: "He registrado el resultado de mi decisión. ¿Qué debería mejorar primero ahora?",
          intent: "next_improvement",
        },
      };
    case "sessionPaused":
      return {
        id: `session-paused:${event.title}`,
        source: "warning",
        eyebrow: "Decisión en pausa",
        title: event.title,
        message:
          "No trataré esta decisión como un fracaso ni abriré otra sin revisar por qué se detuvo.",
        ask: {
          question: `¿Por qué debo revisar ${event.title} antes de elegir otra mejora?`,
          intent: "explain_priority",
        },
      };
    case "error":
      return {
        id: `error:${event.area}:${event.message}`,
        source: "warning",
        eyebrow: "No se pudo actualizar el contexto",
        title: `Problema en ${event.area}`,
        message: event.message,
        ask: null,
      };
  }
}
