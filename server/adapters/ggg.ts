import type { ServerConfig } from "../config.js";

/**
 * Adaptador OAuth de GGG (API oficial de personajes).
 *
 * Estado (solo hechos comprobables): la integración está DESACTIVADA por flag
 * (`GGG_OAUTH_ENABLED=false` por defecto) y el flujo OAuth real todavía no
 * está implementado. Antes de activarla hay que verificar el estado actual
 * del procedimiento de solicitud de aplicaciones OAuth de GGG; este código
 * no afirma nada sobre si GGG acepta o no solicitudes.
 */

export interface GggCharacterRef {
  accountName: string;
  characterName: string;
}

export interface GggCharacterResult {
  ok: boolean;
  profile?: unknown;
  error?: string;
  detail?: string;
}

export interface GggCharacterSource {
  isEnabled(): boolean;
  fetchCharacter(ref: GggCharacterRef): Promise<GggCharacterResult>;
}

/** Implementación stub controlada por flag. Nunca hace red. */
export class StubGggCharacterSource implements GggCharacterSource {
  readonly #config: ServerConfig;

  constructor(config: ServerConfig) {
    this.#config = config;
  }

  isEnabled(): boolean {
    return this.#config.gggOauthEnabled;
  }

  fetchCharacter(_ref: GggCharacterRef): Promise<GggCharacterResult> {
    if (!this.#config.gggOauthEnabled) {
      return Promise.resolve({
        ok: false,
        error: "ggg-oauth-disabled",
        detail:
          "Integración desactivada por flag (GGG_OAUTH_ENABLED=false) y flujo OAuth aún no implementado. " +
          "Antes de activarla, verifica el estado actual del procedimiento de solicitud de aplicaciones OAuth de GGG. " +
          "Mientras tanto, usa la importación por archivo .build, código PoB o texto de objeto.",
      });
    }
    // Rama futura: aquí iría el flujo OAuth real de GGG.
    return Promise.resolve({
      ok: false,
      error: "ggg-oauth-not-implemented",
      detail: "La integración OAuth de GGG aún no está implementada en esta versión.",
    });
  }
}
