import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, MessageCircleMore, Sparkles } from "lucide-react";
import type { MentorAnswer } from "@shared/mentorQuery.js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ContextualMentorAsk,
  ContextualMentorCue,
} from "@/lib/contextualMentor";

interface ContextualMentorProps {
  cue: ContextualMentorCue;
  answer: MentorAnswer | null;
  error: string | null;
  loading: boolean;
  canAsk: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onAsk: (ask: ContextualMentorAsk) => Promise<void>;
  onOpenMentor: () => void;
}

const SOURCE_STYLES: Record<ContextualMentorCue["source"], string> = {
  guide: "border-primary/45 bg-primary/10 text-primary",
  engine: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  market: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-200",
};

function answerLabel(answer: MentorAnswer): string {
  if (answer.responseMode === "ai") {
    return answer.model ? `IA fundamentada · ${answer.model}` : "IA fundamentada";
  }
  if (answer.responseMode === "rules_fallback") return "Respaldo del motor de reglas";
  return "Respuesta del motor";
}

/** Presencia persistente: reacciona a decisiones semánticas, no a clics decorativos. */
export function ContextualMentor({
  cue,
  answer,
  error,
  loading,
  canAsk,
  collapsed,
  onCollapsedChange,
  onAsk,
  onOpenMentor,
}: ContextualMentorProps) {
  const requestLockedRef = useRef(false);
  const shellRef = useRef<HTMLElement>(null);
  const askButtonRef = useRef<HTMLButtonElement | null>(null);
  const [restoreAskFocus, setRestoreAskFocus] = useState(false);
  useEffect(() => {
    if (!loading) requestLockedRef.current = false;
    if (loading || !restoreAskFocus || (answer === null && error === null)) return;
    // `loading: true` puede no llegar a pintarse cuando el motor local responde
    // en el mismo lote de React. Observar también respuesta/error garantiza que
    // la restauración ocurra después del render definitivo, no antes.
    let followUp: number | null = null;
    const restoreFocus = () => {
      if (
        document.activeElement === document.body ||
        document.activeElement === askButtonRef.current
      ) {
        askButtonRef.current?.focus({ preventScroll: true });
      }
    };
    const frame = window.requestAnimationFrame(() => {
      restoreFocus();
      // En motores Chromium la liberación de Enter puede ejecutarse después
      // del primer frame y mandar el foco a <body> aunque el nodo no cambie.
      // Este segundo pase solo actúa si el foco quedó huérfano; nunca se lo
      // roba a otro control elegido por el jugador durante una petición lenta.
      followUp = window.setTimeout(restoreFocus, 50);
      setRestoreAskFocus(false);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (followUp !== null) window.clearTimeout(followUp);
    };
  }, [loading, answer, error, restoreAskFocus]);

  const requestContext = (restoreKeyboardFocus = false) => {
    if (!canAsk || loading || cue.ask === null || requestLockedRef.current) return;
    requestLockedRef.current = true;
    setRestoreAskFocus(
      restoreKeyboardFocus || document.activeElement === askButtonRef.current,
    );
    void onAsk(cue.ask);
  };

  /**
   * El mentor flota sobre el contenido. Para que NUNCA tape una pregunta, un
   * botón o los datos del objeto, publica su altura real en `--mentor-inset` y
   * el contenido principal reserva ese espacio. Es sincronización con el DOM,
   * no estado de React: no provoca renders ni depende de un breakpoint.
   */
  useEffect(() => {
    const shell = shellRef.current;
    const root = document.documentElement;
    if (!shell) return;
    const publish = () => {
      const alto = Math.ceil(shell.getBoundingClientRect().height);
      // Se suma el hueco inferior del propio `aside` (bottom-3 / sm:bottom-5).
      root.style.setProperty("--mentor-inset", `${alto + 24}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(shell);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--mentor-inset");
    };
  }, []);

  return (
    <aside
      ref={shellRef}
      className="fixed bottom-3 right-3 z-40 w-[min(28rem,calc(100vw-1.5rem))] shadow-2xl shadow-black/45 sm:bottom-5 sm:right-5"
      aria-label="Mentor contextual"
      data-testid="mentor-contextual"
    >
      <div className="max-h-[42vh] overflow-y-auto border border-primary/35 bg-background/95 backdrop-blur-xl sm:max-h-[70vh]">
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
            {answer?.responseMode === "ai" ? (
              <Sparkles className="size-4" aria-hidden="true" />
            ) : (
              <Bot className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/75">
              Mentor contextual
            </p>
            <p
              className="truncate text-sm font-semibold text-foreground"
              data-testid="mentor-contextual-titulo"
            >
              {cue.title}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={collapsed ? "Desplegar mentor contextual" : "Plegar mentor contextual"}
            aria-expanded={!collapsed}
            data-testid="mentor-contextual-plegar"
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {cue.title}. {answer?.answer ?? error ?? cue.message}
        </div>

        <div className={cn("flex flex-col gap-3 px-4 py-4", collapsed && "hidden")}>
            <span
              className={cn(
                "w-fit border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                SOURCE_STYLES[cue.source],
              )}
            >
              {cue.eyebrow}
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground" data-testid="mentor-contextual-mensaje">
              {cue.message}
            </p>
            <div className="flex flex-wrap gap-2">
              {cue.ask !== null && (
                <Button
                  type="button"
                  ref={askButtonRef}
                  size="sm"
                  aria-disabled={!canAsk || loading}
                  className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  onFocus={(event) => {
                    askButtonRef.current = event.currentTarget;
                  }}
                  onClick={() => requestContext()}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    // El click sintético nativo puede llegar después de que una
                    // respuesta local haya repintado el botón y devolver el foco
                    // a <body>. Ejecutar la misma acción aquí mantiene el control
                    // estable para teclado y evita un segundo envío.
                    event.preventDefault();
                    requestContext(true);
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                  data-testid="mentor-contextual-preguntar"
                >
                  <Sparkles className={cn("size-4", loading && "animate-pulse")} aria-hidden="true" />
                  {loading ? "Revisando…" : answer ? "Analizar de nuevo" : "Analizar este contexto"}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={onOpenMentor}>
                <MessageCircleMore className="size-4" aria-hidden="true" />
                Ver conversación
              </Button>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground" data-testid="mentor-contextual-cargando">
                Contrastando este contexto con tu personaje, el motor y el diario…
              </p>
            )}

            {answer !== null && !loading && (
              <section
                className="border-l-2 border-emerald-400/50 bg-emerald-400/5 px-3 py-2"
                aria-label="Respuesta contextual"
                data-testid="mentor-contextual-respuesta"
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200"
                  data-testid="mentor-contextual-modo"
                >
                  {answerLabel(answer)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{answer.answer}</p>
                {answer.responseMode === "rules_fallback" && answer.fallbackReason && (
                  <p className="mt-1 text-xs text-amber-200">
                    La IA no pudo decidir: {answer.fallbackReason}
                  </p>
                )}
              </section>
            )}

            {error !== null && !loading && (
              <p className="border-l-2 border-destructive/60 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
      </div>
    </aside>
  );
}
