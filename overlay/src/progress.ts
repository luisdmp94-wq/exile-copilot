import { ACT_FOUR_GUIDE } from "../../src/guides/actFour";
import { ACT_ONE_GUIDE } from "../../src/guides/actOne";
import { ACT_THREE_GUIDE } from "../../src/guides/actThree";
import { ACT_TWO_GUIDE } from "../../src/guides/actTwo";
import type { ActGuide, GuideRoutePriority, GuideRouteStep } from "../../src/guides/guide";
import { ZONE_CODES } from "./zones";

/**
 * En qué paso de la guía va el jugador y qué se enseña en la ventanita.
 * Todo es puro: recibe el estado y devuelve el nuevo, sin leer archivos.
 */

export const GUIDES: ActGuide[] = [ACT_ONE_GUIDE, ACT_TWO_GUIDE, ACT_THREE_GUIDE, ACT_FOUR_GUIDE];
const FIRST_ACT = 1;
const LAST_ACT = GUIDES.length;

export interface Progress {
  act: number;
  index: number;
  /** La última zona no está en las guías (interludios, mapas, guarida). */
  outside: boolean;
}

export const START: Progress = { act: FIRST_ACT, index: 0, outside: false };

function routeOf(act: number): GuideRouteStep[] {
  return GUIDES.find((guide) => guide.act === act)?.route ?? [];
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

/**
 * El jugador entra en una zona. Se enseña el paso de esa zona; si la zona
 * sale en varios pasos, el primero que no ha pasado todavía. Una zona sin
 * paso (el pueblo, una cueva de paso) deja la guía donde estaba. Una zona de
 * otro acto cambia de acto; volver a G1_1 es un personaje nuevo.
 */
export function enterZone(progress: Progress, code: string): Progress {
  const act = actOfCode(code);
  if (act === null) return { ...progress, outside: true };
  const matches = stepsForCode(act, code);
  if (act !== progress.act) return { act, index: matches[0] ?? 0, outside: false };
  if (matches.length === 0) return { ...progress, outside: false };
  const ahead = matches.find((index) => index >= progress.index);
  return { act, index: ahead ?? matches[matches.length - 1]!, outside: false };
}

/** Re Pág / Av Pág: un paso atrás o adelante, saltando de acto en los extremos. */
export function moveStep(progress: Progress, delta: 1 | -1): Progress {
  const route = routeOf(progress.act);
  const index = progress.index + delta;
  if (index >= 0 && index < route.length) return { act: progress.act, index, outside: false };
  if (delta === 1 && progress.act < LAST_ACT) return { act: progress.act + 1, index: 0, outside: false };
  if (delta === -1 && progress.act > FIRST_ACT) {
    return { act: progress.act - 1, index: routeOf(progress.act - 1).length - 1, outside: false };
  }
  return { ...progress, outside: false };
}

/** Un estado guardado que ya no encaja (otra versión de las guías) vuelve al principio. */
export function sanitize(value: unknown): Progress {
  const candidate = value as Partial<Progress> | null;
  const act = Number(candidate?.act);
  const index = Number(candidate?.index);
  if (!Number.isInteger(act) || !Number.isInteger(index)) return START;
  if (index < 0 || index >= routeOf(act).length) return START;
  return { act, index, outside: false };
}

export interface StepView {
  act: number;
  number: number;
  total: number;
  zone: string;
  text: string;
  priority: GuideRoutePriority;
  optional: boolean;
  next: { zone: string; text: string } | null;
  outside: boolean;
}

/** Lo que pinta la ventanita, con los textos tal cual están en la guía. */
export function viewOf(progress: Progress): StepView {
  const route = routeOf(progress.act);
  const step = route[progress.index] ?? route[0]!;
  const nextStep = route[progress.index + 1] ?? routeOf(progress.act + 1)[0] ?? null;
  return {
    act: progress.act,
    number: progress.index + 1,
    total: route.length,
    zone: step.zone,
    text: step.text,
    priority: step.priority,
    optional: step.optional === true,
    next: nextStep ? { zone: nextStep.zone, text: nextStep.text } : null,
    outside: progress.outside,
  };
}
