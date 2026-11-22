/// <reference lib="webworker" />
/**
 * Path of Building 2 en un hilo aparte: descargar el motor (unos 4 MB, una
 * vez; luego lo guarda el navegador), arrancarlo y calcular sin congelar la
 * página.
 */
import glue from "lua-wasm-bindings/dist/glue/glue-lua-5.2.4.js";
import wasmUrl from "lua-wasm-bindings/dist/glue/glue-lua-5.2.4.wasm?url";
import engineUrl from "../../server/data/pob/engine.json.gz?url";
import boot from "./engine/boot.lua?raw";
import commands from "./engine/commands.lua?raw";
import { PobEngine, type GlueFactory } from "./pobEngine";
import type { PobBundle } from "./pobTypes";
import type { PobWorkerRequest, PobWorkerResponse } from "./pobProtocol";

declare const self: DedicatedWorkerGlobalScope;

let engine: Promise<PobEngine> | null = null;

function post(message: PobWorkerResponse): void {
  self.postMessage(message);
}

async function download(): Promise<PobBundle> {
  const response = await fetch(engineUrl);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) post({ type: "progress", phase: "download", fraction: Math.min(1, received / total) });
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  // Si algún intermediario ya lo descomprimió, llega como JSON directamente.
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gzipped
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
    : new TextDecoder().decode(bytes);
  return JSON.parse(text) as PobBundle;
}

async function start(): Promise<PobEngine> {
  post({ type: "progress", phase: "download", fraction: 0 });
  const bundle = await download();
  post({ type: "progress", phase: "start", fraction: 0 });
  const started = await PobEngine.start({
    glue: glue as unknown as GlueFactory,
    wasm: { url: wasmUrl },
    bundle,
    boot,
    commands,
    onProgress: (fraction) => post({ type: "progress", phase: "start", fraction }),
  });
  post({ type: "ready", version: started.version, meta: bundle.meta });
  return started;
}

self.onmessage = (event: MessageEvent<PobWorkerRequest>) => {
  const request = event.data;
  if (request.type === "start") {
    engine ??= start();
    engine.catch((error: unknown) => {
      engine = null;
      post({ type: "failed", message: error instanceof Error ? error.message : String(error) });
    });
    return;
  }
  if (request.type === "analyse") {
    engine ??= start();
    engine
      .then((ready) => {
        const analysis = ready.analyse(request.args);
        post({ type: "result", id: request.id, analysis });
      })
      .catch((error: unknown) => {
        post({ type: "error", id: request.id, message: error instanceof Error ? error.message : String(error) });
      });
  }
};
