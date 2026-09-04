import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import {
  mentorInputsKey,
  type MentorAnswer,
  type MentorQueryRequest,
} from "@shared/mentorQuery.js";
import { MAX_PERSISTED_MENTOR_TURNS } from "@shared/mentorThreadPersistence.js";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import {
  initialMentorThreadState,
  MENTOR_THREAD_STORAGE_KEY,
  mentorThreadReducer,
  restoreMentorThread,
  serializeMentorThread,
  type MentorThreadState,
  type MentorTurn,
} from "@/lib/mentorThread";

export type { MentorTurn, MentorTurnRole } from "@/lib/mentorThread";

/**
 * Conversación con el mentor (Hito 6A).
 *
 * Capa fina sobre el reductor puro `mentorThreadReducer`: aquí solo vive la
 * llamada HTTP y los avisos; las transiciones del hilo se prueban sin DOM.
 *
 * Mentor v4 conserva como máximo ocho turnos en la sesión anónima del personaje.
 * Cada consulta sigue tratándolos como contexto no autoritativo; si cambian
 * personaje, build objetivo, presupuesto, objetivo, liga, parche o revisión
 * del diario, App descarta el hilo para no mostrar respuestas obsoletas.
 */

export type MentorAskOutcome =
  | { status: "ok"; answer: MentorAnswer }
  | { status: "journal-stale" }
  | { status: "error"; message: string };

export interface MentorState extends MentorThreadState {
  ask: (
    request: MentorQueryRequest,
    options?: { persist?: boolean },
  ) => Promise<MentorAskOutcome>;
  hydrate: (characterId: string, inputsKey: string) => Promise<void>;
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
  const stateRef = useRef(state);
  const activeRequestRef = useRef<string | null>(null);
  const persistenceContextRef = useRef<{
    characterId: string;
    inputsKey: string;
  } | null>(null);
  const hydrationSequenceRef = useRef(0);
  const hydratedContextRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const serialized = serializeMentorThread(state);
    if (serialized === null) {
      if (!state.loading) window.sessionStorage.removeItem(MENTOR_THREAD_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(MENTOR_THREAD_STORAGE_KEY, serialized);
  }, [state]);

  const clear = useCallback(() => {
    hydrationSequenceRef.current += 1;
    activeRequestRef.current = null;
    hydratedContextRef.current = null;
    const context = persistenceContextRef.current;
    persistenceContextRef.current = null;
    window.sessionStorage.removeItem(MENTOR_THREAD_STORAGE_KEY);
    dispatch({ type: "clear" });
    if (context !== null) {
      void api.deleteMentorThread(context.characterId).catch(() => {
        // El hilo local ya se retiró. El servidor invalidará cualquier copia
        // obsoleta al comparar la huella en la próxima recuperación.
      });
    }
  }, []);

  const hydrate = useCallback(async (characterId: string, inputsKey: string) => {
    const contextId = `${characterId}\u0000${inputsKey}`;
    persistenceContextRef.current = { characterId, inputsKey };

    const current = stateRef.current;
    if (
      current.turns.length > 0 &&
      current.threadInputsKey === inputsKey
    ) {
      hydratedContextRef.current = contextId;
      return;
    }
    if (current.loading || hydratedContextRef.current === contextId) return;

    hydratedContextRef.current = contextId;
    hydrationSequenceRef.current += 1;
    const sequence = hydrationSequenceRef.current;
    try {
      const { thread } = await api.restoreMentorThread(characterId, {
        threadInputsKey: inputsKey,
      });
      const context = persistenceContextRef.current;
      if (
        sequence !== hydrationSequenceRef.current ||
        context?.characterId !== characterId ||
        context.inputsKey !== inputsKey ||
        activeRequestRef.current !== null
      ) return;
      if (thread !== null) {
        dispatch({ type: "hydrate", turns: thread.turns, inputsKey });
      }
    } catch {
      if (sequence === hydrationSequenceRef.current) {
        hydratedContextRef.current = null;
      }
      // La conversación sigue disponible en esta pestaña. Un fallo de memoria
      // remota no bloquea el Mentor ni borra una respuesta visible.
    }
  }, []);

  const ask = useCallback(async (
    request: MentorQueryRequest,
    options?: { persist?: boolean },
  ): Promise<MentorAskOutcome> => {
    const requestId = nextTurnId("request");
    const playerTurn: MentorTurn = {
      id: nextTurnId("player"),
      role: "player",
      text: request.question,
      answer: null,
    };
    const baseTurns = stateRef.current.turns;
    activeRequestRef.current = requestId;
    dispatch({
      type: "ask",
      turnId: playerTurn.id,
      question: request.question,
      requestId,
    });

    try {
      const { answer } = await api.mentorQuery(request);
      if (activeRequestRef.current !== requestId) {
        return { status: "error", message: "La consulta fue sustituida por otra más reciente." };
      }
      const mentorTurn: MentorTurn = {
        id: nextTurnId("mentor"),
        role: "mentor",
        text: answer.answer,
        answer,
      };
      const inputsKey = mentorInputsKey(request);
      activeRequestRef.current = null;
      dispatch({
        type: "answered",
        turnId: mentorTurn.id,
        answer,
        inputsKey,
        requestId,
      });
      const turns = [...baseTurns, playerTurn, mentorTurn].slice(
        -MAX_PERSISTED_MENTOR_TURNS,
      );
      if (options?.persist !== false) {
        persistenceContextRef.current = {
          characterId: request.profile.id,
          inputsKey,
        };
        hydratedContextRef.current = `${request.profile.id}\u0000${inputsKey}`;
        void api.saveMentorThread(request.profile.id, {
          threadInputsKey: inputsKey,
          turns,
        }).catch(() => {
          toast.warning("La respuesta está visible, pero no se pudo guardar el hilo", {
            description: "Podrás seguir usándolo en esta pestaña; al recargar podría perderse.",
          });
        });
      }
      return { status: "ok", answer };
    } catch (err) {
      if (activeRequestRef.current === requestId) activeRequestRef.current = null;
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

  return { ...state, ask, hydrate, clear };
}
