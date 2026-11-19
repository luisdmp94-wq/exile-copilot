import {
  OWNER_KEY_STORAGE,
  classifySource,
  looksLikeBot,
  pageOf,
  sourceFromHeader,
  type VisitArea,
  type VisitBeacon,
  type VisitSource,
} from "@shared/visitStats";

/**
 * Lo mínimo del navegador que hace falta. Se declara aquí para que el archivo
 * también compile (y se pruebe) en el servidor, que no conoce el DOM.
 */
interface PageLocation {
  pathname: string;
  search: string;
  hostname: string;
}
interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface BrowserLike {
  window?: { localStorage: KeyValueStore; sessionStorage?: KeyValueStore };
}
const browser = globalThis as BrowserLike;

const FIRST_VISIT_KEY = "exile-copilot:visitado";
const LAST_DAY_KEY = "exile-copilot:ultimo-dia";
/** De dónde llegó esta visita. Dura lo que la pestaña: al cerrarla se olvida. */
const SESSION_SOURCE_KEY = "exile-copilot:origen-visita";

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

function readSession(key: string): string | null {
  try {
    return browser.window?.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    browser.window?.sessionStorage?.setItem(key, value);
  } catch {
    // Sin almacenamiento, los usos de esta visita cuentan como «directo».
  }
}

/**
 * El origen de esta visita. Al recargar o pasar de una página a otra el
 * navegador ya no dice de dónde vino la persona: se recuerda el primero.
 */
function rememberSource(found: VisitSource): VisitSource {
  if (found !== "directo") {
    writeSession(SESSION_SOURCE_KEY, found);
    return found;
  }
  return visitSource();
}

/** De dónde llegó esta visita, para sumar cada uso en su origen. */
export function visitSource(): VisitSource {
  // Lo guardado ya es un origen de la lista («otro» incluido): se valida tal cual.
  return sourceFromHeader(readSession(SESSION_SOURCE_KEY) ?? undefined);
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
    source: rememberSource(
      classifySource(referrer, new URLSearchParams(location.search).get("ref"), location.hostname),
    ),
    firstVisit,
    firstToday,
  };
}

/** Marca de «este navegador no cuenta», puesta con `?nocount=1`. */
const NO_COUNT_KEY = "exile-copilot:no-contar";

let lastNoCountChange: "on" | "off" | null = null;

/**
 * `?nocount=1` marca este navegador para que sus visitas no se cuenten, sin
 * tener que escribir la clave de estadísticas (sirve para el móvil o para el
 * navegador con el que se emite). `?nocount=0` lo deshace. Cualquiera puede
 * usarlo: solo se quita a sí mismo de las cifras.
 */
export function applyNoCountParam(search: string): "on" | "off" | null {
  const params = new URLSearchParams(search);
  const value = (params.get("nocount") ?? params.get("nocontar"))?.trim().toLowerCase();
  if (value === undefined) return null;
  const off = value === "0" || value === "no" || value === "off";
  write(NO_COUNT_KEY, off ? "0" : "1");
  lastNoCountChange = off ? "off" : "on";
  return lastNoCountChange;
}

/** Lo que cambió `?nocount=` al cargar esta página, para avisar al jugador. */
export function noCountChange(): "on" | "off" | null {
  return lastNoCountChange;
}

/**
 * ¿Es un navegador del dueño? Lo es si guarda la clave de estadísticas o si se
 * marcó con `?nocount=1`. Sus visitas no se envían: probando la web a diario
 * inflaba las cifras.
 */
export function isOwnerBrowser(): boolean {
  return (read(OWNER_KEY_STORAGE) ?? "").trim() !== "" || read(NO_COUNT_KEY) === "1";
}

const sentAreas = new Set<VisitArea>();

/**
 * Esta visita ha abierto un área (guías, plan…). Cuenta una vez por área y
 * carga de la página; nunca a un programa. Si falla, no pasa nada.
 */
export function sendAreaBeacon(area: VisitArea): void {
  try {
    if (sentAreas.has(area) || isOwnerBrowser()) return;
    const page = globalThis as unknown as { navigator: { userAgent?: string; webdriver?: boolean } };
    if (looksLikeBot(page.navigator.userAgent, page.navigator.webdriver === true)) return;
    sentAreas.add(area);
    void fetch("/api/visit/area", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, source: visitSource() }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // El contador nunca debe estorbar a la web.
  }
}

/** Cuánto tiene que estar una persona en la página para contar como visita. */
export const VISIT_DWELL_MS = 3000;
const INTERACTIONS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

interface BrowserPage {
  location: PageLocation;
  document: { referrer: string; visibilityState?: string };
  navigator: { userAgent?: string; webdriver?: boolean };
  addEventListener(type: string, listener: () => void, options?: { passive?: boolean }): void;
  removeEventListener(type: string, listener: () => void): void;
}

/**
 * Avisa de la visita una vez por carga, pero solo si parece una persona: ni
 * un navegador manejado por un programa, ni algo que carga la página y se va.
 * Cuenta cuando alguien toca la página o la tiene a la vista unos segundos.
 * Si falla, no pasa nada: la web sigue igual.
 */
export function sendVisitBeacon(): void {
  try {
    const page = globalThis as unknown as BrowserPage;
    if (looksLikeBot(page.navigator.userAgent, page.navigator.webdriver === true)) return;
    if (isOwnerBrowser()) return;
    // La dirección de entrada, antes de que la web la cambie (/guias/acto-1…).
    const location: PageLocation = {
      pathname: page.location.pathname,
      search: page.location.search,
      hostname: page.location.hostname,
    };
    const referrer = page.document.referrer;
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      for (const type of INTERACTIONS) page.removeEventListener(type, send);
      void fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildVisitBeacon(location, referrer)),
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    };
    for (const type of INTERACTIONS) page.addEventListener(type, send, { passive: true });
    setTimeout(() => {
      if (page.document.visibilityState !== "hidden") send();
    }, VISIT_DWELL_MS);
  } catch {
    // El contador nunca debe estorbar a la web.
  }
}
