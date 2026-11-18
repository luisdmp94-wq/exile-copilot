import type { Item } from "@shared/domain.js";
import type { ActGuide, GuideRouteStep } from "../guides/guide";
import { resistancesFromItems } from "./guideCheck";
import { itemSpirit } from "./itemCompare";

/**
 * «¿Me he saltado algo?»
 *
 * La web no ve la partida, pero cada recompensa permanente deja huella en un
 * número que el juego sí enseña. Con el equipo pegado y esos números se hace
 * la resta: si la hoja de personaje dice 10 puntos más de hielo de los que da
 * el equipo, Beira está hecha. Lo que no deja huella en un número se pregunta.
 *
 * Solo afirma lo que la resta sostiene. Si no cuadra (resistencias en el árbol
 * de pasivas, equipo a medias), lo dice en vez de inventar un resultado.
 */

export type RewardStatus = "ok" | "missing" | "unsure" | "ask";

export interface RewardLine {
  zone: string;
  reward: string;
  status: RewardStatus;
  text: string;
  /** Solo en las que se preguntan: la pregunta para el jugador. */
  question?: string;
}

export interface RewardCheckInput {
  /** Piezas de equipo pegadas. */
  items: readonly Item[];
  /** Cuántos huecos de equipo revisa la guía, para saber si el equipo está entero. */
  expectedPieces: number;
  /**
   * Acto en el que está ahora el personaje. null = aún no lo ha dicho: no se
   * supone, porque al cambiar de acto el juego quita resistencias y la misma
   * cifra significa «la tienes» o «te falta» según dónde esté.
   */
  currentAct: number | null;
  /** Resistencias de la hoja de personaje (tecla C). null = no la ha dicho. */
  sheetResistance: Partial<Record<"fire" | "cold" | "lightning", number | null>>;
  /** Espíritu máximo de la hoja. */
  sheetSpirit: number | null;
  /** Total de puntos de pasiva de set de armas que enseña el árbol. */
  weaponSetPoints: number | null;
  /** Respuestas a las recompensas que solo se pueden preguntar, por zona. */
  answers: Readonly<Record<string, boolean | undefined>>;
}

/** Penalización de resistencias elementales según el acto en el que se está. */
const ACT_PENALTY: Record<number, number> = { 1: 0, 2: 10, 3: 20, 4: 30 };

export type RewardLang = "es" | "en";

const REWARD_WORDS = {
  es: {
    element: { fire: "fuego", cold: "hielo", lightning: "rayo" },
    or: " o ",
    pasteGear: "Pega primero tu equipo en la comprobación de arriba: sin él no puedo hacer la resta.",
    noTrace: "Esto no deja huella en ningún número: solo puedes decírmelo tú.",
    doneSaid: "Hecho, según me dices.",
    missingAt: (zone: string) => `Te falta. Está en ${zone}.`,
    tellRes: (label: string) => `Dime qué resistencia al ${label} pone tu hoja de personaje (tecla C) y hago la resta.`,
    tellAct: (act: number, penalty: number) =>
      `Dime primero, arriba, si sigues en el acto ${act} o ya has pasado al ${act + 1}. Al cambiar de acto el juego te quita ${penalty} puntos de resistencia y la resta sale distinta.`,
    resSum: (gear: number, act: number | null, penalty: number, sheet: number) =>
      `Tu equipo da ${gear} %${penalty > 0 ? `, el acto ${act} te quita ${penalty}` : ""} y tu hoja dice ${sheet} %.`,
    partialRes: (label: string) => ` Pero no has pegado todo el equipo, así que la resta no vale: puede faltar una pieza con ${label}.`,
    extraIsReward: (amount: number) => ` Los ${amount} que sobran son esta recompensa.`,
    nothingExtra: (zone: string) => ` No sobra nada: te falta. Está en ${zone}.`,
    maybeNextAct: (next: number, penalty: number) =>
      ` Ojo: si ya has entrado en el acto ${next}, márcalo arriba. El juego te habrá quitado ${penalty} puntos y entonces sí la tienes.`,
    oddRes: (extra: number, amount: number, label: string) =>
      ` La diferencia es de ${extra} y no cuadra con ${amount}: puede que lleves ${label} en el árbol de pasivas o que una pieza no sea la que llevas puesta. No puedo asegurarlo.`,
    tellSpirit: "Dime tu espíritu máximo (hoja de personaje, tecla C) y hago la resta.",
    spiritSum: (gear: number, sheet: number) => `Tu equipo da ${gear} de espíritu y tu hoja dice ${sheet}.`,
    partial: " Pero no has pegado todo el equipo, así que la resta no vale.",
    spiritThere: (amount: number) => ` Los ${amount} de esta recompensa están ahí.`,
    spiritEarlier: (amount: number) => ` De lo que sobra, ${amount} son de recompensas de actos anteriores.`,
    oddSpirit: (extra: number, amount: number) =>
      ` Sobran ${extra}, que no llega a ${amount}: no puedo asegurarlo. Mira que el cetro pegado sea el que llevas.`,
    tellPoints: "Dime cuántos puntos de set de armas tienes en total (árbol de pasivas, tecla P, arriba a la derecha).",
    pointsSum: (points: number, expected: number) => `Tienes ${points} y con los libros hasta aquí serían ${expected}.`,
    bookUsed: " Este libro está cogido y usado.",
    bookMissing: (zone: string) => ` Te falta. Está en ${zone}. Si tienes el libro en el inventario, úsalo: sin usarlo no cuenta.`,
    bookUnknown: (places: string) => ` Te falta un libro, pero no sé cuál: es el de ${places}. Si lo tienes en el inventario sin usar, úsalo.`,
  },
  en: {
    element: { fire: "fire", cold: "cold", lightning: "lightning" },
    or: " or ",
    pasteGear: "Paste your gear in the check above first: without it I can't do the subtraction.",
    noTrace: "This doesn't show up in any number: only you can tell me.",
    doneSaid: "Done, according to you.",
    missingAt: (zone: string) => `You're missing it. It's in ${zone}.`,
    tellRes: (label: string) => `Tell me what ${label} resistance your character sheet shows (C key) and I'll do the subtraction.`,
    tellAct: (act: number, penalty: number) =>
      `First tell me, above, whether you're still in act ${act} or already in act ${act + 1}. When you change act the game takes away ${penalty} resistance points and the subtraction comes out different.`,
    resSum: (gear: number, act: number | null, penalty: number, sheet: number) =>
      `Your gear gives ${gear}%${penalty > 0 ? `, act ${act} takes away ${penalty}` : ""} and your sheet says ${sheet}%.`,
    partialRes: (label: string) => ` But you haven't pasted all your gear, so the subtraction doesn't hold: an item with ${label} may be missing.`,
    extraIsReward: (amount: number) => ` The ${amount} left over are this reward.`,
    nothingExtra: (zone: string) => ` Nothing is left over: you're missing it. It's in ${zone}.`,
    maybeNextAct: (next: number, penalty: number) =>
      ` Careful: if you've already entered act ${next}, mark it above. The game will have taken away ${penalty} points, and then you do have it.`,
    oddRes: (extra: number, amount: number, label: string) =>
      ` The difference is ${extra} and doesn't match ${amount}: you may have ${label} on your passive tree, or an item may not be the one you're wearing. I can't be sure.`,
    tellSpirit: "Tell me your maximum spirit (character sheet, C key) and I'll do the subtraction.",
    spiritSum: (gear: number, sheet: number) => `Your gear gives ${gear} spirit and your sheet says ${sheet}.`,
    partial: " But you haven't pasted all your gear, so the subtraction doesn't hold.",
    spiritThere: (amount: number) => ` The ${amount} from this reward are there.`,
    spiritEarlier: (amount: number) => ` Of what's left over, ${amount} come from earlier acts' rewards.`,
    oddSpirit: (extra: number, amount: number) =>
      ` ${extra} are left over, which isn't ${amount}: I can't be sure. Check that the sceptre you pasted is the one you're using.`,
    tellPoints: "Tell me how many weapon set points you have in total (passive tree, P key, top right).",
    pointsSum: (points: number, expected: number) => `You have ${points}, and with the books up to here it would be ${expected}.`,
    bookUsed: " This book is picked up and used.",
    bookMissing: (zone: string) => ` You're missing it. It's in ${zone}. If you have the book in your inventory, use it: it doesn't count until you do.`,
    bookUnknown: (places: string) => ` You're missing a book, but I don't know which one: it's the one from ${places}. If it's in your inventory unused, use it.`,
  },
} as const;

/** Margen para redondeos: una resistencia puede bailar un punto. */
const TOLERANCE = 2;

function claveSteps(guide: ActGuide): GuideRouteStep[] {
  return (guide.route ?? []).filter((step) => step.priority === "clave" && step.proof);
}

function spiritOf(guide: ActGuide): number {
  return claveSteps(guide).reduce((total, step) => total + (step.proof?.kind === "spirit" ? step.proof.amount : 0), 0);
}

function weaponSetPointsOf(guide: ActGuide): number {
  return claveSteps(guide).reduce(
    (total, step) => total + (step.proof?.kind === "weaponSetPoints" ? step.proof.amount : 0),
    0,
  );
}

function gearNote(input: RewardCheckInput, lang: RewardLang): string | null {
  if (input.items.length === 0) return REWARD_WORDS[lang].pasteGear;
  return null;
}

/**
 * Comprueba las recompensas permanentes de `guide`. `earlier` son las guías
 * de los actos anteriores: hacen falta para la cuenta acumulada de puntos.
 */
export function checkRewards(
  guide: ActGuide,
  earlier: readonly ActGuide[],
  input: RewardCheckInput,
  lang: RewardLang = "es",
): RewardLine[] {
  const w = REWARD_WORDS[lang];
  const steps = claveSteps(guide);
  const penalty = input.currentAct === null ? 0 : (ACT_PENALTY[input.currentAct] ?? ACT_PENALTY[4]);
  const nextPenalty = (ACT_PENALTY[guide.act + 1] ?? ACT_PENALTY[4]) - (ACT_PENALTY[guide.act] ?? 0);
  const gear = resistancesFromItems([...input.items]);
  const partialGear = input.items.length < input.expectedPieces;
  const lines: RewardLine[] = [];

  // Puntos de set de armas: una sola cuenta para todos los libros del acto.
  const before = earlier.reduce((total, other) => total + weaponSetPointsOf(other), 0);
  const expectedPoints = before + weaponSetPointsOf(guide);
  const bookSteps = steps.filter((step) => step.proof?.kind === "weaponSetPoints");
  const bookSize = bookSteps[0]?.proof?.kind === "weaponSetPoints" ? bookSteps[0].proof.amount : 2;
  const points = input.weaponSetPoints;
  const missingBooks =
    points === null ? 0 : Math.min(bookSteps.length, Math.max(0, Math.ceil((expectedPoints - points) / bookSize)));
  const bookPlaces = bookSteps.map((step) => step.zone).join(w.or);

  for (const step of steps) {
    const proof = step.proof!;
    const reward = step.reward ?? step.zone;

    if (proof.kind === "manual") {
      const answer = input.answers[step.zone];
      lines.push({
        zone: step.zone,
        reward,
        status: answer === undefined ? "ask" : answer ? "ok" : "missing",
        question: proof.question,
        text:
          answer === undefined
            ? w.noTrace
            : answer
              ? w.doneSaid
              : w.missingAt(step.zone),
      });
      continue;
    }

    if (proof.kind === "resistance") {
      const label = w.element[proof.element];
      const sheet = input.sheetResistance[proof.element];
      const note = gearNote(input, lang);
      if (sheet === null || sheet === undefined || note) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: note ?? w.tellRes(label),
        });
        continue;
      }
      if (input.currentAct === null) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: w.tellAct(guide.act, nextPenalty),
        });
        continue;
      }
      const fromGear = gear[proof.element] ?? 0;
      const extra = sheet - (fromGear - penalty);
      const sum = w.resSum(fromGear, input.currentAct, penalty, sheet);
      if (partialGear) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `${sum}${w.partialRes(label)}`,
        });
      } else if (Math.abs(extra - proof.amount) <= TOLERANCE) {
        lines.push({ zone: step.zone, reward, status: "ok", text: `${sum}${w.extraIsReward(proof.amount)}` });
      } else if (Math.abs(extra) <= TOLERANCE) {
        lines.push({
          zone: step.zone,
          reward,
          status: "missing",
          text:
            `${sum}${w.nothingExtra(step.zone)}` +
            // El error más fácil: haber cambiado ya de acto y no haberlo dicho.
            (input.currentAct === guide.act
              ? w.maybeNextAct(guide.act + 1, nextPenalty)
              : ""),
        });
      } else {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `${sum}${w.oddRes(extra, proof.amount, label)}`,
        });
      }
      continue;
    }

    if (proof.kind === "spirit") {
      const note = gearNote(input, lang);
      if (input.sheetSpirit === null || note) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: note ?? w.tellSpirit,
        });
        continue;
      }
      const fromGear = input.items.reduce((total, item) => total + itemSpirit(item), 0);
      // El espíritu de actos anteriores también sobra en la resta: se descuenta.
      const spiritBefore = earlier.reduce((total, other) => total + spiritOf(other), 0);
      const extra = input.sheetSpirit - fromGear - spiritBefore;
      const sum =
        w.spiritSum(fromGear, input.sheetSpirit) + (spiritBefore > 0 ? w.spiritEarlier(spiritBefore) : "");
      if (partialGear) {
        lines.push({ zone: step.zone, reward, status: "unsure", text: `${sum}${w.partial}` });
      } else if (extra >= proof.amount) {
        lines.push({ zone: step.zone, reward, status: "ok", text: `${sum}${w.spiritThere(proof.amount)}` });
      } else if (extra <= 0) {
        lines.push({ zone: step.zone, reward, status: "missing", text: `${sum}${w.nothingExtra(step.zone)}` });
      } else {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `${sum}${w.oddSpirit(extra, proof.amount)}`,
        });
      }
      continue;
    }

    // weaponSetPoints
    if (points === null) {
      lines.push({
        zone: step.zone,
        reward,
        status: "unsure",
        text: w.tellPoints,
      });
      continue;
    }
    const sum = w.pointsSum(points, expectedPoints);
    if (missingBooks === 0) {
      lines.push({ zone: step.zone, reward, status: "ok", text: `${sum}${w.bookUsed}` });
    } else if (missingBooks >= bookSteps.length) {
      lines.push({
        zone: step.zone,
        reward,
        status: "missing",
        text: `${sum}${w.bookMissing(step.zone)}`,
      });
    } else {
      // Falta alguno, pero la cuenta no dice cuál.
      lines.push({
        zone: step.zone,
        reward,
        status: "unsure",
        text: `${sum}${w.bookUnknown(bookPlaces)}`,
      });
    }
  }
  return lines;
}

/** Qué números hay que pedirle al jugador para comprobar esta guía. */
export function rewardInputsNeeded(guide: ActGuide): {
  resistances: Array<"fire" | "cold" | "lightning">;
  spirit: boolean;
  weaponSetPoints: boolean;
} {
  const steps = claveSteps(guide);
  const resistances = steps.flatMap((step) => (step.proof?.kind === "resistance" ? [step.proof.element] : []));
  return {
    resistances: [...new Set(resistances)],
    spirit: steps.some((step) => step.proof?.kind === "spirit"),
    weaponSetPoints: steps.some((step) => step.proof?.kind === "weaponSetPoints"),
  };
}
