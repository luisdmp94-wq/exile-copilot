import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PLACEHOLDER_CHARACTER_LEVEL, type CharacterProfile, type Item } from "@shared/domain.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import type { PlanResolution } from "@shared/passiveRegistry.js";
import { api, getErrorMessage } from "@/lib/api";

export type CharacterOrigin = "empty" | "demo" | "imported" | "manual";
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
  startManual: (defaults: { league: string; patch: string }) => void;
  importBuild: (content: string) => Promise<void>;
  importItemText: (text: string) => Promise<Item | null>;
  updateProfile: (patch: Partial<CharacterProfile>) => void;
  mutateProfile: (updater: (profile: CharacterProfile) => CharacterProfile) => void;
  /** Sustituye el snapshot de un objeto y persiste el expediente en una sola operación. */
  replaceItemAndSave: (originalItemId: string, resultItem: Item) => Promise<boolean>;
  saveCorrections: () => Promise<boolean>;
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

function standaloneItemProfile(item: Item): CharacterProfile {
  const now = new Date().toISOString();
  return {
    id: `standalone-item-${Date.now()}`,
    name: "Objeto suelto",
    characterClass: "Desconocida",
    ascendancy: null,
    ascendancyId: null,
    level: PLACEHOLDER_CHARACTER_LEVEL,
    levelSource: "placeholder",
    archetype: null,
    league: "Desconocida",
    patch: "Desconocido",
    items: [item],
    skills: [],
    passives: { allocated: [] },
    attributes: { str: null, dex: null, int: null },
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    sources: [],
    importedAt: now,
  };
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

  const startManual = useCallback((defaults: { league: string; patch: string }) => {
    const now = new Date().toISOString();
    setProfile({
      id: `manual-${Date.now()}`,
      name: "Nuevo personaje",
      characterClass: "Desconocida",
      ascendancy: null,
      ascendancyId: null,
      // Mínimo técnico, NO un personaje de nivel 1: el jugador todavía no ha
      // declarado su nivel. La procedencia impide que Crafting lo compare.
      level: PLACEHOLDER_CHARACTER_LEVEL,
      levelSource: "placeholder",
      archetype: null,
      league: defaults.league || "Desconocida",
      patch: defaults.patch || "Desconocido",
      items: [],
      skills: [],
      passives: { allocated: [] },
      attributes: { str: null, dex: null, int: null },
      resistances: { fire: null, cold: null, lightning: null, chaos: null },
      sources: [],
      importedAt: now,
    });
    setWarnings([]);
    setOrigin("manual");
    setDirty(true);
    setPersisted(false);
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
      const importingStandaloneItem = profile === null;
      setBusy("item");
      try {
        const res = await api.importItemText({ text });
        const item: Item = res.item;
        setProfile((prev) => {
          if (!prev) return standaloneItemProfile(item);
          const exists = prev.items.some((it) => it.id === item.id);
          const items = exists
            ? prev.items.map((it) => (it.id === item.id ? item : it))
            : [...prev.items, item];
          return { ...prev, items };
        });
        if (importingStandaloneItem) {
          setOrigin("manual");
          setPersisted(false);
        }
        setWarnings(res.warnings);
        setDirty(true);
        if (res.warnings.length > 0) {
          toast.warning(`Objeto analizado con avisos: ${item.name}`, {
            description: res.warnings[0],
          });
        } else {
          toast.success(`Objeto añadido: ${item.name}`);
        }
        return item;
      } catch (err) {
        toast.error("No se pudo analizar el objeto", {
          description: getErrorMessage(err),
        });
        return null;
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
    if (!profile) return false;
    setBusy("save");
    try {
      const res = await api.saveCharacter(profile);
      setProfile(res.profile);
      persistId(res.profile.id);
      setDirty(false);
      setPersisted(true);
      toast.success("Correcciones guardadas");
      return true;
    } catch (err) {
      toast.error("No se pudieron guardar las correcciones", {
        description: getErrorMessage(err),
      });
      return false;
    } finally {
      setBusy(null);
    }
  }, [profile, persistId]);

  const replaceItemAndSave = useCallback(
    async (originalItemId: string, resultItem: Item): Promise<boolean> => {
      if (!profile) return false;
      const original = profile.items.find((item) => item.id === originalItemId);
      if (!original) {
        toast.error("El objeto original ya no está en el expediente");
        return false;
      }
      const replacement: Item = {
        ...resultItem,
        // La identidad local y el hueco pertenecen al objeto seguido. El texto
        // importado trae un id aleatorio y la inferencia de slot puede ser
        // incompleta; ninguno debe romper el vínculo del expediente.
        id: original.id,
        slot: original.slot,
      };
      const nextProfile: CharacterProfile = {
        ...profile,
        items: profile.items.map((item) =>
          item.id === originalItemId ? replacement : item,
        ),
      };
      setBusy("save");
      try {
        const res = await api.saveCharacter(nextProfile);
        setProfile(res.profile);
        persistId(res.profile.id);
        setWarnings([]);
        setDirty(false);
        setPersisted(true);
        toast.success(`Objeto actualizado: ${replacement.name}`);
        return true;
      } catch (err) {
        toast.error("No se pudo actualizar el expediente; la sesión sigue abierta", {
          description: getErrorMessage(err),
        });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [profile, persistId],
  );

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
    startManual,
    importBuild,
    importItemText,
    updateProfile,
    mutateProfile,
    replaceItemAndSave,
    saveCorrections,
    reset,
  };
}
