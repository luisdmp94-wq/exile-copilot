import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { nameId } from "./characters";
import { bossSignOf, rewardKindOf, type RewardKind } from "./objectives";

/**
 * Lectura de Client.txt, el registro que escribe PoE2. Solo se miran seis
 * cosas: el cambio de zona, la subida de nivel, el mensaje de una recompensa
 * para siempre recibida, las frases que ciertos personajes del juego dicen
 * al caer un jefe, la vuelta a la pantalla de entrada y quién se une o sale
 * de tu zona (para no confundir a otro jugador contigo). De tus personajes
 * se usa el nombre; de los demás jugadores, solo una huella. El resto (chat,
 * nombre de cuenta…) se descarta aquí mismo, sin guardarlo ni pasarlo a
 * nadie. Nada sale del equipo.
 */

const AREA_LINE = /Generating level (\d+) area "([^"]+)"/;
// «Liche (Liche) es ahora nivel 51» en español; «… is now level 51» en inglés (las dos salen en el Client.txt real).
const LEVEL_LINE = /\] : (\S+) \((.*)\) (?:is now level|es ahora nivel) (\d+)/;
// Volver a la pantalla de entrada (abrir el juego o cambiar de personaje).
const LOGIN_LINE = /\] Async connecting to \S*login/;

// El texto de una línea normal del juego, sin la fecha ni el número de proceso.
const INFO_LINE = /\[INFO Client \d+\] (.+)$/;
// «Exiliada ha recibido X», «Has recibido X», «You have received X».
const REWARD_LINE = /^: (?:(\S+) han? recibido|Has recibido|You have received|(\S+) has received) (.+)$/;
// Otro jugador entra o sale de tu zona.
const OTHER_LINE = /^: (\S+) (?:se ha unido al área|ha abandonado el área|has joined the area|has left the area)\.$/;
// «Quien habla: lo que dice». El chat de otros jugadores empieza por # @ % $ &.
const SPEECH_LINE = /^([^#@%$&:[][^:]{0,60}): (.+)$/;

export type LogEvent =
  | { kind: "area"; code: string; level: number }
  | { kind: "level"; level: number; name: string; className: string }
  /** Alguien recibió una recompensa para siempre; `name` es null cuando el juego dice «has recibido». */
  | { kind: "reward"; reward: RewardKind; name: string | null }
  /** Se volvió a la pantalla de entrada: a partir de aquí puede jugar otro personaje. */
  | { kind: "login" }
  /** Otro jugador pasó por tu zona; solo queda la huella de su nombre. */
  | { kind: "other"; id: string }
  /** Se dijo una frase que solo se oye con el jefe de ese paso ya vencido. */
  | { kind: "boss"; act: number; zone: string };

export function parseLine(line: string): LogEvent | null {
  const area = AREA_LINE.exec(line);
  if (area) return { kind: "area", level: Number(area[1]), code: area[2]! };
  const level = LEVEL_LINE.exec(line);
  if (level) return { kind: "level", name: level[1]!, className: level[2]!, level: Number(level[3]) };
  if (LOGIN_LINE.test(line)) return { kind: "login" };
  const text = INFO_LINE.exec(line)?.[1];
  if (!text) return null;
  const reward = REWARD_LINE.exec(text);
  if (reward) {
    const kind = rewardKindOf(reward[3]!);
    return kind ? { kind: "reward", reward: kind, name: reward[1] ?? reward[2] ?? null } : null;
  }
  const other = OTHER_LINE.exec(text);
  if (other) return { kind: "other", id: nameId(other[1]!) };
  const speech = SPEECH_LINE.exec(text);
  if (!speech) return null;
  // Solo cuenta si es una de las frases de la tabla; cualquier otra se olvida aquí.
  const sign = bossSignOf(speech[1]!, speech[2]!);
  return sign ? { kind: "boss", ...sign } : null;
}

const LOG_TAIL = join("logs", "Client.txt");

/** Bibliotecas de Steam que aparecen en libraryfolders.vdf. */
function steamLibraries(steamRoot: string): string[] {
  try {
    const vdf = readFileSync(join(steamRoot, "steamapps", "libraryfolders.vdf"), "utf8");
    return [...vdf.matchAll(/"path"\s+"([^"]+)"/g)].map((match) => match[1]!.replace(/\\\\/g, "\\"));
  } catch {
    return [];
  }
}

/** Dónde suele estar Client.txt: Steam (todas sus bibliotecas) y la versión independiente. */
export function candidateLogPaths(env: NodeJS.ProcessEnv = process.env): string[] {
  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const programFiles = env.ProgramFiles ?? "C:\\Program Files";
  const steamRoots = [join(programFilesX86, "Steam"), join(programFiles, "Steam")];
  const libraries = [...new Set([...steamRoots, ...steamRoots.flatMap(steamLibraries)])];
  return [
    ...libraries.map((library) => join(library, "steamapps", "common", "Path of Exile 2", LOG_TAIL)),
    join(programFilesX86, "Grinding Gear Games", "Path of Exile 2", LOG_TAIL),
    join(programFiles, "Grinding Gear Games", "Path of Exile 2", LOG_TAIL),
  ];
}

export function findClientLog(env: NodeJS.ProcessEnv = process.env): string | null {
  return candidateLogPaths(env).find((path) => existsSync(path)) ?? null;
}

/**
 * Se lee por trozos pequeños: Client.txt puede pesar cientos de MB, y el hilo
 * que lo lee es el mismo que atiende la ventana y el ratón. Con trozos de
 * 8 MB seguidos, el repaso entero dejaba el ratón de todo el equipo parado.
 */
const CHUNK_BYTES = 1024 * 1024;
/** Lo más que lee una vigilancia de una vez; si hay más, sigue en la siguiente. */
const POLL_MAX_BYTES = 2 * CHUNK_BYTES;
const NEWLINE = 0x0a;
const RETURN = 0x0d;
const NOTHING = Buffer.alloc(0);

function readRange(path: string, start: number, length: number): Buffer {
  if (length <= 0) return NOTHING;
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");
  try {
    const read = readSync(fd, buffer, 0, length, start);
    return buffer.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

/** Suelta el hilo un momento: la ventana, el ratón y las teclas se atienden entre trozo y trozo. */
const breathe = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Sigue Client.txt como `tail -f`. Al arrancar repasa lo que el juego
 * escribió desde la última vez (o todo, la primera vez), para saber qué
 * zonas pisaste aunque la ventanita estuviera cerrada. Luego, cada medio
 * segundo, lee solo lo nuevo. Si el archivo se vacía, vuelve a empezar.
 *
 * El repaso no bloquea: lee un trozo, suelta el hilo y sigue.
 */
export class ClientLogTail {
  /** La última línea, a medias: se guarda en bytes para no partir una letra con tilde entre dos trozos. */
  private remainder: Buffer = NOTHING;
  private timer: NodeJS.Timeout | null = null;
  private position = 0;
  private stopped = false;
  private readonly path: string;
  private readonly onEvent: (event: LogEvent, replaying: boolean) => void;
  private readonly intervalMs: number;

  constructor(path: string, onEvent: (event: LogEvent, replaying: boolean) => void, intervalMs = 500) {
    this.path = path;
    this.onEvent = onEvent;
    this.intervalMs = intervalMs;
  }

  /** Hasta dónde se ha leído, para seguir desde ahí la próxima vez. */
  get offset(): number {
    // Una línea a medias se vuelve a leer entera la próxima vez.
    return Math.max(0, this.position - this.remainder.length);
  }

  /**
   * Repasa desde `from` (null = desde el principio) y empieza a vigilar.
   * `onProgress` recibe los bytes repasados y los que hay que repasar.
   * Devuelve false si se paró (`stop`) antes de acabar el repaso.
   */
  async start(from: number | null, onProgress?: (done: number, total: number) => void): Promise<boolean> {
    const size = statSync(this.path).size;
    this.position = from !== null && from <= size ? from : 0;
    this.stopped = false;
    const begin = this.position;
    for (;;) {
      const more = this.read(true, CHUNK_BYTES);
      onProgress?.(this.position - begin, Math.max(size, this.position) - begin);
      if (!more) break;
      await breathe();
      if (this.stopped) return false;
    }
    this.timer = setInterval(() => this.poll(), this.intervalMs);
    return true;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Lee lo nuevo. Público para los tests. */
  poll(): void {
    this.read(false, POLL_MAX_BYTES);
  }

  /** Lee como mucho `maxBytes`. Dice si queda más por leer. */
  private read(replaying: boolean, maxBytes: number): boolean {
    let size: number;
    try {
      size = statSync(this.path).size;
    } catch {
      return false;
    }
    if (size < this.position) {
      this.position = 0;
      this.remainder = NOTHING;
    }
    const until = Math.min(size, this.position + maxBytes);
    while (this.position < until) {
      const chunk = readRange(this.path, this.position, Math.min(CHUNK_BYTES, until - this.position));
      if (chunk.length === 0) break;
      this.position += chunk.length;
      const bytes = this.remainder.length > 0 ? Buffer.concat([this.remainder, chunk]) : chunk;
      // Solo se descifra hasta el último salto de línea, que nunca cae dentro de una letra.
      const end = bytes.lastIndexOf(NEWLINE);
      if (end < 0) {
        this.remainder = bytes;
        continue;
      }
      this.remainder = Buffer.from(bytes.subarray(end + 1));
      // El retorno de carro de la última línea se queda fuera: con él no casaría ninguna.
      const textEnd = end > 0 && bytes[end - 1] === RETURN ? end - 1 : end;
      for (const line of bytes.toString("utf8", 0, textEnd).split(/\r?\n/)) {
        const event = parseLine(line);
        if (event) this.onEvent(event, replaying);
      }
    }
    return this.position < size;
  }
}
