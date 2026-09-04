import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Loader2, PackageSearch, PencilLine, Send } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { assessMentorReadiness } from "@shared/characterReadiness.js";
import type { MentorAnswer } from "@shared/mentorQuery.js";
import { MENTOR_SUGGESTIONS } from "@shared/mentorQuery.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MentorState } from "@/hooks/useMentor";
import type { MentorTurn } from "@/lib/mentorThread";
import { savableNextAction } from "@/lib/mentorThread";
import {
  CONFIDENCE_BADGE_CLASSES,
  CONFIDENCE_LABELS,
  SOURCE_KIND_LABELS,
  formatDateTime,
} from "@/lib/format";
import { MAX_MENTOR_QUESTION_LENGTH } from "@shared/mentorQuery.js";
import { cn } from "@/lib/utils";
import {
  allowsPatchGuidance,
  type PatchCompatibilityRecord,
} from "@shared/patchCompatibility.js";

/**
 * «Habla con tu mentor» (Hito 6A).
 *
 * Es OTRA forma de consultar al mentor, no un sustituto del resto de la app:
 * convive con personaje, equipo, recomendaciones y diario.
 *
 * PRESENTACIÓN: la respuesta principal se lee como la contaría una persona —
 * diagnóstico, una única próxima acción y confianza. La trazabilidad (fuentes,
 * fecha, versión del motor, tipo de consulta y lo no verificado) sigue completa,
 * pero vive en «Ver evidencia y limitaciones»: nunca se muestran identificadores
 * internos (`next_improvement`, `calculation`, `high`…) en el texto visible.
 *
 * Mentor v4 conserva hasta ocho turnos durante la sesión del navegador y los
 * invalida al cambiar cualquier input autoritativo. Todo el texto se pinta
 * como TEXTO mediante JSX: React escapa el contenido y nunca interpreta HTML.
 */

/** Tipo de consulta en español; el id interno nunca se muestra. */
const INTENT_LABELS: Record<MentorAnswer["intent"], string> = {
  conversation: "Conversación",
  next_improvement: "Qué mejorar ahora",
  explain_priority: "Por qué esa es tu prioridad",
  unsupported: "Fuera de lo que sé responder",
};

interface MentorChatSectionProps {
  profile: CharacterProfile | null;
  patchCompatibility: PatchCompatibilityRecord | null;
  mentor: MentorState;
  onAsk: (question: string) => void;
  /** Guarda la próxima acción conversacional en el diario. */
  onSaveNextAction: (answer: MentorAnswer) => void;
  savingNextAction: boolean;
  /** Abre el detalle de un objeto; solo se ofrece con relatedItemIds. */
  onFocusItem: (itemId: string, trigger: HTMLElement) => void;
  /** Lleva al jugador a completar los datos observados que faltan. */
  onEditProfile: () => void;
}

export function MentorChatSection({
  profile,
  patchCompatibility,
  mentor,
  onAsk,
  onSaveNextAction,
  savingNextAction,
  onFocusItem,
  onEditProfile,
}: MentorChatSectionProps) {
  const [question, setQuestion] = useState("");
  const { turns, loading, error } = mentor;
  const threadRef = useRef<HTMLDivElement | null>(null);
  const latestAnswer = [...turns].reverse().find((turn) => turn.answer !== null)?.answer ?? null;
  const modeLabel =
    latestAnswer?.responseMode === "ai"
      ? "IA fundamentada"
      : latestAnswer?.responseMode === "rules_fallback"
        ? "Respaldo por reglas"
        : "Reglas verificables";

  const patchBlocked =
    patchCompatibility !== null && !allowsPatchGuidance(patchCompatibility);
  const readiness = assessMentorReadiness(profile);
  const canAsk =
    profile !== null &&
    readiness.ready &&
    !patchBlocked &&
    question.trim().length > 0 &&
    !loading;
  const visibleSuggestions =
    turns.length === 0
      ? [MENTOR_SUGGESTIONS[0], MENTOR_SUGGESTIONS[2]]
      : [MENTOR_SUGGESTIONS[0], MENTOR_SUGGESTIONS[3]];

  // Cada pregunta, respuesta o estado de carga deja el ÚLTIMO turno a la vista.
  // Se desplaza el CONTENEDOR del hilo (`scrollTo` sobre el propio elemento),
  // nunca la página: la sección no salta bajo el cursor del jugador.
  useEffect(() => {
    const container = threadRef.current;
    if (container === null) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [turns.length, loading]);

  const submit = (value: string) => {
    const texto = value.trim();
    if (
      profile === null ||
      !readiness.ready ||
      patchBlocked ||
      texto.length === 0 ||
      loading
    ) return;
    onAsk(texto);
    setQuestion("");
  };

  return (
    /* El título («Habla con tu Mentor») lo pone la sección que envuelve a este
       componente. Aquí solo queda la procedencia de la respuesta, que sí cambia
       con cada turno y no es un rótulo decorativo. */
    <Card id="seccion-mentor-chat" data-testid="mentor-chat-principal" className="gap-0 border-0 bg-transparent py-0 shadow-none">
      <CardContent className="flex flex-col gap-3 px-0">
        <Badge
          variant="outline"
          className={cn(
            "w-fit",
            latestAnswer?.responseMode === "ai"
              ? "border-primary/45 bg-primary/10 text-primary"
              : latestAnswer?.responseMode === "rules_fallback"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "text-muted-foreground",
          )}
          data-testid="mentor-modo"
        >
          {modeLabel}
        </Badge>
        {profile === null ? (
          <Alert>
            <AlertTitle>Necesitas un personaje primero</AlertTitle>
            <AlertDescription>
              Carga el ejemplo o importa tu build en «Mi personaje». Sin personaje no puedo
              responder nada con datos tuyos, y no voy a improvisar.
            </AlertDescription>
          </Alert>
        ) : !readiness.ready ? (
          <Alert data-testid="mentor-profile-readiness-gate">
            <AlertTitle>Completa el expediente antes de pedir una prioridad</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                El Mentor no convertirá un plan parcial en datos de tu personaje real.
                Faltan: {readiness.issues.map((issue) => issue.label.toLowerCase()).join(", ")}.
              </p>
              <Button type="button" variant="secondary" onClick={onEditProfile}>
                <PencilLine className="size-4" aria-hidden="true" />
                Completar expediente
              </Button>
            </AlertDescription>
          </Alert>
        ) : patchBlocked ? (
          <Alert data-testid="mentor-chat-patch-review-gate">
            <AlertTitle>El mentor está esperando la revisión de {patchCompatibility.patchId}</AlertTitle>
            <AlertDescription>
              {patchCompatibility.summary} No propondrá mejoras ni acciones mecánicas usando datos del parche anterior.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
                {visibleSuggestions.map((sugerencia) => (
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

            <div
              ref={threadRef}
              className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto overscroll-contain"
              data-testid="mentor-hilo"
              aria-live="polite"
            >
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
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                submit(question);
              }}
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor="mentor-pregunta" className="sr-only">Tu pregunta</Label>
                <Textarea
                  id="mentor-pregunta"
                  value={question}
                  rows={1}
                  maxLength={MAX_MENTOR_QUESTION_LENGTH}
                  placeholder="Pregúntale algo sobre tu personaje"
                  className="min-h-10 resize-none"
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
              </div>
              {/* Alineado a la izquierda, con el campo. Antes vivía en la esquina
                  inferior derecha, justo donde flota el Copiloto: la mascota
                  tapaba el único botón de envío del Mentor. */}
              <div className="flex justify-start sm:shrink-0">
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
  const savable = savableNextAction(turns);

  if (savable === null) {
    // Solo se avisa de la acción RECORDADA cuando existe y ya está en el diario.
    const lastMentorTurn = [...turns].reverse().find((turn) => turn.answer !== null);
    const recalled = lastMentorTurn?.answer ?? null;
    if (recalled === null || recalled.nextAction === null) return null;
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
        onClick={() => onSaveNextAction(savable)}
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

      {/* 1) La única próxima acción. */}
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

      {/* 2) Confianza (siempre en español) y estado del diario. */}
      <div className="flex flex-wrap items-center gap-2">
        {answer.confidence !== null && (
          <Badge variant="outline" className={CONFIDENCE_BADGE_CLASSES[answer.confidence]}>
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

      {/* 3) Trazabilidad completa, solo cuando realmente existe evidencia. */}
      {(answer.sources.length > 0 ||
        answer.unverified.length > 0 ||
        answer.confidence !== null ||
        answer.fallbackReason != null ||
        answer.usedRecommendationIds.length > 0) && <MentorEvidence answer={answer} />}
    </div>
  );
}

/**
 * «Ver evidencia y limitaciones»: fuentes, lo que falta por verificar, tipo de
 * consulta, versión del motor y momento de la respuesta. Se conserva TODA la
 * trazabilidad, pero fuera de la lectura principal. `<details>` nativo: se abre
 * con teclado y los lectores de pantalla lo anuncian como grupo desplegable.
 */
function MentorEvidence({ answer }: { answer: MentorAnswer }) {
  return (
    <details
      className="rounded-md border border-border/60 bg-background/40"
      data-testid="mentor-evidencia"
    >
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-muted-foreground">
        Ver evidencia y limitaciones
      </summary>

      <div className="flex flex-col gap-3 px-2 pb-2 pt-1">
        {answer.sources.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="mentor-fuentes">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Fuentes
            </p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {answer.sources.map((source, index) => (
                <li key={`${source.kind}-${index}`}>
                  {source.label} · {SOURCE_KIND_LABELS[source.kind]} ·{" "}
                  {formatDateTime(source.retrievedAt)}
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

        <p className="text-[11px] text-muted-foreground">
          Las fechas y la evidencia pueden cambiar: los precios proceden del servicio
          documentado de poe.ninja cuando el motor los necesita, y el diario se actualiza
          con lo que vas registrando.
        </p>

        <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          <span>Tipo de consulta: {INTENT_LABELS[answer.intent]}</span>
          <span>· Motor {answer.engineVersion}</span>
          <span>
            · Respuesta: {answer.responseMode === "ai" ? "IA fundamentada" : answer.responseMode === "rules_fallback" ? "reglas de respaldo" : "reglas"}
          </span>
          {answer.model != null && <span>· Modelo {answer.model}</span>}
          <span>· Respondido el {formatDateTime(answer.generatedAt)}</span>
        </p>

        {answer.fallbackReason != null && (
          <p className="text-[11px] text-amber-200" data-testid="mentor-fallback">
            {answer.fallbackReason}
          </p>
        )}
      </div>
    </details>
  );
}
