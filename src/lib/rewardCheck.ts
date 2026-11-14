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
const ACT_PENALTY: Record<number, number> = { 1: 0, 2: 10, 3: 20 };

const ELEMENT_LABEL = { fire: "fuego", cold: "hielo", lightning: "rayo" } as const;

/** Margen para redondeos: una resistencia puede bailar un punto. */
const TOLERANCE = 2;

function claveSteps(guide: ActGuide): GuideRouteStep[] {
  return (guide.route ?? []).filter((step) => step.priority === "clave" && step.proof);
}

function weaponSetPointsOf(guide: ActGuide): number {
  return claveSteps(guide).reduce(
    (total, step) => total + (step.proof?.kind === "weaponSetPoints" ? step.proof.amount : 0),
    0,
  );
}

function gearNote(input: RewardCheckInput): string | null {
  if (input.items.length === 0) return "Pega primero tu equipo en la comprobación de arriba: sin él no puedo hacer la resta.";
  return null;
}

/**
 * Comprueba las recompensas permanentes de `guide`. `earlier` son las guías
 * de los actos anteriores: hacen falta para la cuenta acumulada de puntos.
 */
export function checkRewards(guide: ActGuide, earlier: readonly ActGuide[], input: RewardCheckInput): RewardLine[] {
  const steps = claveSteps(guide);
  const penalty = input.currentAct === null ? 0 : (ACT_PENALTY[input.currentAct] ?? ACT_PENALTY[3]);
  const nextPenalty = (ACT_PENALTY[guide.act + 1] ?? ACT_PENALTY[3]) - (ACT_PENALTY[guide.act] ?? 0);
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
  const bookPlaces = bookSteps.map((step) => step.zone).join(" o ");

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
            ? "Esto no deja huella en ningún número: solo puedes decírmelo tú."
            : answer
              ? "Hecho, según me dices."
              : `Te falta. Está en ${step.zone}.`,
      });
      continue;
    }

    if (proof.kind === "resistance") {
      const label = ELEMENT_LABEL[proof.element];
      const sheet = input.sheetResistance[proof.element];
      const note = gearNote(input);
      if (sheet === null || sheet === undefined || note) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: note ?? `Dime qué resistencia al ${label} pone tu hoja de personaje (tecla C) y hago la resta.`,
        });
        continue;
      }
      if (input.currentAct === null) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `Dime primero, arriba, si sigues en el acto ${guide.act} o ya has pasado al ${guide.act + 1}. Al cambiar de acto el juego te quita ${nextPenalty} puntos de resistencia y la resta sale distinta.`,
        });
        continue;
      }
      const fromGear = gear[proof.element] ?? 0;
      const extra = sheet - (fromGear - penalty);
      const sum = `Tu equipo da ${fromGear} %${penalty > 0 ? `, el acto ${input.currentAct} te quita ${penalty}` : ""} y tu hoja dice ${sheet} %.`;
      if (partialGear) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `${sum} Pero no has pegado todo el equipo, así que la resta no vale: puede faltar una pieza con ${label}.`,
        });
      } else if (Math.abs(extra - proof.amount) <= TOLERANCE) {
        lines.push({ zone: step.zone, reward, status: "ok", text: `${sum} Los ${proof.amount} que sobran son esta recompensa.` });
      } else if (Math.abs(extra) <= TOLERANCE) {
        lines.push({
          zone: step.zone,
          reward,
          status: "missing",
          text:
            `${sum} No sobra nada: te falta. Está en ${step.zone}.` +
            // El error más fácil: haber cambiado ya de acto y no haberlo dicho.
            (input.currentAct === guide.act
              ? ` Ojo: si ya has entrado en el acto ${guide.act + 1}, márcalo arriba. El juego te habrá quitado ${nextPenalty} puntos y entonces sí la tienes.`
              : ""),
        });
      } else {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `${sum} La diferencia es de ${extra} y no cuadra con ${proof.amount}: puede que lleves ${label} en el árbol de pasivas o que una pieza no sea la que llevas puesta. No puedo asegurarlo.`,
        });
      }
      continue;
    }

    if (proof.kind === "spirit") {
      const note = gearNote(input);
      if (input.sheetSpirit === null || note) {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: note ?? "Dime tu espíritu máximo (hoja de personaje, tecla C) y hago la resta.",
        });
        continue;
      }
      const fromGear = input.items.reduce((total, item) => total + itemSpirit(item), 0);
      const extra = input.sheetSpirit - fromGear;
      const sum = `Tu equipo da ${fromGear} de espíritu y tu hoja dice ${input.sheetSpirit}.`;
      if (partialGear) {
        lines.push({ zone: step.zone, reward, status: "unsure", text: `${sum} Pero no has pegado todo el equipo, así que la resta no vale.` });
      } else if (extra >= proof.amount) {
        lines.push({ zone: step.zone, reward, status: "ok", text: `${sum} Los ${proof.amount} de esta recompensa están ahí.` });
      } else if (extra <= 0) {
        lines.push({ zone: step.zone, reward, status: "missing", text: `${sum} No sobra nada: te falta. Está en ${step.zone}.` });
      } else {
        lines.push({
          zone: step.zone,
          reward,
          status: "unsure",
          text: `${sum} Sobran ${extra}, que no llega a ${proof.amount}: no puedo asegurarlo. Mira que el cetro pegado sea el que llevas.`,
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
        text: "Dime cuántos puntos de set de armas tienes en total (árbol de pasivas, tecla P, arriba a la derecha).",
      });
      continue;
    }
    const sum = `Tienes ${points} y con los libros hasta aquí serían ${expectedPoints}.`;
    if (missingBooks === 0) {
      lines.push({ zone: step.zone, reward, status: "ok", text: `${sum} Este libro está cogido y usado.` });
    } else if (missingBooks >= bookSteps.length) {
      lines.push({
        zone: step.zone,
        reward,
        status: "missing",
        text: `${sum} Te falta. Está en ${step.zone}. Si tienes el libro en el inventario, úsalo: sin usarlo no cuenta.`,
      });
    } else {
      // Falta alguno, pero la cuenta no dice cuál.
      lines.push({
        zone: step.zone,
        reward,
        status: "unsure",
        text: `${sum} Te falta un libro, pero no sé cuál: es el de ${bookPlaces}. Si lo tienes en el inventario sin usar, úsalo.`,
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
