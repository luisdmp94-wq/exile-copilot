/**
 * Arranque portable de Playwright: Edge en Windows, Chromium headless en Linux.
 * No descarga navegadores; usa el que ya hay en el sistema o PLAYWRIGHT_BROWSERS_PATH.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

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
