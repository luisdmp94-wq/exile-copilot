import { Component, type ReactNode } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  render() {
    if (!this.state.failed) return this.props.children;

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
            <span className="text-xs font-semibold uppercase tracking-[0.24em]">
              Exile Copilot
            </span>
          </div>

          <div role="alert">
            <h1 className="dossier-title text-3xl font-semibold">
              La interfaz se ha detenido
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              No se ha aplicado ninguna acción de crafting. Los expedientes que ya
              guardaste permanecen en el servidor y puedes volver a cargarlos.
            </p>
          </div>

          <Button
            type="button"
            className="mt-6"
            onClick={() => window.location.reload()}
            data-testid="recuperacion-recargar"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Volver a cargar
          </Button>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Si vuelve a ocurrir, no repitas una moneda en el juego hasta comprobar
            el último estado guardado de la pieza.
          </p>
        </section>
      </main>
    );
  }
}
