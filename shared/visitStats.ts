import { z } from "zod";

/**
 * Contador de visitas anónimo.
 *
 * Solo se guardan cifras por día: cuántas visitas, de qué sitio llegan y qué
 * herramientas se usan. Nada que identifique a una persona: ni IP, ni cookie,
 * ni la dirección completa de la página de origen. El origen se reduce a una
 * lista cerrada («reddit», «twitch»…) y la página, a una lista cerrada de
 * secciones; cualquier otra cosa cuenta como «otro» u «otra».
 */

export const VISIT_SOURCES = [
  "directo",
  "reddit",
  "twitch",
  "youtube",
  "discord",
  "tiktok",
  "x",
  "buscador",
  "otro",
] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

const SOURCE_HOSTS: Array<[RegExp, VisitSource]> = [
  [/(^|\.)reddit\.com$|(^|\.)redd\.it$/, "reddit"],
  [/(^|\.)twitch\.tv$/, "twitch"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)discord(app)?\.com$|(^|\.)discord\.gg$/, "discord"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)t\.co$/, "x"],
  [/(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)search\.brave\.com$|(^|\.)ecosia\.org$/, "buscador"],
];

/**
 * De dónde llega la visita. Manda `?ref=` si es una de las conocidas (así se
 * puede poner `exilecopilot.com/?ref=twitch` en el chat); si no, el sitio de
 * la página anterior. Sin página anterior es «directo».
 */
export function classifySource(referrer: string, refParam: string | null, ownHost: string): VisitSource {
  const wanted = refParam?.trim().toLowerCase() ?? "";
  if ((VISIT_SOURCES as readonly string[]).includes(wanted) && wanted !== "otro") return wanted as VisitSource;
  if (!referrer) return "directo";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "otro";
  }
  // Pasar de una página de la web a otra no es una visita nueva desde fuera.
  if (host === ownHost.toLowerCase()) return "directo";
  return SOURCE_HOSTS.find(([test]) => test.test(host))?.[1] ?? "otro";
}

/**
 * Robots que visitan la web: buscadores, vigilantes de dominios nuevos,
 * vistas previas de enlaces y navegadores manejados por programas. No son
 * jugadores y no se cuentan.
 */
const BOT_USER_AGENT =
  /\bbot\b|bot\/|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|preview|facebookexternalhit|embedly|python|curl|wget|httpclient|go-http|java\/|scan/i;

export function looksLikeBot(userAgent: string | undefined, automated = false): boolean {
  if (automated) return true;
  const agent = userAgent?.trim() ?? "";
  return agent === "" || BOT_USER_AGENT.test(agent);
}

export const VISIT_PAGES = ["inicio", "guias", "estadisticas", "otra"] as const;
export type VisitPage = (typeof VISIT_PAGES)[number];

export function pageOf(pathname: string): VisitPage {
  if (pathname === "/" || pathname === "") return "inicio";
  if (/^\/guias(\/|$)/.test(pathname)) return "guias";
  if (/^\/estadisticas\/?$/.test(pathname)) return "estadisticas";
  return "otra";
}

export const VisitBeaconSchema = z
  .object({
    page: z.enum(VISIT_PAGES),
    source: z.enum(VISIT_SOURCES),
    /** Primera vez que este navegador entra en la web. */
    firstVisit: z.boolean(),
    /** Primera visita de hoy desde este navegador: cuenta como visitante del día. */
    firstToday: z.boolean(),
  })
  .strict();
export type VisitBeacon = z.infer<typeof VisitBeaconSchema>;

/** Lo que se hace con la web: cada uno cuenta una vez cuando sale bien. */
export const USAGE_EVENTS = [
  "gema",
  "reparto-gemas",
  "pieza-leida",
  "mentor",
  "personaje-guardado",
] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];

export const StatsDaySchema = z.object({
  day: z.string(),
  visitors: z.number().int(),
  newVisitors: z.number().int(),
  visits: z.number().int(),
  sources: z.record(z.string(), z.number().int()),
  pages: z.record(z.string(), z.number().int()),
  uses: z.record(z.string(), z.number().int()),
});
export type StatsDay = z.infer<typeof StatsDaySchema>;

export const StatsResponseSchema = z.object({
  days: z.array(StatsDaySchema),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
