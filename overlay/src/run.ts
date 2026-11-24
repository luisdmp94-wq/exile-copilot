import type { GuideRoutePriority } from "../../src/guides/guide";
import { BASE_CLASSES, BOSS_SIGNS, REWARD_RULES, type RewardKind } from "./objectives";
import {
  FIRST_ACT,
  LAST_ACT,
  START,
  actOfCode,
  codesOfStep,
  enterZoneKnowing,
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
  /** Recompensas marcadas como cogidas (por el registro o a mano): «acto:paso». */
  checked: string[];
  /** Pasos cuyo jefe ya cayó: «acto:paso». */
  bosses: string[];
  /** Código de la zona donde está ahora, también fuera de las guías. */
  area: string | null;
  areaLevel: number | null;
  charLevel: number | null;
  /** La clase que dice la última subida de nivel («Bruja», «Liche»). */
  className: string | null;
  /** El registro ha dicho alguna recompensa de este personaje: si una no consta, es que no la tiene. */
  hears: boolean;
  leftBehind: LeftBehind | null;
}

export const NEW_RUN: Run = {
  progress: START,
  visited: [],
  checked: [],
  bosses: [],
  area: null,
  areaLevel: null,
  charLevel: null,
  className: null,
  hears: false,
  leftBehind: null,
};

const LEFT_BEHIND_ZONES = 3;

const stepKey = (act: number, index: number) => `${act}:${index}`;

/**
 * ¿Se sabría si este personaje tiene la recompensa del paso? Sí cuando el
 * juego la anuncia con un mensaje y el registro ya ha dicho alguna de las
 * suyas. La ascendencia no cuenta: solo se nota si se le ve cambiar de clase.
 */
function wouldBeKnown(run: Pick<Run, "hears">, act: number, zone: string): boolean {
  const rule = REWARD_RULES[act]?.[zone];
  if (!rule || !run.hears) return false;
  return rule.anyIn !== undefined || (rule.kinds ?? []).some((kind) => kind !== "ascendencia");
}

/**
 * Lo permanente de un acto que se quedó sin hacer: zonas clave que no pisaste
 * y, cuando se sabe, las que pisaste sin llevarte la recompensa.
 */
export function missedRewards(run: Pick<Run, "visited" | "checked" | "hears">, act: number): LeftBehind["items"] {
  const visited = new Set(run.visited);
  return routeOf(act).flatMap((step, index) => {
    if (step.priority !== "clave" || !step.reward) return [];
    if (run.checked.includes(stepKey(act, index))) return [];
    const stepped = codesOfStep(act, index).some((code) => visited.has(code));
    return stepped && !wouldBeKnown(run, act, step.zone) ? [] : [{ zone: step.zone, reward: step.reward }];
  });
}

/**
 * ¿Está hecho todo lo que se puede comprobar de ese paso (recompensa cogida,
 * jefe vencido)? Null si el paso no tiene nada que comprobar.
 */
export function stepReady(run: Pick<Run, "checked" | "bosses">, act: number, index: number): boolean | null {
  const step = routeOf(act)[index];
  if (!step) return null;
  const key = stepKey(act, index);
  const goals = [
    ...(step.reward ? [run.checked.includes(key)] : []),
    ...(BOSS_SIGNS[act]?.[step.zone] ? [run.bosses.includes(key)] : []),
  ];
  return goals.length > 0 ? goals.every(Boolean) : null;
}

/**
 * Entra en una zona (línea «Generating level N area "X"» de Client.txt).
 * `guessNew`: sin saber quién juega, volver a la orilla del río desde un acto
 * posterior se toma por un personaje nuevo. Con el personaje ya nombrado no
 * hace falta adivinar: puede volver allí sin perder su partida.
 */
export function onArea(run: Run, code: string, level: number, guessNew = true): Run {
  if (guessNew && isNewCharacter(run.progress, code)) {
    // El nivel se sabrá con su primera subida; hasta entonces, en blanco.
    return onArea(NEW_RUN, code, level);
  }
  const progress = enterZoneKnowing(run.progress, code, (stepAct, index) => stepReady(run, stepAct, index) === true);
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
    const items = missedRewards({ visited, checked: run.checked, hears: run.hears }, leftAct);
    leftBehind = items.length > 0 ? { act: leftAct, items, zonesLeft: LEFT_BEHIND_ZONES } : null;
  }
  // El nivel de un pueblo no dice nada de lo duro que es el acto.
  const areaLevel = /_town$/i.test(code) || act === null ? run.areaLevel : level;
  return { ...run, progress, visited, area: normalizeCode(code), areaLevel, leftBehind };
}

/**
 * El juego dice que recibiste una recompensa para siempre: se marca sola la
 * del paso al que corresponde, en el acto donde estás. Si hay dos pasos con
 * la misma (dos libros de 2 puntos), gana el de la zona donde estás; si no,
 * el primero que ya pisaste.
 */
export function onReward(run: Run, kind: RewardKind): Run {
  const area = run.area;
  const act = area ? actOfCode(area) : null;
  if (!area || act === null) return run;
  const visited = new Set(run.visited);
  const open = routeOf(act).flatMap((step, index) => {
    const rule = REWARD_RULES[act]?.[step.zone];
    if (!rule || !step.reward || run.checked.includes(stepKey(act, index))) return [];
    return [{ index, rule, codes: codesOfStep(act, index) }];
  });
  const sameKind = open.filter((item) => item.rule.kinds?.includes(kind));
  const pick =
    sameKind.find((item) => item.codes.includes(area) || item.rule.where?.includes(area)) ??
    sameKind.find((item) => item.codes.some((code) => visited.has(code))) ??
    sameKind[0] ??
    (kind === "puntos" ? undefined : open.find((item) => item.rule.anyIn?.includes(area)));
  if (!pick) return run.hears ? run : { ...run, hears: true };
  return { ...run, hears: true, checked: [...run.checked, stepKey(act, pick.index)] };
}

/** Se oyó la frase que solo se dice con el jefe de ese paso vencido, y estás en su zona. */
export function onBoss(run: Run, act: number, zone: string): Run {
  const index = routeOf(act).findIndex((step) => step.zone === zone);
  if (index < 0 || !run.area || !codesOfStep(act, index).includes(run.area)) return run;
  const key = stepKey(act, index);
  return run.bosses.includes(key) ? run : { ...run, bosses: [...run.bosses, key] };
}

/** Marca o desmarca a mano el jefe del paso que se ve (por si el registro no lo dijo). */
export function onToggleBoss(run: Run): Run {
  const { act, index } = run.progress;
  if (!BOSS_SIGNS[act]?.[routeOf(act)[index]?.zone ?? ""]) return run;
  const key = stepKey(act, index);
  const bosses = run.bosses.includes(key) ? run.bosses.filter((item) => item !== key) : [...run.bosses, key];
  return { ...run, bosses };
}

/** El primer paso de ascendencia sin marcar, en cualquier acto. */
function ascendancyStep(run: Run): string | null {
  for (let act = FIRST_ACT; act <= LAST_ACT; act += 1) {
    const index = routeOf(act).findIndex(
      (step, at) => REWARD_RULES[act]?.[step.zone]?.kinds?.includes("ascendencia") && !run.checked.includes(stepKey(act, at)),
    );
    if (index >= 0) return stepKey(act, index);
  }
  return null;
}

/**
 * Sube de nivel (línea «Exiliada (Liche) es ahora nivel 33»). Si la clase
 * pasa de una sin ascender a otra que no lo es, ha ascendido: se marca sola.
 */
export function onLevel(run: Run, level: number, className: string | null = null): Run {
  const ascended =
    run.className !== null && className !== null && BASE_CLASSES.has(run.className) && !BASE_CLASSES.has(className);
  const key = ascended ? ascendancyStep(run) : null;
  return {
    ...run,
    charLevel: level,
    className: className ?? run.className,
    checked: key ? [...run.checked, key] : run.checked,
  };
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
    bosses: strings(raw.bosses),
    area: typeof raw.area === "string" ? raw.area : null,
    areaLevel: level(raw.areaLevel),
    charLevel: level(raw.charLevel),
    className: typeof raw.className === "string" ? raw.className : null,
    hears: raw.hears === true,
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
  /**
   * cogida: la tienes · falta: estuviste y el registro no dice que la cogieras ·
   * pisada: estuviste, no se puede saber · dejada: quedó atrás sin pisar · pendiente: más adelante.
   */
  state: "cogida" | "falta" | "pisada" | "dejada" | "pendiente";
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
  /** `auto`: el registro la marca sola al recibirla; si no, se marca a mano. */
  reward: { text: string; checked: boolean; auto: boolean } | null;
  /** El jefe de la zona, solo si el registro deja saber cuándo cae. */
  boss: { name: string; dead: boolean } | null;
  /** Todo lo que se puede comprobar del paso está hecho: se puede seguir. Null si no hay nada que comprobar. */
  ready: boolean | null;
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
  /** Lo que se quedó sin coger en los actos anteriores. */
  missedBefore: Array<{ act: number; zone: string; reward: string }>;
}

export function rewardRows(run: Run, act: number): RewardRow[] {
  const visited = new Set(run.visited);
  const ahead = (index: number) => act > run.progress.act || (act === run.progress.act && index > run.progress.index);
  return routeOf(act).flatMap((step, index) => {
    if (step.priority !== "clave" || !step.reward) return [];
    const state: RewardRow["state"] = run.checked.includes(stepKey(act, index))
      ? "cogida"
      : codesOfStep(act, index).some((code) => visited.has(code))
        ? wouldBeKnown(run, act, step.zone)
          ? "falta"
          : "pisada"
        : ahead(index)
          ? "pendiente"
          : "dejada";
    return [{ zone: step.zone, reward: step.reward, state, optional: step.optional === true }];
  });
}

/**
 * «Luego»: el siguiente paso de la ruta que aún tiene algo que hacer. Los que
 * ya pisaste y no dejan nada pendiente se saltan: al volver por Sierraclara
 * desde Lodazal, lo siguiente es El bosque singular, no otra vez Lodazal. Si
 * no queda ninguno así, el siguiente de la lista sin más.
 */
function nextToDo(run: Run, mode: RouteMode): { act: number; index: number } | null {
  const first = nextShown(run.progress, mode);
  const visited = new Set(run.visited);
  let at = first;
  for (let guard = 0; at !== null && guard < 80; guard += 1) {
    const stepped = codesOfStep(at.act, at.index).some((code) => visited.has(code));
    if (!stepped || stepReady(run, at.act, at.index) === false) return at;
    at = nextShown({ act: at.act, index: at.index, outside: false }, mode);
  }
  return first;
}

export function viewOf(run: Run, mode: RouteMode): StepView {
  const { progress } = run;
  const route = routeOf(progress.act);
  const step = route[progress.index] ?? route[0]!;
  const next = nextToDo(run, mode);
  const nextStep = next ? routeOf(next.act)[next.index]! : null;
  const { number, total } = positionIn(progress, mode);
  const key = stepKey(progress.act, progress.index);
  const reward = step.reward
    ? { text: step.reward, checked: run.checked.includes(key), auto: REWARD_RULES[progress.act]?.[step.zone] !== undefined }
    : null;
  const sign = BOSS_SIGNS[progress.act]?.[step.zone];
  const boss = sign ? { name: sign.boss, dead: run.bosses.includes(key) } : null;
  return {
    act: progress.act,
    number,
    total,
    zone: step.zone,
    text: step.text,
    priority: step.priority,
    optional: step.optional === true,
    offRoute: mode === "rapida" && skippedInFastRoute(step),
    reward,
    boss,
    ready: stepReady(run, progress.act, progress.index),
    gems: step.gems ?? [],
    skip: step.skip ?? null,
    next: nextStep ? { zone: nextStep.zone, reward: nextStep.reward ?? null } : null,
    outside: progress.outside,
    areaLevel: run.areaLevel,
    charLevel: run.charLevel,
    level: levelState(run.areaLevel, run.charLevel),
    leftBehind: run.leftBehind,
    rewards: rewardRows(run, progress.act),
    missedBefore: Array.from({ length: progress.act - FIRST_ACT }, (_, offset) => FIRST_ACT + offset).flatMap((act) =>
      missedRewards(run, act).map((item) => ({ act, ...item })),
    ),
  };
}
