/**
 * Nombres de habilidad escritos a mano. El jugador escribe «killing palm» o
 * «drenar esencia»: se guarda como lo escribe el juego («Killing Palm»,
 * «Drenar esencia») para que el resto de la web la reconozca.
 */

/** Sin tildes, sin mayúsculas y con un solo espacio entre palabras. */
function normalizeSkillName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Son la misma habilidad, aunque cambien mayúsculas o tildes? */
export function sameSkillName(a: string, b: string): boolean {
  return normalizeSkillName(a) === normalizeSkillName(b);
}

/**
 * El nombre tal como lo escribe el juego, si la habilidad está en alguna de
 * las listas (primero la del idioma de la web, luego la otra). Si no está, se
 * deja lo que escribió el jugador, sin tocar.
 */
export function canonicalSkillName(input: string, ...lists: ReadonlyArray<readonly string[]>): string {
  const typed = input.replace(/\s+/g, " ").trim();
  if (typed === "") return "";
  const wanted = normalizeSkillName(typed);
  for (const names of lists) {
    const match = names.find((name) => normalizeSkillName(name) === wanted);
    if (match !== undefined) return match;
  }
  return typed;
}

/** ¿La web conoce esa habilidad? Sin listas cargadas no se puede saber: cuenta como sí. */
export function isKnownSkillName(input: string, ...lists: ReadonlyArray<readonly string[]>): boolean {
  if (lists.every((names) => names.length === 0)) return true;
  const wanted = normalizeSkillName(input);
  return lists.some((names) => names.some((name) => normalizeSkillName(name) === wanted));
}
