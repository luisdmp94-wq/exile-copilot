import { useEffect, useState, useSyncExternalStore } from "react";
import type { CharacterProfile } from "@shared/domain.js";
import { pobXmlForProfile, type PobXmlNotes } from "@shared/pobBuild.js";
import { pobClient, type PobStatus } from "./pobClient";
import { loadPobData, type LoadedPobData } from "./pobData";
import type { PobAnalysis, PobCandidate } from "./pobTypes";

export function usePobStatus(): PobStatus {
  return useSyncExternalStore(
    (listener) => pobClient.subscribe(listener),
    () => pobClient.getStatus(),
    () => pobClient.getStatus(),
  );
}

/** Los datos para escribir la build (clases, gemas, árbol), cargados al pedirlos. */
export function usePobData(enabled: boolean): LoadedPobData | null {
  const [data, setData] = useState<LoadedPobData | null>(null);
  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    loadPobData()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, data]);
  return data;
}

export interface PobRequest {
  profile: CharacterProfile;
  /** Habilidad de daño a calcular (cualquier idioma). */
  mainSkill: string | null;
  /** Árbol a calcular en vez del guardado (el editor). */
  passives?: string[];
  candidates?: PobCandidate[];
  /** Buscar los mejores notables a este número de puntos. */
  explorePoints?: number;
}

export interface PobResult {
  analysis: PobAnalysis;
  notes: PobXmlNotes;
  mainSkill: string | null;
}

// Lo ya calculado en esta visita (el mismo árbol y las mismas gemas dan lo mismo).
const cache = new Map<string, Promise<PobResult>>();
const CACHE_SIZE = 24;

function run(request: PobRequest, data: LoadedPobData): { key: string; promise: Promise<PobResult> } {
  const built = pobXmlForProfile(request.profile, data, { mainSkill: request.mainSkill, passives: request.passives });
  const args = {
    xml: built.xml,
    candidates: request.candidates ?? [],
    ...(request.explorePoints ? { explore: { maxPoints: request.explorePoints } } : {}),
  };
  const key = JSON.stringify(args);
  let promise = cache.get(key);
  if (!promise) {
    promise = pobClient.analyse(args).then((analysis) => ({ analysis, notes: built.notes, mainSkill: built.mainSkill }));
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  }
  return { key, promise };
}

/**
 * Los números de PoB2 para un personaje. `null` mientras no se pida (enabled
 * false) o mientras calcula; el último resultado se mantiene hasta que llega
 * el siguiente, para que los números no parpadeen al editar el árbol.
 */
export function usePobAnalysis(request: PobRequest | null, enabled: boolean): {
  result: PobResult | null;
  busy: boolean;
  error: string | null;
} {
  const data = usePobData(enabled);
  const [state, setState] = useState<{ key: string; result: PobResult | null; error: string | null }>({
    key: "",
    result: null,
    error: null,
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const requestKey = request && enabled && data ? JSON.stringify([request, data.meta.commit]) : null;

  useEffect(() => {
    if (!request || !enabled || !data || requestKey === null) return;
    let cancelled = false;
    // Pequeña espera: mientras se editan varios nodos seguidos, se calcula una vez.
    const timer = window.setTimeout(() => {
      const { promise } = run(request, data);
      setPendingKey(requestKey);
      promise
        .then((result) => {
          if (!cancelled) setState({ key: requestKey, result, error: null });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState((current) => ({ ...current, key: requestKey, error: error instanceof Error ? error.message : String(error) }));
        })
        .finally(() => {
          if (!cancelled) setPendingKey((current) => (current === requestKey ? null : current));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `request` se sigue por su clave.
  }, [requestKey, enabled, data]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    result: state.result,
    busy: requestKey !== null && (state.key !== requestKey || pendingKey === requestKey),
    error: state.key === requestKey ? state.error : null,
  };
}
