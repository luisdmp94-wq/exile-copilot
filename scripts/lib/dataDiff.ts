/**
 * Qué ha cambiado entre los datos que había y los recién descargados.
 *
 * Los scripts `data:*` escriben archivos de una sola línea o de miles: el
 * `git diff` no se puede leer. El día de un parche hace falta saber de un
 * vistazo si la fuente ya trae el parche (hay cambios) o todavía no (ninguno),
 * y si se ha perdido algo que antes estaba.
 */
import { existsSync, readFileSync } from "node:fs";

export interface DataChanges {
  added: string[];
  removed: string[];
  changed: string[];
}

/** Lo que había en el archivo antes de sobrescribirlo, o `null` si no existía o no se lee. */
export function readPrevious<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Compara dos tablas `clave → contenido`. La clave es lo que se enseña en el
 * resumen (un nombre que se pueda leer); el contenido, lo que decide si cambió.
 */
export function compareEntries(before: Map<string, string>, after: Map<string, string>): DataChanges {
  const added = [...after.keys()].filter((key) => !before.has(key));
  const removed = [...before.keys()].filter((key) => !after.has(key));
  const changed = [...after.keys()].filter((key) => before.has(key) && before.get(key) !== after.get(key));
  return { added, removed, changed };
}

export function hasChanges(changes: DataChanges): boolean {
  return changes.added.length + changes.removed.length + changes.changed.length > 0;
}

function sample(keys: string[], limit = 8): string {
  const shown = keys.slice(0, limit).join(", ");
  return keys.length > limit ? `${shown} y ${keys.length - limit} más` : shown;
}

/**
 * Líneas listas para imprimir: una por tipo de cambio, con algunos nombres.
 * `name` convierte una clave en lo que se enseña (por defecto, la clave).
 */
export function describeChanges(label: string, changes: DataChanges, name: (key: string) => string = (key) => key): string[] {
  if (!hasChanges(changes)) return [`${label}: sin cambios`];
  const names = (keys: string[]) => sample(keys.map(name));
  const lines: string[] = [];
  if (changes.added.length > 0) lines.push(`${label}: ${changes.added.length} que antes no estaban: ${names(changes.added)}`);
  if (changes.removed.length > 0) lines.push(`${label}: ${changes.removed.length} que ya no están: ${names(changes.removed)}`);
  if (changes.changed.length > 0) lines.push(`${label}: ${changes.changed.length} con el texto cambiado: ${names(changes.changed)}`);
  return lines;
}
