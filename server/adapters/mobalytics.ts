import { ApiHttpError } from "../errors.js";

/**
 * Adaptador Mobalytics: solo guarda un enlace de build como REFERENCIA.
 * Sin scraping, sin fetch: las guías comunitarias nunca son verdad absoluta
 * (ver `EvidenceSourceKind` = "community" en shared/domain.ts).
 */

const MOBALYTICS_HOST = "mobalytics.gg";

/**
 * Valida que `url` sea una URL http(s) de mobalytics.gg y la devuelve
 * normalizada (protocolo https, sin fragmento). Lanza ApiHttpError(400) si no.
 */
export function saveReference(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new ApiHttpError(400, "mobalytics-url-invalida", "La URL no tiene un formato válido.");
  }
  const host = parsed.hostname.toLowerCase();
  const isMobalytics = host === MOBALYTICS_HOST || host.endsWith(`.${MOBALYTICS_HOST}`);
  if (!isMobalytics || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    throw new ApiHttpError(
      400,
      "mobalytics-url-invalida",
      "Solo se aceptan URLs http(s) de mobalytics.gg como referencia.",
    );
  }
  parsed.protocol = "https:";
  parsed.hash = "";
  return parsed.toString();
}
