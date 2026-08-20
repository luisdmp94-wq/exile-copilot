import type { MentorAnswer } from "@shared/mentorQuery.js";

/**
 * Estado del hilo conversacional del mentor (Hito 6A), como reductor PURO.
 *
 * Vive aparte del hook (`src/hooks/useMentor.ts`) por dos motivos:
 *  - las transiciones delicadas (sobre todo la recuperación tras un 409 por
 *    memoria del diario obsoleta) se pueden probar sin navegador ni DOM;
 *  - el hook queda como una capa fina sobre este reductor.
 *
 * El hilo NO se persiste: vive en memoria de la interfaz.
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

export interface MentorThreadState {
  turns: MentorTurn[];
  loading: boolean;
  error: string | null;
  /** Inputs con los que se abrió el hilo; si cambian, se invalida. */
  threadInputsKey: string | null;
}

export const initialMentorThreadState: MentorThreadState = {
  turns: [],
  loading: false,
  error: null,
  threadInputsKey: null,
};

export type MentorThreadEvent =
  /** El jugador envía una pregunta: se pinta su turno y arranca la espera. */
  | { type: "ask"; turnId: string; question: string }
  /** Respuesta correcta del servidor. */
  | { type: "answered"; turnId: string; answer: MentorAnswer; inputsKey: string }
  /** 409 `memoria-diario-obsoleta`: el diario cambió bajo nuestros pies. */
  | { type: "journal-stale"; message: string }
  /** Cualquier otro fallo: la pregunta que acaba de fallar no se conserva. */
  | { type: "failed"; message: string }
  /** Invalidación por cambio de inputs relevantes. */
  | { type: "clear" };

/** Retira el último turno si es una pregunta del jugador sin respuesta. */
function dropTrailingPlayerTurn(turns: MentorTurn[]): MentorTurn[] {
  const last = turns[turns.length - 1];
  if (last === undefined || last.role !== "player") return turns;
  return turns.slice(0, -1);
}

export function mentorThreadReducer(
  state: MentorThreadState,
  event: MentorThreadEvent,
): MentorThreadState {
  switch (event.type) {
    case "ask":
      return {
        ...state,
        loading: true,
        error: null,
        turns: [
          ...state.turns,
          { id: event.turnId, role: "player", text: event.question, answer: null },
        ],
      };

    case "answered":
      return {
        ...state,
        loading: false,
        error: null,
        threadInputsKey: event.inputsKey,
        turns: [
          ...state.turns,
          { id: event.turnId, role: "mentor", text: event.answer.answer, answer: event.answer },
        ],
      };

    case "journal-stale":
      // El diario autoritativo cambió: TODO el hilo quedó obsoleto, incluida la
      // pregunta que acaba de fallar. Se reinicia limpiamente y solo queda el
      // aviso, de modo que al recargar el diario el jugador pueda reintentar
      // sin pregunta duplicada, sin respuesta antigua y sin una acción
      // guardable que ya no corresponde a la memoria del servidor.
      return { turns: [], loading: false, error: event.message, threadInputsKey: null };

    case "failed":
      // La pregunta no llegó a responderse: se retira el turno del jugador que
      // acaba de fallar para no dejarlo huérfano y duplicado al reintentar.
      return {
        ...state,
        loading: false,
        error: event.message,
        turns: dropTrailingPlayerTurn(state.turns),
      };

    case "clear":
      return { ...initialMentorThreadState, loading: state.loading };
  }
}

/**
 * Última respuesta del mentor del hilo: es la única cuya próxima acción puede
 * ofrecerse para guardar en el diario. Con el hilo vacío no hay ninguna.
 */
export function lastMentorAnswer(turns: MentorTurn[]): MentorAnswer | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const answer = turns[i].answer;
    if (answer !== null) return answer;
  }
  return null;
}

/**
 * Próxima acción guardable del hilo, o null. Devuelve null también cuando la
 * acción se RECUERDA del diario (ya está registrada) o no hay acción.
 */
export function savableNextAction(turns: MentorTurn[]): MentorAnswer | null {
  const answer = lastMentorAnswer(turns);
  if (answer === null || answer.nextAction === null) return null;
  return answer.nextAction.canSaveToJournal ? answer : null;
}
