import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CharacterProfile } from "@shared/domain.js";
import { pobXmlForProfile, type PobXmlNotes } from "@shared/pobBuild.js";
import { pobClient, PobSupersededError, type PobStatus } from "./pobClient";
import { loadPobData, type LoadedPobData } from "./pobData";
import type { PobAnalysis, PobCandidate } from "./pobTypes";

export function usePobStatus(): PobStatus {
  return useSyncExternalStore(
    (listener) => pobClient.subscribe(listener),
    () => pobClient.getStatus(),
    () => pobClient.getStatus(),
  );
}

/**
 * Los datos para escribir la build (clases, gemas, árbol), cargados al
 * pedirlos. `attempt` vuelve a intentarlo si fallaron.
 */
export function usePobData(enabled: boolean, attempt = 0): { data: LoadedPobData | null; failed: boolean } {
  const [state, setState] = useState<{ data: LoadedPobData | null; failedAttempt: number | null }>({ data: null, failedAttempt: null });
  useEffect(() => {
    if (!enabled || state.data) return;
    let cancelled = false;
    loadPobData()
      .then((loaded) => {
        if (!cancelled) setState({ data: loaded, failedAttempt: null });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, failedAttempt: attempt });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, state.data, attempt]);
  return { data: state.data, failed: state.failedAttempt === attempt };
}

export interface PobRequest {
  profile: CharacterProfile;
  /** Habilidad de daño a calcular (cualquier idioma). */
  mainSkill: string | null;
  /** Árbol a calcular en vez del guardado (el editor). */
  passives?: string[];
  /** Atributos elegidos a usar en vez de los guardados (el editor). */
  attributeChoices?: Record<string, "str" | "dex" | "int">;
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

function run(request: PobRequest, data: LoadedPobData, lane: string): Promise<PobResult> {
  const built = pobXmlForProfile(request.profile, data, {
    mainSkill: request.mainSkill,
    passives: request.passives,
    attributeChoices: request.attributeChoices,
  });
  const args = {
    xml: built.xml,
    candidates: request.candidates ?? [],
    ...(request.explorePoints ? { explore: { maxPoints: request.explorePoints } } : {}),
  };
  const key = JSON.stringify(args);
  let promise = cache.get(key);
  if (!promise) {
    promise = pobClient.analyse(args, lane).then((analysis) => ({ analysis, notes: built.notes, mainSkill: built.mainSkill }));
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  }
  return promise;
}

export interface PobAnalysisState {
  result: PobResult | null;
  /** El resultado es de una petición anterior (calculando la nueva, o la nueva falló). */
  stale: boolean;
  busy: boolean;
  error: string | null;
}

/**
 * Los números de PoB2 para un personaje. El último resultado se mantiene
 * mientras llega el siguiente (los números no parpadean al editar), pero
 * marcado `stale` para no venderlo como el de ahora. `retry` repite el cálculo
 * después de un fallo; `lane` separa filas que no deben pisarse.
 */
export function usePobAnalysis(request: PobRequest | null, enabled: boolean, retry = 0, lane = "main"): PobAnalysisState {
  const { data, failed: dataFailed } = usePobData(enabled, retry);
  const [state, setState] = useState<{ key: string; resultKey: string; result: PobResult | null; error: string | null }>({
    key: "",
    resultKey: "",
    result: null,
    error: null,
  });
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // El personaje puede llevar el XML de PoB2 (decenas de KB): la clave se
  // calcula solo cuando cambia la petición, no en cada render.
  const requestKey = useMemo(
    () => (request && enabled && data ? JSON.stringify([request, data.meta.commit]) : null),
    [request, enabled, data],
  );

  useEffect(() => {
    if (!request || !enabled || !data || requestKey === null) return;
    let cancelled = false;
    // Pequeña espera: mientras se editan varios nodos seguidos, se calcula una vez.
    const timer = window.setTimeout(() => {
      setPendingKey(requestKey);
      run(request, data, lane)
        .then((result) => {
          if (!cancelled) setState({ key: requestKey, resultKey: requestKey, result, error: null });
        })
        .catch((error: unknown) => {
          // Descartada porque llegó otra más nueva: la nueva traerá el resultado.
          if (cancelled || error instanceof PobSupersededError) return;
          setState((current) => ({ ...current, key: requestKey, error: error instanceof Error ? error.message : String(error) }));
        })
        .finally(() => {
          if (!cancelled) setPendingKey((current) => (current === requestKey ? null : current));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `request` se sigue por su clave; `retry` repite el mismo cálculo tras un fallo.
  }, [requestKey, enabled, data, retry, lane]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = requestKey !== null && state.key === requestKey;
  return {
    result: state.result,
    stale: state.result !== null && state.resultKey !== requestKey,
    busy: requestKey !== null && (!current || pendingKey === requestKey),
    error: dataFailed ? "data" : current ? state.error : null,
  };
}
