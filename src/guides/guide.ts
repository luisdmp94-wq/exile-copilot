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

export interface ActGuide {
  slug: string;
  actLabel: string;
  title: string;
  summary: string;
  status: "borrador" | "revisada";
  /** Parche contra el que se comprobaron los datos. */
  checkedPatch: string;
  checkedOn: string;
  readMinutes: number;
  /** «Lo esencial»: cuatro líneas que bastan si no lees nada más. */
  essentials: GuideTip[];
  blocks: GuideBlock[];
  sources: GuideSource[];
  check: GuideCheckTargets;
}
