import { isAbsolute } from "node:path";
import type { ServerConfig } from "./config.js";

export type DeploymentReadinessStatus = "pass" | "block";

export interface DeploymentReadinessCheck {
  id:
    | "public-mode"
    | "node-env"
    | "secure-cookies"
    | "trusted-proxy"
    | "persistent-database"
    | "poe-ninja-identity"
    | "ggg-oauth-disabled"
    | "explainer-llm-disabled"
    | "mentor-key";
  status: DeploymentReadinessStatus;
  message: string;
}

function hasIdentifiablePoeNinjaContact(value: string): boolean {
  const candidate = value.trim();
  if (candidate === "" || candidate.toLowerCase().includes("local-dev")) return false;

  const email = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  if (email.test(candidate)) return true;

  const urls = candidate.match(/https?:\/\/[^\s)]+/gi) ?? [];
  return urls.some((rawUrl) => {
    try {
      const parsed = new URL(rawUrl);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.hostname.includes(".")
      );
    } catch {
      return false;
    }
  });
}

/**
 * Barrera pura de configuración pública. No comprueba el parche ni inventa
 * disponibilidad externa: esas evidencias pertenecen a `readiness:1.0` y al
 * smoke de release. Aquí solo se impide abrir Internet con una configuración
 * local, efímera o incapaz de mantener sesiones seguras.
 */
export function auditPublicDeploymentConfig(
  config: ServerConfig,
): DeploymentReadinessCheck[] {
  const publicMode = config.publicDeployment;
  const production = config.nodeEnv === "production";
  const persistentDatabase =
    config.databasePath !== ":memory:" && isAbsolute(config.databasePath);
  const identifiedClient =
    config.poeNinjaOffline || hasIdentifiablePoeNinjaContact(config.poeNinjaUserAgent);
  const mentorReady = !config.mentorAiEnabled || config.mentorAiApiKey !== null;

  return [
    {
      id: "public-mode",
      status: publicMode ? "pass" : "block",
      message: publicMode
        ? "El despliegue declara explícitamente que recibirá usuarios reales."
        : "Falta PUBLIC_DEPLOYMENT=true; el arranque seguirá siendo local.",
    },
    {
      id: "node-env",
      status: production ? "pass" : "block",
      message: production
        ? "NODE_ENV está en production."
        : "Un despliegue público exige NODE_ENV=production.",
    },
    {
      id: "secure-cookies",
      status: config.secureCookies ? "pass" : "block",
      message: config.secureCookies
        ? "Las cookies anónimas exigen HTTPS."
        : "Un despliegue público exige SECURE_COOKIES=true y terminación HTTPS.",
    },
    {
      id: "trusted-proxy",
      status: config.trustProxy ? "pass" : "block",
      message: config.trustProxy
        ? "Express confía en el proxy HTTPS controlado para identificar al visitante."
        : "Un despliegue público exige TRUST_PROXY=true detrás del proxy HTTPS controlado.",
    },
    {
      id: "persistent-database",
      status: persistentDatabase ? "pass" : "block",
      message: persistentDatabase
        ? "SQLite usa una ruta absoluta que puede montarse como volumen persistente."
        : "DATABASE_PATH debe ser una ruta absoluta y persistente; no se admite :memory: ni la ruta local por defecto.",
    },
    {
      id: "poe-ninja-identity",
      status: identifiedClient ? "pass" : "block",
      message: identifiedClient
        ? config.poeNinjaOffline
          ? "poe.ninja está desactivado; no saldrán peticiones de mercado."
          : "poe.ninja recibirá un User-Agent identificable."
        : "POE_NINJA_USER_AGENT debe sustituir local-dev por un correo o URL de contacto con formato válido.",
    },
    {
      id: "ggg-oauth-disabled",
      status: config.gggOauthEnabled ? "block" : "pass",
      message: config.gggOauthEnabled
        ? "GGG_OAUTH_ENABLED no puede activarse públicamente: el flujo OAuth todavía no está implementado."
        : "El adaptador OAuth incompleto de GGG permanece desactivado.",
    },
    {
      id: "explainer-llm-disabled",
      status: config.explainerLlmEnabled ? "block" : "pass",
      message: config.explainerLlmEnabled
        ? "EXPLAINER_LLM_ENABLED no puede activarse públicamente: todavía no existe un proveedor operativo."
        : "El explicador LLM incompleto permanece desactivado; se usa el explicador determinista.",
    },
    {
      id: "mentor-key",
      status: mentorReady ? "pass" : "block",
      message: mentorReady
        ? config.mentorAiEnabled
          ? "El Mentor IA tiene una clave de servidor configurada."
          : "El Mentor IA está desactivado; el respaldo determinista seguirá disponible."
        : `MENTOR_AI_ENABLED=true exige la clave del proveedor ${config.mentorAiProvider}.`,
    },
  ];
}

export function assertPublicDeploymentConfig(config: ServerConfig): void {
  if (!config.publicDeployment) return;
  const blockers = auditPublicDeploymentConfig(config).filter(
    (check) => check.status === "block" && check.id !== "public-mode",
  );
  if (blockers.length === 0) return;
  throw new Error(
    [
      "Configuración pública bloqueada:",
      ...blockers.map((check) => `- ${check.message}`),
    ].join("\n"),
  );
}
