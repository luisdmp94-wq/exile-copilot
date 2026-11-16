import { LANGS, useLang } from "./lang";
import { cn } from "@/lib/utils";

const LABELS = { es: "Español", en: "English" } as const;

/** Botón ES | EN de la cabecera. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className="flex shrink-0 items-center rounded-full border border-border p-0.5 text-xs"
      data-testid="idioma"
    >
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          aria-label={LABELS[option]}
          title={LABELS[option]}
          className={cn(
            "min-h-7 rounded-full px-2 font-semibold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            lang === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          data-testid={`idioma-${option}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
