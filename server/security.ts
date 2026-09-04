import { randomUUID } from "node:crypto";
import type { RequestHandler, Response } from "express";
import type { ServerConfig } from "./config.js";
import { logRateLimitExceeded } from "./operationalLog.js";

const LOCAL_SESSION_COOKIE = "exile_copilot_session";
const SECURE_SESSION_COOKIE = "__Host-exile_copilot_session";
const SESSION_ID = /^[A-Za-z0-9_-]{8,128}$/;
const GENERATED_SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

function sessionCookieName(config: ServerConfig): string {
  // `__Host-` impide que otro subdominio inyecte una cookie de sesión: el
  // navegador exige Secure, Path=/ y ausencia de Domain.
  return config.secureCookies ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
}

function cookieValue(
  header: string | undefined,
  name: string,
  accepted: RegExp,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return accepted.test(value) ? value : null;
    } catch {
      // Una cabecera aportada por Internet nunca debe derribar el middleware.
      return null;
    }
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
    const cookieName = sessionCookieName(config);
    const acceptedCookieId =
      config.nodeEnv === "production" ? GENERATED_SESSION_ID : SESSION_ID;
    const existing = cookieValue(req.headers.cookie, cookieName, acceptedCookieId);
    const sessionId = testingId ?? existing ?? developmentId ?? randomUUID();
    res.locals.anonymousSessionId = sessionId;

    if (testingId === null && existing === null) {
      const secure = config.secureCookies ? "; Secure" : "";
      res.append(
        "Set-Cookie",
        `${cookieName}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict${secure}`,
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

/** Invalida la capacidad anónima actual después de borrar todos sus datos. */
export function expireAnonymousSession(res: Response, config: ServerConfig): void {
  const secure = config.secureCookies ? "; Secure" : "";
  const cookieName = sessionCookieName(config);
  res.append(
    "Set-Cookie",
    `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`,
  );
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
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src https://www.youtube-nocookie.com; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
      );
    }
    next();
  };
}

/**
 * Las rutas funcionales pertenecen a una sesión anónima y pueden devolver el
 * expediente, el diario o una conversación. Incluso cuando una respuesta
 * concreta sea pública, compartir su URL con las rutas privadas hace más
 * seguro aplicar una política única: ningún navegador, CDN o proxy debe
 * reutilizarla para otro visitante.
 */
export function privateSessionResponse(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.vary("Cookie");
    next();
  };
}

interface RateBucket {
  startedAt: number;
  count: number;
}

const DEFAULT_RATE_BUCKET_CAPACITY = 10_000;

/**
 * Almacén local acotado para el limitador. Una rotación masiva de IPs no puede
 * hacer crecer el proceso sin límite: primero se retiran ventanas caducadas y,
 * si todas siguen activas, se sustituye la ventana más antigua.
 */
export class BoundedRateBucketStore {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly capacity: number;

  constructor(capacity = DEFAULT_RATE_BUCKET_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("La capacidad del limitador debe ser un entero positivo.");
    }
    this.capacity = capacity;
  }

  get size(): number {
    return this.buckets.size;
  }

  consume(key: string, now: number, windowMs: number): RateBucket {
    const previous = this.buckets.get(key);
    if (previous !== undefined && now - previous.startedAt < windowMs) {
      previous.count += 1;
      return previous;
    }

    if (previous !== undefined) this.buckets.delete(key);

    if (this.buckets.size >= this.capacity) {
      for (const [storedKey, bucket] of this.buckets) {
        if (now - bucket.startedAt >= windowMs) this.buckets.delete(storedKey);
      }
    }

    if (this.buckets.size >= this.capacity) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }

    const bucket = { startedAt: now, count: 1 };
    this.buckets.set(key, bucket);
    return bucket;
  }
}

/** Límite local por IP. En despliegues multi-instancia se sustituirá por un almacén compartido. */
export function fixedWindowRateLimit(
  config: ServerConfig,
  options: {
    scope: string;
    limit: number;
    windowMs?: number;
    /** Override acotado para pruebas; producción usa 10.000 ventanas. */
    bucketCapacity?: number;
  },
): RequestHandler {
  const buckets = new BoundedRateBucketStore(options.bucketCapacity);
  const windowMs = options.windowMs ?? 60_000;

  return (req, res, next) => {
    if (config.nodeEnv === "test") {
      next();
      return;
    }
    const now = Date.now();
    const key = `${options.scope}:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    const bucket = buckets.consume(key, now, windowMs);

    const remaining = Math.max(0, options.limit - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
    res.setHeader("RateLimit-Limit", String(options.limit));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));
    if (bucket.count > options.limit) {
      res.setHeader("Retry-After", String(resetSeconds));
      const requestId = publicRequestId(res.locals as Record<string, unknown>);
      logRateLimitExceeded({
        scope: options.scope,
        requestId,
        limit: options.limit,
        retryAfterSeconds: resetSeconds,
      });
      res.status(429).json({
        error: "demasiadas-peticiones",
        detail: "Has hecho demasiadas peticiones. Espera un momento y vuelve a intentarlo.",
        requestId,
      });
      return;
    }
    next();
  };
}
