import { spawnSync } from "node:child_process";
import { isolatedReleaseEnvironment } from "../server/publicReleaseEnvironment.js";

const npmEntrypoint = process.env.npm_execpath;
if (!npmEntrypoint) {
  throw new Error(
    "No se encontró npm_execpath. Ejecuta esta barrera mediante npm run verify:public.",
  );
}

const targetIndex = process.argv.indexOf("--target");
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
if (target !== undefined && target !== "1.0") {
  throw new Error(`Objetivo público no soportado: ${target}`);
}

const script = target === "1.0" ? "verify:1.0" : "verify:release";
console.log(
  `\nConfiguración pública aprobada. Ejecutando ${script} en un entorno local aislado.\n`,
);

const result = spawnSync(process.execPath, [npmEntrypoint, "run", script], {
  cwd: process.cwd(),
  env: isolatedReleaseEnvironment(process.env),
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
