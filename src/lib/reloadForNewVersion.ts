/**
 * Tras subir una versión nueva, una pestaña abierta pide trozos de JavaScript
 * que ya no existen. En vez de dejar la página caída, se recarga una vez para
 * coger la versión nueva. Si vuelve a fallar enseguida (o no hay conexión), no
 * se insiste: manda la pantalla de error con su botón de recargar.
 */
const KEY = "exile-copilot:recarga-version";
const MIN_GAP_MS = 30_000;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Expected a JavaScript(?:-or-Wasm)? module script|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

/** Lo poco que hace falta del navegador (este archivo también lo leen los tests de Node). */
interface BrowserBits {
  navigator?: { onLine?: boolean };
  sessionStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  location?: { reload(): void };
}

/** Devuelve true si ha lanzado la recarga. */
export function reloadOnceForNewVersion(): boolean {
  const browser = globalThis as BrowserBits;
  if (!browser.location || !browser.sessionStorage) return false;
  if (browser.navigator?.onLine === false) return false;
  try {
    const last = Number(browser.sessionStorage.getItem(KEY) ?? "0");
    if (Date.now() - last < MIN_GAP_MS) return false;
    browser.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento no podemos evitar un bucle: mejor no recargar solos.
    return false;
  }
  browser.location.reload();
  return true;
}
