/**
 * El texto de un paso, troceado para leerlo de un vistazo mientras se juega:
 * una frase por línea, y el tipo de daño del jefe («pega con rayo») marcado
 * para pintarlo de su color. No cambia ni una palabra de la guía.
 */

export type Element = "fuego" | "hielo" | "rayo" | "caos" | "fisico";

export interface StepPiece {
  text: string;
  /** Si el trozo es un tipo de daño que te pega: se pinta de su color. */
  element?: Element;
}

/** Los tipos de daño, como los escribe la guía. «rayos» o «fuegos» no cuentan. */
const TYPE = "(?:fuego|hielo|rayo|caos|físico)(?!\\p{L})";
/** Uno o varios seguidos: «rayo», «fuego y hielo», «físico, fuego y caos». */
const LIST = `${TYPE}(?:(?:,\\s*|\\s+y\\s+)${TYPE})*`;
/** «Pega con rayo», «pegan con fuego y hielo», «daño de caos», «pega con todo: físico, fuego…». */
const HITS_WITH = new RegExp(`(?<!\\p{L})(?:pega|pegan|golpea|golpean|daño)\\s+(?:con|de)\\s+(?:todo:\\s+)?(${LIST})`, "giu");
/**
 * El segundo jefe de la misma frase, sin repetir el verbo: «Isolde pega con
 * hielo y Heldra, de la pira negra, con fuego». Solo vale detrás de un «pega con».
 */
const ALSO_WITH = new RegExp(`(?<!\\p{L})con\\s+(${LIST})`, "giu");
const TYPE_WORD = new RegExp(TYPE, "giu");

const ELEMENT_OF: Record<string, Element> = { fuego: "fuego", hielo: "hielo", rayo: "rayo", caos: "caos", físico: "fisico" };

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

const plain = (text: string) => text.trim().replace(/[.!…]+$/u, "").replace(/^jefe:\s*/iu, "").toLowerCase();

/**
 * El texto sin la frase que solo nombra al jefe («Benedictus, Primer heraldo de
 * Utopía.» o «Jefe: el rey del óxido.»): con la línea «Jefe:» encima, repetirlo
 * es una línea de más. Si no quedara nada más que decir, se deja como estaba.
 */
export function withoutBossName(text: string, boss: string): string {
  const sentences = stepSentences(text);
  const rest = sentences.filter((sentence) => plain(sentence) !== plain(boss));
  return rest.length > 0 && rest.length < sentences.length ? rest.join(" ") : text;
}

/** Dónde empieza y acaba cada lista de tipos de daño de la frase, en orden. */
function damageLists(sentence: string): Array<{ start: number; end: number }> {
  const lists: Array<{ start: number; end: number }> = [];
  const add = (match: RegExpMatchArray) => {
    const end = match.index! + match[0].length;
    const start = end - match[1]!.length;
    if (!lists.some((list) => list.start === start)) lists.push({ start, end });
  };
  const hits = [...sentence.matchAll(HITS_WITH)];
  hits.forEach(add);
  const first = hits[0];
  if (first) {
    const after = first.index! + first[0].length;
    for (const match of sentence.matchAll(ALSO_WITH)) if (match.index! >= after) add(match);
  }
  return lists.sort((a, b) => a.start - b.start);
}

/** Una frase en trozos: texto corriente y, aparte, cada tipo de daño que te pega. */
export function sentencePieces(sentence: string): StepPiece[] {
  const pieces: StepPiece[] = [];
  let from = 0;
  for (const list of damageLists(sentence)) {
    for (const hit of sentence.slice(list.start, list.end).matchAll(TYPE_WORD)) {
      const start = list.start + hit.index!;
      if (start > from) pieces.push({ text: sentence.slice(from, start) });
      pieces.push({ text: hit[0], element: ELEMENT_OF[hit[0].toLowerCase()]! });
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
