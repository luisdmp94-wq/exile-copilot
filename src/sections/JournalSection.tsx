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
import type { JournalState } from "@/hooks/useJournal";
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
import {
  CONFIDENCE_LABELS,
  formatCost,
  formatDateTime,
  RISK_LABELS,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface JournalSectionProps {
  profile: CharacterProfile | null;
  budget: Budget;
  goal: GoalKind;
  journal: JournalState;
}

const KIND_LABELS: Record<JournalEntryKind, string> = {
  decision: "Decisión",
  experiment: "Experimento",
  craft: "Craft",
  milestone: "Hito",
  note: "Nota",
};

const STATUS_LABELS: Record<JournalEntryStatus, string> = {
  active: "En curso",
  waiting_result: "Esperando tu resultado",
  completed: "Completada",
  cancelled: "Cancelada",
};

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
}: JournalSectionProps) {
  const [resultText, setResultText] = useState("");
  const [kind, setKind] = useState<JournalEntryKind>("decision");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [nextAction, setNextAction] = useState("");

  const primary = journal.journal?.primaryEntry ?? null;
  const entries = journal.journal?.entries ?? [];

  const submitManualEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || title.trim() === "" || summary.trim() === "") return;
    const action = nextAction.trim() || null;
    const created = await journal.createEntry({
      kind,
      title: title.trim(),
      summary: summary.trim(),
      nextAction: action,
      relatedItemIds: [],
      sources: [
        {
          kind: "user",
          label: "Seguimiento indicado por el jugador",
          retrievedAt: new Date().toISOString(),
          patch: profile.patch,
        },
      ],
      context: {
        characterLevel: profile.level,
        league: profile.league,
        patch: profile.patch,
        budget,
        goal,
      },
      recommendationSnapshot: null,
      makePrimary: action !== null,
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
    });
    if (updated) setResultText("");
  };

  return (
    <Card id="seccion-mentor" className="mb-6 border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="size-5 text-primary" aria-hidden="true" />
              Mentor del personaje
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Memoria persistente
            </Badge>
          </div>
          {profile && (
            <span className="text-sm text-muted-foreground">
              {profile.name} · nivel {profile.level}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {!profile ? (
          <Empty className="border border-dashed border-border py-8">
            <EmptyHeader>
              <EmptyTitle>El mentor necesita conocer a tu personaje</EmptyTitle>
              <EmptyDescription>
                Carga o importa un personaje. Después podrá recordar decisiones,
                experimentos, crafts y el siguiente paso pendiente.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : journal.loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : journal.error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cargar la memoria del mentor</AlertTitle>
            <AlertDescription>{journal.error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {primary ? (
              <PrimaryEntry
                entry={primary}
                saving={journal.saving}
                resultText={resultText}
                onResultTextChange={setResultText}
                onWaiting={() =>
                  void journal.updateEntry(primary.id, { status: "waiting_result" })
                }
                onSaveResult={() => void saveResult()}
                onCancel={() =>
                  void journal.updateEntry(primary.id, {
                    status: "cancelled",
                    makePrimary: false,
                  })
                }
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
                <p className="font-medium text-foreground">No hay un siguiente paso activo</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Guarda una recomendación como próxima acción o crea un seguimiento abajo.
                  El mentor mantendrá una sola acción principal cada vez.
                </p>
              </div>
            )}

            <details className="group rounded-lg border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Plus className="size-4 text-primary" aria-hidden="true" />
                Crear seguimiento manual
              </summary>
              <form
                onSubmit={(event) => void submitManualEntry(event)}
                className="grid gap-4 border-t border-border p-4 md:grid-cols-2"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="journal-kind">Tipo</Label>
                  <select
                    id="journal-kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as JournalEntryKind)}
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Object.entries(KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="journal-title">Título</Label>
                  <Input
                    id="journal-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="p. ej. Probar el nuevo anillo"
                    maxLength={160}
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="journal-summary">Estado o decisión</Label>
                  <Textarea
                    id="journal-summary"
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Qué sabemos y por qué estamos siguiendo esto"
                    maxLength={4000}
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="journal-next-action">
                    Próxima acción <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="journal-next-action"
                    value={nextAction}
                    onChange={(event) => setNextAction(event.target.value)}
                    placeholder="Una sola acción concreta; si queda vacío se guarda como nota"
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
                    Guardar seguimiento
                  </Button>
                </div>
              </form>
            </details>

            <JournalHistory entries={entries} primaryEntryId={primary?.id ?? null} />
          </>
        )}
      </CardContent>
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
  const recommendation = entry.recommendationSnapshot;
  return (
    <section
      aria-labelledby={`journal-primary-${entry.id}`}
      className="rounded-xl border border-primary/50 bg-primary/5 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1">
          <CircleDot className="size-3" aria-hidden="true" />
          Siguiente paso
        </Badge>
        <Badge variant="outline" className="gap-1">
          <EntryKindIcon kind={entry.kind} />
          {KIND_LABELS[entry.kind]}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            entry.status === "waiting_result" && "border-amber-500/50 text-amber-300",
          )}
        >
          {STATUS_LABELS[entry.status]}
        </Badge>
      </div>

      <h2 id={`journal-primary-${entry.id}`} className="mt-4 text-xl font-semibold">
        {entry.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{entry.summary}</p>

      {entry.nextAction && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Haz esto ahora
          </p>
          <p className="mt-1 font-medium text-foreground">{entry.nextAction}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {entry.context.characterLevel !== null && (
          <span>Nivel {entry.context.characterLevel}</span>
        )}
        {entry.context.league && <span>· {entry.context.league}</span>}
        {entry.context.patch && <span>· Parche {entry.context.patch}</span>}
        {recommendation && (
          <>
            <span>· Confianza {CONFIDENCE_LABELS[recommendation.confidence]}</span>
            <span>· Riesgo {RISK_LABELS[recommendation.risk.level]}</span>
            <span>
              · Coste{" "}
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
            Fuentes: {recommendation.sources.map((source) => source.kind).join(", ") || "No disponibles"}.
          </p>
          {recommendation.unverified.length > 0 && (
            <p>
              Pendiente de verificar: {recommendation.unverified.length} dato(s).
            </p>
          )}
          {(recommendation.mayLoseValuableMods || recommendation.irreversible) && (
            <p className="text-amber-300">
              Riesgo material: {recommendation.irreversible
                ? "la acción puede ser irreversible"
                : "puedes perder mods valiosos"}.
            </p>
          )}
        </div>
      )}

      {entry.status === "active" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onWaiting} disabled={saving}>
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Ya hice este paso
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            <XCircle className="size-4" aria-hidden="true" />
            Cancelar seguimiento
          </Button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <Label htmlFor={`journal-result-${entry.id}`}>
            ¿Qué ocurrió después de hacer el paso?
          </Label>
          <Textarea
            id={`journal-result-${entry.id}`}
            value={resultText}
            onChange={(event) => onResultTextChange(event.target.value)}
            placeholder="Describe el objeto obtenido, el nuevo valor o lo que cambió. El mentor usará este resultado en la siguiente decisión."
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
            Guardar resultado y cerrar este paso
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
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="journal-history-title">
      <h3 id="journal-history-title" className="flex items-center gap-2 font-medium">
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        Historial reciente
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
                {KIND_LABELS[entry.kind]}
              </span>
              <span>· {STATUS_LABELS[entry.status]}</span>
              <span>· {formatDateTime(entry.updatedAt)}</span>
            </div>
            <p className="mt-1 font-medium text-foreground">{entry.title}</p>
            {entry.result && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                Resultado: {entry.result}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
