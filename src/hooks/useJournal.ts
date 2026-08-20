import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  CreateJournalEntryRequest,
  UpdateJournalEntryRequest,
} from "@shared/api.js";
import type { CharacterJournal, JournalEntry } from "@shared/domain.js";
import { api, getErrorMessage } from "@/lib/api";

export interface JournalState {
  journal: CharacterJournal | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  createEntry: (input: CreateJournalEntryRequest) => Promise<JournalEntry | null>;
  updateEntry: (
    entryId: string,
    input: UpdateJournalEntryRequest,
  ) => Promise<JournalEntry | null>;
  reload: () => Promise<void>;
}

export function useJournal(characterId: string | null): JournalState {
  const [journal, setJournal] = useState<CharacterJournal | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (characterId === null) {
      setJournal(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setJournal(await api.journal(characterId));
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
      return;
    }
    setLoading(true);
    setError(null);
    api
      .journal(characterId)
      .then((value) => {
        if (!cancelled) setJournal(value);
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
        const message = getErrorMessage(err);
        setError(message);
        toast.error("No se pudo guardar en el diario", { description: message });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [characterId],
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
        const message = getErrorMessage(err);
        setError(message);
        toast.error("No se pudo actualizar el diario", { description: message });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [characterId],
  );

  return {
    journal,
    loading,
    saving,
    error,
    createEntry,
    updateEntry,
    reload: load,
  };
}
