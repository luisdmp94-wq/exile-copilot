import { useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  Hammer,
  History,
  Loader2,
  Milestone,
  NotebookPen,
  Plus,
  Target,
  XCircle,
} from "lucide-react";
import type {
  Budget,
  CharacterProfile,
  GoalKind,
  JournalEntry,
  JournalEntryKind,
  JournalEntryStatus,
} from "@shared/domain.js";
import { readCharacterLevel, readJournalCharacterLevel } from "@shared/domain.js";
import type { JournalState } from "@/hooks/useJournal";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCharacterLevel, formatCost, formatDateTime } from "@/lib/format";
import { useFormatLabels } from "@/lib/formatLabels";
import { cn } from "@/lib/utils";
import { texts, useText } from "@/i18n/lang";

/**
 * Qué parte del diario se pinta. Es una decisión de PRESENTACIÓN: la memoria,
 * los controles y sus textos son los mismos en los tres casos.
 *
 * - `accion`: solo el seguimiento actual. Es el contenido dominante del Caso
 *   Abierto cuando el diario manda.
 * - `historial`: crear seguimiento y entradas anteriores. Vive plegado en
 *   «Historial de decisiones».
 * - `completo`: ambas cosas dentro de su tarjeta, como antes de la Fase Visual 1.
 */
export type JournalView = "accion" | "historial" | "completo";

interface JournalSectionProps {
  profile: CharacterProfile | null;
  budget: Budget | null;
  goal: GoalKind;
  journal: JournalState;
  view?: JournalView;
}

const TEXT = texts(
  {
    kindLabels: {
      decision: "Decisión",
      experiment: "Experimento",
      craft: "Craft",
      milestone: "Hito",
      note: "Nota",
    } as Record<JournalEntryKind, string>,
    statusLabels: {
      active: "En curso",
      waiting_result: "Esperando tu resultado",
      completed: "Completada",
      cancelled: "Cancelada",
    } as Record<JournalEntryStatus, string>,
    manualSourceLabel: "Seguimiento indicado por el jugador",
    noCharacterTitle: "El mentor necesita conocer a tu personaje",
    noCharacterBody:
      "Carga o importa un personaje. Después podrá recordar decisiones, experimentos, crafts y el siguiente paso pendiente.",
    loadErrorTitle: "No se pudo cargar la memoria del mentor",
    noActiveTitle: "No hay un siguiente paso activo",
    noActiveBody:
      "Guarda una recomendación como próxima acción o crea un seguimiento en «Historial de decisiones». El mentor mantendrá una sola acción principal cada vez.",
    createManual: "Crear seguimiento manual",
    kindField: "Tipo",
    titleField: "Título",
    titlePlaceholder: "p. ej. Probar el nuevo anillo",
    summaryField: "Estado o decisión",
    summaryPlaceholder: "Qué sabemos y por qué estamos siguiendo esto",
    nextActionField: "Próxima acción",
    optional: "(opcional)",
    nextActionPlaceholder: "Una sola acción concreta; si queda vacío se guarda como nota",
    saveEntry: "Guardar seguimiento",
    cardTitle: "Mentor del personaje",
    persistentMemory: "Memoria persistente",
    nameAndLevel: (name: string, level: string) => `${name} · nivel ${level}`,
    nextStep: "Siguiente paso",
    doThisNow: "Haz esto ahora",
    level: (level: number) => `Nivel ${level}`,
    patch: (patch: string) => `· Parche ${patch}`,
    confidence: (value: string) => `· Confianza ${value}`,
    risk: (value: string) => `· Riesgo ${value}`,
    cost: "· Coste",
    sources: "Fuentes:",
    noSources: "No disponibles",
    pendingVerify: (count: number) => `Pendiente de verificar: ${count} dato(s).`,
    materialRisk: "Riesgo material:",
    irreversible: "la acción puede ser irreversible",
    loseMods: "puedes perder mods valiosos",
    didStep: "Ya hice este paso",
    cancelEntry: "Cancelar seguimiento",
    whatHappened: "¿Qué ocurrió después de hacer el paso?",
    resultPlaceholder:
      "Describe lo que ocurrió. Se guardará como evidencia; actualiza también «Mi personaje» para que el motor use los nuevos valores.",
    saveResult: "Guardar resultado y cerrar este paso",
    recentHistory: "Historial reciente",
    result: "Resultado:",
  },
  {
    kindLabels: {
      decision: "Decision",
      experiment: "Experiment",
      craft: "Craft",
      milestone: "Milestone",
      note: "Note",
    } as Record<JournalEntryKind, string>,
    statusLabels: {
      active: "In progress",
      waiting_result: "Waiting for your result",
      completed: "Completed",
      cancelled: "Cancelled",
    } as Record<JournalEntryStatus, string>,
    manualSourceLabel: "Follow-up set by the player",
    noCharacterTitle: "Your mentor needs to know your character",
    noCharacterBody:
      "Load or import a character. Then it can remember decisions, experiments, crafts and your pending next step.",
    loadErrorTitle: "Couldn't load your mentor's memory",
    noActiveTitle: "No active next step",
    noActiveBody:
      "Save a recommendation as your next action, or create a follow-up in “Decision history”. Your mentor keeps only one main action at a time.",
    createManual: "Create a follow-up by hand",
    kindField: "Type",
    titleField: "Title",
    titlePlaceholder: "e.g. Try the new ring",
    summaryField: "Status or decision",
    summaryPlaceholder: "What we know and why we're tracking this",
    nextActionField: "Next action",
    optional: "(optional)",
    nextActionPlaceholder: "One concrete action; leave it empty to save it as a note",
    saveEntry: "Save follow-up",
    cardTitle: "Character mentor",
    persistentMemory: "Persistent memory",
    nameAndLevel: (name: string, level: string) => `${name} · level ${level}`,
    nextStep: "Next step",
    doThisNow: "Do this now",
    level: (level: number) => `Level ${level}`,
    patch: (patch: string) => `· Patch ${patch}`,
    confidence: (value: string) => `· Confidence ${value}`,
    risk: (value: string) => `· Risk ${value}`,
    cost: "· Cost",
    sources: "Sources:",
    noSources: "Not available",
    pendingVerify: (count: number) => `Still to verify: ${count} detail(s).`,
    materialRisk: "Item risk:",
    irreversible: "this action may be irreversible",
    loseMods: "you could lose valuable mods",
    didStep: "I did this step",
    cancelEntry: "Cancel follow-up",
    whatHappened: "What happened after you did the step?",
    resultPlaceholder:
      "Describe what happened. It will be saved as evidence; also update “My character” so the engine uses the new values.",
    saveResult: "Save result and close this step",
    recentHistory: "Recent history",
    result: "Result:",
  },
);

const KIND_ICONS = {
  decision: Target,
  experiment: FlaskConical,
  craft: Hammer,
  milestone: Milestone,
  note: NotebookPen,
} satisfies Record<JournalEntryKind, typeof Target>;

function EntryKindIcon({ kind }: { kind: JournalEntryKind }) {
  const Icon = KIND_ICONS[kind];
  return <Icon className="size-4" aria-hidden="true" />;
}

export function JournalSection({
  profile,
  budget,
  goal,
  journal,
  view = "completo",
}: JournalSectionProps) {
  const t = useText(TEXT);
  const [resultText, setResultText] = useState("");
  const [kind, setKind] = useState<JournalEntryKind>("decision");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [nextAction, setNextAction] = useState("");

  const primary = journal.journal?.primaryEntry ?? null;
  const entries = journal.journal?.entries ?? [];
  const journalRevision = journal.journal
    ? buildRecommendationMemory(journal.journal).revision
    : undefined;

  const submitManualEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || title.trim() === "" || summary.trim() === "") return;
    const action = nextAction.trim() || null;
    const levelReading = readCharacterLevel(profile);
    const created = await journal.createEntry({
      kind,
      title: title.trim(),
      summary: summary.trim(),
      nextAction: action,
      relatedItemIds: [],
      sources: [
        {
          kind: "user",
          label: t.manualSourceLabel,
          retrievedAt: new Date().toISOString(),
          patch: profile.patch,
        },
      ],
      context: {
        characterLevel: levelReading.known ? levelReading.level : null,
        characterLevelProvenance: levelReading.provenance,
        league: profile.league,
        patch: profile.patch,
        budget,
        goal,
      },
      recommendationSnapshot: null,
      makePrimary: action !== null,
      ...(journalRevision ? { journalRevision } : {}),
    });
    if (created) {
      setTitle("");
      setSummary("");
      setNextAction("");
    }
  };

  const saveResult = async () => {
    if (!primary || resultText.trim() === "") return;
    const updated = await journal.updateEntry(primary.id, {
      status: "completed",
      result: resultText.trim(),
      nextAction: null,
      makePrimary: false,
      ...(journalRevision ? { journalRevision } : {}),
    });
    if (updated) setResultText("");
  };

  const showAction = view !== "historial";
  const showHistory = view !== "accion";

  const content = (
    <>
      {!profile ? (
          <Empty className="border border-dashed border-border py-8">
            <EmptyHeader>
              <EmptyTitle>{t.noCharacterTitle}</EmptyTitle>
              <EmptyDescription>{t.noCharacterBody}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : journal.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : journal.error ? (
          <Alert variant="destructive">
            <AlertTitle>{t.loadErrorTitle}</AlertTitle>
            <AlertDescription>{journal.error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {showAction &&
              (primary ? (
              <PrimaryEntry
                entry={primary}
                saving={journal.saving}
                resultText={resultText}
                onResultTextChange={setResultText}
                onWaiting={() =>
                  void journal.updateEntry(primary.id, {
                    status: "waiting_result",
                    ...(journalRevision ? { journalRevision } : {}),
                  })
                }
                onSaveResult={() => void saveResult()}
                onCancel={() =>
                  void journal.updateEntry(primary.id, {
                    status: "cancelled",
                    makePrimary: false,
                    ...(journalRevision ? { journalRevision } : {}),
                  })
                }
              />
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
                  <p className="font-medium text-foreground">{t.noActiveTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.noActiveBody}</p>
                </div>
              ))}

            {showHistory && (
              <>
            <details className="group rounded-lg border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Plus className="size-4 text-primary" aria-hidden="true" />
                {t.createManual}
              </summary>
              <form
                onSubmit={(event) => void submitManualEntry(event)}
                className="grid gap-4 border-t border-border p-4 md:grid-cols-2"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="journal-kind">{t.kindField}</Label>
                  <select
                    id="journal-kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as JournalEntryKind)}
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Object.entries(t.kindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="journal-title">{t.titleField}</Label>
                  <Input
                    id="journal-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t.titlePlaceholder}
                    maxLength={160}
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="journal-summary">{t.summaryField}</Label>
                  <Textarea
                    id="journal-summary"
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder={t.summaryPlaceholder}
                    maxLength={4000}
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="journal-next-action">
                    {t.nextActionField} <span className="text-muted-foreground">{t.optional}</span>
                  </Label>
                  <Input
                    id="journal-next-action"
                    value={nextAction}
                    onChange={(event) => setNextAction(event.target.value)}
                    placeholder={t.nextActionPlaceholder}
                    maxLength={2000}
                  />
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={journal.saving || title.trim() === "" || summary.trim() === ""}
                  >
                    {journal.saving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <NotebookPen className="size-4" aria-hidden="true" />
                    )}
                    {t.saveEntry}
                  </Button>
                </div>
              </form>
            </details>

            <JournalHistory entries={entries} primaryEntryId={primary?.id ?? null} />
              </>
            )}
          </>
        )}
    </>
  );

  if (view !== "completo") {
    return (
      <div className="flex flex-col gap-5" data-testid={`diario-${view}`}>
        {content}
      </div>
    );
  }

  return (
    <Card id="seccion-mentor" className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              {t.cardTitle}
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {t.persistentMemory}
            </Badge>
          </div>
          {profile && (
            <span className="text-sm text-muted-foreground">
              {t.nameAndLevel(profile.name, formatCharacterLevel(profile))}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">{content}</CardContent>
    </Card>
  );
}

function PrimaryEntry({
  entry,
  saving,
  resultText,
  onResultTextChange,
  onWaiting,
  onSaveResult,
  onCancel,
}: {
  entry: JournalEntry;
  saving: boolean;
  resultText: string;
  onResultTextChange: (value: string) => void;
  onWaiting: () => void;
  onSaveResult: () => void;
  onCancel: () => void;
}) {
  const t = useText(TEXT);
  const labels = useFormatLabels();
  const recommendation = entry.recommendationSnapshot;
  const storedLevel = readJournalCharacterLevel(entry.context);
  return (
    <section
      aria-labelledby={`journal-primary-${entry.id}`}
      className="superficie-accion p-5 sm:p-6"
      data-testid="accion-actual"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1">
          <CircleDot className="size-3" aria-hidden="true" />
          {t.nextStep}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <EntryKindIcon kind={entry.kind} />
          {t.kindLabels[entry.kind]}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            entry.status === "waiting_result" && "border-amber-500/50 text-amber-300",
          )}
        >
          {t.statusLabels[entry.status]}
        </Badge>
      </div>

      <h2
        id={`journal-primary-${entry.id}`}
        className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {entry.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{entry.summary}</p>

      {entry.nextAction && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-background p-4">
          <p className="text-xs font-semibold text-primary">
            {t.doThisNow}
          </p>
          <p className="mt-1 font-medium text-foreground">{entry.nextAction}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {storedLevel !== null && (
          <span>{t.level(storedLevel)}</span>
        )}
        {entry.context.league && <span>· {entry.context.league}</span>}
        {entry.context.patch && <span>{t.patch(entry.context.patch)}</span>}
        {recommendation && (
          <>
            <span>{t.confidence(labels.confidence[recommendation.confidence])}</span>
            <span>{t.risk(labels.risk[recommendation.risk.level])}</span>
            <span>
              {t.cost}{" "}
              {formatCost(
                recommendation.cost.min,
                recommendation.cost.max,
                recommendation.cost.currency,
                recommendation.cost.known,
              )}
            </span>
          </>
        )}
      </div>

      {recommendation && (
        <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            {/* Los tipos de fuente se muestran traducidos: el jugador nunca ve
                los identificadores internos (`calculation`, `user`…). */}
            {t.sources}{" "}
            {recommendation.sources
              .map((source) => labels.sourceKind[source.kind])
              .join(", ") || t.noSources}
            .
          </p>
          {recommendation.unverified.length > 0 && (
            <p>{t.pendingVerify(recommendation.unverified.length)}</p>
          )}
          {(recommendation.mayLoseValuableMods || recommendation.irreversible) && (
            <p className="text-amber-300">
              {t.materialRisk}{" "}
              {recommendation.irreversible ? t.irreversible : t.loseMods}.
            </p>
          )}
        </div>
      )}

      {entry.status === "active" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onWaiting} disabled={saving}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t.didStep}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            <XCircle className="size-4" aria-hidden="true" />
            {t.cancelEntry}
          </Button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <Label htmlFor={`journal-result-${entry.id}`}>
            {t.whatHappened}
          </Label>
          <Textarea
            id={`journal-result-${entry.id}`}
            value={resultText}
            onChange={(event) => onResultTextChange(event.target.value)}
            placeholder={t.resultPlaceholder}
            className="mt-2"
            maxLength={4000}
          />
          <Button
            type="button"
            className="mt-3"
            onClick={onSaveResult}
            disabled={saving || resultText.trim() === ""}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            {t.saveResult}
          </Button>
        </div>
      )}
    </section>
  );
}

function JournalHistory({
  entries,
  primaryEntryId,
}: {
  entries: JournalEntry[];
  primaryEntryId: string | null;
}) {
  const t = useText(TEXT);
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="journal-history-title">
      <h3 id="journal-history-title" className="flex items-center gap-2 font-medium">
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        {t.recentHistory}
      </h3>
      <ol className="mt-3 grid gap-2 md:grid-cols-2">
        {entries.slice(0, 8).map((entry) => (
          <li
            key={entry.id}
            className={cn(
              "rounded-lg border border-border bg-muted/15 p-3",
              entry.id === primaryEntryId && "border-primary/40",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <EntryKindIcon kind={entry.kind} />
                {t.kindLabels[entry.kind]}
              </span>
              <span>· {t.statusLabels[entry.status]}</span>
              <span>· {formatDateTime(entry.updatedAt)}</span>
            </div>
            <p className="mt-1 font-medium text-foreground">{entry.title}</p>
            {entry.result && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {t.result} {entry.result}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
