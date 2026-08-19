/**
 * Configuración del backend leída de variables de entorno.
 * Los valores por defecto replican `.env.example` (documentado allí).
 */

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  poeNinjaUserAgent: string;
  poeNinjaCacheTtlSeconds: number;
  poeNinjaOffline: boolean;
  defaultLeague: string;
  defaultPatch: string;
  databasePath: string;
  gggOauthEnabled: boolean;
  explainerLlmEnabled: boolean;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: int(env.PORT, 7177),
    nodeEnv: env.NODE_ENV ?? "development",
    poeNinjaUserAgent:
      env.POE_NINJA_USER_AGENT ?? "exile-copilot/0.1.0 (contacto: local-dev)",
    poeNinjaCacheTtlSeconds: int(env.POE_NINJA_CACHE_TTL_SECONDS, 900),
    poeNinjaOffline: bool(env.POE_NINJA_OFFLINE, false),
    defaultLeague: env.DEFAULT_LEAGUE ?? "Runes of Aldur",
    defaultPatch: env.DEFAULT_PATCH ?? "0.5.0",
    databasePath: env.DATABASE_PATH ?? "./data/exile-copilot.db",
    gggOauthEnabled: bool(env.GGG_OAUTH_ENABLED, false),
    explainerLlmEnabled: bool(env.EXPLAINER_LLM_ENABLED, false),
  };
}

/** Configuración singleton para el servidor standalone. */
export const config = loadConfig();
