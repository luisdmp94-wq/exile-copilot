import { useMemo, useState } from "react";
import { ClipboardCopy, ClipboardPaste, FileSearch, TriangleAlert } from "lucide-react";
import {
  assessCraftingImportIssue,
  buildCraftingImportReport,
} from "@shared/craftingImportReport.js";
import type { Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copyResult, setCopyResult] = useState<{
    report: string;
    state: "copied" | "manual";
  } | null>(null);
  const issue = useMemo(() => assessCraftingImportIssue(item), [item]);
  const report = useMemo(() => buildCraftingImportReport({ item, patch }), [item, patch]);
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
            className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80"
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
          {issue.retryCopy ? "Cómo corregirlo" : "Qué significa"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 border-t border-amber-500/25 pt-3 text-sm" data-testid="crafting-repair-instructions">
          <p className="text-amber-100/85">{issue.summary}</p>
          {issue.retryCopy && (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-amber-100/85">
              <li>Pasa el ratón por la pieza dentro de PoE2.</li>
              <li>
                Pulsa <kbd className="rounded border border-amber-300/35 bg-black/30 px-2 py-1 font-mono font-semibold text-amber-100">Ctrl+Alt+C</kbd>.
              </li>
              <li>Vuelve y pega el texto completo.</li>
            </ol>
          )}
          {reason && <p className="mt-3 text-xs text-amber-100/70">Motivo observado: {reason}</p>}
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
              {issue.retryCopy ? "Pegar la pieza corregida" : "Pegar otra pieza"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-amber-400/45"
              onClick={() => void copyReport()}
              data-testid="crafting-repair-copy-report"
            >
              <ClipboardCopy className="size-4" aria-hidden="true" />
              Copiar informe
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
              {reportOpen ? "Ocultar informe" : "Revisar informe"}
            </Button>
          </div>
          {copyState !== "idle" && (
            <p
              className="mt-2 text-xs text-amber-100/80"
              role="status"
              data-testid="crafting-repair-copy-status"
            >
              {copyState === "copied"
                ? "Informe copiado. No se ha enviado nada."
                : "El navegador no permitió copiarlo: el informe queda abierto para selección manual."}
            </p>
          )}
          {reportOpen && (
            <div className="mt-3" data-testid="crafting-repair-report-panel">
              <p className="mb-2 text-xs text-amber-100/70">
                Revísalo antes de compartirlo. Solo contiene la lectura de esta pieza.
              </p>
              <Textarea
                readOnly
                value={report}
                rows={12}
                className="font-mono text-[11px] leading-relaxed"
                onFocus={(event) => event.currentTarget.select()}
                data-testid="crafting-repair-report"
                aria-label="Informe local de lectura del objeto"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
