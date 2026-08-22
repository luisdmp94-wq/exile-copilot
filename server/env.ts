import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

/**
 * Carga secretos locales desde `.env` antes de construir la configuración.
 * Node no sobrescribe variables ya definidas por el proceso, por lo que el
 * despliegue siempre puede imponer sus propios valores.
 */
export function loadLocalEnvironment(envPath = resolve(process.cwd(), ".env")): boolean {
  if (!existsSync(envPath)) return false;
  loadEnvFile(envPath);
  return true;
}

loadLocalEnvironment();
