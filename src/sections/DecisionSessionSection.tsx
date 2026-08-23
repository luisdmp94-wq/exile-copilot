import { useRef, useState, type FormEvent } from "react";
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
import type { Budget, CharacterProfile, GoalKind, Item, Recommendation } from "@shared/domain.js";
import {
  CRAFTING_RESULT_UNKNOWN_LABEL,
  compareCraftingResult,
  craftingComparisonEvidence,
  type CraftingComparison,
} from "@shared/craftingComparison.js";
import { evaluateCraftingCharacterContext } from "@shared/craftingCharacterContext.js";
import { evaluateCraftingGoalSignal } from "@shared/craftingGoal.js";
import { decideCraftingNextStep } from "@shared/craftingNextDecision.js";
import {
  craftingSuccessCriterionLabel,
  evaluateCraftingSuccessCriteria,
} from "@shared/craftingSuccessCriteria.js";
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
import { api, getErrorMessage } from "@/lib/api";
import { SLOT_LABELS } from "@/lib/format";
import { compactRecommendationReason } from "@/lib/journal";
import {
  DECISION_OUTCOME_OPTIONS,
  observationMethodForRecommendation,
  outcomeResultText,
} from "@/lib/sessionOutcome";

interface DecisionSessionSectionProps {
  /** Identificador único cuando la sesión se presenta en más de un workspace montado. */
  instanceId?: string;
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
  onMentorEvent?: (event: {
    type: "started" | "result" | "paused" | "reopened" | "reconciled";
    title: string;
  }) => void;
  onApplyCraftingResult?: (originalItemId: string, resultItem: Item) => Promise<boolean>;
}

function newKey(): string {
  return crypto.randomUUID();
}

export function DecisionSessionSection({
  instanceId = "seccion-decision-adaptativa",
  profile,
  budget,
  goal,
  journal,
  pendingRecommendation,
  onEditExpediente,
  onMentorEvent,
  onApplyCraftingResult,
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
  const [craftingResultText, setCraftingResultText] = useState("");
  const [craftingComparison, setCraftingComparison] = useState<CraftingComparison | null>(null);
  const [craftingResultItem, setCraftingResultItem] = useState<Item | null>(null);
  const [craftingError, setCraftingError] = useState<string | null>(null);
  const [comparingCrafting, setComparingCrafting] = useState(false);
  const [savingCrafting, setSavingCrafting] = useState(false);
  const savingCraftingRef = useRef(false);

  if (!profile) return null;

  /**
   * Una sesión cerrada (completada, descartada) no admite resultado, evidencia
   * ni pausa: el servidor los rechaza. La interfaz deja de ofrecerlos y expone
   * en su lugar una vía clara para empezar otra decisión.
   */
  const isOpen = session !== null && sessionIsOpen(session.status);
  const isCraftingSession = session?.craftingExperiment != null;
  const craftingGoalSignal =
    session?.craftingExperiment?.goalCategory !== undefined &&
    craftingComparison?.status === "confirmed"
      ? evaluateCraftingGoalSignal(
          session.craftingExperiment.goalCategory,
          craftingComparison.addedModifiers,
        )
      : null;
  const craftingCharacterContext =
    session?.craftingExperiment &&
    craftingComparison?.status === "confirmed" &&
    craftingResultItem
      ? evaluateCraftingCharacterContext({
          profile,
          profileGoal: goal,
          originalItem: session.craftingExperiment.originalItem,
          resultItem: craftingResultItem,
          comparison: craftingComparison,
          goalCategory: session.craftingExperiment.goalCategory,
          goalSignal: craftingGoalSignal,
        })
      : null;
  const craftingSuccessAssessment =
    session?.craftingExperiment &&
    craftingComparison?.status === "confirmed" &&
    craftingResultItem
      ? evaluateCraftingSuccessCriteria({
          criteria: session.craftingExperiment.successCriteria,
          resultItem: craftingResultItem,
        })
      : null;
  const craftingNextDecision =
    session?.craftingExperiment &&
    craftingComparison?.status === "confirmed" &&
    craftingResultItem &&
    craftingGoalSignal &&
    craftingCharacterContext
      ? decideCraftingNextStep({
          resultItem: craftingResultItem,
          comparison: craftingComparison,
          characterContext: craftingCharacterContext,
          addedGoalSignal: craftingGoalSignal,
          goalCategory: session.craftingExperiment.goalCategory,
          successAssessment: craftingSuccessAssessment,
        })
      : null;
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
    const next = await journal.startSession({
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
    if (next) onMentorEvent?.({ type: "started", title: pendingRecommendation.title });
  };

  const startManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!revision || objective.trim() === "" || hypothesis.trim() === "") return;
    const next = await journal.startSession({
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
    if (next) onMentorEvent?.({ type: "started", title: objective.trim() });
    setObjective("");
    setHypothesis("");
  };

  const pauseCurrentSession = async () => {
    if (!session || !revision) return;
    const next = await journal.pauseSession({
      ...guard,
      journalRevision: revision,
      idempotencyKey: newKey(),
      reason: "Pausa para conservar el recurso o esperar un mejor momento.",
    });
    if (next) onMentorEvent?.({ type: "paused", title: session.objective });
  };

  const comparePastedCrafting = async () => {
    const experiment = session?.craftingExperiment ?? null;
    if (!experiment || craftingResultText.trim() === "") return;
    setComparingCrafting(true);
    setCraftingError(null);
    setCraftingComparison(null);
    setCraftingResultItem(null);
    try {
      const imported = await api.importItemText({ text: craftingResultText });
      const comparison = compareCraftingResult(
        experiment.originalItem,
        imported.item,
        experiment.actionId,
        {
          expectedRarity: experiment.resultRarity,
          expectedRemovedModifierCount: experiment.expectedRemovedModifierCount,
          expectedAddedCrafted: experiment.expectedAddedCrafted,
          maximumCraftedModifierCount: experiment.maximumCraftedModifierCount,
          expectedAddedModifierText: experiment.guaranteedModifierText,
          protectedModifierIds: experiment.protectedModifierIds,
        },
      );
      setCraftingResultItem(imported.item);
      setCraftingComparison(comparison);
      if (imported.warnings.length > 0) {
        setCraftingError(`Importación con avisos: ${imported.warnings.join(" ")}`);
      }
    } catch (error) {
      setCraftingError(getErrorMessage(error));
    } finally {
      setComparingCrafting(false);
    }
  };

  const finishCraftingResult = async (useful: boolean) => {
    // El estado de React deshabilita la UI, pero no es un cerrojo síncrono:
    // dos eventos en el mismo frame podrían entrar antes del siguiente render.
    // Este guard evita dos cierres concurrentes y resultados que se pisen.
    if (savingCraftingRef.current) return;
    const experiment = session?.craftingExperiment ?? null;
    if (
      !session ||
      !experiment ||
      !craftingComparison ||
      craftingComparison.status !== "confirmed" ||
      !craftingResultItem ||
      !revision ||
      !profile ||
      !onApplyCraftingResult
    ) {
      return;
    }
    savingCraftingRef.current = true;
    setSavingCrafting(true);
    setCraftingError(null);
    try {
      const factualEvidence = craftingComparisonEvidence(craftingComparison);
      const resultUnknownLabel =
        experiment.resultUnknownLabel ?? CRAFTING_RESULT_UNKNOWN_LABEL;
      const evidenceAlreadySaved = session.evidence.some(
        (entry) => entry.kind === "confirmed" && entry.text === factualEvidence,
      );
      if (!evidenceAlreadySaved) {
        const afterEvidence = await journal.addEvidence({
          journalRevision: revision,
          idempotencyKey: newKey(),
          kind: "confirmed",
          text: factualEvidence,
          resolvesUnknownLabel: resultUnknownLabel,
          profile,
        });
        if (!afterEvidence) return;
      }

      // El expediente se actualiza ANTES de cerrar la sesión. Si este guardado
      // falla, el caso permanece abierto y el jugador puede reintentar.
      const applied = await onApplyCraftingResult(
        experiment.originalItem.id,
        craftingResultItem,
      );
      if (!applied) {
        setCraftingError(
          "No se actualizó el expediente. La sesión sigue abierta: puedes reintentar sin volver a gastar ninguna moneda.",
        );
        return;
      }

      // Guardar el objeto cambia la huella autoritativa del personaje. Se lee
      // la revisión nueva y se reconcilia la MISMA sesión antes de cerrarla.
      const refreshed = await api.journal(profile.id);
      const reconciled = await api.reconcileSession(profile.id, {
        journalRevision: buildRecommendationMemory(refreshed, refreshed.session).revision,
        idempotencyKey: newKey(),
        profile,
      });
      const result = useful
        ? `El jugador indica que el resultado sirve para «${experiment.desiredOutcome}».`
        : `El jugador indica que el resultado no sirve para «${experiment.desiredOutcome}».`;
      await api.recordSessionResult(profile.id, {
        journalRevision: buildRecommendationMemory(reconciled, reconciled.session).revision,
        idempotencyKey: newKey(),
        result,
        subjective: true,
        outcome: useful ? "resolved" : "different",
        unexpectedValuable: null,
        conclusion: "complete",
        reopenWhen: null,
        profile,
      });
      await journal.reload();
      onMentorEvent?.({ type: "result", title: experiment.actionLabel });
    } catch (error) {
      setCraftingError(
        `${getErrorMessage(error)} La sesión no se ha dado por cerrada; revisa el expediente y reintenta.`,
      );
    } finally {
      savingCraftingRef.current = false;
      setSavingCrafting(false);
    }
  };

  return (
    <Card
      id={instanceId}
      tabIndex={-1}
      className="mb-6 min-w-0 max-w-full scroll-mt-20 overflow-hidden border-primary/40 outline-none"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FlaskConical className="size-5 text-primary" aria-hidden="true" />
          {isCraftingSession && isOpen
            ? "Craft preparado"
            : isOpen
              ? "Prueba en curso"
              : "Comprobar una decisión"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isCraftingSession && isOpen
            ? "Haz una sola acción, pega el objeto resultante y decide con la diferencia delante."
            : isOpen
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
            {!isCraftingSession && <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{SESSION_KIND_LABELS[session.kind]}</Badge>
              <Badge>{SESSION_STATUS_LABELS[session.status]}</Badge>
              {session.conclusion && (
                <Badge variant="outline">{CONCLUSION_LABELS[session.conclusion.kind]}</Badge>
              )}
            </div>}
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
                    onClick={() => {
                      void journal.reconcileSession({
                        ...guard,
                        journalRevision: revision!,
                        idempotencyKey: newKey(),
                      }).then((next) => {
                        if (next) onMentorEvent?.({ type: "reconciled", title: session.objective });
                      });
                    }}
                  >
                    Sigue aplicando a este personaje
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!isCraftingSession && <div>
              <h3 className="font-medium">Qué intentamos</h3>
              <p>{session.objective}</p>
            </div>}
            {!isCraftingSession && <div>
              <h3 className="font-medium">Por qué creemos que ayudará</h3>
              <p>{compactRecommendationReason(session.hypothesis)}</p>
            </div>}
            {!isCraftingSession && session.constraints.length > 0 && (
              <div>
                <h3 className="font-medium">Intocable</h3>
                <ul className="list-disc pl-5">
                  {session.constraints.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {!isCraftingSession && session.unknowns.some((item) => !item.resolved) && (
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
            {session.craftingExperiment && (
              <section
                className="space-y-4 rounded-md border border-sky-500/30 bg-sky-500/[0.05] p-4 sm:p-5"
                aria-labelledby={`${instanceId}-crafting-resultado-titulo`}
                data-testid="crafting-result-check"
              >
                <ol className="grid gap-2 text-xs sm:grid-cols-3" aria-label="Progreso del craft">
                  <li className="rounded border border-emerald-500/35 bg-emerald-500/[0.07] px-3 py-2 text-emerald-100">
                    1. Antes de gastar ✓
                  </li>
                  <li className={`rounded border px-3 py-2 ${
                    craftingComparison?.status === "confirmed"
                      ? "border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-100"
                      : "border-sky-500/45 bg-sky-500/[0.08] text-sky-100"
                  }`}>
                    2. Pega el resultado{craftingComparison?.status === "confirmed" ? " ✓" : ""}
                  </li>
                  <li className={`rounded border px-3 py-2 ${
                    craftingComparison?.status === "confirmed"
                      ? "border-primary/50 bg-primary/[0.08] text-foreground"
                      : "border-border text-muted-foreground"
                  }`}>
                    3. Decide
                  </li>
                </ol>
                {craftingComparison?.status !== "confirmed" && <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                    Cerrar el ciclo
                  </p>
                  <h3
                    id={`${instanceId}-crafting-resultado-titulo`}
                    className="mt-1 text-lg font-semibold"
                  >
                    Compara el objeto después del crafting
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pega el texto avanzado inmediatamente después de usar {session.craftingExperiment.actionLabel}.
                    Se comparará con el snapshot guardado; no se valorará si el mod es bueno sin que tú lo confirmes.
                  </p>
                </div>}
                {craftingComparison?.status !== "confirmed" && <dl
                  className="grid gap-2 rounded border border-sky-500/20 bg-background/30 p-3 sm:grid-cols-2"
                  data-testid="crafting-experiment-summary"
                >
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Objeto</dt>
                    <dd className="font-medium">{session.craftingExperiment.originalItem.name}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Moneda registrada</dt>
                    <dd className="font-medium">{session.craftingExperiment.actionLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Objetivo</dt>
                    <dd className="font-medium">{session.craftingExperiment.desiredOutcome}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">
                      {session.craftingExperiment.actionId === "essence" ||
                      session.craftingExperiment.actionId === "alloy"
                        ? "Efecto garantizado declarado"
                        : "Mínimo mostrado en su tooltip"}
                    </dt>
                    <dd className="font-medium">
                      {session.craftingExperiment.actionId === "essence" ||
                      session.craftingExperiment.actionId === "alloy"
                        ? session.craftingExperiment.guaranteedModifierText ?? "No registrado"
                        : session.craftingExperiment.minimumModifierLevel === undefined
                          ? "Variante no registrada en esta sesión antigua"
                          : session.craftingExperiment.minimumModifierLevel === null
                            ? "El tooltip observado no muestra un mínimo"
                            : `Nivel de modificador ${session.craftingExperiment.minimumModifierLevel}`}
                    </dd>
                  </div>
                  {session.craftingExperiment.protectedModifierIds.length > 0 && (
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Protección declarada</dt>
                      <dd className="font-medium">
                        {session.craftingExperiment.protectedModifierIds.length} modificador
                        {session.craftingExperiment.protectedModifierIds.length === 1 ? "" : "es"}
                      </dd>
                    </div>
                  )}
                  {session.craftingExperiment.successCriteria.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] text-muted-foreground">Pararé cuando</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {session.craftingExperiment.successCriteria.map((criterion) => (
                          <span
                            key={criterion.kind}
                            className="rounded border border-emerald-500/30 bg-emerald-500/[0.06] px-2 py-1 text-xs text-emerald-100"
                          >
                            {craftingSuccessCriterionLabel(criterion)}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>}
                {craftingComparison?.status !== "confirmed" && <div className="space-y-1">
                  <Label htmlFor={`${instanceId}-crafting-result-${session.id}`}>
                    Objeto después de usar la moneda
                  </Label>
                  <Textarea
                    id={`${instanceId}-crafting-result-${session.id}`}
                    value={craftingResultText}
                    onChange={(event) => {
                      setCraftingResultText(event.target.value);
                      setCraftingComparison(null);
                      setCraftingResultItem(null);
                      setCraftingError(null);
                    }}
                    rows={7}
                    maxLength={50_000}
                    placeholder="Pega aquí el texto copiado con Ctrl+C desde PoE2"
                  />
                </div>}
                {craftingComparison?.status !== "confirmed" && <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void comparePastedCrafting()}
                  disabled={
                    comparingCrafting ||
                    savingCrafting ||
                    craftingResultText.trim() === ""
                  }
                >
                  {comparingCrafting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                  )}
                  Comparar con el snapshot anterior
                </Button>}

                {craftingError && (
                  <Alert>
                    <AlertTitle>La importación necesita revisión</AlertTitle>
                    <AlertDescription>{craftingError}</AlertDescription>
                  </Alert>
                )}

                {craftingComparison && (
                  <div
                    className={
                      craftingComparison.protectionStatus === "lost"
                        ? "rounded-md border border-rose-500/45 bg-rose-500/[0.09] p-4"
                        : craftingComparison.status === "confirmed"
                        ? "rounded-md border border-emerald-500/35 bg-emerald-500/[0.07] p-4"
                        : "rounded-md border border-amber-500/35 bg-amber-500/[0.07] p-4"
                    }
                    data-comparison-status={craftingComparison.status}
                  >
                    <h4 className="font-semibold">{craftingComparison.title}</h4>
                    <p className="mt-1 text-sm">{craftingComparison.summary}</p>
                    {craftingComparison.protectionStatus === "preserved" && (
                      <p className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/[0.06] p-2 text-sm text-emerald-100">
                        Los {craftingComparison.protectedModifiers.length} modificadores protegidos siguen presentes.
                      </p>
                    )}
                    {craftingComparison.addedModifiers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Aparece ahora
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {craftingComparison.addedModifiers.map((modifier) => (
                            <li key={`${modifier.kind}-${modifier.text}`}>{modifier.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {craftingComparison.removedModifiers.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Ya no aparece
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {craftingComparison.removedModifiers.map((modifier) => (
                            <li key={`${modifier.kind}-${modifier.text}`}>{modifier.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {craftingComparison.warnings.length > 0 && (
                      <ul className="mt-3 list-disc pl-5 text-sm text-amber-100">
                        {craftingComparison.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                    {craftingComparison.status === "confirmed" && (
                      <div className="mt-4 space-y-2">
                        {craftingSuccessAssessment &&
                          craftingSuccessAssessment.status !== "not-defined" && (
                          <section
                            className={`rounded-md border p-3 ${
                              craftingSuccessAssessment.status === "fulfilled"
                                ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                                : craftingSuccessAssessment.status === "unknown"
                                  ? "border-amber-500/40 bg-amber-500/[0.07]"
                                  : "border-border bg-background/30"
                            }`}
                            data-testid="crafting-success-assessment"
                            data-success-status={craftingSuccessAssessment.status}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                                  Tu punto de parada
                                </p>
                                <h4 className="mt-1 font-semibold">{craftingSuccessAssessment.title}</h4>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {craftingSuccessAssessment.entries.filter((entry) => entry.status === "fulfilled").length}/
                                {craftingSuccessAssessment.entries.length}
                              </span>
                            </div>
                            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                              {craftingSuccessAssessment.entries.map((entry) => (
                                <li
                                  key={entry.criterion.kind}
                                  className="rounded border border-current/15 bg-black/10 px-3 py-2 text-xs"
                                  data-criterion-status={entry.status}
                                >
                                  <span className="font-medium">
                                    {entry.status === "fulfilled"
                                      ? "Cumplida"
                                      : entry.status === "not-seen"
                                        ? "No aparece"
                                        : "No comprobable"}
                                  </span>
                                  <span className="mt-0.5 block text-muted-foreground">{entry.label}</span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {craftingNextDecision && (
                          <div
                            className={`rounded-md border p-4 ${
                              craftingNextDecision.tone === "positive"
                                ? "border-emerald-500/45 bg-emerald-500/[0.09] text-emerald-50"
                                : craftingNextDecision.tone === "danger"
                                  ? "border-rose-500/50 bg-rose-500/[0.1] text-rose-50"
                                  : "border-amber-500/45 bg-amber-500/[0.08] text-amber-50"
                            }`}
                            data-testid="crafting-next-decision"
                            data-next-decision={craftingNextDecision.kind}
                            aria-live="polite"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="mt-0.5 rounded border border-current/25 p-2"
                                aria-hidden="true"
                              >
                                {craftingNextDecision.kind === "continue" ? (
                                  <Sparkles className="size-4" />
                                ) : craftingNextDecision.kind === "restart" ? (
                                  <RotateCcw className="size-4" />
                                ) : (
                                  <CirclePause className="size-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-75">
                                  Decisión recomendada
                                </p>
                                <h4 className="mt-1 text-lg font-semibold">
                                  {craftingNextDecision.title}
                                </h4>
                                <p className="mt-1 text-sm leading-relaxed opacity-90">
                                  {craftingNextDecision.summary}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 rounded border border-current/20 bg-black/10 px-3 py-2 text-sm font-medium">
                              {craftingNextDecision.nextAction}
                            </p>
                          </div>
                        )}
                        {craftingCharacterContext && (
                          <div
                            className={`rounded border p-3 text-sm ${
                              craftingCharacterContext.verdict === "candidate"
                                ? "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100"
                                : craftingCharacterContext.verdict === "stop"
                                  ? "border-rose-500/45 bg-rose-500/[0.08] text-rose-100"
                                  : "border-amber-500/35 bg-amber-500/[0.06] text-amber-100"
                            }`}
                            data-testid="crafting-character-context"
                            data-context-verdict={craftingCharacterContext.verdict}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
                              Lectura del personaje
                            </p>
                            <p className="mt-1 font-semibold">{craftingCharacterContext.title}</p>
                            <p className="mt-1 leading-relaxed">{craftingCharacterContext.summary}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                              <span className="rounded border border-current/25 px-2 py-1">
                                {craftingCharacterContext.requirementLabel}
                              </span>
                              <span className="rounded border border-current/25 px-2 py-1">
                                {craftingCharacterContext.protectionLabel}
                              </span>
                              {craftingGoalSignal && (
                                <span
                                  className="rounded border border-current/25 px-2 py-1"
                                  data-testid="crafting-goal-signal"
                                  data-signal-status={craftingGoalSignal.status}
                                >
                                  {craftingGoalSignal.title}
                                </span>
                              )}
                            </div>
                            {(craftingCharacterContext.facts.length > 0 ||
                              craftingCharacterContext.limitations.length > 0) && (
                              <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
                                <summary className="cursor-pointer font-medium">Por qué dice esto</summary>
                                <ul className="mt-2 list-disc space-y-1 pl-4">
                                  {craftingCharacterContext.facts.map((fact) => (
                                    <li key={fact}>{fact}</li>
                                  ))}
                                  {craftingCharacterContext.limitations.map((limitation) => (
                                    <li key={limitation}>{limitation}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}
                        <p className="text-sm font-medium">
                          ¿El cambio resultante sirve para «{session.craftingExperiment.desiredOutcome}»?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void finishCraftingResult(true)}
                            disabled={savingCrafting || journal.saving}
                          >
                            Sí, me sirve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void finishCraftingResult(false)}
                            disabled={savingCrafting || journal.saving}
                          >
                            No era lo que buscaba
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void pauseCurrentSession()}
                            disabled={savingCrafting || journal.saving}
                          >
                            Parar por ahora
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Al confirmar se guarda la comparación, se cierra esta prueba y se actualiza el objeto del expediente.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {craftingComparison?.status !== "confirmed" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void pauseCurrentSession()}
                    disabled={journal.saving || journal.stale || !revision}
                  >
                    <CirclePause className="size-4" aria-hidden="true" />
                    Parar por ahora
                  </Button>
                )}
              </section>
            )}
            {!isCraftingSession && session.activeAction && (
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
            {!isCraftingSession && session.conclusion && (
              <p className="text-sm">
                {session.conclusion.reason}
                {session.conclusion.reopenWhen
                  ? ` Se reabre si: ${session.conclusion.reopenWhen}`
                  : ""}
              </p>
            )}
            {!isCraftingSession && session.lastResult && (
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
            {!isCraftingSession && activeConstraints.length > 0 && (
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

            {isOpen && !isCraftingSession && (
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
                      onMentorEvent?.({ type: "result", title: session.objective });
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

            {!isCraftingSession && <div className="flex flex-wrap gap-2">
              {isOpen && !isCraftingSession && (
              <Button
                type="button"
                variant="outline"
                data-testid="decision-pausar"
                disabled={journal.saving || journal.stale || !revision}
                onClick={() => {
                  void pauseCurrentSession();
                }}
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
                onClick={() => {
                  void journal.reopenSession({
                    ...guard,
                    journalRevision: revision!,
                    idempotencyKey: newKey(),
                    note: "Reabrimos como candidata.",
                  }).then((next) => {
                    if (next) onMentorEvent?.({ type: "reopened", title: session.objective });
                  });
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reabrir como candidata
              </Button>
            </div>}

            {!isCraftingSession && session.evidence.length > 0 && (
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

            {!isCraftingSession && events.length > 0 && (
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
