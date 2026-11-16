import { classifySource, pageOf, type VisitBeacon } from "@shared/visitStats";

/**
 * Lo mínimo del navegador que hace falta. Se declara aquí para que el archivo
 * también compile (y se pruebe) en el servidor, que no conoce el DOM.
 */
interface PageLocation {
  pathname: string;
  search: string;
  hostname: string;
}
interface BrowserLike {
  window?: { localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void } };
}
const browser = globalThis as BrowserLike;

const FIRST_VISIT_KEY = "exile-copilot:visitado";
const LAST_DAY_KEY = "exile-copilot:ultimo-dia";

/** Día en UTC, igual que en el servidor. */
function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function read(key: string): string | null {
  try {
    return browser.window?.localStorage.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    browser.window?.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento, cada visita parece la primera: el contador exagera un poco.
  }
}

/**
 * Lo que se envía al cargar la web. Las marcas «ya visitado» y «último día»
 * se quedan en este navegador; al servidor solo le llegan sí/no.
 */
export function buildVisitBeacon(location: PageLocation, referrer: string, now = new Date()): VisitBeacon {
  const day = today(now);
  const firstVisit = read(FIRST_VISIT_KEY) === null;
  const firstToday = read(LAST_DAY_KEY) !== day;
  write(FIRST_VISIT_KEY, "1");
  write(LAST_DAY_KEY, day);
  return {
    page: pageOf(location.pathname),
    source: classifySource(referrer, new URLSearchParams(location.search).get("ref"), location.hostname),
    firstVisit,
    firstToday,
  };
}

/** Avisa de la visita una vez por carga. Si falla, no pasa nada: la web sigue igual. */
export function sendVisitBeacon(): void {
  try {
    const page = globalThis as unknown as { location: PageLocation; document: { referrer: string } };
    const beacon = buildVisitBeacon(page.location, page.document.referrer);
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(beacon),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // El contador nunca debe estorbar a la web.
  }
}
