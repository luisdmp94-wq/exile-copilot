import { useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, Coins, ExternalLink, FilePenLine, Map as MapIcon, Shield, Skull, Sparkles } from "lucide-react";
import type { BuildMemoryEntry, CharacterProfile } from "@shared/domain.js";
import { GemAdvisorCard } from "@/components/GemAdvisorCard";
import { GuideCharacterCheck } from "@/components/GuideCharacterCheck";
import { ItemCompareCard } from "@/components/ItemCompareCard";
import type { ActGuide, GuideBlock, GuideRoutePriority, GuideTip } from "@/guides/guide";
import { GUIDES, UPCOMING_GUIDES, findGuide } from "@/guides";
import { cn } from "@/lib/utils";

const BLOCK_ICON: Record<string, typeof Skull> = {
  jefes: Skull,
  resistencias: Shield,
  mejoras: Coins,
  trampas: AlertTriangle,
};

function SourceRefs({ guide, ids }: { guide: ActGuide; ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">
      {ids.map((id) => {
        const index = guide.sources.findIndex((source) => source.id === id);
        return (
          <a key={id} href={`#fuente-${id}`} className="ml-0.5 hover:text-foreground" title={guide.sources[index]?.label}>
            [{index + 1}]
          </a>
        );
      })}
    </span>
  );
}

const ROUTE_STORAGE_PREFIX = "exile-copilot:guia-ruta:";

const ROUTE_PRIORITY: Record<GuideRoutePriority, { label: string; className: string }> = {
  clave: { label: "No te lo saltes", className: "border-amber-400/60 bg-amber-400/15 text-amber-200" },
  recomendable: { label: "Merece la pena", className: "border-emerald-400/40 text-emerald-200" },
  historia: { label: "Historia", className: "border-border text-muted-foreground" },
};

function readRouteDone(slug: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ROUTE_STORAGE_PREFIX + slug) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((zone): zone is string => typeof zone === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Ruta del acto: las zonas en orden, una línea cada una. El jugador marca lo
 * que ya ha hecho; se recuerda en su navegador y nada sale de su equipo.
 */
function Route({ guide }: { guide: ActGuide }) {
  const steps = guide.route ?? [];
  const [done, setDone] = useState<string[]>(() => readRouteDone(guide.slug));

  const toggle = (zone: string) => {
    const next = done.includes(zone) ? done.filter((item) => item !== zone) : [...done, zone];
    setDone(next);
    try {
      window.localStorage.setItem(ROUTE_STORAGE_PREFIX + guide.slug, JSON.stringify(next));
    } catch {
      // Sin almacenamiento (modo privado) la ruta sigue funcionando en esta visita.
    }
  };

  const doneCount = steps.filter((step) => done.includes(step.zone)).length;
  const keySteps = steps.filter((step) => step.priority === "clave");
  const skippable = steps.flatMap((step) => (step.skip ? [`${step.skip} (${step.zone})`] : []));

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="guia-ruta"
      data-testid="guia-ruta"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="guia-ruta" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <MapIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          Ruta del acto
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground" data-testid="guia-ruta-progreso">
          {doneCount} de {steps.length} hechas
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Las zonas en orden. Marca cada una al terminarla.</p>
      {(keySteps.length > 0 || skippable.length > 0) && (
        <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm leading-relaxed" data-testid="guia-ruta-resumen">
          {keySteps.length > 0 && (
            <p>
              <strong className="font-semibold text-amber-200">Lo más importante, para siempre:</strong>{" "}
              {keySteps.map((step) => `${step.reward ?? step.zone} (${step.zone})`).join(" · ")}.
            </p>
          )}
          {skippable.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              <strong className="font-semibold text-foreground/90">Te puedes saltar:</strong> {skippable.join(" · ")}.
              No dan nada para siempre.
            </p>
          )}
        </div>
      )}
      <ol className="mt-3 space-y-1">
        {steps.map((step, index) => {
          const checked = done.includes(step.zone);
          const id = `guia-ruta-${guide.slug}-${index}`;
          return (
            <li key={step.zone} className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/50">
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(step.zone)}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <label htmlFor={id} className={cn("min-w-0 flex-1 cursor-pointer text-sm leading-relaxed", checked && "opacity-55")}>
                <span className="font-semibold text-foreground">
                  {index + 1}. {step.zone}
                </span>
                <span
                  className={cn(
                    "ml-2 rounded-full border px-1.5 py-px text-[11px]",
                    ROUTE_PRIORITY[step.priority].className,
                  )}
                >
                  {ROUTE_PRIORITY[step.priority].label}
                </span>
                {step.optional && step.priority !== "clave" && (
                  <span className="ml-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted-foreground">
                    opcional
                  </span>
                )}
                <span className="block text-foreground/85">
                  {step.text}
                  <SourceRefs guide={guide} ids={step.sourceIds} />
                </span>
                {step.skip && (
                  <span className="block text-xs text-muted-foreground">Te puedes saltar: {step.skip}.</span>
                )}
              </label>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TipList({ guide, tips }: { guide: ActGuide; tips: GuideTip[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {tips.map((tip, index) => (
        <li key={index} className="text-sm leading-relaxed text-foreground/90">
          {tip.lead && <strong className="font-semibold text-foreground">{tip.lead} </strong>}
          {tip.text}
          <SourceRefs guide={guide} ids={tip.sourceIds} />
        </li>
      ))}
    </ul>
  );
}

function Block({ guide, block, number }: { guide: ActGuide; block: GuideBlock; number: number }) {
  const Icon = BLOCK_ICON[block.id] ?? BookOpen;
  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby={`guia-${block.id}`}
      data-testid={`guia-bloque-${block.id}`}
    >
      <h2 id={`guia-${block.id}`} className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {number}. {block.title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{block.intro}</p>
      {block.cards && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {block.cards.map((card) => (
            <div key={card.title} className="rounded-lg bg-secondary/60 p-3">
              <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{card.text}</p>
            </div>
          ))}
        </div>
      )}
      <TipList guide={guide} tips={block.tips} />
      {block.more && block.more.length > 0 && (
        <details className="group mt-3 border-t border-border pt-2.5" data-testid={`guia-mas-${block.id}`}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            Más detalle
          </summary>
          <TipList guide={guide} tips={block.more} />
        </details>
      )}
    </section>
  );
}

interface GuidesSectionProps {
  guideSlug: string;
  onSelectGuide: (slug: string) => void;
  profile: CharacterProfile | null;
  /** «Identidad de la build» del personaje cargado; vacía si no hay personaje. */
  buildMemory?: readonly BuildMemoryEntry[];
  /** Abre el alta corta de personaje. */
  onCreateCharacter?: () => void;
  patch: string;
  onAskMentor?: (question: string) => void;
}

/**
 * Área «Guías»: guías de supervivencia por acto en español, legibles sin
 * personaje, con la comprobación «¿está listo tu personaje?» al final.
 */
export function GuidesSection({
  guideSlug,
  onSelectGuide,
  profile,
  buildMemory,
  onCreateCharacter,
  patch,
  onAskMentor,
}: GuidesSectionProps) {
  const guide = findGuide(guideSlug);
  return (
    <article className="mx-auto max-w-3xl space-y-4" aria-labelledby="guia-titulo" data-testid="guia-acto">
      <header>
        {/* Quien llega desde Google no sabe qué es esta web. Con un personaje
            cargado ya lo sabe, y la frase sobra. */}
        {profile === null && (
          <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground" data-testid="guia-presentacion">
            <strong className="font-semibold text-foreground">Exile Copilot</strong> es un compañero
            en español para Path of Exile 2: guías por acto y un mentor que mira tu personaje. Gratis
            y sin registrarte.
          </p>
        )}
        <nav aria-label="Guías por acto" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>Guías ›</span>
          {GUIDES.map((item, index) => (
            <span key={item.slug} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">·</span>}
              <a
                href={`/guias/${item.slug}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelectGuide(item.slug);
                }}
                aria-current={item.slug === guide.slug ? "page" : undefined}
                className={cn(
                  "rounded px-1 py-0.5 hover:text-foreground",
                  item.slug === guide.slug ? "font-semibold text-foreground" : "underline-offset-2 hover:underline",
                )}
                data-testid={`guia-nav-${item.slug}`}
              >
                {item.actLabel.replace(/^./, (c) => c.toUpperCase())}
              </a>
            </span>
          ))}
          {UPCOMING_GUIDES.map((label) => (
            <span key={label}>· {label} (pronto)</span>
          ))}
        </nav>
        <h1 id="guia-titulo" className="dossier-title mt-1.5 text-2xl leading-tight text-foreground sm:text-3xl">
          {guide.title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{guide.summary}</p>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-amber-200">
            Comprobada para {guide.checkedPatch} · se revisa al salir la 1.0
          </span>
          <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-muted-foreground">
            {guide.readMinutes} min de lectura · sin registrarse
          </span>
        </div>
      </header>

      {guide.status === "borrador" && (
        <div
          className="flex gap-2.5 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 px-4 py-3 text-sm text-amber-100"
          role="note"
          data-testid="guia-borrador"
        >
          <FilePenLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">Borrador sin revisar.</strong> Falta la revisión de Luis
            antes de publicarlo.
          </p>
        </div>
      )}

      <section
        className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5"
        aria-labelledby="guia-esencial"
        data-testid="guia-esencial"
      >
        <h2 id="guia-esencial" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Lo esencial
        </h2>
        <ol className="mt-2 space-y-1.5">
          {guide.essentials.map((tip, index) => (
            <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
              <span className="font-semibold tabular-nums text-primary">{index + 1}</span>
              <span>
                {tip.text}
                <SourceRefs guide={guide} ids={tip.sourceIds} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <GemAdvisorCard profile={profile} buildMemory={buildMemory ?? []} onCreateCharacter={onCreateCharacter} />

      {guide.route && guide.route.length > 0 && <Route key={guide.slug} guide={guide} />}

      {guide.blocks.map((block, index) => (
        <Block key={block.id} guide={guide} block={block} number={index + 1} />
      ))}

      <GuideCharacterCheck
        actLabel={guide.actLabel}
        targets={guide.check}
        profile={profile}
        patch={patch}
        onAskMentor={onAskMentor}
      />

      <ItemCompareCard patch={patch} />

      <section aria-labelledby="guia-fuentes" className="px-1 pt-2" data-testid="guia-fuentes">
        <h2 id="guia-fuentes" className="text-sm font-semibold text-foreground">
          Fuentes
        </h2>
        <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
          {guide.sources.map((source, index) => (
            <li key={source.id} id={`fuente-${source.id}`}>
              [{index + 1}]{" "}
              <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                {source.label}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Datos comprobados el {guide.checkedOn}. Path of Exile 2 es de Grinding Gear Games; esta guía
          no es oficial.
        </p>
      </section>
    </article>
  );
}
