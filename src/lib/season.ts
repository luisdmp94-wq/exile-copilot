/**
 * Detalles de temporada de la mascota. Solo adornos: nada de lo que la web
 * aconseja depende de esto.
 */

/** Del 1 de diciembre al 6 de enero (Reyes), en la hora del jugador. */
export function isChristmasSeason(now: Date): boolean {
  const month = now.getMonth();
  const day = now.getDate();
  return month === 11 || (month === 0 && day <= 6);
}

/** `?gorro=1` (o `?hat=1`) enseña el gorro fuera de temporada, para verlo antes. */
export function hatRequested(search: string): boolean {
  const params = new URLSearchParams(search);
  return (params.get("gorro") ?? params.get("hat")) === "1";
}
