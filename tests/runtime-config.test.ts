import { describe, expect, it, vi } from "vitest";
import { configureDesktopRuntime } from "../electron/runtime-config";

describe("electron runtime config", () => {
  it("disables hardware acceleration by default to avoid compositor black screens", () => {
    const app = {
      disableHardwareAcceleration: vi.fn(),
      commandLine: {
        appendSwitch: vi.fn()
      }
    };

    configureDesktopRuntime(app, {});

    expect(app.disableHardwareAcceleration).toHaveBeenCalledTimes(1);
    expect(app.commandLine.appendSwitch).not.toHaveBeenCalled();
  });

  it("keeps gpu enabled only when explicitly requested", () => {
    const app = {
      disableHardwareAcceleration: vi.fn(),
      commandLine: {
        appendSwitch: vi.fn()
      }
    };

    configureDesktopRuntime(app, { FORGE_USE_GPU: "1" });

    expect(app.disableHardwareAcceleration).not.toHaveBeenCalled();
  });

  it("can also disable gpu compositing when requested", () => {
    const app = {
      disableHardwareAcceleration: vi.fn(),
      commandLine: {
        appendSwitch: vi.fn()
      }
    };

    configureDesktopRuntime(app, {
      FORGE_DISABLE_GPU_COMPOSITING: "1"
    });

    expect(app.disableHardwareAcceleration).toHaveBeenCalledTimes(1);
    expect(app.commandLine.appendSwitch).toHaveBeenCalledWith("disable-gpu-compositing");
  });
});
