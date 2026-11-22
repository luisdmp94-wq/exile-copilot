/**
 * Path of Building 2 corriendo en Lua 5.2 compilado a WebAssembly.
 *
 * Sin DOM ni Node: lo usan el worker del navegador, los tests y el script que
 * empaqueta el motor. Quien lo crea le da la «glue» de Emscripten (de
 * lua-wasm-bindings), el paquete de archivos de PoB2 y los dos .lua propios.
 */
import type { PobAnalyseArgs, PobAnalysis, PobBundle } from "./pobTypes";

interface GlueModule {
  ready: Promise<unknown>;
  cwrap: (name: string, returnType: string | null, argTypes: string[]) => (...args: unknown[]) => unknown;
}

export type GlueFactory = (module: Record<string, unknown>) => GlueModule;

export interface PobEngineOptions {
  glue: GlueFactory;
  /** Dónde está el .wasm (navegador) o sus bytes (Node). */
  wasm: { url?: string; binary?: Uint8Array };
  bundle: PobBundle;
  boot: string;
  commands: string;
  onLog?: (line: string) => void;
  onProgress?: (fraction: number) => void;
}

export class PobEngineError extends Error {}

/** Trozos pequeños: la glue copia cada texto a la pila de WebAssembly. */
const CHUNK = 60_000;

interface LuaApi {
  loadstring: (state: number, code: string) => number;
  pcallk: (state: number, nargs: number, nresults: number, handler: number, ctx: number, k: number) => number;
  getglobal: (state: number, name: string) => void;
  pushstring: (state: number, text: string) => number;
  tolstring: (state: number, index: number, size: number) => string;
  settop: (state: number, index: number) => void;
}

export class PobEngine {
  private readonly state: number;
  private readonly api: LuaApi;
  readonly version: string | null;

  private constructor(state: number, api: LuaApi, version: string | null) {
    this.state = state;
    this.api = api;
    this.version = version;
  }

  static async start(options: PobEngineOptions): Promise<PobEngine> {
    const module = options.glue({
      print: (line: string) => options.onLog?.(line),
      printErr: (line: string) => options.onLog?.(line),
      ...(options.wasm.binary ? { wasmBinary: options.wasm.binary } : {}),
      ...(options.wasm.url ? { locateFile: () => options.wasm.url } : {}),
    });
    await module.ready;
    const api = {
      newstate: module.cwrap("luaL_newstate", "number", []) as () => number,
      openlibs: module.cwrap("luaL_openlibs", null, ["number"]) as (state: number) => void,
      loadstring: module.cwrap("luaL_loadstring", "number", ["number", "string"]) as (state: number, code: string) => number,
      pcallk: module.cwrap("lua_pcallk", "number", ["number", "number", "number", "number", "number", "number"]) as (
        state: number,
        nargs: number,
        nresults: number,
        handler: number,
        ctx: number,
        k: number,
      ) => number,
      getglobal: module.cwrap("lua_getglobal", null, ["number", "string"]) as (state: number, name: string) => void,
      pushstring: module.cwrap("lua_pushstring", "number", ["number", "string"]) as (state: number, text: string) => number,
      tolstring: module.cwrap("lua_tolstring", "string", ["number", "number", "number"]) as (state: number, index: number, size: number) => string,
      settop: module.cwrap("lua_settop", null, ["number", "number"]) as (state: number, index: number) => void,
    };
    const state = api.newstate();
    api.openlibs(state);
    const engine = new PobEngine(state, api, null);
    engine.run(options.boot, "boot.lua");

    // Los archivos de PoB2, a trozos.
    const entries = Object.entries(options.bundle.files);
    let sent = 0;
    for (const [path, content] of entries) {
      if (content.length === 0) engine.call("__vfs_append", path, "");
      for (let index = 0; index < content.length; index += CHUNK) {
        engine.call("__vfs_append", path, content.slice(index, index + CHUNK));
      }
      sent++;
      if (sent % 50 === 0) options.onProgress?.(0.6 * (sent / entries.length));
    }
    engine.call("__vfs_finish");
    options.onProgress?.(0.6);

    engine.run(options.commands, "commands.lua");
    const started = JSON.parse(engine.call("pobStart")) as { ok?: boolean; error?: string; version?: string };
    if (!started.ok) throw new PobEngineError(started.error ?? "PoB2 no arrancó");
    options.onProgress?.(1);
    return new PobEngine(state, api, started.version ?? null);
  }

  /** Ejecuta un trozo de Lua y devuelve lo que devuelva (como texto). */
  run(code: string, name: string): string {
    if (this.api.loadstring(this.state, code) !== 0) {
      const message = this.api.tolstring(this.state, -1, 0);
      this.api.settop(this.state, 0);
      throw new PobEngineError(`${name}: ${message}`);
    }
    return this.finishCall(0, name);
  }

  /** Llama a una función global de Lua con textos y devuelve su texto. */
  call(name: string, ...args: string[]): string {
    this.api.getglobal(this.state, name);
    for (const arg of args) this.api.pushstring(this.state, arg);
    return this.finishCall(args.length, name);
  }

  private finishCall(nargs: number, name: string): string {
    const status = this.api.pcallk(this.state, nargs, 1, 0, 0, 0);
    const text = this.api.tolstring(this.state, -1, 0);
    this.api.settop(this.state, 0);
    if (status !== 0) throw new PobEngineError(`${name}: ${text}`);
    return text;
  }

  /** Un texto largo entra como archivo del disco virtual (la pila es pequeña). */
  private stage(path: string, text: string): void {
    for (let index = 0; index < text.length; index += CHUNK) {
      this.call("__vfs_append", path, text.slice(index, index + CHUNK));
    }
    if (text.length === 0) this.call("__vfs_append", path, "");
    this.call("__vfs_finish");
  }

  analyse(args: PobAnalyseArgs): PobAnalysis {
    // El disco virtual guarda rutas sin «/» inicial; `io.open("/tmp/…")` la quita.
    this.stage("tmp/args.json", JSON.stringify(args));
    const result = JSON.parse(this.call("pobAnalyseFile", "/tmp/args.json")) as PobAnalysis | { error: string };
    if ("error" in result) throw new PobEngineError(result.error);
    return result;
  }

  /** Solo para el empaquetado: ¿compila cada archivo en Lua 5.2? */
  syntaxCheck(): { files: number; errors: string[] } {
    const [count, ...errors] = this.call("__vfs_check").split("\n");
    return { files: Number(count), errors: errors.filter(Boolean) };
  }
}
