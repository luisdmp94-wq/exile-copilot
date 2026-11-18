import { z } from "zod";

/**
 * «Avisar de un problema»: lo que el jugador decide contarnos y, si lo deja
 * marcado, unos datos técnicos que ve antes de enviar (navegador, tamaño de
 * pantalla, área e idioma). Nada que le identifique: ni IP, ni sesión, ni
 * personaje.
 */

export const FEEDBACK_AREAS = ["expediente", "plan", "crafting", "guias", "otra"] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const FeedbackReportSchema = z
  .object({
    text: z.string().trim().min(3).max(1000),
    area: z.enum(FEEDBACK_AREAS).nullable().default(null),
    lang: z.enum(["es", "en"]),
    /** «1280×900». */
    viewport: z.string().trim().max(20).nullable().default(null),
    /** «Opera · Windows». */
    browser: z.string().trim().max(40).nullable().default(null),
  })
  .strict();
export type FeedbackReport = z.infer<typeof FeedbackReportSchema>;

export const FeedbackEntrySchema = z.object({
  id: z.number().int(),
  createdAt: z.string(),
  area: z.string().nullable(),
  lang: z.string(),
  viewport: z.string().nullable(),
  browser: z.string().nullable(),
  text: z.string(),
});
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;

/** Los avisos se borran solos pasado este tiempo. */
export const FEEDBACK_RETENTION_DAYS = 90;

/**
 * Avisos que se guardan como mucho en 24 horas. Con 20-30 jugadores no se
 * llega ni de lejos; el tope solo frena a un programa que quiera llenar el
 * disco. Lo que pasa del tope no se guarda (y no borra avisos anteriores).
 */
export const FEEDBACK_DAILY_LIMIT = 200;

/** Navegador y sistema en dos palabras, sacados del user agent. Sin versión. */
export function summarizeBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("opr/") || ua.includes("opera")
    ? "Opera"
    : ua.includes("edg/")
      ? "Edge"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("chrome/")
          ? "Chrome"
          : ua.includes("safari/")
            ? "Safari"
            : "Otro";
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("android")
      ? "Android"
      : ua.includes("iphone") || ua.includes("ipad")
        ? "iOS"
        : ua.includes("mac os")
          ? "macOS"
          : ua.includes("linux")
            ? "Linux"
            : "Otro";
  return `${browser} · ${os}`;
}
