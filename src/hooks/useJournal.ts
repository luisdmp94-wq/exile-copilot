import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AddSessionConstraintRequest,
  AbandonSessionRequest,
  ReleaseSessionConstraintRequest,
  AddSessionEvidenceRequest,
  CreateJournalEntryRequest,
  PauseSessionRequest,
  RecordSessionResultRequest,
  ReconcileSessionRequest,
  ReopenSessionRequest,
  StartDecisionSessionRequest,
  UpdateJournalEntryRequest,
  CreateBuildMemoryEntryRequest,
  UpdateBuildMemoryEntryRequest,
} from "@shared/api.js";
import type { BuildMemoryEntry, JournalEntry } from "@shared/domain.js";
import type { JournalResponse } from "@shared/api.js";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import { pageLang, texts } from "@/i18n/lang";
/** Avisos del diario, en el idioma que muestra la página. */
const TEXT = texts(
  {
    memoryChanged: "La memoria del mentor cambió; la estamos recargando",
    nextActionSaved: "Próxima acción guardada",
    entrySaved: "Entrada guardada en el diario",
    saveError: "No se pudo guardar en el diario",
    ruleSaved: "Regla de build guardada",
    ruleSaveError: "No se pudo guardar la regla de build",
    ruleArchived: "Regla archivada",
    ruleUpdated: "Regla actualizada",
    ruleUpdateError: "No se pudo actualizar la regla de build",
    decisionError: "No se pudo actualizar la decisión",
  },
  {
    memoryChanged: "The mentor's memory changed; reloading it",
    nextActionSaved: "Next action saved",
    entrySaved: "Entry saved in the journal",
    saveError: "Couldn't save to the journal",
    ruleSaved: "Build rule saved",
    ruleSaveError: "Couldn't save the build rule",
    ruleArchived: "Rule archived",
    ruleUpdated: "Rule updated",
    ruleUpdateError: "Couldn't update the build rule",
    decisionError: "Couldn't update the decision",
  },
);
const tx = () => TEXT[pageLang()];


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
  createBuildMemoryEntry: (
    input: CreateBuildMemoryEntryRequest,
  ) => Promise<BuildMemoryEntry | null>;
  updateBuildMemoryEntry: (
    entryId: string,
    input: UpdateBuildMemoryEntryRequest,
  ) => Promise<BuildMemoryEntry | null>;
  startSession: (input: StartDecisionSessionRequest) => Promise<JournalResponse | null>;
  addConstraint: (input: AddSessionConstraintRequest) => Promise<JournalResponse | null>;
  releaseConstraint: (
    input: ReleaseSessionConstraintRequest,
  ) => Promise<JournalResponse | null>;
  addEvidence: (input: AddSessionEvidenceRequest) => Promise<JournalResponse | null>;
  recordResult: (input: RecordSessionResultRequest) => Promise<JournalResponse | null>;
  pauseSession: (input: PauseSessionRequest) => Promise<JournalResponse | null>;
  abandonSession: (input: AbandonSessionRequest) => Promise<JournalResponse | null>;
  reopenSession: (input: ReopenSessionRequest) => Promise<JournalResponse | null>;
  reconcileSession: (input: ReconcileSessionRequest) => Promise<JournalResponse | null>;
  reload: () => Promise<JournalResponse | null>;
  clearStale: () => void;
}

function isStaleError(err: unknown): boolean {
  return (
    err instanceof ApiRequestError &&
    err.status === 409 &&
    err.message === "memoria-diario-obsoleta"
  );
}

export function useJournal(characterId: string | null, autoLoad = true): JournalState {
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async (): Promise<JournalResponse | null> => {
    if (characterId === null) {
      setJournal(null);
      setError(null);
      setStale(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await api.journal(characterId);
      setJournal(next);
      setStale(false);
      return next;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (characterId === null || !autoLoad) {
        setJournal(null);
        setLoading(false);
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
    });
    return () => {
      cancelled = true;
    };
  }, [autoLoad, characterId]);

  const handleStale = useCallback(
    async (err: unknown, fallbackMessage: string) => {
      if (isStaleError(err)) {
        setStale(true);
        setJournal((previous) =>
          previous
            ? { ...previous, primaryEntry: null, primaryEntryId: null }
            : previous,
        );
        toast.info(tx().memoryChanged);
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
          input.makePrimary ? tx().nextActionSaved : tx().entrySaved,
        );
        return response.entry;
      } catch (err) {
        await handleStale(err, tx().saveError);
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

  const createBuildMemoryEntry = useCallback(
    async (
      input: CreateBuildMemoryEntryRequest,
    ): Promise<BuildMemoryEntry | null> => {
      if (characterId === null) return null;
      setSaving(true);
      setError(null);
      try {
        const response = await api.createBuildMemoryEntry(characterId, input);
        setJournal(response.journal);
        toast.success(tx().ruleSaved);
        return response.entry;
      } catch (err) {
        await handleStale(err, tx().ruleSaveError);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [characterId, handleStale],
  );

  const updateBuildMemoryEntry = useCallback(
    async (
      entryId: string,
      input: UpdateBuildMemoryEntryRequest,
    ): Promise<BuildMemoryEntry | null> => {
      if (characterId === null) return null;
      setSaving(true);
      setError(null);
      try {
        const response = await api.updateBuildMemoryEntry(characterId, entryId, input);
        setJournal(response.journal);
        toast.success(input.active === false ? tx().ruleArchived : tx().ruleUpdated);
        return response.entry;
      } catch (err) {
        await handleStale(err, tx().ruleUpdateError);
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
        await handleStale(err, tx().decisionError);
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
    createBuildMemoryEntry,
    updateBuildMemoryEntry,
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
    releaseConstraint: (input) =>
      runSession(
        () => api.releaseSessionConstraint(characterId!, input),
        "Protección retirada",
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
    abandonSession: (input) =>
      runSession(() => api.abandonSession(characterId!, input), "Comprobación cerrada"),
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
