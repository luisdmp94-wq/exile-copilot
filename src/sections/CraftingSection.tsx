import { useState } from "react";
import { AlertTriangle, CheckCircle2, Hammer, PackageSearch, RotateCcw } from "lucide-react";
import type { StartCraftingDecision } from "@shared/craftingActions.js";
import type { StartAlloyDecision } from "@shared/craftingAlloys.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import type { StartEssenceDecision } from "@shared/craftingEssences.js";
import { sessionOccupiesActiveSlot } from "@shared/decisionSession.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import type { Budget, CharacterProfile, GoalKind, Item } from "@shared/domain.js";
import { CraftingActionPlanner } from "@/components/CraftingActionPlanner";
import { ItemArtwork } from "@/components/ItemArtwork";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JournalState } from "@/hooks/useJournal";
import { SLOT_LABELS } from "@/lib/format";
import { DecisionSessionSection } from "@/sections/DecisionSessionSection";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";

interface CraftingSectionProps {
  profile: CharacterProfile | null;
  budget: Budget;
  goal: GoalKind;
  journal: JournalState;
  requestedItemId?: string | null;
  onEditExpediente: () => void;
  onStartCraftingDecision: StartCraftingDecision;
  onStartEssenceDecision: StartEssenceDecision;
  onStartAlloyDecision: StartAlloyDecision;
  onApplyCraftingResult: (originalItemId: string, resultItem: Item) => Promise<boolean>;
  onMentorEvent?: (event: {
    type: "started" | "result" | "paused" | "reopened" | "reconciled";
    title: string;
  }) => void;
  onMentorContext?: (event: ContextualMentorEvent) => void;
}

/** Tercera área principal: selección, diagnóstico, decisión y resultado. */
export function CraftingSection({
  profile,
  budget,
  goal,
  journal,
  requestedItemId = null,
  onEditExpediente,
  onStartCraftingDecision,
  onStartEssenceDecision,
  onStartAlloyDecision,
  onApplyCraftingResult,
  onMentorEvent,
  onMentorContext,
}: CraftingSectionProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const craftableItems = (profile?.items ?? []).filter((item) =>
    ["normal", "magic", "rare"].includes(item.rarity),
  );
  const activeSession = journal.journal?.session ?? null;
  const hasOpenSession =
    activeSession !== null && sessionOccupiesActiveSlot(activeSession.status);
  const pausedCrafts = (journal.journal?.pausedSessions ?? []).filter(
    (candidate) => candidate.craftingExperiment != null,
  );
  const activeCrafting = hasOpenSession && activeSession.craftingExperiment
    ? activeSession.craftingExperiment
    : null;
  const preferredId = activeCrafting?.originalItem.id ?? selectedItemId ?? requestedItemId;
  const selectedItem =
    craftableItems.find((item) => item.id === preferredId) ?? craftableItems[0] ?? null;
  const focusStartedCraft = () => {
    // La primera trama deja que React monte la sesión; la segunda realiza la
    // navegación únicamente como consecuencia del clic que la creó. Así una
    // sesión restaurada no roba foco desde una pestaña oculta.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.getElementById("seccion-decision-crafting");
        if (!target) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        target.focus({ preventScroll: true });
      });
    });
  };

  if (!profile) {
    return (
      <section className="superficie-panel p-6 text-center" data-testid="crafting-empty">
        <PackageSearch className="mx-auto size-9 text-primary" aria-hidden="true" />
        <h2 className="dossier-title mt-3 text-2xl font-semibold">Primero necesito un objeto real</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Importa o carga un personaje y pega el texto avanzado de la pieza que quieres trabajar.
        </p>
        <Button className="mt-4" type="button" onClick={onEditExpediente}>
          Importar personaje u objeto
        </Button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-7" data-testid="crafting-workspace">
      <section
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4"
        aria-labelledby="crafting-workspace-title"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
            <Hammer className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="crafting-workspace-title" className="dossier-title text-2xl font-semibold">
              Banco de crafting
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Elige · decide · aplica · compara.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {craftableItems.length} pieza(s)
        </p>
      </section>

      {hasOpenSession && !activeCrafting && (
        <Alert>
          <AlertTitle>Ya hay otra decisión en curso</AlertTitle>
          <AlertDescription>
            Termina o pausa el caso abierto del expediente antes de empezar un craft. Nunca mantenemos dos próximas acciones simultáneas.
          </AlertDescription>
        </Alert>
      )}

      {!hasOpenSession && pausedCrafts.length > 0 && journal.journal && (
        <section
          className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-3"
          data-testid="crafting-paused-sessions"
          aria-labelledby="crafting-paused-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                Guardado sin bloquear el banco
              </p>
              <h3 id="crafting-paused-title" className="font-semibold">
                {pausedCrafts.length === 1 ? "Tienes un craft pausado" : `Tienes ${pausedCrafts.length} crafts pausados`}
              </h3>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {pausedCrafts.map((paused) => (
              <li
                key={paused.id}
                className="flex items-center justify-between gap-3 rounded border border-border/70 bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {paused.craftingExperiment?.originalItem.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {paused.craftingExperiment?.actionLabel}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid={`crafting-resume-${paused.id}`}
                  disabled={journal.saving || journal.stale}
                  onClick={() => {
                    void journal.reopenSession({
                      journalRevision: buildRecommendationMemory(
                        journal.journal!,
                        journal.journal!.session,
                      ).revision,
                      idempotencyKey: crypto.randomUUID(),
                      sessionId: paused.id,
                      note: "Reanudamos este craft pausado.",
                      profile,
                    }).then((next) => {
                      if (!next) return;
                      onMentorEvent?.({ type: "reopened", title: paused.objective });
                      focusStartedCraft();
                    });
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reanudar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeCrafting && (
        <DecisionSessionSection
          instanceId="seccion-decision-crafting"
          profile={profile}
          budget={budget}
          goal={goal}
          journal={journal}
          pendingRecommendation={null}
          onEditExpediente={onEditExpediente}
          onMentorEvent={onMentorEvent}
          onApplyCraftingResult={onApplyCraftingResult}
        />
      )}

      <div hidden={Boolean(activeCrafting)} aria-hidden={activeCrafting ? "true" : undefined}>
      {craftableItems.length === 0 ? (
        <section className="superficie-panel p-6" data-testid="crafting-no-items">
          <h3 className="text-xl font-semibold">No hay piezas analizables</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pega el texto avanzado de un objeto normal, mágico o raro. Los únicos y las monedas no entran en este flujo básico.
          </p>
          <Button className="mt-4" type="button" variant="outline" onClick={onEditExpediente}>
            Añadir un objeto
          </Button>
        </section>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <aside className="superficie-panel min-w-0 p-3 lg:sticky lg:top-24" aria-labelledby="crafting-items-title">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 id="crafting-items-title" className="text-sm font-semibold">Piezas</h3>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {craftableItems.length}
              </Badge>
            </div>
            <ul
              className="mt-3 flex min-w-0 max-w-full snap-x gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
              role="list"
            >
              {craftableItems.map((item) => {
                const active = item.id === selectedItem?.id;
                const diagnosis = diagnoseCraftingItem(item);
                const needsAttention = diagnosis.state !== "complete";
                return (
                  <li key={item.id} className="min-w-44 snap-start lg:min-w-0">
                    <button
                      type="button"
                      data-testid={`crafting-item-${item.id}`}
                      data-active={active ? "true" : "false"}
                      aria-pressed={active}
                      aria-label={`${item.name}, ${item.baseType}, ${SLOT_LABELS[item.slot]}. ${diagnosis.label}`}
                      title={`${item.baseType} · ${diagnosis.label}`}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all ${
                        active
                          ? "border-primary/70 bg-primary/[0.11] shadow-[inset_3px_0_0_hsl(var(--primary))]"
                          : "border-border bg-muted/10 hover:-translate-y-px hover:border-primary/35 lg:hover:translate-x-0.5 lg:hover:translate-y-0"
                      }`}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        onMentorContext?.({ type: "craftingItem", item });
                      }}
                    >
                      <ItemArtwork item={item} className="size-10 rounded-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {SLOT_LABELS[item.slot]}
                        </span>
                      </span>
                      {needsAttention ? (
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {selectedItem && (
            <section className="superficie-panel min-w-0 p-4 sm:p-5" aria-live="polite">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ItemArtwork item={selectedItem} className="size-20 rounded-md" decorative={false} />
                  <div className="min-w-0">
                  <h3 className="dossier-title text-2xl font-semibold">{selectedItem.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedItem.baseType} · ilvl {selectedItem.itemLevel ?? "desconocido"}
                  </p>
                  </div>
                </div>
                {(() => {
                  const diagnosis = diagnoseCraftingItem(selectedItem);
                  const ready = diagnosis.state === "complete";
                  return (
                    <Badge
                      variant="outline"
                      aria-label={`Estado de la pieza: ${diagnosis.label}`}
                      className={
                        ready
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : diagnosis.state === "blocked"
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      }
                    >
                      <span aria-hidden="true">●</span> {ready ? "Lista para trabajar" : diagnosis.label}
                    </Badge>
                  );
                })()}
              </div>
              <CraftingActionPlanner
                key={selectedItem.id}
                item={selectedItem}
                profileGoal={goal}
                patch={profile.patch}
                onUpdateItem={onEditExpediente}
                showStatusLabel={false}
                onStartCraftingDecision={hasOpenSession ? undefined : onStartCraftingDecision}
                onStartEssenceDecision={hasOpenSession ? undefined : onStartEssenceDecision}
                onStartAlloyDecision={hasOpenSession ? undefined : onStartAlloyDecision}
                onStarted={focusStartedCraft}
                onMentorContext={onMentorContext}
              />
            </section>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
