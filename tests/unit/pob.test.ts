import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  decodePobCode,
  looksLikePobCode,
  POB_MAX_INPUT_CHARS,
  POB_MAX_OUTPUT_BYTES,
} from "../../server/adapters/pob.js";

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("pob adapter — robustez", () => {
  it("decodifica un código PoB válido", () => {
    const xml = `<PathOfBuilding><Build level="70" className="Mercenary"/></PathOfBuilding>`;
    const result = decodePobCode(makePobCode(xml));
    expect(result.ok).toBe(true);
    expect(result.partial.characterClass).toBe("Mercenary");
    expect(result.partial.level).toBe(70);
  });

  it("rechaza entradas que superan el límite de tamaño sin lanzar ni colgar", () => {
    const huge = "a".repeat(POB_MAX_INPUT_CHARS + 1);
    expect(looksLikePobCode(huge)).toBe(true); // formato base64url válido
    const result = decodePobCode(huge);
    expect(result.ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("límite de entrada"))).toBe(true);
  });

  it("rechaza payloads cuya descompresión supera maxOutputLength (zip-bomb guard)", () => {
    // XML repetido que infla a más de POB_MAX_OUTPUT_BYTES
    const chunk = "<PathOfBuilding><Build level=\"70\"/>".padEnd(1000, " ");
    const bigXml = `${chunk.repeat(Math.ceil((POB_MAX_OUTPUT_BYTES + 1000) / 1000))}</PathOfBuilding>`;
    const code = makePobCode(bigXml);
    const result = decodePobCode(code);
    expect(result.ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("descomprimir") || w.includes("descompresión"))).toBe(true);
  });

  it("código corrupto (base64url válido, no zlib) → rechazo con warning", () => {
    const result = decodePobCode("a".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
