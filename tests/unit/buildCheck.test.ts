import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { importBuild } from "../../server/importers/buildImporter.js";
import {
  checkPastedCode,
  explainImportError,
  readBuildForCheck,
} from "../../src/lib/buildCheck.js";

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../server/fixtures/pob2/${name}`, import.meta.url)),
    "utf8",
  );
}

const defaults = { league: "Standard", patch: "0.5.5" };

function importProfile(code: string) {
  const { profile } = importBuild(code, defaults, "character");
  if (!profile) throw new Error("El código PoB2 debería producir un personaje");
  return profile;
}

describe("chequeo de build — lectura de un código PoB2", () => {
  it("lee identidad, defensas, resistencias y atributos de una build completa", () => {
    const reading = readBuildForCheck(
      importProfile(makePobCode(fixture("richCharacter.synthetic.xml"))),
    );

    expect(reading.identity).toBe("Ranger · Ritualist · nivel 90");
    expect(reading.defences).toEqual([
      { label: "Vida", value: (2687).toLocaleString("es-ES") },
      { label: "Escudo de energía", value: "437" },
      { label: "Armadura", value: (1019).toLocaleString("es-ES") },
      { label: "Evasión", value: (5251).toLocaleString("es-ES") },
    ]);
    expect(reading.resistances.map((row) => row.value)).toEqual(["75%", "75%", "75%", "36%"]);
    expect(reading.attributes.map((row) => row.value)).toEqual(["138", "196", "64"]);
    expect(reading.knownStats).toBe(11);
    expect(reading.itemCount).toBeGreaterThan(0);
    expect(reading.mainSkill).not.toBeNull();
  });

  it("no muestra «None» como ascendencia en un código real sin ascendencia", () => {
    const reading = readBuildForCheck(importProfile(fixture("realBuildCode.txt").trim()));

    expect(reading.identity).toBe("Ranger · nivel 1");
    expect(reading.resistances.map((row) => row.value)).toEqual(["-50%", "-50%", "-50%", "0%"]);
  });

  it("un código sin estadísticas deja los valores sin dato, nunca a 0", () => {
    const reading = readBuildForCheck(
      importProfile(makePobCode('<PathOfBuilding2><Build className="Witch"/></PathOfBuilding2>')),
    );

    expect(reading.identity).toBe("Witch");
    expect(reading.knownStats).toBe(0);
    expect(
      [...reading.defences, ...reading.resistances, ...reading.attributes].every(
        (row) => row.value === null,
      ),
    ).toBe(true);
    expect(reading.mainSkill).toBeNull();
  });
});

describe("chequeo de build — mensajes cuando lo pegado no sirve", () => {
  it("pide el código cuando está vacío o es un enlace", () => {
    expect(checkPastedCode("")).toBe("Pega primero el código de tu build.");
    expect(checkPastedCode("https://pobb.in/abc123")).toContain("Eso es un enlace");
    expect(checkPastedCode(makePobCode(fixture("richCharacter.synthetic.xml")))).toBeNull();
  });

  it("traduce los errores del importador sin enseñar códigos internos", () => {
    const unknown = explainImportError("formato-desconocido", "Formato no reconocido.");
    expect(unknown).toContain("no parece un código de Path of Building 2");
    expect(unknown).not.toContain("formato-desconocido");

    expect(
      explainImportError(
        "pob-code-invalido",
        "Rechazado — el código pertenece a Path of Building para PoE1.",
      ),
    ).toContain("es de Path of Building para PoE1");
    expect(explainImportError("pob-code-invalido", "zlib")).toContain("incompleto o dañado");
    expect(explainImportError("otro-error", "Detalle del servidor")).toBe("Detalle del servidor");
  });
});
