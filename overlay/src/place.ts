/**
 * Dónde se pinta la ventanita. Puro: recibe rectángulos y devuelve un punto.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Mete la ventanita entera dentro de la pantalla. Si no cabe, manda la
 * esquina de arriba a la izquierda, que es donde está el asa para moverla.
 */
export function keepInside(box: Box, area: Box): { x: number; y: number } {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
  return {
    x: clamp(box.x, area.x, area.x + area.width - box.width),
    y: clamp(box.y, area.y, area.y + area.height - box.height),
  };
}
