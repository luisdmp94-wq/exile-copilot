import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrowserWindow, Menu, Tray, app, dialog, globalShortcut, ipcMain, nativeImage, screen } from "electron";
import { ClientLogTail, findClientLog } from "./clientLog";
import { START, enterZone, moveStep, sanitize, viewOf, type Progress } from "./progress";

/**
 * Ventanita guía de Exile Copilot. Una ventana aparte, siempre encima, que
 * deja pasar los clics al juego. Solo LEE Client.txt: no toca la memoria del
 * juego, no le inyecta nada y no le manda teclas ni clics. Las teclas Re Pág
 * y Av Pág las escucha esta ventana para cambiar de paso.
 */

const WIDTH = 340;
const KEYS = { prev: "PageUp", next: "PageDown", move: "Control+Alt+M" } as const;

interface Saved {
  progress: Progress;
  x?: number;
  y?: number;
  logPath?: string;
}

const statePath = () => join(app.getPath("userData"), "estado.json");

function loadSaved(): Saved {
  try {
    const raw = JSON.parse(readFileSync(statePath(), "utf8")) as Partial<Saved>;
    return { ...raw, progress: sanitize(raw.progress) };
  } catch {
    return { progress: START };
  }
}

let saved: Saved;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let tail: ClientLogTail | null = null;
let moving = false;
let problem: string | null = null;

function persist(): void {
  try {
    mkdirSync(dirname(statePath()), { recursive: true });
    writeFileSync(statePath(), JSON.stringify(saved, null, 2));
  } catch {
    // Sin poder guardar, la ventanita sigue; solo olvida el paso al cerrarla.
  }
}

function render(): void {
  win?.webContents.send("estado", { view: viewOf(saved.progress), moving, problem, keys: KEYS });
}

function setProgress(next: Progress): void {
  saved = { ...saved, progress: next };
  persist();
  render();
}

function defaultPosition(): { x: number; y: number } {
  // A la derecha, bajo el minimapa de PoE2, en la pantalla principal.
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - WIDTH - Math.round(area.width * 0.015),
    y: area.y + Math.round(area.height * 0.27),
  };
}

function startTail(path: string): void {
  tail?.stop();
  problem = null;
  tail = new ClientLogTail(path, (area) => setProgress(enterZone(saved.progress, area.code)));
  try {
    tail.start();
  } catch {
    problem = "No puedo leer Client.txt.";
  }
  render();
}

async function chooseLog(): Promise<void> {
  const result = await dialog.showOpenDialog({
    title: "Elige el Client.txt de Path of Exile 2 (carpeta logs del juego)",
    filters: [{ name: "Client.txt", extensions: ["txt"] }],
    properties: ["openFile"],
  });
  const path = result.filePaths[0];
  if (result.canceled || !path) return;
  saved = { ...saved, logPath: path };
  persist();
  startTail(path);
}

function setMoving(next: boolean): void {
  if (!win) return;
  moving = next;
  win.setIgnoreMouseEvents(!next);
  win.setFocusable(next);
  if (!next) {
    const [x, y] = win.getPosition();
    saved = { ...saved, x, y };
    persist();
  }
  render();
  buildTrayMenu();
}

/** Un círculo ámbar de 16 px para la bandeja, sin archivos de imagen. */
function trayIcon(): Electron.NativeImage {
  const size = 16;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inside = (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 49;
      const offset = (y * size + x) * 4;
      // BGRA
      pixels.set(inside ? [0x27, 0x9f, 0xef, 0xff] : [0, 0, 0, 0], offset);
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

function buildTrayMenu(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Exile Copilot · ventanita guía", enabled: false },
      { type: "separator" },
      { label: moving ? "Fijar la ventanita (Ctrl+Alt+M)" : "Mover la ventanita (Ctrl+Alt+M)", click: () => setMoving(!moving) },
      { label: win?.isVisible() ? "Ocultar" : "Mostrar", click: () => (win?.isVisible() ? win.hide() : win?.showInactive(), buildTrayMenu()) },
      { label: "Volver al principio del acto 1", click: () => setProgress(START) },
      { label: "Elegir Client.txt…", click: () => void chooseLog() },
      { type: "separator" },
      { label: "Salir", click: () => app.quit() },
    ]),
  );
}

async function createWindow(): Promise<void> {
  const position = saved.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : defaultPosition();
  win = new BrowserWindow({
    ...position,
    width: WIDTH,
    height: 110,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true);
  await win.loadFile(join(__dirname, "overlay.html"));
  win.showInactive();
  render();
}

ipcMain.on("altura", (_event, height: unknown) => {
  if (!win || typeof height !== "number" || !Number.isFinite(height)) return;
  const [x, y] = win.getPosition();
  win.setBounds({ x: x!, y: y!, width: WIDTH, height: Math.min(400, Math.max(40, Math.ceil(height))) });
});

// Para pruebas: guardar el estado en otra carpeta y no pisar el del jugador.
if (process.env.VENTANITA_DATOS) app.setPath("userData", process.env.VENTANITA_DATOS);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(async () => {
    saved = loadSaved();
    await createWindow();
    tray = new Tray(trayIcon());
    tray.setToolTip("Exile Copilot · ventanita guía");
    buildTrayMenu();

    globalShortcut.register(KEYS.prev, () => setProgress(moveStep(saved.progress, -1)));
    globalShortcut.register(KEYS.next, () => setProgress(moveStep(saved.progress, 1)));
    globalShortcut.register(KEYS.move, () => setMoving(!moving));

    // Para pruebas: otro Client.txt y una captura de la ventanita.
    const logPath =
      process.env.VENTANITA_CLIENT_TXT ?? (saved.logPath && existsSync(saved.logPath) ? saved.logPath : findClientLog());
    if (logPath) {
      startTail(logPath);
    } else {
      problem = "No encuentro Client.txt. Elígelo desde el icono de la bandeja.";
      render();
      void chooseLog();
    }

    const capture = process.env.VENTANITA_CAPTURA;
    if (capture) {
      setTimeout(async () => {
        const image = await win!.webContents.capturePage();
        writeFileSync(capture, image.toPNG());
        app.quit();
      }, Number(process.env.VENTANITA_CAPTURA_MS ?? 2500));
    }
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    tail?.stop();
  });
}
