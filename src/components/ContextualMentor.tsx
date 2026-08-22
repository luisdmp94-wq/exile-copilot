import { useState } from "react";
import { Bot, ChevronDown, ChevronUp, MessageCircleMore, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContextualMentorCue } from "@/lib/contextualMentor";

interface ContextualMentorProps {
  cue: ContextualMentorCue;
  loading: boolean;
  canAsk: boolean;
  onAsk: (question: string) => void;
  onOpenMentor: () => void;
}

const SOURCE_STYLES: Record<ContextualMentorCue["source"], string> = {
  guide: "border-primary/45 bg-primary/10 text-primary",
  engine: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  market: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  ai: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};

/** Presencia persistente: reacciona a decisiones semánticas, no a clics decorativos. */
export function ContextualMentor({
  cue,
  loading,
  canAsk,
  onAsk,
  onOpenMentor,
}: ContextualMentorProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="fixed bottom-3 right-3 z-40 w-[min(28rem,calc(100vw-1.5rem))] shadow-2xl shadow-black/45 sm:bottom-5 sm:right-5"
      aria-label="Mentor contextual"
      data-testid="mentor-contextual"
    >
      <div className="overflow-hidden border border-primary/35 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
            {cue.source === "ai" ? (
              <Sparkles className="size-4" aria-hidden="true" />
            ) : (
              <Bot className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/75">
              Mentor contextual
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{cue.title}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={collapsed ? "Desplegar mentor contextual" : "Plegar mentor contextual"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {!collapsed && (
          <div className="flex flex-col gap-3 px-4 py-4" aria-live="polite">
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
              {cue.question !== null && (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canAsk || loading}
                  onClick={() => onAsk(cue.question!)}
                  data-testid="mentor-contextual-preguntar"
                >
                  <Sparkles className={cn("size-4", loading && "animate-pulse")} aria-hidden="true" />
                  {loading ? "Revisando…" : "Analizar este contexto"}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={onOpenMentor}>
                <MessageCircleMore className="size-4" aria-hidden="true" />
                Ver conversación
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
