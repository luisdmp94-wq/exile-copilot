import { app } from "electron";

/**
 * Versiones nuevas de la ventanita instalada. Solo corre en la versión
 * instalada con el instalador: abierta desde la carpeta del código
 * (`ventanita.cmd`) no mira nada, porque ahí «actualizar» es compilar.
 *
 * Qué hace: al arrancar, y cada seis horas, pregunta a la dirección de
 * `publish` (package.json) si hay una versión más nueva. Si la hay, la baja
 * de fondo y se instala sola al cerrar la ventanita: nunca reinicia nada a
 * media partida. No manda ningún dato del jugador: es una descarga de dos
 * archivos (`latest.yml` y el instalador).
 *
 * Se puede quitar en los ajustes («Buscar versiones nuevas»).
 */

export interface UpdateStatus {
  /** La versión ya bajada, que se instalará al cerrar; null si no hay. */
  ready: string | null;
  /** Lo último que pasó, para las pruebas: «buscando», «al día», «bajando 0.1.1», un error… */
  last: string;
}

export const updateStatus: UpdateStatus = { ready: null, last: "sin mirar" };

const SIX_HOURS = 6 * 60 * 60 * 1000;
let started = false;

export function watchForUpdates(options: { onChange: () => void; installOnQuit: boolean; feedUrl?: string | null }): void {
  if (started || !app.isPackaged) return;
  started = true;
  // Se carga aquí y no arriba: abierta desde el código no hace falta, y así un fallo suyo no impide arrancar.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = options.installOnQuit;
  // Solo para pruebas: otra dirección de la que bajar (un servidor en este mismo equipo).
  if (options.feedUrl) autoUpdater.setFeedURL({ provider: "generic", url: options.feedUrl });

  const note = (last: string, ready: string | null = updateStatus.ready) => {
    updateStatus.last = last;
    updateStatus.ready = ready;
    options.onChange();
  };
  autoUpdater.on("checking-for-update", () => note("buscando"));
  autoUpdater.on("update-not-available", () => note("al día"));
  autoUpdater.on("update-available", (info) => note(`bajando ${info.version}`));
  autoUpdater.on("update-downloaded", (info) => note(`lista ${info.version}`, info.version));
  // Sin red, o sin nada publicado todavía: no es un problema del jugador, no se le avisa.
  autoUpdater.on("error", (error) => note(`error: ${String(error?.message ?? error).split("\n")[0]}`));

  const check = () => void autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, SIX_HOURS).unref();
}
