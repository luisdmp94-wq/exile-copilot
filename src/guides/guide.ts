import type { GuideCheckTargets } from "../lib/guideCheck";

/**
 * Forma de una guía de supervivencia por acto.
 *
 * Cada consejo lleva las fuentes que lo sostienen. Un consejo sin fuente no
 * entra: un dato falso en una guía para novatos hunde la confianza en todo lo
 * demás. `status: "borrador"` muestra el aviso de revisión pendiente.
 */

export interface GuideSource {
  id: string;
  label: string;
  url: string;
}

export interface GuideTip {
  /** Frase corta en negrita al inicio del consejo; opcional. */
  lead?: string;
  text: string;
  sourceIds: string[];
}

export interface GuideBlock {
  id: string;
  title: string;
  intro: string;
  /** Tarjetas cortas (fases de un jefe); se muestran en rejilla. */
  cards?: Array<{ title: string; text: string }>;
  /** Lo que se ve sin desplegar: dos o tres frases cortas como mucho. */
  tips: GuideTip[];
  /** Detalle plegado en «Más detalle», para quien quiera leer más. */
  more?: GuideTip[];
}

/** Un paso de la ruta del acto: una zona y lo que conviene hacer en ella. */
/**
 * Cuánto importa una zona de la ruta:
 * - `clave`: da algo para siempre (resistencia, puntos, espíritu, vida).
 * - `recomendable`: da una recompensa que se agradece, pero no permanente.
 * - `historia`: el juego te lleva allí; no hay nada que decidir.
 */
export type GuideRoutePriority = "clave" | "recomendable" | "historia";

/**
 * Huella que deja una recompensa permanente en un número del juego, para
 * poder comprobar si el jugador la tiene:
 * - `resistance`: suma a una resistencia de la hoja de personaje.
 * - `spirit`: suma al espíritu máximo.
 * - `weaponSetPoints`: suma a los puntos de pasiva de set de armas del árbol.
 * - `manual`: no deja huella en un número; se le pregunta al jugador.
 */
export type GuideRewardProof =
  | { kind: "resistance"; element: "fire" | "cold" | "lightning"; amount: number }
  | { kind: "spirit"; amount: number }
  | { kind: "weaponSetPoints"; amount: number }
  | { kind: "manual"; question: string };

export interface GuideRouteStep {
  zone: string;
  text: string;
  /** Se puede saltar sin bloquear la historia. */
  optional?: boolean;
  priority: GuideRoutePriority;
  /** Solo en las zonas clave: la recompensa permanente, en dos o tres palabras. */
  reward?: string;
  /** Jefe u objetivo opcional de la zona que no da nada para siempre. */
  skip?: string;
  /** Solo en las zonas clave: cómo se nota en el juego que la recompensa está cogida. */
  proof?: GuideRewardProof;
  sourceIds: string[];
}

export interface ActGuide {
  slug: string;
  /** Número del acto: fija la penalización de resistencias y el orden entre guías. */
  act: number;
  actLabel: string;
  title: string;
  summary: string;
  /** Descripción para buscadores (meta description): unos 150 caracteres. */
  description: string;
  status: "borrador" | "revisada";
  /** Parche contra el que se comprobaron los datos. */
  checkedPatch: string;
  checkedOn: string;
  readMinutes: number;
  /** «Lo esencial»: cuatro líneas que bastan si no lees nada más. */
  essentials: GuideTip[];
  /** Zonas del acto en orden, una línea cada una; se pueden ir marcando. */
  route?: GuideRouteStep[];
  blocks: GuideBlock[];
  sources: GuideSource[];
  check: GuideCheckTargets;
}
