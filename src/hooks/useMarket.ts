import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { MarketPricesResponse } from "@shared/api.js";
import { api, getErrorMessage } from "@/lib/api";
import { pageLang, texts } from "@/i18n/lang";

/** Avisos del mercado. Se leen al momento, en el idioma que muestra la página. */
const TEXT = texts(
  {
    noNames: "Escribe al menos un nombre de objeto para consultar",
    degraded: "Mercado en modo degradado",
    degradedDetail: "Se usaron datos en caché o de ejemplo por un fallo del servicio.",
    queryError: "No se pudieron consultar los precios",
  },
  {
    noNames: "Type at least one item name to look up",
    degraded: "Market in fallback mode",
    degradedDetail: "Cached or example data was used because the price service failed.",
    queryError: "Couldn't look up prices",
  },
);
const tx = () => TEXT[pageLang()];

export interface MarketState {
  prices: MarketPricesResponse | null;
  loading: boolean;
  error: string | null;
  queryPrices: (league: string, names: string[], patch: string) => Promise<void>;
}

/** Consulta de precios de mercado (poe.ninja vía backend). */
export function useMarket(): MarketState {
  const [prices, setPrices] = useState<MarketPricesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryPrices = useCallback(async (league: string, names: string[], patch: string) => {
    const cleanNames = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (cleanNames.length === 0) {
      toast.error(tx().noNames);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.marketPrices(league, cleanNames, patch);
      setPrices(res);
      if (res.degraded) {
        toast.warning(tx().degraded, {
          description: tx().degradedDetail,
        });
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(tx().queryError, { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  return { prices, loading, error, queryPrices };
}
