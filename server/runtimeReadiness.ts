import type { ServerConfig } from "./config.js";
import { auditPublicDeploymentConfig } from "./deploymentReadiness.js";

export type RuntimeReadinessStatus = "pass" | "block";

export interface RuntimeReadinessCheck {
  id: "database" | "patch-metadata" | "patch-guidance" | "public-config";
  status: RuntimeReadinessStatus;
  message: string;
}

export interface RuntimeReadinessInput {
  config: ServerConfig;
  /** Ruta realmente abierta por la app; en tests puede diferir del valor de configuración. */
  databasePath: string;
  databaseOperational: boolean;
  patchKnown: boolean;
  patchGuidanceAllowed: boolean;
}

/**
 * Estado que puede consumir un orquestador antes de enviar tráfico real.
 *
 * `/health` solo demuestra que el proceso HTTP sigue vivo. Esta auditoría es
 * deliberadamente más estricta: exige SQLite, metadatos del parche y permiso
 * explícito para orientar sobre ese parche. La configuración pública solo se
 * exige cuando la propia instancia declara que recibirá usuarios reales, por
 * lo que desarrollo local también puede tener una señal de disponibilidad útil.
 */
export function auditRuntimeReadiness(
  input: RuntimeReadinessInput,
): RuntimeReadinessCheck[] {
  const effectiveConfig = { ...input.config, databasePath: input.databasePath };
  const publicBlockers = input.config.publicDeployment
    ? auditPublicDeploymentConfig(effectiveConfig).filter(
        (check) => check.status === "block",
      )
    : [];

  return [
    {
      id: "database",
      status: input.databaseOperational ? "pass" : "block",
      message: input.databaseOperational
        ? "SQLite acepta lecturas."
        : "SQLite no responde; la instancia no puede conservar expedientes.",
    },
    {
      id: "patch-metadata",
      status: input.patchKnown ? "pass" : "block",
      message: input.patchKnown
        ? `El parche ${input.config.defaultPatch} tiene metadatos versionados.`
        : `El parche ${input.config.defaultPatch} no existe en el registro versionado.`,
    },
    {
      id: "patch-guidance",
      status: input.patchGuidanceAllowed ? "pass" : "block",
      message: input.patchGuidanceAllowed
        ? `La orientación para ${input.config.defaultPatch} está autorizada por su cobertura.`
        : `La orientación para ${input.config.defaultPatch} está detenida hasta revisar su cobertura.`,
    },
    {
      id: "public-config",
      status: publicBlockers.length === 0 ? "pass" : "block",
      message:
        publicBlockers.length === 0
          ? input.config.publicDeployment
            ? "La configuración declarada para usuarios reales supera la barrera pública."
            : "Instancia local: no declara tráfico de usuarios reales."
          : publicBlockers.map((check) => check.message).join(" "),
    },
  ];
}
