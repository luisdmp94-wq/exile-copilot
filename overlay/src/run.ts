import type { GuideRoutePriority } from "../../src/guides/guide";
import {
  BASE_CLASSES,
  BOSS_SIGNS,
  NEEDS_PICKUPS,
  PICKUPS,
  REWARD_RULES,
  SILENT_BOSSES,
  ZONE_NOTES,
  bossOf,
  type RewardKind,
} from "./objectives";
import {
  FIRST_ACT,
  GUIDES,
  LAST_ACT,
  LAST_STORY_ACT,
  START,
  actOfCode,
  codesOfStep,
  enterZoneKnowing,
  interludeOf,
  isNewCharacter,
  moveStep,
  nextShown,
  normalizeCode,
  positionIn,
  routeOf,
  sanitize,
  skippedInFastRoute,
  stepsForCode,
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
  /** Códigos de zona de la campaña (actos e interludios, pueblos incluidos) que ha pisado este personaje. */
  visited: string[];
  /** Recompensas marcadas como cogidas (por el registro o a mano): «acto:paso». */
  checked: string[];
  /** Entregas recibidas de las recompensas que llegan en varias (tres tatuajes): «acto:paso» → cuántas. */
  partial: Record<string, number>;
  /** Pasos cuyo jefe ya cayó: «acto:paso». */
  bosses: string[];
  /** Objetos recogidos que hacen falta más adelante (trozos de mapa), marcados a mano: «acto:paso». */
  pickups?: string[];
  /** Jefes u objetivos opcionales que el jugador ha marcado como hechos, a mano: «acto:paso». */
  skips?: string[];
  /** Código de la zona donde está ahora, también fuera de las guías. */
  area: string | null;
  areaLevel: number | null;
  charLevel: number | null;
  /** La clase que dice la última subida de nivel («Bruja», «Liche»). */
  className: string | null;
  /** El registro ha dicho alguna recompensa de este personaje: si una no consta, es que no la tiene. */
  hears: boolean;
  leftBehind: LeftBehind | null;
  /** Acaba de pasar de acto (o al interludio 1): cuánto le baja la resistencia. Se va solo tras unas zonas. */
  resistDrop?: ResistDrop | null;
}

/** El acto al que se llega (5 = el interludio 1) y cuántas zonas le quedan al aviso. */
export interface ResistDrop {
  into: number;
  zonesLeft: number;
}

/**
 * Cómo se llama en la guía la tarjeta de ese acto. Los tres interludios
 * comparten una («Interludios») y solo se avisa al entrar en el primero: en
 * el 2 y el 3 no hay tarjeta, luego no hay aviso.
 */
function resistanceCard(into: number): string | null {
  const interlude = interludeOf(into);
  if (interlude === null) return `Acto ${into}`;
  return interlude === 1 ? "Interludios" : null;
}

/**
 * Lo que la guía del acto 1 dice que quita cada acto («Acto 2» → «−10 %»).
 * Sale de sus tarjetas de «Resistencias»: aquí no se escribe ninguna cifra.
 */
function resistancePenalty(into: number): string | null {
  const cards = GUIDES.flatMap((guide) => guide.blocks).find((block) => block.id === "resistencias")?.cards ?? [];
  const title = resistanceCard(into);
  return title === null ? null : (cards.find((card) => card.title === title)?.text ?? null);
}

/**
 * El aviso al cambiar de acto: «Acto 3: la penalización de resistencias es ya
 * de −20 %. Mira tu hoja: apunta a un 30 % en fuego, hielo y rayo». Null si la
 * guía no dice nada de ese acto.
 */
export function resistanceNotice(drop: ResistDrop | null | undefined): string | null {
  if (!drop) return null;
  const penalty = resistancePenalty(drop.into);
  if (!penalty) return null;
  const target = GUIDES[0]?.check.elemental;
  const where = resistanceCard(drop.into);
  const aim = typeof target === "number" ? ` Mira tu hoja: apunta a un ${target} % en fuego, hielo y rayo.` : " Mira tu hoja de personaje.";
  return `${where}: la penalización de resistencias es ya de ${penalty}.${aim}`;
}

export const NEW_RUN: Run = {
  progress: START,
  visited: [],
  checked: [],
  partial: {},
  bosses: [],
  pickups: [],
  skips: [],
  area: null,
  areaLevel: null,
  charLevel: null,
  className: null,
  hears: false,
  leftBehind: null,
  resistDrop: null,
};

const LEFT_BEHIND_ZONES = 3;
/** El pueblo, la primera zona y la segunda: lo justo para verlo y mirar la hoja. */
const RESIST_DROP_ZONES = 3;

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
export function missedRewards(
  run: Pick<Run, "visited" | "checked" | "hears"> & Partial<Pick<Run, "partial">>,
  act: number,
): LeftBehind["items"] {
  const visited = new Set(run.visited);
  return routeOf(act).flatMap((step, index) => {
    if (step.priority !== "clave" || !step.reward) return [];
    if (run.checked.includes(stepKey(act, index))) return [];
    const stepped = codesOfStep(act, index).some((code) => visited.has(code));
    if (stepped && !wouldBeKnown(run, act, step.zone)) return [];
    // A medias (dos tatuajes de tres) se dice cuántas lleva: no es lo mismo que no tener ninguna.
    const got = run.partial?.[stepKey(act, index)] ?? 0;
    const times = REWARD_RULES[act]?.[step.zone]?.times ?? 1;
    const reward = times > 1 && got > 0 ? `${step.reward}: llevas ${Math.min(got, times)} de ${times}` : step.reward;
    return [{ zone: step.zone, reward }];
  });
}

/**
 * ¿Está hecho todo lo que se puede comprobar de ese paso (recompensa cogida,
 * jefe vencido)? Null si el paso no tiene nada que comprobar. Los jefes que no
 * hablan no cuentan aquí: una casilla a mano que se olvida no debe mover la guía.
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
 * Entrar en una zona que solo se abre con todos los objetos de un grupo los da
 * por cogidos: nadie pisa Punta del botín sin los cuatro trozos de mapa. Caso
 * real (25-11-2026): con la isla ya hecha seguía diciendo «llevas 1 marcado».
 */
function provenPickups(had: string[], act: number | null, code: string): string[] {
  if (act === null) return had;
  const groups = stepsForCode(act, code).flatMap((index) => NEEDS_PICKUPS[act]?.[routeOf(act)[index]!.zone] ?? []);
  if (groups.length === 0) return had;
  const missing = routeOf(act).flatMap((step, index) => {
    const group = PICKUPS[act]?.[step.zone]?.group;
    return group !== undefined && groups.includes(group) && !had.includes(stepKey(act, index)) ? [stepKey(act, index)] : [];
  });
  return missing.length > 0 ? [...had, ...missing] : had;
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

  // Al dejar un acto (pasar al siguiente, o de un interludio al otro), se mira
  // qué recompensa para siempre se quedó atrás.
  // En los actos, «llegar» es que la guía cambie de acto. En los interludios el
  // pueblo no mueve la guía, así que «llegar» es pisar por primera vez
  // cualquier zona suya (el pueblo, casi siempre): se avisa una vez y de lo
  // que quedó en el tramo de justo antes.
  const firstOfItsAct = act !== null && !run.visited.some((seen) => actOfCode(seen) === act);
  const leftAct =
    act === null || act <= run.progress.act
      ? null
      : act <= LAST_STORY_ACT
        ? run.progress.act
        : firstOfItsAct
          ? act - 1
          : null;
  let leftBehind = run.leftBehind
    ? run.leftBehind.zonesLeft > 1
      ? { ...run.leftBehind, zonesLeft: run.leftBehind.zonesLeft - 1 }
      : null
    : null;
  if (leftAct !== null) {
    // De un tramo que el registro no vio (se cortó, otro equipo) no se afirma nada.
    const known = leftAct < LAST_STORY_ACT || actSeen({ visited }, leftAct);
    const items = known ? missedRewards({ visited, checked: run.checked, hears: run.hears, partial: run.partial }, leftAct) : [];
    leftBehind = items.length > 0 ? { act: leftAct, items, zonesLeft: LEFT_BEHIND_ZONES } : null;
  }
  // Y se avisa de cuánto baja la resistencia en el acto al que llega: es
  // cuando un novato empieza a morir sin saber por qué. Dura unas zonas.
  let resistDrop = run.resistDrop
    ? run.resistDrop.zonesLeft > 1
      ? { ...run.resistDrop, zonesLeft: run.resistDrop.zonesLeft - 1 }
      : null
    : null;
  if (leftAct !== null && act !== null) {
    resistDrop = resistancePenalty(act) ? { into: act, zonesLeft: RESIST_DROP_ZONES } : null;
  }
  // El nivel de un pueblo no dice nada de lo duro que es el acto.
  const areaLevel = /_town$/i.test(code) || act === null ? run.areaLevel : level;
  const pickups = provenPickups(run.pickups ?? [], act, code);
  return { ...run, progress, visited, pickups, area: normalizeCode(code), areaLevel, leftBehind, resistDrop };
}

/**
 * El juego dice que recibiste una recompensa para siempre: se marca sola la
 * del paso al que corresponde, en el acto donde estás. Si hay dos pasos con
 * la misma (dos libros de 2 puntos), gana el de la zona donde estás; si no,
 * el primero que ya pisaste.
 */
export function onReward(run: Run, kind: RewardKind): Run {
  const area = run.area;
  const areaAct = area ? actOfCode(area) : null;
  if (!area || areaAct === null) return run;
  const visited = new Set(run.visited);
  const openIn = (act: number) =>
    routeOf(act).flatMap((step, index) => {
      const rule = REWARD_RULES[act]?.[step.zone];
      if (!rule || !step.reward || run.checked.includes(stepKey(act, index))) return [];
      return [{ act, index, rule, codes: codesOfStep(act, index) }];
    });
  // Lo que se entrega en el pueblo de otro acto: los 2 puntos del final de los
  // interludios los da El Encapuchado en Marca del rey. Solo si ya pisaste la
  // zona de ese paso; si no, el mensaje es de un paso del acto donde estás.
  const elsewhere = Array.from({ length: LAST_ACT - FIRST_ACT + 1 }, (_, offset) => FIRST_ACT + offset)
    .filter((act) => act !== areaAct)
    .flatMap(openIn)
    .find(
      (item) => item.rule.kinds?.includes(kind) && item.rule.where?.includes(area) && item.codes.some((code) => visited.has(code)),
    );
  const open = elsewhere ? [] : openIn(areaAct);
  const sameKind = open.filter((item) => item.rule.kinds?.includes(kind));
  const pick =
    elsewhere ??
    sameKind.find((item) => item.codes.includes(area) || item.rule.where?.includes(area)) ??
    sameKind.find((item) => item.codes.some((code) => visited.has(code))) ??
    sameKind[0] ??
    (kind === "puntos" ? undefined : open.find((item) => item.rule.anyIn?.includes(area)));
  if (!pick) return run.hears ? run : { ...run, hears: true };
  const key = stepKey(pick.act, pick.index);
  const times = pick.rule.times ?? 1;
  if (times === 1) return { ...run, hears: true, checked: [...run.checked, key] };
  // Llega en varias entregas (los tres tatuajes): se cuenta cada mensaje y
  // solo el último la da por cogida. Caso real (24-11-2026): con el primer
  // tatuaje la ventanita decía que ya estaban los tres.
  const got = (run.partial[key] ?? 0) + 1;
  const partial = { ...run.partial, [key]: got };
  return { ...run, hears: true, partial, checked: got >= times ? [...run.checked, key] : run.checked };
}

/** Cuántas entregas lleva y cuántas son, si la recompensa del paso llega en varias. */
export function rewardProgress(run: Pick<Run, "partial">, act: number, index: number): { got: number; of: number } | null {
  const times = REWARD_RULES[act]?.[routeOf(act)[index]?.zone ?? ""]?.times ?? 1;
  return times > 1 ? { got: Math.min(run.partial[stepKey(act, index)] ?? 0, times), of: times } : null;
}

/** Se oyó la frase que solo se dice con el jefe de ese paso vencido, y estás en su zona. */
export function onBoss(run: Run, act: number, zone: string): Run {
  const index = routeOf(act).findIndex((step) => step.zone === zone);
  if (index < 0 || !run.area || !codesOfStep(act, index).includes(run.area)) return run;
  const key = stepKey(act, index);
  return run.bosses.includes(key) ? run : { ...run, bosses: [...run.bosses, key] };
}

/**
 * Marca o desmarca a mano el jefe del paso que se ve: el que no habla (no hay
 * otra forma de saberlo) o el que sí, por si el registro no lo dijo.
 */
export function onToggleBoss(run: Run): Run {
  const { act, index } = run.progress;
  if (!bossOf(act, routeOf(act)[index]?.zone ?? "")) return run;
  const key = stepKey(act, index);
  const bosses = run.bosses.includes(key) ? run.bosses.filter((item) => item !== key) : [...run.bosses, key];
  return { ...run, bosses };
}

/**
 * La tecla Fin: marca lo que el paso deja marcar a mano. Si su jefe no habla,
 * el jefe (su recompensa, si la tiene, ya se marca sola); si no, la recompensa.
 * Y si el paso no tiene recompensa, su jefe u objetivo aunque se marque solo:
 * por si el registro no lo dijo (Punta del botín con el juego en inglés).
 * Así se marca sin ratón, también con la ventanita minimizada.
 */
export function onMarkStep(run: Run): Run {
  const { act, index } = run.progress;
  const step = routeOf(act)[index];
  // Sin recompensa ni jefe que marcar, lo único que deja marcar el paso es su opcional.
  if (step?.skip && !step.reward && !bossOf(act, step.zone)) return onToggleSkip(run);
  return SILENT_BOSSES[act]?.[step?.zone ?? ""] || !step?.reward ? onToggleBoss(run) : onToggleReward(run);
}

/**
 * Marca o desmarca a mano el jefe u objetivo opcional del paso que se ve. El
 * registro no dice cuándo caen (no dan nada), así que solo se sabe si lo marca
 * el jugador. Nunca frena la guía: sin marcar, el paso se puede dar por hecho igual.
 */
export function onToggleSkip(run: Run): Run {
  const { act, index } = run.progress;
  if (!routeOf(act)[index]?.skip) return run;
  const key = stepKey(act, index);
  const had = run.skips ?? [];
  return { ...run, skips: had.includes(key) ? had.filter((item) => item !== key) : [...had, key] };
}

/** Marca o desmarca a mano el objeto que se recoge en el paso que se ve (un trozo de mapa). */
export function onTogglePickup(run: Run): Run {
  const { act, index } = run.progress;
  if (!PICKUPS[act]?.[routeOf(act)[index]?.zone ?? ""]) return run;
  const key = stepKey(act, index);
  const had = run.pickups ?? [];
  return { ...run, pickups: had.includes(key) ? had.filter((item) => item !== key) : [...had, key] };
}

/** Cuántos objetos de ese grupo lleva marcados y cuántos son («2 de 4» trozos de mapa). */
export function pickupCount(run: Pick<Run, "pickups">, act: number, group: string): { got: number; of: number } {
  const had = new Set(run.pickups ?? []);
  const steps = routeOf(act).flatMap((step, index) => (PICKUPS[act]?.[step.zone]?.group === group ? [stepKey(act, index)] : []));
  return { got: steps.filter((key) => had.has(key)).length, of: steps.length };
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

/** La ✕ del aviso de resistencias: ya lo ha leído. */
export function onDismissResistNotice(run: Run): Run {
  return run.resistDrop ? { ...run, resistDrop: null } : run;
}

/** La ✕ del aviso «te dejaste…»: ya lo ha leído (las recompensas siguen en el resumen del acto). */
export function onDismissLeftBehind(run: Run): Run {
  return run.leftBehind ? { ...run, leftBehind: null } : run;
}

export function onDismissNotice(run: Run): Run {
  return { ...run, leftBehind: null, resistDrop: null };
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
    partial: Object.fromEntries(
      Object.entries(raw.partial && typeof raw.partial === "object" ? raw.partial : {}).filter(
        (entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) > 0,
      ),
    ),
    bosses: strings(raw.bosses),
    pickups: strings(raw.pickups),
    skips: strings(raw.skips),
    area: typeof raw.area === "string" ? raw.area : null,
    areaLevel: level(raw.areaLevel),
    charLevel: level(raw.charLevel),
    className: typeof raw.className === "string" ? raw.className : null,
    hears: raw.hears === true,
    leftBehind: null,
    resistDrop: null,
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
  /** «1 de 3» cuando llega en varias entregas y ya tiene alguna. */
  partial: string | null;
}

/** «1 de 3», o null si no llega en varias entregas, no tiene ninguna o ya las tiene todas. */
function partialText(run: Pick<Run, "partial">, act: number, index: number): string | null {
  const progress = rewardProgress(run, act, index);
  return progress && progress.got > 0 && progress.got < progress.of ? `${progress.got} de ${progress.of}` : null;
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
  /** `auto`: el registro la marca sola al recibirla; si no, se marca a mano. `partial`: «1 de 3». */
  reward: { text: string; checked: boolean; auto: boolean; partial: string | null } | null;
  /**
   * El jefe de la zona. `auto`: el registro deja saber cuándo cae; si no, se marca a mano.
   * `label`: «Jefe», u «Objetivo» cuando lo que se acaba no es un jefe.
   */
  boss: { name: string; dead: boolean; auto: boolean; label: string } | null;
  /** Lo que se recoge aquí y hace falta más adelante (un trozo de mapa); se marca a mano. `count`: «2 de 4». */
  pickup: { text: string; got: boolean; count: string } | null;
  /** Este paso pide objetos de otros pasos y aún faltan: la frase que lo dice. Si no, null. */
  needs: string | null;
  /** Todo lo que se puede comprobar del paso está hecho: se puede seguir. Null si no hay nada que comprobar. */
  ready: boolean | null;
  /** Gemas sin tallar que la zona da siempre, una frase por gema. */
  gems: string[];
  /** Jefe u objetivo opcional de la zona: no da nada para siempre. */
  skip: string | null;
  /** El jugador ha marcado ese opcional como hecho. */
  skipDone: boolean;
  /** Cosas fijas de la zona que la guía no cuenta (una fosa abisal que siempre está), una frase por línea. */
  notes: string[];
  /** El paso siguiente: la zona y, si la tiene, su recompensa para siempre. */
  next: { zone: string; reward: string | null } | null;
  outside: boolean;
  /** Qué decir en esa única línea de «fuera»: interludio, guarida, mapas… */
  outsideText: string;
  areaLevel: number | null;
  charLevel: number | null;
  level: LevelState | null;
  leftBehind: LeftBehind | null;
  /** «Acto 3: tus resistencias bajan a −20 %…», recién cambiado de acto; si no, null. */
  resistances: string | null;
  /** Las recompensas para siempre del acto, para el resumen. */
  rewards: RewardRow[];
  /** Lo que se quedó sin coger en los actos anteriores. */
  missedBefore: Array<{ act: number; zone: string; reward: string }>;
  /** Actos anteriores de los que el registro no dice nada: de esos no se afirma que falte algo. */
  unseenActs: number[];
}

/**
 * ¿Pisó este personaje alguna zona de ese acto, que se sepa? Si el registro no
 * tiene nada de un acto (se jugó en otro equipo, se borró Client.txt), decir
 * «te falta» de todas sus recompensas sería inventárselo.
 */
export function actSeen(run: Pick<Run, "visited">, act: number): boolean {
  const visited = new Set(run.visited);
  return routeOf(act).some((_, index) => codesOfStep(act, index).some((code) => visited.has(code)));
}

/**
 * Dónde está el jugador cuando no está en la campaña (actos e interludios),
 * dicho con sus palabras.
 */
export function outsideSentence(code: string | null): string {
  if (code && /^Hideout/i.test(code)) return "En tu guarida";
  if (code && /^Map/i.test(code)) return "En mapas";
  return "Fuera de la campaña";
}

/** «1», «1 y 2», «1, 2 y 3». */
const numberList = (numbers: number[]) =>
  numbers.length <= 1 ? numbers.join("") : `${numbers.slice(0, -1).join(", ")} y ${numbers.at(-1)}`;

/**
 * «Del acto 1 no vi nada…» / «De los actos 1, 2 y 3 no vi nada…» / «De los
 * actos 3 y 4 y del interludio 1 no vi nada…».
 */
export function unseenSentence(acts: number[]): string {
  if (acts.length === 0) return "";
  const story = acts.filter((act) => interludeOf(act) === null);
  const interludes = acts.flatMap((act) => interludeOf(act) ?? []);
  const parts = [
    story.length === 0 ? "" : `de${story.length === 1 ? "l acto" : " los actos"} ${numberList(story)}`,
    interludes.length === 0 ? "" : `de${interludes.length === 1 ? "l interludio" : " los interludios"} ${numberList(interludes)}`,
  ].filter(Boolean);
  const list = parts.join(" y ");
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} no vi nada en el registro: no sé qué te falta de ahí.`;
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
    const partial = state === "cogida" ? null : partialText(run, act, index);
    return [{ zone: step.zone, reward: step.reward, state, optional: step.optional === true, partial }];
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
  const earlierActs = Array.from({ length: progress.act - FIRST_ACT }, (_, offset) => FIRST_ACT + offset);
  const reward = step.reward
    ? {
        text: step.reward,
        checked: run.checked.includes(key),
        auto: REWARD_RULES[progress.act]?.[step.zone] !== undefined,
        partial: run.checked.includes(key) ? null : partialText(run, progress.act, progress.index),
      }
    : null;
  const known = bossOf(progress.act, step.zone);
  const boss = known ? { ...known, dead: run.bosses.includes(key) } : null;
  const toPick = PICKUPS[progress.act]?.[step.zone];
  const picked = toPick ? pickupCount(run, progress.act, toPick.group) : null;
  const pickup = toPick && picked
    ? { text: toPick.text, got: (run.pickups ?? []).includes(key), count: `${picked.got} de ${picked.of}` }
    : null;
  const neededGroup = NEEDS_PICKUPS[progress.act]?.[step.zone];
  const needed = neededGroup ? pickupCount(run, progress.act, neededGroup) : null;
  const needs =
    needed && needed.got < needed.of
      ? `Esta isla solo se abre con los ${needed.of} trozos de mapa: llevas ${needed.got} marcado${needed.got === 1 ? "" : "s"}.`
      : null;
  // Lo que se marca a mano no frena la guía (volver a una zona sigue eligiendo
  // bien el paso), pero «puedes seguir» no se dice con el trozo sin coger ni
  // con el jefe que no habla sin marcar.
  const checkable = stepReady(run, progress.act, progress.index);
  const byHand = [...(pickup ? [pickup.got] : []), ...(boss && !boss.auto ? [boss.dead] : [])];
  const checked = byHand.length > 0 ? (checkable ?? true) && byHand.every(Boolean) : checkable;
  // El opcional marcado es lo único que hay que hacer en un paso sin nada más que comprobar:
  // entonces la zona está hecha. Sin marcar no cuenta: es opcional.
  const skipDone = Boolean(step.skip) && (run.skips ?? []).includes(key);
  const ready = checked === null && skipDone ? true : checked;
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
    pickup,
    needs,
    ready,
    gems: step.gems ?? [],
    skip: step.skip ?? null,
    skipDone,
    notes: ZONE_NOTES[progress.act]?.[step.zone] ?? [],
    next: nextStep ? { zone: nextStep.zone, reward: nextStep.reward ?? null } : null,
    outside: progress.outside,
    outsideText: outsideSentence(run.area),
    areaLevel: run.areaLevel,
    charLevel: run.charLevel,
    level: levelState(run.areaLevel, run.charLevel),
    leftBehind: run.leftBehind,
    resistances: resistanceNotice(run.resistDrop),
    rewards: rewardRows(run, progress.act),
    missedBefore: earlierActs
      .filter((act) => actSeen(run, act))
      .flatMap((act) => missedRewards(run, act).map((item) => ({ act, ...item }))),
    unseenActs: earlierActs.filter((act) => !actSeen(run, act)),
  };
}
