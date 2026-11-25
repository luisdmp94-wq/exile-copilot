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
    // Corto: en el móvil el texto largo se cortaba, y los ejemplos ya van debajo.
    placeholder: "Escribe tu pregunta",
    ask: "Preguntar",
    examplesLabel: "Preguntas de ejemplo",
    // Las tres las reconoce el clasificador del servidor (tests/unit/mentorIntent.test.ts).
    // Las tres encajan con lo que contesta el Mentor aunque aún no haya equipo
    // (la revisión rápida: qué te frena). «¿Qué puedes hacer?» se quedaba en
    // «te la contesto cuando completes el personaje».
    examples: ["¿Por qué muero tanto?", "¿Qué mejoro ahora?", "¿Cuál es mi principal problema?"],
  },
  {
    label: "Ask the mentor",
    placeholder: "Type your question",
    ask: "Ask",
    examplesLabel: "Example questions",
    examples: ["Why do I keep dying?", "What should I improve now?", "What's my main problem?"],
  },
);

/**
 * Pregunta rápida al pie de «Tu siguiente paso». No responde aquí: entrega el
 * texto a la conversación del Mentor, que es la única que valida, envía y
 * guarda el hilo.
 *
 * Lleva tres preguntas de ejemplo que se envían con un clic: en una semana de
 * noviembre de 2026 el Mentor recibió 5 preguntas de 153 visitantes, y nadie
 * sabía qué preguntarle.
 */
export function MentorQuickAsk({ onAsk }: { onAsk: (question: string) => void }) {
  const t = useText(TEXT);
  const [question, setQuestion] = useState("");
  const canSend = question.trim().length > 0;

  return (
    <div className="flex flex-col gap-2.5">
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
          // Sin esto el navegador despliega aquí las preguntas antiguas y tapa
          // los ejemplos de debajo (captura de Luis, 25-11-2026).
          autoComplete="off"
          className="h-10 min-w-0 flex-1"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!canSend} className="h-10 shrink-0">
          <Send className="size-4" aria-hidden="true" />
          {t.ask}
        </Button>
      </form>
      {/* Compactos: en el móvil caben dos por fila en vez de uno. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.examplesLabel}>
        {t.examples.map((example) => (
          <Button
            key={example}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 whitespace-normal px-2.5 py-1 text-left text-xs"
            data-testid="mentor-ejemplo"
            onClick={() => onAsk(example)}
          >
            {example}
          </Button>
        ))}
      </div>
    </div>
  );
}
