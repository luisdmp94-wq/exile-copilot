import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadConfig } from "../../server/config.js";
import {
  assertPublicDeploymentConfig,
  auditPublicDeploymentConfig,
} from "../../server/deploymentReadiness.js";

describe("barrera de configuración pública", () => {
  it("mantiene el servidor local y sin publicación explícita por defecto", () => {
    const config = loadConfig({});
    expect(config.host).toBe("127.0.0.1");
    expect(config.publicDeployment).toBe(false);
    expect(() => assertPublicDeploymentConfig(config)).not.toThrow();
  });

  it("acota la vigencia de precios para que una errata no verifique datos durante años", () => {
    expect(
      loadConfig({ POE_NINJA_CACHE_TTL_SECONDS: "-30" }).poeNinjaCacheTtlSeconds,
    ).toBe(0);
    expect(
      loadConfig({ POE_NINJA_CACHE_TTL_SECONDS: "31536000" })
        .poeNinjaCacheTtlSeconds,
    ).toBe(3_600);
  });

  it("bloquea una publicación que reutiliza valores locales o efímeros", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "development",
      SECURE_COOKIES: "false",
      DATABASE_PATH: ":memory:",
      MENTOR_AI_ENABLED: "true",
    });
    const blockedIds = auditPublicDeploymentConfig(config)
      .filter((check) => check.status === "block")
      .map((check) => check.id);

    expect(blockedIds).toEqual([
      "node-env",
      "secure-cookies",
      "trusted-proxy",
      "persistent-database",
      "poe-ninja-identity",
      "mentor-key",
    ]);
    expect(() => assertPublicDeploymentConfig(config)).toThrow(
      /Configuración pública bloqueada/,
    );
  });

  it("acepta una configuración pública explícita, persistente y sin IA externa", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "true",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_USER_AGENT: "exile-copilot/1.0 (contacto: https://example.invalid)",
      MENTOR_AI_ENABLED: "false",
    });

    expect(auditPublicDeploymentConfig(config).every((check) => check.status === "pass")).toBe(
      true,
    );
    expect(() => assertPublicDeploymentConfig(config)).not.toThrow();
  });

  it("no exige identidad de poe.ninja cuando el mercado está explícitamente offline", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "true",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_OFFLINE: "true",
      MENTOR_AI_ENABLED: "false",
    });

    expect(
      auditPublicDeploymentConfig(config).find(
        (check) => check.id === "poe-ninja-identity",
      ),
    ).toMatchObject({ status: "pass" });
  });

  it.each([
    "exile-copilot/1.0 (contacto: )",
    "exile-copilot/1.0 (contact: @)",
    "exile-copilot/1.0 (contact: https://servidor-interno)",
  ])("bloquea un contacto de poe.ninja que solo parece identificable: %s", (userAgent) => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "true",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_USER_AGENT: userAgent,
      MENTOR_AI_ENABLED: "false",
    });

    expect(
      auditPublicDeploymentConfig(config).find(
        (check) => check.id === "poe-ninja-identity",
      ),
    ).toMatchObject({ status: "block" });
    expect(() => assertPublicDeploymentConfig(config)).toThrow(/formato válido/);
  });

  it("acepta un correo completo como identidad de poe.ninja", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "true",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_USER_AGENT: "exile-copilot/1.0 (contacto: equipo@example.invalid)",
      MENTOR_AI_ENABLED: "false",
    });

    expect(
      auditPublicDeploymentConfig(config).find(
        (check) => check.id === "poe-ninja-identity",
      ),
    ).toMatchObject({ status: "pass" });
  });
});
