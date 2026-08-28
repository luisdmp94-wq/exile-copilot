import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../server/config.js";
import { auditRuntimeReadiness } from "../../server/runtimeReadiness.js";

describe("disponibilidad de la instancia", () => {
  it("autoriza una instancia pública cuando runtime, parche y configuración pasan", () => {
    const databasePath = resolve("datos", "exile-copilot.db");
    const config = loadConfig({
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "true",
      DATABASE_PATH: databasePath,
      POE_NINJA_OFFLINE: "true",
      MENTOR_AI_ENABLED: "false",
      DEFAULT_PATCH: "0.5.4f",
    });

    expect(
      auditRuntimeReadiness({
        config,
        databasePath,
        databaseOperational: true,
        patchKnown: true,
        patchGuidanceAllowed: true,
      }),
    ).toEqual([
      expect.objectContaining({ id: "database", status: "pass" }),
      expect.objectContaining({ id: "patch-metadata", status: "pass" }),
      expect.objectContaining({ id: "patch-guidance", status: "pass" }),
      expect.objectContaining({ id: "public-config", status: "pass" }),
    ]);
  });

  it("usa la ruta realmente abierta y bloquea una SQLite efímera en modo público", () => {
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
      auditRuntimeReadiness({
        config,
        databasePath: ":memory:",
        databaseOperational: true,
        patchKnown: true,
        patchGuidanceAllowed: true,
      }).find((check) => check.id === "public-config"),
    ).toMatchObject({ status: "block" });
  });
});
