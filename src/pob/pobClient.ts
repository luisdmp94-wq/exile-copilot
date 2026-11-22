/**
 * La página habla con Path of Building 2 a través de este cliente: un solo
 * worker por pestaña, que se crea la primera vez que alguien lo necesita.
 */
import type { PobWorkerRequest, PobWorkerResponse } from "./pobProtocol";
import type { PobAnalyseArgs, PobAnalysis, PobBundleMeta } from "./pobTypes";

export type PobStatus =
  | { state: "idle" }
  | { state: "loading"; phase: "download" | "start"; fraction: number }
  | { state: "ready"; meta: PobBundleMeta }
  | { state: "failed"; message: string };

type Listener = (status: PobStatus) => void;

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

class PobClient {
  private worker: Worker | null = null;
  private status: PobStatus = { state: "idle" };
  private readonly listeners = new Set<Listener>();
  private readonly pending = new Map<number, { resolve: (analysis: PobAnalysis) => void; reject: (error: Error) => void }>();
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

  private fail(message: string): void {
    this.worker?.terminate();
    this.worker = null;
    for (const { reject } of this.pending.values()) reject(new Error(message));
    this.pending.clear();
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
      case "result": {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        request?.resolve(message.analysis);
        break;
      }
      case "error": {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        request?.reject(new Error(message.message));
        break;
      }
    }
  }

  start(): void {
    if (this.status.state === "ready" || this.status.state === "loading") return;
    this.setStatus({ state: "loading", phase: "download", fraction: 0 });
    const request: PobWorkerRequest = { type: "start" };
    this.ensureWorker().postMessage(request);
  }

  analyse(args: PobAnalyseArgs): Promise<PobAnalysis> {
    this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: PobWorkerRequest = { type: "analyse", id, args };
      this.ensureWorker().postMessage(request);
    });
  }
}

export const pobClient = new PobClient();
