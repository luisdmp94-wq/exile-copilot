import { useState } from "react";
import { BookmarkPlus, Loader2, MessageCircleQuestion, PackageSearch, Send } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import type { MentorAnswer } from "@shared/mentorQuery.js";
import { MENTOR_SUGGESTIONS } from "@shared/mentorQuery.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MentorState, MentorTurn } from "@/hooks/useMentor";
import { CONFIDENCE_LABELS, LEVEL_BADGE_CLASSES, formatDateTime } from "@/lib/format";
import { MAX_MENTOR_QUESTION_LENGTH } from "@shared/mentorQuery.js";
import { cn } from "@/lib/utils";

/**
 * «Habla con tu mentor» (Hito 6A).
 *
 * Es OTRA forma de consultar al mentor, no un sustituto del resto de la app:
 * convive con personaje, equipo, recomendaciones y diario.
 *
 * El hilo vive solo en memoria (ver `useMentor`). Todo el texto se pinta como
 * TEXTO mediante JSX: React escapa el contenido y nunca se interpreta HTML.
 */

interface MentorChatSectionProps {
  profile: CharacterProfile | null;
  mentor: MentorState;
  onAsk: (question: string) => void;
  /** Guarda la próxima acción conversacional en el diario. */
  onSaveNextAction: (answer: MentorAnswer) => void;
  savingNextAction: boolean;
  /** Abre el detalle de un objeto; solo se ofrece con relatedItemIds. */
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
}

export function MentorChatSection({
  profile,
  mentor,
  onAsk,
  onSaveNextAction,
  savingNextAction,
  onFocusItem,
}: MentorChatSectionProps) {
  const [question, setQuestion] = useState("");
  const { turns, loading, error } = mentor;

  const canAsk = profile !== null && question.trim().length > 0 && !loading;

  const submit = (value: string) => {
    const texto = value.trim();
    if (profile === null || texto.length === 0 || loading) return;
    onAsk(texto);
    setQuestion("");
  };

  return (
    <Card id="seccion-mentor-chat">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl">5. Habla con tu mentor</CardTitle>
          <Badge variant="outline" className="text-muted-foreground">
            Respuestas deterministas
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          El mentor responde solo con tu personaje, tu build objetivo, tu presupuesto y tu
          diario. No inventa estadísticas, precios ni conocimiento del juego, y da una
          única próxima acción cada vez.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {profile === null ? (
          <Alert>
            <AlertTitle>Necesitas un personaje primero</AlertTitle>
            <AlertDescription>
              Carga el ejemplo o importa tu build en «Mi personaje». Sin personaje no puedo
              responder nada con datos tuyos, y no voy a improvisar.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preguntas que entiendo
              </span>
              <div className="flex flex-wrap gap-2">
                {MENTOR_SUGGESTIONS.map((sugerencia) => (
                  <Button
                    key={sugerencia}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    data-testid="mentor-sugerencia"
                    onClick={() => submit(sugerencia)}
                  >
                    {sugerencia}
                  </Button>
                ))}
              </div>
            </div>

            <div
              className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto"
              data-testid="mentor-hilo"
              aria-live="polite"
            >
              {turns.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">
                  Todavía no hemos hablado. Pregúntame qué mejorar ahora o por qué esa es tu
                  prioridad.
                </p>
              )}
              {turns.map((turn) => (
                <MentorTurnView key={turn.id} turn={turn} onFocusItem={onFocusItem} />
              ))}
              {loading && (
                <p
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  data-testid="mentor-cargando"
                >
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Consultando tu personaje, tu diario y el motor…
                </p>
              )}
            </div>

            {/* Guardar la acción del ÚLTIMO turno del mentor, si procede. */}
            <LastActionActions
              turns={turns}
              savingNextAction={savingNextAction}
              onSaveNextAction={onSaveNextAction}
            />

            {error !== null && (
              <Alert variant="destructive">
                <AlertTitle>No se pudo responder</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit(question);
              }}
            >
              <Label htmlFor="mentor-pregunta">Tu pregunta</Label>
              <Textarea
                id="mentor-pregunta"
                value={question}
                rows={2}
                maxLength={MAX_MENTOR_QUESTION_LENGTH}
                placeholder="p. ej. ¿Qué mejoro ahora?"
                disabled={loading}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  // Enter envía; Mayús+Enter permite escribir varias líneas.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(question);
                  }
                }}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!canAsk} data-testid="mentor-preguntar">
                  {loading ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  Preguntar
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Botonera del último turno del mentor (guardar la próxima acción). */
function LastActionActions({
  turns,
  savingNextAction,
  onSaveNextAction,
}: {
  turns: MentorTurn[];
  savingNextAction: boolean;
  onSaveNextAction: (answer: MentorAnswer) => void;
}) {
  const lastMentorTurn = [...turns].reverse().find((turn) => turn.answer !== null);
  const answer = lastMentorTurn?.answer ?? null;
  if (answer === null || answer.nextAction === null) return null;

  if (!answer.nextAction.canSaveToJournal) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="mentor-accion-recordada">
        Esta acción ya está registrada en tu diario: termínala y anota el resultado.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={savingNextAction}
        data-testid="mentor-guardar-accion"
        onClick={() => onSaveNextAction(answer)}
      >
        {savingNextAction ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <BookmarkPlus className="size-4" aria-hidden="true" />
        )}
        Guardar esta acción en el diario
      </Button>
      <span className="text-xs text-muted-foreground">
        Queda como tu única acción activa hasta que registres el resultado.
      </span>
    </div>
  );
}

function MentorTurnView({
  turn,
  onFocusItem,
}: {
  turn: MentorTurn;
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
}) {
  const esJugador = turn.role === "player";
  return (
    <div
      data-testid={esJugador ? "mentor-turno-jugador" : "mentor-turno-mentor"}
      className={cn(
        "max-w-full rounded-md border p-3 text-sm",
        esJugador
          ? "self-end border-primary/40 bg-primary/10"
          : "self-start border-border bg-muted/30",
      )}
    >
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {esJugador ? "Tú" : "Mentor"}
      </p>
      {/* Texto plano: React escapa el contenido, nunca se interpreta HTML. */}
      <p className="whitespace-pre-wrap break-words text-foreground">{turn.text}</p>
      {turn.answer !== null && <MentorAnswerDetail answer={turn.answer} onFocusItem={onFocusItem} />}
    </div>
  );
}

function MentorAnswerDetail({
  answer,
  onFocusItem,
}: {
  answer: MentorAnswer;
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {answer.unsupported !== null && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200">
          <AlertTitle>Todavía no sé responder eso</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>{answer.unsupported.reason}</span>
            <span className="text-xs">Prueba con:</span>
            <ul className="list-inside list-disc text-xs">
              {answer.unsupported.examples.map((ejemplo) => (
                <li key={ejemplo}>{ejemplo}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {answer.nextAction !== null && (
        <div
          className="rounded-md border border-primary/40 bg-primary/5 p-2"
          data-testid="mentor-proxima-accion"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tu única próxima acción
          </p>
          <p className="whitespace-pre-wrap break-words text-foreground">
            {answer.nextAction.text}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {answer.confidence !== null && (
          <Badge variant="outline" className={LEVEL_BADGE_CLASSES[answer.confidence]}>
            Confianza {CONFIDENCE_LABELS[answer.confidence]}
          </Badge>
        )}
        {answer.memoryImpact.blockedByPrimaryEntryId !== null && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">
            Diario: acción en curso
          </Badge>
        )}
        {answer.memoryImpact.repeatedRecommendationIds.length > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            Diario: {answer.memoryImpact.repeatedRecommendationIds.length} ya intentada(s)
          </Badge>
        )}
      </div>

      {answer.relatedItemIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Objetos implicados:</span>
          {answer.relatedItemIds.map((itemId) => (
            <Button
              key={itemId}
              type="button"
              variant="outline"
              size="sm"
              data-testid={`mentor-ver-objeto-${itemId}`}
              onClick={(event) => onFocusItem(itemId, event.currentTarget)}
            >
              <PackageSearch className="size-3.5" aria-hidden="true" />
              Ver objeto
            </Button>
          ))}
        </div>
      )}

      {answer.sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Fuentes
          </p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {answer.sources.map((source, index) => (
              <li key={`${source.kind}-${index}`}>
                {source.label} ({source.kind}) · {formatDateTime(source.retrievedAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.unverified.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="mentor-no-verificado">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300">
            Falta por verificar
          </p>
          <ul className="list-inside list-disc text-xs text-amber-200/90">
            {answer.unverified.map((nota, index) => (
              <li key={index}>{nota}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        <span>
          <MessageCircleQuestion className="mr-1 inline size-3" aria-hidden="true" />
          Intención: {answer.intent}
        </span>
        <span>· motor {answer.engineVersion}</span>
        <span>· {formatDateTime(answer.generatedAt)}</span>
      </p>
    </div>
  );
}
