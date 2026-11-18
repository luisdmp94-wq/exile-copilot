import { Component, type ReactNode } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageLang, texts } from "@/i18n/lang";
import { isChunkLoadError, reloadOnceForNewVersion } from "@/lib/reloadForNewVersion";

// Vive fuera de LangProvider: lee el idioma de <html lang>.
const TEXT = texts(
  {
    title: "La página se ha detenido",
    body: "Exile Copilot no toca nada dentro de PoE2. Solo se ha parado la página; tus personajes guardados siguen en el servidor.",
    reload: "Volver a cargar",
    hint: "Si vuelve a pasar, avísanos desde «Avisar de un problema» al pie de la página.",
  },
  {
    title: "The page stopped working",
    body: "Exile Copilot doesn't touch anything inside PoE2. Only the page stopped; your saved characters are still on the server.",
    reload: "Reload",
    hint: "If it happens again, tell us with “Report a problem” at the bottom of the page.",
  },
);

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

/** Última defensa contra un módulo roto o un error de renderizado inesperado. */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Un trozo de una versión anterior: se recarga una vez y listo.
    if (isChunkLoadError(error)) reloadOnceForNewVersion();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = TEXT[pageLang()];

    return (
      <main
        className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground"
        data-testid="recuperacion-interfaz"
      >
        <section className="w-full max-w-xl rounded-xl border border-primary/30 bg-card p-6 shadow-2xl sm:p-8">
          <div className="mb-5 flex items-center gap-3 text-primary">
            <span className="brand-seal" aria-hidden="true">
              <ShieldCheck className="size-5" />
            </span>
            <span className="text-xs font-semibold">
              Exile Copilot
            </span>
          </div>

          <div role="alert">
            <h1 className="dossier-title text-3xl font-semibold">{t.title}</h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">{t.body}</p>
          </div>

          <Button
            type="button"
            className="mt-6"
            onClick={() => window.location.reload()}
            data-testid="recuperacion-recargar"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t.reload}
          </Button>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t.hint}</p>
        </section>
      </main>
    );
  }
}
