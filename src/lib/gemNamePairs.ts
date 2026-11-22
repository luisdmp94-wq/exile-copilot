import { api } from "@/lib/api";

/**
 * Las habilidades en español y en inglés vienen del servidor en el mismo orden
 * (`/api/gems/skills`): la posición casa «Drenar esencia» con «Essence Drain».
 * Un código de PoB2 trae los nombres en inglés y el jugador los escribe en el
 * idioma de su juego; con esto se reconoce que son la misma habilidad.
 */
let pairsPromise: Promise<Map<string, number>> | null = null;

function plain(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadGemNamePairs(): Promise<Map<string, number>> {
  pairsPromise ??= Promise.all([api.gemSkills("es"), api.gemSkills("en")]).then(([es, en]) => {
    const index = new Map<string, number>();
    es.skills.forEach((skill, position) => index.set(plain(skill.name), position));
    en.skills.forEach((skill, position) => {
      if (!index.has(plain(skill.name))) index.set(plain(skill.name), position);
    });
    return index;
  });
  pairsPromise.catch(() => {
    pairsPromise = null;
  });
  return pairsPromise;
}

/** ¿Es la misma habilidad, escrita en español o en inglés? */
export function sameGem(pairs: ReadonlyMap<string, number> | null, a: string, b: string): boolean {
  const left = plain(a);
  const right = plain(b);
  if (left === right) return true;
  if (!pairs) return false;
  const position = pairs.get(left);
  return position !== undefined && position === pairs.get(right);
}
