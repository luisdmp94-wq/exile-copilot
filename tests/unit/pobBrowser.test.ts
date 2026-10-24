import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateRawSync, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import { readPobCodeInBrowser } from "../../src/lib/pobBrowser.js";

function toPobCode(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../server/fixtures/pob2/${name}`, import.meta.url)),
    "utf8",
  );
}

/** Ids y fechas cambian en cada lectura; todo lo demás debe coincidir. */
function withoutVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutVolatileFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["id", "importedAt", "retrievedAt"].includes(key))
        .map(([key, child]) => [key, withoutVolatileFields(child)]),
    );
  }
  return value;
}

const sameDefaults = { league: "Desconocida", patch: "desconocido" };

describe("lector de PoB2 en el navegador", () => {
  const codes = {
    "código real de nivel 1": fixture("realBuildCode.txt").trim(),
    "instantánea rica (zlib)": toPobCode(deflateSync(Buffer.from(fixture("richCharacter.synthetic.xml")))),
    "instantánea rica (deflate sin cabecera)": toPobCode(
      deflateRawSync(Buffer.from(fixture("richCharacter.synthetic.xml"))),
    ),
  };

  for (const [label, code] of Object.entries(codes)) {
    it(`da el mismo personaje que el servidor: ${label}`, async () => {
      const browser = await readPobCodeInBrowser(code);
      if (!browser.ok) throw new Error(browser.detail);
      const server = importBuild(code, sameDefaults, "character").profile;
      expect(withoutVolatileFields(browser.profile)).toEqual(withoutVolatileFields(server));
    });
  }

  it("lo que no es un código PoB2 (texto o un .build JSON) es formato desconocido", async () => {
    expect(await readPobCodeInBrowser("hola esto no es un codigo")).toMatchObject({
      ok: false,
      code: "formato-desconocido",
    });
    expect(await readPobCodeInBrowser('{"name":"plan"}')).toMatchObject({
      ok: false,
      code: "formato-desconocido",
    });
  });

  it("reconoce un código de PoB para PoE1 y lo dice", async () => {
    const poe1 = toPobCode(deflateSync(Buffer.from("<PathOfBuilding><Build level='90'/></PathOfBuilding>")));
    const result = await readPobCodeInBrowser(poe1);
    expect(result).toMatchObject({ ok: false, code: "pob-code-invalido" });
    expect(!result.ok && result.detail).toContain("PoE1");
  });

  it("un código cortado no se puede descomprimir", async () => {
    const full = codes["instantánea rica (zlib)"];
    const result = await readPobCodeInBrowser(`AAAA${full.slice(40, 120)}`);
    expect(result).toMatchObject({ ok: false, code: "pob-code-invalido" });
  });

  it("rechaza un código que se infla por encima de 2 MB", async () => {
    const bomb = toPobCode(
      deflateSync(Buffer.from(`<PathOfBuilding2>${" ".repeat(3 * 1024 * 1024)}</PathOfBuilding2>`)),
    );
    const result = await readPobCodeInBrowser(bomb);
    expect(result).toMatchObject({ ok: false, code: "pob-code-invalido" });
    expect(!result.ok && result.detail).toContain("2 MB");
  });
});
