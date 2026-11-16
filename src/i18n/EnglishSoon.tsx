import { Languages } from "lucide-react";
import { useLang } from "./lang";

/**
 * Aviso en las partes que todavía no están traducidas. Solo sale en inglés:
 * quien lee en español no ve nada.
 */
export function EnglishSoon({ area }: { area: string }) {
  const { lang, setLang } = useLang();
  if (lang !== "en") return null;
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100"
      role="note"
      data-testid="english-soon"
    >
      <Languages className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>{area}</strong> is still in Spanish. The English version is coming soon.
      </span>
      <button
        type="button"
        onClick={() => setLang("es")}
        className="text-xs font-semibold text-amber-200 underline-offset-2 hover:underline"
      >
        Ver en español
      </button>
    </div>
  );
}
