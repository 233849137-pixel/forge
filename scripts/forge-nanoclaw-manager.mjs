import { main } from "./lib/forge-nanoclaw-manager.mjs";

main()
  .then((exitCode) => {
    process.exitCode = Number.isInteger(exitCode) ? exitCode : 0;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
