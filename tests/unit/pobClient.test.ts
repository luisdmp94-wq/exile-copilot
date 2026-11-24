import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POB_ANALYSE_TIMEOUT_MS, PobClient, PobSupersededError, type PobWorkerLike } from "../../src/pob/pobQueue";
import type { PobAnalyseArgs } from "../../src/pob/pobTypes";

/** Un worker de mentira: guarda lo que se le pide y contesta cuando el test lo dice. */
class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string; preventDefault: () => void }) => void) | null = null;
  posted: Array<{ type: string; id?: number }> = [];
  terminated = false;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(message: { type: string; id?: number }): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  answer(data: unknown): void {
    this.onmessage?.({ data });
  }
}

const ARGS = {} as PobAnalyseArgs;
const META = { version: "prueba" } as never;

describe("el cliente de PoB2 cuando el motor no contesta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const newClient = () => new PobClient(() => new FakeWorker() as unknown as PobWorkerLike);

  it("un cálculo que no vuelve se da por colgado, y deja reintentar", async () => {
    const client = newClient();
    const first = client.analyse(ARGS);
    const failure = first.catch((error: Error) => error);
    const worker = FakeWorker.last!;
    worker.answer({ type: "ready", version: "x", meta: META });
    expect(client.getStatus().state).toBe("ready");

    vi.advanceTimersByTime(POB_ANALYSE_TIMEOUT_MS - 1);
    expect(client.getStatus().state).toBe("ready");
    vi.advanceTimersByTime(2);
    expect(client.getStatus()).toMatchObject({ state: "failed", reason: "timeout" });
    expect(worker.terminated).toBe(true);
    expect(await failure).toBeInstanceOf(Error);

    // Reintentar crea otro motor y funciona.
    const second = client.analyse(ARGS);
    const fresh = FakeWorker.last!;
    expect(fresh).not.toBe(worker);
    fresh.answer({ type: "ready", version: "x", meta: META });
    const id = fresh.posted.find((message) => message.type === "analyse")!.id;
    fresh.answer({ type: "result", id, analysis: { ok: true } });
    await expect(second).resolves.toEqual({ ok: true });
    // Con la respuesta dada, el reloj ya no salta.
    vi.advanceTimersByTime(POB_ANALYSE_TIMEOUT_MS * 2);
    expect(client.getStatus().state).toBe("ready");
  });

  it("distingue no arrancar (puede ser la conexión) de pararse calculando", () => {
    const client = newClient();
    void client.analyse(ARGS).catch(() => undefined);
    FakeWorker.last!.answer({ type: "failed", message: "no se pudo descargar" });
    expect(client.getStatus()).toMatchObject({ state: "failed", reason: "start" });

    void client.analyse(ARGS).catch(() => undefined);
    const worker = FakeWorker.last!;
    worker.answer({ type: "ready", version: "x", meta: META });
    worker.answer({ type: "failed", message: "memoria agotada" });
    expect(client.getStatus()).toMatchObject({ state: "failed", reason: "crashed" });
  });

  it("una petición más nueva de la misma fila descarta la anterior sin colgar nada", async () => {
    const client = newClient();
    void client.analyse(ARGS).catch(() => undefined);
    const waiting = client.analyse(ARGS, "arbol");
    const replaced = waiting.catch((error: Error) => error);
    void client.analyse(ARGS, "arbol").catch(() => undefined);
    expect(await replaced).toBeInstanceOf(PobSupersededError);
  });
});
