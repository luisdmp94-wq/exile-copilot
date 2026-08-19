import { useCallback, useState } from "react";
import { toast } from "sonner";
import type {
  ExportBuildRequest,
  ExportBuildResponse,
  RecommendationsRequest,
  RecommendationsResponse,
} from "@shared/api.js";
import { api, getErrorMessage } from "@/lib/api";

export interface RecommendationsState {
  result: RecommendationsResponse | null;
  /** JSON de los inputs usados en la última generación (para invalidar). */
  resultInputsKey: string | null;
  /** Último informe de exportación { fileName, report }; null si no se ha exportado. */
  exportResult: ExportBuildResponse | null;
  loading: boolean;
  exporting: boolean;
  error: string | null;
  generate: (request: RecommendationsRequest) => Promise<void>;
  exportBuild: (payload: ExportBuildRequest) => Promise<void>;
  clear: () => void;
}

/** Generación de recomendaciones y exportación del archivo .build. */
export function useRecommendations(): RecommendationsState {
  const [result, setResult] = useState<RecommendationsResponse | null>(null);
  const [resultInputsKey, setResultInputsKey] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportBuildResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (request: RecommendationsRequest) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.recommendations(request);
      setResult(res);
      setResultInputsKey(JSON.stringify(request));
      setExportResult(null);
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

  const exportBuild = useCallback(async (payload: ExportBuildRequest) => {
    setExporting(true);
    try {
      const res = await api.exportBuild(payload);
      const blob = new Blob([res.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = res.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportResult(res);
      if (res.report.notExportable.length > 0 || res.report.skippedUnverified.length > 0) {
        toast.warning(`Archivo ${res.fileName} descargado con pérdidas`, {
          description:
            "El formato oficial no puede guardar toda la información. Revisa el informe de exportación.",
        });
      } else {
        toast.success(`Archivo descargado: ${res.fileName}`);
      }
    } catch (err) {
      toast.error("No se pudo exportar la build", {
        description: getErrorMessage(err),
      });
    } finally {
      setExporting(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setResultInputsKey(null);
    setExportResult(null);
    setError(null);
  }, []);

  return {
    result,
    resultInputsKey,
    exportResult,
    loading,
    exporting,
    error,
    generate,
    exportBuild,
    clear,
  };
}
