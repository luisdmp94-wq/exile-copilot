import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { BuildCheckPage } from "./BuildCheckPage";

/**
 * Entrada de la web pública (build:check): solo el chequeo de build, sin la app
 * anterior ni servidor. Se publica como sitio estático en Cloudflare Pages.
 */

class CheckErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto max-w-xl px-4 py-16 text-foreground">
        <h1 className="dossier-title text-2xl font-semibold">Algo ha fallado · Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Recarga la página para volver a empezar. · Reload the page to start again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md border border-primary/60 px-3 py-2 text-sm text-primary"
        >
          Recargar · Reload
        </button>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CheckErrorBoundary>
      <BuildCheckPage standalone />
    </CheckErrorBoundary>
  </StrictMode>,
);
