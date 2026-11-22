import type { PobAnalyseArgs, PobAnalysis, PobBundleMeta } from "./pobTypes";

/** Lo que la página le manda al worker de PoB2. */
export type PobWorkerRequest = { type: "start" } | { type: "analyse"; id: number; args: PobAnalyseArgs };

/** Lo que el worker contesta. */
export type PobWorkerResponse =
  | { type: "progress"; phase: "download" | "start"; fraction: number }
  | { type: "ready"; version: string | null; meta: PobBundleMeta }
  | { type: "failed"; message: string }
  | { type: "result"; id: number; analysis: PobAnalysis }
  | { type: "error"; id: number; message: string };
