import { useEffect, useMemo, useState } from "react";
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
import { useFormatLabels } from "@/lib/formatLabels";
import { texts, useLang, useText } from "@/i18n/lang";
import {
  loadCraftingSelection,
  saveCraftingSelection,
} from "@/lib/craftingSelection";
import {
  hasCraftingWorkspaceMode,
  loadCraftingWorkspaceMode,
  saveCraftingWorkspaceMode,
  type CraftingWorkspaceMode,
} from "@/lib/craftingWorkspaceProgress";
import { DecisionSessionSection } from "@/sections/DecisionSessionSection";
import type { ContextualMentorEvent } from "@/lib/contextualMentor";
import {
  allowsPatchFeature,
  allowsPatchGuidance,
  patchFeatureCoverage,
  type PatchCompatibilityRecord,
} from "@shared/patchCompatibility.js";

const TEXT = texts(
  {
    academyTitle: "Aprender crafting",
    academyCompact: "Aprender",
    academyDetail: "Lecciones y desafíos para entender cada etapa.",
    coachTitle: "Ayuda en vivo",
    coachCompact: "En vivo",
    coachDetail: "Te digo qué hacer dentro de PoE2; tú ejecutas cada paso.",
    laboratoryTitle: "Taller avanzado",
    laboratoryCompact: "Avanzado",
    laboratoryDetail: "Como Ayuda en vivo, pero tú decides qué proteger y cuándo parar.",
    chooserLabel: "Cómo quieres usar Crafting",
    advancedTools: "Banco manual",
    activeCraftBelow: "Tienes un craft en marcha aquí abajo.",
    pausedCraftBelow: "Tienes un craft guardado aquí abajo.",
    advancedToolsDetail: "Para elegir tú cada moneda. No hace falta para seguir la ayuda de arriba.",
    patchCoverageLoading: "La cobertura del parche todavía no se ha cargado.",
    patchStopped: "Crafting detenido por seguridad",
    patchNeedsReview: (patchId: string) => `El parche ${patchId} necesita revisión`,
    patchNoAdvice: "No recomendaré monedas ni rutas hasta contrastar de nuevo las mecánicas y los datos de esta versión.",
    patchKeepImporting: "Puedes seguir importando tu personaje y tus objetos; lo que queda pausado es el consejo dependiente del parche.",
    laboratoryLocked: "Para empezar",
    needRealItem: "Enséñame la pieza",
    needRealItemDetail: "En PoE2, pasa el ratón por el objeto y pulsa Ctrl+Alt+C; luego pégalo aquí.",
    laboratoryDifference: "Aquí decides tú qué líneas proteger y cuándo parar. Si es tu primera vez, empieza por «Ayuda en vivo».",
    pasteGameItem: "Pegar un objeto del juego",
    craftingBench: "Banco de crafting",
    laboratoryFlow: "Te digo la moneda · la usas en PoE2 · pegas lo que salió.",
    benchFlow: "Prepara aquí · ejecuta en PoE2 · vuelve y compara.",
    itemCount: (count: number) => `${count} pieza(s)`,
    otherDecisionTitle: "Ya hay otra decisión en curso",
    otherDecisionDetail: "Termina o pausa lo que tienes abierto en tu personaje antes de empezar un craft: solo llevo una cosa a la vez.",
    savedWithoutBlocking: "Guardado sin bloquear el banco",
    pausedCount: (count: number) => (count === 1 ? "Tienes un craft pausado" : `Tienes ${count} crafts pausados`),
    resumeNote: "Reanudamos este craft pausado.",
    resume: "Reanudar",
    noItemsTitle: "No hay piezas analizables",
    noItemsDetail: "Pega un objeto normal, mágico o raro. Luego elige qué buscas y con qué moneda.",
    addItem: "Añadir un objeto",
    items: "Piezas",
    unknownLevel: "desconocido",
    slot: "Ranura:",
    notDiagnosed: "Sin diagnosticar",
  },
  {
    academyTitle: "Learn crafting",
    academyCompact: "Learn",
    academyDetail: "Lessons and challenges to understand each step.",
    coachTitle: "Live help",
    coachCompact: "Live",
    coachDetail: "I tell you what to do in PoE2; you do each step.",
    laboratoryTitle: "Advanced workshop",
    laboratoryCompact: "Advanced",
    laboratoryDetail: "Like Live help, but you decide what to protect and when to stop.",
    chooserLabel: "How you want to use Crafting",
    advancedTools: "Manual bench",
    activeCraftBelow: "You have a craft in progress below.",
    pausedCraftBelow: "You have a saved craft below.",
    advancedToolsDetail: "To pick every currency yourself. You don't need it to follow the help above.",
    patchCoverageLoading: "Patch coverage hasn't loaded yet.",
    patchStopped: "Crafting paused for safety",
    patchNeedsReview: (patchId: string) => `Patch ${patchId} needs a review`,
    patchNoAdvice: "I won't recommend currency or routes until the mechanics and data for this version are checked again.",
    patchKeepImporting: "You can keep importing your character and items; only the patch-dependent advice is paused.",
    laboratoryLocked: "To get started",
    needRealItem: "Show me the item",
    needRealItemDetail: "In PoE2, hover the item and press Ctrl+Alt+C; then paste it here.",
    laboratoryDifference: "Here you decide which lines to protect and when to stop. If it's your first time, start with “Live help”.",
    pasteGameItem: "Paste an item from the game",
    craftingBench: "Crafting bench",
    laboratoryFlow: "I name the currency · you use it in PoE2 · you paste what came out.",
    benchFlow: "Prepare here · do it in PoE2 · come back and compare.",
    itemCount: (count: number) => `${count} ${count === 1 ? "item" : "items"}`,
    otherDecisionTitle: "Another decision is already in progress",
    otherDecisionDetail: "Finish or pause the open case on your character before starting a craft. We never keep two next actions at the same time.",
    savedWithoutBlocking: "Saved without blocking the bench",
    pausedCount: (count: number) => (count === 1 ? "You have a paused craft" : `You have ${count} paused crafts`),
    resumeNote: "We're resuming this paused craft.",
    resume: "Resume",
    noItemsTitle: "No items to analyse",
    noItemsDetail: "Paste a normal, magic or rare item to start. Then pick an action and a goal.",
    addItem: "Add an item",
    items: "Items",
    unknownLevel: "unknown",
    slot: "Slot:",
    notDiagnosed: "Not diagnosed",
  },
);

interface CraftingSectionProps {
  profile: CharacterProfile | null;
  patchCompatibility: PatchCompatibilityRecord | null;
  budget: Budget | null;
  goal: GoalKind;
  target?: BuildTarget;
  journal: JournalState;
  requestedItemId?: string | null;
  onEditExpediente: () => void;
  onOpenCharacter: () => void;
  onOpenEquipmentItem: (itemId: string) => void;
  onOpenPlanMarket: () => void;
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
  /** Pregunta sobre el personaje que Crafting no puede responder: va al Mentor. */
  onAskMentor?: (question: string) => void;
  /** «Compararla con otra» desde la lectura de la pieza. */
  onCompareItem?: (item: Item) => void;
  /** «Ver mis resistencias» desde la lectura de la pieza. */
  onCheckResistances?: () => void;
}

type CraftingMode = CraftingWorkspaceMode;

function CraftingModeChooser({
  mode,
  onSelect,
}: {
  mode: CraftingMode;
  onSelect: (next: CraftingMode) => void;
}) {
  const t = useText(TEXT);
  const options = [
    {
      id: "academy" as const,
      testId: "crafting-mode-academy",
      icon: GraduationCap,
      title: t.academyTitle,
      compactTitle: t.academyCompact,
      detail: t.academyDetail,
    },
    {
      id: "coach" as const,
      testId: "crafting-mode-coach",
      icon: Hammer,
      title: t.coachTitle,
      compactTitle: t.coachCompact,
      detail: t.coachDetail,
    },
    {
      id: "laboratory" as const,
      testId: "crafting-mode-laboratory",
      icon: FlaskConical,
      title: t.laboratoryTitle,
      compactTitle: t.laboratoryCompact,
      detail: t.laboratoryDetail,
    },
  ];

  return (
    <div
      className="grid min-w-0 grid-cols-3 gap-2"
      role="group"
      aria-label={t.chooserLabel}
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
            aria-label={`${option.title}. ${option.detail}`}
            onClick={() => onSelect(option.id)}
            className={`crafting-mode-card flex min-h-16 min-w-0 flex-col items-start gap-2 rounded-md border px-2 py-2 text-left transition-[transform,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none sm:flex-row sm:items-center sm:px-3 ${
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
              <span className="block text-sm font-semibold lg:hidden">{option.compactTitle}</span>
              <span className="hidden text-sm font-semibold lg:block">{option.title}</span>
              <span className="hidden text-xs text-muted-foreground lg:block">{option.detail}</span>
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
  sessionState,
  onToggle,
}: {
  open: boolean;
  /** Un craft activo o pausado debe seguir localizable desde Ayuda en vivo. */
  sessionState: "active" | "paused" | null;
  onToggle: () => void;
}) {
  const t = useText(TEXT);
  const locked = sessionState !== null;
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
        <span className="block text-sm font-medium">{t.advancedTools}</span>
        <span className="block text-xs text-muted-foreground">
          {locked
            ? sessionState === "active"
              ? t.activeCraftBelow
              : t.pausedCraftBelow
            : t.advancedToolsDetail}
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
  onOpenCharacter,
  onOpenEquipmentItem,
  onOpenPlanMarket,
  onStartCraftingDecision,
  onStartEssenceDecision,
  onStartAlloyDecision,
  onApplyCraftingResult,
  onMentorEvent,
  onMentorContext,
  onSelectedItemChange,
  onAskMentor,
  onCompareItem,
  onCheckResistances,
}: CraftingSectionProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const labels = useFormatLabels();
  const [selectedItemSelection, setSelectedItemSelection] = useState<{
    profileId: string;
    itemId: string;
  } | null>(null);
  const craftingScope = profile?.id ?? null;
  const [modeSelection, setModeSelection] = useState<{
    profileId: string | null;
    mode: CraftingMode;
  }>(() => ({
    profileId: craftingScope,
    mode: loadCraftingWorkspaceMode(craftingScope),
  }));
  // Pegar la primera pieza crea el personaje provisional. Quien estaba en el
  // Taller sin personaje sigue en el Taller con su pieza: no se le manda a
  // Ayuda en vivo solo porque el personaje acaba de nacer.
  const carriedFromNoCharacter =
    modeSelection.profileId === null &&
    craftingScope !== null &&
    !hasCraftingWorkspaceMode(craftingScope);
  const mode = modeSelection.profileId === craftingScope || carriedFromNoCharacter
    ? modeSelection.mode
    : loadCraftingWorkspaceMode(craftingScope);
  useEffect(() => {
    if (carriedFromNoCharacter) saveCraftingWorkspaceMode(craftingScope, modeSelection.mode);
  }, [carriedFromNoCharacter, craftingScope, modeSelection.mode]);
  /** Objetivo escrito en Ayuda en vivo que inicia un proyecto avanzado nuevo. */
  const [laboratoryDraftObjective, setLaboratoryDraftObjective] = useState("");
  /** El banco técnico existe, pero no compite con la recomendación principal. */
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const craftableItems = useMemo(
    () =>
      (profile?.items ?? []).filter((item) =>
        ["normal", "magic", "rare"].includes(item.rarity),
      ),
    [profile?.items],
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

  const selectedItemId =
    selectedItemSelection !== null && selectedItemSelection.profileId === profile?.id
      ? selectedItemSelection.itemId
      : profile
        ? loadCraftingSelection(profile.id)
        : null;
  const preferredId = activeCrafting?.originalItem.id ?? requestedItemId ?? selectedItemId;
  const laboratoryFallback =
    mode === "laboratory"
      ? craftableItems.find((item) => diagnoseCraftingItem(item).state === "complete")
      : null;
  const selectedItem =
    craftableItems.find((item) => item.id === preferredId) ??
    laboratoryFallback ??
    craftableItems[0] ??
    null;
  const selectedItemState = selectedItem ? diagnoseCraftingItem(selectedItem, lang) : null;
  const selectItem = (itemId: string) => {
    if (profile) {
      setSelectedItemSelection({ profileId: profile.id, itemId });
      saveCraftingSelection(profile.id, itemId);
    }
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
  const advancedVisible =
    advancedOpen || activeCrafting !== null || pausedCrafts.length > 0;
  const advancedCraftingAvailable = patchCompatibility !== null &&
    allowsPatchFeature(patchCompatibility, "advanced-crafting");
  const advancedCraftingNote = patchCompatibility
    ? patchFeatureCoverage(patchCompatibility, "advanced-crafting").note
    : t.patchCoverageLoading;

  const selectMode = (nextMode: CraftingMode) => {
    // Entrar desde el selector es una navegación manual. Solo el CTA del guía
    // transporta un objetivo nuevo al Taller.
    if (nextMode === "laboratory") setLaboratoryDraftObjective("");
    setModeSelection({ profileId: craftingScope, mode: nextMode });
    saveCraftingWorkspaceMode(craftingScope, nextMode);
  };
  const openLaboratoryFromCoach = (draftObjective?: string) => {
    setLaboratoryDraftObjective(draftObjective?.trim() ?? "");
    setModeSelection({ profileId: craftingScope, mode: "laboratory" });
    saveCraftingWorkspaceMode(craftingScope, "laboratory");
  };
  const openCoach = () => {
    setModeSelection({ profileId: craftingScope, mode: "coach" });
    saveCraftingWorkspaceMode(craftingScope, "coach");
  };
  const handleCraftingSessionEvent = (event: {
    type: "started" | "result" | "paused" | "reopened" | "reconciled";
    title: string;
  }) => {
    onMentorEvent?.(event);
    if (event.type !== "paused") return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const paused = document.querySelector<HTMLElement>(
          '[data-testid="crafting-paused-sessions"]',
        );
        if (!paused) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        paused.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        paused.focus({ preventScroll: true });
      });
    });
  };

  const coach = (
    <CraftingCoach
      key={selectedItem ? `${profile?.id ?? "sin-personaje"}:${selectedItem.id}:${selectedItem.baseType}` : "sin-pieza"}
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
      onOpenLaboratory={openLaboratoryFromCoach}
      onOpenCharacter={onOpenCharacter}
      onOpenEquipmentItem={onOpenEquipmentItem}
      onOpenPlanMarket={onOpenPlanMarket}
      showInitialRepairBanner={!advancedVisible}
      onMentorContext={onMentorContext}
      onAskMentor={onAskMentor}
      onCompareItem={onCompareItem}
      onCheckResistances={onCheckResistances}
    />
  );

  const chooser = <CraftingModeChooser mode={mode} onSelect={selectMode} />;

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
          <p className="text-xs font-semibold text-amber-300/85">
            {t.patchStopped}
          </p>
          <h2 id="crafting-patch-review-title" className="dossier-title mt-1 text-2xl font-semibold">
            {t.patchNeedsReview(patchCompatibility.patchId)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {patchCompatibility.summary} {t.patchNoAdvice}
          </p>
          <p className="mt-3 text-xs text-amber-100/85">
            {t.patchKeepImporting}
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
          <CraftingAcademy
            key={`academy:${craftingScope ?? "sin-personaje"}`}
            profileId={craftingScope}
            onPracticeWithMyItem={openCoach}
          />
        ) : mode === "laboratory" ? (
          <section className="superficie-panel p-6" data-testid="crafting-laboratory-needs-profile">
            <p className="text-xs font-semibold text-primary/75">
              {t.laboratoryLocked}
            </p>
            <h2 className="dossier-title text-2xl font-semibold">{t.needRealItem}</h2>
            <p className="mt-2 text-sm text-foreground">{t.laboratoryDifference}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.needRealItemDetail}
            </p>
            <Button className="mt-4" type="button" onClick={onEditExpediente}>
              {t.pasteGameItem}
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
        <CraftingAcademy
          key={`academy:${craftingScope}`}
          profileId={craftingScope}
          onPracticeWithMyItem={openCoach}
        />
      )}
      <div hidden={mode !== "coach"} className="flex min-w-0 flex-col gap-5">
        {coach}
        <AdvancedToolsToggle
          open={advancedVisible}
          sessionState={
            activeCrafting !== null ? "active" : pausedCrafts.length > 0 ? "paused" : null
          }
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
              {mode === "laboratory" ? t.laboratoryTitle : t.craftingBench}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === "laboratory"
                ? t.laboratoryFlow
                : t.benchFlow}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t.itemCount(craftableItems.length)}
        </p>
      </section>

      {hasOpenSession && !activeCrafting && (
        <Alert>
          <AlertTitle>{t.otherDecisionTitle}</AlertTitle>
          <AlertDescription>
            {t.otherDecisionDetail}
          </AlertDescription>
        </Alert>
      )}

      {!hasOpenSession && pausedCrafts.length > 0 && journal.journal && (
        <section
          className="rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-3"
          data-testid="crafting-paused-sessions"
          aria-labelledby="crafting-paused-title"
          tabIndex={-1}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-amber-200/80">
                {t.savedWithoutBlocking}
              </p>
              <h3 id="crafting-paused-title" className="font-semibold">
                {t.pausedCount(pausedCrafts.length)}
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
                      note: t.resumeNote,
                      profile,
                    }).then((next) => {
                      if (!next) return;
                      onMentorEvent?.({ type: "reopened", title: paused.objective });
                      focusStartedCraft();
                    });
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {t.resume}
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
          onMentorEvent={handleCraftingSessionEvent}
          onApplyCraftingResult={onApplyCraftingResult}
        />
      )}

      <div hidden={Boolean(activeCrafting)} aria-hidden={activeCrafting ? "true" : undefined}>
      {craftableItems.length === 0 ? (
        <section className="superficie-panel p-6" data-testid="crafting-no-items">
          <h3 className="text-xl font-semibold">{t.noItemsTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.noItemsDetail}
          </p>
          <Button className="mt-4" type="button" variant="outline" onClick={onEditExpediente}>
            {t.addItem}
          </Button>
        </section>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <aside className="superficie-panel min-w-0 p-3 lg:sticky lg:top-24" aria-labelledby="crafting-items-title">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 id="crafting-items-title" className="text-sm font-semibold">{t.items}</h3>
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
                const diagnosis = diagnoseCraftingItem(item, lang);
                const needsAttention = diagnosis.state !== "complete";
                return (
                  <li key={item.id} className="min-w-44 snap-start lg:min-w-0">
                    <button
                      type="button"
                      data-testid={`crafting-item-${item.id}`}
                      data-active={active ? "true" : "false"}
                      aria-pressed={active}
                      aria-label={`${item.name}, ${item.baseType}, ${labels.slot[item.slot]}. ${diagnosis.label}`}
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
                          {labels.slot[item.slot]}
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
                    {selectedItem.baseType} · ilvl {selectedItem.itemLevel ?? t.unknownLevel}
                  </p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <span className="gamer-chip gamer-chip--neutral">{t.slot} {labels.slot[selectedItem.slot]}</span>
                  <span
                    className={`gamer-chip ${selectedItemState?.state === "complete" ? "gamer-chip--ok" : "gamer-chip--warn"}`}
                  >
                    <span aria-hidden="true">●</span> {selectedItemState ? selectedItemState.label : t.notDiagnosed}
                  </span>
                </div>
              </div>
              <CraftingActionPlanner
                key={`${selectedItem.id}:${mode}`}
                item={selectedItem}
                profile={profile}
                target={target}
                profileGoal={goal}
                budget={budget ?? undefined}
                patch={profile.patch}
                advancedCraftingAvailable={advancedCraftingAvailable}
                advancedCraftingNote={advancedCraftingNote}
                onUpdateItem={onEditExpediente}
                showStatusLabel={false}
                onStartCraftingDecision={hasOpenSession ? undefined : onStartCraftingDecision}
                onStartEssenceDecision={hasOpenSession ? undefined : onStartEssenceDecision}
                onStartAlloyDecision={hasOpenSession ? undefined : onStartAlloyDecision}
                onStarted={focusStartedCraft}
                onMentorContext={onMentorContext}
                experience={mode === "laboratory" ? "laboratory" : "bank"}
                initialDesiredOutcome={
                  mode === "laboratory" ? laboratoryDraftObjective : undefined
                }
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
