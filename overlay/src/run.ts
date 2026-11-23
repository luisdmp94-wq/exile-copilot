import type { GuideRoutePriority } from "../../src/guides/guide";
import {
  LAST_ACT,
  START,
  actOfCode,
  codesOfStep,
  enterZone,
  isNewCharacter,
  moveStep,
  nextShown,
  normalizeCode,
  positionIn,
  routeOf,
  sanitize,
  skippedInFastRoute,
  type Progress,
  type RouteMode,
} from "./progress";

/**
 * La partida de un personaje tal como la ve la ventanita: por dónde va, qué
 * zonas ha pisado, qué recompensas ha marcado y su nivel. Puro: cada evento
 * devuelve una partida nueva.
 */

export interface LeftBehind {
  act: number;
  items: Array<{ zone: string; reward: string }>;
  /** Se va solo tras unas cuantas zonas. */
  zonesLeft: number;
}

export interface Run {
  progress: Progress;
  /** Códigos de zona de los actos 1-4 que ha pisado este personaje. */
  visited: string[];
  /** Recompensas marcadas como cogidas: «acto:paso». */
  checked: string[];
  areaLevel: number | null;
  charLevel: number | null;
  leftBehind: LeftBehind | null;
}

export const NEW_RUN: Run = {
  progress: START,
  visited: [],
  checked: [],
  areaLevel: null,
  charLevel: null,
  leftBehind: null,
};

const LEFT_BEHIND_ZONES = 3;

const stepKey = (act: number, index: number) => `${act}:${index}`;

/** Lo permanente de un acto que se quedó sin hacer: zonas clave que no pisaste. */
export function missedRewards(run: Pick<Run, "visited" | "checked">, act: number): LeftBehind["items"] {
  const visited = new Set(run.visited);
  return routeOf(act).flatMap((step, index) => {
    if (step.priority !== "clave" || !step.reward) return [];
    if (run.checked.includes(stepKey(act, index))) return [];
    const codes = codesOfStep(act, index);
    return codes.some((code) => visited.has(code)) ? [] : [{ zone: step.zone, reward: step.reward }];
  });
}

/** Entra en una zona (línea «Generating level N area "X"» de Client.txt). */
export function onArea(run: Run, code: string, level: number): Run {
  if (isNewCharacter(run.progress, code)) {
    // El nivel se sabrá con su primera subida; hasta entonces, en blanco.
    return onArea(NEW_RUN, code, level);
  }
  const progress = enterZone(run.progress, code);
  const act = actOfCode(code);
  const visited =
    act !== null && !run.visited.includes(normalizeCode(code)) ? [...run.visited, normalizeCode(code)] : run.visited;

  // Al dejar un acto (pasar al siguiente, o a los interludios tras el último),
  // se mira qué recompensa para siempre se quedó atrás.
  const leftAct =
    act !== null && act > run.progress.act
      ? run.progress.act
      : act === null && /^P\d/.test(code) && run.progress.act === LAST_ACT && !run.progress.outside
        ? LAST_ACT
        : null;
  let leftBehind = run.leftBehind
    ? run.leftBehind.zonesLeft > 1
      ? { ...run.leftBehind, zonesLeft: run.leftBehind.zonesLeft - 1 }
      : null
    : null;
  if (leftAct !== null) {
    const items = missedRewards({ visited, checked: run.checked }, leftAct);
    leftBehind = items.length > 0 ? { act: leftAct, items, zonesLeft: LEFT_BEHIND_ZONES } : null;
  }
  // El nivel de un pueblo no dice nada de lo duro que es el acto.
  const areaLevel = /_town$/i.test(code) || act === null ? run.areaLevel : level;
  return { ...run, progress, visited, areaLevel, leftBehind };
}

/** Sube de nivel (línea «… is now level N»). */
export function onLevel(run: Run, level: number): Run {
  return { ...run, charLevel: level };
}

export function onMove(run: Run, delta: 1 | -1, mode: RouteMode): Run {
  return { ...run, progress: moveStep(run.progress, delta, mode) };
}

/** Marca o desmarca la recompensa del paso que se ve. */
export function onToggleReward(run: Run): Run {
  const { act, index } = run.progress;
  if (!routeOf(act)[index]?.reward) return run;
  const key = stepKey(act, index);
  const checked = run.checked.includes(key) ? run.checked.filter((item) => item !== key) : [...run.checked, key];
  return { ...run, checked };
}

export function onDismissNotice(run: Run): Run {
  return { ...run, leftBehind: null };
}

/** Una partida guardada que ya no encaja vuelve a empezar sin romper nada. */
export function sanitizeRun(value: unknown): Run {
  const raw = (value ?? {}) as Partial<Run> & { progress?: unknown };
  const strings = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
  const level = (item: unknown) => (typeof item === "number" && Number.isInteger(item) && item > 0 && item <= 100 ? item : null);
  return {
    progress: sanitize(raw.progress),
    visited: strings(raw.visited),
    checked: strings(raw.checked),
    areaLevel: level(raw.areaLevel),
    charLevel: level(raw.charLevel),
    leftBehind: null,
  };
}

// ---------------------------------------------------------------------------
// Lo que pinta la ventanita
// ---------------------------------------------------------------------------

/**
 * Diferencia de nivel: 3 o más por debajo de la zona ya se nota; 6, mucho.
 * 15 o más casi siempre es otro personaje (el registro no dice con cuál
 * juegas): mejor no decir nada que avisar mal.
 */
export type LevelState = "ok" | "bajo" | "muy-bajo";

export function levelState(areaLevel: number | null, charLevel: number | null): LevelState | null {
  if (areaLevel === null || charLevel === null) return null;
  const gap = areaLevel - charLevel;
  if (gap >= 15) return null;
  return gap >= 6 ? "muy-bajo" : gap >= 3 ? "bajo" : "ok";
}

export interface RewardRow {
  zone: string;
  reward: string;
  /** cogida: marcada con Fin · pisada: estuviste en la zona · dejada: quedó atrás sin pisar · pendiente: más adelante. */
  state: "cogida" | "pisada" | "dejada" | "pendiente";
  optional: boolean;
}

export interface StepView {
  act: number;
  number: number;
  total: number;
  zone: string;
  text: string;
  priority: GuideRoutePriority;
  optional: boolean;
  /** Fuera de la ruta rápida (estás en una zona que esa ruta no hace). */
  offRoute: boolean;
  reward: { text: string; checked: boolean } | null;
  /** Gemas sin tallar que la zona da siempre, una frase por gema. */
  gems: string[];
  /** Jefe u objetivo opcional de la zona: no da nada para siempre. */
  skip: string | null;
  /** El paso siguiente: la zona y, si la tiene, su recompensa para siempre. */
  next: { zone: string; reward: string | null } | null;
  outside: boolean;
  areaLevel: number | null;
  charLevel: number | null;
  level: LevelState | null;
  leftBehind: LeftBehind | null;
  /** Las recompensas para siempre del acto, para el resumen. */
  rewards: RewardRow[];
}

export function rewardRows(run: Run, act: number): RewardRow[] {
  const visited = new Set(run.visited);
  const ahead = (index: number) => act > run.progress.act || (act === run.progress.act && index > run.progress.index);
  return routeOf(act).flatMap((step, index) => {
    if (step.priority !== "clave" || !step.reward) return [];
    const state: RewardRow["state"] = run.checked.includes(stepKey(act, index))
      ? "cogida"
      : codesOfStep(act, index).some((code) => visited.has(code))
        ? "pisada"
        : ahead(index)
          ? "pendiente"
          : "dejada";
    return [{ zone: step.zone, reward: step.reward, state, optional: step.optional === true }];
  });
}

export function viewOf(run: Run, mode: RouteMode): StepView {
  const { progress } = run;
  const route = routeOf(progress.act);
  const step = route[progress.index] ?? route[0]!;
  const next = nextShown(progress, mode);
  const nextStep = next ? routeOf(next.act)[next.index]! : null;
  const { number, total } = positionIn(progress, mode);
  return {
    act: progress.act,
    number,
    total,
    zone: step.zone,
    text: step.text,
    priority: step.priority,
    optional: step.optional === true,
    offRoute: mode === "rapida" && skippedInFastRoute(step),
    reward: step.reward ? { text: step.reward, checked: run.checked.includes(stepKey(progress.act, progress.index)) } : null,
    gems: step.gems ?? [],
    skip: step.skip ?? null,
    next: nextStep ? { zone: nextStep.zone, reward: nextStep.reward ?? null } : null,
    outside: progress.outside,
    areaLevel: run.areaLevel,
    charLevel: run.charLevel,
    level: levelState(run.areaLevel, run.charLevel),
    leftBehind: run.leftBehind,
    rewards: rewardRows(run, progress.act),
  };
}
