import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const target = resolve(root, "dist-server", "server");

mkdirSync(target, { recursive: true });
for (const directory of ["data", "fixtures"]) {
  const destination = resolve(target, directory);
  rmSync(destination, { recursive: true, force: true });
  cpSync(resolve(root, "server", directory), destination, { recursive: true });
}
