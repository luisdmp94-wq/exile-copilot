import { useState } from "react";
import { BookOpen, Crosshair, FileCheck2, Route, X } from "lucide-react";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import {
  GGG_AFFILIATION_NOTICE,
  GGG_AFFILIATION_NOTICE_ES,
  type PlanResolution,
} from "@shared/passiveRegistry.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { describeAscendancy } from "@/lib/ascendancyDisplay";
import { ImportPanel } from "@/components/ImportPanel";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    kicker: "Build objetivo",
    title: "La build que quieres alcanzar",
    referenceBadge: "Referencia, no verificada",
    planBadge: "Plan .build oficial importado",
    openHint: "Abrir importación y objetivo opcional",
    engineDataSummary: "Qué información usa el Copiloto",
    engineDataBody:
      "El nombre, el resultado buscado y los mods deseados sí se envían al motor y pueden cambiar las recomendaciones. El enlace solo se guarda como referencia: no se descarga ni se verifica su contenido.",
    planTitle: "Plan importado desde un archivo .build oficial",
    planBody: (passives: number, skills: number, slots: number, date: string) =>
      `Archivo de plan importado como build objetivo — no es tu personaje actual. Contiene ${passives} pasiva(s), ${skills} habilidad(es) y ${slots} hueco(s) de inventario. Importado el ${date}. El plan original se conserva íntegro y se reenvía al motor tal cual.`,
    removePlan: "Quitar plan importado",
    warningsTitle: "Avisos de importación del plan",
    nameLabel: "Nombre de la build objetivo",
    namePlaceholder: "p. ej. Gemling Grenade Mercenary",
    urlLabel: "Enlace de referencia",
    summaryLabel: "Resultado buscado",
    summaryPlaceholder: "¿Qué quieres conseguir con esta build?",
    modsLabel: "Mods deseados (uno por línea)",
    modsPlaceholder: "+% de daño físico aumentado\n+ vida máxima\nresistencias de fuego",
  },
  {
    kicker: "Target build",
    title: "The build you want to reach",
    referenceBadge: "Reference, not verified",
    planBadge: "Official .build plan imported",
    openHint: "Open import and optional target",
    engineDataSummary: "What the Copilot uses",
    engineDataBody:
      "The name, the goal and the wanted modifiers are sent to the engine and can change the recommendations. The link is only kept as a reference: we don't download or check what's on it.",
    planTitle: "Plan imported from an official .build file",
    planBody: (passives: number, skills: number, slots: number, date: string) =>
      `Plan file imported as your target build — it isn't your current character. It has ${passives} ${passives === 1 ? "passive" : "passives"}, ${skills} ${skills === 1 ? "skill" : "skills"} and ${slots} inventory ${slots === 1 ? "slot" : "slots"}. Imported on ${date}. The original plan is kept whole and sent to the engine as is.`,
    removePlan: "Remove imported plan",
    warningsTitle: "Plan import warnings",
    nameLabel: "Target build name",
    namePlaceholder: "e.g. Gemling Grenade Mercenary",
    urlLabel: "Reference link",
    summaryLabel: "What you're after",
    summaryPlaceholder: "What do you want this build to do?",
    modsLabel: "Wanted modifiers (one per line)",
    modsPlaceholder: "+% increased Physical Damage\n+ to maximum Life\nFire Resistance",
  },
);

const RESOLUTION_TEXT = texts(
  {
    title: "IDs encontrados en el export oficial de PoE2",
    namedCount: (resolved: number, total: number) => `${resolved}/${total} IDs con nombre oficial`,
    ascendancy: "Ascendencia:",
    notVerified: "No verificado",
    source: "Fuente:",
    dataFrom: "datos de",
    license: "licencia:",
    licenseMissing: "no encontrada",
    testedPatch: "compatibilidad probada con el parche",
    gggNoClaim: "(GGG no afirma esa correspondencia).",
    exportCaveat:
      "Coincidir con el export confirma el id y su texto; no demuestra por sí solo que el nodo siga asignable o activo en el árbol actual.",
    affiliation: GGG_AFFILIATION_NOTICE_ES,
  },
  {
    title: "IDs found in the official PoE2 export",
    namedCount: (resolved: number, total: number) => `${resolved}/${total} IDs with an official name`,
    ascendancy: "Ascendancy:",
    notVerified: "Not verified",
    source: "Source:",
    dataFrom: "data by",
    license: "licence:",
    licenseMissing: "not found",
    testedPatch: "tested against patch",
    gggNoClaim: "(GGG doesn't claim this match).",
    exportCaveat:
      "Matching the export confirms the id and its text; on its own it doesn't prove the node can still be allocated or is active in the current tree.",
    affiliation: GGG_AFFILIATION_NOTICE,
  },
);

export interface TargetDraft {
  name: string;
  sourceUrl: string;
  summary: string;
  desiredModsText: string;
  /** Plan oficial importado de un `.build` de GGG; se conserva crudo. */
  plan: BuildTargetPlan | null;
}

interface TargetSectionProps {
  draft: TargetDraft;
  warnings: string[];
  /**
   * Resolución de los ids del plan contra el registro oficial de GGG.
   * Es información PARALELA: el `.build` crudo de `draft.plan` no se toca.
   */
  resolution: PlanResolution | null;
  onChange: (draft: TargetDraft) => void;
  importBusy: boolean;
  importText: string;
  onImportTextChange: (value: string) => void;
  onImportPlan: (content: string) => Promise<unknown>;
}

/** Build objetivo opcional: solo una referencia, nunca verdad absoluta. */
export function TargetSection({
  draft,
  warnings,
  resolution,
  onChange,
  importBusy,
  importText,
  onImportTextChange,
  onImportPlan,
}: TargetSectionProps) {
  const t = useText(TEXT);
  const [open, setOpen] = useState(draft.plan !== null || warnings.length > 0);

  return (
    <details
      className="briefing-card overflow-hidden rounded-xl border border-border/80 bg-card"
      data-testid="target-context-details"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer list-none px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden sm:px-6">
        <p className="rotulo-seccion flex items-center gap-2 text-primary/75">
          <Route className="size-4" aria-hidden="true" />
          {t.kicker}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="dossier-title text-xl font-semibold text-foreground">{t.title}</span>
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-300"
          >
            {t.referenceBadge}
          </Badge>
          {draft.plan && (
            <Badge
              variant="outline"
              className="border-primary/50 bg-primary/10 text-primary"
            >
              <FileCheck2 className="size-3.5" aria-hidden="true" />
              {t.planBadge}
            </Badge>
          )}
        </div>
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {t.openHint}
        </span>
      </summary>
      <div className="flex flex-col gap-6 border-t border-border/70 px-6 py-6">
        <ImportPanel
          kind="target"
          busy={importBusy}
          pasted={importText}
          onPastedChange={onImportTextChange}
          onImport={onImportPlan}
        />
        <details
          className="rounded-md border border-border/70 bg-muted/10 px-3 py-2 text-sm"
          data-testid="target-engine-data-details"
        >
          <summary className="min-h-11 cursor-pointer content-center font-medium text-foreground">
            {t.engineDataSummary}
          </summary>
          <p className="border-t border-border/60 pt-3 leading-relaxed text-muted-foreground">
            {t.engineDataBody}
          </p>
        </details>
        {draft.plan && (
          <Alert className="border-primary/50 bg-primary/10 [&>svg]:text-primary">
            <FileCheck2 className="size-4" aria-hidden="true" />
            <AlertTitle>{t.planTitle}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {t.planBody(
                  draft.plan.build.passives?.length ?? 0,
                  draft.plan.build.skills?.length ?? 0,
                  draft.plan.build.inventory_slots?.length ?? 0,
                  formatDateTime(draft.plan.importedAt),
                )}
              </span>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...draft, plan: null })}
                >
                  <X className="size-4" aria-hidden="true" />
                  {t.removePlan}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300">
            <AlertTitle>{t.warningsTitle}</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {draft.plan && resolution && <PlanResolutionView resolution={resolution} />}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="briefing-field">
            <Label htmlFor="target-name">{t.nameLabel}</Label>
            <Input
              id="target-name"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder={t.namePlaceholder}
            />
          </div>
          <div className="briefing-field">
            <Label htmlFor="target-url" className="inline-flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {t.urlLabel}
            </Label>
            <Input
              id="target-url"
              type="url"
              value={draft.sourceUrl}
              onChange={(e) => onChange({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://mobalytics.gg/poe-2/…"
            />
          </div>
        </div>
        <div className="briefing-field">
          <Label htmlFor="target-summary" className="flex items-center gap-2">
            <Crosshair className="size-3.5 text-primary" aria-hidden="true" />
            {t.summaryLabel}
          </Label>
          <Textarea
            id="target-summary"
            value={draft.summary}
            onChange={(e) => onChange({ ...draft, summary: e.target.value })}
            rows={2}
            placeholder={t.summaryPlaceholder}
          />
        </div>
        <div className="briefing-field">
          <Label htmlFor="target-mods">{t.modsLabel}</Label>
          <Textarea
            id="target-mods"
            value={draft.desiredModsText}
            onChange={(e) => onChange({ ...draft, desiredModsText: e.target.value })}
            rows={4}
            placeholder={t.modsPlaceholder}
            className="font-mono text-xs"
          />
        </div>
      </div>
    </details>
  );
}

/**
 * Identificadores del plan resueltos contra el export oficial del árbol de
 * pasivas de GGG. Siempre se muestra el id crudo; un id que no está en el
 * registro aparece como «No verificado» y su nombre NUNCA se deduce del id.
 */
function PlanResolutionView({ resolution }: { resolution: PlanResolution }) {
  const t = useText(RESOLUTION_TEXT);
  const { ascendancy, passives, resolvedCount, totalCount, source } = resolution;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {t.title}
        </p>
        <Badge
          variant="outline"
          className={
            resolvedCount === totalCount
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-amber-500/40 bg-amber-500/15 text-amber-300"
          }
        >
          {t.namedCount(resolvedCount, totalCount)}
        </Badge>
      </div>

      {ascendancy && (
        <p className="text-sm text-muted-foreground">
          {t.ascendancy}{" "}
          {/* Tres realidades por separado: nombre verificado, nombre no
              publicado pero clase conocida, o id desconocido. El nombre nunca
              se inventa; el id crudo se muestra siempre. */}
          <span
            className={
              ascendancy.verified
                ? "font-medium text-foreground"
                : "text-amber-300"
            }
          >
            {describeAscendancy(ascendancy)}
          </span>{" "}
          <span className="font-mono text-xs">({ascendancy.id})</span>
        </p>
      )}

      {passives.length > 0 && (
        <ul className="grid max-h-64 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto text-sm sm:grid-cols-2">
          {passives.map((passive, index) => (
            <li key={`${passive.id}-${index}`} className="flex flex-wrap items-baseline gap-1.5">
              {passive.verified ? (
                <span className="text-foreground">{passive.name}</span>
              ) : (
                <span className="text-amber-300">{t.notVerified}</span>
              )}
              <span className="font-mono text-xs text-muted-foreground">{passive.id}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {t.source} {source.game.toUpperCase()} · {source.sourceRepository} @{" "}
        <span className="font-mono">{source.sourceCommit.slice(0, 8)}</span> · {t.dataFrom}{" "}
        {source.dataOwner} · {t.license}{" "}
        {source.license ?? t.licenseMissing} · {t.testedPatch}{" "}
        {source.testedAgainstPatch} {t.gggNoClaim}
      </p>
      <p className="text-xs text-amber-200/80">
        {t.exportCaveat}
      </p>
      <p className="text-xs text-muted-foreground">{t.affiliation}</p>
    </div>
  );
}
