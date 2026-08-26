import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, MessageCircleMore, Sparkles, X } from "lucide-react";
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
  blockedReason?: string | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onAsk: (ask: ContextualMentorAsk) => Promise<void>;
  onOpenMentor: () => void;
  /** Flotante fuera del Expediente; integrado cuando acompaña a la paperdoll. */
  placement?: "floating" | "inline";
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

function shouldSpeakAutomatically(
  cue: ContextualMentorCue,
  error: string | null,
  blockedReason: string | null,
): boolean {
  return (
    cue.id.startsWith("crafting-result:") ||
    cue.id.startsWith("crafting-coach:") ||
    cue.source === "warning" ||
    error !== null ||
    blockedReason !== null
  );
}

/** Presencia persistente: reacciona a decisiones semánticas, no a clics decorativos. */
export function ContextualMentor({
  cue,
  answer,
  error,
  loading,
  canAsk,
  blockedReason = null,
  collapsed,
  onCollapsedChange,
  onAsk,
  onOpenMentor,
  placement = "floating",
}: ContextualMentorProps) {
  const requestLockedRef = useRef(false);
  const shellRef = useRef<HTMLElement>(null);
  const askButtonRef = useRef<HTMLButtonElement | null>(null);
  const [restoreAskFocus, setRestoreAskFocus] = useState(false);
  const [dismissedSpeechKey, setDismissedSpeechKey] = useState<string | null>(null);
  const contentCollapsed = placement === "floating" && collapsed;
  const speechKey = `${cue.id}\n${cue.message}\n${error ?? ""}\n${blockedReason ?? ""}`;
  const speechVisible =
    placement === "floating" &&
    collapsed &&
    shouldSpeakAutomatically(cue, error, blockedReason) &&
    dismissedSpeechKey !== speechKey;

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
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const root = document.documentElement;
    if (placement !== "floating") {
      root.style.removeProperty("--mentor-inset");
      return;
    }
    if (!shell) return;
    const publish = () => {
      const alto = Math.ceil(shell.getBoundingClientRect().height);
      // Se suma el hueco inferior del propio `aside` (bottom-3 / sm:bottom-5).
      root.style.setProperty("--mentor-inset", `${alto + 24}px`);
    };
    publish();
    // El cambio de plegado y la aparición del bocadillo alteran la geometría
    // después del render. Un segundo cálculo en el frame siguiente cubre ese
    // cambio incluso si el navegador no emite ResizeObserver a tiempo.
    const frame = window.requestAnimationFrame(publish);
    const observer = new ResizeObserver(publish);
    observer.observe(shell);
    window.addEventListener("resize", publish);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--mentor-inset");
    };
  }, [placement, contentCollapsed, speechVisible]);

  /*
   * El Copiloto habla solo en momentos que cambian una decisión: resultados,
   * bloqueos y advertencias. El bocadillo usa el resultado canónico que ya
   * existe en pantalla; no dispara una petición de IA por cada interacción.
   */
  useEffect(() => {
    if (!speechVisible) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(
      () => setDismissedSpeechKey(speechKey),
      prefersReducedMotion ? 12_000 : 10_000,
    );
    return () => window.clearTimeout(timeout);
  }, [speechKey, speechVisible]);

  const openFromSpeech = () => {
    setDismissedSpeechKey(speechKey);
    onCollapsedChange(false);
  };

  return (
    <aside
      ref={shellRef}
      className={cn(
        placement === "floating"
          ? "mentor-floating-shell fixed bottom-3 right-3 z-40 sm:bottom-5 sm:right-5"
          : "mentor-lens relative z-10 w-full",
      )}
      aria-label="Mentor contextual"
      data-testid="mentor-contextual"
      data-placement={placement}
      data-collapsed={contentCollapsed ? "true" : "false"}
      data-speaking={speechVisible ? "true" : "false"}
    >
      {placement === "floating" && contentCollapsed && speechVisible && (
        <div
          className="mentor-speech-bubble"
          role="status"
          aria-live="polite"
          data-testid="mentor-speech-bubble"
          data-cue-id={cue.id}
        >
          <button
            type="button"
            className="mentor-speech-bubble__open"
            onClick={openFromSpeech}
            aria-label={`Abrir explicación del Copiloto: ${cue.title}`}
            data-testid="mentor-speech-open"
          >
            <span className="mentor-speech-bubble__speaker">Copiloto</span>
            <strong>{cue.title}</strong>
            <span className="mentor-speech-bubble__message">{error ?? blockedReason ?? cue.message}</span>
            <span className="mentor-speech-bubble__action">Ver explicación</span>
          </button>
          <button
            type="button"
            className="mentor-speech-bubble__dismiss"
            onClick={() => setDismissedSpeechKey(speechKey)}
            aria-label="Cerrar mensaje del Copiloto"
            data-testid="mentor-speech-dismiss"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {placement === "floating" && (
        <button
          type="button"
          className="mentor-floating-mascot"
          data-state={loading ? "thinking" : error ? "error" : answer?.responseMode === "ai" ? "ai" : "ready"}
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Abrir mentor contextual" : "Cerrar mentor contextual"}
          aria-expanded={!collapsed}
          title={collapsed ? "Abrir mentor" : "Cerrar mentor"}
          data-testid="mentor-mascota"
        >
          <span className="mentor-robot" aria-hidden="true">
            <span className="mentor-robot__antenna">
              <span />
            </span>
            <span className="mentor-robot__head">
              <span className="mentor-robot__eyes">
                <span />
                <span />
              </span>
              <span className="mentor-robot__mouth" />
            </span>
            <span className="mentor-robot__body">
              <Bot className="size-5" />
            </span>
          </span>
          <span className="mentor-floating-mascot__hint">Hablar</span>
        </button>
      )}

      <div
        className={cn(
          "overflow-y-auto border border-primary/35 bg-background/95 backdrop-blur-xl",
          placement === "floating"
            ? contentCollapsed
              ? "hidden"
              : "max-h-[40vh] sm:max-h-[70vh]"
            : "mentor-lens__surface",
          placement === "inline" && "mentor-companion",
        )}
      >
        {placement === "inline" && (
          <button
            type="button"
            className="mentor-mascot"
            data-state={loading ? "thinking" : error ? "error" : answer?.responseMode === "ai" ? "ai" : "ready"}
            onClick={onOpenMentor}
            aria-label="Abrir conversación con tu Copiloto"
            title="Hablar con tu Copiloto"
            data-testid="mentor-mascota"
          >
            <span className="mentor-robot" aria-hidden="true">
              <span className="mentor-robot__antenna">
                <span />
              </span>
              <span className="mentor-robot__head">
                <span className="mentor-robot__eyes">
                  <span />
                  <span />
                </span>
                <span className="mentor-robot__mouth" />
              </span>
              <span className="mentor-robot__body">
                <Bot className="size-5" />
              </span>
            </span>
            <span className="mentor-mascot__status">
              <span className="ai-dot" aria-hidden="true" />
              {loading ? "Pensando" : error ? "Alerta" : "Copiloto"}
            </span>
          </button>
        )}

        <div
          className={cn(
            "flex items-center gap-3 border-b border-border/70 px-4 py-3",
            placement === "inline" && "mentor-companion__header",
            placement === "floating" && "mentor-floating-header",
          )}
        >
          <span className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary",
            placement === "inline" || placement === "floating" ? "hidden" : null,
          )}>
            {answer?.responseMode === "ai" ? (
              <Sparkles className="size-4" aria-hidden="true" />
            ) : (
              <Bot className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/75">
              {placement === "inline" ? "Tu Copiloto" : "Mentor contextual"}
            </p>
            <p
              className="truncate text-sm font-semibold text-foreground"
              data-testid="mentor-contextual-titulo"
            >
              {cue.title}
            </p>
          </div>
          {placement === "floating" && (
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
          )}
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {cue.title}. {answer?.answer ?? error ?? cue.message}
        </div>

        <div className={cn(
          "flex flex-col gap-3 px-4 py-4",
          contentCollapsed && "hidden",
          placement === "inline" && "mentor-companion__body",
        )}>
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
            {blockedReason !== null && (
              <p
                className="border-l-2 border-amber-400/60 bg-amber-400/5 px-3 py-2 text-xs text-amber-100"
                data-testid="mentor-contextual-patch-review-gate"
              >
                {blockedReason}
              </p>
            )}
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
                  {loading
                    ? "Pensando…"
                    : blockedReason
                      ? "Esperando revisión"
                    : answer
                      ? "Preguntar de nuevo"
                      : placement === "inline"
                        ? "Preguntarle"
                        : "Analizar este contexto"}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={onOpenMentor}>
                <MessageCircleMore className="size-4" aria-hidden="true" />
                {placement === "inline" ? "Abrir chat" : "Ver conversación"}
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
