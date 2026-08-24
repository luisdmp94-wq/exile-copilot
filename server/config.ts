/**
 * Configuración del backend leída de variables de entorno.
 * Los valores por defecto replican `.env.example` (documentado allí).
 */

import "./env.js";

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
  /** Mentor v3: conversación IA fundamentada. Apagada por defecto. */
  mentorAiEnabled: boolean;
  /** Proveedor de inferencia. Groq permite probar el mentor sin facturación. */
  mentorAiProvider: "groq" | "openai";
  /** Solo se lee en el servidor y nunca se expone a la interfaz. */
  mentorAiApiKey: string | null;
  mentorAiModel: string;
  mentorAiReasoningEffort: "none" | "low" | "medium" | "high";
  mentorAiTimeoutMs: number;
  mentorAiMaxOutputTokens: number;
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

function boundedInt(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, int(value, fallback)));
}

function reasoningEffort(
  value: string | undefined,
): ServerConfig["mentorAiReasoningEffort"] {
  return value === "none" || value === "low" || value === "medium" || value === "high"
    ? value
    : "low";
}

function mentorAiProvider(value: string | undefined): ServerConfig["mentorAiProvider"] {
  return value?.trim().toLowerCase() === "openai" ? "openai" : "groq";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const provider = mentorAiProvider(env.MENTOR_AI_PROVIDER);
  return {
    port: int(env.PORT, 7177),
    nodeEnv: env.NODE_ENV ?? "development",
    poeNinjaUserAgent:
      env.POE_NINJA_USER_AGENT ?? "exile-copilot/0.1.0 (contacto: local-dev)",
    poeNinjaCacheTtlSeconds: int(env.POE_NINJA_CACHE_TTL_SECONDS, 900),
    poeNinjaOffline: bool(env.POE_NINJA_OFFLINE, false),
    defaultLeague: env.DEFAULT_LEAGUE ?? "Runes of Aldur",
    defaultPatch: env.DEFAULT_PATCH ?? "0.5.4f",
    databasePath: env.DATABASE_PATH ?? "./data/exile-copilot.db",
    gggOauthEnabled: bool(env.GGG_OAUTH_ENABLED, false),
    explainerLlmEnabled: bool(env.EXPLAINER_LLM_ENABLED, false),
    mentorAiEnabled: bool(env.MENTOR_AI_ENABLED, false),
    mentorAiProvider: provider,
    mentorAiApiKey:
      (provider === "groq" ? env.GROQ_API_KEY : env.OPENAI_API_KEY)?.trim() || null,
    mentorAiModel:
      env.MENTOR_AI_MODEL?.trim() ||
      (provider === "groq" ? "openai/gpt-oss-120b" : "gpt-5.4-mini"),
    mentorAiReasoningEffort: reasoningEffort(env.MENTOR_AI_REASONING_EFFORT),
    mentorAiTimeoutMs: boundedInt(env.MENTOR_AI_TIMEOUT_MS, 12_000, 1_000, 30_000),
    mentorAiMaxOutputTokens: boundedInt(env.MENTOR_AI_MAX_OUTPUT_TOKENS, 256, 128, 1_024),
  };
}

/** Configuración singleton para el servidor standalone. */
export const config = loadConfig();
