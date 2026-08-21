import { useState, type FormEvent } from "react";
import {
  CirclePause,
  FlaskConical,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import type { Budget, CharacterProfile, Recommendation } from "@shared/domain.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import {
  CONCLUSION_LABELS,
  EVIDENCE_KIND_LABELS,
  SESSION_KIND_LABELS,
  SESSION_STATUS_LABELS,
  characterSessionFingerprint,
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

interface DecisionSessionSectionProps {
  profile: CharacterProfile | null;
  budget: Budget;
  journal: JournalState;
  pendingRecommendation: Recommendation | null;
}

function newKey(): string {
  return crypto.randomUUID();
}

export function DecisionSessionSection({
  profile,
  budget,
  journal,
  pendingRecommendation,
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
  const [valuable, setValuable] = useState("");
  const [subjective, setSubjective] = useState(false);
  const [reopenWhen, setReopenWhen] = useState("");
  const [evidenceText, setEvidenceText] = useState("");

  if (!profile) return null;

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
      hypothesis: pendingRecommendation.reason.slice(0, 2000),
      expectedResult: pendingRecommendation.impact.description,
      observationMethod: "Anota lo que cambió en el juego, con tus palabras.",
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
      goal: "balanced",
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
      goal: "balanced",
    });
    setObjective("");
    setHypothesis("");
  };

  return (
    <Card id="seccion-decision-adaptativa" className="mb-6 min-w-0 max-w-full overflow-hidden border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FlaskConical className="size-5 text-primary" aria-hidden="true" />
          Comprobar una decisión
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          El mentor recuerda qué estamos intentando, qué falta por ver y una sola
          acción. Si el resultado no encaja, cambia el plan; no sigue en automático.
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

        {session === null ? (
          <form className="space-y-3" onSubmit={startManual}>
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
        ) : (
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
              <h3 className="font-medium">Hipótesis</h3>
              <p>{session.hypothesis}</p>
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
              <Alert>
                <AlertTitle>Qué hacer ahora</AlertTitle>
                <AlertDescription>
                  <p>{session.activeAction.summary}</p>
                  <p className="mt-2 text-sm">
                    Qué observar: {session.activeAction.observationMethod}
                  </p>
                  {session.activeAction.blockedReason && (
                    <p className="mt-2 text-sm">
                      Por qué está frenado: {session.activeAction.blockedReason}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
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
              <p className="text-sm text-muted-foreground">
                Último resultado
                {session.lastResult.subjective ? " (sensación, no medición)" : ""}:{" "}
                {session.lastResult.text}
              </p>
            )}

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
                if (!revision || resultText.trim() === "") return;
                void journal.recordResult({
                  ...guard,
                  journalRevision: revision,
                  idempotencyKey: newKey(),
                  result: resultText.trim(),
                  subjective,
                  unexpectedValuable: valuable.trim() || null,
                  reopenWhen: reopenWhen.trim() || null,
                  conclusion: valuable.trim()
                    ? "change_strategy"
                    : reopenWhen.trim()
                      ? "discard"
                      : subjective
                        ? "continue"
                        : "complete",
                });
                setResultText("");
                setValuable("");
                setReopenWhen("");
              }}
            >
              <Label htmlFor="session-result">Qué ha pasado</Label>
              <Textarea
                id="session-result"
                value={resultText}
                onChange={(event) => setResultText(event.target.value)}
                maxLength={4000}
                rows={3}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={subjective}
                  onChange={(event) => setSubjective(event.target.checked)}
                />
                Es una sensación (no una medición)
              </label>
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
              <Button type="submit" disabled={journal.saving || journal.stale || !revision}>
                Registrar resultado
              </Button>
            </form>

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!revision || evidenceText.trim() === "") return;
                void journal.addEvidence({
                  ...guard,
                  journalRevision: revision,
                  idempotencyKey: newKey(),
                  kind: "confirmed",
                  text: evidenceText.trim(),
                  resolvesUnknownLabel: unknown.trim() || null,
                });
                setEvidenceText("");
              }}
            >
              <Label htmlFor="session-evidence">Añadir evidencia (sin cerrar el paso)</Label>
              <Input
                id="session-evidence"
                value={evidenceText}
                onChange={(event) => setEvidenceText(event.target.value)}
                maxLength={2000}
              />
              <Button type="submit" variant="outline" disabled={journal.saving || journal.stale}>
                Guardar evidencia
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
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
                    <li key={event.id}>{event.summary}</li>
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
