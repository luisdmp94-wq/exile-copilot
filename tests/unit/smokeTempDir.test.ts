import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error — los smokes son JS puro sin tipos; se prueban sus helpers.
import { createSmokeTempDir, removeSmokeTempDir } from "../../scripts/browserLaunch.mjs";

/**
 * Aislamiento de la base SQLite de los smokes.
 *
 * `equipment-smoke` y `browser-smoke` podían arrancar el servidor sin
 * `DATABASE_PATH`, es decir, contra la base REAL del usuario. Estos helpers son
 * el mecanismo compartido; aquí se prueba que crean una carpeta propia y, sobre
 * todo, que la limpieza no puede salirse de ella.
 */

const creadas: string[] = [];

afterAll(() => {
  for (const dir of creadas) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("carpeta temporal de los smokes", () => {
  it("crea una carpeta propia dentro del temporal del sistema", () => {
    const dir = createSmokeTempDir("prueba") as string;
    creadas.push(dir);
    const tmpAbs = resolve(realpathSync(tmpdir()));

    expect(existsSync(dir)).toBe(true);
    expect(resolve(dir).startsWith(tmpAbs + sep)).toBe(true);
    expect(basename(dir).startsWith("exile-copilot-prueba-")).toBe(true);
  });

  it("dos ejecuciones no comparten carpeta", () => {
    const a = createSmokeTempDir("uno") as string;
    const b = createSmokeTempDir("dos") as string;
    creadas.push(a, b);
    expect(a).not.toBe(b);
  });

  it("borra solo la carpeta que creó", () => {
    const dir = createSmokeTempDir("borrable") as string;
    writeFileSync(join(dir, "prod.db"), "x");
    expect(existsSync(dir)).toBe(true);

    expect(removeSmokeTempDir(dir)).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it("NUNCA borra una ruta ajena, aunque se le pase a propósito", () => {
    // Un temporal sin nuestro prefijo simula cualquier carpeta del usuario.
    const ajena = mkdtempSync(join(realpathSync(tmpdir()), "carpeta-del-usuario-"));
    creadas.push(ajena);
    writeFileSync(join(ajena, "datos.db"), "no tocar");

    expect(removeSmokeTempDir(ajena)).toBe(false);
    expect(existsSync(ajena)).toBe(true);
    expect(existsSync(join(ajena, "datos.db"))).toBe(true);
  });

  it("NUNCA borra fuera del temporal del sistema", () => {
    const repo = resolve(fileURLToPathSafe());
    expect(removeSmokeTempDir(repo)).toBe(false);
    expect(existsSync(repo)).toBe(true);
    // Y tampoco el propio directorio temporal.
    expect(removeSmokeTempDir(realpathSync(tmpdir()))).toBe(false);
    expect(existsSync(realpathSync(tmpdir()))).toBe(true);
  });

  it("rechaza sufijos que no son un identificador simple", () => {
    expect(() => createSmokeTempDir("../fuera")).toThrowError();
    expect(() => createSmokeTempDir("")).toThrowError();
  });
});

/** Raíz del repositorio, para comprobar que jamás se borra. */
function fileURLToPathSafe(): string {
  return new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}
