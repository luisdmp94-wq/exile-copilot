/**
 * Arranque portable de Playwright: Edge en Windows, Chromium headless en Linux.
 * No descarga navegadores; usa el que ya hay en el sistema o PLAYWRIGHT_BROWSERS_PATH.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { chromium } from "playwright";

/** Prefijo obligatorio de todo temporal de smoke; también sirve de guardia al borrar. */
const SMOKE_TEMP_PREFIX = "exile-copilot-";

/**
 * Carpeta temporal ÚNICA por ejecución para la base SQLite del smoke.
 *
 * Ningún smoke puede tocar la base real del usuario: cada ejecución crea la
 * suya y se la pasa al servidor por `DATABASE_PATH`.
 */
export function createSmokeTempDir(suffix) {
  if (typeof suffix !== "string" || !/^[a-z0-9-]+$/.test(suffix)) {
    throw new Error(`sufijo de temporal no válido: ${String(suffix)}`);
  }
  return mkdtempSync(join(realpathSync(tmpdir()), `${SMOKE_TEMP_PREFIX}${suffix}-`));
}

/**
 * Borra SOLO una carpeta creada por `createSmokeTempDir`, tras validar su ruta
 * absoluta: debe estar dentro del temporal del sistema y llevar el prefijo. Si
 * no lo cumple no se borra nada y se avisa: nunca se toca `data/`, una base
 * existente ni datos del usuario.
 */
export function removeSmokeTempDir(dir) {
  if (typeof dir !== "string" || dir.trim() === "") return false;
  const abs = resolve(dir);
  const tmpAbs = resolve(realpathSync(tmpdir()));
  const dentroDelTemporal = abs !== tmpAbs && abs.startsWith(tmpAbs + sep);
  if (!dentroDelTemporal || !basename(abs).startsWith(SMOKE_TEMP_PREFIX)) {
    console.warn(`[smoke] ruta no reconocida como temporal propio, NO se borra: ${abs}`);
    return false;
  }
  rmSync(abs, { recursive: true, force: true });
  return true;
}

const HEADLESS_SHELL =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  "/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";

export async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    if (existsSync(HEADLESS_SHELL)) {
      return chromium.launch({ executablePath: HEADLESS_SHELL, headless: true });
    }
    return chromium.launch({ headless: true });
  }
}

export function stopChild(proc) {
  if (!proc?.pid) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" });
    } catch {
      try {
        proc.kill();
      } catch {
        /* ya detenido */
      }
    }
    return;
  }
  try {
    proc.kill("SIGTERM");
  } catch {
    /* ya detenido */
  }
}
