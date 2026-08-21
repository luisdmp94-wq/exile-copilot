import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { CharacterProfile, Item } from "@shared/domain.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import type { PlanResolution } from "@shared/passiveRegistry.js";
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
  /** true solo después de que este perfil exista realmente en el servidor. */
  persisted: boolean;
  loadDemo: () => Promise<void>;
  importBuild: (content: string) => Promise<void>;
  importItemText: (text: string) => Promise<void>;
  updateProfile: (patch: Partial<CharacterProfile>) => void;
  mutateProfile: (updater: (profile: CharacterProfile) => CharacterProfile) => void;
  saveCorrections: () => Promise<void>;
  /** Limpia el perfil actual y el id guardado en localStorage */
  reset: () => void;
}

export interface UseCharacterOptions {
  /**
   * Un `.build` oficial importado es un PLAN de build objetivo, no un personaje.
   * Se invoca con el plan crudo, sus warnings y la resolución de ids contra el
   * registro oficial (paralela al plan) para que la sección «Build objetivo»
   * los recoja.
   */
  onPlanImported?: (
    plan: BuildTargetPlan,
    warnings: string[],
    resolution: PlanResolution | null,
  ) => void;
}

/** Estado del perfil del personaje + acciones de importación, guardado y restauración. */
export function useCharacter(options?: UseCharacterOptions): CharacterState {
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [origin, setOrigin] = useState<CharacterOrigin>("empty");
  const [busy, setBusy] = useState<CharacterBusy>(null);
  const [restoring, setRestoring] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) !== null,
  );
  const [dirty, setDirty] = useState(false);
  const [persisted, setPersisted] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== null,
  );

  // Restaura el último personaje guardado tras recargar la página.
  // Idempotente bajo StrictMode (doble montaje): la limpieza cancela la primera
  // petición y la segunda completa el ciclo; nunca hay setState tras abortar.
  useEffect(() => {
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
        setPersisted(true);
        toast.success(`Personaje restaurado: ${res.profile.name}`);
      })
      .catch(() => {
        // Fallback silencioso: el id guardado ya no existe (404) o el servidor no responde.
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        setPersisted(false);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // El id SOLO se guarda tras un POST /api/character exitoso (perfil
  // realmente persistido en el servidor). Demo e importación no persisten.
  const persistId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const loadDemo = useCallback(async () => {
    setBusy("demo");
    try {
      const res = await api.demoCharacter();
      setProfile(res.profile);
      setWarnings([]);
      setOrigin("demo");
      // Está cargado en memoria, pero todavía no existe en SQLite. Debe poder
      // guardarse aunque el jugador no cambie ningún campo manualmente.
      setDirty(true);
      setPersisted(false);
      toast.success(`Ejemplo cargado: ${res.profile.name}`);
    } catch (err) {
      toast.error("No se pudo cargar el ejemplo", { description: getErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  }, []);

  const importBuild = useCallback(
    async (content: string) => {
      setBusy("build");
      try {
        const res = await api.importBuild({ content });
        if (res.plan) {
          // `.build` oficial: es un PLAN de build objetivo, no el personaje.
          options?.onPlanImported?.(res.plan, res.warnings, res.resolution ?? null);
          toast.warning(
            "Archivo de plan importado como build objetivo — no es tu personaje actual",
            { description: res.warnings[0] },
          );
        } else if (res.profile) {
          setProfile(res.profile);
          setWarnings(res.warnings);
          setOrigin("imported");
          // Importar construye un perfil local; solo «Guardar correcciones» lo
          // convierte en el personaje persistente que usan diario y sesiones.
          setDirty(true);
          setPersisted(false);
          if (res.warnings.length > 0) {
            toast.warning(`Build importada con ${res.warnings.length} aviso(s)`, {
              description: res.warnings[0],
            });
          } else {
            toast.success(`Build importada: ${res.profile.name}`);
          }
        } else {
          setWarnings(res.warnings);
          toast.warning("No se pudo interpretar el contenido del archivo", {
            description: res.warnings[0],
          });
        }
      } catch (err) {
        toast.error("No se pudo importar la build", {
          description: getErrorMessage(err),
        });
      } finally {
        setBusy(null);
      }
    },
    [options],
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
      setPersisted(true);
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
    setPersisted(false);
    toast.info("Personaje descartado. Puedes empezar de nuevo.");
  }, []);

  return {
    profile,
    warnings,
    origin,
    busy,
    restoring,
    dirty,
    persisted,
    loadDemo,
    importBuild,
    importItemText,
    updateProfile,
    mutateProfile,
    saveCorrections,
    reset,
  };
}
