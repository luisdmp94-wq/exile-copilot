import { useState } from "react";
import { CheckCircle2, Loader2, MessageSquareWarning } from "lucide-react";
import { summarizeBrowser, type FeedbackArea } from "@shared/feedback.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    open: "Avisar de un problema",
    title: "Avisar de un problema",
    intro: "Cuéntanos qué ha fallado o qué no se entiende. Lo lee una persona y lo arreglamos.",
    label: "¿Qué ha pasado?",
    placeholder: "Por ejemplo: al escribir una habilidad en la ficha completa, el cuadro pierde el foco con cada letra.",
    includeTech: "Incluir datos técnicos para encontrar el fallo:",
    areas: { expediente: "Personaje y mentor", plan: "Plan y mercado", crafting: "Crafting", guias: "Guías", otra: "Otra" } as Record<FeedbackArea, string>,
    privacy: "No enviamos tu personaje, tu IP ni nada que te identifique. Los avisos se borran a los 90 días.",
    send: "Enviar aviso",
    cancel: "Cancelar",
    tooShort: "Escribe al menos unas palabras.",
    failed: "No se pudo enviar. Inténtalo de nuevo en un momento.",
    thanks: "¡Gracias! Ya lo tenemos.",
    close: "Cerrar",
  },
  {
    open: "Report a problem",
    title: "Report a problem",
    intro: "Tell us what broke or what's confusing. A person reads it and we fix it.",
    label: "What happened?",
    placeholder: "For example: when typing a skill in the full form, the box loses focus after every letter.",
    includeTech: "Include technical details to help find the bug:",
    areas: { expediente: "Character & mentor", plan: "Plan & market", crafting: "Crafting", guias: "Guides", otra: "Other" } as Record<FeedbackArea, string>,
    privacy: "We don't send your character, your IP or anything that identifies you. Reports are deleted after 90 days.",
    send: "Send report",
    cancel: "Cancel",
    tooShort: "Write at least a few words.",
    failed: "Couldn't send it. Please try again in a moment.",
    thanks: "Thanks! We've got it.",
    close: "Close",
  },
);

interface ReportProblemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Área en la que está el jugador al abrirlo. */
  area: FeedbackArea;
}

function technicalDetails(): { browser: string; viewport: string } {
  return {
    browser: summarizeBrowser(navigator.userAgent),
    viewport: `${window.innerWidth}×${window.innerHeight}`,
  };
}

/**
 * «Avisar de un problema»: el jugador escribe lo que quiere y ve, antes de
 * enviar, los datos técnicos que acompañan al aviso (puede quitarlos).
 */
export function ReportProblemDialog({ open, onOpenChange, area }: ReportProblemDialogProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [text, setText] = useState("");
  const [includeTech, setIncludeTech] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const tech = open ? technicalDetails() : null;

  const reset = () => {
    setText("");
    setStatus("idle");
    setError(null);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const send = async () => {
    if (text.trim().length < 3) {
      setError(t.tooShort);
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const details = includeTech ? technicalDetails() : null;
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          text: text.trim(),
          lang,
          area: includeTech ? area : null,
          viewport: details?.viewport ?? null,
          browser: details?.browser ?? null,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus("sent");
    } catch {
      setStatus("error");
      setError(t.failed);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="border-primary/25 sm:max-w-lg" data-testid="aviso-dialogo">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="size-5 text-primary" aria-hidden="true" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.intro}</DialogDescription>
        </DialogHeader>

        {status === "sent" ? (
          <p className="flex items-center gap-2 text-sm text-emerald-300" role="status" data-testid="aviso-enviado">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t.thanks}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              {t.label}
              <Textarea
                value={text}
                maxLength={1000}
                rows={5}
                placeholder={t.placeholder}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(null);
                }}
                data-testid="aviso-texto"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeTech}
                onChange={(event) => setIncludeTech(event.target.checked)}
                data-testid="aviso-datos-tecnicos"
              />
              <span>
                {t.includeTech}{" "}
                {tech && (
                  <span className="text-foreground/80">
                    {tech.browser} · {tech.viewport} · {t.areas[area]}
                  </span>
                )}
              </span>
            </label>
            <p className="text-xs text-muted-foreground">{t.privacy}</p>
            {error && (
              <p className="text-sm text-rose-300" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {status === "sent" ? (
            <Button type="button" onClick={close}>
              {t.close}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={close}>
                {t.cancel}
              </Button>
              <Button type="button" onClick={() => void send()} disabled={status === "sending"} data-testid="aviso-enviar">
                {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {t.send}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Enlace pequeño (pie de página) que abre el aviso. */
export function ReportProblemLink({ onOpen }: { onOpen: () => void }) {
  const t = useText(TEXT);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      data-testid="aviso-abrir"
    >
      {t.open}
    </button>
  );
}
