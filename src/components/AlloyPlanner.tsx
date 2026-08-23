import { useState } from "react";
import {
  ALLOY_MECHANIC_SOURCE,
  ALLOY_REMOVAL_LABELS,
  evaluateAlloyPlan,
  type AlloyPlanInput,
  type AlloyRemovalSelection,
  type StartAlloyDecision,
} from "@shared/craftingAlloys.js";
import type { Item } from "@shared/domain.js";
import {
  CRAFTING_GOAL_LABELS,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";
import { evaluateCraftingProtection } from "@shared/craftingProtection.js";
import type { CraftingSuccessCriterion } from "@shared/craftingSuccessCriteria.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS = {
  compatible: {
    label: "Compatible con la evidencia",
    style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  blocked: {
    label: "Bloqueada",
    style: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  "needs-data": {
    label: "Faltan datos",
    style: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
} as const;

interface AlloyPlannerProps {
  item: Item;
  onStart?: StartAlloyDecision;
  onStarted?: () => void;
  goalCategory: CraftingGoalCategory;
  desiredOutcome: string;
  protectedModifierIds: string[];
  successCriteria: CraftingSuccessCriterion[];
  onEditIntention: () => void;
}

export function AlloyPlanner({
  item,
  onStart,
  onStarted,
  goalCategory,
  desiredOutcome,
  protectedModifierIds,
  successCriteria,
  onEditIntention,
}: AlloyPlannerProps) {
  const [alloyName, setAlloyName] = useState("");
  const [fullTooltipText, setFullTooltipText] = useState("");
  const [guaranteedModifierText, setGuaranteedModifierText] = useState("");
  const [declaredItemClassesText, setDeclaredItemClassesText] = useState("");
  const [playerConfirmedClassApplies, setPlayerConfirmedClassApplies] = useState(false);
  const [removalSelection, setRemovalSelection] = useState<AlloyRemovalSelection>("unspecified");
  const [snapshotConfirmed, setSnapshotConfirmed] = useState(false);
  const [tooltipConfirmed, setTooltipConfirmed] = useState(false);
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);
  const [craftedLimitConfirmed, setCraftedLimitConfirmed] = useState(false);
  const [notSpentConfirmed, setNotSpentConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const plan: AlloyPlanInput = {
    alloyName,
    fullTooltipText,
    guaranteedModifierText,
    declaredItemClasses: declaredItemClassesText
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    playerConfirmedClassApplies,
    removalSelection,
  };
  const evaluation = evaluateAlloyPlan(item, plan);
  const protection = evaluateCraftingProtection({
    item,
    protectedModifierIds,
    removedModifierCount: 1,
    removalSelection,
  });
  const status = STATUS[evaluation.status];
  const successCriteriaReady =
    successCriteria.length > 0 &&
    successCriteria.every(
      (criterion) => criterion.kind !== "exact-modifier-text" || criterion.text.trim().length >= 3,
    );
  const ready =
    evaluation.status === "compatible" &&
    desiredOutcome.trim().length >= 3 &&
    successCriteriaReady &&
    snapshotConfirmed &&
    tooltipConfirmed &&
    replacementConfirmed &&
    craftedLimitConfirmed &&
    notSpentConfirmed &&
    protection.status !== "blocked" &&
    protection.status !== "needs-data";

  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-cyan-500/25 bg-cyan-500/[0.035] p-3"
      data-testid="crafting-alloys"
      aria-labelledby={`crafting-alloys-title-${item.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            Mecánica guiada P2
          </p>
          <h3 id={`crafting-alloys-title-${item.id}`} className="mt-1 font-medium text-foreground">
            Alloys
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Registra el tooltip que tienes delante. El asesor comprueba el reemplazo y el límite de
            un modificador fabricado; no deduce el efecto por el nombre del Alloy.
          </p>
        </div>
        <Badge variant="outline" className={status.style}>{status.label}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-foreground">
          Nombre exacto del Alloy
          <input
            value={alloyName}
            onChange={(event) => setAlloyName(event.target.value)}
            placeholder="Cópialo desde el juego"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground">
          Clases de objeto admitidas por el tooltip
          <input
            value={declaredItemClassesText}
            onChange={(event) => setDeclaredItemClassesText(event.target.value)}
            placeholder="Ballestas, arcos… (separadas por comas)"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground sm:col-span-2">
          Tooltip completo del Alloy
          <textarea
            value={fullTooltipText}
            onChange={(event) => setFullTooltipText(event.target.value)}
            placeholder="Pega aquí el texto completo, incluida la condición del objetivo"
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground">
          Cómo se elige el modificador reemplazado
          <select
            value={removalSelection}
            onChange={(event) => setRemovalSelection(event.target.value as AlloyRemovalSelection)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(ALLOY_REMOVAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground sm:col-span-2">
          Modificador fabricado garantizado
          <textarea
            value={guaranteedModifierText}
            onChange={(event) => setGuaranteedModifierText(event.target.value)}
            placeholder="Copia literalmente el resultado garantizado"
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className={`rounded-md border p-3 text-xs ${status.style}`}>
        <p className="font-semibold">Lectura del asesor</p>
        <p className="mt-1 leading-relaxed">{evaluation.reason}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          Plan: <strong className="text-foreground">{CRAFTING_GOAL_LABELS[goalCategory]}</strong>
          {protectedModifierIds.length > 0
            ? ` · ${protectedModifierIds.length} intocable${protectedModifierIds.length === 1 ? "" : "s"}`
            : " · nada marcado como intocable"}
          {` · ${successCriteria.length} condición${successCriteria.length === 1 ? "" : "es"} de parada`}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onEditIntention}>
          Editar intención
        </Button>
      </div>

      {protectedModifierIds.length > 0 && (
        <div
          className={`rounded border p-3 text-xs ${
            protection.status === "blocked"
              ? "border-rose-500/40 bg-rose-500/[0.08] text-rose-100"
              : protection.status === "warning" || protection.status === "needs-data"
                ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-100"
                : "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100"
          }`}
          data-protection-risk={protection.risk}
        >
          <p className="font-medium">Protección del snapshot</p>
          <p className="mt-1">{protection.reason}</p>
        </div>
      )}

      <div className="space-y-2 text-xs text-muted-foreground">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={playerConfirmedClassApplies} onChange={(event) => setPlayerConfirmedClassApplies(event.target.checked)} className="mt-0.5" />
          <span>Confirmo que el tooltip del Alloy nombra la clase de este objeto.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={snapshotConfirmed} onChange={(event) => setSnapshotConfirmed(event.target.checked)} className="mt-0.5" />
          <span>Confirmo que el objeto sigue igual que el snapshot importado.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={tooltipConfirmed} onChange={(event) => setTooltipConfirmed(event.target.checked)} className="mt-0.5" />
          <span>He copiado estos datos desde el Alloy real que voy a usar.</span>
        </label>
        <label className="flex items-start gap-2 text-rose-100">
          <input type="checkbox" checked={replacementConfirmed} onChange={(event) => setReplacementConfirmed(event.target.checked)} className="mt-0.5" />
          <span>Acepto que el resultado reemplazará exactamente un modificador explícito actual.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={craftedLimitConfirmed} onChange={(event) => setCraftedLimitConfirmed(event.target.checked)} className="mt-0.5" />
          <span>Entiendo que el objeto solo puede contener un modificador fabricado.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={notSpentConfirmed} onChange={(event) => setNotSpentConfirmed(event.target.checked)} className="mt-0.5" />
          <span>Confirmo que todavía no he aplicado el Alloy.</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!ready || starting || !onStart}
          onClick={() => {
            if (!ready || !onStart) return;
            setStarting(true);
            void onStart(item, plan, evaluation, {
              desiredOutcome: desiredOutcome.trim(),
              goalCategory,
              protectedModifierIds,
              successCriteria,
            })
              .then((started) => {
                if (started) onStarted?.();
              })
              .finally(() => setStarting(false));
          }}
        >
          {starting ? "Preparando…" : "Crear comprobación de Alloy"}
        </Button>
        {!onStart && (
          <span className="text-xs text-muted-foreground">
            Cierra la comprobación activa para iniciar otra.
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        GGG documenta el reemplazo y el límite de un modificador fabricado desde el parche {ALLOY_MECHANIC_SOURCE.patch}: {" "}
        <a className="underline underline-offset-2" href={ALLOY_MECHANIC_SOURCE.url} target="_blank" rel="noreferrer">
          notas oficiales
        </a>. La compatibilidad concreta se toma del tooltip introducido por el jugador.
      </p>
    </section>
  );
}
