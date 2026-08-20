import type { ResolvedAscendancy } from "@shared/passiveRegistry.js";

/**
 * Texto visible para una ascendencia resuelta contra el registro oficial.
 * Tres realidades, mostradas por separado y sin inventar nunca el nombre:
 *  - nombre y clase verificados          → "Titan · clase Warrior"
 *  - nombre no publicado, clase conocida → "Nombre no verificado · clase Ranger"
 *  - id desconocido en el registro       → "No verificado"
 * El id crudo se muestra siempre aparte (p. ej. "(Ranger2)").
 */
export function describeAscendancy(ascendancy: ResolvedAscendancy): string {
  if (ascendancy.verified && ascendancy.name !== null) {
    return ascendancy.className !== null
      ? `${ascendancy.name} · clase ${ascendancy.className}`
      : ascendancy.name;
  }
  if (ascendancy.className !== null) {
    return `Nombre no verificado · clase ${ascendancy.className}`;
  }
  return "No verificado";
}
