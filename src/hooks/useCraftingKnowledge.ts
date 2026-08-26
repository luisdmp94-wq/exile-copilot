import { useEffect, useState } from "react";
import type { CraftingKnowledgeResponse } from "@shared/api.js";
import type { Item } from "@shared/domain.js";
import { api, getErrorMessage } from "@/lib/api";

export interface CraftingKnowledgeState {
  data: CraftingKnowledgeResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Consulta el registro autoritativo para la pieza seleccionada. Cambiar de
 * pieza cancela lógicamente la respuesta anterior para que una petición lenta
 * nunca pinte el alcance equivocado.
 */
export function useCraftingKnowledge(
  item: Item,
  patch: string,
): CraftingKnowledgeState {
  const requestKey = [item.id, item.itemClass ?? "", item.baseType, patch].join("\u0000");
  const [result, setResult] = useState<{
    requestKey: string;
    data: CraftingKnowledgeResponse | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .craftingKnowledge({
        ...(item.itemClass ? { itemClass: item.itemClass } : {}),
        baseType: item.baseType,
        patch,
      })
      .then((data) => {
        if (!cancelled) setResult({ requestKey, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ requestKey, data: null, error: getErrorMessage(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.itemClass, item.baseType, patch, requestKey]);

  if (result?.requestKey !== requestKey) {
    return { data: null, loading: true, error: null };
  }
  return { data: result.data, loading: false, error: result.error };
}
