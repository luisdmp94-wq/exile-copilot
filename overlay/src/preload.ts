import { contextBridge, ipcRenderer } from "electron";

/** Lo único que la página puede hacer: recibir el paso, decir su altura y moverse por el asa. */
contextBridge.exposeInMainWorld("ventanita", {
  onState: (callback: (state: unknown) => void) => ipcRenderer.on("estado", (_event, state) => callback(state)),
  reportHeight: (height: number) => ipcRenderer.send("altura", height),
  grip: (over: boolean) => ipcRenderer.send("asa", over),
  drag: (phase: "inicio" | "fin") => ipcRenderer.send("arrastre", phase),
});
