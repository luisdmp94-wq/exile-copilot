import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  mentorInputsKey,
  type MentorAnswer,
  type MentorQueryRequest,
} from "@shared/mentorQuery.js";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";

/**
 * Conversación con el mentor (Hito 6A).
 *
 * LIMITACIÓN DELIBERADA: el hilo vive SOLO en memoria de la interfaz. No se
 * persiste ni se envía al servidor como contexto. Si cambian los inputs
 * relevantes (personaje, build objetivo, presupuesto, objetivo, liga, parche o
 * revisión del diario) el hilo se descarta para no mostrar respuestas
 * obsoletas.
 */

export type MentorTurnRole = "player" | "mentor";

export interface MentorTurn {
  id: string;
  role: MentorTurnRole;
  /** Texto tal cual: la interfaz lo pinta como TEXTO, nunca como HTML. */
  text: string;
  /** Respuesta estructurada del mentor; null en los turnos del jugador. */
  answer: MentorAnswer | null;
}

export type MentorAskOutcome = "ok" | "journal-stale" | "error";

export interface MentorState {
  turns: MentorTurn[];
  loading: boolean;
  error: string | null;
  /** Inputs con los que se abrió el hilo; si cambian, se invalida. */
  threadInputsKey: string | null;
  ask: (request: MentorQueryRequest) => Promise<MentorAskOutcome>;
  clear: () => void;
}

let turnCounter = 0;
function nextTurnId(prefix: string): string {
  turnCounter += 1;
  return `${prefix}-${turnCounter}`;
}

export function useMentor(): MentorState {
  const [turns, setTurns] = useState<MentorTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadInputsKey, setThreadInputsKey] = useState<string | null>(null);

  const clear = useCallback(() => {
    setTurns([]);
    setError(null);
    setThreadInputsKey(null);
  }, []);

  const ask = useCallback(async (request: MentorQueryRequest): Promise<MentorAskOutcome> => {
    setLoading(true);
    setError(null);
    setTurns((prev) => [
      ...prev,
      { id: nextTurnId("player"), role: "player", text: request.question, answer: null },
    ]);

    try {
      const { answer } = await api.mentorQuery(request);
      setTurns((prev) => [
        ...prev,
        { id: nextTurnId("mentor"), role: "mentor", text: answer.answer, answer },
      ]);
      setThreadInputsKey(mentorInputsKey(request));
      return "ok";
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      if (err instanceof ApiRequestError && err.status === 409) {
        toast.warning("Tu diario cambió en otra pestaña", {
          description: "Recarga el diario y vuelve a preguntar al mentor.",
        });
        return "journal-stale";
      }
      toast.error("No se pudo consultar al mentor", { description: message });
      return "error";
    } finally {
      setLoading(false);
    }
  }, []);

  return { turns, loading, error, threadInputsKey, ask, clear };
}
