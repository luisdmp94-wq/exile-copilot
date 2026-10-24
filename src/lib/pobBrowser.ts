import type { CharacterProfile } from "@shared/domain.js";
import {
  looksLikePobCode,
  POB_INFLATE_FAILED_WARNING,
  POB_INVALID_BASE64_WARNING,
  POB_MAX_INPUT_CHARS,
  POB_MAX_OUTPUT_BYTES,
  POB_TOO_LONG_WARNING,
  readPobXml,
} from "../../server/adapters/pobXml";
import { profileFromPob } from "../../server/importers/pobProfile";

/**
 * Lee un código de Path of Building 2 en el navegador, sin servidor: el código
 * del jugador nunca sale de su equipo. Descomprime con DecompressionStream y
 * comparte con el servidor la lectura del XML y la creación del personaje, así
 * que el resultado es el mismo que daba POST /import/build.
 */

export type PobBrowserResult =
  | { ok: true; profile: CharacterProfile }
  /** Mismos códigos de error que el servidor, para reutilizar explainImportError. */
  | { ok: false; code: "formato-desconocido" | "pob-code-invalido"; detail: string };

/** El chequeo no conoce liga ni parche: se declaran desconocidos en vez de suponerlos. */
const CHECK_IMPORT_DEFAULTS = { league: "Desconocida", patch: "desconocido" };

function invalid(warnings: string[]): PobBrowserResult {
  return {
    ok: false,
    code: "pob-code-invalido",
    detail: `No se pudo importar el código Path of Building 2. ${warnings.join(" ")}`,
  };
}

function fromPobBase64(code: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/** Descomprime con un tope de salida: un código malicioso no puede inflar sin límite. */
async function inflate(bytes: Uint8Array<ArrayBuffer>, format: "deflate" | "deflate-raw"): Promise<string | null> {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > POB_MAX_OUTPUT_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8").decode(joined);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function readPobCodeInBrowser(content: string): Promise<PobBrowserResult> {
  const code = content.trim();
  if (!looksLikePobCode(code)) {
    return { ok: false, code: "formato-desconocido", detail: "Formato no reconocido." };
  }
  if (code.length > POB_MAX_INPUT_CHARS) return invalid([POB_TOO_LONG_WARNING]);
  const bytes = fromPobBase64(code);
  if (!bytes || bytes.length === 0) return invalid([POB_INVALID_BASE64_WARNING]);

  // Igual que el servidor: primero zlib y, si falla, deflate sin cabecera.
  const xml = (await inflate(bytes, "deflate")) ?? (await inflate(bytes, "deflate-raw"));
  if (!xml) return invalid([POB_INFLATE_FAILED_WARNING]);

  const decoded = readPobXml(xml);
  if (!decoded.ok) return invalid(decoded.warnings);
  return { ok: true, profile: profileFromPob(decoded.partial, decoded.warnings, CHECK_IMPORT_DEFAULTS).profile };
}
