import type { ServerConfig } from "../config.js";

/**
 * Adaptador OAuth de GGG (API oficial de personajes).
 *
 * CONTEXTO: GGG no procesa actualmente nuevas aplicaciones OAuth para la API
 * de PoE2. El MVP no depende de este adaptador: está desactivado por flag
 * (`GGG_OAUTH_ENABLED=false` por defecto) y la implementación real queda
 * preparada detrás de la interfaz `GggCharacterSource` para el futuro.
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
          "Desactivado por flag (GGG_OAUTH_ENABLED=false): GGG no procesa nuevas aplicaciones OAuth. " +
          "Usa la importación por archivo .build, código PoB o texto de objeto.",
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
