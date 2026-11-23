import { contextBridge, ipcRenderer } from "electron";

/** Lo único que la página puede hacer: recibir el paso, decir su altura, moverse por el asa y pulsar sus botones. */
contextBridge.exposeInMainWorld("ventanita", {
  onState: (callback: (state: unknown) => void) => ipcRenderer.on("estado", (_event, state) => callback(state)),
  reportHeight: (height: number) => ipcRenderer.send("altura", height),
  grip: (over: boolean) => ipcRenderer.send("asa", over),
  drag: (phase: "inicio" | "fin") => ipcRenderer.send("arrastre", phase),
  action: (name: string, value?: string) => ipcRenderer.send("accion", name, value),
});
