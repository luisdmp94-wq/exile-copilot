import { useEffect, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";
import { ROUTE_CHANGED_EVENT, readResumePoint, type ResumePoint } from "@/lib/resumePoint";

const TEXT = texts(
  {
    kicker: "Sigues por aquí",
    progress: (act: string, done: number, total: number) => `${act} · ${done} de ${total} zonas hechas`,
    starting: (act: string) => `${act} · empiezas el acto`,
    next: (step: number, zone: string) => `Siguiente: ${step}. ${zone}`,
    go: "Seguir con la guía",
  },
  {
    kicker: "Pick up where you left off",
    progress: (act: string, done: number, total: number) => `${act} · ${done} of ${total} zones done`,
    starting: (act: string) => `${act} · starting the act`,
    next: (step: number, zone: string) => `Next: ${step}. ${zone}`,
    go: "Continue the guide",
  },
);

function read(lang: "es" | "en"): ResumePoint | null {
  try {
    return readResumePoint(window.localStorage, lang);
  } catch {
    return null;
  }
}

interface ResumeBannerProps {
  /** Abre la guía de ese acto en el paso que toca (número desde 1). */
  onContinue: (slug: string, step: number | null) => void;
  className?: string;
}

/**
 * «Sigues por aquí»: el acto y la zona en la que iba, con un botón para
 * seguir. Solo sale si ha marcado algo en una ruta o abierto una guía.
 */
export function ResumeBanner({ onContinue, className }: ResumeBannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [point, setPoint] = useState<ResumePoint | null>(() => read(lang));

  useEffect(() => {
    const refresh = () => setPoint(read(lang));
    refresh();
    window.addEventListener(ROUTE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(ROUTE_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [lang]);

  if (point === null || point.next === null) return null;

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-primary/35 bg-primary/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      aria-label={t.kicker}
      data-testid="sigues-por-aqui"
    >
      <div className="flex min-w-0 items-start gap-3">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t.kicker}</p>
          <p className="text-sm font-semibold text-foreground">
            {point.starting ? t.starting(point.actLabel) : t.progress(point.actLabel, point.done, point.total)}
          </p>
          <p className="truncate text-sm text-muted-foreground" data-testid="sigues-por-aqui-siguiente">
            {t.next(point.next.step, point.next.zone)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="shrink-0 self-start sm:self-center"
        onClick={() => onContinue(point.slug, point.next?.step ?? null)}
        data-testid="sigues-por-aqui-seguir"
      >
        {t.go}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </section>
  );
}
