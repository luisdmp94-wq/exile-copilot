import {
  BookOpenCheck,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import type {
  FeaturedBuild,
  FeaturedBuildCategory,
  FeaturedBuildsResponse,
} from "@shared/featuredBuilds.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_LABELS: Record<FeaturedBuildCategory, string> = {
  starter: "Para empezar",
  mapping: "Mapeo",
  bossing: "Bosses",
  survival: "Supervivencia",
  budget: "Calidad/precio",
  ssf: "SSF",
};

const BUDGET_LABELS: Record<FeaturedBuild["budgetBand"], string> = {
  low: "Presupuesto bajo",
  medium: "Presupuesto medio",
  high: "Presupuesto alto",
  unknown: "Coste sin verificar",
};

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "fuente externa";
  }
}

interface FeaturedBuildsSectionProps {
  result: FeaturedBuildsResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onUseAsTarget: (build: FeaturedBuild) => void;
}

export function FeaturedBuildsSection({
  result,
  loading,
  error,
  onReload,
  onUseAsTarget,
}: FeaturedBuildsSectionProps) {
  if (!loading && !error && result && result.builds.length === 0) {
    return (
      <details
        className="group superficie-panel overflow-hidden"
        data-testid="featured-builds-section"
      >
        <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-6">
          <span>
            <span className="rotulo-seccion flex items-center gap-2 text-primary/80">
              <Sparkles className="size-4" aria-hidden="true" />
              Selección de la temporada
            </span>
            <span className="dossier-title mt-1 block text-xl font-semibold text-foreground">
              10 builds destacadas
            </span>
          </span>
          <Badge
            variant="outline"
            className="shrink-0 border-primary/45 bg-primary/10 px-3 py-1 text-primary"
            data-testid="featured-builds-count"
          >
            0 / {result.slots} verificadas
          </Badge>
        </summary>
        <div className="space-y-3 border-t border-border/70 px-5 py-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Aún no hay builds aprobadas para {result.league} · {result.patch}. No
            reutilizamos builds de otro parche.
          </p>
          <details className="rounded-md border border-border/70 bg-background/35 px-4 py-2.5">
            <summary className="rotulo-seccion flex min-h-9 cursor-pointer list-none items-center gap-2 text-muted-foreground marker:content-none hover:text-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
              Criterios de entrada
            </summary>
            <ul className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              {result.methodology.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
          <p className="text-xs text-muted-foreground">
            Revisión: {result.selectionAsOf}. Elegir una build nunca sustituye tu
            expediente actual.
          </p>
        </div>
      </details>
    );
  }

  return (
    <section className="superficie-panel overflow-hidden" data-testid="featured-builds-section">
      <header className="border-b border-border/70 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="rotulo-seccion flex items-center gap-2 text-primary/80">
              <Sparkles className="size-4" aria-hidden="true" />
              Selección de la temporada
            </p>
            <h2 className="dossier-title mt-2 text-3xl font-semibold text-foreground">
              10 builds destacadas
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Una selección editorial por utilidad, no una clasificación universal.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-primary/45 bg-primary/10 px-3 py-1 text-primary"
            data-testid="featured-builds-count"
          >
            {result ? `${result.builds.length} / ${result.slots} verificadas` : "10 plazas"}
          </Badge>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-6">
        {loading && (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cargar la selección</AlertTitle>
            <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={onReload}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && result && result.builds.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {result.builds.map((build, index) => (
              <article
                key={build.id}
                className="grid overflow-hidden rounded-md border border-border/80 bg-background/40 sm:grid-cols-[8.5rem_minmax(0,1fr)]"
              >
                <div className="grid min-h-36 place-items-center border-b border-primary/25 bg-primary/[0.07] p-4 sm:border-b-0 sm:border-r">
                  <div className="text-center">
                    <span className="dossier-title text-4xl text-primary">#{index + 1}</span>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {build.characterClass}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="dossier-title text-2xl font-semibold">{build.title}</h3>
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                        <BookOpenCheck className="size-3.5" aria-hidden="true" />
                        Verificada
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {build.ascendancy ?? build.characterClass} · {build.mainSkills.join(" + ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {build.categories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {CATEGORY_LABELS[category]}
                      </Badge>
                    ))}
                    <Badge variant="outline">{BUDGET_LABELS[build.budgetBand]}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{build.whyFeatured}</p>
                  <p className="text-xs text-amber-200/80">Límite: {build.caveats[0]}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => onUseAsTarget(build)}>
                      <Target className="size-4" aria-hidden="true" />
                      Usar como objetivo
                    </Button>
                    <Button asChild type="button" size="sm" variant="outline">
                      <a
                        href={build.source.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir ${build.source.label} de ${build.source.author} en ${sourceHost(build.source.url)}`}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Fuente · {sourceHost(build.source.url)}
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {result && (
          <p className="text-xs text-muted-foreground">
            Selección revisada el {result.selectionAsOf}. Una build se importa como plan de
            destino; tu expediente actual permanece intacto.
          </p>
        )}
      </div>
    </section>
  );
}
