import { useCallback, useEffect, useReducer } from "react";
import { toast } from "sonner";
import {
  mentorInputsKey,
  type MentorAnswer,
  type MentorQueryRequest,
} from "@shared/mentorQuery.js";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import {
  initialMentorThreadState,
  MENTOR_THREAD_STORAGE_KEY,
  mentorThreadReducer,
  restoreMentorThread,
  serializeMentorThread,
  type MentorThreadState,
} from "@/lib/mentorThread";

export type { MentorTurn, MentorTurnRole } from "@/lib/mentorThread";

/**
 * Conversación con el mentor (Hito 6A).
 *
 * Capa fina sobre el reductor puro `mentorThreadReducer`: aquí solo vive la
 * llamada HTTP y los avisos; las transiciones del hilo se prueban sin DOM.
 *
 * Mentor v4 conserva como máximo ocho turnos en la sesión del navegador. Cada
 * consulta sigue tratándolos como contexto no autoritativo; si cambian
 * personaje, build objetivo, presupuesto, objetivo, liga, parche o revisión
 * del diario, App descarta el hilo para no mostrar respuestas obsoletas.
 */

export type MentorAskOutcome =
  | { status: "ok"; answer: MentorAnswer }
  | { status: "journal-stale" }
  | { status: "error"; message: string };

export interface MentorState extends MentorThreadState {
  ask: (request: MentorQueryRequest) => Promise<MentorAskOutcome>;
  clear: () => void;
}

let turnCounter = 0;
function nextTurnId(prefix: string): string {
  turnCounter += 1;
  // El contador del módulo se reinicia con HMR mientras React conserva el
  // estado del hilo. Un UUID evita reutilizar claves de turnos ya visibles.
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${turnCounter}`;
  return `${prefix}-${unique}`;
}

export function useMentor(): MentorState {
  const [state, dispatch] = useReducer(
    mentorThreadReducer,
    initialMentorThreadState,
    () => {
      if (typeof window === "undefined") return initialMentorThreadState;
      return restoreMentorThread(window.sessionStorage.getItem(MENTOR_THREAD_STORAGE_KEY));
    },
  );

  useEffect(() => {
    const serialized = serializeMentorThread(state);
    if (serialized === null) {
      if (!state.loading) window.sessionStorage.removeItem(MENTOR_THREAD_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(MENTOR_THREAD_STORAGE_KEY, serialized);
  }, [state]);

  const clear = useCallback(() => {
    window.sessionStorage.removeItem(MENTOR_THREAD_STORAGE_KEY);
    dispatch({ type: "clear" });
  }, []);

  const ask = useCallback(async (request: MentorQueryRequest): Promise<MentorAskOutcome> => {
    const requestId = nextTurnId("request");
    dispatch({
      type: "ask",
      turnId: nextTurnId("player"),
      question: request.question,
      requestId,
    });

    try {
      const { answer } = await api.mentorQuery(request);
      dispatch({
        type: "answered",
        turnId: nextTurnId("mentor"),
        answer,
        inputsKey: mentorInputsKey(request),
        requestId,
      });
      return { status: "ok", answer };
    } catch (err) {
      const message = getErrorMessage(err);
      if (err instanceof ApiRequestError && err.status === 409) {
        // La memoria autoritativa cambió: el hilo entero (incluida la pregunta
        // recién fallada) se descarta ANTES de que el jugador pueda reintentar.
        dispatch({ type: "journal-stale", message, requestId });
        toast.warning("Tu diario cambió en otra pestaña", {
          description: "Hemos recargado el diario y reiniciado la conversación. Vuelve a preguntar.",
        });
        return { status: "journal-stale" };
      }
      dispatch({ type: "failed", message, requestId });
      toast.error("No se pudo consultar al mentor", { description: message });
      return { status: "error", message };
    }
  }, []);

  return { ...state, ask, clear };
}
