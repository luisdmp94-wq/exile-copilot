import { useRef, useState } from "react";
import { Bot, Loader2, SendHorizontal } from "lucide-react";
import type { CharacterProfile, Item } from "@shared/domain.js";
import { MAX_MENTOR_QUESTION_LENGTH, MAX_MENTOR_TURN_LENGTH, type MentorConversationTurn } from "@shared/mentorQuery.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import type { CompareStyle } from "@/lib/itemCompare";
import { cn } from "@/lib/utils";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    title: "Pregúntale al Mentor por este cambio",
    lead: "Te contesta con los números de estas dos piezas y de tu personaje.",
    examples: ["¿Por qué?", "¿Qué pierdo si me la pongo?", "¿Le sirve a mi habilidad?"],
    inputLabel: "Tu pregunta sobre este cambio",
    placeholder: "Por ejemplo: ¿y si me la pongo qué pierdo?",
    send: "Preguntar",
    thinking: "El Mentor está mirando las dos piezas…",
    you: "Tú",
    mentor: "Mentor",
    note: "Las cifras salen de comparar las dos piezas. El Mentor las explica; no calcula tu daño total.",
  },
  {
    title: "Ask the Mentor about this swap",
    lead: "It answers with the numbers from these two items and your character.",
    examples: ["Why?", "What do I lose if I wear it?", "Does it help my skill?"],
    inputLabel: "Your question about this swap",
    placeholder: "For example: what do I lose if I wear it?",
    send: "Ask",
    thinking: "The Mentor is looking at both items…",
    you: "You",
    mentor: "Mentor",
    note: "The numbers come from comparing the two items. The Mentor explains them; it doesn't work out your total damage.",
  },
);

interface GearMentorAskProps {
  profile: CharacterProfile;
  /** La pieza pegada. */
  found: Item;
  /** La que lleva en ese hueco; null si está vacío. */
  worn: Item | null;
  style: CompareStyle;
  minions: boolean;
}

/** Cuántos turnos viajan al servidor: los mismos que en el Mentor de la portada. */
const TURNS_SENT = 8;

/**
 * El Mentor de equipo (tarea 18 del plan): debajo del veredicto de «¿Me sirve
 * lo que he encontrado?», una caja para preguntar por ESE cambio. El servidor
 * rehace la comparación con sus reglas y contesta con sus frases; la IA, si
 * está, solo elige cuáles y escribe la entrada.
 *
 * La charla vive aquí, no en el hilo del Mentor de la portada: es de esta
 * pieza, y al mirar otra empieza de cero (quien la monta le pone `key`).
 */
export function GearMentorAsk({ profile, found, worn, style, minions }: GearMentorAskProps) {
  const t = useText(TEXT);
  const [turns, setTurns] = useState<MentorConversationTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const lastTurn = useRef<HTMLLIElement | null>(null);

  const ask = async (raw: string) => {
    const question = raw.trim().slice(0, MAX_MENTOR_QUESTION_LENGTH);
    if (!question || busy) return;
    const before = turns;
    setBusy(true);
    setError(null);
    setDraft("");
    setTurns([...before, { role: "player", text: question }]);
    try {
      const { answer } = await api.mentorQuery({
        question,
        profile,
        budget: null,
        goal: { kind: "balanced" },
        league: profile.league,
        patch: profile.patch,
        ...(before.length > 0 ? { conversation: before.slice(-TURNS_SENT) } : {}),
        gear: { found, wornId: worn?.id ?? null, style, minions },
      });
      if (!alive.current) return;
      setTurns([
        ...before,
        { role: "player", text: question },
        { role: "mentor", text: answer.answer.slice(0, MAX_MENTOR_TURN_LENGTH) },
      ]);
      requestAnimationFrame(() => lastTurn.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    } catch (err) {
      if (!alive.current) return;
      // La pregunta vuelve a la caja: no se pierde lo escrito.
      setTurns(before);
      setDraft(question);
      setError(getErrorMessage(err));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div
      className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3"
      ref={(node) => {
        alive.current = node !== null;
      }}
      data-testid="mentor-equipo"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Bot className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h3>
      {turns.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t.lead}</p>}

      {turns.length > 0 && (
        <ol className="mt-3 space-y-2" aria-live="polite" data-testid="mentor-equipo-charla">
          {turns.map((turn, index) => (
            <li
              key={`${index}-${turn.role}`}
              ref={index === turns.length - 1 ? lastTurn : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm leading-relaxed",
                turn.role === "player" ? "ml-6 bg-secondary/70 text-foreground" : "mr-2 bg-background/60 text-foreground/95",
              )}
              data-testid={turn.role === "mentor" ? "mentor-equipo-respuesta" : "mentor-equipo-pregunta"}
            >
              <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {turn.role === "player" ? t.you : t.mentor}
              </span>
              <span className="whitespace-pre-line break-words">{turn.text}</span>
            </li>
          ))}
        </ol>
      )}
      {busy && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t.thinking}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {t.examples.map((example) => (
          <Button
            key={example}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void ask(example)}
            data-testid="mentor-equipo-ejemplo"
          >
            {example}
          </Button>
        ))}
      </div>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
        data-testid="mentor-equipo-form"
      >
        <Input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          maxLength={MAX_MENTOR_QUESTION_LENGTH}
          aria-label={t.inputLabel}
          placeholder={t.placeholder}
          disabled={busy}
          className="min-w-0 flex-1"
          data-testid="mentor-equipo-caja"
        />
        <Button type="submit" size="sm" disabled={busy || draft.trim() === ""} data-testid="mentor-equipo-enviar">
          <SendHorizontal className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t.send}</span>
        </Button>
      </form>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t.note}</p>
    </div>
  );
}
