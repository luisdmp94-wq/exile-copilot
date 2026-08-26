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

describe("frontera pública", () => {
  it("crea una sesión HttpOnly y envía cabeceras de producción", async () => {
    const response = await fetch(`${base}/health`);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain("exile_copilot_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("x-request-id")).toMatch(/^ec_[a-f0-9]{16}$/);
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
    const sessionA = cookieFrom(await fetch(`${base}/health`));
    const sessionB = cookieFrom(await fetch(`${base}/health`));
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

  it("limita el Mentor antes de gastar proveedor externo", async () => {
    const session = cookieFrom(await fetch(`${base}/health`));
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
      const session = cookieFrom(await fetch(`${limitedBase}/health`));
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
    const session = cookieFrom(await fetch(`${base}/health`));
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
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining(`[${requestId}]`),
      expect.any(Error),
    );
    errorLog.mockRestore();
  });
});
