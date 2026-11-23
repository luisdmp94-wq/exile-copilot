import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Lectura de Client.txt, el registro que escribe PoE2. Solo se mira la línea
 * de cambio de zona; el resto (chat, nombre de cuenta…) se descarta sin
 * guardarlo. Nada sale del equipo.
 */

const AREA_LINE = /Generating level (\d+) area "([^"]+)"/;

export interface AreaChange {
  level: number;
  code: string;
}

export function parseAreaLine(line: string): AreaChange | null {
  const match = AREA_LINE.exec(line);
  return match ? { level: Number(match[1]), code: match[2]! } : null;
}

/** La última zona escrita en un trozo de texto. */
export function lastAreaIn(text: string): AreaChange | null {
  const lines = text.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const area = parseAreaLine(lines[index]!);
    if (area) return area;
  }
  return null;
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

/** Cuánto del final se lee al arrancar para saber la zona actual. */
const STARTUP_TAIL_BYTES = 4 * 1024 * 1024;
/** Más de esto de golpe (el juego escribió mucho) se lee solo el final. */
const MAX_READ_BYTES = 8 * 1024 * 1024;

function readRange(path: string, start: number, end: number): string {
  const length = Math.max(0, end - start);
  if (length === 0) return "";
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buffer, 0, length, start);
  } finally {
    closeSync(fd);
  }
  return buffer.toString("utf8");
}

/**
 * Sigue Client.txt como `tail -f`: al arrancar busca la última zona en el
 * final del archivo y luego, cada medio segundo, lee solo lo nuevo. Si el
 * archivo se vacía (el jugador lo borró), vuelve a empezar desde cero.
 */
export class ClientLogTail {
  private offset = 0;
  private remainder = "";
  private timer: NodeJS.Timeout | null = null;
  private readonly path: string;
  private readonly onArea: (area: AreaChange, fromStartup: boolean) => void;
  private readonly intervalMs: number;

  constructor(path: string, onArea: (area: AreaChange, fromStartup: boolean) => void, intervalMs = 500) {
    this.path = path;
    this.onArea = onArea;
    this.intervalMs = intervalMs;
  }

  start(): void {
    const size = statSync(this.path).size;
    const last = lastAreaIn(readRange(this.path, Math.max(0, size - STARTUP_TAIL_BYTES), size));
    this.offset = size;
    if (last) this.onArea(last, true);
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Lee lo nuevo. Público para los tests. */
  poll(): void {
    let size: number;
    try {
      size = statSync(this.path).size;
    } catch {
      return;
    }
    if (size < this.offset) {
      this.offset = 0;
      this.remainder = "";
    }
    if (size === this.offset) return;
    const start = Math.max(this.offset, size - MAX_READ_BYTES);
    const text = this.remainder + readRange(this.path, start, size);
    this.offset = size;
    const lines = text.split(/\r?\n/);
    this.remainder = lines.pop() ?? "";
    for (const line of lines) {
      const area = parseAreaLine(line);
      if (area) this.onArea(area, false);
    }
  }
}
