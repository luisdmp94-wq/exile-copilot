import { useCallback, useEffect, useState } from "react";
import type { FeaturedBuildsResponse } from "@shared/featuredBuilds.js";
import { api, getErrorMessage } from "@/lib/api";

export interface FeaturedBuildsState {
  result: FeaturedBuildsResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Carga la selección exacta de liga y parche; no reutiliza otra temporada. */
export function useFeaturedBuilds(league: string, patch: string): FeaturedBuildsState {
  const [result, setResult] = useState<FeaturedBuildsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!league || !patch) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await api.featuredBuilds(league, patch);
        if (!cancelled) setResult(next);
      } catch (reason) {
        if (!cancelled) {
          setResult(null);
          setError(getErrorMessage(reason));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [league, patch, reloadToken]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  return { result, loading, error, reload };
}
