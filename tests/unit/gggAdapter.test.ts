import { describe, expect, it } from "vitest";
import { StubGggCharacterSource } from "../../server/adapters/ggg.js";
import { loadConfig } from "../../server/config.js";

/**
 * El adaptador OAuth de GGG solo comunica hechos comprobables:
 * flag desactivada y flujo sin implementar. Nunca afirma conclusiones
 * no verificadas sobre GGG (p. ej. que no procese nuevas solicitudes).
 */
describe("adaptador GGG OAuth (stub por flag)", () => {
  it("desactivado: explica el flag y la falta de implementación, sin afirmar nada sobre GGG", async () => {
    const source = new StubGggCharacterSource({ ...loadConfig({}), gggOauthEnabled: false });
    expect(source.isEnabled()).toBe(false);

    const result = await source.fetchCharacter({ accountName: "a", characterName: "c" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ggg-oauth-disabled");

    const detail = result.detail ?? "";
    // Hechos comprobables presentes:
    expect(detail).toContain("GGG_OAUTH_ENABLED=false");
    expect(detail).toContain("no implementado");
    expect(detail).toContain("verifica el estado actual");
    // La afirmación obsoleta no puede volver, en ninguna variante:
    expect(detail).not.toMatch(/no procesa/i);
    expect(detail).not.toMatch(/nuevas aplicaciones OAuth\b(?!.*verifica)/i);
    expect(detail).not.toMatch(/GGG (rechaza|no acepta|no admite)/i);
  });

  it("activado por flag: declara que el flujo real no está implementado", async () => {
    const source = new StubGggCharacterSource({ ...loadConfig({}), gggOauthEnabled: true });
    expect(source.isEnabled()).toBe(true);

    const result = await source.fetchCharacter({ accountName: "a", characterName: "c" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("ggg-oauth-not-implemented");
    expect(result.detail).toContain("no está implementada");
    expect(result.detail ?? "").not.toMatch(/no procesa/i);
  });
});
