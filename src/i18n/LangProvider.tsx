import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LangContext, initialLang, storeLang, type Lang } from "./lang";

/** Guarda el idioma elegido y lo reparte a toda la web. */
export function LangProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const first = initial ?? initialLang();
    // Antes del primer render: fechas y costes ya salen en este idioma.
    if (typeof document !== "undefined") document.documentElement.lang = first;
    return first;
  });

  const setLang = useCallback((next: Lang) => {
    document.documentElement.lang = next;
    setLangState(next);
    storeLang(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
