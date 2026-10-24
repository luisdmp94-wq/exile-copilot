import { BookOpen, Coins, ExternalLink, FilePenLine, Shield, Skull } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { GuideCharacterCheck } from "@/components/GuideCharacterCheck";
import type { ActGuide, GuideBlock } from "@/guides/guide";
import { ACT_ONE_GUIDE } from "@/guides/actOne";

const BLOCK_ICON: Record<string, typeof Skull> = {
  jefes: Skull,
  resistencias: Shield,
  mejoras: Coins,
};

/** Guías publicadas, en orden de campaña. Las que faltan se anuncian como «luego». */
const GUIDES: ActGuide[] = [ACT_ONE_GUIDE];
const UPCOMING = ["Acto 2", "Acto 3"];

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
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{block.intro}</p>
      {block.cards && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {block.cards.map((card) => (
            <div key={card.title} className="rounded-lg bg-secondary/60 p-3">
              <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.text}</p>
            </div>
          ))}
        </div>
      )}
      <ul className="mt-3 space-y-2.5">
        {block.tips.map((tip, index) => (
          <li key={index} className="text-sm leading-relaxed text-foreground/90">
            {tip.lead && <strong className="font-semibold text-foreground">{tip.lead} </strong>}
            {tip.text}
            <SourceRefs guide={guide} ids={tip.sourceIds} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface GuidesSectionProps {
  profile: CharacterProfile | null;
  patch: string;
  onAskMentor?: (question: string) => void;
}

/**
 * Área «Guías»: guías de supervivencia por acto en español, legibles sin
 * personaje, con la comprobación «¿está listo tu personaje?» al final.
 */
export function GuidesSection({ profile, patch, onAskMentor }: GuidesSectionProps) {
  const guide = GUIDES[0];
  return (
    <article className="mx-auto max-w-3xl space-y-4" aria-labelledby="guia-titulo" data-testid="guia-acto">
      <header>
        <nav aria-label="Guías por acto" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>Guías ›</span>
          {GUIDES.map((item) => (
            <span key={item.slug} className="font-medium text-foreground" aria-current="page">
              {item.actLabel.replace(/^./, (c) => c.toUpperCase())}
            </span>
          ))}
          {UPCOMING.map((label) => (
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
            <strong className="font-semibold">Borrador sin revisar.</strong> Este texto lo ha redactado
            Claude a partir de las fuentes del final y falta la revisión de Luis antes de publicarlo.
            Cada consejo indica de qué fuente sale.
          </p>
        </div>
      )}

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
