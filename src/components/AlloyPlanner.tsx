import { useState } from "react";
import {
  ALLOY_MECHANIC_SOURCE,
  ALLOY_REMOVAL_LABELS,
  ALLOY_REMOVAL_LABELS_EN,
  evaluateAlloyPlan,
  type AlloyPlanInput,
  type AlloyRemovalSelection,
  type StartAlloyDecision,
} from "@shared/craftingAlloys.js";
import type { Item } from "@shared/domain.js";
import {
  craftingGoalLabel,
  type CraftingGoalCategory,
} from "@shared/craftingGoal.js";
import { evaluateCraftingProtection } from "@shared/craftingProtection.js";
import type { CraftingSuccessCriterion } from "@shared/craftingSuccessCriteria.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { texts, useLang, useText } from "@/i18n/lang";

const STATUS = {
  compatible: {
    style: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  blocked: {
    style: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  "needs-data": {
    style: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
} as const;

const TEXT = texts(
  {
    status: {
      compatible: "Compatible con la evidencia",
      blocked: "Bloqueada",
      "needs-data": "Faltan datos",
    } as Record<keyof typeof STATUS, string>,
    eyebrow: "Mecánica guiada P2",
    intro:
      "Registra el tooltip que tienes delante. El asesor comprueba el reemplazo y el límite de un modificador fabricado; no deduce el efecto por el nombre del Alloy.",
    name: "Nombre exacto del Alloy",
    namePlaceholder: "Cópialo desde el juego",
    classes: "Clases de objeto admitidas por el tooltip",
    classesPlaceholder: "Ballestas, arcos… (separadas por comas)",
    tooltip: "Tooltip completo del Alloy",
    tooltipPlaceholder: "Pega aquí el texto completo, incluida la condición del objetivo",
    removal: "Cómo se elige el modificador reemplazado",
    guaranteed: "Modificador fabricado garantizado",
    guaranteedPlaceholder: "Copia literalmente el resultado garantizado",
    reading: "Lectura del asesor",
    plan: "Plan:",
    mustKeep: (count: number) => ` · ${count} protegida${count === 1 ? "" : "s"}`,
    noneMustKeep: " · nada protegido",
    stopConditions: (count: number) => ` · ${count} condición${count === 1 ? "" : "es"} de parada`,
    editIntention: "Cambiar lo que busco",
    protection: "Lo que proteges",
    confirmClass: "Confirmo que el tooltip del Alloy nombra la clase de este objeto.",
    confirmSnapshot: "El objeto sigue igual que cuando lo pegué aquí.",
    confirmTooltip: "He copiado estos datos desde el Alloy real que voy a usar.",
    confirmReplacement: "Acepto que el resultado reemplazará exactamente un modificador explícito actual.",
    confirmCraftedLimit: "Entiendo que el objeto solo puede contener un modificador fabricado.",
    confirmNotSpent: "Confirmo que todavía no he aplicado el Alloy.",
    preparing: "Preparando…",
    create: "Crear comprobación de Alloy",
    closeActive: "Cierra la comprobación activa para iniciar otra.",
    sourceBefore: (patch: string) =>
      `GGG documenta el reemplazo y el límite de un modificador fabricado desde el parche ${patch}: `,
    sourceLink: "notas oficiales",
    sourceAfter: ". La compatibilidad concreta se toma del tooltip introducido por el jugador.",
  },
  {
    status: {
      compatible: "Fits the evidence",
      blocked: "Blocked",
      "needs-data": "Data missing",
    },
    eyebrow: "Guided mechanic P2",
    intro:
      "Enter the tooltip you have in front of you. The advisor checks the replacement and the one-crafted-modifier limit; it doesn't guess the effect from the Alloy's name.",
    name: "Exact Alloy name",
    namePlaceholder: "Copy it from the game",
    classes: "Item classes the tooltip accepts",
    classesPlaceholder: "Crossbows, bows… (comma separated)",
    tooltip: "Full Alloy tooltip",
    tooltipPlaceholder: "Paste the full text here, including the target condition",
    removal: "How the replaced modifier is chosen",
    guaranteed: "Guaranteed crafted modifier",
    guaranteedPlaceholder: "Copy the guaranteed result word for word",
    reading: "Advisor's reading",
    plan: "Plan:",
    mustKeep: (count: number) => ` · ${count} must-keep`,
    noneMustKeep: " · nothing marked as must-keep",
    stopConditions: (count: number) => ` · ${count} stop condition${count === 1 ? "" : "s"}`,
    editIntention: "Edit plan",
    protection: "Snapshot protection",
    confirmClass: "I confirm the Alloy tooltip names this item's class.",
    confirmSnapshot: "I confirm the item is still the same as the imported snapshot.",
    confirmTooltip: "I copied this data from the real Alloy I'm going to use.",
    confirmReplacement: "I accept the result will replace exactly one current explicit modifier.",
    confirmCraftedLimit: "I understand the item can only hold one crafted modifier.",
    confirmNotSpent: "I confirm I haven't applied the Alloy yet.",
    preparing: "Preparing…",
    create: "Create Alloy check",
    closeActive: "Close the active check to start another.",
    sourceBefore: (patch: string) =>
      `GGG documents the replacement and the one-crafted-modifier limit since patch ${patch}: `,
    sourceLink: "official notes",
    sourceAfter: ". The exact compatibility comes from the tooltip you entered.",
  },
);

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
  const t = useText(TEXT);
  const { lang } = useLang();
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
  const evaluation = evaluateAlloyPlan(item, plan, lang);
  const protection = evaluateCraftingProtection({
    item,
    protectedModifierIds,
    removedModifierCount: 1,
    removalSelection,
  }, lang);
  const status = { ...STATUS[evaluation.status], label: t.status[evaluation.status] };
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
          <p className="text-xs font-semibold text-cyan-300/80">
            {t.eyebrow}
          </p>
          <h3 id={`crafting-alloys-title-${item.id}`} className="mt-1 font-medium text-foreground">
            Alloys
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {t.intro}
          </p>
        </div>
        <Badge variant="outline" className={status.style}>{status.label}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-foreground">
          {t.name}
          <input
            value={alloyName}
            onChange={(event) => setAlloyName(event.target.value)}
            placeholder={t.namePlaceholder}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground">
          {t.classes}
          <input
            value={declaredItemClassesText}
            onChange={(event) => setDeclaredItemClassesText(event.target.value)}
            placeholder={t.classesPlaceholder}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground sm:col-span-2">
          {t.tooltip}
          <textarea
            value={fullTooltipText}
            onChange={(event) => setFullTooltipText(event.target.value)}
            placeholder={t.tooltipPlaceholder}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground">
          {t.removal}
          <select
            value={removalSelection}
            onChange={(event) => setRemovalSelection(event.target.value as AlloyRemovalSelection)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(lang === "en" ? ALLOY_REMOVAL_LABELS_EN : ALLOY_REMOVAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-foreground sm:col-span-2">
          {t.guaranteed}
          <textarea
            value={guaranteedModifierText}
            onChange={(event) => setGuaranteedModifierText(event.target.value)}
            placeholder={t.guaranteedPlaceholder}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className={`rounded-md border p-3 text-xs ${status.style}`}>
        <p className="font-semibold">{t.reading}</p>
        <p className="mt-1 leading-relaxed">{evaluation.reason}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {t.plan} <strong className="text-foreground">{craftingGoalLabel(goalCategory, lang)}</strong>
          {protectedModifierIds.length > 0
            ? t.mustKeep(protectedModifierIds.length)
            : t.noneMustKeep}
          {t.stopConditions(successCriteria.length)}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onEditIntention}>
          {t.editIntention}
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
          <p className="font-medium">{t.protection}</p>
          <p className="mt-1">{protection.reason}</p>
        </div>
      )}

      <div className="space-y-2 text-xs text-muted-foreground">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={playerConfirmedClassApplies} onChange={(event) => setPlayerConfirmedClassApplies(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmClass}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={snapshotConfirmed} onChange={(event) => setSnapshotConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmSnapshot}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={tooltipConfirmed} onChange={(event) => setTooltipConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmTooltip}</span>
        </label>
        <label className="flex items-start gap-2 text-rose-100">
          <input type="checkbox" checked={replacementConfirmed} onChange={(event) => setReplacementConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmReplacement}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={craftedLimitConfirmed} onChange={(event) => setCraftedLimitConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmCraftedLimit}</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={notSpentConfirmed} onChange={(event) => setNotSpentConfirmed(event.target.checked)} className="mt-0.5" />
          <span>{t.confirmNotSpent}</span>
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
          {starting ? t.preparing : t.create}
        </Button>
        {!onStart && (
          <span className="text-xs text-muted-foreground">
            {t.closeActive}
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t.sourceBefore(ALLOY_MECHANIC_SOURCE.patch)}{" "}
        <a className="underline underline-offset-2" href={ALLOY_MECHANIC_SOURCE.url} target="_blank" rel="noreferrer">
          {t.sourceLink}
        </a>{t.sourceAfter}
      </p>
    </section>
  );
}
