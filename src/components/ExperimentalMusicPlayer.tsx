import { Minus, Music2, Radio, Square } from "lucide-react";
import { useState } from "react";

const YOUTUBE_VIDEO_ID = "s-1e7IxV7Hc";
const YOUTUBE_EMBED_URL =
  `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}` +
  `?autoplay=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&playsinline=1&rel=0`;

/**
 * Prueba local deliberadamente aislada. El iframe no existe hasta que el
 * jugador lo activa con un clic, por lo que abrir Exile Copilot no contacta
 * con YouTube ni inicia audio por su cuenta.
 */
export function ExperimentalMusicPlayer() {
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const togglePlayer = () => {
    if (!active) {
      setActive(true);
      setExpanded(true);
      return;
    }

    setExpanded((current) => !current);
  };

  const stopPlayer = () => {
    setActive(false);
    setExpanded(false);
  };

  return (
    <div className="relative" data-testid="experimental-music">
      <button
        type="button"
        onClick={togglePlayer}
        aria-expanded={expanded}
        aria-pressed={active}
        aria-controls="experimental-music-panel"
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${
          active
            ? "border-primary/60 bg-primary/15 text-primary"
            : "border-border/80 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
        }`}
        data-testid="experimental-music-toggle"
        title={
          !active
            ? "Probar música ambiental"
            : expanded
              ? "Minimizar el reproductor"
              : "Abrir el reproductor"
        }
      >
        <Music2 className="size-3.5" aria-hidden="true" />
        Música
        <span className="rounded-full border border-current/25 px-1.5 text-[9px] uppercase tracking-[0.12em]">
          {active ? "sonando" : "prueba"}
        </span>
      </button>

      {active && (
        <section
          id="experimental-music-panel"
          className={`absolute right-0 top-full z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-primary/35 bg-background/95 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur transition-[opacity,transform,visibility] motion-reduce:transition-none ${
            expanded
              ? "visible translate-y-0 opacity-100"
              : "invisible pointer-events-none -translate-y-1 opacity-0"
          }`}
          data-testid="experimental-music-panel"
          data-state={expanded ? "expanded" : "minimized"}
          aria-hidden={!expanded}
          aria-label="Radio experimental del exiliado"
        >
          <div className="flex items-center gap-3 border-b border-primary/20 px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              <Radio className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75">
                Radio del exiliado
              </p>
              <p className="truncate text-xs text-muted-foreground">Prueba temporal mediante YouTube</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="grid size-8 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Minimizar reproductor; la música continuará"
              title="Minimizar; la música continuará"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
          </div>

          <iframe
            className="block h-[200px] w-full border-0 bg-black"
            src={YOUTUBE_EMBED_URL}
            title="Música ambiental experimental de Exile Copilot"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="eager"
            data-testid="experimental-music-frame"
          />
          <div className="flex items-center gap-3 border-t border-border/70 px-3 py-2">
            <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-muted-foreground">
              Puedes minimizar esta ventana sin cortar la música.
            </p>
            <button
              type="button"
              onClick={stopPlayer}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border/80 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Detener música"
            >
              <Square className="size-3" aria-hidden="true" />
              Detener
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
