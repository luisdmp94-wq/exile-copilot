import type { LogEvent } from "./clientLog";
import { NEW_RUN, onArea, onBoss, onLevel, onReward, type Run } from "./run";

/**
 * Una partida por personaje. Client.txt no dice con quién entras, pero sí
 * nombra al personaje cuando sube de nivel o recibe una recompensa, y marca
 * cada vez que se vuelve a la pantalla de entrada. Con eso:
 *
 * - Tras entrar al juego no se sabe quién juega. Se sigue enseñando la
 *   partida de antes y se apunta lo que pasa.
 * - En cuanto sale un nombre: si es el mismo, se confirma; si es otro
 *   personaje tuyo, lo apuntado desde que entraste pasa a su partida y la del
 *   anterior queda como estaba.
 * - Los demás jugadores (los que el registro dice que se unen o salen de tu
 *   zona) no cuentan: ni su nivel ni sus recompensas. De ellos solo se guarda
 *   una huella del nombre, no el nombre.
 *
 * Puro: cada evento devuelve un estado nuevo.
 */

export interface Roster {
  /** Personaje al que se le apuntan los eventos; null si nunca se ha visto su nombre. */
  current: string | null;
  /** La partida que se ve. */
  run: Run;
  /** Las partidas de tus otros personajes. */
  runs: Record<string, Run>;
  /** Huellas de otros jugadores vistos. */
  others: string[];
  /** Desde que se entró al juego no se sabe quién juega: quién era, su partida entonces y lo ocurrido desde entonces. */
  unsure: { name: string | null; run: Run; events: LogEvent[] } | null;
  /** De qué personaje se vino en el último cambio, por si el nombre nuevo resulta ser de otro jugador. */
  cameFrom: string | null;
}

export const EMPTY_ROSTER: Roster = { current: null, run: NEW_RUN, runs: {}, others: [], unsure: null, cameFrom: null };

const MAX_OTHERS = 400;
const MAX_EVENTS = 300;

/** Huella corta de un nombre (FNV-1a): para recordar a otro jugador sin guardar cómo se llama. */
export function nameId(name: string): string {
  let hash = 0x811c9dc5;
  for (const char of name.toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Un evento del juego sobre una partida. `guessNew`: mientras no se sabe quién
 * juega, la orilla del río desde un acto posterior se toma por personaje nuevo.
 */
function step(run: Run, event: LogEvent, guessNew: boolean): Run {
  switch (event.kind) {
    case "area":
      return onArea(run, event.code, event.level, guessNew);
    case "level":
      return onLevel(run, event.level, event.className);
    case "reward":
      return onReward(run, event.reward);
    case "boss":
      return onBoss(run, event.act, event.zone);
    default:
      return run;
  }
}

/** Apunta el evento en la partida que se ve y, si aún no se sabe quién juega, lo recuerda. */
function here(roster: Roster, event: LogEvent): Roster {
  const unsure = roster.unsure ? { ...roster.unsure, events: [...roster.unsure.events, event].slice(-MAX_EVENTS) } : null;
  return { ...roster, run: step(roster.run, event, roster.unsure !== null || roster.current === null), unsure };
}

/** Lo ocurrido desde que se entró al juego, apuntado a la partida de quien resultó ser. */
const replay = (events: LogEvent[], onto: Run) => events.reduce((run, event) => step(run, event, false), onto);

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** Lo andado bajo un nombre equivocado vuelve a la partida de verdad. El nivel no: era el del otro. */
function mergeRuns(mine: Run, strayed: Run): Run {
  return {
    ...strayed,
    visited: union(mine.visited, strayed.visited),
    checked: union(mine.checked, strayed.checked),
    // Las entregas de una misma recompensa se suman: unas cayeron bajo un nombre y otras bajo el otro.
    partial: Object.fromEntries(
      union(Object.keys(mine.partial), Object.keys(strayed.partial)).map((key) => [
        key,
        (mine.partial[key] ?? 0) + (strayed.partial[key] ?? 0),
      ]),
    ),
    bosses: union(mine.bosses, strayed.bosses),
    charLevel: mine.charLevel,
    className: mine.className,
    hears: mine.hears || strayed.hears,
  };
}

function without(runs: Record<string, Run>, name: string | null): Record<string, Run> {
  if (name === null || !(name in runs)) return runs;
  return Object.fromEntries(Object.entries(runs).filter(([key]) => key !== name));
}

const addOther = (others: string[], id: string) => (others.includes(id) ? others : [...others, id].slice(-MAX_OTHERS));

/** Sale el nombre de un personaje (subió de nivel o recibió algo). */
function named(roster: Roster, name: string, event: LogEvent): Roster {
  if (roster.others.includes(nameId(name))) return roster;

  if (roster.unsure) {
    const { name: was, run: before, events } = roster.unsure;
    // Un personaje que llega a nivel 2 acaba de nacer, aunque repita el nombre de uno borrado.
    const newborn = event.kind === "level" && event.level <= 2;
    if (was === null) return here({ ...roster, current: name, unsure: null }, event);
    if (was === name) {
      // Era el mismo: lo andado se apunta sobre su partida de antes, ya sin adivinar.
      return here({ ...roster, run: replay(events, newborn ? NEW_RUN : before), unsure: null }, event);
    }
    // Otro personaje tuyo: el de antes se guarda como estaba y lo andado desde que entraste es de este.
    const runs = { ...without(roster.runs, name), [was]: before };
    const run = replay(events, newborn ? NEW_RUN : (roster.runs[name] ?? NEW_RUN));
    return here({ ...roster, current: name, run, runs, unsure: null, cameFrom: was }, event);
  }

  if (roster.current === null) return here({ ...roster, current: name }, event);
  if (roster.current === name) return here(roster, event);

  // Otro nombre sin haber vuelto a la pantalla de entrada.
  const known = roster.runs[name];
  if (known) {
    // Es un personaje tuyo: el nombre de ahora era de alguien de tu grupo.
    const cameBack = roster.cameFrom === name;
    return here(
      {
        ...roster,
        current: name,
        run: cameBack ? mergeRuns(known, roster.run) : known,
        runs: cameBack ? without(roster.runs, name) : { ...without(roster.runs, name), [roster.current]: roster.run },
        others: cameBack ? addOther(roster.others, nameId(roster.current)) : roster.others,
        cameFrom: null,
      },
      event,
    );
  }
  // Alguien de tu grupo que ya estaba en la zona: no cuenta.
  return { ...roster, others: addOther(roster.others, nameId(name)) };
}

export function onLog(roster: Roster, event: LogEvent): Roster {
  switch (event.kind) {
    case "login": {
      // Si ya no se sabía quién jugaba, se parte otra vez de la última partida segura.
      const base = roster.unsure ?? { name: roster.current, run: roster.run };
      return { ...roster, run: base.run, unsure: { name: base.name, run: base.run, events: [] } };
    }
    case "other": {
      const others = addOther(roster.others, event.id);
      if (roster.current === null || nameId(roster.current) !== event.id) return { ...roster, others };
      // El que se creía tu personaje era otro jugador: se vuelve al de antes, con lo andado.
      const back = roster.cameFrom;
      const mine = back !== null ? roster.runs[back] : undefined;
      return {
        ...roster,
        others,
        current: back,
        run: mine ? mergeRuns(mine, roster.run) : roster.run,
        runs: without(roster.runs, back),
        cameFrom: null,
      };
    }
    case "level":
      return named(roster, event.name, event);
    case "reward":
      return event.name === null ? here(roster, event) : named(roster, event.name, event);
    default:
      return here(roster, event);
  }
}
