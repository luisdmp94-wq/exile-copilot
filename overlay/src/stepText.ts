/**
 * El texto de un paso, troceado para leerlo de un vistazo mientras se juega:
 * una frase por línea, y el tipo de daño del jefe («pega con rayo») marcado
 * para pintarlo de su color. No cambia ni una palabra de la guía.
 */

export type Element = "fuego" | "hielo" | "rayo" | "caos";

export interface StepPiece {
  text: string;
  /** Si el trozo es un tipo de daño que te pega: se pinta de su color. */
  element?: Element;
}

/** «Pega con rayo», «pegan con fuego y hielo», «daño de caos». */
const HITS_WITH = /\b(pega|pegan|golpea|golpean|daño)\s+(con|de)\s+((?:fuego|hielo|rayo|caos)(?:(?:,\s*|\s+y\s+)(?:fuego|hielo|rayo|caos))*)/gi;
const ELEMENT = /fuego|hielo|rayo|caos/gi;

/**
 * Las frases del texto. Solo corta tras un punto, una exclamación o una
 * interrogación seguidos de mayúscula: «nv. 5» o «(2 de 4).» no parten nada.
 */
export function stepSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?…»)])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Una frase en trozos: texto corriente y, aparte, cada tipo de daño que te pega. */
export function sentencePieces(sentence: string): StepPiece[] {
  const pieces: StepPiece[] = [];
  let from = 0;
  for (const match of sentence.matchAll(HITS_WITH)) {
    const listStart = match.index! + match[0].length - match[3]!.length;
    for (const hit of match[3]!.matchAll(ELEMENT)) {
      const start = listStart + hit.index!;
      if (start > from) pieces.push({ text: sentence.slice(from, start) });
      pieces.push({ text: hit[0], element: hit[0].toLowerCase() as Element });
      from = start + hit[0].length;
    }
  }
  if (from < sentence.length) pieces.push({ text: sentence.slice(from) });
  return pieces;
}

/** El paso entero: una lista de frases, cada una en trozos. */
export function stepLines(text: string): StepPiece[][] {
  return stepSentences(text).map(sentencePieces);
}
