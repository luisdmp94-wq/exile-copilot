import {
  ArrowRight,
  BookOpen,
  Hammer,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserRoundPlus,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedCharacterSummary } from "@shared/api.js";
import { texts, useText } from "@/i18n/lang";

interface WelcomePanelProps {
  /** Lleva el foco al panel de importación (que vive en «Personaje»). */
  onGoToImport: () => void;
  onStartNew: () => void;
  onStartItem: () => void;
  onLoadDemo: () => void;
  /** Abre el área «Guías»: lo primero que necesita quien empieza en PoE2. */
  onOpenGuides?: () => void;
  loadingDemo: boolean;
  previousCharacterName?: string | null;
  onRestorePrevious?: () => void;
  restoringPrevious?: boolean;
  savedCharacters?: SavedCharacterSummary[];
  savedCharactersTotal?: number;
  loadingSavedCharacters?: boolean;
  onRestoreCharacter?: (characterId: string) => void;
  onLoadMoreSavedCharacters?: () => void;
}

const INTENCIONES = [
  { icon: TrendingUp, action: "import" as const },
  { icon: UserRoundPlus, action: "new" as const },
  { icon: Hammer, action: "item" as const },
] as const;

const TEXT = texts(
  {
    intents: {
      import: {
        titulo: "Añadir mi personaje",
        texto: "Trae lo que ya juegas. El Mentor encontrará una sola mejora y te dirá cómo comprobarla dentro de PoE2.",
        cta: "Añadir personaje",
      },
      new: {
        titulo: "Crearlo manualmente",
        texto: "Escribe solo lo que sabes; podrás completarlo después.",
        cta: "Crear personaje",
      },
      item: {
        titulo: "Analizar un objeto",
        texto: "Pega una pieza de PoE2 y aprende qué significa antes de gastar.",
        cta: "Pegar un objeto",
      },
    },
    kicker: "Tu primera mejora empieza aquí",
    title: "Descubre qué mejorar primero en tu personaje de PoE2",
    lead: "Exile Copilot lee tu situación, elige una prioridad y te enseña a comprobarla en el juego. No juega ni craftea por ti.",
    guideTitle: "¿Empiezas en PoE2? Lee la guía del acto 1",
    guideText: "Cómo no morir antes del acto 2, en 2 minutos. Sin registrarte.",
    saved: (total: number) => `Tus personajes guardados · ${total}`,
    change: "Cambiar",
    close: "Cerrar",
    level: (level: number) => ` · nivel ${level}`,
    levelUnknown: " · nivel desconocido",
    older: "Ver personajes anteriores",
    tryFirst: "¿Quieres ver cómo funciona antes de añadir nada?",
    demo: "Cargar ejemplo",
    restore: (name: string) => `Recuperar ${name}`,
  },
  {
    intents: {
      import: {
        titulo: "Add my character",
        texto: "Bring what you already play. The Mentor finds one single improvement and tells you how to check it inside PoE2.",
        cta: "Add character",
      },
      new: {
        titulo: "Create it by hand",
        texto: "Write only what you know; you can fill in the rest later.",
        cta: "Create character",
      },
      item: {
        titulo: "Check an item",
        texto: "Paste a PoE2 item and learn what it means before you spend anything.",
        cta: "Paste an item",
      },
    },
    kicker: "Your first upgrade starts here",
    title: "Find out what to improve first on your PoE2 character",
    lead: "Exile Copilot reads your situation, picks one priority and shows you how to check it in game. It doesn't play or craft for you.",
    guideTitle: "New to PoE2? Read the act 1 guide",
    guideText: "How not to die before act 2, in 2 minutes. No sign-up.",
    saved: (total: number) => `Your saved characters · ${total}`,
    change: "Switch",
    close: "Close",
    level: (level: number) => ` · level ${level}`,
    levelUnknown: " · unknown level",
    older: "Show older characters",
    tryFirst: "Want to see how it works before adding anything?",
    demo: "Load an example",
    restore: (name: string) => `Restore ${name}`,
  },
);

/**
 * Bienvenida cuando todavía no hay personaje. Sustituye a cinco paneles vacíos
 * por una sola entrada clara: qué hacer primero y qué esperar después.
 */
export function WelcomePanel({
  onGoToImport,
  onStartNew,
  onStartItem,
  onLoadDemo,
  onOpenGuides,
  loadingDemo,
  previousCharacterName = null,
  onRestorePrevious,
  restoringPrevious = false,
  savedCharacters = [],
  savedCharactersTotal = 0,
  loadingSavedCharacters = false,
  onRestoreCharacter,
  onLoadMoreSavedCharacters,
}: WelcomePanelProps) {
  const t = useText(TEXT);
  const runAction = (action: (typeof INTENCIONES)[number]["action"]) => {
    if (action === "import") onGoToImport();
    else if (action === "new") onStartNew();
    else onStartItem();
  };

  return (
    <section
      className="welcome-stage superficie-accion mb-6 px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10"
      data-testid="bienvenida"
      aria-labelledby="bienvenida-titulo"
    >
      <div className="relative z-10 flex max-w-5xl flex-col gap-5 sm:gap-6">
        <div className="flex max-w-3xl flex-col gap-3 sm:gap-4">
          <p className="rotulo-seccion flex items-center gap-2 text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t.kicker}
          </p>
          <h2
            id="bienvenida-titulo"
            className="dossier-title max-w-3xl text-3xl font-semibold leading-[1.05] text-foreground sm:text-4xl lg:text-5xl"
          >
            {t.title}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t.lead}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="intenciones-iniciales">
          {INTENCIONES.map(({ icon: Icon, action }) => {
            const { titulo, texto, cta } = t.intents[action];
            return (
            <button
              key={action}
              type="button"
              onClick={() => runAction(action)}
              data-testid={
                action === "import"
                  ? "bienvenida-importar"
                  : action === "new"
                    ? "bienvenida-nuevo"
                    : "bienvenida-objeto"
              }
              data-intent={action}
              className={`group flex flex-col items-start rounded-md p-4 text-left transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none sm:p-5 ${
                action === "import"
                  ? "superficie-accion gap-2 border-primary/70 bg-primary/[0.08] sm:col-span-2 lg:min-h-32 lg:flex-row lg:items-center lg:gap-3"
                  : "min-h-24 gap-2 border border-border/80 bg-background/65 hover:border-primary/50 hover:bg-primary/[0.04]"
              }`}
            >
              <span className="grid size-9 place-items-center rounded-full border border-primary/35 bg-primary/10 text-primary sm:size-10">
                <Icon className="size-4 sm:size-5" aria-hidden="true" />
              </span>
              <span className={action === "import" ? "flex flex-1 flex-col gap-1" : "flex flex-col gap-0.5"}>
                <span className="text-lg font-semibold text-foreground sm:text-xl">{titulo}</span>
                <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{texto}</span>
              </span>
              <span className={`flex items-center gap-2 text-xs font-semibold ${
                action === "import"
                  ? "mt-auto min-h-11 rounded-md bg-primary px-4 text-primary-foreground lg:mt-0"
                  : "mt-auto text-primary"
              }`}>
                {action === "import" && <Upload className="size-3.5" aria-hidden="true" />}
                {cta}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </span>
            </button>
            );
          })}
        </div>

        {onOpenGuides && (
          <button
            type="button"
            onClick={onOpenGuides}
            className="group flex items-center gap-3 rounded-md border border-border/80 bg-background/65 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="bienvenida-guias"
          >
            <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-foreground">{t.guideTitle}</span>
              <span className="text-xs text-muted-foreground">{t.guideText}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </button>
        )}

        {savedCharactersTotal > 1 && onRestoreCharacter && (
          <details
            className="group rounded-md border border-border/65 bg-background/45"
            data-testid="bienvenida-guardados"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span>{t.saved(savedCharactersTotal)}</span>
              <span className="text-xs text-muted-foreground group-open:hidden">
                {t.change}
              </span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">
                {t.close}
              </span>
            </summary>
            <div className="max-h-60 space-y-1 overflow-y-auto border-t border-border/55 p-2">
              {savedCharacters.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 rounded-sm px-3 py-2 text-left hover:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onRestoreCharacter(entry.id)}
                  disabled={restoringPrevious}
                  data-testid={`bienvenida-guardado-${entry.id}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {entry.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.ascendancy || entry.characterClass}
                      {entry.level !== null ? t.level(entry.level) : t.levelUnknown}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                </button>
              ))}
              {savedCharacters.length < savedCharactersTotal && onLoadMoreSavedCharacters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={onLoadMoreSavedCharacters}
                  disabled={loadingSavedCharacters}
                  data-testid="bienvenida-guardados-mas"
                >
                  {loadingSavedCharacters && (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  {t.older}
                </Button>
              )}
            </div>
          </details>
        )}

        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/55 pt-3 text-xs text-muted-foreground"
          data-testid="bienvenida-ayuda-secundaria"
        >
          <span>{t.tryFirst}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onLoadDemo}
            disabled={loadingDemo}
            data-testid="bienvenida-ejemplo"
          >
            {loadingDemo ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {t.demo}
          </Button>
          {previousCharacterName && onRestorePrevious && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={onRestorePrevious}
              disabled={restoringPrevious}
              data-testid="bienvenida-recuperar"
            >
              {restoringPrevious ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Undo2 className="size-4" aria-hidden="true" />
              )}
              {t.restore(previousCharacterName)}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
