import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApiApp } from "../../server/app.js";

let server: Server;
let base: string;

const failingExplainer = {
  name: "failing-production-test",
  async explain(): Promise<string> {
    throw new Error("SECRETO_INTERNO_QUE_NO_DEBE_SALIR");
  },
};

beforeAll(async () => {
  const app = createApiApp({
    dbPath: ":memory:",
    config: {
      nodeEnv: "production",
      secureCookies: true,
      poeNinjaOffline: true,
      mentorAiEnabled: false,
      explainerLlmEnabled: false,
      apiRateLimitPerMinute: 1_000,
      guidanceRateLimitPerMinute: 100,
      mentorRateLimitPerMinute: 1,
    },
    explainer: failingExplainer,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("La API no emitió la cookie de sesión.");
  return setCookie.split(";", 1)[0] ?? "";
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function newSession(apiBase = base): Promise<string> {
  return cookieFrom(await fetch(`${apiBase}/character/demo`));
}

describe("frontera pública", () => {
  it("mantiene health y ready sin sesión, límites de usuario ni pérdida de seguridad", async () => {
    const response = await fetch(`${base}/health`);
    const ready = await fetch(`${base}/ready`);

    expect(response.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(ready.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("ratelimit-limit")).toBeNull();
    expect(ready.headers.get("ratelimit-limit")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(ready.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(ready.headers.get("pragma")).toBe("no-cache");
    const contentSecurityPolicy = response.headers.get("content-security-policy") ?? "";
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain(
      "frame-src https://www.youtube-nocookie.com",
    );
    expect(contentSecurityPolicy).not.toContain("frame-src https://www.youtube.com");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("x-request-id")).toMatch(/^ec_[a-f0-9]{16}$/);
    expect(ready.headers.get("x-request-id")).toMatch(/^ec_[a-f0-9]{16}$/);
  });

  it("en modo público bloquea HTTP directo antes de emitir una sesión", async () => {
    const publicApp = createApiApp({
      dbPath: ":memory:",
      config: {
        publicDeployment: true,
        nodeEnv: "production",
        secureCookies: true,
        trustProxy: "loopback",
        poeNinjaOffline: true,
      },
    });
    const publicServer = await new Promise<Server>((resolve) => {
      const candidate = publicApp.listen(0, "127.0.0.1", () => resolve(candidate));
    });
    try {
      const { port } = publicServer.address() as AddressInfo;
      const publicBase = `http://127.0.0.1:${port}`;
      const direct = await fetch(`${publicBase}/character/demo`);

      expect(direct.status).toBe(426);
      expect(await json(direct)).toMatchObject({
        error: "https-requerido",
        requestId: expect.stringMatching(/^ec_[a-f0-9]{16}$/),
      });
      expect(direct.headers.get("set-cookie")).toBeNull();
      expect(direct.headers.get("cache-control")).toContain("no-store");
      expect(direct.headers.get("ratelimit-limit")).toBeNull();

      const health = await fetch(`${publicBase}/health`);
      expect(health.status).toBe(200);
      expect(health.headers.get("set-cookie")).toBeNull();

      const throughHttpsProxy = await fetch(`${publicBase}/character/demo`, {
        headers: { "X-Forwarded-Proto": "https" },
      });
      expect(throughHttpsProxy.status).toBe(200);
      expect(throughHttpsProxy.headers.get("set-cookie")).toContain(
        "__Host-exile_copilot_session=",
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        publicServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("crea una sesión HttpOnly solo cuando el visitante usa una ruta funcional", async () => {
    const response = await fetch(`${base}/character/demo`);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain("__Host-exile_copilot_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("vary")).toContain("Cookie");

    const existing = cookieFrom(response);
    const repeated = await fetch(`${base}/character/demo`, { headers: { Cookie: existing } });
    expect(repeated.status).toBe(200);
    expect(repeated.headers.get("set-cookie")).toBeNull();
    expect(repeated.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
  });

  it("prohíbe almacenar respuestas privadas y errores del visitante", async () => {
    const session = await newSession();
    const missing = await fetch(`${base}/character/no-existe`, {
      headers: { Cookie: session },
    });

    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(missing.headers.get("pragma")).toBe("no-cache");
    expect(missing.headers.get("vary")).toContain("Cookie");
  });

  it.each([
    ["débil", "__Host-exile_copilot_session=weak1234"],
    ["malformada", "__Host-exile_copilot_session=%E0%A4%A"],
    [
      "legacy sin prefijo protegido",
      "exile_copilot_session=123e4567-e89b-42d3-a456-426614174000",
    ],
  ])("reemplaza una cookie de sesión %s sin derribar la API", async (_case, cookie) => {
    const response = await fetch(`${base}/character/demo`, { headers: { Cookie: cookie } });
    const issued = cookieFrom(response);
    const value = issued.split("=", 2)[1] ?? "";

    expect(response.status).toBe(200);
    expect(issued).toMatch(/^__Host-exile_copilot_session=/);
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(issued).not.toBe(cookie);
  });

  it("los sondeos repetidos no consumen el límite general ni crean cookies", async () => {
    const probeApp = createApiApp({
      dbPath: ":memory:",
      config: {
        nodeEnv: "development",
        secureCookies: false,
        poeNinjaOffline: true,
        apiRateLimitPerMinute: 1,
      },
    });
    const probeServer = await new Promise<Server>((resolve) => {
      const candidate = probeApp.listen(0, "127.0.0.1", () => resolve(candidate));
    });
    try {
      const { port } = probeServer.address() as AddressInfo;
      const probeBase = `http://127.0.0.1:${port}`;
      for (const path of ["/health", "/health", "/ready", "/ready"] as const) {
        const response = await fetch(`${probeBase}${path}`);
        expect(response.status, path).toBe(200);
        expect(response.headers.get("set-cookie"), path).toBeNull();
        expect(response.headers.get("ratelimit-limit"), path).toBeNull();
      }

      const firstVisitorRequest = await fetch(`${probeBase}/character/demo`);
      expect(firstVisitorRequest.status).toBe(200);
      expect(firstVisitorRequest.headers.get("set-cookie")).not.toBeNull();
      expect(firstVisitorRequest.headers.get("ratelimit-limit")).toBe("1");
      expect((await fetch(`${probeBase}/character/demo`)).status).toBe(429);
    } finally {
      await new Promise<void>((resolve, reject) =>
        probeServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("crea referencias propias distintas y no acepta una referencia suplantada", async () => {
    const first = await fetch(`${base}/health`, {
      headers: { "X-Request-Id": "attacker-controlled" },
    });
    const second = await fetch(`${base}/health`);
    const firstId = first.headers.get("x-request-id");
    const secondId = second.headers.get("x-request-id");

    expect(firstId).toMatch(/^ec_[a-f0-9]{16}$/);
    expect(firstId).not.toBe("attacker-controlled");
    expect(secondId).toMatch(/^ec_[a-f0-9]{16}$/);
    expect(secondId).not.toBe(firstId);
  });

  it("un visitante no puede leer, sobrescribir ni abrir el diario de otro", async () => {
    const sessionA = await newSession();
    const sessionB = await newSession();
    const demo = await json(await fetch(`${base}/character/demo`, { headers: { Cookie: sessionA } }));
    const profile = {
      ...(demo.profile as Record<string, unknown>),
      id: "personaje-privado-prueba",
      name: "Solo del visitante A",
    };

    const saved = await fetch(`${base}/character`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionA },
      body: JSON.stringify({ profile }),
    });
    expect(saved.status).toBe(200);

    expect(
      (await fetch(`${base}/character/${profile.id}`, { headers: { Cookie: sessionA } })).status,
    ).toBe(200);
    expect(
      (await fetch(`${base}/character/${profile.id}`, { headers: { Cookie: sessionB } })).status,
    ).toBe(404);
    expect(
      (
        await fetch(`${base}/journal/${profile.id}`, {
          headers: { Cookie: sessionB },
        })
      ).status,
    ).toBe(404);

    const overwrite = await fetch(`${base}/character`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionB },
      body: JSON.stringify({ profile: { ...profile, name: "Intento ajeno" } }),
    });
    expect(overwrite.status).toBe(404);
    const ownerCopy = await json(
      await fetch(`${base}/character/${profile.id}`, { headers: { Cookie: sessionA } }),
    );
    expect((ownerCopy.profile as Record<string, unknown>).name).toBe("Solo del visitante A");
  });

  it("el borrado exige confirmación, invalida la sesión y no toca a otro visitante", async () => {
    const sessionA = await newSession();
    const sessionB = await newSession();
    const demo = await json(await fetch(`${base}/character/demo`, { headers: { Cookie: sessionA } }));
    const profileA = {
      ...(demo.profile as Record<string, unknown>),
      id: "borrado-privado-a",
      name: "Se debe borrar",
    };
    const profileB = {
      ...(demo.profile as Record<string, unknown>),
      id: "borrado-privado-b",
      name: "Se debe conservar",
    };
    for (const [session, profile] of [
      [sessionA, profileA],
      [sessionB, profileB],
    ] as const) {
      const saved = await fetch(`${base}/character`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: session },
        body: JSON.stringify({ profile }),
      });
      expect(saved.status).toBe(200);
    }

    const accidental = await fetch(`${base}/visitor/data`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: sessionA },
      body: JSON.stringify({ confirmation: "no" }),
    });
    expect(accidental.status).toBe(400);
    expect(
      (await fetch(`${base}/character/${profileA.id}`, { headers: { Cookie: sessionA } })).status,
    ).toBe(200);

    const deleted = await fetch(`${base}/visitor/data`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: sessionA },
      body: JSON.stringify({ confirmation: "BORRAR MIS DATOS" }),
    });
    expect(deleted.status).toBe(200);
    expect(await json(deleted)).toMatchObject({ deleted: true, deletedCharacters: 1 });
    expect(deleted.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (await fetch(`${base}/character/${profileA.id}`, { headers: { Cookie: sessionA } })).status,
    ).toBe(404);
    expect(
      (await fetch(`${base}/character/${profileB.id}`, { headers: { Cookie: sessionB } })).status,
    ).toBe(200);
  });

  it("limita el Mentor antes de gastar proveedor externo", async () => {
    const session = await newSession();
    const first = await fetch(`${base}/mentor/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: session },
      body: "{}",
    });
    expect(first.status).toBe(400);

    const second = await fetch(`${base}/mentor/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: session },
      body: "{}",
    });
    expect(second.status).toBe(429);
    expect(await json(second)).toMatchObject({ error: "demasiadas-peticiones" });
    expect(second.headers.get("retry-after")).not.toBeNull();
    expect(second.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(second.headers.get("vary")).toContain("Cookie");
  });

  it("limita escrituras antes de analizar otro cuerpo", async () => {
    const limitedApp = createApiApp({
      dbPath: ":memory:",
      config: {
        nodeEnv: "production",
        secureCookies: true,
        poeNinjaOffline: true,
        writeRateLimitPerMinute: 1,
        apiRateLimitPerMinute: 1_000,
      },
    });
    const limitedServer = await new Promise<Server>((resolve) => {
      const candidate = limitedApp.listen(0, "127.0.0.1", () => resolve(candidate));
    });
    try {
      const { port } = limitedServer.address() as AddressInfo;
      const limitedBase = `http://127.0.0.1:${port}`;
      const session = await newSession(limitedBase);
      const first = await fetch(`${limitedBase}/character`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: session },
        body: "{}",
      });
      expect(first.status).toBe(400);

      const second = await fetch(`${limitedBase}/character`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: session },
        body: "JSON_QUE_NO_DEBE_LLEGAR_AL_PARSER",
      });
      expect(second.status).toBe(429);
      expect(await json(second)).toMatchObject({ error: "demasiadas-peticiones" });
    } finally {
      await new Promise<void>((resolve, reject) =>
        limitedServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("un error inesperado no filtra detalles internos en producción", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const session = await newSession();
    const demo = await json(await fetch(`${base}/character/demo`, { headers: { Cookie: session } }));
    const profile = demo.profile as Record<string, unknown>;
    const response = await fetch(`${base}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: session },
      body: JSON.stringify({
        profile,
        budget: { amount: 50, currency: "chaos" },
        goal: { kind: "survival" },
        league: profile.league,
        patch: profile.patch,
      }),
    });
    expect(response.status).toBe(500);
    const body = await json(response);
    const requestId = response.headers.get("x-request-id");
    expect(requestId).toMatch(/^ec_[a-f0-9]{16}$/);
    expect(body.error).toBe("error-interno");
    expect(body.requestId).toBe(requestId);
    expect(String(body.detail)).not.toContain("SECRETO_INTERNO");
    expect(JSON.stringify(body)).not.toContain("Solo del visitante A");
    expect(errorLog).toHaveBeenCalledOnce();
    const logged = String(errorLog.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      level: "error",
      event: "api_unexpected_error",
      requestId,
      errorName: "Error",
    });
    expect(JSON.parse(logged).fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(logged).not.toContain("SECRETO_INTERNO");
    expect(logged).not.toContain("Solo del visitante A");
    errorLog.mockRestore();
  });
});
