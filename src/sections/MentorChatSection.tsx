import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, ClipboardCheck, Loader2, PackageSearch, PencilLine, Send } from "lucide-react";
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
import { CONFIDENCE_BADGE_CLASSES, formatDateTime, displaySourceLabel } from "@/lib/format";
import { useFormatLabels } from "@/lib/formatLabels";
import { MAX_MENTOR_QUESTION_LENGTH } from "@shared/mentorQuery.js";
import { cn } from "@/lib/utils";
import { firstGapsToAsk, joinGapList, reviewCharacter } from "@shared/quickReview.js";
import { mentorReviewAnswer } from "@/lib/mentorReviewAnswer";
import { useQuickReviewForm } from "@/hooks/useQuickReviewForm";
import { profileWithQuickReview, toInput } from "@/lib/quickReviewForm";
import { texts, useLang, useText } from "@/i18n/lang";
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

/**
 * Textos en los dos idiomas. El tipo de consulta se muestra con palabras; el
 * id interno nunca. Las preguntas de ejemplo en inglés son las que reconoce
 * el clasificador del servidor cuando la página está en inglés.
 */
const TEXT = texts(
  {
    intentLabels: {
      conversation: "Conversación",
      next_improvement: "Qué mejorar ahora",
      explain_priority: "Por qué esa es tu prioridad",
      unsupported: "Fuera de lo que sé responder",
    } as Record<MentorAnswer["intent"], string>,
    suggestions: [...MENTOR_SUGGESTIONS] as string[],
    modeAi: "IA fundamentada",
    // Antes «Respaldo por reglas», en ámbar: parecía un error. Las reglas
    // contestan bien; la causa técnica sigue en «Ver evidencia y limitaciones».
    modeFallback: "Respuesta por reglas",
    modeRules: "Reglas verificables",
    noProfileTitle: "Necesitas un personaje primero",
    noProfileBody:
      "Carga el ejemplo o importa tu build en «Mi personaje». Sin personaje no puedo responder nada con datos tuyos, y no voy a improvisar.",
    readinessTitle: "Para responderte necesito más datos de tu personaje",
    readinessMissing: (missing: string) =>
      `Falta: ${missing}. Complétalo y te respondo; no me invento lo que no sé de tu personaje.`,
    readinessPending: (question: string) =>
      `Tu pregunta queda guardada: «${question}». Te respondo en cuanto completes el personaje.`,
    readinessButton: "Completar personaje",
    // Sin equipo todavía: el Mentor contesta con la revisión rápida (reglas).
    reviewFoundTitle: "Aún sin tu equipo, esto ya lo veo",
    reviewSurvivalTitle: "Por qué mueres, con lo que ya veo",
    reviewDamageTitle: "Por qué te falta daño, con lo que ya veo",
    reviewMainTitle: "Tu principal problema, con lo que ya veo",
    reviewAskTitle: "Dime unos datos del juego y te digo qué te frena",
    reviewAskBody: (missing: string) => `Dime ${missing}: lo ves en el juego y es un minuto.`,
    reviewClearTitle: "Con lo que me has contado no veo nada grave",
    reviewClearBody: "Pega una pieza de tu equipo y te digo cuál mejorar primero.",
    reviewSource: "De tu revisión rápida: reglas del juego, sin IA.",
    reviewAnd: "y",
    reviewOpen: "Ir a la revisión rápida",
    reviewOpenFull: "Ver la revisión completa",
    deepMissing: (missing: string) => `Para una respuesta a fondo me falta: ${missing}.`,
    // La pregunta ya se ve arriba como burbuja: aquí no se repite.
    deepPending: "Tu pregunta queda guardada: te la contesto a fondo cuando lo completes.",
    patchTitle: (patchId: string) => `El mentor está esperando la revisión de ${patchId}`,
    patchBody: (summary: string) =>
      `${summary} No propondrá mejoras ni acciones mecánicas usando datos del parche anterior.`,
    loading: "Consultando tu personaje, tu diario y el motor…",
    errorTitle: "No se pudo responder",
    questionLabel: "Tu pregunta",
    questionPlaceholder: "Pregúntale algo sobre tu personaje",
    ask: "Preguntar",
    recalled: "Esta acción ya está registrada en tu diario: termínala y anota el resultado.",
    saveAction: "Guardar esta acción en el diario",
    saveHint: "Queda como tu única acción activa hasta que registres el resultado.",
    you: "Tú",
    mentor: "Mentor",
    unsupportedTitle: "Todavía no sé responder eso",
    tryWith: "Prueba con:",
    nextActionTitle: "Tu única próxima acción",
    confidence: (label: string) => `Confianza ${label}`,
    journalBusy: "Diario: acción en curso",
    journalRepeated: (count: number) => `Diario: ${count} ya intentada(s)`,
    relatedItems: "Objetos implicados:",
    viewItem: "Ver objeto",
    evidenceSummary: "Ver evidencia y limitaciones",
    sources: "Fuentes",
    unverified: "Falta por verificar",
    evidenceNote:
      "Las fechas y la evidencia pueden cambiar: los precios proceden del servicio documentado de poe.ninja cuando el motor los necesita, y el diario se actualiza con lo que vas registrando.",
    queryType: (label: string) => `Tipo de consulta: ${label}`,
    engine: (version: string) => `· Motor ${version}`,
    responseAi: "IA fundamentada",
    responseFallback: "reglas de respaldo",
    responseRules: "reglas",
    response: (mode: string) => `· Respuesta: ${mode}`,
    model: (model: string) => `· Modelo ${model}`,
    answeredAt: (date: string) => `· Respondido el ${date}`,
  },
  {
    intentLabels: {
      conversation: "Conversation",
      next_improvement: "What to improve now",
      explain_priority: "Why that is your priority",
      unsupported: "Outside what I can answer",
    },
    suggestions: [
      "What should I improve now?",
      "What should I do first?",
      "What's my main problem?",
      "Why do you recommend this?",
    ],
    modeAi: "Grounded AI",
    modeFallback: "Answer from rules",
    modeRules: "Checkable rules",
    noProfileTitle: "You need a character first",
    noProfileBody:
      "Load the example or import your build in “My character”. Without a character I can't answer anything with your data, and I won't make things up.",
    readinessTitle: "To answer you, I need more about your character",
    readinessMissing: (missing: string) =>
      `Missing: ${missing}. Fill it in and I'll answer; I won't make up what I don't know about your character.`,
    readinessPending: (question: string) =>
      `Your question is saved: “${question}”. I'll answer as soon as you complete your character.`,
    readinessButton: "Finish character file",
    reviewFoundTitle: "Even without your gear, I can already see this",
    reviewSurvivalTitle: "Why you keep dying, from what I can see",
    reviewDamageTitle: "Why you're low on damage, from what I can see",
    reviewMainTitle: "Your main problem, from what I can see",
    reviewAskTitle: "Tell me a few things from the game and I'll tell you what's holding you back",
    reviewAskBody: (missing: string) => `Tell me ${missing}: you can see it in the game and it takes a minute.`,
    reviewClearTitle: "From what you've told me, I see nothing serious",
    reviewClearBody: "Paste one of your items and I'll tell you which to improve first.",
    reviewSource: "From your quick review: game rules, no AI.",
    reviewAnd: "and",
    reviewOpen: "Go to the quick review",
    reviewOpenFull: "See the full review",
    deepMissing: (missing: string) => `For an in-depth answer I'm missing: ${missing}.`,
    deepPending: "Your question is saved: I'll answer it in depth once you complete it.",
    patchTitle: (patchId: string) => `The mentor is waiting for the ${patchId} review`,
    patchBody: (summary: string) =>
      `${summary} It won't suggest upgrades or mechanical actions using data from the previous patch.`,
    loading: "Checking your character, your journal and the engine…",
    errorTitle: "Couldn't answer",
    questionLabel: "Your question",
    questionPlaceholder: "Ask something about your character",
    ask: "Ask",
    recalled: "This action is already in your journal: finish it and log the result.",
    saveAction: "Save this action to the journal",
    saveHint: "It stays as your only active action until you log the result.",
    you: "You",
    mentor: "Mentor",
    unsupportedTitle: "I can't answer that yet",
    tryWith: "Try:",
    nextActionTitle: "Your one next action",
    confidence: (label: string) => `${label} confidence`,
    journalBusy: "Journal: action in progress",
    journalRepeated: (count: number) => `Journal: ${count} already tried`,
    relatedItems: "Items involved:",
    viewItem: "View item",
    evidenceSummary: "See evidence and limits",
    sources: "Sources",
    unverified: "Still to check",
    evidenceNote:
      "Dates and evidence can change: prices come from poe.ninja's documented service when the engine needs them, and the journal updates with what you log.",
    queryType: (label: string) => `Question type: ${label}`,
    engine: (version: string) => `· Engine ${version}`,
    responseAi: "grounded AI",
    responseFallback: "fallback rules",
    responseRules: "rules",
    response: (mode: string) => `· Answer: ${mode}`,
    model: (model: string) => `· Model ${model}`,
    answeredAt: (date: string) => `· Answered on ${date}`,
  },
);

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
  /** Abre la «Revisión rápida». Con esto, sin equipo el Mentor contesta con ella. */
  onOpenQuickReview?: () => void;
  /**
   * Pregunta escrita en «Tu siguiente paso». Cada `seq` nuevo se envía con
   * las mismas reglas que el formulario propio; si aún no se puede preguntar,
   * el texto se queda en el campo para no perderlo.
   */
  pendingQuestion?: { text: string; seq: number } | null;
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
  onOpenQuickReview,
  pendingQuestion = null,
}: MentorChatSectionProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  // Lo que el jugador ya contestó en la revisión rápida: sin equipo, el
  // Mentor responde con eso en vez de quedarse en «me faltan datos».
  const reviewForm = useQuickReviewForm(profile);
  const review = reviewCharacter(toInput(reviewForm), lang);
  const reviewGaps = firstGapsToAsk(review);
  const [question, setQuestion] = useState("");
  const { turns, loading, error } = mentor;
  const threadRef = useRef<HTMLDivElement | null>(null);
  const latestAnswer = [...turns].reverse().find((turn) => turn.answer !== null)?.answer ?? null;
  const modeLabel =
    latestAnswer?.responseMode === "ai"
      ? t.modeAi
      : latestAnswer?.responseMode === "rules_fallback"
        ? t.modeFallback
        : t.modeRules;

  const patchBlocked =
    patchCompatibility !== null && !allowsPatchGuidance(patchCompatibility);
  const readiness = assessMentorReadiness(profile);
  // Solo para decir qué falta: lo que el jugador ya escribió en la revisión
  // rápida (su nivel, por ejemplo) no se le vuelve a pedir aquí. Quién
  // responde (la revisión o el motor) no cambia por esto.
  const stillMissing = assessMentorReadiness(profile ? profileWithQuickReview(profile, reviewForm) : null).issues;
  const canAsk =
    profile !== null &&
    readiness.ready &&
    !patchBlocked &&
    question.trim().length > 0 &&
    !loading;
  // Antes de la primera pregunta, los ejemplos van en «Tu siguiente paso»
  // (MentorQuickAsk): repetirlos aquí debajo sobraba. Tras una respuesta, las
  // de seguimiento sí ayudan.
  const visibleSuggestions =
    turns.length === 0 ? [] : [t.suggestions[0], t.suggestions[3]];

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

  // Pregunta llegada desde «Tu siguiente paso». Si se puede preguntar, se
  // envía (efecto: llama al servidor); si no, el texto se copia al campo
  // durante el render para que el jugador no lo pierda.
  const pendingText = pendingQuestion?.text.trim() ?? "";
  const pendingAllowed =
    profile !== null && readiness.ready && !patchBlocked && pendingText.length > 0 && !loading;
  const [seenPendingSeq, setSeenPendingSeq] = useState<number | null>(null);
  if (pendingQuestion !== null && pendingQuestion.seq !== seenPendingSeq) {
    setSeenPendingSeq(pendingQuestion.seq);
    if (!pendingAllowed) setQuestion(pendingQuestion.text);
  }
  // Si al llegar faltaban datos del personaje, la pregunta espera y se envía
  // sola en cuanto el expediente queda completo: el jugador no la repite.
  const askedPendingSeq = useRef<number | null>(null);
  useEffect(() => {
    if (pendingQuestion === null || askedPendingSeq.current === pendingQuestion.seq) return;
    if (!pendingAllowed) return;
    askedPendingSeq.current = pendingQuestion.seq;
    onAsk(pendingText);
  }, [pendingQuestion, pendingAllowed, pendingText, onAsk]);
  // Una vez enviada, la copia que esperaba en el campo ya sobra.
  const [clearedPendingSeq, setClearedPendingSeq] = useState<number | null>(null);
  if (pendingQuestion !== null && pendingAllowed && clearedPendingSeq !== pendingQuestion.seq) {
    setClearedPendingSeq(pendingQuestion.seq);
    if (question.trim() === pendingText) setQuestion("");
  }
  // Mientras falten datos, la pregunta llegada se copia al campo (arriba) y
  // espera ahí: es la que se enseña como «guardada».
  const waitingQuestion =
    !pendingAllowed && pendingText.length > 0 && question.trim() === pendingText
      ? pendingText
      : null;
  // Sin equipo, la revisión rápida contesta según lo que se ha preguntado.
  const reviewAnswer = mentorReviewAnswer(review, waitingQuestion);
  const reviewTitle =
    reviewAnswer.mode === "survival"
      ? t.reviewSurvivalTitle
      : reviewAnswer.mode === "damage"
        ? t.reviewDamageTitle
        : reviewAnswer.mode === "main"
          ? t.reviewMainTitle
          : t.reviewFoundTitle;

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
              : "text-muted-foreground",
          )}
          data-testid="mentor-modo"
        >
          {modeLabel}
        </Badge>
        {profile === null ? (
          <Alert>
            <AlertTitle>{t.noProfileTitle}</AlertTitle>
            <AlertDescription>{t.noProfileBody}</AlertDescription>
          </Alert>
        ) : !readiness.ready ? (
          onOpenQuickReview ? (
            <>
            {/* La pregunta del jugador se ve como en la conversación: si no,
                parecía que el Mentor no la había escuchado. */}
            {waitingQuestion !== null && (
              <div
                className="max-w-full self-end rounded-md border border-primary/40 bg-primary/10 p-3 text-sm"
                data-testid="mentor-pregunta-burbuja"
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t.you}</p>
                <p className="whitespace-pre-wrap break-words text-foreground">{waitingQuestion}</p>
              </div>
            )}
            <Alert
              data-testid="mentor-profile-readiness-gate"
              data-review={reviewAnswer.findings.length > 0 ? "found" : reviewGaps.length > 0 ? "ask" : "clear"}
              data-review-mode={reviewAnswer.mode}
            >
              <AlertTitle>
                {reviewAnswer.findings.length > 0
                  ? reviewTitle
                  : reviewGaps.length > 0
                    ? t.reviewAskTitle
                    : t.reviewClearTitle}
              </AlertTitle>
              <AlertDescription className="space-y-3">
                {reviewAnswer.findings.length > 0 ? (
                  <>
                    <ol className="space-y-2" data-testid="mentor-revision-hallazgos">
                      {reviewAnswer.findings.map((finding, index) => (
                        <li key={finding.id} className="text-foreground">
                          <span className="font-semibold">{index + 1}. {finding.title}</span>
                          <span className="block text-muted-foreground">{finding.action}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs">{t.reviewSource}</p>
                  </>
                ) : reviewGaps.length > 0 ? (
                  <p>
                    {t.reviewAskBody(
                      joinGapList(
                        reviewGaps.map((gap) => review.missing[review.missingKeys.indexOf(gap)] ?? ""),
                        t.reviewAnd,
                      ),
                    )}
                  </p>
                ) : (
                  <p>{t.reviewClearBody}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={onOpenQuickReview} data-testid="mentor-ir-revision">
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    {reviewAnswer.findings.length > 0 ? t.reviewOpenFull : t.reviewOpen}
                  </Button>
                  <Button type="button" variant="secondary" onClick={onEditProfile}>
                    <PencilLine className="size-4" aria-hidden="true" />
                    {t.readinessButton}
                  </Button>
                </div>
                <p className="text-xs" data-testid="mentor-falta-a-fondo" hidden={stillMissing.length === 0}>
                  {t.deepMissing(
                    stillMissing
                      .map((issue) => (lang === "en" ? issue.labelEn : issue.label).toLowerCase())
                      .join(", "),
                  )}
                </p>
                {waitingQuestion !== null && (
                  <p className="text-xs font-medium text-foreground" data-testid="mentor-pregunta-en-espera">
                    {t.deepPending}
                  </p>
                )}
              </AlertDescription>
            </Alert>
            </>
          ) : (
          <Alert data-testid="mentor-profile-readiness-gate">
            <AlertTitle>{t.readinessTitle}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {t.readinessMissing(
                  readiness.issues
                    .map((issue) => (lang === "en" ? issue.labelEn : issue.label).toLowerCase())
                    .join(", "),
                )}
              </p>
              {waitingQuestion !== null && (
                <p className="font-medium text-foreground" data-testid="mentor-pregunta-en-espera">
                  {t.readinessPending(waitingQuestion)}
                </p>
              )}
              <Button type="button" variant="secondary" onClick={onEditProfile}>
                <PencilLine className="size-4" aria-hidden="true" />
                {t.readinessButton}
              </Button>
            </AlertDescription>
          </Alert>
          )
        ) : patchBlocked ? (
          <Alert data-testid="mentor-chat-patch-review-gate">
            <AlertTitle>{t.patchTitle(patchCompatibility.patchId)}</AlertTitle>
            <AlertDescription>{t.patchBody(patchCompatibility.summary)}</AlertDescription>
          </Alert>
        ) : (
          <>
            {visibleSuggestions.length > 0 && (
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
            )}

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
                  {t.loading}
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
                <AlertTitle>{t.errorTitle}</AlertTitle>
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
                <Label htmlFor="mentor-pregunta" className="sr-only">{t.questionLabel}</Label>
                <Textarea
                  id="mentor-pregunta"
                  value={question}
                  rows={1}
                  maxLength={MAX_MENTOR_QUESTION_LENGTH}
                  placeholder={t.questionPlaceholder}
                  autoComplete="off"
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
                  {t.ask}
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
  const t = useText(TEXT);
  const savable = savableNextAction(turns);

  if (savable === null) {
    // Solo se avisa de la acción RECORDADA cuando existe y ya está en el diario.
    const lastMentorTurn = [...turns].reverse().find((turn) => turn.answer !== null);
    const recalled = lastMentorTurn?.answer ?? null;
    if (recalled === null || recalled.nextAction === null) return null;
    return (
      <p className="text-xs text-muted-foreground" data-testid="mentor-accion-recordada">
        {t.recalled}
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
        {t.saveAction}
      </Button>
      <span className="text-xs text-muted-foreground">{t.saveHint}</span>
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
  const t = useText(TEXT);
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
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {esJugador ? t.you : t.mentor}
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
  const t = useText(TEXT);
  const labels = useFormatLabels();
  return (
    <div className="mt-3 flex flex-col gap-3">
      {answer.unsupported !== null && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200">
          <AlertTitle>{t.unsupportedTitle}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span className="text-xs">{t.tryWith}</span>
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
          <p className="text-xs font-medium text-muted-foreground">{t.nextActionTitle}</p>
          <p className="whitespace-pre-wrap break-words text-foreground">
            {answer.nextAction.text}
          </p>
        </div>
      )}

      {/* 2) Confianza (en el idioma de la página) y estado del diario. */}
      <div className="flex flex-wrap items-center gap-2">
        {answer.confidence !== null && (
          <Badge variant="outline" className={CONFIDENCE_BADGE_CLASSES[answer.confidence]}>
            {t.confidence(labels.confidence[answer.confidence])}
          </Badge>
        )}
        {answer.memoryImpact.blockedByPrimaryEntryId !== null && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">
            {t.journalBusy}
          </Badge>
        )}
        {answer.memoryImpact.repeatedRecommendationIds.length > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            {t.journalRepeated(answer.memoryImpact.repeatedRecommendationIds.length)}
          </Badge>
        )}
      </div>

      {answer.relatedItemIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t.relatedItems}</span>
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
              {t.viewItem}
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
  const t = useText(TEXT);
  const labels = useFormatLabels();
  return (
    <details
      className="rounded-md border border-border/60 bg-background/40"
      data-testid="mentor-evidencia"
    >
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {t.evidenceSummary}
      </summary>

      <div className="flex flex-col gap-3 px-2 pb-2 pt-1">
        {answer.sources.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="mentor-fuentes">
            <p className="text-xs font-medium text-muted-foreground">{t.sources}</p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {answer.sources.map((source, index) => (
                <li key={`${source.kind}-${index}`}>
                  {displaySourceLabel(source.label)} · {labels.sourceKind[source.kind]} ·{" "}
                  {formatDateTime(source.retrievedAt)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {answer.unverified.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="mentor-no-verificado">
            <p className="text-xs font-medium text-amber-300">{t.unverified}</p>
            <ul className="list-inside list-disc text-xs text-amber-200/90">
              {answer.unverified.map((nota, index) => (
                <li key={index}>{nota}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">{t.evidenceNote}</p>

        <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          <span>{t.queryType(t.intentLabels[answer.intent])}</span>
          <span>{t.engine(answer.engineVersion)}</span>
          <span>
            {t.response(
              answer.responseMode === "ai"
                ? t.responseAi
                : answer.responseMode === "rules_fallback"
                  ? t.responseFallback
                  : t.responseRules,
            )}
          </span>
          {answer.model != null && <span>{t.model(answer.model)}</span>}
          <span>{t.answeredAt(formatDateTime(answer.generatedAt))}</span>
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
