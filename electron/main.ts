import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  presentWindow,
  rememberWindow,
  shouldOpenDevTools
} from "./window-registry";
import { configureDesktopRuntime } from "./runtime-config";

const isDev = Boolean(process.env.FORGE_DEV_SERVER_URL);
const openWindows = new Set<BrowserWindow>();
const appIdentity = "Forge";

configureDesktopRuntime(app, process.env);
app.setName(appIdentity);

if (process.platform === "darwin") {
  app.setPath("userData", path.join(app.getPath("appData"), appIdentity));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    show: false,
    width: 1540,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#07111d",
    title: appIdentity,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false
    }
  });

  presentWindow(mainWindow);

  if (isDev) {
    void mainWindow.loadURL(process.env.FORGE_DEV_SERVER_URL as string);
    if (shouldOpenDevTools(process.env)) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    rememberWindow(mainWindow, openWindows);
    return;
  }

  void mainWindow.loadURL("http://127.0.0.1:3000");
  rememberWindow(mainWindow, openWindows);
}

app.whenReady().then(() => {
  ipcMain.handle("forge:environment", () => ({
    platform: process.platform,
    localFirst: true,
    desktop: true
  }));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("second-instance", () => {
  const currentWindow = BrowserWindow.getAllWindows()[0];

  if (!currentWindow) {
    return;
  }

  if (currentWindow.isMinimized()) {
    currentWindow.restore();
  }

  currentWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
