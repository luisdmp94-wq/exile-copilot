import { AlertTriangle, BookOpen, ChevronDown, Coins, ExternalLink, FilePenLine, Shield, Skull, Sparkles } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { GuideCharacterCheck } from "@/components/GuideCharacterCheck";
import type { ActGuide, GuideBlock, GuideTip } from "@/guides/guide";
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
  patch: string;
  onAskMentor?: (question: string) => void;
}

/**
 * Área «Guías»: guías de supervivencia por acto en español, legibles sin
 * personaje, con la comprobación «¿está listo tu personaje?» al final.
 */
export function GuidesSection({ guideSlug, onSelectGuide, profile, patch, onAskMentor }: GuidesSectionProps) {
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
