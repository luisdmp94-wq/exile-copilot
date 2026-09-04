import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../server/config.js";
import {
  BoundedRateBucketStore,
  fixedWindowRateLimit,
} from "../../server/security.js";

describe("almacén acotado del limitador público", () => {
  it("nunca supera su capacidad aunque lleguen claves distintas en la misma ventana", () => {
    const store = new BoundedRateBucketStore(2);

    expect(store.consume("ip-a", 0, 1_000).count).toBe(1);
    expect(store.consume("ip-b", 10, 1_000).count).toBe(1);
    expect(store.consume("ip-b", 20, 1_000).count).toBe(2);
    expect(store.consume("ip-c", 30, 1_000).count).toBe(1);

    expect(store.size).toBe(2);
    // `ip-a` era la ventana más antigua y fue sustituida, no conservada fuera
    // de un supuesto límite blando.
    expect(store.consume("ip-a", 40, 1_000).count).toBe(1);
    expect(store.size).toBe(2);
  });

  it("recupera primero todas las ventanas caducadas", () => {
    const store = new BoundedRateBucketStore(2);
    store.consume("ip-a", 0, 1_000);
    store.consume("ip-b", 100, 1_000);

    expect(store.consume("ip-c", 1_100, 1_000).count).toBe(1);
    expect(store.size).toBe(1);
  });

  it("rechaza capacidades que no puedan acotar el almacenamiento", () => {
    expect(() => new BoundedRateBucketStore(0)).toThrow(/entero positivo/);
    expect(() => new BoundedRateBucketStore(1.5)).toThrow(/entero positivo/);
  });

  it("el middleware público usa el almacén acotado y sustituye la ventana más antigua", () => {
    const limiter = fixedWindowRateLimit(loadConfig({ NODE_ENV: "development" }), {
      scope: "prueba-acotada",
      limit: 1,
      windowMs: 1_000,
      bucketCapacity: 2,
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(100);

    const consume = (ip: string) => {
      let statusCode = 200;
      let payload: unknown = null;
      const headers = new Map<string, string>();
      const next = vi.fn();
      const response = {
        locals: { requestId: "ec_0123456789abcdef" },
        setHeader(name: string, value: string) {
          headers.set(name.toLowerCase(), value);
          return this;
        },
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(value: unknown) {
          payload = value;
          return this;
        },
      };

      limiter(
        { ip, socket: { remoteAddress: ip } } as never,
        response as never,
        next,
      );
      return { statusCode, payload, headers, next };
    };

    try {
      expect(consume("ip-a").next).toHaveBeenCalledOnce();
      expect(consume("ip-b").next).toHaveBeenCalledOnce();
      expect(consume("ip-c").next).toHaveBeenCalledOnce();

      // `ip-a` habría recibido 429 si la primera ventana siguiera retenida.
      // Al superar la capacidad fue la más antigua y se sustituyó.
      const returnedA = consume("ip-a");
      expect(returnedA.next).toHaveBeenCalledOnce();
      expect(returnedA.statusCode).toBe(200);
      expect(returnedA.payload).toBeNull();
      expect(returnedA.headers.get("ratelimit-remaining")).toBe("0");
    } finally {
      now.mockRestore();
    }
  });

  it("emite un evento operativo seguro cuando rechaza una petición", () => {
    const limiter = fixedWindowRateLimit(loadConfig({ NODE_ENV: "development" }), {
      scope: "mentor",
      limit: 1,
      windowMs: 60_000,
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = () => ({
      locals: { requestId: "ec_0123456789abcdef" },
      setHeader() {
        return this;
      },
      status() {
        return this;
      },
      json() {
        return this;
      },
    });
    const request = { ip: "203.0.113.55", socket: { remoteAddress: "203.0.113.55" } };

    try {
      limiter(request as never, response() as never, vi.fn());
      limiter(request as never, response() as never, vi.fn());

      expect(warning).toHaveBeenCalledOnce();
      const line = String(warning.mock.calls[0]?.[0]);
      expect(JSON.parse(line)).toMatchObject({
        event: "rate_limit_exceeded",
        scope: "mentor",
        requestId: "ec_0123456789abcdef",
        limit: 1,
      });
      expect(line).not.toContain("203.0.113.55");
    } finally {
      warning.mockRestore();
    }
  });
});
