import { useState } from "react";
import {
  BookOpenCheck,
  Check,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import {
  localizeFeaturedBuild,
  type FeaturedBuild,
  type FeaturedBuildCategory,
  type FeaturedBuildsResponse,
} from "@shared/featuredBuilds.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    categories: {
      starter: "Para empezar",
      mapping: "Mapeo",
      bossing: "Jefes",
      survival: "Supervivencia",
      budget: "Calidad/precio",
      ssf: "SSF",
    } as Record<FeaturedBuildCategory, string>,
    budgets: {
      low: "Presupuesto bajo",
      medium: "Presupuesto medio",
      high: "Presupuesto alto",
      unknown: "Coste sin verificar",
    } as Record<FeaturedBuild["budgetBand"], string>,
    externalSource: "fuente externa",
    kicker: "Selección de la temporada",
    title: "10 builds destacadas",
    verifiedCount: (count: number, slots: number) => `${count} / ${slots} verificadas`,
    tenSlots: "10 plazas",
    noneYet: (league: string, patch: string) =>
      `Aún no hay builds aprobadas para ${league} · ${patch}. No reutilizamos builds de otro parche.`,
    criteria: "Criterios de entrada",
    reviewNote: (date: string) =>
      `Revisión: ${date}. Elegir una build nunca sustituye tu personaje actual.`,
    editorial: "Una selección editorial por utilidad, no una clasificación universal.",
    loadError: "No se pudo cargar la selección",
    retry: "Reintentar",
    verified: "Verificada",
    limit: "Límite:",
    useAsTarget: "Usar como objetivo",
    isTarget: "Es tu objetivo",
    yourClass: "Tu clase",
    classFirst: (name: string) => `Primero, las de tu clase (${name}).`,
    targetSaved: (name: string) => `Objetivo guardado: ${name}.`,
    targetUse: "Lo tengo en cuenta al aconsejarte en Personaje y en Crafting. Tu personaje no cambia.",
    goToCharacter: "Ver qué mejorar ahora",
    showAll: (count: number) => `Ver las ${count} builds`,
    openSourceAria: (label: string, author: string, host: string) => `Abrir ${label} de ${author} en ${host}`,
    source: "Fuente",
    reviewedOn: (date: string) =>
      `Selección revisada el ${date}. Una build se importa como plan de destino; tu personaje actual permanece intacto.`,
  },
  {
    categories: {
      starter: "Starter",
      mapping: "Mapping",
      bossing: "Bossing",
      survival: "Survival",
      budget: "Good value",
      ssf: "SSF",
    } as Record<FeaturedBuildCategory, string>,
    budgets: {
      low: "Low budget",
      medium: "Medium budget",
      high: "High budget",
      unknown: "Cost not verified",
    } as Record<FeaturedBuild["budgetBand"], string>,
    externalSource: "external source",
    kicker: "This season's picks",
    title: "10 featured builds",
    verifiedCount: (count: number, slots: number) => `${count} / ${slots} verified`,
    tenSlots: "10 slots",
    noneYet: (league: string, patch: string) =>
      `No approved builds yet for ${league} · ${patch}. We don't reuse builds from another patch.`,
    criteria: "How builds get in",
    reviewNote: (date: string) =>
      `Reviewed: ${date}. Picking a build never replaces your current character.`,
    editorial: "An editorial pick based on usefulness, not a universal ranking.",
    loadError: "Couldn't load the picks",
    retry: "Try again",
    verified: "Verified",
    limit: "Limit:",
    useAsTarget: "Use as target",
    isTarget: "It's your target",
    yourClass: "Your class",
    classFirst: (name: string) => `Your class first (${name}).`,
    targetSaved: (name: string) => `Target saved: ${name}.`,
    targetUse: "I keep it in mind when I advise you in Character and in Crafting. Your character doesn't change.",
    goToCharacter: "See what to improve now",
    showAll: (count: number) => `Show all ${count} builds`,
    openSourceAria: (label: string, author: string, host: string) => `Open ${label} by ${author} on ${host}`,
    source: "Source",
    reviewedOn: (date: string) =>
      `Picks reviewed on ${date}. A build is imported as a target plan; your current character stays as it is.`,
  },
);

function sourceHost(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

interface FeaturedBuildsSectionProps {
  result: FeaturedBuildsResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onUseAsTarget: (build: FeaturedBuild) => void;
  /** Clase del personaje cargado: sus builds salen primero. */
  characterClass?: string | null;
  /** Nombre de la build objetivo actual, para que elegir una deje huella. */
  activeTargetName?: string | null;
  onOpenCharacter?: () => void;
}

/** En móvil, diez fichas son diez pantallas: se enseñan estas y un botón. */
const MOBILE_VISIBLE_BUILDS = 4;

const plain = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function FeaturedBuildsSection({
  result,
  loading,
  error,
  onReload,
  onUseAsTarget,
  characterClass = null,
  activeTargetName = null,
  onOpenCharacter,
}: FeaturedBuildsSectionProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [showAll, setShowAll] = useState(false);
  const myClass = plain(characterClass);
  // El número (#3) es el puesto en la selección y no cambia; lo que cambia es
  // el orden en pantalla: primero las de la clase que ya juegas.
  const ranked = (result?.builds ?? []).map((entry, index) => ({
    entry,
    rank: index + 1,
    mine:
      myClass !== "" &&
      (plain(entry.characterClass) === myClass ||
        plain(localizeFeaturedBuild(entry, "en").characterClass) === myClass),
  }));
  const ordered = [...ranked.filter((build) => build.mine), ...ranked.filter((build) => !build.mine)];
  const hasMine = ordered.some((build) => build.mine);
  // El nombre de la clase, en el idioma de la web: el personaje puede traerla
  // en inglés («Mercenary») aunque la web esté en español.
  const firstMine = ordered.find((build) => build.mine);
  const myClassLabel = firstMine
    ? localizeFeaturedBuild(firstMine.entry, lang).characterClass
    : (characterClass?.trim() ?? "");
  const targetName = plain(activeTargetName);
  const targetBuild =
    targetName === ""
      ? null
      : (result?.builds ?? []).find(
          (entry) =>
            plain(entry.title) === targetName ||
            plain(localizeFeaturedBuild(entry, "en").title) === targetName,
        ) ?? null;
  const methodology = (lang === "en" ? result?.methodologyEn : undefined) ?? result?.methodology ?? [];
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
              {t.kicker}
            </span>
            <span className="dossier-title mt-1 block text-xl font-semibold text-foreground">
              {t.title}
            </span>
          </span>
          <Badge
            variant="outline"
            className="shrink-0 border-primary/45 bg-primary/10 px-3 py-1 text-primary"
            data-testid="featured-builds-count"
          >
            {t.verifiedCount(0, result.slots)}
          </Badge>
        </summary>
        <div className="space-y-3 border-t border-border/70 px-5 py-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            {t.noneYet(result.league, result.patch)}
          </p>
          <details className="rounded-md border border-border/70 bg-background/35 px-4 py-2.5">
            <summary className="rotulo-seccion flex min-h-9 cursor-pointer list-none items-center gap-2 text-muted-foreground marker:content-none hover:text-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
              {t.criteria}
            </summary>
            <ul className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              {methodology.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
          <p className="text-xs text-muted-foreground">
            {t.reviewNote(result.selectionAsOf)}
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
              {t.kicker}
            </p>
            <h2 className="dossier-title mt-2 text-3xl font-semibold text-foreground">
              {t.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t.editorial}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-primary/45 bg-primary/10 px-3 py-1 text-primary"
            data-testid="featured-builds-count"
          >
            {result ? t.verifiedCount(result.builds.length, result.slots) : t.tenSlots}
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
            <AlertTitle>{t.loadError}</AlertTitle>
            <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={onReload}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {t.retry}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Elegir una build deja huella: antes solo salía un aviso de tres segundos. */}
        {!loading && !error && targetBuild && (
          <div
            className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            role="status"
            data-testid="featured-builds-target"
          >
            <p className="min-w-0 text-sm">
              <span className="font-semibold text-foreground">
                {t.targetSaved(localizeFeaturedBuild(targetBuild, lang).title)}
              </span>{" "}
              <span className="text-muted-foreground">{t.targetUse}</span>
            </p>
            {onOpenCharacter && (
              <Button type="button" size="sm" className="shrink-0" onClick={onOpenCharacter}>
                {t.goToCharacter}
              </Button>
            )}
          </div>
        )}

        {!loading && !error && result && result.builds.length > 0 && hasMine && (
          <p className="-mb-2 text-sm text-muted-foreground" data-testid="featured-builds-class-first">
            {t.classFirst(myClassLabel)}
          </p>
        )}

        {!loading && !error && result && result.builds.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {ordered.map(({ entry, rank, mine }, position) => {
              const build = localizeFeaturedBuild(entry, lang);
              const isTarget = targetBuild?.id === entry.id;
              return (
              <article
                key={build.id}
                data-target={isTarget ? "true" : undefined}
                className={`${!showAll && position >= MOBILE_VISIBLE_BUILDS ? "hidden sm:grid" : "grid"} overflow-hidden rounded-md border bg-background/40 sm:grid-cols-[8.5rem_minmax(0,1fr)] ${
                  isTarget ? "border-primary/70 ring-1 ring-primary/40" : "border-border/80"
                }`}
              >
                {/* En móvil el puesto es una franja de una línea, no media pantalla. */}
                <div className="flex items-center justify-center border-b border-primary/25 bg-primary/[0.07] px-4 py-2 sm:grid sm:min-h-36 sm:place-items-center sm:border-b-0 sm:border-r sm:p-4">
                  <div className="flex items-baseline gap-2 sm:block sm:text-center">
                    <span className="dossier-title text-2xl text-primary sm:text-4xl">#{rank}</span>
                    <p className="text-xs font-semibold text-muted-foreground sm:mt-2">
                      {build.characterClass}
                    </p>
                    {mine && (
                      <p className="text-[11px] font-semibold text-primary sm:mt-1">{t.yourClass}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="dossier-title text-2xl font-semibold">{build.title}</h3>
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                        <BookOpenCheck className="size-3.5" aria-hidden="true" />
                        {t.verified}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {build.ascendancy ?? build.characterClass} · {build.mainSkills.join(" + ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {build.categories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {t.categories[category]}
                      </Badge>
                    ))}
                    <Badge variant="outline">{t.budgets[build.budgetBand]}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{build.whyFeatured}</p>
                  <p className="text-xs text-amber-200/80">{t.limit} {build.caveats[0]}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isTarget ? "secondary" : "default"}
                      aria-pressed={isTarget}
                      onClick={() => onUseAsTarget(build)}
                    >
                      {isTarget ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        <Target className="size-4" aria-hidden="true" />
                      )}
                      {isTarget ? t.isTarget : t.useAsTarget}
                    </Button>
                    <Button asChild type="button" size="sm" variant="outline">
                      <a
                        href={build.source.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.openSourceAria(
                          build.source.label,
                          build.source.author,
                          sourceHost(build.source.url, t.externalSource),
                        )}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {t.source} · {sourceHost(build.source.url, t.externalSource)}
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}

        {!loading && !error && result && result.builds.length > MOBILE_VISIBLE_BUILDS && !showAll && (
          <Button
            type="button"
            variant="outline"
            className="sm:hidden"
            onClick={() => setShowAll(true)}
            data-testid="featured-builds-show-all"
          >
            {t.showAll(result.builds.length)}
          </Button>
        )}

        {/* De dónde salen los porcentajes y por qué estas diez: a un clic. */}
        {result && result.builds.length > 0 && methodology.length > 0 && (
          <details
            className="rounded-md border border-border/70 bg-background/35 px-4 py-2.5"
            data-testid="featured-builds-criteria"
          >
            <summary className="rotulo-seccion flex min-h-9 cursor-pointer list-none items-center gap-2 text-muted-foreground marker:content-none hover:text-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
              {t.criteria}
            </summary>
            <ul className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm text-muted-foreground">
              {methodology.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        )}

        {result && (
          <p className="text-xs text-muted-foreground">
            {t.reviewedOn(result.selectionAsOf)}
          </p>
        )}
      </div>
    </section>
  );
}
