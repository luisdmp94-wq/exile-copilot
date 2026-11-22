/**
 * La página habla con Path of Building 2 a través de este cliente: un solo
 * worker por pestaña, que se crea la primera vez que alguien lo necesita.
 *
 * El worker calcula de uno en uno. Mientras calcula, de cada fila («lane»:
 * el árbol que se ve, el guardado para comparar…) solo espera la última
 * petición: si llega otra (el jugador sigue tocando el árbol), la anterior se
 * descarta sin calcularse.
 */
import type { PobWorkerRequest, PobWorkerResponse } from "./pobProtocol";
import type { PobAnalyseArgs, PobAnalysis, PobBundleMeta } from "./pobTypes";

export type PobStatus =
  | { state: "idle" }
  | { state: "loading"; phase: "download" | "start"; fraction: number }
  | { state: "ready"; meta: PobBundleMeta }
  | { state: "failed"; message: string };

type Listener = (status: PobStatus) => void;

/** Una petición que ya no hace falta porque llegó otra más nueva. */
export class PobSupersededError extends Error {
  constructor() {
    super("superseded");
  }
}

const OPT_IN_KEY = "exile-copilot:pob-enabled";

/** ¿El jugador ya dijo que sí a descargar PoB2? Entonces se arranca solo. */
export function pobOptedIn(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberPobOptIn(): void {
  try {
    localStorage.setItem(OPT_IN_KEY, "1");
  } catch {
    // Sin almacenamiento (modo privado): se vuelve a preguntar la próxima vez.
  }
}

interface Pending {
  args: PobAnalyseArgs;
  resolve: (analysis: PobAnalysis) => void;
  reject: (error: Error) => void;
}

class PobClient {
  private worker: Worker | null = null;
  private status: PobStatus = { state: "idle" };
  private readonly listeners = new Set<Listener>();
  private running: (Pending & { id: number }) | null = null;
  private readonly queued = new Map<string, Pending>();
  private nextId = 1;

  getStatus(): PobStatus {
    return this.status;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: PobStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./pob.worker.ts", import.meta.url), { type: "module", name: "path-of-building-2" });
    worker.onmessage = (event: MessageEvent<PobWorkerResponse>) => this.handle(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      this.fail(event.message || "PoB2 se ha parado");
    };
    this.worker = worker;
    return worker;
  }

  /** El motor no sirve (no descargó, no arrancó o se rompió): se tira y se puede reintentar. */
  private fail(message: string): void {
    this.worker?.terminate();
    this.worker = null;
    const error = new Error(message);
    this.running?.reject(error);
    for (const pending of this.queued.values()) pending.reject(error);
    this.running = null;
    this.queued.clear();
    this.setStatus({ state: "failed", message });
  }

  private handle(message: PobWorkerResponse): void {
    switch (message.type) {
      case "progress":
        this.setStatus({ state: "loading", phase: message.phase, fraction: message.fraction });
        break;
      case "ready":
        this.setStatus({ state: "ready", meta: message.meta });
        break;
      case "failed":
        this.fail(message.message);
        break;
      case "result":
      case "error": {
        const request = this.running;
        if (!request || request.id !== message.id) break;
        this.running = null;
        if (message.type === "result") request.resolve(message.analysis);
        else request.reject(new Error(message.message));
        this.pump();
        break;
      }
    }
  }

  private pump(): void {
    if (this.running) return;
    const [lane, next] = this.queued.entries().next().value ?? [];
    if (!lane || !next) return;
    this.queued.delete(lane);
    const id = this.nextId++;
    this.running = { ...next, id };
    const request: PobWorkerRequest = { type: "analyse", id, args: next.args };
    this.ensureWorker().postMessage(request);
  }

  start(): void {
    if (this.status.state === "ready" || this.status.state === "loading") return;
    this.setStatus({ state: "loading", phase: "download", fraction: 0 });
    const request: PobWorkerRequest = { type: "start" };
    this.ensureWorker().postMessage(request);
  }

  analyse(args: PobAnalyseArgs, lane = "main"): Promise<PobAnalysis> {
    this.start();
    return new Promise((resolve, reject) => {
      this.queued.get(lane)?.reject(new PobSupersededError());
      this.queued.set(lane, { args, resolve, reject });
      this.pump();
    });
  }
}

export const pobClient = new PobClient();
