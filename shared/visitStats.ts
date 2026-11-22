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
  "steam",
  "foro",
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
  [/(^|\.)steamcommunity\.com$|(^|\.)steampowered\.com$/, "steam"],
  // El foro oficial de Path of Exile (es.pathofexile.com, www.pathofexile.com…).
  [/(^|\.)pathofexile\.com$/, "foro"],
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
  "captura-leida",
  "codigo-pob",
] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];

/**
 * Cabecera con la que la web dice de dónde llegó esta visita, para sumar cada
 * uso en su origen («desde Twitch: 2 piezas leídas»). Solo lleva el nombre
 * del origen, de la lista cerrada de arriba.
 */
export const VISIT_SOURCE_HEADER = "x-visit-source";

/**
 * Clave del navegador donde el dueño guarda su clave de estadísticas. Quien
 * la tiene es el dueño probando la web: sus visitas y usos no se cuentan,
 * para que las cifras sean solo de jugadores.
 */
export const OWNER_KEY_STORAGE = "exile-copilot:clave-estadisticas";
/** Cabecera con la que ese navegador pide que su uso no se sume. */
export const VISIT_OWNER_HEADER = "x-visit-owner";

/** Lee esa cabecera; cualquier cosa rara cuenta como «directo». */
export function sourceFromHeader(value: string | undefined): VisitSource {
  const wanted = value?.trim().toLowerCase() ?? "";
  return (VISIT_SOURCES as readonly string[]).includes(wanted) ? (wanted as VisitSource) : "directo";
}

/** Las grandes áreas de la web; cada visita cuenta una vez cada área que abre. */
export const VISIT_AREAS = ["expediente", "plan", "crafting", "guias"] as const;
export type VisitArea = (typeof VISIT_AREAS)[number];

export const AreaBeaconSchema = z
  .object({
    area: z.enum(VISIT_AREAS),
    source: z.enum(VISIT_SOURCES),
  })
  .strict();
export type AreaBeacon = z.infer<typeof AreaBeaconSchema>;

/** Lo de un origen en un día: visitantes, áreas abiertas y usos. */
export const SourceDaySchema = z.object({
  visitors: z.number().int(),
  areas: z.record(z.string(), z.number().int()),
  uses: z.record(z.string(), z.number().int()),
});
export type SourceDay = z.infer<typeof SourceDaySchema>;

export const StatsDaySchema = z.object({
  day: z.string(),
  visitors: z.number().int(),
  newVisitors: z.number().int(),
  visits: z.number().int(),
  sources: z.record(z.string(), z.number().int()),
  pages: z.record(z.string(), z.number().int()),
  uses: z.record(z.string(), z.number().int()),
  areas: z.record(z.string(), z.number().int()).default({}),
  /** Lo mismo, separado por origen. Los días anterior a este cambio vienen vacíos. */
  bySource: z.record(z.string(), SourceDaySchema).default({}),
});
export type StatsDay = z.infer<typeof StatsDaySchema>;

/**
 * Visitantes de ese día que ya habían entrado otro día desde el mismo
 * navegador: los del día menos los que venían por primera vez.
 */
export function returningVisitors(day: Pick<StatsDay, "visitors" | "newVisitors">): number {
  return Math.max(0, day.visitors - day.newVisitors);
}

export const StatsResponseSchema = z.object({
  days: z.array(StatsDaySchema),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
