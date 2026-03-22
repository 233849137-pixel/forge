import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const electronAppSource = path.join(root, "node_modules", "electron", "dist", "Electron.app");
const distElectronDir = path.join(root, "dist-electron");
const outputDir = path.join(root, "dist-desktop");
const forgeAppDir = path.join(outputDir, "Forge.app");
const resourcesAppDir = path.join(forgeAppDir, "Contents", "Resources", "app");
const plistPath = path.join(forgeAppDir, "Contents", "Info.plist");

async function updatePlist(plistFile, key, value) {
  await execFileAsync("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${key} ${value}`,
    plistFile
  ]);
}

await rm(forgeAppDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(electronAppSource, forgeAppDir, { recursive: true });

await rm(resourcesAppDir, { recursive: true, force: true });
await mkdir(resourcesAppDir, { recursive: true });

await writeFile(
  path.join(resourcesAppDir, "package.json"),
  JSON.stringify(
    {
      name: "forge-dev-shell",
      productName: "Forge",
      main: "main.js"
    },
    null,
    2
  )
);

for (const fileName of ["main.js", "main.js.map", "preload.js", "preload.js.map"]) {
  await cp(path.join(distElectronDir, fileName), path.join(resourcesAppDir, fileName));
}

await updatePlist(plistPath, "CFBundleDisplayName", "Forge");
await updatePlist(plistPath, "CFBundleName", "Forge");
await updatePlist(plistPath, "CFBundleIdentifier", "com.xiaomo.forge.dev");

console.log(`forge desktop shell ready at ${forgeAppDir}`);
