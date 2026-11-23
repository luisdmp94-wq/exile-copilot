import { ACT_FOUR_GUIDE } from "../../src/guides/actFour";
import { ACT_ONE_GUIDE } from "../../src/guides/actOne";
import { ACT_THREE_GUIDE } from "../../src/guides/actThree";
import { ACT_TWO_GUIDE } from "../../src/guides/actTwo";
import type { ActGuide, GuideRouteStep } from "../../src/guides/guide";
import { ZONE_CODES } from "./zones";

/**
 * En qué paso de la guía va el jugador. Todo es puro: recibe el estado y
 * devuelve el nuevo, sin leer archivos.
 */

export const GUIDES: ActGuide[] = [ACT_ONE_GUIDE, ACT_TWO_GUIDE, ACT_THREE_GUIDE, ACT_FOUR_GUIDE];
export const FIRST_ACT = 1;
export const LAST_ACT = GUIDES.length;

export type RouteMode = "completa" | "rapida";

export interface Progress {
  act: number;
  index: number;
  /** La última zona no está en las guías (interludios, mapas, guarida). */
  outside: boolean;
}

export const START: Progress = { act: FIRST_ACT, index: 0, outside: false };

export function routeOf(act: number): GuideRouteStep[] {
  return GUIDES.find((guide) => guide.act === act)?.route ?? [];
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

/** El acto de un código («G3_6_1» → 3); null si no es de los actos 1-4. */
export function actOfCode(code: string): number | null {
  const match = /^G(\d+)_/.exec(normalizeCode(code));
  if (!match) return null;
  const act = Number(match[1]);
  return act >= FIRST_ACT && act <= LAST_ACT ? act : null;
}

/** Los pasos del acto que pasan por esa zona, en orden. */
export function stepsForCode(act: number, code: string): number[] {
  const wanted = normalizeCode(code);
  const table = ZONE_CODES[act] ?? {};
  return routeOf(act).flatMap((step, index) => ((table[step.zone] ?? []).includes(wanted) ? [index] : []));
}

/** Los códigos de zona de un paso. */
export function codesOfStep(act: number, index: number): string[] {
  const step = routeOf(act)[index];
  return step ? (ZONE_CODES[act]?.[step.zone] ?? []) : [];
}

/**
 * El jugador entra en una zona. Se enseña el paso de esa zona; si la zona
 * sale en varios pasos, el primero que no ha pasado todavía. Una zona sin
 * paso (el pueblo, una cueva de paso) deja la guía donde estaba. Una zona de
 * otro acto cambia de acto. Un pueblo que es paso (Marca del rey) solo cuenta
 * al llegar al acto: volver a él más tarde no devuelve la guía al principio.
 */
export function enterZone(progress: Progress, code: string): Progress {
  const act = actOfCode(code);
  if (act === null) return { ...progress, outside: true };
  const matches = stepsForCode(act, code);
  if (act !== progress.act) return { act, index: matches[0] ?? 0, outside: false };
  if (matches.length === 0) return { ...progress, outside: false };
  const ahead = matches.find((index) => index >= progress.index);
  if (ahead === undefined && /_town$/i.test(code)) return { ...progress, outside: false };
  return { act, index: ahead ?? matches[matches.length - 1]!, outside: false };
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
