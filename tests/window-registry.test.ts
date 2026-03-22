import { describe, expect, it, vi } from "vitest";
import {
  presentWindow,
  rememberWindow,
  shouldOpenDevTools
} from "../electron/window-registry";

describe("electron window registry", () => {
  it("keeps a strong reference until the window is closed", () => {
    const windows = new Set<object>();
    let onClosed: (() => void) | undefined;
    const window = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === "closed") {
          onClosed = handler;
        }
      })
    };

    rememberWindow(window, windows);

    expect(windows.has(window)).toBe(true);

    onClosed?.();

    expect(windows.has(window)).toBe(false);
  });

  it("reveals and focuses the main window once it is ready", () => {
    let onReadyToShow: (() => void) | undefined;
    const window = {
      once: vi.fn((event: string, handler: () => void) => {
        if (event === "ready-to-show") {
          onReadyToShow = handler;
        }
      }),
      show: vi.fn(),
      focus: vi.fn()
    };

    presentWindow(window);

    expect(window.once).toHaveBeenCalledWith("ready-to-show", expect.any(Function));

    onReadyToShow?.();

    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
  });

  it("keeps devtools closed unless explicitly enabled", () => {
    expect(shouldOpenDevTools({})).toBe(false);
    expect(shouldOpenDevTools({ FORGE_OPEN_DEVTOOLS: "0" })).toBe(false);
    expect(shouldOpenDevTools({ FORGE_OPEN_DEVTOOLS: "1" })).toBe(true);
  });
});
