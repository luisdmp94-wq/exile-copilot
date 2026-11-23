import { contextBridge, ipcRenderer } from "electron";

/** Lo único que la página de la ventanita puede hacer: recibir el paso y decir su altura. */
contextBridge.exposeInMainWorld("ventanita", {
  onState: (callback: (state: unknown) => void) => ipcRenderer.on("estado", (_event, state) => callback(state)),
  reportHeight: (height: number) => ipcRenderer.send("altura", height),
});
