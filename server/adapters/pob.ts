import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Adaptador básico de Path of Building.
 *
 * Un "PoB code" es un documento XML comprimido con zlib (deflate) y codificado
 * en una variante base64url que usa `-` y `_` en lugar de `+` y `/`.
 *
 * Este adaptador es best-effort: si consigue decodificar el XML extrae solo
 * algunos campos (clase, ascendencia, nivel, skills principales) y marca todo
 * con warnings "No verificado — adaptador PoB básico". NUNCA lanza excepciones.
 */

export interface PobPartial {
  characterClass?: string;
  ascendancy?: string;
  level?: number;
  mainSkills: string[];
}

export interface PobDecodeResult {
  ok: boolean;
  /** XML decodificado, si se pudo inflar. */
  xml?: string;
  partial: PobPartial;
  warnings: string[];
}

const POB_WARNING = "No verificado — adaptador PoB básico";

/** Límite de tamaño del código de entrada (caracteres base64url). */
export const POB_MAX_INPUT_CHARS = 1_000_000;
/** Límite de descompresión (zip-bomb guard): el XML inflado no puede superar 2 MB. */
export const POB_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/** Heurística: ¿parece un código PoB (base64url compacto, sin espacios)? */
export function looksLikePobCode(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 32) return false;
  return /^[A-Za-z0-9\-_]+={0,2}$/.test(trimmed);
}

function fromPobBase64(code: string): Buffer {
  const normalized = code.trim().replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function tryInflate(buf: Buffer): string | null {
  for (const inflate of [inflateSync, inflateRawSync]) {
    try {
      // maxOutputLength: defensa zip-bomb; si se supera, zlib lanza y probamos la siguiente variante.
      const out = inflate(buf, { maxOutputLength: POB_MAX_OUTPUT_BYTES }).toString("utf8");
      if (out.length > 0) return out;
    } catch {
      // probar la siguiente variante
    }
  }
  return null;
}

function extractAttr(xml: string, tag: string, attr: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, "i");
  return re.exec(xml)?.[1];
}

function extractXmlFields(xml: string): PobPartial {
  const partial: PobPartial = { mainSkills: [] };

  const className =
    extractAttr(xml, "Build", "className") ?? extractAttr(xml, "Build", "classname");
  if (className) partial.characterClass = className;

  const ascendancy =
    extractAttr(xml, "Build", "ascendClassName") ??
    extractAttr(xml, "Build", "ascendancyName");
  if (ascendancy) partial.ascendancy = ascendancy;

  const levelRaw = extractAttr(xml, "Build", "level");
  if (levelRaw) {
    const level = Number.parseInt(levelRaw, 10);
    if (Number.isFinite(level)) partial.level = level;
  }

  // Nombres de skills principales: best-effort sobre <Skill mainSkill ...> y <Gem ... name>
  const mainSkillMatches = xml.matchAll(/<Skill\b[^>]*\bmainSkill(?:="true"|="1")[^>]*>/gi);
  for (const m of mainSkillMatches) {
    const label = /\blabel="([^"]*)"/i.exec(m[0])?.[1];
    if (label) partial.mainSkills.push(label);
  }
  if (partial.mainSkills.length === 0) {
    const gemNames = xml.matchAll(/<Gem\b[^>]*\b(?:name|skillId)="([^"]+)"[^>]*\b(?:isMain|mainSkill)="(?:true|1)"/gi);
    for (const m of gemNames) partial.mainSkills.push(m[1] ?? "");
  }
  partial.mainSkills = partial.mainSkills.filter((s) => s.length > 0).slice(0, 5);

  return partial;
}

/**
 * Decodifica un código PoB. Nunca lanza: ante cualquier problema devuelve
 * `{ ok: false, partial: { mainSkills: [] }, warnings: [...] }`.
 */
export function decodePobCode(code: string): PobDecodeResult {
  const warnings: string[] = [];
  try {
    if (code.length > POB_MAX_INPUT_CHARS) {
      warnings.push(
        `No verificado — el código PoB supera el límite de entrada (${POB_MAX_INPUT_CHARS} caracteres); rechazado por seguridad.`,
      );
      return { ok: false, partial: { mainSkills: [] }, warnings };
    }
    const buf = fromPobBase64(code);
    if (buf.length === 0) {
      warnings.push("No verificado — el código PoB no es base64 válido");
      return { ok: false, partial: { mainSkills: [] }, warnings };
    }
    const xml = tryInflate(buf);
    if (!xml) {
      warnings.push(
        "No verificado — no se pudo descomprimir el código PoB (zlib) o supera el límite de descompresión de 2 MB",
      );
      return { ok: false, partial: { mainSkills: [] }, warnings };
    }
    if (!/<(PathOfBuilding|Build)\b/i.test(xml)) {
      warnings.push("No verificado — el contenido inflado no parece XML de Path of Building");
      return { ok: false, xml, partial: { mainSkills: [] }, warnings };
    }
    const partial = extractXmlFields(xml);
    warnings.push(`${POB_WARNING}: los datos extraídos (clase, ascendencia, nivel, skills) son aproximados`);
    warnings.push(`${POB_WARNING}: items, pasivas y atributos NO se importan desde PoB en esta versión`);
    return { ok: true, xml, partial, warnings };
  } catch (err) {
    warnings.push(
      `No verificado — error inesperado decodificando PoB: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ok: false, partial: { mainSkills: [] }, warnings };
  }
}
