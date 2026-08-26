import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Hammer,
  FlaskConical,
  RotateCcw,
  Wrench,
} from "lucide-react";
import type { StartCraftingDecision } from "@shared/craftingActions.js";
import type { StartAlloyDecision } from "@shared/craftingAlloys.js";
import { diagnoseCraftingItem } from "@shared/craftingDiagnosis.js";
import type { StartEssenceDecision } from "@shared/craftingEssences.js";
import { sessionOccupiesActiveSlot } from "@shared/decisionSession.js";
import { buildRecommendationMemory } from "@shared/journalMemory.js";
import type { Budget, BuildTarget, CharacterProfile, GoalKind, Item } from "@shared/domain.js";
import { CraftingAcademy } from "@/components/CraftingAcademy";
import { CraftingCoach } from "@/components/CraftingCoach";
import { CraftingActionPlanner } from "@/components/CraftingActionPlanner";
import { ItemArtwork } from "@/components/ItemArtwork";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JournalState } from "@/hooks/useJournal";
import { SLOT_LABELS } from "@/lib/format";
import { DecisionSessionSection } from "@/sections/DecisionSessionSection";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";
import {
  allowsPatchGuidance,
  type PatchCompatibilityRecord,
} from "@shared/patchCompatibility.js";

interface CraftingSectionProps {
  profile: CharacterProfile | null;
  patchCompatibility: PatchCompatibilityRecord | null;
  budget: Budget;
  goal: GoalKind;
  target?: BuildTarget;
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
  onSelectedItemChange?: (itemId: string) => void;
}

type CraftingMode = "coach" | "academy" | "laboratory";

function CraftingModeChooser({
  mode,
  onSelect,
}: {
  mode: CraftingMode;
  onSelect: (next: CraftingMode) => void;
}) {
  const options = [
    {
      id: "academy" as const,
      testId: "crafting-mode-academy",
      icon: GraduationCap,
      title: "Aprender crafting",
      detail: "Lecciones y desafíos para entender cada etapa.",
    },
    {
      id: "coach" as const,
      testId: "crafting-mode-coach",
      icon: Hammer,
      title: "Ayuda en vivo",
      detail: "Importa una pieza y te digo la siguiente acción legal.",
    },
    {
      id: "laboratory" as const,
      testId: "crafting-mode-laboratory",
      icon: FlaskConical,
      title: "Taller avanzado",
      detail: "Dirige un proyecto con fases, salidas y recuperación.",
    },
  ];

  return (
    <div
      className="grid min-w-0 gap-2 md:grid-cols-3"
      role="group"
      aria-label="Cómo quieres usar Crafting"
      data-testid="crafting-mode-chooser"
      data-mode={mode}
    >
      {options.map((option) => {
        const active = mode === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            data-testid={option.testId}
            data-active={active ? "true" : "false"}
            aria-pressed={active}
            onClick={() => onSelect(option.id)}
            className={`crafting-mode-card flex min-h-16 min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-[transform,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${
              active
                ? "border-primary/70 bg-primary/[0.11] shadow-[inset_3px_0_0_hsl(var(--primary))] data-[active='true']:ring-2 data-[active='true']:ring-primary/55"
                : "border-border bg-muted/10 hover:-translate-y-px hover:border-primary/40"
            }`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-sm border ${
                active ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground"
              }`}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.title}</span>
              <span className="block text-xs text-muted-foreground">{option.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * El banco técnico completo, plegado.
 *
 * No se elimina ni pierde estado: su contenido sigue montado detrás del
 * atributo `hidden`, así que sesiones, protecciones, presupuesto y resultados
 * siguen exactamente donde estaban. `hidden` además garantiza que el foco de
 * teclado no entre en contenido invisible.
 */
function AdvancedToolsToggle({
  open,
  locked,
  onToggle,
}: {
  open: boolean;
  /** Hay un craft en marcha: el banco no puede plegarse o se perdería de vista. */
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      aria-expanded={open}
      aria-controls="crafting-workspace"
      data-testid="crafting-avanzado-toggle"
      data-open={open ? "true" : "false"}
      className="flex min-h-12 w-full items-center gap-3 rounded-md border border-border/70 bg-muted/[0.04] px-3 py-2.5 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
    >
      <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Herramientas avanzadas</span>
        <span className="block text-xs text-muted-foreground">
          {locked
            ? "Tienes un craft en marcha aquí abajo."
            : "Control manual de objetivos, protecciones y monedas."}
        </span>
      </span>
      <ChevronDown
        className={`size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}

/** Tercera área principal: selección, diagnóstico, decisión y resultado. */
export function CraftingSection({
  profile,
  patchCompatibility,
  budget,
  goal,
  target,
  journal,
  requestedItemId = null,
  onEditExpediente,
  onStartCraftingDecision,
  onStartEssenceDecision,
  onStartAlloyDecision,
  onApplyCraftingResult,
  onMentorEvent,
  onMentorContext,
  onSelectedItemChange,
}: CraftingSectionProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mode, setMode] = useState<CraftingMode>("coach");
  /** El banco técnico existe, pero no compite con la recomendación principal. */
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const laboratoryFallback =
    mode === "laboratory"
      ? craftableItems.find((item) => diagnoseCraftingItem(item).state === "complete")
      : null;
  const selectedItem =
    craftableItems.find((item) => item.id === preferredId) ??
    laboratoryFallback ??
    craftableItems[0] ??
    null;
  const selectedItemState = selectedItem ? diagnoseCraftingItem(selectedItem) : null;
  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    onSelectedItemChange?.(itemId);
    const item = craftableItems.find((candidate) => candidate.id === itemId);
    if (item) onMentorContext?.({ type: "craftingItem", item });
  };
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

  /**
   * Una sesión de craft ya en marcha vive dentro del banco. Si el banco
   * estuviera plegado quedaría inalcanzable, así que se despliega solo en ese
   * caso concreto: no al pegar una pieza.
   */
  const advancedVisible = advancedOpen || activeCrafting !== null;

  const coach = (
    <CraftingCoach
      profile={profile}
      patch={patchCompatibility?.patchId ?? profile?.patch ?? "Desconocido"}
      budget={budget}
      goal={goal}
      target={target}
      items={craftableItems}
      selectedItem={selectedItem}
      onSelectItem={selectItem}
      onPasteItem={onEditExpediente}
      onOpenAdvanced={() => setAdvancedOpen(true)}
      showInitialRepairBanner={!advancedVisible}
      onMentorContext={onMentorContext}
    />
  );

  const chooser = <CraftingModeChooser mode={mode} onSelect={setMode} />;

  if (patchCompatibility && !allowsPatchGuidance(patchCompatibility)) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        {chooser}
        <section
          className="superficie-panel border-amber-500/40 p-5 sm:p-6"
          data-testid="crafting-patch-review-gate"
          role="status"
          aria-labelledby="crafting-patch-review-title"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/85">
            Crafting detenido por seguridad
          </p>
          <h2 id="crafting-patch-review-title" className="dossier-title mt-1 text-2xl font-semibold">
            El parche {patchCompatibility.patchId} necesita revisión
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {patchCompatibility.summary} No recomendaré monedas ni rutas hasta contrastar de nuevo las mecánicas y los datos de esta versión.
          </p>
          <p className="mt-3 text-xs text-amber-100/85">
            Puedes seguir importando tu personaje y tus objetos; lo que queda pausado es el consejo dependiente del parche.
          </p>
        </section>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        {chooser}
        {mode === "academy" ? (
          <CraftingAcademy onPracticeWithMyItem={() => setMode("coach")} />
        ) : mode === "laboratory" ? (
          <section className="superficie-panel p-6" data-testid="crafting-laboratory-needs-profile">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75">
              Flujo avanzado bloqueado
            </p>
            <h2 className="dossier-title text-2xl font-semibold">Primero necesito una pieza real</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pega el texto de una pieza para leer su estructura real y planear con precisión.
            </p>
            <Button className="mt-4" type="button" onClick={onEditExpediente}>
              Pegar un objeto del juego
            </Button>
          </section>
        ) : (
          coach
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {chooser}
      {mode === "academy" && (
        <CraftingAcademy onPracticeWithMyItem={() => setMode("coach")} />
      )}
      <div hidden={mode !== "coach"} className="flex min-w-0 flex-col gap-5">
        {coach}
        <AdvancedToolsToggle
          open={advancedVisible}
          locked={activeCrafting !== null}
          onToggle={() => setAdvancedOpen((current) => !current)}
        />
      </div>
      <div
        id="crafting-workspace"
        hidden={mode === "academy" || (mode === "coach" && !advancedVisible)}
        className="flex min-w-0 flex-col gap-7"
        data-testid="crafting-workspace"
      >
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
              {mode === "laboratory" ? "Taller avanzado" : "Banco de crafting"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === "laboratory"
                ? "Objetivo persistente · ruta · recuperación · parada."
                : "Elige · decide · aplica · compara."}
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
            Pega un objeto normal, mágico o raro para entrar en modo IA. Luego elige acción y objetivo.
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
                      className={`crafting-mode-card flex min-h-11 w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all ${
                        active
                          ? "border-primary/70 bg-primary/[0.11] shadow-[inset_3px_0_0_hsl(var(--primary))]"
                          : "border-border bg-muted/10 hover:-translate-y-px hover:border-primary/35 lg:hover:translate-x-0.5 lg:hover:translate-y-0"
                      }`}
                      onClick={() => {
                        selectItem(item.id);
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
                <div className="flex min-w-0 flex-wrap gap-2">
                  <span className="gamer-chip gamer-chip--neutral">Ranura: {SLOT_LABELS[selectedItem.slot]}</span>
                  <span
                    className={`gamer-chip ${selectedItemState?.state === "complete" ? "gamer-chip--ok" : "gamer-chip--warn"}`}
                  >
                    <span aria-hidden="true">●</span> {selectedItemState ? selectedItemState.label : "Sin diagnosticar"}
                  </span>
                </div>
              </div>
              <CraftingActionPlanner
                key={`${selectedItem.id}:${mode}`}
                item={selectedItem}
                profile={profile}
                target={target}
                profileGoal={goal}
                budget={budget}
                patch={profile.patch}
                onUpdateItem={onEditExpediente}
                showStatusLabel={false}
                onStartCraftingDecision={hasOpenSession ? undefined : onStartCraftingDecision}
                onStartEssenceDecision={hasOpenSession ? undefined : onStartEssenceDecision}
                onStartAlloyDecision={hasOpenSession ? undefined : onStartAlloyDecision}
                onStarted={focusStartedCraft}
                onMentorContext={onMentorContext}
                experience={mode === "laboratory" ? "laboratory" : "bank"}
                candidateItems={craftableItems}
                onSelectCandidate={selectItem}
                onAddCandidate={onEditExpediente}
              />
            </section>
          )}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
