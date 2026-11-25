import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrowserWindow, Menu, Tray, app, dialog, globalShortcut, ipcMain, nativeImage, screen } from "electron";
import { EMPTY_ROSTER, onLog, type Roster } from "./characters";
import { ClientLogTail, findClientLog } from "./clientLog";
import { createForegroundReader, isGameExecutable, shouldBeVisible } from "./foreground";
import { keepInside } from "./place";
import {
  NEW_RUN,
  onDismissNotice,
  onMove,
  onToggleBoss,
  onTogglePickup,
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
/** Solo para pruebas: cuatro teclas que nadie usa (F13…F16) en lugar de las del jugador. */
const TEST_KEYS = (process.env.VENTANITA_TECLAS_PRUEBA ?? "").split(",").map((key) => key.trim()).filter(Boolean);
const KEYS =
  TEST_KEYS.length === 4
    ? { prev: TEST_KEYS[0]!, next: TEST_KEYS[1]!, reward: TEST_KEYS[2]!, summary: TEST_KEYS[3]! }
    : { prev: "PageUp", next: "PageDown", reward: "End", summary: "Control+Alt+R" };

/**
 * Qué sabe sacar la ventanita del registro. Si sube, la partida guardada se
 * rehace repasando Client.txt entero una vez (2: recompensas y jefes; 3: una
 * partida por personaje; 4: clase y ascendencia; 5: recompensas que llegan
 * en varias entregas, como los tres tatuajes).
 */
const LOG_FORMAT = 5;

interface Saved {
  /** La partida del personaje con el que juegas. */
  run: Run;
  /** Su nombre, cuando el registro lo ha dicho. */
  character?: string | null;
  /** Las partidas de tus otros personajes. */
  runs?: Record<string, Run>;
  /** Huellas de otros jugadores vistos: sus niveles y recompensas no cuentan. */
  others?: string[];
  settings: Settings;
  x?: number;
  y?: number;
  logPath?: string;
  /** Hasta dónde se leyó Client.txt, para repasar solo lo nuevo al volver. */
  logOffset?: number;
  logFormat?: number;
}

const statePath = () => join(app.getPath("userData"), "estado.json");

function loadSaved(): Saved {
  try {
    const raw = JSON.parse(readFileSync(statePath(), "utf8")) as Partial<Saved> & { progress?: unknown };
    const run = sanitizeRun(raw.run ?? { progress: raw.progress });
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
    const runs = Object.fromEntries(
      Object.entries(raw.runs && typeof raw.runs === "object" ? raw.runs : {}).map(([name, other]) => [name, sanitizeRun(other)]),
    );
    return {
      run,
      character: typeof raw.character === "string" ? raw.character : null,
      runs,
      others: strings(raw.others),
      settings: sanitizeSettings(raw.settings),
      ...(typeof raw.x === "number" && typeof raw.y === "number" ? { x: raw.x, y: raw.y } : {}),
      ...(typeof raw.logPath === "string" ? { logPath: raw.logPath } : {}),
      ...(typeof raw.logOffset === "number" ? { logOffset: raw.logOffset } : {}),
      ...(typeof raw.logFormat === "number" ? { logFormat: raw.logFormat } : {}),
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
/** El panel abierto bajo el paso: las recompensas del acto o los ajustes. Solo uno a la vez. */
let panel: "resumen" | "ajustes" | null = null;
/** Arrastre por el asa: el proceso principal sigue al ratón hasta soltar. */
let dragging: { timer: NodeJS.Timeout } | null = null;
/** Dónde quiere el jugador la ventanita (esquina de arriba a la izquierda). */
let place = { x: 0, y: 0 };
/** Lo que mide el contenido, en píxeles de la página (sin el tamaño elegido). */
let contentHeight = 110;
/** Y su ancho, que solo se usa minimizada (la línea ocupa lo justo). */
let contentWidth = BASE_WIDTH;
/** Capturas de prueba: se pinta fuera de la pantalla y no coge las teclas del jugador. */
const CAPTURE = process.env.VENTANITA_CAPTURA;
let userHidden = false;
const startedAt = Date.now();
/** Los primeros segundos se ve siempre, para que el jugador sepa que arrancó. */
const STARTING_MS = 8000;
const readForeground = createForegroundReader();
/** Clics y ratón pasan al juego; el movimiento llega igual para notar el asa. */
const PASS_THROUGH = { forward: true } as const;
let problem: string | null = null;
/** Lo que no se guarda de los personajes: si aún no se sabe quién juega y de cuál se vino. */
let unsure: Roster["unsure"] = null;
let cameFrom: Roster["cameFrom"] = null;

const roster = (): Roster => ({
  current: saved.character ?? null,
  run: saved.run,
  runs: saved.runs ?? {},
  others: saved.others ?? [],
  unsure,
  cameFrom,
});

function keepRoster(next: Roster): void {
  unsure = next.unsure;
  cameFrom = next.cameFrom;
  saved = { ...saved, run: next.run, character: next.current, runs: next.runs, others: next.others };
}
/** Teclas que otro programa ya tenía: se avisa aparte para que no lo borre el registro. */
let keyProblem: string | null = null;

function persist(): void {
  try {
    mkdirSync(dirname(statePath()), { recursive: true });
    const logOffset = tail?.offset;
    writeFileSync(
      statePath(),
      JSON.stringify(
        { ...saved, ...(currentLog ? { logPath: currentLog } : {}), ...(logOffset !== undefined ? { logOffset } : {}), logFormat: LOG_FORMAT },
        null,
        2,
      ),
    );
  } catch {
    // Sin poder guardar, la ventanita sigue; solo olvida la partida al cerrarla.
  }
}

const scale = () => SIZE_SCALE[saved.settings.size];

const boxSize = () => ({
  // Minimizada mide lo que su línea; desplegada, el ancho de siempre.
  width: Math.round((saved.settings.minimized ? Math.min(BASE_WIDTH, Math.max(120, Math.ceil(contentWidth))) : BASE_WIDTH) * scale()),
  height: Math.min(600, Math.max(24, Math.ceil(contentHeight * scale()))),
});

/** Donde se pinta de verdad: el sitio elegido, pero siempre entera dentro de la pantalla. */
function shownPlace(): { x: number; y: number } {
  if (CAPTURE) return place;
  const size = boxSize();
  const center = { x: Math.round(place.x + size.width / 2), y: Math.round(place.y + size.height / 2) };
  // La pantalla entera, no el «área de trabajo»: PoE2 sin bordes tapa la barra de tareas.
  return keepInside({ ...place, ...size }, screen.getDisplayNearestPoint(center).bounds);
}

/**
 * Coloca la ventana. Siempre con ancho y alto: con la pantalla al 125 %,
 * mover solo la posición (setPosition) la hace crecer un píxel cada vez.
 */
function applyBounds(): void {
  if (!win || win.isDestroyed()) return;
  win.setBounds({ ...shownPlace(), ...boxSize() });
}

function render(): void {
  if (!win) return;
  win.webContents.setZoomFactor(scale());
  applyBounds();
  win.webContents.send("estado", {
    view: viewOf(saved.run, saved.settings.route),
    settings: saved.settings,
    showSummary: panel === "resumen",
    showSettings: panel === "ajustes",
    character: saved.character ?? null,
    problem: problem ?? keyProblem,
    waitingForGame: !CAPTURE && saved.settings.onlyWithGame && readForeground !== null && isStarting() && !gameInFront(),
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

function startTail(path: string, from: number | null): void {
  tail?.stop();
  problem = null;
  currentLog = path;
  // Repasar desde el principio es reconstruir la partida desde cero;
  // lo que el jugador marcó a mano se conserva.
  const byHand = { checked: saved.run.checked, bosses: saved.run.bosses, pickups: saved.run.pickups ?? [] };
  let replayed = from === null ? EMPTY_ROSTER : roster();
  tail = new ClientLogTail(path, (event, replaying) => {
    if (replaying) {
      replayed = onLog(replayed, event);
    } else {
      keepRoster(onLog(roster(), event));
      persist();
      render();
    }
  });
  try {
    tail.start(from);
    let run = replayed.run;
    if (from === null) {
      run = {
        ...run,
        checked: [...new Set([...run.checked, ...byHand.checked])],
        bosses: [...new Set([...run.bosses, ...byHand.bosses])],
        pickups: [...new Set([...(run.pickups ?? []), ...byHand.pickups])],
      };
    }
    // Lo repasado al arrancar no avisa de nada: ya pasó.
    keepRoster({ ...replayed, run: onDismissNotice(run) });
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
/** Las teclas, cogidas o sueltas ahora mismo. */
let shortcutsOn = false;

/**
 * Coge o suelta las teclas. Re Pág, Av Pág y Fin son teclas corrientes: la
 * ventanita solo se las queda mientras se ve con el juego delante. Antes las
 * tenía siempre, y dejaban de funcionar en el navegador o en otro juego.
 */
function setShortcuts(on: boolean): void {
  // Una captura de prueba no coge teclas (se las quitaría a la ventanita del jugador), salvo las de prueba.
  if ((CAPTURE && TEST_KEYS.length !== 4) || on === shortcutsOn) return;
  shortcutsOn = on;
  if (!on) {
    globalShortcut.unregisterAll();
    return;
  }
  const shortcuts: Array<[string, () => void]> = [
    [KEYS.prev, () => update(onMove(saved.run, -1, saved.settings.route))],
    [KEYS.next, () => update(onMove(saved.run, 1, saved.settings.route))],
    [KEYS.reward, () => update(onToggleReward(saved.run))],
    [KEYS.summary, toggleSummary],
  ];
  const taken = shortcuts.filter(([key, action]) => !globalShortcut.register(key, action)).map(([key]) => key);
  const next = taken.length > 0 ? `Otro programa ya usa ${taken.join(", ")}: esa tecla no funcionará aquí.` : null;
  if (next !== keyProblem) {
    keyProblem = next;
    render();
  }
}

function syncVisibility(): void {
  if (!win || win.isDestroyed()) return;
  const now = {
    userHidden,
    onlyWithGame: saved.settings.onlyWithGame,
    dragging: dragging !== null,
    starting: isStarting(),
    foreground: readForeground ? readForeground() : undefined,
    ownExecutable: process.execPath,
    extraGame: process.env.VENTANITA_JUEGO ?? null,
  };
  // En una captura de prueba no se esconde nunca: una ventana escondida no se puede
  // capturar, y la prueba se quedaba abierta para siempre esperando la imagen.
  const visible = CAPTURE ? true : shouldBeVisible(now);
  // Los segundos de arranque se ve sobre lo que haya delante, pero sin teclas.
  setShortcuts(shouldBeVisible({ ...now, starting: false, dragging: false }));
  if (visible && !win.isVisible()) {
    win.showInactive();
    win.setAlwaysOnTop(true, "screen-saver");
  } else if (!visible && win.isVisible()) {
    win.hide();
  }
}

function savePlace(): void {
  saved = { ...saved, x: place.x, y: place.y };
  persist();
}

function endDrag(): void {
  if (!dragging || !win) return;
  clearInterval(dragging.timer);
  dragging = null;
  // Se guarda donde quedó a la vista, no donde apuntaba el ratón fuera de la pantalla.
  place = shownPlace();
  savePlace();
  win.setIgnoreMouseEvents(true, PASS_THROUGH);
}

function resetPosition(): void {
  place = defaultPosition();
  applyBounds();
  savePlace();
}

function setUserHidden(hidden: boolean): void {
  userHidden = hidden;
  syncVisibility();
  buildTrayMenu();
}

function togglePanel(which: "resumen" | "ajustes"): void {
  panel = panel === which ? null : which;
  if (panel === "resumen") saved = { ...saved, run: onDismissNotice(saved.run) };
  // Abrir un panel con la ventanita minimizada la despliega: si no, no se vería.
  if (panel !== null && saved.settings.minimized) saved = { ...saved, settings: { ...saved.settings, minimized: false } };
  render();
  buildTrayMenu();
}

const toggleSummary = () => togglePanel("resumen");

/** Minimizar: se queda en una línea con la zona. Los paneles se cierran. */
function toggleMinimized(): void {
  if (!saved.settings.minimized) panel = null;
  updateSettings({ minimized: !saved.settings.minimized });
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
      { label: panel === "resumen" ? "Cerrar recompensas del acto (Ctrl+Alt+R)" : "Ver recompensas del acto (Ctrl+Alt+R)", click: toggleSummary },
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
      { label: s.minimized ? "Desplegar" : "Minimizar (una línea)", click: toggleMinimized },
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
  place = CAPTURE
    ? { x: -4000, y: -4000 }
    : saved.x !== undefined && saved.y !== undefined
      ? { x: saved.x, y: saved.y }
      : defaultPosition();
  win = new BrowserWindow({
    ...shownPlace(),
    ...boxSize(),
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

// El ratón entra o sale del asa, del engranaje o de los ajustes: solo ahí la ventanita coge los clics.
ipcMain.on("asa", (_event, over: unknown) => {
  if (!win || dragging) return;
  win.setIgnoreMouseEvents(over !== true, PASS_THROUGH);
});

// Arrastre por el asa: se sigue el cursor desde aquí, que no se pierde aunque el ratón vaya rápido.
ipcMain.on("arrastre", (_event, phase: unknown) => {
  if (!win) return;
  if (phase === "inicio" && !dragging) {
    let last = screen.getCursorScreenPoint();
    const shown = shownPlace();
    const offset = { x: last.x - shown.x, y: last.y - shown.y };
    const started = Date.now();
    const timer = setInterval(() => {
      const point = screen.getCursorScreenPoint();
      if (point.x !== last.x || point.y !== last.y) {
        last = point;
        place = { x: point.x - offset.x, y: point.y - offset.y };
        applyBounds();
      }
      // Por si nunca llega el «soltar»: como mucho un minuto.
      if (Date.now() - started > 60_000) endDrag();
    }, 8);
    dragging = { timer };
  } else if (phase === "fin") {
    endDrag();
  }
});

ipcMain.on("altura", (_event, height: unknown, width: unknown) => {
  if (!win || typeof height !== "number" || !Number.isFinite(height)) return;
  contentHeight = height;
  if (typeof width === "number" && Number.isFinite(width)) contentWidth = width;
  applyBounds();
});

// Los botones de la propia ventanita (engranaje, ajustes, casilla). Solo estas órdenes, nada más.
ipcMain.on("accion", (_event, name: unknown, value: unknown) => {
  const s = saved.settings;
  switch (name) {
    case "ajustes":
      return togglePanel("ajustes");
    case "resumen":
      return togglePanel("resumen");
    case "recompensa":
      return update(onToggleReward(saved.run));
    case "jefe":
      return update(onToggleBoss(saved.run));
    case "objeto":
      return update(onTogglePickup(saved.run));
    case "ruta":
      return updateSettings(sanitizeSettings({ ...s, route: value }));
    case "tamano":
      return updateSettings(sanitizeSettings({ ...s, size: value }));
    case "fondo":
      return updateSettings(sanitizeSettings({ ...s, opacity: value }));
    case "compacta":
      return updateSettings({ compact: !s.compact });
    case "minimizar":
      return toggleMinimized();
    case "solo-juego":
      return updateSettings({ onlyWithGame: !s.onlyWithGame });
    case "sitio":
      return resetPosition();
    case "cero":
      return update(NEW_RUN);
    case "registro":
      return void chooseLog();
    case "salir":
      return app.quit();
    default:
      return undefined;
  }
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Solo para pruebas: ratón simulado dentro de la página (no mueve el ratón de
 * verdad), para comprobar los botones y el asa sin tener la ventanita en pantalla.
 */
async function mouseForTest(selector: string, steps: Array<"mouseDown" | "mouseUp">): Promise<void> {
  if (!win) return;
  const point = (await win.webContents.executeJavaScript(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  )) as { x: number; y: number };
  const at = { x: Math.round(point.x * scale()), y: Math.round(point.y * scale()) };
  win.webContents.sendInputEvent({ type: "mouseMove", ...at });
  for (const type of steps) win.webContents.sendInputEvent({ type, ...at, button: "left", clickCount: 1 });
  await pause(250);
}

/** Solo para pruebas: acciones simuladas antes de una captura. */
async function runTestActions(list: string): Promise<void> {
  for (const action of list.split(",").map((item) => item.trim())) {
    if (action === "siguiente") update(onMove(saved.run, 1, saved.settings.route));
    if (action === "anterior") update(onMove(saved.run, -1, saved.settings.route));
    if (action === "recompensa") update(onToggleReward(saved.run));
    if (action === "resumen") toggleSummary();
    if (action === "rapida") updateSettings({ route: "rapida" });
    if (action === "compacta") updateSettings({ compact: true });
    if (action === "minimizada") updateSettings({ minimized: true });
    if (action === "grande") updateSettings({ size: "grande" });
    if (action.startsWith("clic:")) await mouseForTest(action.slice(5), ["mouseDown", "mouseUp"]);
    if (action.startsWith("pulsa:")) await mouseForTest(action.slice(6), ["mouseDown"]);
    if (action.startsWith("suelta:")) await mouseForTest(action.slice(7), ["mouseUp"]);
    if (action === "espera") await pause(1000);
  }
}

// Para pruebas: guardar el estado en otra carpeta y no pisar el del jugador.
if (process.env.VENTANITA_DATOS) app.setPath("userData", process.env.VENTANITA_DATOS);

/**
 * Solo una ventanita a la vez. Si ya hay una abierta, se le pide que se cierre
 * y se espera a que suelte el sitio: así, abrirla otra vez (el acceso directo)
 * deja siempre la última versión compilada. La vieja se cierra sola; aquí no
 * se relanza nada.
 */
async function takeOver(): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.requestSingleInstanceLock()) return true;
    await pause(300);
  }
  return false;
}
let leaving = false;

void takeOver().then((mine) => {
  if (!mine) {
    app.quit();
    return;
  }

  // Otra ventanita quiere abrirse: esta guarda y se cierra. Con un respiro,
  // para que la otra reciba la respuesta antes de que esta desaparezca.
  app.on("second-instance", () => {
    if (leaving) return;
    leaving = true;
    setTimeout(() => app.quit(), 50);
  });

  void app.whenReady().then(async () => {
    saved = loadSaved();
    await createWindow();
    tray = new Tray(trayIcon());
    tray.setToolTip("Exile Copilot · ventanita guía");
    // El clic izquierdo abre el mismo menú: en Windows solo salía con el derecho.
    tray.on("click", () => tray?.popUpContextMenu());
    buildTrayMenu();

    // Las teclas no se cogen aquí: las coge y las suelta `syncVisibility`, según haya juego delante.

    const envLog = process.env.VENTANITA_CLIENT_TXT;
    const known = saved.logPath && existsSync(saved.logPath) ? saved.logPath : null;
    const logPath = envLog ?? known ?? findClientLog();
    if (logPath) {
      // Mismo archivo que la última vez: se sigue donde se dejó. Si no, se repasa entero.
      const upToDate = logPath === saved.logPath && saved.logFormat === LOG_FORMAT;
      startTail(logPath, upToDate ? (saved.logOffset ?? null) : null);
    } else {
      problem = "No encuentro Client.txt. Elígelo desde el icono de la bandeja.";
      render();
      void chooseLog();
    }

    setInterval(syncVisibility, 250);
    // Al terminar el arranque, el aviso «saldrá con PoE2 delante» se va.
    setTimeout(render, STARTING_MS + 100);

    if (process.env.VENTANITA_ACCIONES) void runTestActions(process.env.VENTANITA_ACCIONES);
    const capture = CAPTURE;
    if (capture) {
      const after = Number(process.env.VENTANITA_CAPTURA_MS ?? 2500);
      setTimeout(async () => {
        try {
          const image = await win!.webContents.capturePage();
          writeFileSync(capture, image.toPNG());
          // Junto a la imagen, dónde está y cuánto mide la ventana de verdad.
          writeFileSync(`${capture}.json`, JSON.stringify({ bounds: win!.getBounds(), place, dragging: dragging !== null }));
        } finally {
          app.quit();
        }
      }, after);
      // Pase lo que pase, una prueba no se queda abierta en el equipo del jugador.
      setTimeout(() => app.exit(0), after + 15_000).unref();
    }
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    tail?.stop();
    persist();
  });
});
