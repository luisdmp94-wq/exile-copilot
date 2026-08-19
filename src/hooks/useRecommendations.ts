import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { RecommendationsRequest, RecommendationsResponse } from "@shared/api.js";
import type { CharacterProfile } from "@shared/domain.js";
import { api, getErrorMessage } from "@/lib/api";

export interface RecommendationsState {
  result: RecommendationsResponse | null;
  loading: boolean;
  exporting: boolean;
  error: string | null;
  generate: (request: RecommendationsRequest) => Promise<void>;
  exportBuild: (profile: CharacterProfile, appliedIds: string[]) => Promise<void>;
  clear: () => void;
}

/** Generación de recomendaciones y exportación del archivo .build. */
export function useRecommendations(): RecommendationsState {
  const [result, setResult] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (request: RecommendationsRequest) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.recommendations(request);
      setResult(res);
      if (res.recommendations.length === 0) {
        toast.info("El motor no encontró mejoras para esta configuración");
      } else {
        toast.success(`${res.recommendations.length} recomendación(es) generadas`);
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error("No se pudieron generar las recomendaciones", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const exportBuild = useCallback(
    async (profile: CharacterProfile, appliedIds: string[]) => {
      setExporting(true);
      try {
        const { blob, filename } = await api.exportBuild(profile, appliedIds);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast.success(`Archivo descargado: ${filename}`);
      } catch (err) {
        toast.error("No se pudo exportar la build", {
          description: getErrorMessage(err),
        });
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, exporting, error, generate, exportBuild, clear };
}
