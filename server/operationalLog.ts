import { createHash } from "node:crypto";

const SAFE_NAME = /^[a-z][a-z0-9_-]{0,63}$/i;
const REQUEST_ID = /^ec_[a-f0-9]{16}$/;

interface RateLimitEvent {
  scope: string;
  requestId: string;
  limit: number;
  retryAfterSeconds: number;
}

interface UnexpectedErrorEvent {
  requestId: string;
  error: unknown;
}

interface MentorFallbackEvent {
  requestId: string;
  provider: string;
  reason: string | null | undefined;
}

function safeName(value: string, fallback: string): string {
  return SAFE_NAME.test(value) ? value : fallback;
}

function safeRequestId(value: string): string {
  return REQUEST_ID.test(value) ? value : "ec_invalid";
}

function errorIdentity(error: unknown): { errorName: string; fingerprint: string } {
  const errorName =
    error instanceof Error ? safeName(error.name, "Error") : "NonErrorThrown";
  // El mensaje se excluye de forma deliberada: una excepción puede incorporar
  // tooltips, nombres o cualquier otro texto recibido. El hash de la pila sin
  // su primera línea permite agrupar incidentes iguales sin registrar el texto.
  const stackFrames =
    error instanceof Error && typeof error.stack === "string"
      ? error.stack.split(/\r?\n/u).slice(1).join("\n")
      : typeof error;
  const fingerprint = createHash("sha256")
    .update(`${errorName}\n${stackFrames}`)
    .digest("hex")
    .slice(0, 16);
  return { errorName, fingerprint };
}

function mentorFallbackCategory(reason: string | null | undefined): string {
  const normalized = reason?.toLocaleLowerCase("es") ?? "";
  if (normalized.includes("tardó") || normalized.includes("tiempo")) return "timeout";
  if (normalized.includes("estado ")) return "provider_http";
  if (normalized.includes("rechazó")) return "refusal";
  if (
    normalized.includes("contactar") ||
    normalized.includes("no disponible") ||
    normalized.includes("falta ")
  ) {
    return "provider_unavailable";
  }
  return "invalid_response";
}

/**
 * Eventos JSON pensados para el recolector del alojamiento. Sus firmas no
 * aceptan IP, ruta, sesión, cuerpos ni texto del jugador, para que observabilidad
 * no se convierta en una segunda base de datos privada.
 */
export function logRateLimitExceeded(event: RateLimitEvent): void {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "rate_limit_exceeded",
      requestId: safeRequestId(event.requestId),
      scope: safeName(event.scope, "unknown"),
      limit: event.limit,
      retryAfterSeconds: event.retryAfterSeconds,
    }),
  );
}

export function logUnexpectedApiError(event: UnexpectedErrorEvent): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "api_unexpected_error",
      requestId: safeRequestId(event.requestId),
      ...errorIdentity(event.error),
    }),
  );
}

export function logMentorProviderFallback(event: MentorFallbackEvent): void {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "mentor_provider_fallback",
      requestId: safeRequestId(event.requestId),
      provider: safeName(event.provider, "unknown"),
      category: mentorFallbackCategory(event.reason),
    }),
  );
}
