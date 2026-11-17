import { useMemo, useState } from "react";
import { ClipboardCopy, ClipboardPaste, FileSearch, TriangleAlert } from "lucide-react";
import {
  assessCraftingImportIssue,
  buildCraftingImportReport,
  summarizeCraftingImportEvidence,
} from "@shared/craftingImportReport.js";
import type { Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    howToFix: "Cómo corregirlo",
    whatItMeans: "Qué significa",
    recognized: "Sí he leído",
    stillNeed: "Todavía necesito",
    reviewBlocked: "Revisar por qué el diagnóstico sigue bloqueado.",
    stepHover: "Pasa el ratón por la pieza dentro de PoE2.",
    stepPress: "Pulsa",
    stepPaste: "Vuelve y pega el texto completo.",
    observedReason: "Motivo observado:",
    pasteFixed: "Pegar la pieza corregida",
    pasteOther: "Pegar otra pieza",
    copyReport: "Copiar informe",
    hideReport: "Ocultar informe",
    showReport: "Revisar informe",
    copied: "Informe copiado. No se ha enviado nada.",
    copyFailed: "El navegador no permitió copiarlo: el informe queda abierto para selección manual.",
    reviewBeforeSharing: "Revísalo antes de compartirlo. Solo contiene la lectura de esta pieza.",
    reportLabel: "Informe local de lectura del objeto",
  },
  {
    howToFix: "How to fix it",
    whatItMeans: "What it means",
    recognized: "What I could read",
    stillNeed: "What I still need",
    reviewBlocked: "Check why the diagnosis is still blocked.",
    stepHover: "Hover over the item in PoE2.",
    stepPress: "Press",
    stepPaste: "Come back and paste the full text.",
    observedReason: "Reason found:",
    pasteFixed: "Paste the fixed item",
    pasteOther: "Paste another item",
    copyReport: "Copy report",
    hideReport: "Hide report",
    showReport: "Check report",
    copied: "Report copied. Nothing was sent.",
    copyFailed: "Your browser didn't allow copying: the report stays open so you can select it by hand.",
    reviewBeforeSharing: "Check it before you share it. It only contains how this item was read.",
    reportLabel: "Local report of how the item was read",
  },
);

export function CraftingRepairBanner({
  onRepaste,
  reason,
  item,
  patch,
}: {
  onRepaste?: () => void;
  reason?: string | null;
  item: Item;
  patch: string;
}) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copyResult, setCopyResult] = useState<{
    report: string;
    state: "copied" | "manual";
  } | null>(null);
  const issue = useMemo(() => assessCraftingImportIssue(item, undefined, lang), [item, lang]);
  const report = useMemo(
    () => buildCraftingImportReport({ item, patch }, lang),
    [item, patch, lang],
  );
  const evidence = useMemo(
    () => summarizeCraftingImportEvidence(item, undefined, lang),
    [item, lang],
  );
  const copyState = copyResult?.report === report ? copyResult.state : "idle";

  const copyReport = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard no disponible");
      await navigator.clipboard.writeText(report);
      setCopyResult({ report, state: "copied" });
    } catch {
      setReportOpen(true);
      setCopyResult({ report, state: "manual" });
    }
  };

  return (
    <section
      className="rounded-md border border-amber-500/45 bg-amber-500/[0.09] p-3 text-amber-50"
      data-testid="crafting-repair-banner"
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
            {issue.title}
          </p>
          <p
            className="mt-1 text-xs font-semibold text-amber-300/80"
            data-testid="crafting-repair-category"
            data-kind={issue.kind}
          >
            {issue.label}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          data-testid="crafting-repair-toggle"
        >
          {issue.retryCopy ? t.howToFix : t.whatItMeans}
        </Button>
      </div>

      {open && (
        <div className="mt-3 border-t border-amber-500/25 pt-3 text-sm" data-testid="crafting-repair-instructions">
          <p className="text-amber-100/85">{issue.summary}</p>
          <div
            className="mt-3 grid gap-2 sm:grid-cols-2"
            data-testid="crafting-repair-evidence-summary"
          >
            <div className="rounded border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
              <p className="text-xs font-semibold text-emerald-200">
                {t.recognized}
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-emerald-50/80">
                {evidence.recognized.map((fact) => <li key={fact}>✓ {fact}</li>)}
              </ul>
            </div>
            <div className="rounded border border-amber-500/25 bg-background/25 p-3">
              <p className="text-xs font-semibold text-amber-200">
                {t.stillNeed}
              </p>
              {evidence.missing.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-50/80">
                  {evidence.missing.map((fact) => <li key={fact}>• {fact}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-amber-50/75">
                  {t.reviewBlocked}
                </p>
              )}
            </div>
          </div>
          {issue.retryCopy && (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-amber-100/85">
              <li>{t.stepHover}</li>
              <li>
                {t.stepPress} <kbd className="rounded border border-amber-300/35 bg-black/30 px-2 py-1 font-mono font-semibold text-amber-100">Ctrl+Alt+C</kbd>.
              </li>
              <li>{t.stepPaste}</li>
            </ol>
          )}
          {reason && <p className="mt-3 text-xs text-amber-100/70">{t.observedReason} {reason}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-amber-400/45"
              onClick={onRepaste}
              disabled={!onRepaste}
              data-testid="crafting-repair-repaste"
            >
              <ClipboardPaste className="size-4" aria-hidden="true" />
              {issue.retryCopy ? t.pasteFixed : t.pasteOther}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-amber-400/45"
              onClick={() => void copyReport()}
              data-testid="crafting-repair-copy-report"
            >
              <ClipboardCopy className="size-4" aria-hidden="true" />
              {t.copyReport}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setReportOpen((value) => !value)}
              aria-expanded={reportOpen}
              data-testid="crafting-repair-show-report"
            >
              <FileSearch className="size-4" aria-hidden="true" />
              {reportOpen ? t.hideReport : t.showReport}
            </Button>
          </div>
          {copyState !== "idle" && (
            <p
              className="mt-2 text-xs text-amber-100/80"
              role="status"
              data-testid="crafting-repair-copy-status"
            >
              {copyState === "copied"
                ? t.copied
                : t.copyFailed}
            </p>
          )}
          {reportOpen && (
            <div className="mt-3" data-testid="crafting-repair-report-panel">
              <p className="mb-2 text-xs text-amber-100/70">
                {t.reviewBeforeSharing}
              </p>
              <Textarea
                readOnly
                value={report}
                rows={12}
                className="font-mono text-[11px] leading-relaxed"
                onFocus={(event) => event.currentTarget.select()}
                data-testid="crafting-repair-report"
                aria-label={t.reportLabel}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
