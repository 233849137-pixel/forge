import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { shouldStartLocalDevServer } from "./lib/dev-server.mjs";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const electronAppEntry = path.join(process.cwd(), "dist-electron", "main.js");

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options
  });
}

async function waitForServer(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

const env = {
  ...process.env,
  FORGE_DEV_SERVER_URL: "http://127.0.0.1:3000"
};

const children = [];

function cleanupWorkspaceElectronWindows() {
  const cleanupProcess = spawn(
    "pkill",
    ["-f", `${process.cwd()}/node_modules/electron/dist/.*default_app\\.asar`],
    {
      stdio: "ignore",
      shell: false
    }
  );

  cleanupProcess.on("error", () => {
    // Ignore cleanup failures; they only affect stale default Electron windows.
  });
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const buildProcess = run(process.execPath, ["scripts/build-electron.mjs"], { env });
children.push(buildProcess);

await new Promise((resolve, reject) => {
  buildProcess.on("exit", (code) => {
    if (code === 0) {
      resolve(undefined);
      return;
    }

    reject(new Error(`electron bundle failed with code ${code}`));
  });
});

const shouldStartDevServer = await shouldStartLocalDevServer(env.FORGE_DEV_SERVER_URL);

if (shouldStartDevServer) {
  const nextProcess = run("npm", ["run", "dev"], { env });
  children.push(nextProcess);
}

await waitForServer(env.FORGE_DEV_SERVER_URL);
cleanupWorkspaceElectronWindows();

const electronProcess = run(
  electronBinary,
  [electronAppEntry],
  {
    env
  }
);
children.push(electronProcess);

electronProcess.on("exit", (code) => shutdown(code ?? 0));
