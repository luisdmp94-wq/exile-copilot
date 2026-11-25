import { Coffee } from "lucide-react";
import { donationHref } from "@shared/donation";
import { texts, useText } from "@/i18n/lang";
import { sendUseBeacon } from "@/lib/visitBeacon";

const TEXT = texts(
  { label: "¿Te ha servido? Invítame a un café", hint: "Abre Ko-fi en otra pestaña" },
  { label: "Found it useful? Buy me a coffee", hint: "Opens Ko-fi in a new tab" },
);

/**
 * Enlace pequeño (pie de página) a la página de Ko-fi. Sin ventana ni banner:
 * mismo tamaño y color que «Privacidad» y «Avisar de un problema». Si no hay
 * enlace configurado, no se pinta nada.
 */
export function DonationLink({ url }: { url?: string }) {
  const t = useText(TEXT);
  const href = donationHref(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t.hint}
      onClick={() => {
        if (import.meta.env.PROD) sendUseBeacon("donar");
      }}
      className="inline-flex min-h-10 items-center gap-1 underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0"
      data-testid="donar-enlace"
    >
      <Coffee className="size-3" aria-hidden="true" />
      {t.label}
    </a>
  );
}
