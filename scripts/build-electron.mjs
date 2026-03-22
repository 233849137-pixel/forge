import { mkdir } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const outdir = path.join(root, "dist-electron");

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  outdir,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  external: ["electron"]
});

console.log(`electron bundle ready at ${outdir}`);
