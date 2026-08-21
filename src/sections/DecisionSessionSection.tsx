import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  CirclePause,
  FlaskConical,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import type { Budget, CharacterProfile, GoalKind, Recommendation } from "@shared/domain.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import {
  CONCLUSION_LABELS,
  DECISION_OUTCOME_LABELS,
  EVIDENCE_KIND_LABELS,
  SESSION_KIND_LABELS,
  SESSION_STATUS_LABELS,
  characterSessionFingerprint,
  sessionIsOpen,
  type DecisionOutcome,
} from "@shared/decisionSession.js";
import type { JournalState } from "@/hooks/useJournal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SLOT_LABELS } from "@/lib/format";
import { compactRecommendationReason } from "@/lib/journal";
import {
  DECISION_OUTCOME_OPTIONS,
  observationMethodForRecommendation,
  outcomeResultText,
} from "@/lib/sessionOutcome";

interface DecisionSessionSectionProps {
  profile: CharacterProfile | null;
  budget: Budget;
  /**
   * Objetivo REAL elegido por el jugador en «Plan y mercado». La sesión debe
   * abrirse con él: antes se enviaba «balanced» fijo y además el servidor lo
   * descartaba, así que la decisión perdía ese contexto.
   */
  goal: GoalKind;
  journal: JournalState;
  pendingRecommendation: Recommendation | null;
  onEditExpediente?: () => void;
}

function newKey(): string {
  return crypto.randomUUID();
}

export function DecisionSessionSection({
  profile,
  budget,
  goal,
  journal,
  pendingRecommendation,
  onEditExpediente,
}: DecisionSessionSectionProps) {
  const session = journal.journal?.session ?? null;
  const events = journal.journal?.sessionEvents ?? [];
  const revision = journal.journal
    ? buildRecommendationMemory(journal.journal, journal.journal.session).revision
    : null;
  const fingerprintMismatch =
    session !== null && profile !== null
      ? characterSessionFingerprint(profile) !== session.characterFingerprint
      : false;
  const needsReconcile = Boolean(session?.needsReconciliation || fingerprintMismatch);

  const [objective, setObjective] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [unknown, setUnknown] = useState("");
  const [constraint, setConstraint] = useState("");
  const [soonReplaced, setSoonReplaced] = useState("");
  const [resultText, setResultText] = useState("");
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [valuable, setValuable] = useState("");
  const [subjective, setSubjective] = useState(true);
  const [reopenWhen, setReopenWhen] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  /** Incógnita que resuelve la evidencia: elegida en la lista, no en un estado oculto. */
  const [resolvesUnknownId, setResolvesUnknownId] = useState("");
  /** El jugador pidió explícitamente empezar otra decisión tras cerrar la anterior. */
  const [startingNew, setStartingNew] = useState(false);

  if (!profile) return null;

  /**
   * Una sesión cerrada (completada, descartada) no admite resultado, evidencia
   * ni pausa: el servidor los rechaza. La interfaz deja de ofrecerlos y expone
   * en su lugar una vía clara para empezar otra decisión.
   */
  const isOpen = session !== null && sessionIsOpen(session.status);
  const showStartForm = session === null || (!isOpen && startingNew);
  const unresolvedUnknowns = (session?.unknowns ?? []).filter(
    (item) => !item.resolved,
  );
  const activeConstraints = (session?.constraints ?? []).filter(
    (item) => item.protected,
  );

  const guard = {
    journalRevision: revision ?? "missing",
    profile,
  };

  const startFromRecommendation = async () => {
    if (!pendingRecommendation || !revision) return;
    await journal.startSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      kind: "guided_decision",
      objective: pendingRecommendation.title,
      hypothesis: compactRecommendationReason(pendingRecommendation.reason),
      expectedResult: pendingRecommendation.impact.description,
      observationMethod: observationMethodForRecommendation(pendingRecommendation),
      unknowns: unknown.trim()
        ? [{ label: unknown.trim(), blockingIrreversible: true }]
        : [],
      constraints: constraint.trim()
        ? [{ label: constraint.trim(), relatedItemIds: pendingRecommendation.relatedItemIds }]
        : [],
      soonReplacedItemIds: soonReplaced.trim() ? [soonReplaced.trim()] : [],
      protectedResources: [],
      recommendation: pendingRecommendation,
      budget,
      goal,
    });
  };

  const startManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!revision || objective.trim() === "" || hypothesis.trim() === "") return;
    await journal.startSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      kind: "guided_decision",
      objective: objective.trim(),
      hypothesis: hypothesis.trim(),
      expectedResult: "El cambio que quieres comprobar.",
      observationMethod: "Juega un encuentro representativo y anótalo.",
      unknowns: unknown.trim()
        ? [{ label: unknown.trim(), blockingIrreversible: true }]
        : [],
      constraints: constraint.trim()
        ? [{ label: constraint.trim(), relatedItemIds: [] }]
        : [],
      soonReplacedItemIds: soonReplaced.trim() ? [soonReplaced.trim()] : [],
      protectedResources: [],
      recommendation: null,
      budget,
      goal,
    });
    setObjective("");
    setHypothesis("");
  };

  return (
    <Card id="seccion-decision-adaptativa" className="mb-6 min-w-0 max-w-full overflow-hidden border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FlaskConical className="size-5 text-primary" aria-hidden="true" />
          {isOpen ? "Prueba en curso" : "Comprobar una decisión"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isOpen
            ? "Haz una sola prueba, vuelve con lo que ocurrió y el mentor decidirá si cerramos o mantenemos el caso."
            : "El mentor recuerda qué estamos intentando, qué falta por ver y una sola acción."}
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 break-words">
        {journal.stale && (
          <Alert>
            <AlertTitle>La decisión anterior ya no vale</AlertTitle>
            <AlertDescription>
              Otra pestaña cambió la memoria. Los botones viejos se han desactivado.
              Revisa el estado actual antes de seguir.
            </AlertDescription>
          </Alert>
        )}

        {showStartForm && (
          <form className="space-y-3" onSubmit={startManual} data-testid="decision-form-inicio">
            <div className="space-y-1">
              <Label htmlFor="decision-objetivo">Qué quieres conseguir</Label>
              <Input
                id="decision-objetivo"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                maxLength={500}
                placeholder="Por ejemplo: subir supervivencia sin tocar mi habilidad core"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-hipotesis">Qué vamos a comprobar</Label>
              <Textarea
                id="decision-hipotesis"
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-incognita">Dato que aún no tenemos (opcional)</Label>
              <Input
                id="decision-incognita"
                value={unknown}
                onChange={(event) => setUnknown(event.target.value)}
                maxLength={400}
                placeholder="Tooltip exacto de una herramienta, un mod, un coste…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-core">Pieza o habilidad intocable (opcional)</Label>
              <Input
                id="decision-core"
                value={constraint}
                onChange={(event) => setConstraint(event.target.value)}
                maxLength={200}
                placeholder="Barrera voltaica"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="decision-reemplazo">Pieza que vas a sustituir pronto (opcional)</Label>
              <select
                id="decision-reemplazo"
                className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={soonReplaced}
                onChange={(event) => setSoonReplaced(event.target.value)}
              >
                <option value="">Ninguna</option>
                {profile.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({SLOT_LABELS[item.slot]})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={journal.saving || journal.stale || !revision}>
                {journal.saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Empezar a comprobar
              </Button>
              {pendingRecommendation && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={journal.saving || journal.stale || !revision}
                  onClick={() => void startFromRecommendation()}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  Comprobar la recomendación actual
                </Button>
              )}
            </div>
          </form>
        )}
        {session !== null && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{SESSION_KIND_LABELS[session.kind]}</Badge>
              <Badge>{SESSION_STATUS_LABELS[session.status]}</Badge>
              {session.conclusion && (
                <Badge variant="outline">{CONCLUSION_LABELS[session.conclusion.kind]}</Badge>
              )}
            </div>
            {needsReconcile && (
              <Alert>
                <AlertTitle>El personaje ya no es el mismo</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Cambió el nivel, la liga, el parche o el equipo desde que empezó
                    esta decisión. Confirma si sigue aplicando o empieza otra.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={journal.saving || !revision}
                    onClick={() =>
                      void journal.reconcileSession({
                        ...guard,
                        journalRevision: revision!,
                        idempotencyKey: newKey(),
                      })
                    }
                  >
                    Sigue aplicando a este personaje
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div>
              <h3 className="font-medium">Qué intentamos</h3>
              <p>{session.objective}</p>
            </div>
            <div>
              <h3 className="font-medium">Por qué creemos que ayudará</h3>
              <p>{compactRecommendationReason(session.hypothesis)}</p>
            </div>
            {session.constraints.length > 0 && (
              <div>
                <h3 className="font-medium">Intocable</h3>
                <ul className="list-disc pl-5">
                  {session.constraints.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {session.unknowns.some((item) => !item.resolved) && (
              <div>
                <h3 className="font-medium">Aún no sabemos</h3>
                <ul className="list-disc pl-5">
                  {session.unknowns
                    .filter((item) => !item.resolved)
                    .map((item) => (
                      <li key={item.id}>{item.label}</li>
                    ))}
                </ul>
              </div>
            )}
            {session.activeAction && (
              <section
                className="rounded-md border border-primary/40 bg-primary/[0.06] p-4 sm:p-5"
                aria-labelledby="prueba-activa-titulo"
                data-testid="prueba-activa"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                  Próxima acción
                </p>
                <h3 id="prueba-activa-titulo" className="mt-2 text-lg font-semibold">
                  {session.activeAction.summary}
                </h3>
                <div className="mt-4 rounded-md border border-sky-500/30 bg-sky-500/[0.06] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                    Después, observa
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {session.activeAction.observationMethod}
                  </p>
                </div>
                {session.activeAction.blockedReason && (
                  <p className="mt-3 text-sm text-amber-200">
                    <strong>Antes de continuar:</strong>{" "}
                    {session.activeAction.blockedReason}
                  </p>
                )}
                {!showReturnForm && (
                  <Button
                    type="button"
                    className="mt-4"
                    data-testid="decision-volvi"
                    onClick={() => setShowReturnForm(true)}
                    disabled={journal.saving || journal.stale || needsReconcile}
                  >
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    Volví de jugar
                  </Button>
                )}
              </section>
            )}
            {session.conclusion && (
              <p className="text-sm">
                {session.conclusion.reason}
                {session.conclusion.reopenWhen
                  ? ` Se reabre si: ${session.conclusion.reopenWhen}`
                  : ""}
              </p>
            )}
            {session.lastResult && (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p className="font-medium text-foreground">
                  Último resultado
                  {session.lastResult.outcome
                    ? ` · ${DECISION_OUTCOME_LABELS[session.lastResult.outcome]}`
                    : ""}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {session.lastResult.text}
                  {session.lastResult.subjective
                    ? " (experiencia del jugador, no medición)"
                    : ""}
                </p>
              </div>
            )}

            {/* Protecciones vigentes: cada una se puede retirar A CONCIENCIA, que
                es justo lo que propone el texto del conflicto. */}
            {activeConstraints.length > 0 && (
              <div className="space-y-1" data-testid="decision-protecciones">
                <h3 className="font-medium">Piezas protegidas</h3>
                <ul className="space-y-1 text-sm">
                  {activeConstraints.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2">
                      <span className="break-words">{item.label}</span>
                      {isOpen && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`decision-retirar-${item.id}`}
                          disabled={journal.saving || journal.stale || !revision}
                          onClick={() =>
                            void journal.releaseConstraint({
                              ...guard,
                              journalRevision: revision!,
                              idempotencyKey: newKey(),
                              constraintId: item.id,
                            })
                          }
                        >
                          Retirar esta protección
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isOpen && (
              <Alert data-testid="decision-cerrada">
                <AlertTitle>Esta decisión está cerrada</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Ya no admite resultado, evidencia ni pausa. Puedes reabrirla como
                    candidata o empezar otra decisión desde cero.
                  </p>
                  {!startingNew && (
                    <Button
                      type="button"
                      data-testid="decision-nueva"
                      onClick={() => setStartingNew(true)}
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                      Empezar otra decisión
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isOpen && (
            <>
            {showReturnForm && (
              <form
                className="space-y-4 rounded-md border border-primary/40 bg-background/60 p-4 sm:p-5"
                data-testid="decision-form-regreso"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!revision || outcome === null) return;
                  void journal
                    .recordResult({
                      ...guard,
                      journalRevision: revision,
                      idempotencyKey: newKey(),
                      result: outcomeResultText(outcome, resultText),
                      subjective,
                      outcome,
                      unexpectedValuable: valuable.trim() || null,
                      reopenWhen: reopenWhen.trim() || null,
                      conclusion: valuable.trim()
                        ? "change_strategy"
                        : reopenWhen.trim()
                          ? "discard"
                          : undefined,
                    })
                    .then((next) => {
                      if (!next) return;
                      setResultText("");
                      setOutcome(null);
                      setValuable("");
                      setReopenWhen("");
                      setShowReturnForm(false);
                    });
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                      Regreso de la prueba
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">¿Qué ocurrió?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Elige una respuesta. Puedes terminar en unos segundos y añadir
                      detalles solo si hacen falta.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReturnForm(false)}
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Seguir jugando
                  </Button>
                </div>

                <fieldset className="grid gap-2 sm:grid-cols-2">
                  <legend className="sr-only">Resultado de la prueba</legend>
                  {DECISION_OUTCOME_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-md border p-3 transition-colors ${
                        outcome === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/10 hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision-outcome"
                        value={option.value}
                        checked={outcome === option.value}
                        onChange={() => setOutcome(option.value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="space-y-1">
                  <Label htmlFor="session-result">Cuéntame lo importante (opcional)</Label>
                  <Textarea
                    id="session-result"
                    value={resultText}
                    onChange={(event) => setResultText(event.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder="Por ejemplo: aguanto mejor, pero los bosses siguen acercándose demasiado."
                  />
                </div>

                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={subjective}
                    onChange={(event) => setSubjective(event.target.checked)}
                    className="mt-0.5"
                  />
                  Es mi experiencia al jugar, no una medición. Desmárcalo solo si
                  has actualizado el expediente con datos comprobados.
                </label>
                {onEditExpediente && (
                  <Button type="button" variant="outline" size="sm" onClick={onEditExpediente}>
                    Actualizar expediente antes de cerrar
                  </Button>
                )}

                <details className="rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Resultado inesperado o condición de reapertura
                  </summary>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={valuable}
                      onChange={(event) => setValuable(event.target.value)}
                      maxLength={400}
                      placeholder="Si salió otra cosa valiosa, nómbrala para protegerla"
                    />
                    <Input
                      value={reopenWhen}
                      onChange={(event) => setReopenWhen(event.target.value)}
                      maxLength={1000}
                      placeholder="Reevaluar si esa condición pasa a ser consistente"
                    />
                  </div>
                </details>

                <Button
                  type="submit"
                  disabled={journal.saving || journal.stale || !revision || outcome === null}
                >
                  {journal.saving && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  Guardar resultado
                </Button>
              </form>
            )}

            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                Protecciones y evidencia avanzada
              </summary>
              <div className="mt-3 space-y-4">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!revision || constraint.trim() === "") return;
                void journal.addConstraint({
                  ...guard,
                  journalRevision: revision,
                  idempotencyKey: newKey(),
                  label: constraint.trim(),
                  relatedItemIds: [],
                });
                setConstraint("");
              }}
            >
              <Label htmlFor="add-core">Añadir pieza protegida</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="add-core"
                  value={constraint}
                  onChange={(event) => setConstraint(event.target.value)}
                  maxLength={200}
                />
                <Button type="submit" variant="outline" disabled={journal.saving || journal.stale}>
                  <Shield className="size-4" aria-hidden="true" />
                  Proteger
                </Button>
              </div>
            </form>

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!revision || evidenceText.trim() === "") return;
                const chosen = unresolvedUnknowns.find(
                  (item) => item.id === resolvesUnknownId,
                );
                void journal.addEvidence({
                  ...guard,
                  journalRevision: revision,
                  idempotencyKey: newKey(),
                  kind: "confirmed",
                  text: evidenceText.trim(),
                  resolvesUnknownLabel: chosen?.label ?? null,
                });
                setEvidenceText("");
                setResolvesUnknownId("");
              }}
            >
              <Label htmlFor="session-evidence">Añadir evidencia (sin cerrar el paso)</Label>
              <Input
                id="session-evidence"
                value={evidenceText}
                onChange={(event) => setEvidenceText(event.target.value)}
                maxLength={2000}
              />
              {/* La incógnita que resuelve la evidencia se ELIGE aquí: antes
                  dependía del campo del formulario de inicio, que tras recargar
                  la página estaba vacío y no se podía volver a indicar. */}
              {unresolvedUnknowns.length > 0 && (
                <div className="space-y-1">
                  <Label htmlFor="session-evidence-unknown">
                    ¿Qué dato pendiente resuelve?
                  </Label>
                  <select
                    id="session-evidence-unknown"
                    data-testid="decision-selector-incognita"
                    className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={resolvesUnknownId}
                    onChange={(event) => setResolvesUnknownId(event.target.value)}
                  >
                    <option value="">Ninguno en concreto</option>
                    {unresolvedUnknowns.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button type="submit" variant="outline" disabled={journal.saving || journal.stale}>
                Guardar evidencia
              </Button>
            </form>
              </div>
            </details>
            </>
            )}

            <div className="flex flex-wrap gap-2">
              {isOpen && (
              <Button
                type="button"
                variant="outline"
                data-testid="decision-pausar"
                disabled={journal.saving || journal.stale || !revision}
                onClick={() =>
                  void journal.pauseSession({
                    ...guard,
                    journalRevision: revision!,
                    idempotencyKey: newKey(),
                    reason: "Pausa para conservar el recurso o esperar un mejor momento.",
                  })
                }
              >
                <CirclePause className="size-4" aria-hidden="true" />
                Pausar
              </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={
                  journal.saving ||
                  journal.stale ||
                  !revision ||
                  (session.status !== "paused" &&
                    session.status !== "completed" &&
                    session.status !== "discarded")
                }
                onClick={() =>
                  void journal.reopenSession({
                    ...guard,
                    journalRevision: revision!,
                    idempotencyKey: newKey(),
                    note: "Reabrimos como candidata.",
                  })
                }
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reabrir como candidata
              </Button>
            </div>

            {session.evidence.length > 0 && (
              <div>
                <h3 className="font-medium">Evidencia</h3>
                <ul className="space-y-1 text-sm">
                  {session.evidence.map((item) => (
                    <li key={item.id}>
                      {EVIDENCE_KIND_LABELS[item.kind]}: {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {events.length > 0 && (
              <div>
                <h3 className="font-medium">Por qué hemos cambiado de plan</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {events.map((event) => (
                    <li key={event.id}>{compactRecommendationReason(event.summary)}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
