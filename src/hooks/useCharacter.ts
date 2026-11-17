import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PLACEHOLDER_CHARACTER_LEVEL, type CharacterProfile, type Item } from "@shared/domain.js";
import { assessCharacterReadiness } from "@shared/characterReadiness.js";
import {
  diagnoseCraftingItem,
  hasContradictoryAffixStructure,
} from "@shared/craftingDiagnosis.js";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import type { PlanResolution } from "@shared/passiveRegistry.js";
import type { SavedCharacterSummary } from "@shared/api.js";
import type { QuickCharacterInput } from "@/components/QuickCharacterDialog";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import {
  planImportedItemPlacement,
  replaceImportedItem,
} from "@/lib/importedItemPlacement";
import { isCraftingExampleProfile } from "@/lib/craftingSimulation";
import { pageLang, texts } from "@/i18n/lang";

/** Avisos del personaje. Se leen al momento, en el idioma que muestra la página. */
const TEXT = texts(
  {
    recovered: (name: string) => `Expediente recuperado: ${name}`,
    recoveredDetail: "El servidor conservaba tu personaje aunque faltara su referencia local.",
    listError: "No se pudieron cargar los expedientes anteriores",
    demoLoaded: (name: string) => `Ejemplo cargado: ${name}`,
    demoError: "No se pudo cargar el ejemplo",
    saved: (name: string) => `Personaje guardado: ${name}`,
    saveError: "No se pudo guardar el personaje",
    noteError: "No se pudo apuntar en tu personaje",
    planImported: "Archivo de plan importado como build objetivo — no es tu personaje actual",
    readNotSaved: "Se leyó el personaje, pero no se pudo guardar",
    stillInImporter: " El contenido sigue en el importador para que puedas reintentarlo.",
    importedSaved: (name: string) => `Personaje importado y guardado: ${name}`,
    otherVersion: "Personaje guardado, pero pertenece a otra versión",
    plannerFile: "Ese archivo .build es un plan, no una captura completa",
    draftSaved: (count: number) => `Borrador guardado: faltan ${count} dato(s)`,
    keepWhatItHas: (pending: string) =>
      `Conservamos lo que sí contiene. Completa ${pending} antes de pedir recomendaciones.`,
    unreadable: "No se pudo interpretar el contenido del archivo",
    importError: "No se pudo importar la build",
    slotTaken: "Ese hueco ya está ocupado",
    slotTakenDetail: "Elige qué pieza sustituir o conserva el objeto como extra.",
    itemNotSaved: "Se leyó el objeto, pero no se pudo guardar",
    textInImporter: " El texto sigue en el importador para que puedas reintentarlo.",
    itemWarnings: (name: string) => `Objeto analizado con avisos: ${name}`,
    itemAddedSaved: (name: string) => `Objeto añadido y guardado: ${name}`,
    itemAdded: (name: string) => `Objeto añadido: ${name}`,
    itemError: "No se pudo analizar el objeto",
    replacedGone: "La pieza que querías sustituir ya no está en el expediente",
    replacedSaved: (name: string) => `Pieza sustituida y guardada: ${name}`,
    extraSaved: (name: string) => `Objeto guardado como extra: ${name}`,
    pieceError: "No se pudo guardar la pieza; el importador sigue abierto",
    replaced: (name: string) => `Pieza sustituida: ${name}`,
    fixesSaved: "Correcciones guardadas",
    fixesError: "No se pudieron guardar las correcciones",
    originalGone: "El objeto original ya no está en el expediente",
    itemUpdated: (name: string) => `Objeto actualizado: ${name}`,
    updateError: "No se pudo actualizar el expediente; la sesión sigue abierta",
    setAside: "Expediente apartado. Puedes recuperarlo desde la bienvenida.",
    draftDiscarded: "Borrador descartado. Puedes empezar de nuevo.",
    restoreError: "No se pudo recuperar el expediente",
  },
  {
    recovered: (name: string) => `Character recovered: ${name}`,
    recoveredDetail: "The server still had your character even though this browser had lost track of it.",
    listError: "Couldn't load your previous characters",
    demoLoaded: (name: string) => `Example loaded: ${name}`,
    demoError: "Couldn't load the example",
    saved: (name: string) => `Character saved: ${name}`,
    saveError: "Couldn't save the character",
    noteError: "Couldn't write that on your character",
    planImported: "Plan file imported as your target build — it isn't your current character",
    readNotSaved: "The character was read, but couldn't be saved",
    stillInImporter: " The content is still in the importer so you can try again.",
    importedSaved: (name: string) => `Character imported and saved: ${name}`,
    otherVersion: "Character saved, but it belongs to another version",
    plannerFile: "That .build file is a plan, not a full snapshot",
    draftSaved: (count: number) => `Draft saved: ${count} detail(s) missing`,
    keepWhatItHas: (pending: string) =>
      `We kept what it does contain. Fill in ${pending} before asking for recommendations.`,
    unreadable: "Couldn't read the file's content",
    importError: "Couldn't import the build",
    slotTaken: "That slot is already taken",
    slotTakenDetail: "Choose which item to replace, or keep this one as an extra.",
    itemNotSaved: "The item was read, but couldn't be saved",
    textInImporter: " The text is still in the importer so you can try again.",
    itemWarnings: (name: string) => `Item read with warnings: ${name}`,
    itemAddedSaved: (name: string) => `Item added and saved: ${name}`,
    itemAdded: (name: string) => `Item added: ${name}`,
    itemError: "Couldn't read the item",
    replacedGone: "The item you wanted to replace is no longer on your character",
    replacedSaved: (name: string) => `Item replaced and saved: ${name}`,
    extraSaved: (name: string) => `Item saved as an extra: ${name}`,
    pieceError: "Couldn't save the item; the importer is still open",
    replaced: (name: string) => `Item replaced: ${name}`,
    fixesSaved: "Fixes saved",
    fixesError: "Couldn't save the fixes",
    originalGone: "The original item is no longer on your character",
    itemUpdated: (name: string) => `Item updated: ${name}`,
    updateError: "Couldn't update your character; the session is still open",
    setAside: "Character put aside. You can bring it back from the welcome screen.",
    draftDiscarded: "Draft discarded. You can start again.",
    restoreError: "Couldn't recover the character",
  },
);
const tx = () => TEXT[pageLang()];

export type CharacterOrigin = "empty" | "demo" | "imported" | "manual";
export type CharacterBusy = "demo" | "build" | "item" | "save" | "restore" | null;
export type CharacterImportOutcome =
  | "profile-ready"
  | "profile-incomplete"
  | "plan"
  | null;

export interface PendingItemImport {
  item: Item;
  candidates: Item[];
  warnings: string[];
  /** El importador de Crafting se cierra al terminar: debe guardar en el mismo gesto. */
  persistImmediately: boolean;
}

interface ItemImportOptions {
  persistImmediately?: boolean;
}

const STORAGE_KEY = "exile-copilot:characterId";
const PREVIOUS_STORAGE_KEY = "exile-copilot:previousCharacter";
const AUTO_RESTORE_SUPPRESSED_KEY = "exile-copilot:characterAutoRestoreSuppressed";

interface PreviousCharacter {
  id: string;
  name: string;
}

function readPreviousCharacter(): PreviousCharacter | null {
  const raw = localStorage.getItem(PREVIOUS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as PreviousCharacter).id === "string" &&
      typeof (value as PreviousCharacter).name === "string"
    ) {
      return value as PreviousCharacter;
    }
  } catch {
    // Un valor local corrupto no puede impedir abrir la aplicación.
  }
  localStorage.removeItem(PREVIOUS_STORAGE_KEY);
  return null;
}

export interface CharacterState {
  profile: CharacterProfile | null;
  warnings: string[];
  origin: CharacterOrigin;
  busy: CharacterBusy;
  /** true mientras se intenta restaurar el personaje guardado tras recargar */
  restoring: boolean;
  /** Error recuperable al consultar un expediente que podría seguir guardado. */
  restorationError: string | null;
  /** true cuando hay correcciones locales sin guardar en el servidor */
  dirty: boolean;
  /** true solo después de que este perfil exista realmente en el servidor. */
  persisted: boolean;
  previousCharacter: PreviousCharacter | null;
  savedCharacters: SavedCharacterSummary[];
  savedCharactersTotal: number;
  loadingSavedCharacters: boolean;
  pendingItemImport: PendingItemImport | null;
  loadDemo: () => Promise<void>;
  startManual: (defaults: { league: string; patch: string }) => void;
  /** Alta corta: crea y guarda un personaje con lo mínimo. Devuelve null si falla. */
  createQuick: (
    input: QuickCharacterInput,
    defaults: { league: string; patch: string },
  ) => Promise<CharacterProfile | null>;
  /** Apunta en el personaje cargado que esa habilidad ya lleva esa asistencia, y guarda. */
  rememberSupport: (skillName: string, supportName: string) => Promise<boolean>;
  /** Completa el personaje cargado con los datos del alta corta y lo guarda. */
  completeQuick: (input: QuickCharacterInput) => Promise<CharacterProfile | null>;
  importBuild: (
    content: string,
    patch: string,
    intent?: "character" | "target",
  ) => Promise<CharacterImportOutcome>;
  importItemText: (
    text: string,
    patch: string,
    options?: ItemImportOptions,
  ) => Promise<Item | null>;
  resolvePendingItemImport: (
    decision: { mode: "replace"; targetItemId: string } | { mode: "extra" },
  ) => Promise<Item | null>;
  cancelPendingItemImport: () => void;
  updateProfile: (patch: Partial<CharacterProfile>) => void;
  mutateProfile: (updater: (profile: CharacterProfile) => CharacterProfile) => void;
  /** Sustituye el snapshot de un objeto y persiste el expediente en una sola operación. */
  replaceItemAndSave: (originalItemId: string, resultItem: Item) => Promise<boolean>;
  saveCorrections: () => Promise<CharacterProfile | null>;
  /** Limpia el perfil actual y el id guardado en localStorage */
  reset: () => void;
  /** Recupera el último expediente apartado en este mismo navegador. */
  restorePrevious: () => Promise<boolean>;
  /** Abre uno de los expedientes que pertenecen a esta sesión anónima. */
  restoreCharacter: (characterId: string) => Promise<boolean>;
  /** Carga la siguiente página de resúmenes privados. */
  loadMoreSavedCharacters: () => Promise<void>;
  /** Reintenta la recuperación sin descartar ninguna referencia local. */
  retryRestore: () => void;
}

export interface UseCharacterOptions {
  /**
   * Se invoca únicamente cuando el usuario importó el `.build` desde la entrada
   * de objetivo. El alta de personaje recibe en cambio un perfil parcial.
   */
  onPlanImported?: (
    plan: BuildTargetPlan,
    warnings: string[],
    resolution: PlanResolution | null,
  ) => void;
}

function standaloneItemProfile(item: Item, patch: string): CharacterProfile {
  const now = new Date().toISOString();
  return {
    id: `standalone-item-${Date.now()}`,
    name: "Expediente provisional",
    characterClass: "Desconocida",
    ascendancy: null,
    ascendancyId: null,
    level: PLACEHOLDER_CHARACTER_LEVEL,
    levelSource: "placeholder",
    archetype: null,
    league: "Desconocida",
    patch,
    items: [item],
    skills: [],
    passives: { allocated: [] },
    attributes: { str: null, dex: null, int: null },
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    sources: [],
    importedAt: now,
  };
}

function normalizeStandaloneItemProfile(profile: CharacterProfile): CharacterProfile {
  if (profile.id.startsWith("standalone-item-") && profile.name === "Objeto suelto") {
    return { ...profile, name: "Expediente provisional" };
  }
  return profile;
}

/** Estado del perfil del personaje + acciones de importación, guardado y restauración. */
export function useCharacter(options?: UseCharacterOptions): CharacterState {
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [origin, setOrigin] = useState<CharacterOrigin>("empty");
  const [busy, setBusy] = useState<CharacterBusy>(null);
  // Incluso sin id local puede existir un expediente de esta cookie anónima.
  // La bienvenida espera a que termine esa comprobación para no parpadear ni
  // invitar a crear otro personaje mientras el anterior se está recuperando.
  const [restoring, setRestoring] = useState(true);
  const [restorationError, setRestorationError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [persisted, setPersisted] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== null,
  );
  const [previousCharacter, setPreviousCharacter] = useState<PreviousCharacter | null>(
    readPreviousCharacter,
  );
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterSummary[]>([]);
  const [savedCharactersTotal, setSavedCharactersTotal] = useState(0);
  const [loadingSavedCharacters, setLoadingSavedCharacters] = useState(true);
  const [pendingItemImport, setPendingItemImport] = useState<PendingItemImport | null>(null);
  const legacyRepairAttempts = useRef(new Set<string>());

  // Restaura el último personaje guardado tras recargar la página. Si se perdió
  // solo el id de localStorage, la cookie anónima permite redescubrir el perfil
  // más reciente. «Empezar de nuevo» deja una marca local para que esa ayuda no
  // deshaga una decisión intencionada del jugador.
  // Idempotente bajo StrictMode (doble montaje): la limpieza cancela la primera
  // petición y la segunda completa el ciclo; nunca hay setState tras abortar.
  useEffect(() => {
    let cancelled = false;

    const applyProfile = (restoredProfile: CharacterProfile, discovered: boolean): void => {
      if (cancelled) return;
      const restored = normalizeStandaloneItemProfile(restoredProfile);
      localStorage.setItem(STORAGE_KEY, restored.id);
      localStorage.removeItem(AUTO_RESTORE_SUPPRESSED_KEY);
      setProfile(restored);
      setOrigin(isCraftingExampleProfile(restored) ? "demo" : "imported");
      setDirty(false);
      setPersisted(true);
      if (discovered) {
        toast.success(tx().recovered(restored.name), {
          description: tx().recoveredDetail,
        });
      }
    };

    const restore = async (): Promise<void> => {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        try {
          const res = await api.getCharacter(savedId);
          applyProfile(res.profile, false);
          return;
        } catch (err) {
          if (cancelled) return;
          if (!(err instanceof ApiRequestError) || err.status !== 404) {
            // Una caída temporal no prueba que el perfil haya desaparecido.
            // Conservamos el id para poder reintentarlo en la próxima carga.
            setRestorationError(
              `${getErrorMessage(err)} Tu referencia local se ha conservado para reintentarlo.`,
            );
            return;
          }
          localStorage.removeItem(STORAGE_KEY);
          setPersisted(false);
        }
      }

      if (localStorage.getItem(AUTO_RESTORE_SUPPRESSED_KEY) !== null) return;

      try {
        const res = await api.recentCharacter();
        if (res.profile) applyProfile(res.profile, true);
      } catch (err) {
        if (cancelled) return;
        setRestorationError(getErrorMessage(err));
      }
    };

    void restore().finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  // El selector usa únicamente resúmenes paginados. Se carga aparte de la
  // restauración para que un fallo del índice no impida abrir el id conocido.
  useEffect(() => {
    let cancelled = false;
    void api
      .savedCharacters()
      .then((res) => {
        if (cancelled) return;
        setSavedCharacters(res.characters);
        setSavedCharactersTotal(res.total);
      })
      .catch(() => {
        // La restauración autoritativa conserva su propio error y reintento.
        // Un índice auxiliar caído no debe bloquear un expediente conocido.
      })
      .finally(() => {
        if (!cancelled) setLoadingSavedCharacters(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSavedCharacters = useCallback(async (): Promise<void> => {
    setLoadingSavedCharacters(true);
    try {
      const res = await api.savedCharacters();
      setSavedCharacters(res.characters);
      setSavedCharactersTotal(res.total);
    } finally {
      setLoadingSavedCharacters(false);
    }
  }, []);

  const loadMoreSavedCharacters = useCallback(async (): Promise<void> => {
    if (loadingSavedCharacters || savedCharacters.length >= savedCharactersTotal) return;
    setLoadingSavedCharacters(true);
    try {
      const res = await api.savedCharacters(savedCharacters.length);
      setSavedCharacters((current) => {
        const known = new Set(current.map((entry) => entry.id));
        return [...current, ...res.characters.filter((entry) => !known.has(entry.id))];
      });
      setSavedCharactersTotal(res.total);
    } catch (err) {
      toast.error(tx().listError, {
        description: getErrorMessage(err),
      });
    } finally {
      setLoadingSavedCharacters(false);
    }
  }, [loadingSavedCharacters, savedCharacters.length, savedCharactersTotal]);

  const retryRestore = useCallback(() => {
    setRestorationError(null);
    setRestoring(true);
    setRestoreAttempt((attempt) => attempt + 1);
  }, []);

  /**
   * HMR puede conservar en memoria un objeto interpretado por una versión
   * antigua aunque el servidor ya esté corregido. Reprocesamos solo snapshots
   * imposibles que aún conservan su tooltip; una copia parcial sigue bloqueada.
   */
  useEffect(() => {
    if (!profile) return;
    const candidate = profile.items.find(
      (item) => item.rawText?.trim() && hasContradictoryAffixStructure(item),
    );
    if (!candidate?.rawText) return;

    const attemptKey = `${candidate.id}:${candidate.rawText}`;
    if (legacyRepairAttempts.current.has(attemptKey)) return;
    legacyRepairAttempts.current.add(attemptKey);

    void api
      .importItemText({ text: candidate.rawText, patch: profile.patch })
      .then((result) => {
        if (
          hasContradictoryAffixStructure(result.item) ||
          diagnoseCraftingItem(result.item).state !== "complete"
        ) {
          return;
        }
        setProfile((current) => {
          if (!current) return current;
          const original = current.items.find((item) => item.id === candidate.id);
          if (!original || original.rawText !== candidate.rawText) return current;
          const repaired: Item = {
            ...result.item,
            id: original.id,
            slot: original.slot === "other" ? result.item.slot : original.slot,
            sources: original.sources.length > 0 ? original.sources : result.item.sources,
          };
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === original.id ? repaired : item,
            ),
          };
        });
        setDirty(true);
      })
      .catch(() => {
        // La reparación es oportunista. La pantalla conserva el bloqueo seguro
        // y el flujo manual si el servidor no está disponible.
      });
  }, [profile]);

  // El id SOLO se guarda tras un POST /api/character exitoso (perfil
  // realmente persistido en el servidor). La demo sigue siendo un borrador;
  // el alta importada ejecuta ese POST como parte de la misma operación.
  const persistId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    localStorage.removeItem(AUTO_RESTORE_SUPPRESSED_KEY);
  }, []);

  /** Conserva el expediente sustituido solo después de guardar el nuevo. */
  const rememberCurrentCharacter = useCallback(() => {
    if (!profile || !persisted) return;
    const previous = { id: profile.id, name: profile.name };
    localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify(previous));
    setPreviousCharacter(previous);
  }, [persisted, profile]);

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
      toast.success(tx().demoLoaded(res.profile.name));
    } catch (err) {
      toast.error(tx().demoError, { description: getErrorMessage(err) });
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

  const createQuick = useCallback(
    async (input: QuickCharacterInput, defaults: { league: string; patch: string }) => {
      const stamp = Date.now();
      const draft: CharacterProfile = {
        id: `manual-${stamp}`,
        name: input.name,
        characterClass: input.characterClass,
        ascendancy: null,
        ascendancyId: null,
        // Sin nivel declarado se guarda el mínimo técnico, marcado como tal.
        level: input.level ?? PLACEHOLDER_CHARACTER_LEVEL,
        levelSource: input.level === null ? "placeholder" : "observed",
        archetype: input.archetype || null,
        league: defaults.league || "Desconocida",
        patch: defaults.patch || "Desconocido",
        items: [],
        skills: input.skills.map((name, index) => ({
          id: `skill-${stamp}-${index}`,
          label: "",
          mainSkill: name,
          mainSkillGemId: null,
          supports: [],
        })),
        passives: { allocated: [] },
        attributes: { str: null, dex: null, int: null },
        resistances: { fire: null, cold: null, lightning: null, chaos: null },
        sources: [],
        importedAt: new Date(stamp).toISOString(),
      };
      setBusy("save");
      try {
        const res = await api.saveCharacter(draft);
        setProfile(res.profile);
        persistId(res.profile.id);
        setWarnings([]);
        setOrigin("manual");
        setDirty(false);
        setPersisted(true);
        void refreshSavedCharacters().catch(() => {
          // El guardado es autoritativo aunque el resumen no se refresque ahora.
        });
        toast.success(tx().saved(res.profile.name));
        return res.profile;
      } catch (err) {
        toast.error(tx().saveError, { description: getErrorMessage(err) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [persistId, refreshSavedCharacters],
  );

  const completeQuick = useCallback(
    async (input: QuickCharacterInput) => {
      if (!profile) return null;
      const stamp = Date.now();
      const wanted = input.skills.map((name) => name.trim()).filter(Boolean);
      const key = (name: string) => name.trim().toLocaleLowerCase("es");
      // Las habilidades que ya estaban conservan sus asistencias; las que el
      // jugador quitó se van y las nuevas entran sin asistencias.
      const existing = new Map(profile.skills.map((setup) => [key(setup.mainSkill), setup]));
      const merged: CharacterProfile = {
        ...profile,
        name: input.name,
        characterClass: input.characterClass,
        level: input.level ?? profile.level,
        levelSource: input.level === null ? profile.levelSource : "observed",
        archetype: input.archetype || profile.archetype,
        skills: wanted.map(
          (name, index) =>
            existing.get(key(name)) ?? {
              id: `skill-${stamp}-${index}`,
              label: "",
              mainSkill: name,
              mainSkillGemId: null,
              supports: [],
            },
        ),
      };
      setBusy("save");
      try {
        const res = await api.saveCharacter(merged);
        setProfile(res.profile);
        persistId(res.profile.id);
        setDirty(false);
        setPersisted(true);
        void refreshSavedCharacters().catch(() => {
          // El guardado es autoritativo aunque el resumen no se refresque ahora.
        });
        toast.success(tx().saved(res.profile.name));
        return res.profile;
      } catch (err) {
        toast.error(tx().saveError, { description: getErrorMessage(err) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [profile, persistId, refreshSavedCharacters],
  );

  const rememberSupport = useCallback(
    async (skillName: string, supportName: string) => {
      if (!profile) return false;
      const key = (value: string) => value.trim().toLocaleLowerCase("es");
      const support = { name: supportName.trim(), gemId: null };
      const found = profile.skills.find((setup) => key(setup.mainSkill) === key(skillName));
      if (found?.supports.some((item) => key(item.name) === key(supportName))) return true;
      const skills = found
        ? profile.skills.map((setup) => (setup === found ? { ...setup, supports: [...setup.supports, support] } : setup))
        : [
            ...profile.skills,
            { id: `skill-${Date.now()}`, label: "", mainSkill: skillName.trim(), mainSkillGemId: null, supports: [support] },
          ];
      try {
        const res = await api.saveCharacter({ ...profile, skills });
        setProfile(res.profile);
        persistId(res.profile.id);
        setDirty(false);
        setPersisted(true);
        return true;
      } catch (err) {
        toast.error(tx().noteError, { description: getErrorMessage(err) });
        return false;
      }
    },
    [profile, persistId],
  );

  const importBuild = useCallback(
    async (content: string, patch: string, intent: "character" | "target" = "target") => {
      setBusy("build");
      try {
        const res = await api.importBuild({ content, patch, intent });
        if (res.plan) {
          // Solo ocurre cuando la pantalla solicitó explícitamente un objetivo.
          options?.onPlanImported?.(res.plan, res.warnings, res.resolution ?? null);
          toast.warning(
            tx().planImported,
            { description: res.warnings[0] },
          );
          return "plan" as const;
        } else if (res.profile) {
          // El alta es una única operación para el jugador: si la lectura fue
          // válida, se persiste antes de cerrar el panel. Así un refresco no
          // convierte una importación aparentemente correcta en datos perdidos.
          let saved: CharacterProfile;
          try {
            const savedResponse = await api.saveCharacter(res.profile);
            saved = savedResponse.profile;
          } catch (saveError) {
            toast.error(tx().readNotSaved, {
              description: `${getErrorMessage(saveError)}${tx().stillInImporter}`,
            });
            return null;
          }

          rememberCurrentCharacter();
          setProfile(saved);
          setWarnings(res.warnings);
          setOrigin("imported");
          setDirty(false);
          setPersisted(true);
          persistId(saved.id);
          void refreshSavedCharacters().catch(() => {
            // El perfil ya está guardado; el índice se reintentará al recargar.
          });

          const readiness = assessCharacterReadiness(saved);
          const versionMismatch = res.warnings.find((warning) =>
            warning.startsWith("Incompatibilidad de versión"),
          );
          if (readiness.ready) {
            toast.success(tx().importedSaved(saved.name));
            return "profile-ready" as const;
          } else {
            const pending = readiness.issues
              .map((issue) => (pageLang() === "en" ? issue.labelEn : issue.label).toLowerCase())
              .join(", ");
            const isBuildPlanner = res.detectedFormat === "ggg-build-planner-v1";
            toast.warning(
              versionMismatch
                ? tx().otherVersion
                : isBuildPlanner
                ? tx().plannerFile
                : tx().draftSaved(readiness.issues.length),
              {
                description: versionMismatch ?? (pending
                    ? tx().keepWhatItHas(pending)
                    : undefined),
              },
            );
            return "profile-incomplete" as const;
          }
        } else {
          setWarnings(res.warnings);
          toast.warning(tx().unreadable, {
            description: res.warnings[0],
          });
          return null;
        }
      } catch (err) {
        toast.error(tx().importError, {
          description: getErrorMessage(err),
        });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [options, persistId, refreshSavedCharacters, rememberCurrentCharacter],
  );

  const importItemText = useCallback(
    async (text: string, patch: string, importOptions?: ItemImportOptions) => {
      // El ejemplo es una simulación efímera, no el expediente del jugador.
      // Si desde esa demo pega una pieza propia, la evidencia real debe abrir
      // un expediente independiente: nunca buscamos colisiones contra el
      // equipo ficticio ni heredamos su build, plan o resistencias.
      const importingStandaloneItem =
        profile === null ||
        origin === "demo" ||
        (profile !== null && isCraftingExampleProfile(profile));
      setBusy("item");
      try {
        const res = await api.importItemText({ text, patch });
        const item: Item = res.item;
        if (profile && !importingStandaloneItem) {
          const placement = planImportedItemPlacement(profile.items, item);
          if (placement.kind === "collision") {
            setPendingItemImport({
              item: placement.item,
              candidates: placement.candidates,
              warnings: res.warnings,
              persistImmediately: importOptions?.persistImmediately === true,
            });
            toast.info(tx().slotTaken, {
              description: tx().slotTakenDetail,
            });
            return null;
          }
          const nextProfile = { ...profile, items: [...profile.items, placement.item] };
          if (persisted && importOptions?.persistImmediately === true) {
            let saved: CharacterProfile;
            try {
              const savedResponse = await api.saveCharacter(nextProfile);
              saved = savedResponse.profile;
            } catch (saveError) {
              toast.error(tx().itemNotSaved, {
                description: `${getErrorMessage(saveError)}${tx().textInImporter}`,
              });
              return null;
            }

            setProfile(saved);
            setWarnings(res.warnings);
            setDirty(false);
            setPersisted(true);
            persistId(saved.id);
            void refreshSavedCharacters().catch(() => {
              // El expediente ya contiene la pieza; la lista es una vista auxiliar.
            });
            if (res.warnings.length > 0) {
              toast.warning(tx().itemWarnings(placement.item.name), {
                description: res.warnings[0],
              });
            } else {
              toast.success(tx().itemAddedSaved(placement.item.name));
            }
            return placement.item;
          }
          if (!persisted) {
            let saved: CharacterProfile;
            try {
              const savedResponse = await api.saveCharacter(nextProfile);
              saved = savedResponse.profile;
            } catch (saveError) {
              toast.error(tx().itemNotSaved, {
                description: `${getErrorMessage(saveError)}${tx().textInImporter}`,
              });
              return null;
            }

            rememberCurrentCharacter();
            setProfile(saved);
            setWarnings(res.warnings);
            setDirty(false);
            setPersisted(true);
            persistId(saved.id);
            void refreshSavedCharacters().catch(() => {
              // El borrador con la pieza ya está guardado; la lista es auxiliar.
            });
            if (res.warnings.length > 0) {
              toast.warning(tx().itemWarnings(placement.item.name), {
                description: res.warnings[0],
              });
            } else {
              toast.success(tx().itemAdded(placement.item.name));
            }
            return placement.item;
          }

          setProfile(nextProfile);
          setWarnings(res.warnings);
          setDirty(true);
          if (res.warnings.length > 0) {
            toast.warning(tx().itemWarnings(placement.item.name), {
              description: res.warnings[0],
            });
          } else {
            toast.success(tx().itemAdded(placement.item.name));
          }
          return placement.item;
        }

        if (importingStandaloneItem) {
          const draft = standaloneItemProfile(item, patch);
          let saved: CharacterProfile;
          try {
            const savedResponse = await api.saveCharacter(draft);
            saved = savedResponse.profile;
          } catch (saveError) {
            toast.error(tx().itemNotSaved, {
              description: `${getErrorMessage(saveError)}${tx().textInImporter}`,
            });
            return null;
          }

          rememberCurrentCharacter();
          setProfile(saved);
          setOrigin("manual");
          setDirty(false);
          setPersisted(true);
          persistId(saved.id);
          void refreshSavedCharacters().catch(() => {
            // El objeto ya está guardado; la lista es una vista auxiliar.
          });
        }
        setWarnings(res.warnings);
        if (!importingStandaloneItem) setDirty(true);
        if (res.warnings.length > 0) {
          toast.warning(tx().itemWarnings(item.name), {
            description: res.warnings[0],
          });
        } else {
          toast.success(tx().itemAdded(item.name));
        }
        return item;
      } catch (err) {
        toast.error(tx().itemError, {
          description: getErrorMessage(err),
        });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [origin, persistId, persisted, profile, refreshSavedCharacters, rememberCurrentCharacter],
  );

  const resolvePendingItemImport = useCallback(
    async (decision: { mode: "replace"; targetItemId: string } | { mode: "extra" }) => {
      if (!pendingItemImport || !profile) return null;

      let acceptedItem: Item;
      let nextItems: Item[];
      if (decision.mode === "replace") {
        const result = replaceImportedItem(
          profile.items,
          pendingItemImport.item,
          decision.targetItemId,
        );
        if (!result) {
          toast.error(tx().replacedGone);
          setPendingItemImport(null);
          return null;
        }
        acceptedItem = result.replacement;
        nextItems = result.items;
      } else {
        acceptedItem = pendingItemImport.item;
        nextItems = [...profile.items, acceptedItem];
      }

      const nextProfile = { ...profile, items: nextItems };
      if (pendingItemImport.persistImmediately) {
        setBusy("save");
        try {
          const savedResponse = await api.saveCharacter(nextProfile);
          setProfile(savedResponse.profile);
          setWarnings(pendingItemImport.warnings);
          setDirty(false);
          setPersisted(true);
          persistId(savedResponse.profile.id);
          setPendingItemImport(null);
          void refreshSavedCharacters().catch(() => {
            // La sustitución ya está guardada; la lista es una vista auxiliar.
          });
          toast.success(
            decision.mode === "replace"
              ? tx().replacedSaved(acceptedItem.name)
              : tx().extraSaved(acceptedItem.name),
          );
          return acceptedItem;
        } catch (err) {
          toast.error(tx().pieceError, {
            description: getErrorMessage(err),
          });
          return null;
        } finally {
          setBusy(null);
        }
      }

      setProfile(nextProfile);
      setWarnings(pendingItemImport.warnings);
      setDirty(true);
      setPendingItemImport(null);
      toast.success(
        decision.mode === "replace"
          ? tx().replaced(acceptedItem.name)
          : tx().extraSaved(acceptedItem.name),
      );
      return acceptedItem;
    },
    [pendingItemImport, persistId, profile, refreshSavedCharacters],
  );

  const cancelPendingItemImport = useCallback(() => {
    setPendingItemImport(null);
  }, []);

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
    if (!profile) return null;
    setBusy("save");
    try {
      const res = await api.saveCharacter(profile);
      setProfile(res.profile);
      persistId(res.profile.id);
      setDirty(false);
      setPersisted(true);
      void refreshSavedCharacters().catch(() => {
        // El guardado es autoritativo aunque el resumen no se refresque ahora.
      });
      toast.success(tx().fixesSaved);
      return res.profile;
    } catch (err) {
      toast.error(tx().fixesError, {
        description: getErrorMessage(err),
      });
      return null;
    } finally {
      setBusy(null);
    }
  }, [profile, persistId, refreshSavedCharacters]);

  const replaceItemAndSave = useCallback(
    async (originalItemId: string, resultItem: Item): Promise<boolean> => {
      if (!profile) return false;
      const original = profile.items.find((item) => item.id === originalItemId);
      if (!original) {
        toast.error(tx().originalGone);
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
        void refreshSavedCharacters().catch(() => {
          // El expediente ya se actualizó; la lista es una vista auxiliar.
        });
        toast.success(tx().itemUpdated(replacement.name));
        return true;
      } catch (err) {
        toast.error(tx().updateError, {
          description: getErrorMessage(err),
        });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [profile, persistId, refreshSavedCharacters],
  );

  const reset = useCallback(() => {
    if (profile && persisted) {
      const previous = { id: profile.id, name: profile.name };
      localStorage.setItem(PREVIOUS_STORAGE_KEY, JSON.stringify(previous));
      setPreviousCharacter(previous);
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(AUTO_RESTORE_SUPPRESSED_KEY, "1");
    setPendingItemImport(null);
    setProfile(null);
    setWarnings([]);
    setOrigin("empty");
    setDirty(false);
    setPersisted(false);
    toast.info(
      profile && persisted
        ? tx().setAside
        : tx().draftDiscarded,
    );
  }, [persisted, profile]);

  const restoreCharacter = useCallback(async (characterId: string): Promise<boolean> => {
    setBusy("restore");
    try {
      const res = await api.getCharacter(characterId);
      setProfile(res.profile);
      setWarnings([]);
      setOrigin(isCraftingExampleProfile(res.profile) ? "demo" : "imported");
      setDirty(false);
      setPersisted(true);
      persistId(res.profile.id);
      if (previousCharacter?.id === characterId) {
        localStorage.removeItem(PREVIOUS_STORAGE_KEY);
        setPreviousCharacter(null);
      }
      toast.success(tx().recovered(res.profile.name));
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setSavedCharacters((current) =>
          current.filter((entry) => entry.id !== characterId),
        );
        setSavedCharactersTotal((total) => Math.max(0, total - 1));
        if (previousCharacter?.id === characterId) {
          localStorage.removeItem(PREVIOUS_STORAGE_KEY);
          setPreviousCharacter(null);
        }
      }
      toast.error(tx().restoreError, {
        description: getErrorMessage(err),
      });
      return false;
    } finally {
      setBusy(null);
    }
  }, [persistId, previousCharacter]);

  const restorePrevious = useCallback(async (): Promise<boolean> => {
    if (!previousCharacter) return false;
    return restoreCharacter(previousCharacter.id);
  }, [previousCharacter, restoreCharacter]);

  return {
    profile,
    warnings,
    origin,
    busy,
    restoring,
    restorationError,
    dirty,
    persisted,
    previousCharacter,
    savedCharacters,
    savedCharactersTotal,
    loadingSavedCharacters,
    pendingItemImport,
    loadDemo,
    startManual,
    createQuick,
    completeQuick,
    rememberSupport,
    importBuild,
    importItemText,
    resolvePendingItemImport,
    cancelPendingItemImport,
    updateProfile,
    mutateProfile,
    replaceItemAndSave,
    saveCorrections,
    reset,
    restorePrevious,
    restoreCharacter,
    loadMoreSavedCharacters,
    retryRestore,
  };
}
