import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AddSessionConstraintRequest,
  AddSessionEvidenceRequest,
  CreateJournalEntryRequest,
  PauseSessionRequest,
  RecordSessionResultRequest,
  ReconcileSessionRequest,
  ReopenSessionRequest,
  StartDecisionSessionRequest,
  UpdateJournalEntryRequest,
} from "@shared/api.js";
import type { JournalEntry } from "@shared/domain.js";
import type { JournalResponse } from "@shared/api.js";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";

export interface JournalState {
  journal: JournalResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  stale: boolean;
  createEntry: (input: CreateJournalEntryRequest) => Promise<JournalEntry | null>;
  updateEntry: (
    entryId: string,
    input: UpdateJournalEntryRequest,
  ) => Promise<JournalEntry | null>;
  startSession: (input: StartDecisionSessionRequest) => Promise<JournalResponse | null>;
  addConstraint: (input: AddSessionConstraintRequest) => Promise<JournalResponse | null>;
  addEvidence: (input: AddSessionEvidenceRequest) => Promise<JournalResponse | null>;
  recordResult: (input: RecordSessionResultRequest) => Promise<JournalResponse | null>;
  pauseSession: (input: PauseSessionRequest) => Promise<JournalResponse | null>;
  reopenSession: (input: ReopenSessionRequest) => Promise<JournalResponse | null>;
  reconcileSession: (input: ReconcileSessionRequest) => Promise<JournalResponse | null>;
  reload: () => Promise<void>;
  clearStale: () => void;
}

function isStaleError(err: unknown): boolean {
  return (
    err instanceof ApiRequestError &&
    err.status === 409 &&
    err.message === "memoria-diario-obsoleta"
  );
}

export function useJournal(characterId: string | null): JournalState {
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (characterId === null) {
      setJournal(null);
      setError(null);
      setStale(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setJournal(await api.journal(characterId));
      setStale(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    let cancelled = false;
    if (characterId === null) {
      setJournal(null);
      setError(null);
      setStale(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .journal(characterId)
      .then((value) => {
        if (!cancelled) {
          setJournal(value);
          setStale(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const handleStale = useCallback(
    async (err: unknown, fallbackMessage: string) => {
      if (isStaleError(err)) {
        setStale(true);
        setJournal((previous) =>
          previous
            ? { ...previous, primaryEntry: null, primaryEntryId: null }
            : previous,
        );
        toast.info("La memoria del mentor cambió; la estamos recargando");
        await load();
        return true;
      }
      const message = getErrorMessage(err);
      setError(message);
      toast.error(fallbackMessage, { description: message });
      return false;
    },
    [load],
  );

  const createEntry = useCallback(
    async (input: CreateJournalEntryRequest): Promise<JournalEntry | null> => {
      if (characterId === null) return null;
      setSaving(true);
      setError(null);
      try {
        const response = await api.createJournalEntry(characterId, input);
        setJournal(response.journal);
        toast.success(
          input.makePrimary ? "Próxima acción guardada" : "Entrada guardada en el diario",
        );
        return response.entry;
      } catch (err) {
        await handleStale(err, "No se pudo guardar en el diario");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [characterId, handleStale],
  );

  const updateEntry = useCallback(
    async (
      entryId: string,
      input: UpdateJournalEntryRequest,
    ): Promise<JournalEntry | null> => {
      if (characterId === null) return null;
      setSaving(true);
      setError(null);
      try {
        const response = await api.updateJournalEntry(characterId, entryId, input);
        setJournal(response.journal);
        return response.entry;
      } catch (err) {
        await handleStale(err, "No se pudo actualizar el diario");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [characterId, handleStale],
  );

  const runSession = useCallback(
    async (
      action: () => Promise<JournalResponse>,
      success: string,
    ): Promise<JournalResponse | null> => {
      if (characterId === null) return null;
      setSaving(true);
      setError(null);
      try {
        const next = await action();
        setJournal(next);
        toast.success(success);
        return next;
      } catch (err) {
        await handleStale(err, "No se pudo actualizar la decisión");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [characterId, handleStale],
  );

  return {
    journal,
    loading,
    saving,
    error,
    stale,
    createEntry,
    updateEntry,
    startSession: (input) =>
      runSession(
        () => api.startDecisionSession(characterId!, input),
        "Empezamos a comprobar esta decisión",
      ),
    addConstraint: (input) =>
      runSession(
        () => api.addSessionConstraint(characterId!, input),
        "Pieza protegida añadida",
      ),
    addEvidence: (input) =>
      runSession(
        () => api.addSessionEvidence(characterId!, input),
        "Evidencia guardada",
      ),
    recordResult: (input) =>
      runSession(
        () => api.recordSessionResult(characterId!, input),
        "Resultado guardado",
      ),
    pauseSession: (input) =>
      runSession(() => api.pauseSession(characterId!, input), "Decisión en pausa"),
    reopenSession: (input) =>
      runSession(
        () => api.reopenSession(characterId!, input),
        "Vuelve a ser candidata a revisión",
      ),
    reconcileSession: (input) =>
      runSession(
        () => api.reconcileSession(characterId!, input),
        "Datos del personaje confirmados",
      ),
    reload: load,
    clearStale: () => setStale(false),
  };
}
