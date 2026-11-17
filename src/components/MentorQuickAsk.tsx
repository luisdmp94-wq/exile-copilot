import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_MENTOR_QUESTION_LENGTH } from "@shared/mentorQuery.js";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    label: "Pregúntale al mentor",
    placeholder: "Pregúntale al mentor, p. ej. ¿por qué muero?",
    ask: "Preguntar",
  },
  {
    label: "Ask the mentor",
    placeholder: "Ask the mentor, e.g. why do I keep dying?",
    ask: "Ask",
  },
);

/**
 * Pregunta rápida al pie de «Tu siguiente paso». No responde aquí: entrega el
 * texto a la conversación del Mentor, que es la única que valida, envía y
 * guarda el hilo.
 */
export function MentorQuickAsk({ onAsk }: { onAsk: (question: string) => void }) {
  const t = useText(TEXT);
  const [question, setQuestion] = useState("");
  const canSend = question.trim().length > 0;

  return (
    <form
      className="flex items-center gap-2"
      data-testid="mentor-pregunta-rapida-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        onAsk(question.trim());
        setQuestion("");
      }}
    >
      <Label htmlFor="mentor-pregunta-rapida" className="sr-only">
        {t.label}
      </Label>
      <Input
        id="mentor-pregunta-rapida"
        value={question}
        maxLength={MAX_MENTOR_QUESTION_LENGTH}
        placeholder={t.placeholder}
        className="h-10 min-w-0 flex-1"
        onChange={(event) => setQuestion(event.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={!canSend} className="h-10 shrink-0">
        <Send className="size-4" aria-hidden="true" />
        {t.ask}
      </Button>
    </form>
  );
}
