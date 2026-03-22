type RuntimeAppLike = {
  disableHardwareAcceleration: () => void;
  commandLine: {
    appendSwitch: (name: string) => void;
  };
};

type RuntimeEnv = NodeJS.ProcessEnv;

export function configureDesktopRuntime(app: RuntimeAppLike, env: RuntimeEnv) {
  if (env.FORGE_USE_GPU !== "1") {
    app.disableHardwareAcceleration();
  }

  if (env.FORGE_DISABLE_GPU_COMPOSITING === "1") {
    app.commandLine.appendSwitch("disable-gpu-compositing");
  }
}
