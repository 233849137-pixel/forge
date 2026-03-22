import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("forgeDesktop", {
  getEnvironment: () => ipcRenderer.invoke("forge:environment")
});
