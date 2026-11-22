/**
 * «Sigues por aquí»: en qué acto y en qué paso de la ruta iba el jugador.
 *
 * Sale de lo que ya guarda la guía en el navegador (las zonas marcadas de
 * cada acto) y de la última guía abierta. Nada sale de su equipo.
 */
import type { ActGuide, GuideRouteStep } from "../guides/guide";
import { guidesFor } from "../guides";

/** Zonas marcadas de la ruta de un acto (por nombre de zona en español). */
export const ROUTE_STORAGE_PREFIX = "exile-copilot:guia-ruta:";
/** La última guía que abrió. */
export const LAST_GUIDE_STORAGE_KEY = "exile-copilot:guia-ultima";
/** Se avisa cuando cambia lo marcado, para que «Sigues por aquí» se ponga al día. */
export const ROUTE_CHANGED_EVENT = "exile-copilot:guia-ruta-cambiada";

export interface ResumePoint {
  slug: string;
  actLabel: string;
  /** Pasos de la ruta ya marcados y total del acto. */
  done: number;
  total: number;
  /** Lo siguiente sin marcar: número de paso (desde 1) y zona en el idioma de la web. */
  next: { step: number; zone: string } | null;
  /** Aún no ha marcado nada en este acto: viene de terminar el anterior o de abrirlo. */
  starting: boolean;
}

type Store = Pick<Storage, "getItem">;

/**
 * El paso que toca: el primero sin marcar que no se pueda saltar. Las zonas
 * opcionales pero clave (la Prueba de las sekhemas) también cuentan; si solo
 * quedan opcionales, la primera de ellas. -1 si está todo hecho.
 */
export function nextRouteIndex(steps: readonly GuideRouteStep[], isDone: (index: number) => boolean): number {
  const required = steps.findIndex((step, index) => (!step.optional || step.priority === "clave") && !isDone(index));
  return required !== -1 ? required : steps.findIndex((_step, index) => !isDone(index));
}

/** «acto 2» → «Acto 2». */
function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function readDone(store: Store, slug: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(ROUTE_STORAGE_PREFIX + slug) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((zone): zone is string => typeof zone === "string") : []);
  } catch {
    return new Set();
  }
}

function pointFor(guide: ActGuide, spanish: ActGuide, done: Set<string>): ResumePoint {
  const steps = guide.route ?? [];
  const spanishSteps = spanish.route ?? [];
  const keyOf = (index: number) => spanishSteps[index]?.zone ?? steps[index].zone;
  const doneCount = steps.filter((_step, index) => done.has(keyOf(index))).length;
  const nextIndex = nextRouteIndex(steps, (index) => done.has(keyOf(index)));
  return {
    slug: guide.slug,
    actLabel: capitalized(guide.actLabel),
    done: doneCount,
    total: steps.length,
    next: nextIndex === -1 ? null : { step: nextIndex + 1, zone: steps[nextIndex].zone },
    starting: doneCount === 0,
  };
}

/** ¿Están hechos todos los pasos obligatorios del acto? */
function finished(guide: ActGuide, done: Set<string>): boolean {
  const steps = guide.route ?? [];
  return steps.length > 0 && steps.every((step) => (step.optional && step.priority !== "clave") || done.has(step.zone));
}

/**
 * Dónde sigue el jugador, o null si no ha empezado ninguna guía (o ya las ha
 * terminado todas: entonces no hay nada que «seguir»).
 */
export function readResumePoint(store: Store, lang: "es" | "en"): ResumePoint | null {
  const spanishGuides = [...guidesFor("es")].sort((a, b) => a.act - b.act);
  const localized = new Map(guidesFor(lang).map((guide) => [guide.slug, guide]));
  const show = (spanish: ActGuide, done: Set<string>) => pointFor(localized.get(spanish.slug) ?? spanish, spanish, done);

  // El acto más avanzado con algo marcado.
  let latest: { guide: ActGuide; done: Set<string> } | null = null;
  for (const guide of spanishGuides) {
    const done = readDone(store, guide.slug);
    if (done.size > 0) latest = { guide, done };
  }
  if (latest) {
    const current = latest;
    if (!finished(current.guide, current.done)) return show(current.guide, current.done);
    // Acabó ese acto: lo siguiente es el próximo que tenga ruta.
    const following = spanishGuides.find((guide) => guide.act > current.guide.act && (guide.route?.length ?? 0) > 0);
    return following ? show(following, readDone(store, following.slug)) : null;
  }

  // Sin nada marcado: la última guía que abrió, si la abrió.
  let last: string | null = null;
  try {
    last = store.getItem(LAST_GUIDE_STORAGE_KEY);
  } catch {
    last = null;
  }
  const lastGuide = spanishGuides.find((guide) => guide.slug === last);
  return lastGuide && (lastGuide.route?.length ?? 0) > 0 ? show(lastGuide, new Set()) : null;
}
