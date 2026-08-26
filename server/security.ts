import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { ServerConfig } from "./config.js";

const SESSION_COOKIE = "exile_copilot_session";
const SESSION_ID = /^[A-Za-z0-9_-]{8,128}$/;
const PUBLIC_REQUEST_ID = /^ec_[a-f0-9]{16}$/;

/** Correlación propia: nunca acepta un id aportado por Internet. */
export function requestIdentity(): RequestHandler {
  return (_req, res, next) => {
    const id = `ec_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    res.locals.requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  };
}

export function publicRequestId(locals: Record<string, unknown>): string {
  const value = locals.requestId;
  if (typeof value !== "string" || !PUBLIC_REQUEST_ID.test(value)) {
    throw new Error("Identificador de petición no inicializado.");
  }
  return value;
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = decodeURIComponent(part.slice(separator + 1).trim());
    return SESSION_ID.test(value) ? value : null;
  }
  return null;
}

/**
 * Sesión anónima de capacidad: cada navegador recibe un id impredecible en una
 * cookie HttpOnly. No crea una cuenta, pero separa expedientes entre visitantes.
 */
export function anonymousSession(config: ServerConfig): RequestHandler {
  return (req, res, next) => {
    const testHeader = req.get("x-exile-copilot-test-session");
    const testingId =
      config.nodeEnv === "test" && testHeader && SESSION_ID.test(testHeader)
        ? testHeader
        : config.nodeEnv === "test"
          ? "test-session"
          : null;
    const developmentId =
      config.nodeEnv === "development" ? "local-development-session" : null;
    const existing = cookieValue(req.headers.cookie, SESSION_COOKIE);
    const sessionId = testingId ?? existing ?? developmentId ?? randomUUID();
    res.locals.anonymousSessionId = sessionId;

    if (testingId === null && existing === null) {
      const secure = config.secureCookies ? "; Secure" : "";
      res.append(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict${secure}`,
      );
    }
    next();
  };
}

export function anonymousSessionId(locals: Record<string, unknown>): string {
  const value = locals.anonymousSessionId;
  if (typeof value !== "string" || !SESSION_ID.test(value)) {
    throw new Error("Sesión anónima no inicializada.");
  }
  return value;
}

/** Cabeceras que también puede reutilizar el servidor del frontend estático. */
export function securityHeaders(config: ServerConfig): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (config.nodeEnv === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
      );
    }
    next();
  };
}

interface RateBucket {
  startedAt: number;
  count: number;
}

/** Límite local por IP. En despliegues multi-instancia se sustituirá por un almacén compartido. */
export function fixedWindowRateLimit(
  config: ServerConfig,
  options: { scope: string; limit: number; windowMs?: number },
): RequestHandler {
  const buckets = new Map<string, RateBucket>();
  const windowMs = options.windowMs ?? 60_000;

  return (req, res, next) => {
    if (config.nodeEnv === "test") {
      next();
      return;
    }
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.startedAt >= windowMs) buckets.delete(key);
      }
    }
    const key = `${options.scope}:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    const previous = buckets.get(key);
    const bucket =
      previous === undefined || now - previous.startedAt >= windowMs
        ? { startedAt: now, count: 0 }
        : previous;
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.limit - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
    res.setHeader("RateLimit-Limit", String(options.limit));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));
    if (bucket.count > options.limit) {
      res.setHeader("Retry-After", String(resetSeconds));
      res.status(429).json({
        error: "demasiadas-peticiones",
        detail: "Has hecho demasiadas peticiones. Espera un momento y vuelve a intentarlo.",
        requestId: publicRequestId(res.locals as Record<string, unknown>),
      });
      return;
    }
    next();
  };
}
