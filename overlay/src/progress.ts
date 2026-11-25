import { ACT_FOUR_GUIDE } from "../../src/guides/actFour";
import { ACT_ONE_GUIDE } from "../../src/guides/actOne";
import { ACT_THREE_GUIDE } from "../../src/guides/actThree";
import { ACT_TWO_GUIDE } from "../../src/guides/actTwo";
import type { ActGuide, GuideRouteStep } from "../../src/guides/guide";
import { INTERLUDE_ROUTES, INTERLUDE_ZONE_CODES } from "./interludes";
import { ZONE_CODES } from "./zones";

/**
 * En qué paso de la guía va el jugador. Todo es puro: recibe el estado y
 * devuelve el nuevo, sin leer archivos.
 */

export const GUIDES: ActGuide[] = [ACT_ONE_GUIDE, ACT_TWO_GUIDE, ACT_THREE_GUIDE, ACT_FOUR_GUIDE];
export const FIRST_ACT = 1;
/** El último acto de la historia (los que tienen guía en la web). */
export const LAST_STORY_ACT = GUIDES.length;
/**
 * Por dentro, los tres interludios son tres actos más: 5, 6 y 7. El jugador
 * nunca ve «Acto 5»: ve «Interludio 1» (`stageName`).
 */
export const LAST_ACT = LAST_STORY_ACT + INTERLUDE_ROUTES.length;

/** Qué interludio es ese acto (5 → 1); null si es un acto de la historia. */
export function interludeOf(act: number): number | null {
  return act > LAST_STORY_ACT && act <= LAST_ACT ? act - LAST_STORY_ACT : null;
}

/** Cómo se llama ese tramo para el jugador: «Acto 3», «Interludio 1». */
export function stageName(act: number): string {
  const interlude = interludeOf(act);
  return interlude === null ? `Acto ${act}` : `Interludio ${interlude}`;
}

export type RouteMode = "completa" | "rapida";

export interface Progress {
  act: number;
  index: number;
  /** La última zona no está en las guías (mapas, guarida). */
  outside: boolean;
}

export const START: Progress = { act: FIRST_ACT, index: 0, outside: false };

export function routeOf(act: number): GuideRouteStep[] {
  const interlude = interludeOf(act);
  if (interlude !== null) return INTERLUDE_ROUTES.find((part) => part.interlude === interlude)?.route ?? [];
  return GUIDES.find((guide) => guide.act === act)?.route ?? [];
}

/** Los códigos de zona de cada paso de ese acto o interludio, por el texto `zone` del paso. */
function codeTable(act: number): Record<string, string[]> {
  const interlude = interludeOf(act);
  if (interlude !== null) return INTERLUDE_ZONE_CODES[interlude as 1 | 2 | 3] ?? {};
  return ZONE_CODES[act] ?? {};
}

/**
 * La ruta rápida se salta las zonas opcionales que no dan nada para siempre
 * (Lodazal, la cámara fundida, Punta del botín). Lo permanente se queda.
 */
export function skippedInFastRoute(step: GuideRouteStep): boolean {
  return step.optional === true && step.priority !== "clave";
}

function shownIn(mode: RouteMode, step: GuideRouteStep): boolean {
  return mode === "completa" || !skippedInFastRoute(step);
}

/** «C_G1_2» es la misma zona que «G1_2». */
export function normalizeCode(code: string): string {
  return code.replace(/^C_/, "");
}

/**
 * El acto de un código («G3_6_1» → 3). Los interludios («P2_5», «P2_Town»)
 * son los actos 5, 6 y 7. Null si no es de la campaña (mapas, guarida).
 */
export function actOfCode(code: string): number | null {
  const normalized = normalizeCode(code);
  const story = /^G(\d+)_/.exec(normalized);
  if (story) {
    const act = Number(story[1]);
    return act >= FIRST_ACT && act <= LAST_STORY_ACT ? act : null;
  }
  const interlude = /^P(\d+)_/.exec(normalized);
  if (!interlude) return null;
  const act = LAST_STORY_ACT + Number(interlude[1]);
  return act > LAST_STORY_ACT && act <= LAST_ACT ? act : null;
}

const isTown = (code: string) => /_town$/i.test(code);

/** Los pasos del acto que pasan por esa zona, en orden. */
export function stepsForCode(act: number, code: string): number[] {
  const wanted = normalizeCode(code);
  const table = codeTable(act);
  return routeOf(act).flatMap((step, index) => ((table[step.zone] ?? []).includes(wanted) ? [index] : []));
}

/** Los códigos de zona de un paso. */
export function codesOfStep(act: number, index: number): string[] {
  const step = routeOf(act)[index];
  return step ? (codeTable(act)[step.zone] ?? []) : [];
}

/**
 * El jugador entra en una zona. Se enseña el paso de esa zona; si la zona
 * sale en varios pasos, el primero que no ha pasado todavía. Una zona sin
 * paso (el pueblo, una cueva de paso) deja la guía donde estaba. Una zona de
 * otro acto cambia de acto. Un pueblo que es paso (Marca del rey) solo cuenta
 * al llegar al acto: volver a él más tarde no devuelve la guía al principio.
 *
 * En los interludios los pueblos no mueven la guía: se pasa por ellos a cada
 * rato y de uno a otro sin orden fijo. Y volver desde un interludio a un
 * pueblo de los actos (Marca del rey, donde acaba todo) tampoco la devuelve
 * al acto 4.
 */
export function enterZone(progress: Progress, code: string): Progress {
  return enterZoneKnowing(progress, code, () => false);
}

/**
 * Lo mismo, sabiendo qué pasos tienen ya todo hecho. Si la zona sale en dos
 * pasos y el primero está hecho, toca el segundo: volver a El final del viaje
 * con Hartlin ya vencido es la misión de Omnifobia, no otra vez Hartlin.
 */
export function enterZoneKnowing(progress: Progress, code: string, isDone: (act: number, index: number) => boolean): Progress {
  const act = actOfCode(code);
  if (act === null) return { ...progress, outside: true };
  if (isTown(code)) {
    // El pueblo de un interludio: la guía se queda donde estaba. Solo si aún no
    // sabía nada (un registro cortado que empieza ahí) se coloca al principio de
    // ese interludio, en vez de decir «Acto 1 · paso 1».
    const knowsNothing = progress.act === START.act && progress.index === START.index;
    if (act > LAST_STORY_ACT && !knowsNothing) return { ...progress, outside: false };
    if (act <= LAST_STORY_ACT && progress.act > LAST_STORY_ACT) return { ...progress, outside: false };
  }
  const matches = stepsForCode(act, code);
  if (act !== progress.act) return { act, index: matches[0] ?? 0, outside: false };
  if (matches.length === 0) return { ...progress, outside: false };
  const ahead = matches.filter((index) => index >= progress.index);
  if (ahead.length === 0 && isTown(code)) return { ...progress, outside: false };
  const pick = ahead.find((index) => !isDone(act, index)) ?? ahead[0] ?? matches[matches.length - 1]!;
  return { act, index: pick, outside: false };
}

/** Volver a la orilla del río desde un acto posterior es un personaje nuevo. */
export function isNewCharacter(progress: Progress, code: string): boolean {
  return normalizeCode(code) === "G1_1" && progress.act > FIRST_ACT;
}

/**
 * Re Pág / Av Pág: un paso atrás o adelante, saltando de acto en los
 * extremos. En la ruta rápida se saltan los pasos que esa ruta no hace.
 */
export function moveStep(progress: Progress, delta: 1 | -1, mode: RouteMode = "completa"): Progress {
  let act = progress.act;
  let index = progress.index;
  for (;;) {
    index += delta;
    if (index >= routeOf(act).length) {
      if (act >= LAST_ACT) return { ...progress, outside: false };
      act += 1;
      index = 0;
    } else if (index < 0) {
      if (act <= FIRST_ACT) return { ...progress, outside: false };
      act -= 1;
      index = routeOf(act).length - 1;
    }
    if (shownIn(mode, routeOf(act)[index]!)) return { act, index, outside: false };
  }
}

/** El paso siguiente que enseña la ruta, aunque sea del acto siguiente. */
export function nextShown(progress: Progress, mode: RouteMode): { act: number; index: number } | null {
  const next = moveStep(progress, 1, mode);
  return next.act === progress.act && next.index === progress.index ? null : next;
}

/** Posición «n de total» contando solo los pasos que enseña la ruta. */
export function positionIn(progress: Progress, mode: RouteMode): { number: number; total: number } {
  const route = routeOf(progress.act);
  const shown = route.flatMap((step, index) => (shownIn(mode, step) || index === progress.index ? [index] : []));
  return { number: shown.indexOf(progress.index) + 1, total: shown.length };
}

/** Un estado guardado que ya no encaja (otra versión de las guías) vuelve al principio. */
export function sanitize(value: unknown): Progress {
  const candidate = value as Partial<Progress> | null;
  const act = Number(candidate?.act);
  const index = Number(candidate?.index);
  if (!Number.isInteger(act) || !Number.isInteger(index)) return START;
  if (index < 0 || index >= routeOf(act).length) return START;
  // Si se cerró estando fuera de las guías (un pasaje de la liga, la guarida), sigue fuera al volver.
  return { act, index, outside: candidate?.outside === true };
}
