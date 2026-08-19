import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { MarketPricesResponse } from "@shared/api.js";
import { api, getErrorMessage } from "@/lib/api";

export interface MarketState {
  prices: MarketPricesResponse | null;
  loading: boolean;
  error: string | null;
  queryPrices: (league: string, names: string[]) => Promise<void>;
}

/** Consulta de precios de mercado (poe.ninja vía backend). */
export function useMarket(): MarketState {
  const [prices, setPrices] = useState<MarketPricesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryPrices = useCallback(async (league: string, names: string[]) => {
    const cleanNames = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (cleanNames.length === 0) {
      toast.error("Escribe al menos un nombre de objeto para consultar");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.marketPrices(league, cleanNames);
      setPrices(res);
      if (res.degraded) {
        toast.warning("Mercado en modo degradado", {
          description: "Se usaron datos en caché o de ejemplo por un fallo del servicio.",
        });
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error("No se pudieron consultar los precios", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  return { prices, loading, error, queryPrices };
}
