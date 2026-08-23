/**
 * Arranque portable de Playwright: Edge en Windows, Chromium headless en Linux.
 * No descarga navegadores; usa el que ya hay en el sistema o PLAYWRIGHT_BROWSERS_PATH.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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
  // En Windows, SQLite/Edge pueden tardar unos milisegundos en liberar el
  // último handle después de detener el proceso. `rmSync` solo reintenta si se
  // le indica explícitamente; sin esto un smoke completamente correcto podía
  // terminar con EPERM durante su propia limpieza.
  try {
    rmSync(abs, {
      recursive: true,
      force: true,
      // La última escritura del expediente hace que SQLite cierre el WAL justo
      // al final del smoke; en Windows ese handle puede tardar algo más de un
      // segundo en liberarse aunque el servidor ya no escuche.
      maxRetries: 20,
      retryDelay: 250,
    });
    return true;
  } catch (error) {
    // Antivirus e indexadores de Windows pueden retener un handle incluso
    // después de que los puertos estén libres. El smoke ya terminó: se informa
    // del temporal pendiente sin convertir una limpieza tardía en un falso
    // fallo funcional.
    if (error?.code === "EPERM" || error?.code === "EBUSY") {
      console.warn(`[smoke] Windows aún mantiene abierto el temporal propio: ${abs}`);
      return false;
    }
    throw error;
  }
}

/**
 * Cómo arrancar una herramienta local (`vite`, `tsx`) desde un smoke.
 *
 * Por defecto `npx`, exactamente como hasta ahora. `SMOKE_NODE` permite indicar
 * un ejecutable de Node concreto cuando el entorno no tiene `npx` en el PATH:
 * en ese caso la herramienta se invoca por su ruta DENTRO de `node_modules`,
 * sin instalar ni descargar nada. No cambia el comportamiento del producto ni
 * lo que comprueba el smoke: solo quién lanza el proceso.
 */
const LOCAL_TOOL_ENTRYPOINTS = {
  vite: "node_modules/vite/bin/vite.js",
  tsx: "node_modules/tsx/dist/cli.mjs",
};

export function toolCommand(tool, args) {
  const node = process.env.SMOKE_NODE;
  const entry = LOCAL_TOOL_ENTRYPOINTS[tool];
  if (node && entry) {
    const abs = fileURLToPath(new URL(`../${entry}`, import.meta.url));
    return { command: node, args: [abs, ...args], shell: false };
  }
  return { command: "npx", args: [tool, ...args], shell: true };
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
