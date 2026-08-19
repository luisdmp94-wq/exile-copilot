import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CharacterProfile, Item } from "@shared/domain.js";
import { api, getErrorMessage } from "@/lib/api";

export type CharacterOrigin = "empty" | "demo" | "imported";
export type CharacterBusy = "demo" | "build" | "item" | "save" | null;

const STORAGE_KEY = "exile-copilot:characterId";

export interface CharacterState {
  profile: CharacterProfile | null;
  warnings: string[];
  origin: CharacterOrigin;
  busy: CharacterBusy;
  /** true mientras se intenta restaurar el personaje guardado tras recargar */
  restoring: boolean;
  /** true cuando hay correcciones locales sin guardar en el servidor */
  dirty: boolean;
  loadDemo: () => Promise<void>;
  importBuild: (content: string) => Promise<void>;
  importItemText: (text: string) => Promise<void>;
  updateProfile: (patch: Partial<CharacterProfile>) => void;
  mutateProfile: (updater: (profile: CharacterProfile) => CharacterProfile) => void;
  saveCorrections: () => Promise<void>;
  /** Limpia el perfil actual y el id guardado en localStorage */
  reset: () => void;
}

/** Estado del perfil del personaje + acciones de importación, guardado y restauración. */
export function useCharacter(): CharacterState {
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [origin, setOrigin] = useState<CharacterOrigin>("empty");
  const [busy, setBusy] = useState<CharacterBusy>(null);
  const [restoring, setRestoring] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) !== null,
  );
  const [dirty, setDirty] = useState(false);
  const restoreAttempted = useRef(false);

  // Restaura el último personaje guardado tras recargar la página.
  useEffect(() => {
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;
    let cancelled = false;
    api
      .getCharacter(savedId)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.profile);
        setOrigin("imported");
        setDirty(false);
        toast.success(`Personaje restaurado: ${res.profile.name}`);
      })
      .catch(() => {
        // Fallback silencioso: el id guardado ya no existe (404) o el servidor no responde.
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const loadDemo = useCallback(async () => {
    setBusy("demo");
    try {
      const res = await api.demoCharacter();
      setProfile(res.profile);
      persistId(res.profile.id);
      setWarnings([]);
      setOrigin("demo");
      setDirty(false);
      toast.success(`Ejemplo cargado: ${res.profile.name}`);
    } catch (err) {
      toast.error("No se pudo cargar el ejemplo", { description: getErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  }, [persistId]);

  const importBuild = useCallback(
    async (content: string) => {
      setBusy("build");
      try {
        const res = await api.importBuild({ content });
        setProfile(res.profile);
        persistId(res.profile.id);
        setWarnings(res.warnings);
        setOrigin("imported");
        setDirty(false);
        if (res.warnings.length > 0) {
          toast.warning(`Build importada con ${res.warnings.length} aviso(s)`, {
            description: res.warnings[0],
          });
        } else {
          toast.success(`Build importada: ${res.profile.name}`);
        }
      } catch (err) {
        toast.error("No se pudo importar la build", {
          description: getErrorMessage(err),
        });
      } finally {
        setBusy(null);
      }
    },
    [persistId],
  );

  const importItemText = useCallback(
    async (text: string) => {
      if (!profile) {
        toast.error("Primero importa o carga un personaje");
        return;
      }
      setBusy("item");
      try {
        const res = await api.importItemText({ text });
        const item: Item = res.item;
        setProfile((prev) => {
          if (!prev) return prev;
          const exists = prev.items.some((it) => it.id === item.id);
          const items = exists
            ? prev.items.map((it) => (it.id === item.id ? item : it))
            : [...prev.items, item];
          return { ...prev, items };
        });
        setWarnings(res.warnings);
        setDirty(true);
        if (res.warnings.length > 0) {
          toast.warning(`Objeto analizado con avisos: ${item.name}`, {
            description: res.warnings[0],
          });
        } else {
          toast.success(`Objeto añadido: ${item.name}`);
        }
      } catch (err) {
        toast.error("No se pudo analizar el objeto", {
          description: getErrorMessage(err),
        });
      } finally {
        setBusy(null);
      }
    },
    [profile],
  );

  const updateProfile = useCallback((patch: Partial<CharacterProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }, []);

  const mutateProfile = useCallback(
    (updater: (profile: CharacterProfile) => CharacterProfile) => {
      setProfile((prev) => (prev ? updater(prev) : prev));
      setDirty(true);
    },
    [],
  );

  const saveCorrections = useCallback(async () => {
    if (!profile) return;
    setBusy("save");
    try {
      const res = await api.saveCharacter(profile);
      setProfile(res.profile);
      persistId(res.profile.id);
      setDirty(false);
      toast.success("Correcciones guardadas");
    } catch (err) {
      toast.error("No se pudieron guardar las correcciones", {
        description: getErrorMessage(err),
      });
    } finally {
      setBusy(null);
    }
  }, [profile, persistId]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setWarnings([]);
    setOrigin("empty");
    setDirty(false);
    toast.info("Personaje descartado. Puedes empezar de nuevo.");
  }, []);

  return {
    profile,
    warnings,
    origin,
    busy,
    restoring,
    dirty,
    loadDemo,
    importBuild,
    importItemText,
    updateProfile,
    mutateProfile,
    saveCorrections,
    reset,
  };
}
