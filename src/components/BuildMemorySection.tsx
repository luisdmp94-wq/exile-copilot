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
import { useFormatLabels } from "@/lib/formatLabels";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    kindLabels: {
      core: "Core",
      flexible: "Flexible",
      experimental: "Experimental",
      discarded: "Descartado",
    } as Record<BuildMemoryKind, string>,
    kindHelp: {
      core: "El mentor debe detenerse antes de recomendar algo que lo rompa.",
      flexible: "Forma parte del plan actual, pero puede cambiarse.",
      experimental: "Lo estás probando; todavía no es una conclusión.",
      discarded: "No funcionó o no encaja. Conserva el motivo para no repetirlo.",
    } as Record<BuildMemoryKind, string>,
    eyebrow: "Tu build",
    title: "Qué es intocable y qué puedes cambiar",
    addRule: "Añadir regla",
    inactive: "Memoria inactiva",
    saveAndActivate: "Guardar personaje y activar memoria",
    empty: "Aún no has marcado qué es esencial y qué te da igual cambiar. Si lo dices, no te aconsejaré quitarlo.",
    reconsiderIf: "Reconsiderar si:",
    classificationOf: (label: string) => `Clasificación de ${label}`,
    archive: "Archivar",
    kindField: "Cómo debe recordarlo",
    labelField: "Qué quieres recordar",
    labelPlaceholder: "Por ejemplo: Barrera voltaica",
    reasonField: "Por qué",
    reasonPlaceholder: "Qué aporta a la identidad o por qué no funcionó",
    itemField: "Objeto relacionado (opcional)",
    none: "Ninguno",
    reconsiderField: "Reconsiderar si (opcional)",
    reconsiderPlaceholder: "Qué tendría que cambiar para probarlo de nuevo",
    save: "Guardar en la memoria",
    cancel: "Cancelar",
  },
  {
    kindLabels: {
      core: "Core",
      flexible: "Flexible",
      experimental: "Experimental",
      discarded: "Discarded",
    } as Record<BuildMemoryKind, string>,
    kindHelp: {
      core: "Your mentor must stop before recommending anything that breaks it.",
      flexible: "Part of the current plan, but it can change.",
      experimental: "You're testing it; it's not a conclusion yet.",
      discarded: "Didn't work or doesn't fit. Keep the reason so you don't repeat it.",
    } as Record<BuildMemoryKind, string>,
    eyebrow: "Your build",
    title: "What's untouchable and what you can change",
    addRule: "Add rule",
    inactive: "Memory off",
    saveAndActivate: "Save character and turn on memory",
    empty: "You haven't marked what's core and what you don't mind changing. Tell me and I won't advise removing it.",
    reconsiderIf: "Reconsider if:",
    classificationOf: (label: string) => `Classification of ${label}`,
    archive: "Archive",
    kindField: "How it should remember it",
    labelField: "What you want it to remember",
    labelPlaceholder: "For example: Spark",
    reasonField: "Why",
    reasonPlaceholder: "What it adds to the build's identity, or why it didn't work",
    itemField: "Related item (optional)",
    none: "None",
    reconsiderField: "Reconsider if (optional)",
    reconsiderPlaceholder: "What would need to change to try it again",
    save: "Save to memory",
    cancel: "Cancel",
  },
);

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
  const t = useText(TEXT);
  const labels = useFormatLabels();
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
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary/75">
            <Brain className="size-3.5" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h3 id="memoria-build-titulo" className="mt-1 font-semibold text-foreground">
            {t.title}
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
          {t.addRule}
        </Button>
      </div>

      {!profilePersisted && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/25 pt-3 text-xs">
          <span className="font-medium text-amber-200">{t.inactive}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            // En móviles estrechos el rótulo no cabe en una línea: puede partirse.
            className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left"
            disabled={savingProfile}
            onClick={onSaveProfile}
          >
            {t.saveAndActivate}
          </Button>
        </div>
      )}

      {profilePersisted && memory.length === 0 && !showForm && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t.empty}
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
                  {t.kindLabels[entry.kind]}
                </Badge>
                <strong className="text-foreground">{entry.label}</strong>
              </div>
              <p className="mt-1 leading-relaxed text-muted-foreground">{entry.reason}</p>
              {entry.reconsiderWhen && (
                <p className="mt-1 text-sky-200">
                  {t.reconsiderIf} {entry.reconsiderWhen}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label={t.classificationOf(entry.label)}
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
                  {Object.entries(t.kindLabels).map(([value, text]) => (
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
                  {t.archive}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {profilePersisted && showForm && (
        <form className="mt-4 space-y-3 border-t border-border pt-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label htmlFor="build-memory-kind">{t.kindField}</Label>
            <select
              id="build-memory-kind"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as BuildMemoryKind)}
            >
              {Object.entries(t.kindLabels).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t.kindHelp[kind]}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="build-memory-label">{t.labelField}</Label>
            <Input
              id="build-memory-label"
              value={label}
              maxLength={200}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t.labelPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="build-memory-reason">{t.reasonField}</Label>
            <Textarea
              id="build-memory-reason"
              value={reason}
              maxLength={1000}
              rows={2}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t.reasonPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="build-memory-item">{t.itemField}</Label>
            <select
              id="build-memory-item"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={relatedItemId}
              onChange={(event) => setRelatedItemId(event.target.value)}
            >
              <option value="">{t.none}</option>
              {profile.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({labels.slot[item.slot]})
                </option>
              ))}
            </select>
          </div>
          {kind === "discarded" && (
            <div className="space-y-1">
              <Label htmlFor="build-memory-reconsider">{t.reconsiderField}</Label>
              <Input
                id="build-memory-reconsider"
                value={reconsiderWhen}
                maxLength={1000}
                onChange={(event) => setReconsiderWhen(event.target.value)}
                placeholder={t.reconsiderPlaceholder}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={journal.saving || !revision || !label.trim() || !reason.trim()}
            >
              {t.save}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              {t.cancel}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
