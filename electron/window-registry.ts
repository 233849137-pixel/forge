type WindowLike = {
  on: (event: "closed", handler: () => void) => void;
};

type PresentableWindowLike = {
  once: (event: "ready-to-show", handler: () => void) => void;
  show: () => void;
  focus: () => void;
};

type DevToolsEnv = NodeJS.ProcessEnv;

export function rememberWindow<T extends WindowLike>(window: T, windows: Set<T>) {
  windows.add(window);
  window.on("closed", () => {
    windows.delete(window);
  });

  return window;
}

export function presentWindow<T extends PresentableWindowLike>(window: T) {
  window.once("ready-to-show", () => {
    window.show();
    window.focus();
  });

  return window;
}

export function shouldOpenDevTools(env: DevToolsEnv) {
  return env.FORGE_OPEN_DEVTOOLS === "1";
}
