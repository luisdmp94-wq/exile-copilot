/**
 * Direcciones que la web sabe pintar además de las guías ya escritas en HTML
 * (`/guias/<slug>`, que el servidor atiende antes).
 *
 * Cualquier otra dirección recibe la misma página, pero con estado 404: el
 * visitante no se queda tirado y los buscadores no indexan direcciones que no
 * existen. Antes todas devolvían 200.
 */
const APP_ROUTES = new Set(["/", "/guias", "/check", "/estadisticas"]);

export function isAppRoute(path: string): boolean {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return APP_ROUTES.has(normalized === "" ? "/" : normalized);
}

/** Páginas que no deben salir en buscadores aunque alguien las enlace. */
export function isPrivateRoute(path: string): boolean {
  return /^\/estadisticas\/?$/.test(path);
}
