import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrowserWindow, Menu, Tray, app, dialog, globalShortcut, ipcMain, nativeImage, screen } from "electron";
import { ClientLogTail, findClientLog, type LogEvent } from "./clientLog";
import { createForegroundReader, isGameExecutable, shouldBeVisible } from "./foreground";
import {
  NEW_RUN,
  onArea,
  onDismissNotice,
  onLevel,
  onMove,
  onToggleReward,
  sanitizeRun,
  viewOf,
  type Run,
} from "./run";
import { DEFAULT_SETTINGS, SIZE_SCALE, sanitizeSettings, type Settings } from "./settings";

/**
 * Ventanita guía de Exile Copilot. Una ventana aparte, siempre encima, que
 * deja pasar los clics al juego. Solo LEE Client.txt: no toca la memoria del
 * juego, no le inyecta nada y no le manda teclas ni clics. Las teclas las
 * escucha esta ventana para cambiar de paso, marcar recompensas y moverse.
 */

const BASE_WIDTH = 340;
const KEYS = {
  prev: "PageUp",
  next: "PageDown",
  reward: "End",
  summary: "Control+Alt+R",
} as const;

interface Saved {
  run: Run;
  settings: Settings;
  x?: number;
  y?: number;
  logPath?: string;
  /** Hasta dónde se leyó Client.txt, para repasar solo lo nuevo al volver. */
  logOffset?: number;
}

const statePath = () => join(app.getPath("userData"), "estado.json");

function loadSaved(): Saved {
  try {
    const raw = JSON.parse(readFileSync(statePath(), "utf8")) as Partial<Saved> & { progress?: unknown };
    const run = sanitizeRun(raw.run ?? { progress: raw.progress });
    return {
      run,
      settings: sanitizeSettings(raw.settings),
      ...(typeof raw.x === "number" && typeof raw.y === "number" ? { x: raw.x, y: raw.y } : {}),
      ...(typeof raw.logPath === "string" ? { logPath: raw.logPath } : {}),
      ...(typeof raw.logOffset === "number" ? { logOffset: raw.logOffset } : {}),
    };
  } catch {
    return { run: NEW_RUN, settings: DEFAULT_SETTINGS };
  }
}

let saved: Saved;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let tail: ClientLogTail | null = null;
let currentLog: string | null = null;
let showSummary = false;
/** Arrastre por el asa: el proceso principal sigue al ratón hasta soltar. */
let dragging: { timer: NodeJS.Timeout } | null = null;
let userHidden = false;
const startedAt = Date.now();
/** Los primeros segundos se ve siempre, para que el jugador sepa que arrancó. */
const STARTING_MS = 8000;
const readForeground = createForegroundReader();
/** Clics y ratón pasan al juego; el movimiento llega igual para notar el asa. */
const PASS_THROUGH = { forward: true } as const;
let problem: string | null = null;
/** Teclas que otro programa ya tenía: se avisa aparte para que no lo borre el registro. */
let keyProblem: string | null = null;

function persist(): void {
  try {
    mkdirSync(dirname(statePath()), { recursive: true });
    const logOffset = tail?.offset;
    writeFileSync(
      statePath(),
      JSON.stringify({ ...saved, ...(currentLog ? { logPath: currentLog } : {}), ...(logOffset !== undefined ? { logOffset } : {}) }, null, 2),
    );
  } catch {
    // Sin poder guardar, la ventanita sigue; solo olvida la partida al cerrarla.
  }
}

const scale = () => SIZE_SCALE[saved.settings.size];

function render(): void {
  if (!win) return;
  win.webContents.setZoomFactor(scale());
  win.webContents.send("estado", {
    view: viewOf(saved.run, saved.settings.route),
    settings: saved.settings,
    showSummary,
    problem: problem ?? keyProblem,
    waitingForGame: saved.settings.onlyWithGame && readForeground !== null && isStarting() && !gameInFront(),
  });
}

function update(run: Run): void {
  saved = { ...saved, run };
  persist();
  render();
}

function updateSettings(patch: Partial<Settings>): void {
  saved = { ...saved, settings: { ...saved.settings, ...patch } };
  persist();
  render();
  buildTrayMenu();
}

function defaultPosition(): { x: number; y: number } {
  // A la derecha, bajo el minimapa de PoE2, en la pantalla principal.
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - BASE_WIDTH - Math.round(area.width * 0.015),
    y: area.y + Math.round(area.height * 0.27),
  };
}

function apply(run: Run, event: LogEvent): Run {
  return event.kind === "area" ? onArea(run, event.code, event.level) : onLevel(run, event.level);
}

function startTail(path: string, from: number | null): void {
  tail?.stop();
  problem = null;
  currentLog = path;
  // Repasar desde el principio es reconstruir la partida desde cero.
  let replayed = from === null ? NEW_RUN : saved.run;
  tail = new ClientLogTail(path, (event, replaying) => {
    if (replaying) replayed = apply(replayed, event);
    else update(apply(saved.run, event));
  });
  try {
    tail.start(from);
    // Lo repasado al arrancar no avisa de nada: ya pasó.
    saved = { ...saved, run: onDismissNotice(replayed) };
    persist();
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
  // Otro archivo: se repasa entero.
  saved = { ...saved, run: NEW_RUN };
  startTail(path, null);
}

const isStarting = () => Date.now() - startedAt < STARTING_MS;
const gameInFront = () => isGameExecutable(readForeground?.() ?? null, process.env.VENTANITA_JUEGO ?? null);

/** Cada cuarto de segundo: visible solo con PoE2 delante (si el jugador lo quiere así). */
function syncVisibility(): void {
  if (!win || win.isDestroyed()) return;
  const visible = shouldBeVisible({
    userHidden,
    onlyWithGame: saved.settings.onlyWithGame,
    dragging: dragging !== null,
    starting: isStarting(),
    foreground: readForeground ? readForeground() : undefined,
    ownExecutable: process.execPath,
    extraGame: process.env.VENTANITA_JUEGO ?? null,
  });
  if (visible && !win.isVisible()) {
    win.showInactive();
    win.setAlwaysOnTop(true, "screen-saver");
  } else if (!visible && win.isVisible()) {
    win.hide();
  }
}

function endDrag(): void {
  if (!dragging || !win) return;
  clearInterval(dragging.timer);
  dragging = null;
  const [x, y] = win.getPosition();
  saved = { ...saved, x: x!, y: y! };
  persist();
  win.setIgnoreMouseEvents(true, PASS_THROUGH);
}

function resetPosition(): void {
  const position = defaultPosition();
  win?.setPosition(position.x, position.y);
  saved = { ...saved, x: position.x, y: position.y };
  persist();
}

function setUserHidden(hidden: boolean): void {
  userHidden = hidden;
  syncVisibility();
  buildTrayMenu();
}

function toggleSummary(): void {
  showSummary = !showSummary;
  if (showSummary) saved = { ...saved, run: onDismissNotice(saved.run) };
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
      // BGRA
      pixels.set(inside ? [0x27, 0x9f, 0xef, 0xff] : [0, 0, 0, 0], (y * size + x) * 4);
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

function buildTrayMenu(): void {
  const s = saved.settings;
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Exile Copilot · ventanita guía", enabled: false },
      { type: "separator" },
      { label: "Ruta completa", type: "radio", checked: s.route === "completa", click: () => updateSettings({ route: "completa" }) },
      { label: "Ruta rápida (sin lo que no da nada para siempre)", type: "radio", checked: s.route === "rapida", click: () => updateSettings({ route: "rapida" }) },
      { type: "separator" },
      { label: showSummary ? "Cerrar recompensas del acto (Ctrl+Alt+R)" : "Ver recompensas del acto (Ctrl+Alt+R)", click: toggleSummary },
      {
        label: "Mostrar solo con PoE2 delante",
        type: "checkbox",
        checked: s.onlyWithGame,
        click: () => updateSettings({ onlyWithGame: !s.onlyWithGame }),
      },
      { label: "Volver a su sitio (bajo el minimapa)", click: resetPosition },
      {
        label: "Aspecto",
        submenu: [
          { label: "Pequeña", type: "radio", checked: s.size === "pequena", click: () => updateSettings({ size: "pequena" }) },
          { label: "Normal", type: "radio", checked: s.size === "normal", click: () => updateSettings({ size: "normal" }) },
          { label: "Grande", type: "radio", checked: s.size === "grande", click: () => updateSettings({ size: "grande" }) },
          { type: "separator" },
          { label: "Compacta (solo el paso actual)", type: "checkbox", checked: s.compact, click: () => updateSettings({ compact: !s.compact }) },
          { type: "separator" },
          { label: "Fondo claro", type: "radio", checked: s.opacity === "clara", click: () => updateSettings({ opacity: "clara" }) },
          { label: "Fondo normal", type: "radio", checked: s.opacity === "normal", click: () => updateSettings({ opacity: "normal" }) },
          { label: "Fondo opaco", type: "radio", checked: s.opacity === "opaca", click: () => updateSettings({ opacity: "opaca" }) },
        ],
      },
      { label: userHidden ? "Mostrar" : "Ocultar", click: () => setUserHidden(!userHidden) },
      { type: "separator" },
      { label: "Re Pág / Av Pág: paso anterior / siguiente", enabled: false },
      { label: "Fin: marcar la recompensa como cogida", enabled: false },
      { label: "Para moverla: arrastra el asa ⠿ de la izquierda", enabled: false },
      { type: "separator" },
      { label: "Empezar de cero (personaje nuevo)", click: () => update(NEW_RUN) },
      { label: "Elegir Client.txt…", click: () => void chooseLog() },
      { label: "Salir", click: () => app.quit() },
    ]),
  );
}

async function createWindow(): Promise<void> {
  // En las capturas de prueba se pinta fuera de la pantalla, para no salir encima del juego.
  const position = process.env.VENTANITA_CAPTURA
    ? { x: -4000, y: -4000 }
    : saved.x !== undefined && saved.y !== undefined
      ? { x: saved.x, y: saved.y }
      : defaultPosition();
  win = new BrowserWindow({
    ...position,
    width: Math.round(BASE_WIDTH * scale()),
    height: 110,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true, PASS_THROUGH);
  // No tiene botón en la barra de tareas: si «Mostrar escritorio» (Win+D) la
  // minimiza, no habría forma de recuperarla. Vuelve sola, sin robar el foco.
  win.on("minimize", () => {
    win?.restore();
    win?.showInactive();
  });
  await win.loadFile(join(__dirname, "overlay.html"));
  win.showInactive();
  render();
}

// El ratón entra o sale del asa: solo ahí la ventanita deja de ser transparente a los clics.
ipcMain.on("asa", (_event, over: unknown) => {
  if (!win || dragging) return;
  win.setIgnoreMouseEvents(over !== true, PASS_THROUGH);
});

// Arrastre por el asa: se sigue el cursor desde aquí, que no se pierde aunque el ratón vaya rápido.
ipcMain.on("arrastre", (_event, phase: unknown) => {
  if (!win) return;
  if (phase === "inicio" && !dragging) {
    const cursor = screen.getCursorScreenPoint();
    const [x, y] = win.getPosition();
    const offset = { x: cursor.x - x!, y: cursor.y - y! };
    const started = Date.now();
    const timer = setInterval(() => {
      const point = screen.getCursorScreenPoint();
      win?.setPosition(point.x - offset.x, point.y - offset.y);
      // Por si nunca llega el «soltar»: como mucho un minuto.
      if (Date.now() - started > 60_000) endDrag();
    }, 16);
    dragging = { timer };
  } else if (phase === "fin") {
    endDrag();
  }
});

ipcMain.on("altura", (_event, height: unknown) => {
  if (!win || typeof height !== "number" || !Number.isFinite(height)) return;
  const [x, y] = win.getPosition();
  win.setBounds({
    x: x!,
    y: y!,
    width: Math.round(BASE_WIDTH * scale()),
    height: Math.min(600, Math.max(24, Math.ceil(height * scale()))),
  });
});

/** Solo para pruebas: acciones de teclado simuladas antes de una captura. */
function runTestActions(list: string): void {
  for (const action of list.split(",").map((item) => item.trim())) {
    if (action === "siguiente") update(onMove(saved.run, 1, saved.settings.route));
    if (action === "anterior") update(onMove(saved.run, -1, saved.settings.route));
    if (action === "recompensa") update(onToggleReward(saved.run));
    if (action === "resumen") toggleSummary();
    if (action === "rapida") updateSettings({ route: "rapida" });
    if (action === "compacta") updateSettings({ compact: true });
    if (action === "grande") updateSettings({ size: "grande" });
  }
}

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

    const shortcuts: Array<[string, () => void]> = [
      [KEYS.prev, () => update(onMove(saved.run, -1, saved.settings.route))],
      [KEYS.next, () => update(onMove(saved.run, 1, saved.settings.route))],
      [KEYS.reward, () => update(onToggleReward(saved.run))],
      [KEYS.summary, toggleSummary],
    ];
    const taken = shortcuts.filter(([key, action]) => !globalShortcut.register(key, action)).map(([key]) => key);
    if (taken.length > 0) keyProblem = `Otro programa ya usa ${taken.join(", ")}: esa tecla no funcionará aquí.`;

    const envLog = process.env.VENTANITA_CLIENT_TXT;
    const known = saved.logPath && existsSync(saved.logPath) ? saved.logPath : null;
    const logPath = envLog ?? known ?? findClientLog();
    if (logPath) {
      // Mismo archivo que la última vez: se sigue donde se dejó. Si no, se repasa entero.
      startTail(logPath, logPath === saved.logPath ? (saved.logOffset ?? null) : null);
    } else {
      problem = "No encuentro Client.txt. Elígelo desde el icono de la bandeja.";
      render();
      void chooseLog();
    }

    setInterval(syncVisibility, 250);
    // Al terminar el arranque, el aviso «saldrá con PoE2 delante» se va.
    setTimeout(render, STARTING_MS + 100);

    if (process.env.VENTANITA_ACCIONES) runTestActions(process.env.VENTANITA_ACCIONES);
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
    persist();
  });
}
