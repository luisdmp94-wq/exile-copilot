/**
 * La cola de cálculos de Path of Building 2: un solo worker, que se crea la
 * primera vez que alguien lo necesita. Aquí no hay nada del navegador (el
 * worker se recibe hecho), para poder probarlo; el cliente de la página está
 * en `pobClient.ts`.
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
  /**
   * `reason`: «start» si no llegó a descargarse o arrancar (puede ser la
   * conexión); «crashed» o «timeout» si ya funcionaba y se paró o dejó de
   * contestar calculando (no es la conexión).
   */
  | { state: "failed"; message: string; reason: "start" | "crashed" | "timeout" };

type Listener = (status: PobStatus) => void;

/** Una petición que ya no hace falta porque llegó otra más nueva. */
export class PobSupersededError extends Error {
  constructor() {
    super("superseded");
  }
}

/**
 * Lo que se espera un cálculo antes de darlo por colgado. Uno normal tarda
 * segundos; el margen cubre la descarga y el arranque en un móvil lento.
 */
export const POB_ANALYSE_TIMEOUT_MS = 90_000;

interface Pending {
  args: PobAnalyseArgs;
  resolve: (analysis: PobAnalysis) => void;
  reject: (error: Error) => void;
}

/** Lo que el cliente usa de un worker: así se puede probar sin navegador. */
export interface PobWorkerLike {
  onmessage: ((event: { data: PobWorkerResponse }) => void) | null;
  onerror: ((event: { message?: string; preventDefault(): void }) => void) | null;
  postMessage(message: PobWorkerRequest): void;
  terminate(): void;
}

export class PobClient {
  private worker: PobWorkerLike | null = null;
  private readonly createWorker: () => PobWorkerLike;

  constructor(createWorker: () => PobWorkerLike) {
    this.createWorker = createWorker;
  }

  private watchdog: ReturnType<typeof setTimeout> | null = null;
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

  private ensureWorker(): PobWorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => this.handle(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      this.fail(event.message || "PoB2 se ha parado", this.status.state === "ready" ? "crashed" : "start");
    };
    this.worker = worker;
    return worker;
  }

  /** El motor no sirve (no descargó, no arrancó o se rompió): se tira y se puede reintentar. */
  private fail(message: string, reason: "start" | "crashed" | "timeout"): void {
    this.disarm();
    this.worker?.terminate();
    this.worker = null;
    const error = new Error(message);
    this.running?.reject(error);
    for (const pending of this.queued.values()) pending.reject(error);
    this.running = null;
    this.queued.clear();
    this.setStatus({ state: "failed", message, reason });
  }

  private disarm(): void {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
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
        this.fail(message.message, this.status.state === "ready" ? "crashed" : "start");
        break;
      case "result":
      case "error": {
        const request = this.running;
        if (!request || request.id !== message.id) break;
        this.disarm();
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
    // Si el motor se queda colgado no avisa: sin esto, «Calculando…» para siempre y sin botón de reintentar.
    this.disarm();
    this.watchdog = setTimeout(() => this.fail("PoB2 no ha contestado a tiempo", "timeout"), POB_ANALYSE_TIMEOUT_MS);
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

