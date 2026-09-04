import { Minus, Music2, Play, Radio, Square } from "lucide-react";
import { useState } from "react";

const YOUTUBE_VIDEO_ID = "s-1e7IxV7Hc";
const YOUTUBE_EMBED_URL =
  `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}` +
  `?autoplay=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&playsinline=1&rel=0`;

/**
 * Prueba local deliberadamente aislada. El iframe no existe hasta que el
 * jugador confirma la reproducción, por lo que abrir Exile Copilot o desplegar
 * este panel no contacta con YouTube ni inicia audio por su cuenta.
 */
export function ExperimentalMusicPlayer() {
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const togglePlayer = () => {
    setExpanded((current) => !current);
  };

  const startPlayer = () => {
    setActive(true);
    setExpanded(true);
  };

  const stopPlayer = () => {
    setActive(false);
    setExpanded(false);
  };

  return (
    <div className="relative shrink-0" data-testid="experimental-music">
      <button
        type="button"
        onClick={togglePlayer}
        aria-expanded={expanded}
        aria-pressed={active}
        aria-controls="experimental-music-panel"
        aria-label={active ? "Música: reproductor activo" : "Música"}
        className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors sm:px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${
          active
            ? "border-primary/70 bg-primary/15 text-primary shadow-[0_0_18px_rgba(245,180,28,0.09)]"
            : "border-primary/35 bg-primary/[0.06] text-foreground hover:border-primary/60 hover:bg-primary/10"
        }`}
        data-testid="experimental-music-toggle"
        data-state={active ? "playing" : expanded ? "open" : "idle"}
        title={
          !active
            ? expanded
              ? "Cerrar el reproductor"
              : "Abrir el reproductor"
            : expanded
              ? "Minimizar el reproductor"
              : "Abrir el reproductor"
        }
      >
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full ${
            active ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/90"
          }`}
          aria-hidden="true"
        >
          <Music2 className="size-3" />
        </span>
        {/* El nombre no se oculta: Música es una función propia y debe seguir
            siendo reconocible incluso en la vista móvil más estrecha. */}
        <span>Música</span>
        <span className="hidden rounded-full border border-current/25 px-1.5 text-[9px] uppercase tracking-[0.12em] min-[560px]:inline-flex">
          {active ? "sonando" : "prueba"}
        </span>
      </button>

      {(active || expanded) && (
        <section
          id="experimental-music-panel"
          className={`fixed left-4 right-4 top-20 z-[70] w-auto overflow-hidden rounded-md border border-primary/35 bg-background/95 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur transition-[opacity,transform,visibility] motion-reduce:transition-none sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(22rem,calc(100vw-2rem))] ${
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
              aria-label={active ? "Minimizar reproductor; la música continuará" : "Cerrar reproductor"}
              title={active ? "Minimizar; la música continuará" : "Cerrar reproductor"}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
          </div>

          {active ? (
            <>
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
            </>
          ) : (
            <div className="space-y-3 p-4" data-testid="experimental-music-consent">
              <p className="text-xs leading-relaxed text-muted-foreground">
                La música se reproduce desde YouTube. Solo al pulsar reproducir tu
                navegador conectará con YouTube, que podrá recibir tu dirección IP y
                datos técnicos del navegador.
              </p>
              <button
                type="button"
                onClick={startPlayer}
                className="inline-flex min-h-9 items-center gap-2 rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                data-testid="experimental-music-play"
              >
                <Play className="size-3.5" aria-hidden="true" />
                Reproducir con YouTube
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
