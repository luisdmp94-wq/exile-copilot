/**
 * Qué programa tiene delante el jugador. Se pregunta a Windows (user32), no
 * al juego: no se lee la memoria de PoE2 ni se le envía nada. Sirve para que
 * la ventanita solo se vea con el juego delante.
 */

/** Ejecutables de PoE2: Steam («PathOfExileSteam.exe», «PathOfExile_x64Steam.exe») e independiente. */
export function isGameExecutable(name: string | null, extra: string | null = null): boolean {
  if (!name) return false;
  // Rutas de Windows («\») también fuera de Windows (los tests corren en cualquier sistema).
  const file = (name.split(/[\\/]/).pop() ?? "").toLowerCase();
  if (extra && file === extra.toLowerCase()) return true;
  return /^pathofexile[\w-]*\.exe$/.test(file);
}

export type ForegroundReader = () => string | null;

/**
 * Devuelve una función que dice el ejecutable de la ventana de delante, o
 * null si no se puede saber (otro sistema, librería que no carga). Sin ella,
 * la ventanita se queda siempre visible, como antes.
 */
export function createForegroundReader(): ForegroundReader | null {
  if (process.platform !== "win32") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require("koffi") as typeof import("koffi");
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");
    const GetForegroundWindow = user32.func("void* __stdcall GetForegroundWindow()");
    const GetWindowThreadProcessId = user32.func("uint32 __stdcall GetWindowThreadProcessId(void* hWnd, _Out_ uint32* pid)");
    const OpenProcess = kernel32.func("void* __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)");
    const CloseHandle = kernel32.func("bool __stdcall CloseHandle(void* handle)");
    const QueryFullProcessImageNameW = kernel32.func(
      "bool __stdcall QueryFullProcessImageNameW(void* process, uint32 flags, _Out_ uint16* name, _Inout_ uint32* size)",
    );
    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    return () => {
      const hwnd = GetForegroundWindow();
      if (!hwnd) return null;
      const pid = [0];
      GetWindowThreadProcessId(hwnd, pid);
      if (!pid[0]) return null;
      const process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid[0]);
      if (!process) return null;
      try {
        const buffer = new Uint16Array(1024);
        const size = [buffer.length];
        if (!QueryFullProcessImageNameW(process, 0, buffer, size)) return null;
        return String.fromCharCode(...buffer.subarray(0, size[0]));
      } finally {
        CloseHandle(process);
      }
    };
  } catch {
    return null;
  }
}

export interface VisibilityInput {
  /** El jugador la ocultó desde la bandeja. */
  userHidden: boolean;
  /** Ajuste «Mostrar solo con PoE2 delante». */
  onlyWithGame: boolean;
  /** Se está arrastrando por el asa. */
  dragging: boolean;
  /** Primeros segundos tras arrancar: se ve para que el jugador sepa que está. */
  starting: boolean;
  /** Ejecutable de la ventana de delante; undefined si no se puede saber. */
  foreground: string | null | undefined;
  /** El propio ejecutable de la ventanita (al tocar el asa, la de delante es ella). */
  ownExecutable: string;
  /** Otro ejecutable que cuenta como el juego (solo para pruebas). */
  extraGame?: string | null;
}

/** ¿Se enseña la ventanita ahora? */
export function shouldBeVisible(input: VisibilityInput): boolean {
  if (input.userHidden) return false;
  if (!input.onlyWithGame || input.foreground === undefined) return true;
  if (input.dragging || input.starting) return true;
  const front = input.foreground;
  if (front !== null && front.toLowerCase() === input.ownExecutable.toLowerCase()) return true;
  return isGameExecutable(front, input.extraGame ?? null);
}
