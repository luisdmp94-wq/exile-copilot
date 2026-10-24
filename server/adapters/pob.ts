import { inflateRawSync, inflateSync } from "node:zlib";
import {
  POB_INFLATE_FAILED_WARNING,
  POB_INVALID_BASE64_WARNING,
  POB_MAX_INPUT_CHARS,
  POB_MAX_OUTPUT_BYTES,
  POB_TOO_LONG_WARNING,
  pobFailure,
  readPobXml,
  type PobDecodeResult,
} from "./pobXml.js";

/**
 * Adaptador de Path of Building 2 para el servidor: base64url y zlib con Node.
 * La lectura del XML está en `pobXml.ts`, compartida con el navegador.
 */

export {
  looksLikePobCode,
  POB_MAX_INPUT_CHARS,
  POB_MAX_OUTPUT_BYTES,
  type PobDecodeResult,
  type PobPartial,
} from "./pobXml.js";

function fromPobBase64(code: string): Buffer {
  return Buffer.from(code.trim().replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function tryInflate(buf: Buffer): string | null {
  for (const inflate of [inflateSync, inflateRawSync]) {
    try {
      const out = inflate(buf, { maxOutputLength: POB_MAX_OUTPUT_BYTES }).toString("utf8");
      if (out.length > 0) return out;
    } catch {
      // probar la siguiente variante
    }
  }
  return null;
}

/** Decodifica un código PoB2. Nunca lanza. */
export function decodePobCode(code: string): PobDecodeResult {
  try {
    if (code.length > POB_MAX_INPUT_CHARS) return pobFailure(POB_TOO_LONG_WARNING);
    const buf = fromPobBase64(code);
    if (buf.length === 0) return pobFailure(POB_INVALID_BASE64_WARNING);
    const xml = tryInflate(buf);
    if (!xml) return pobFailure(POB_INFLATE_FAILED_WARNING);
    return readPobXml(xml);
  } catch (err) {
    return pobFailure(
      `No verificado — error inesperado decodificando PoB: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
