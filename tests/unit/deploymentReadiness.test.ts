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
      TRUST_PROXY: "loopback",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_USER_AGENT: "exile-copilot/1.0 (contacto: https://exilecopilot.app/contacto)",
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
      TRUST_PROXY: "loopback",
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
    "exile-copilot/1.0 (contact: https://example.invalid/contacto)",
    "exile-copilot/1.0 (contact: https://example.com/contacto)",
    "exile-copilot/1.0 (contact: equipo@example.invalid)",
  ])("bloquea un contacto de poe.ninja que solo parece identificable: %s", (userAgent) => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "loopback",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_USER_AGENT: userAgent,
      MENTOR_AI_ENABLED: "false",
    });

    expect(
      auditPublicDeploymentConfig(config).find(
        (check) => check.id === "poe-ninja-identity",
      ),
    ).toMatchObject({ status: "block" });
    expect(() => assertPublicDeploymentConfig(config)).toThrow(/contacto real/);
  });

  it("acepta un correo completo como identidad de poe.ninja", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "loopback",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_USER_AGENT: "exile-copilot/1.0 (contacto: equipo@exilecopilot.app)",
      MENTOR_AI_ENABLED: "false",
    });

    expect(
      auditPublicDeploymentConfig(config).find(
        (check) => check.id === "poe-ninja-identity",
      ),
    ).toMatchObject({ status: "pass" });
  });

  it("bloquea capacidades incompletas aunque el resto de producción sea seguro", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "loopback",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_OFFLINE: "true",
      GGG_OAUTH_ENABLED: "true",
      EXPLAINER_LLM_ENABLED: "true",
      MENTOR_AI_ENABLED: "false",
    });
    const blocked = auditPublicDeploymentConfig(config).filter(
      (check) => check.status === "block",
    );

    expect(blocked).toEqual([
      expect.objectContaining({
        id: "ggg-oauth-disabled",
        message: expect.stringContaining("todavía no está implementado"),
      }),
      expect.objectContaining({
        id: "explainer-llm-disabled",
        message: expect.stringContaining("no existe un proveedor operativo"),
      }),
    ]);
    expect(() => assertPublicDeploymentConfig(config)).toThrow(/GGG_OAUTH_ENABLED/);
    expect(() => assertPublicDeploymentConfig(config)).toThrow(/EXPLAINER_LLM_ENABLED/);
  });

  it("bloquea TRUST_PROXY=true porque permite confiar en cualquier salto", () => {
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "true",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_OFFLINE: "true",
      MENTOR_AI_ENABLED: "false",
    });

    const proxyCheck = auditPublicDeploymentConfig(config).find(
      (check) => check.id === "trusted-proxy",
    );
    expect(proxyCheck).toMatchObject({ status: "block" });
    expect(proxyCheck?.message).toContain("no es seguro en público");
  });

  it("acepta una IP o CIDR explícita y rechaza una red universal", () => {
    const baseEnv = {
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      DATABASE_PATH: resolve("datos", "exile-copilot.db"),
      POE_NINJA_OFFLINE: "true",
      MENTOR_AI_ENABLED: "false",
    };

    expect(
      auditPublicDeploymentConfig(
        loadConfig({ ...baseEnv, TRUST_PROXY: "10.20.0.0/24" }),
      ).find((check) => check.id === "trusted-proxy"),
    ).toMatchObject({ status: "pass" });
    expect(
      auditPublicDeploymentConfig(
        loadConfig({ ...baseEnv, TRUST_PROXY: "0.0.0.0/0" }),
      ).find((check) => check.id === "trusted-proxy"),
    ).toMatchObject({ status: "block" });
  });
});
