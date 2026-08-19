import { useCallback, useEffect, useState } from "react";
import type { HealthResponse, MetaResponse } from "@shared/api.js";
import { api, getErrorMessage } from "@/lib/api";

export interface MetaState {
  health: HealthResponse | null;
  meta: MetaResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Carga /api/health y /api/meta al montar la app. */
export function useMeta(): MetaState {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [healthResult, metaResult] = await Promise.allSettled([
      api.health(),
      api.meta(),
    ]);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (metaResult.status === "fulfilled") {
      setMeta(metaResult.value);
    } else {
      setError(getErrorMessage(metaResult.reason));
    }
    if (healthResult.status === "rejected" && metaResult.status === "rejected") {
      setError(getErrorMessage(healthResult.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { health, meta, loading, error, reload: load };
}
