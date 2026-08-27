import { config } from "../server/config.js";
import { auditPublicDeploymentConfig } from "../server/deploymentReadiness.js";

const checks = auditPublicDeploymentConfig(config);
for (const check of checks) {
  const symbol = check.status === "pass" ? "OK" : "BLOQUEO";
  console.log(`[${symbol}] ${check.message}`);
}

const blockers = checks.filter((check) => check.status === "block");
if (blockers.length > 0) {
  console.error(
    `\nPublicación detenida: ${blockers.length} ${blockers.length === 1 ? "comprobación pendiente" : "comprobaciones pendientes"}.`,
  );
  process.exitCode = 1;
} else {
  console.log("\nConfiguración pública lista para ejecutar la barrera de release.");
}
