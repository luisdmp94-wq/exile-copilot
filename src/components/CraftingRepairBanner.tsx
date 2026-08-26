import { useState } from "react";
import { ClipboardPaste, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CraftingRepairBanner({
  onRepaste,
  reason,
}: {
  onRepaste?: () => void;
  reason?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="rounded-md border border-amber-500/45 bg-amber-500/[0.09] p-3 text-amber-50"
      data-testid="crafting-repair-banner"
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
          No puedo leer esta pieza entera.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          data-testid="crafting-repair-toggle"
        >
          Cómo volver a copiarla
        </Button>
      </div>

      {open && (
        <div className="mt-3 border-t border-amber-500/25 pt-3 text-sm" data-testid="crafting-repair-instructions">
          <ol className="list-decimal space-y-1.5 pl-5 text-amber-100/85">
            <li>Pasa el ratón por la pieza dentro de PoE2.</li>
            <li>
              Pulsa <kbd className="rounded border border-amber-300/35 bg-black/30 px-2 py-1 font-mono font-semibold text-amber-100">Ctrl+Alt+C</kbd>.
            </li>
            <li>Vuelve y pega el texto completo.</li>
          </ol>
          {reason && <p className="mt-3 text-xs text-amber-100/70">Motivo observado: {reason}</p>}
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 border-amber-400/45"
            onClick={onRepaste}
            disabled={!onRepaste}
            data-testid="crafting-repair-repaste"
          >
            <ClipboardPaste className="size-4" aria-hidden="true" />
            Pegar la pieza corregida
          </Button>
        </div>
      )}
    </section>
  );
}
