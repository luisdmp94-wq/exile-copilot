import { useState, type FormEvent } from "react";
import { Archive, Brain, Plus, ShieldCheck } from "lucide-react";
import type {
  BuildMemoryKind,
  CharacterProfile,
} from "@shared/domain.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import type { JournalState } from "@/hooks/useJournal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SLOT_LABELS } from "@/lib/format";

const KIND_LABELS: Record<BuildMemoryKind, string> = {
  core: "Core",
  flexible: "Flexible",
  experimental: "Experimental",
  discarded: "Descartado",
};

const KIND_HELP: Record<BuildMemoryKind, string> = {
  core: "El mentor debe detenerse antes de recomendar algo que lo rompa.",
  flexible: "Forma parte del plan actual, pero puede cambiarse.",
  experimental: "Lo estás probando; todavía no es una conclusión.",
  discarded: "No funcionó o no encaja. Conserva el motivo para no repetirlo.",
};

interface BuildMemorySectionProps {
  profile: CharacterProfile;
  journal: JournalState;
  profilePersisted: boolean;
  savingProfile: boolean;
  onSaveProfile: () => void;
}

export function BuildMemorySection({
  profile,
  journal,
  profilePersisted,
  savingProfile,
  onSaveProfile,
}: BuildMemorySectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<BuildMemoryKind>("core");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [relatedItemId, setRelatedItemId] = useState("");
  const [reconsiderWhen, setReconsiderWhen] = useState("");

  const memory = journal.journal?.buildMemory ?? [];
  const revision = journal.journal
    ? buildRecommendationMemory(journal.journal, journal.journal.session).revision
    : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!revision || !label.trim() || !reason.trim()) return;
    const saved = await journal.createBuildMemoryEntry({
      kind,
      label: label.trim(),
      reason: reason.trim(),
      relatedItemIds: relatedItemId ? [relatedItemId] : [],
      reconsiderWhen:
        kind === "discarded" && reconsiderWhen.trim()
          ? reconsiderWhen.trim()
          : null,
      journalRevision: revision,
    });
    if (!saved) return;
    setLabel("");
    setReason("");
    setRelatedItemId("");
    setReconsiderWhen("");
    setShowForm(false);
  };

  return (
    <section
      className="border border-border/80 bg-background/35 p-3"
      aria-labelledby="memoria-build-titulo"
      data-testid="memoria-build"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75">
            <Brain className="size-3.5" aria-hidden="true" />
            Identidad de la build
          </p>
          <h3 id="memoria-build-titulo" className="mt-1 font-semibold text-foreground">
            Lo que el mentor debe recordar
          </h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowForm((value) => !value)}
          disabled={journal.saving || !revision || !profilePersisted}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Añadir regla
        </Button>
      </div>

      {!profilePersisted && (
        <div className="mt-3 border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs">
          <p className="leading-relaxed text-amber-100">
            Guarda primero este personaje para que su memoria sobreviva al cerrar la página.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={savingProfile}
            onClick={onSaveProfile}
          >
            Guardar personaje y activar memoria
          </Button>
        </div>
      )}

      {profilePersisted && memory.length === 0 && !showForm && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Aún no has marcado qué es esencial, flexible, experimental o descartado.
        </p>
      )}

      {memory.length > 0 && (
        <ul className="mt-3 space-y-2">
          {memory.map((entry) => (
            <li key={entry.id} className="border-l-2 border-primary/50 pl-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={entry.kind === "core" ? "default" : "secondary"}>
                  {entry.kind === "core" && (
                    <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
                  )}
                  {KIND_LABELS[entry.kind]}
                </Badge>
                <strong className="text-foreground">{entry.label}</strong>
              </div>
              <p className="mt-1 leading-relaxed text-muted-foreground">{entry.reason}</p>
              {entry.reconsiderWhen && (
                <p className="mt-1 text-sky-200">
                  Reconsiderar si: {entry.reconsiderWhen}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Clasificación de ${entry.label}`}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={entry.kind}
                  disabled={journal.saving || !revision}
                  onChange={(event) => {
                    const nextKind = event.target.value as BuildMemoryKind;
                    void journal.updateBuildMemoryEntry(entry.id, {
                      kind: nextKind,
                      journalRevision: revision!,
                    });
                  }}
                >
                  {Object.entries(KIND_LABELS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={journal.saving || !revision}
                  onClick={() =>
                    void journal.updateBuildMemoryEntry(entry.id, {
                      active: false,
                      journalRevision: revision!,
                    })
                  }
                >
                  <Archive className="size-3" aria-hidden="true" />
                  Archivar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {profilePersisted && showForm && (
        <form className="mt-4 space-y-3 border-t border-border pt-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label htmlFor="build-memory-kind">Cómo debe recordarlo</Label>
            <select
              id="build-memory-kind"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as BuildMemoryKind)}
            >
              {Object.entries(KIND_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{KIND_HELP[kind]}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="build-memory-label">Qué quieres recordar</Label>
            <Input
              id="build-memory-label"
              value={label}
              maxLength={200}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Por ejemplo: Barrera voltaica"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="build-memory-reason">Por qué</Label>
            <Textarea
              id="build-memory-reason"
              value={reason}
              maxLength={1000}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Qué aporta a la identidad o por qué no funcionó"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="build-memory-item">Objeto relacionado (opcional)</Label>
            <select
              id="build-memory-item"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={relatedItemId}
              onChange={(event) => setRelatedItemId(event.target.value)}
            >
              <option value="">Ninguno</option>
              {profile.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({SLOT_LABELS[item.slot]})
                </option>
              ))}
            </select>
          </div>
          {kind === "discarded" && (
            <div className="space-y-1">
              <Label htmlFor="build-memory-reconsider">Reconsiderar si (opcional)</Label>
              <Input
                id="build-memory-reconsider"
                value={reconsiderWhen}
                maxLength={1000}
                onChange={(event) => setReconsiderWhen(event.target.value)}
                placeholder="Qué tendría que cambiar para probarlo de nuevo"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={journal.saving || !revision || !label.trim() || !reason.trim()}
            >
              Guardar en la memoria
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
