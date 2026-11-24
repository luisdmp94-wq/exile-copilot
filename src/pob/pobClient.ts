/**
 * La página habla con Path of Building 2 a través de este cliente: un solo
 * worker por pestaña. La cola y los tiempos de espera están en `pobQueue.ts`.
 */
import { PobClient, type PobWorkerLike } from "./pobQueue";

export { POB_ANALYSE_TIMEOUT_MS, PobSupersededError, type PobStatus } from "./pobQueue";

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

export const pobClient = new PobClient(
  () =>
    new Worker(new URL("./pob.worker.ts", import.meta.url), {
      type: "module",
      name: "path-of-building-2",
    }) as unknown as PobWorkerLike,
);
