/**
 * Enlace de donación del pie de página. Es la página de Ko-fi de Luis: un
 * enlace normal, sin cargar nada de Ko-fi dentro de la web.
 *
 * Vacío = el enlace no se enseña. Donar no desbloquea nada: GGG no deja cobrar
 * funciones y la web es igual para todos.
 */
export const DONATION_URL = "";

/**
 * Solo una página de Ko-fi bien escrita llega al pie. Una errata o cualquier
 * otra dirección se queda fuera en vez de mandar a la gente a un sitio raro.
 */
export function donationHref(url: string = DONATION_URL): string | null {
  return /^https:\/\/ko-fi\.com\/[A-Za-z0-9_]{2,40}$/.test(url) ? url : null;
}
