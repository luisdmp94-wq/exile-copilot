/**
 * Tras subir una versión nueva, una pestaña abierta pide trozos de JavaScript
 * que ya no existen. En vez de dejar la página caída, se recarga una vez para
 * coger la versión nueva. Si vuelve a fallar enseguida (o no hay conexión), no
 * se insiste: manda la pantalla de error con su botón de recargar.
 *
 * Antes de recargar se pregunta al servidor si responde. Mientras se reinicia
 * (un minuto tras cada subida) recargar cambiaría la web que el jugador tiene
 * abierta por la página de error del alojamiento.
 */
const KEY = "exile-copilot:recarga-version";
const MIN_GAP_MS = 30_000;
const HEALTH_URL = "/api/health";
const HEALTH_TIMEOUT_MS = 5_000;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Expected a JavaScript(?:-or-Wasm)? module script|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

/** Lo poco que hace falta del navegador (este archivo también lo leen los tests de Node). */
export interface BrowserBits {
  navigator?: { onLine?: boolean };
  sessionStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  location?: { reload(): void };
}

type HealthFetch = (url: string, init: { cache: "no-store"; signal: AbortSignal }) => Promise<{ ok: boolean }>;

/** ¿El servidor contesta ahora mismo? Un 502 del reinicio o un corte cuentan como no. */
async function serverAnswers(fetchImpl: HealthFetch): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    return (await fetchImpl(HEALTH_URL, { cache: "no-store", signal: controller.signal })).ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Una sola comprobación a la vez: el aviso de Vite y la pantalla de error llegan casi juntos. */
let inFlight: Promise<boolean> | null = null;

/** Devuelve true si ha lanzado la recarga. */
export function reloadOnceForNewVersion(
  browser: BrowserBits = globalThis as BrowserBits,
  fetchImpl: HealthFetch = (url, init) => fetch(url, init),
): Promise<boolean> {
  inFlight ??= attemptReload(browser, fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function attemptReload(browser: BrowserBits, fetchImpl: HealthFetch): Promise<boolean> {
  if (!browser.location || !browser.sessionStorage) return false;
  if (browser.navigator?.onLine === false) return false;
  try {
    const last = Number(browser.sessionStorage.getItem(KEY) ?? "0");
    if (Date.now() - last < MIN_GAP_MS) return false;
  } catch {
    // Sin almacenamiento no podemos evitar un bucle: mejor no recargar solos.
    return false;
  }
  // Servidor caído o reiniciándose: no se recarga ni se gasta el intento. La
  // pantalla de error deja su botón para cuando vuelva.
  if (!(await serverAnswers(fetchImpl))) return false;
  try {
    browser.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  browser.location.reload();
  return true;
}
