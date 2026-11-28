import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Coins,
  ExternalLink,
  FilePenLine,
  Gem,
  ListChecks,
  Map as MapIcon,
  Shield,
  Skull,
  Sparkles,
} from "lucide-react";
import { ItemSchema, type BuildMemoryEntry, type CharacterProfile, type Item } from "@shared/domain.js";
import { BuildConfigurator } from "@/components/BuildConfigurator";
import { FoundItemCard } from "@/components/FoundItemCard";
import { GemAdvisorCard } from "@/components/GemAdvisorCard";
import { GuideCharacterCheck } from "@/components/GuideCharacterCheck";
import { ItemCompareCard } from "@/components/ItemCompareCard";
import { RewardCheckCard } from "@/components/RewardCheckCard";
import { hasWornGear } from "@/lib/foundItem";
import type { ActGuide, GuideBlock, GuideRoutePriority, GuideTip } from "@/guides/guide";
import { UPCOMING_GUIDES, UPCOMING_GUIDES_EN, findGuide, guidesFor } from "@/guides";
import { cn } from "@/lib/utils";
import { PassiveRouteCard } from "@/components/PassiveRouteCard";
import { LAST_GUIDE_STORAGE_KEY, ROUTE_CHANGED_EVENT, ROUTE_STORAGE_PREFIX, nextRouteIndex } from "@/lib/resumePoint";

/**
 * «Tus puntos del árbol» está retirado de momento (20-11-2026): daba nombres
 * de nodos sin decir dónde están, servía a una sola build y la 1.0 cambia el
 * árbol. La tarjeta, la ruta y su prueba siguen en el código; para volver a
 * enseñarla basta con poner esto a `true`.
 */
const SHOW_PASSIVE_ROUTE: boolean = false;
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    views: { guia: "Guía del acto", comprobar: "Comprobar mi personaje", herramientas: SHOW_PASSIVE_ROUTE ? "Gemas, piezas y árbol" : "Gemas y piezas" },
    priority: { clave: "No te lo saltes", recomendable: "Merece la pena", historia: "Historia" },
    route: "Ruta del acto",
    nextStep: "Siguiente",
    doneOf: (done: number, total: number) => `${done} de ${total} hechas`,
    routeLead: "Las zonas en orden. Marca cada una al terminarla.",
    mostImportant: "Lo más importante, para siempre:",
    canSkip: "Te puedes saltar:",
    nothingForever: "No dan nada para siempre.",
    optional: "opcional",
    canSkipOne: (what: string) => `Te puedes saltar: ${what}.`,
    gems: (count: number): string => (count === 1 ? "Gema segura:" : "Gemas seguras:"),
    moreDetail: "Más detalle",
    intro:
      "es un compañero en español para Path of Exile 2: guías por acto y un mentor que mira tu personaje. Gratis y sin registrarte.",
    guidesNav: "Guías por acto",
    guides: "Guías:",
    soon: "pronto",
    viewsLabel: "Partes del área de guías",
    checkedFor: (patch: string) => `Comprobada para ${patch} · se revisa al salir la 1.0`,
    readTime: (minutes: number) => `${minutes} min de lectura · sin registrarse`,
    draftTitle: "Borrador sin revisar.",
    draftText: "Falta una última revisión.",
    essentials: "Lo esencial",
    sources: "Fuentes",
    checkedOn: (date: string) =>
      `Datos comprobados el ${date}. Path of Exile 2 es de Grinding Gear Games; esta guía no es oficial.`,
    checkLead: (act: string) =>
      `Pega tu equipo una vez y sirve para las dos comprobaciones del ${act}. Se queda guardado en este navegador.`,
    toolsLead: SHOW_PASSIVE_ROUTE
      ? "Monta tu build y resuelve tres dudas de cada partida, en cualquier acto: dónde poner los puntos del árbol, qué gema de asistencia poner y cuál de dos piezas te conviene."
      : "Monta tu build y resuelve dos dudas de cada partida, en cualquier acto: qué gema de asistencia poner y cuál de dos piezas te conviene.",
  },
  {
    views: { guia: "Act guide", comprobar: "Check my character", herramientas: SHOW_PASSIVE_ROUTE ? "Gems, items and tree" : "Gems and items" },
    priority: { clave: "Don't skip it", recomendable: "Worth it", historia: "Story" },
    route: "Act route",
    nextStep: "Next",
    doneOf: (done: number, total: number) => `${done} of ${total} done`,
    routeLead: "The zones in order. Tick each one when you finish it.",
    mostImportant: "Most important, for good:",
    canSkip: "You can skip:",
    nothingForever: "They give nothing permanent.",
    optional: "optional",
    canSkipOne: (what: string) => `You can skip: ${what}.`,
    gems: (count: number): string => (count === 1 ? "Guaranteed gem:" : "Guaranteed gems:"),
    moreDetail: "More detail",
    intro:
      "is a companion for Path of Exile 2 players: act guides and a mentor that looks at your character. Free, no sign-up.",
    guidesNav: "Act guides",
    guides: "Guides:",
    soon: "soon",
    viewsLabel: "Parts of the guides area",
    checkedFor: (patch: string) => `Checked for ${patch} · reviewed again when 1.0 comes out`,
    readTime: (minutes: number) => `${minutes} min read · no sign-up`,
    draftTitle: "Unreviewed draft.",
    draftText: "It still needs a final review.",
    essentials: "The essentials",
    sources: "Sources",
    checkedOn: (date: string) =>
      `Data checked on ${date}. Path of Exile 2 belongs to Grinding Gear Games; this guide is not official.`,
    checkLead: (act: string) =>
      `Paste your gear once and it works for both ${act} checks. It stays saved in this browser.`,
    toolsLead: SHOW_PASSIVE_ROUTE
      ? "Build your own and settle three questions every run has, in any act: where to put your passive points, which support gem to use and which of two items suits you."
      : "Build your own and settle two questions every run has, in any act: which support gem to use and which of two items suits you.",
  },
);
type GuidesText = (typeof TEXT)["es"];

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

const PIECES_STORAGE_KEY = "exile-copilot:guia-piezas";
const VIEW_STORAGE_KEY = "exile-copilot:guia-vista";

/**
 * Las tres partes del área. Antes iba todo seguido en una sola página y no
 * había quien encontrara nada: ahora cada cosa tiene su pestaña.
 */
const VIEWS = [
  { id: "guia", icon: BookOpen },
  { id: "comprobar", icon: ListChecks },
  { id: "herramientas", icon: Gem },
] as const;
export type GuideView = (typeof VIEWS)[number]["id"];

function readStoredView(): GuideView {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.some((view) => view.id === stored) ? (stored as GuideView) : "guia";
  } catch {
    return "guia";
  }
}

/** Piezas pegadas en una visita anterior. Lo que no sea un objeto válido se descarta. */
function readStoredPieces(): Item[] {
  try {
    const parsed = ItemSchema.array().max(20).safeParse(JSON.parse(window.localStorage.getItem(PIECES_STORAGE_KEY) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

const ROUTE_PRIORITY: Record<GuideRoutePriority, { className: string }> = {
  clave: { className: "border-amber-400/60 bg-amber-400/15 text-amber-200" },
  recomendable: { className: "border-emerald-400/40 text-emerald-200" },
  historia: { className: "border-border text-muted-foreground" },
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
function Route({ guide, t }: { guide: ActGuide; t: GuidesText }) {
  const steps = guide.route ?? [];
  // Lo marcado se guarda con el nombre de la zona en español, el mismo en los
  // dos idiomas: cambiar de idioma no borra lo que ya llevas hecho.
  const spanishSteps = findGuide(guide.slug).route ?? [];
  const keyOf = (index: number) => spanishSteps[index]?.zone ?? steps[index].zone;
  const [done, setDone] = useState<string[]>(() => readRouteDone(guide.slug));

  const toggle = (zone: string) => {
    const next = done.includes(zone) ? done.filter((item) => item !== zone) : [...done, zone];
    setDone(next);
    try {
      window.localStorage.setItem(ROUTE_STORAGE_PREFIX + guide.slug, JSON.stringify(next));
      window.dispatchEvent(new Event(ROUTE_CHANGED_EVENT));
    } catch {
      // Sin almacenamiento (modo privado) la ruta sigue funcionando en esta visita.
    }
  };

  const doneCount = steps.filter((_step, index) => done.includes(keyOf(index))).length;
  // La zona que toca va resaltada: es a donde lleva «Sigues por aquí».
  const nextIndex = nextRouteIndex(steps, (index) => done.includes(keyOf(index)));
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
          {t.route}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground" data-testid="guia-ruta-progreso">
          {t.doneOf(doneCount, steps.length)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.routeLead}</p>
      {(keySteps.length > 0 || skippable.length > 0) && (
        <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm leading-relaxed" data-testid="guia-ruta-resumen">
          {keySteps.length > 0 && (
            <p>
              <strong className="font-semibold text-amber-200">{t.mostImportant}</strong>{" "}
              {keySteps.map((step) => `${step.reward ?? step.zone} (${step.zone})`).join(" · ")}.
            </p>
          )}
          {skippable.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              <strong className="font-semibold text-foreground/90">{t.canSkip}</strong> {skippable.join(" · ")}.{" "}
              {t.nothingForever}
            </p>
          )}
        </div>
      )}
      <ol className="mt-3 space-y-1">
        {steps.map((step, index) => {
          const checked = done.includes(keyOf(index));
          const id = `guia-ruta-${guide.slug}-${index}`;
          return (
            <li
              key={step.zone}
              className={cn(
                "flex gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/50",
                index === nextIndex && doneCount > 0 && "bg-primary/[0.07] ring-1 ring-primary/40",
              )}
              data-testid={index === nextIndex && doneCount > 0 ? "guia-ruta-siguiente" : undefined}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(keyOf(index))}
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
                  {t.priority[step.priority]}
                </span>
                {index === nextIndex && doneCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold text-primary-foreground">
                    {t.nextStep}
                  </span>
                )}
                {step.optional && step.priority !== "clave" && (
                  <span className="ml-1 rounded-full border border-border px-1.5 py-px text-[11px] text-muted-foreground">
                    {t.optional}
                  </span>
                )}
                <span className="block text-foreground/85">
                  {step.text}
                  <SourceRefs guide={guide} ids={step.sourceIds} />
                </span>
                {step.gems && step.gems.length > 0 && (
                  <span className="mt-0.5 block text-xs text-sky-200/90" data-testid="guia-ruta-gemas">
                    <Gem className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                    <span className="font-semibold">{t.gems(step.gems.length)}</span> {step.gems.join(" · ")}
                  </span>
                )}
                {step.skip && (
                  <span className="block text-xs text-muted-foreground">{t.canSkipOne(step.skip)}</span>
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

function Block({ guide, block, t }: { guide: ActGuide; block: GuideBlock; t: GuidesText }) {
  const Icon = BLOCK_ICON[block.id] ?? BookOpen;
  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby={`guia-${block.id}`}
      data-testid={`guia-bloque-${block.id}`}
    >
      <h2 id={`guia-${block.id}`} className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {/* Sin número: la ruta de arriba ya va del 1 al 12 y un segundo «1.» despistaba. */}
        {block.title}
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
            {t.moreDetail}
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
  /** Apunta en el personaje que una habilidad ya lleva esa asistencia. */
  onOwnSupport?: (skillName: string, supportName: string) => void;
  patch: string;
  onAskMentor?: (question: string) => void;
  /** Abrir una vista concreta desde fuera (la mascota). Cambia con cada `seq`. */
  viewRequest?: { view: GuideView; seq: number } | null;
  /** Pieza que llega de Crafting para compararla con otra. */
  compareRequest?: { item: Item; seq: number } | null;
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
  onOwnSupport,
  patch,
  onAskMentor,
  viewRequest = null,
  compareRequest = null,
}: GuidesSectionProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const guides = guidesFor(lang);
  const guide = findGuide(guideSlug, lang);
  // «Sigues por aquí» recuerda la última guía abierta.
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_GUIDE_STORAGE_KEY, guide.slug);
    } catch {
      // Sin almacenamiento no hay «Sigues por aquí»; la guía funciona igual.
    }
  }, [guide.slug]);
  // El equipo pegado es del personaje, no de un acto: se comparte entre guías
  // y se recuerda en el navegador para no pegar nueve piezas cada vez.
  const [pastedItems, setPastedItems] = useState<Item[]>(readStoredPieces);
  const [view, setView] = useState<GuideView>(readStoredView);
  // La mascota puede pedir abrir una vista concreta («Me matan» → comprobar).
  const [seenViewRequest, setSeenViewRequest] = useState<number | null>(null);
  if (viewRequest !== null && viewRequest.seq !== seenViewRequest) {
    setSeenViewRequest(viewRequest.seq);
    setView(viewRequest.view);
  }
  const chooseView = (next: GuideView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento la pestaña vale para esta visita.
    }
  };
  useEffect(() => {
    try {
      window.localStorage.setItem(PIECES_STORAGE_KEY, JSON.stringify(pastedItems));
    } catch {
      // Sin almacenamiento las piezas valen para esta visita.
    }
  }, [pastedItems]);
  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl space-y-4" aria-labelledby="guia-titulo" data-testid="guia-acto">
      <header>
        {/* Quien llega desde Google no sabe qué es esta web. Con un personaje
            cargado ya lo sabe, y la frase sobra. */}
        {profile === null && (
          <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground" data-testid="guia-presentacion">
            <strong className="font-semibold text-foreground">Exile Copilot</strong> {t.intro}
          </p>
        )}
        <nav aria-label={t.guidesNav} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.guides}</span>
          {guides.map((item) => {
            const active = item.slug === guide.slug;
            return (
              <a
                key={item.slug}
                href={`/guias/${item.slug}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelectGuide(item.slug);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-foreground hover:border-primary/70 hover:text-primary",
                )}
                data-testid={`guia-nav-${item.slug}`}
              >
                {item.actLabel.replace(/^./, (c) => c.toUpperCase())}
              </a>
            );
          })}
          {(lang === "en" ? UPCOMING_GUIDES_EN : UPCOMING_GUIDES).map((label) => (
            <span
              key={label}
              className="rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm text-muted-foreground"
            >
              {label} · {t.soon}
            </span>
          ))}
        </nav>
        <h1 id="guia-titulo" className="dossier-title mt-3 text-2xl leading-tight text-foreground sm:text-3xl">
          {guide.title}
        </h1>
        <div
          className="mt-3 grid grid-cols-1 gap-1.5 rounded-xl border border-border bg-card p-1.5 sm:grid-cols-3"
          role="tablist"
          aria-label={t.viewsLabel}
          data-testid="guia-vistas"
        >
          {VIEWS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`guia-vista-${id}`}
              aria-selected={view === id}
              aria-controls={`guia-panel-${id}`}
              onClick={() => chooseView(id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                view === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              data-testid={`guia-vista-${id}`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {t.views[id]}
            </button>
          ))}
        </div>
      </header>

      {/* Las tres partes siguen montadas: lo pegado o escrito en una no se pierde al mirar otra. */}
      <div
        id="guia-panel-guia"
        role="tabpanel"
        aria-labelledby="guia-vista-guia"
        hidden={view !== "guia"}
        className="space-y-4"
      >
      <div>
        <p className="text-sm leading-relaxed text-muted-foreground">{guide.summary}</p>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-amber-200">
            {t.checkedFor(guide.checkedPatch)}
          </span>
          <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-muted-foreground">
            {t.readTime(guide.readMinutes)}
          </span>
        </div>
      </div>

      {guide.status === "borrador" && (
        <div
          className="flex gap-2.5 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 px-4 py-3 text-sm text-amber-100"
          role="note"
          data-testid="guia-borrador"
        >
          <FilePenLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">{t.draftTitle}</strong> {t.draftText}
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
          {t.essentials}
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

      {guide.route && guide.route.length > 0 && <Route key={`${guide.slug}-${lang}`} guide={guide} t={t} />}

      {guide.blocks.map((block) => (
        <Block key={block.id} guide={guide} block={block} t={t} />
      ))}

      <section aria-labelledby="guia-fuentes" className="px-1 pt-2" data-testid="guia-fuentes">
        <h2 id="guia-fuentes" className="text-sm font-semibold text-foreground">
          {t.sources}
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
          {t.checkedOn(guide.checkedOn)}
        </p>
      </section>
      </div>

      <div
        id="guia-panel-comprobar"
        role="tabpanel"
        aria-labelledby="guia-vista-comprobar"
        hidden={view !== "comprobar"}
        className="space-y-4"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.checkLead(guide.actLabel)}
        </p>
        <GuideCharacterCheck
          actLabel={guide.actLabel}
          targets={guide.check}
          profile={profile}
          items={pastedItems}
          onItemsChange={setPastedItems}
          patch={patch}
          onAskMentor={onAskMentor}
        />
        <RewardCheckCard
          key={`recompensas-${guide.slug}`}
          guide={guide}
          earlier={guides.filter((other) => other.act < guide.act)}
          items={pastedItems}
        />
      </div>

      <div
        id="guia-panel-herramientas"
        role="tabpanel"
        aria-labelledby="guia-vista-herramientas"
        hidden={view !== "herramientas"}
        className="space-y-4"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.toolsLead}
        </p>
        {SHOW_PASSIVE_ROUTE && <PassiveRouteCard profile={profile} />}
        <BuildConfigurator profile={profile} />
        <GemAdvisorCard
          profile={profile}
          buildMemory={buildMemory ?? []}
          onCreateCharacter={onCreateCharacter}
          onOwnSupport={onOwnSupport}
        />
        {/* Con equipo guardado basta pegar UNA pieza: la otra es la que lleva. */}
        {profile && hasWornGear(profile) && <FoundItemCard patch={patch} profile={profile} />}
        <ItemCompareCard patch={patch} profile={profile} preset={compareRequest} />
      </div>
    </article>
  );
}
