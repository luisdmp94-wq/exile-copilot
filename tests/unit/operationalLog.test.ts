import { describe, expect, it, vi } from "vitest";
import {
  logMentorProviderFallback,
  logRateLimitExceeded,
  logUnexpectedApiError,
} from "../../server/operationalLog.js";

describe("eventos operativos seguros", () => {
  it("registra saturación sin aceptar IP, cookie, ruta ni datos del jugador", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      logRateLimitExceeded({
        scope: "mentor",
        requestId: "ec_0123456789abcdef",
        limit: 15,
        retryAfterSeconds: 42,
      });

      const line = String(warning.mock.calls[0]?.[0]);
      expect(JSON.parse(line)).toMatchObject({
        level: "warn",
        event: "rate_limit_exceeded",
        requestId: "ec_0123456789abcdef",
        scope: "mentor",
        limit: 15,
        retryAfterSeconds: 42,
      });
      expect(line).not.toMatch(/ip|cookie|path|character|tooltip/i);
    } finally {
      warning.mockRestore();
    }
  });

  it("agrupa un 500 sin registrar el mensaje que podría contener contenido privado", () => {
    const failure = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      logUnexpectedApiError({
        requestId: "ec_fedcba9876543210",
        error: new Error("SECRETO: Objeto raro de Luis"),
      });

      const line = String(failure.mock.calls[0]?.[0]);
      expect(JSON.parse(line)).toMatchObject({
        level: "error",
        event: "api_unexpected_error",
        requestId: "ec_fedcba9876543210",
        errorName: "Error",
      });
      expect(JSON.parse(line).fingerprint).toMatch(/^[a-f0-9]{16}$/);
      expect(line).not.toContain("SECRETO");
      expect(line).not.toContain("Luis");
    } finally {
      failure.mockRestore();
    }
  });

  it("clasifica el respaldo del Mentor sin registrar su motivo textual", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      logMentorProviderFallback({
        requestId: "ec_0123456789abcdef",
        provider: "groq",
        reason: "La IA tardó demasiado; pregunta privada de Luis.",
      });

      const line = String(warning.mock.calls[0]?.[0]);
      expect(JSON.parse(line)).toMatchObject({
        event: "mentor_provider_fallback",
        requestId: "ec_0123456789abcdef",
        provider: "groq",
        category: "timeout",
      });
      expect(line).not.toContain("pregunta privada");
      expect(line).not.toContain("Luis");
    } finally {
      warning.mockRestore();
    }
  });
});
