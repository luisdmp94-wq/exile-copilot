import { randomUUID } from "node:crypto";
import type { Item, ItemRarity, ItemRequirements, ItemSlot, Modifier } from "../../shared/domain.js";

/**
 * Parser del texto de objeto copiado desde el juego (formato clipboard PoE2).
 *
 * Formato: secciones separadas por líneas `--------`. Primera sección:
 * `Item Class: ...`, `Rarity: ...`, nombre (rare: nombre + base en 2 líneas).
 * Resto: propiedades (`Quality:`, `Physical Damage:`, ...), `Requirements:`,
 * `Item Level: N`, y mods (explícitos, o implícitos marcados "(implicit)").
 *
 * Regla de oro: nunca inventamos mods; todo lo no reconocido se conserva como
 * texto con `verified: false`.
 */

export interface ParsedItemText {
  item: Item;
  warnings: string[];
}

const SECTION_SEPARATOR = /^-{8,}$/;

const RARITY_MAP: Record<string, ItemRarity> = {
  normal: "normal",
  magic: "magic",
  mágico: "magic",
  "objeto mágico": "magic",
  rare: "rare",
  raro: "rare",
  unique: "unique",
  único: "unique",
  currency: "currency",
  moneda: "currency",
  gem: "gem",
  gema: "gem",
};

/** Heurística de slot a partir del Item Class / tipo base. */
function guessSlot(itemClass: string, baseType: string): ItemSlot {
  const haystack = `${itemClass} ${baseType}`.toLowerCase();
  const tests: Array<[RegExp, ItemSlot]> = [
    [/crossbow|ballesta|bow|wand|vara|sceptre|cetro|staff|bast[oó]n|mace|maza|axe|hacha|sword|espada|dagger|daga|claw|garra|spear|lanza|flail/, "weapon"],
    [/shield|escudo|quiver|carcaj|focus/, "offhand"],
    [/helmet|yelmo|casco/, "helmet"],
    [/body armour|armadura|body armor/, "body"],
    [/gloves|guantes/, "gloves"],
    [/boots|botas/, "boots"],
    [/belt|cintur[oó]n/, "belt"],
    [/amulet|amuleto/, "amulet"],
    [/ring(?! mail)|anillo/, "ring1"],
    [/flask|frasco/, "flask"],
  ];
  for (const [re, slot] of tests) {
    if (re.test(haystack)) return slot;
  }
  return "other";
}

function parseRarity(raw: string): ItemRarity | null {
  const key = raw.trim().toLowerCase();
  return RARITY_MAP[key] ?? null;
}

/** Extrae todos los números (enteros o decimales) del texto de un mod. */
function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/-?\d+(?:[.,]\d+)?/g)) {
    const n = Number.parseFloat(m[0].replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

interface ParsedSections {
  itemClass: string;
  rarity: ItemRarity;
  name: string;
  baseType: string;
  quality?: number;
  itemLevel?: number;
  requirements?: ItemRequirements;
  modifiers: Modifier[];
}

function parseRequirementsLine(
  line: string,
  acc: { level?: number; str?: number; dex?: number; int?: number },
): void {
  // Admite "Level: 68" y formato combinado "Level: 68, Str: 100, Dex: 200"
  for (const m of line.matchAll(/(level|str|dex|int)\s*:\s*(\d+)/gi)) {
    const key = (m[1] ?? "").toLowerCase();
    const value = Number.parseInt(m[2] ?? "0", 10);
    if (key === "level") acc.level = value;
    else if (key === "str") acc.str = value;
    else if (key === "dex") acc.dex = value;
    else if (key === "int") acc.int = value;
  }
}

function parseSections(sections: string[][], warnings: string[]): ParsedSections | null {
  const head = sections[0];
  if (!head || head.length === 0) {
    warnings.push("Texto vacío o sin secciones reconocibles.");
    return null;
  }

  let itemClass = "";
  let rarity: ItemRarity | null = null;
  const nameLines: string[] = [];

  for (const line of head) {
    const classMatch = /^item class\s*:\s*(.+)$/i.exec(line);
    if (classMatch) {
      itemClass = (classMatch[1] ?? "").trim();
      continue;
    }
    const rarityMatch = /^rarity\s*:\s*(.+)$/i.exec(line);
    if (rarityMatch) {
      rarity = parseRarity(rarityMatch[1] ?? "");
      if (!rarity) {
        warnings.push(`No verificado — rareza no reconocida: "${(rarityMatch[1] ?? "").trim()}"`);
        rarity = "other";
      }
      continue;
    }
    // Líneas sueltas de la cabecera: nombre (+ base en rare/unique).
    if (line.trim().length > 0) nameLines.push(line.trim());
  }

  if (!itemClass) warnings.push("No verificado — falta 'Item Class' en la cabecera.");
  if (!rarity) {
    warnings.push("No verificado — falta 'Rarity' en la cabecera; se asume 'other'.");
    rarity = "other";
  }
  if (nameLines.length === 0) {
    warnings.push("No verificado — no se encontró nombre/base del objeto.");
    nameLines.push("Objeto sin nombre");
  }

  const hasSeparateBase = (rarity === "rare" || rarity === "unique") && nameLines.length >= 2;
  const name = hasSeparateBase ? nameLines[0] ?? "Objeto sin nombre" : (nameLines[0] ?? "Objeto sin nombre");
  const baseType = hasSeparateBase ? (nameLines[1] ?? name) : (nameLines[1] ?? name);

  const result: ParsedSections = {
    itemClass,
    rarity,
    name,
    baseType,
    modifiers: [],
  };

  let inRequirements = false;
  const reqAcc: { level?: number; str?: number; dex?: number; int?: number } = {};

  for (const section of sections.slice(1)) {
    for (const rawLine of section) {
      const line = rawLine.trim();
      if (line.length === 0) continue;

      if (/^requirements\s*:?$/i.test(line)) {
        inRequirements = true;
        continue;
      }
      if (inRequirements) {
        if (/^(level|str|dex|int)\s*:/i.test(line)) {
          parseRequirementsLine(line, reqAcc);
          continue;
        }
        inRequirements = false;
      }
      // Formato combinado en una sola línea: "Requirements: Level: 68, Str: 100"
      const combinedReq = /^requirements\s*:\s*(.+)$/i.exec(line);
      if (combinedReq) {
        parseRequirementsLine(combinedReq[1] ?? "", reqAcc);
        continue;
      }

      const qualityMatch = /^quality\s*:\s*\+?(\d+)%/i.exec(line);
      if (qualityMatch) {
        result.quality = Number.parseInt(qualityMatch[1] ?? "0", 10);
        continue;
      }
      const ilvlMatch = /^item level\s*:\s*(\d+)/i.exec(line);
      if (ilvlMatch) {
        result.itemLevel = Number.parseInt(ilvlMatch[1] ?? "0", 10);
        continue;
      }
      // Propiedades base (daño, velocidad, sockets...) — no son mods.
      if (
        /^(physical damage|elemental damage|chaos damage|critical hit chance|attacks per second|reload time|armour|evasion|energy shield|block chance|sockets|limited to|grants skill)\s*:/i.test(
          line,
        )
      ) {
        continue;
      }
      if (/^(corrupted|mirrored|split|unidentified|identified)$/i.test(line)) {
        continue;
      }

      // Todo lo demás se conserva como mod (nunca se inventa ni se descarta).
      let kind: Modifier["kind"] = "explicit";
      let text = line;
      const marker = /\((implicit|enchant|rune)\)\s*$/i.exec(text);
      if (marker) {
        const k = (marker[1] ?? "").toLowerCase();
        kind = k === "implicit" ? "implicit" : k === "enchant" ? "enchant" : "rune";
        text = text.replace(/\((implicit|enchant|rune)\)\s*$/i, "").trim();
      }
      result.modifiers.push({
        id: randomUUID(),
        text,
        kind,
        values: extractNumbers(text),
        // Los mods parseados de texto copiado no son datos verificados de GGG.
        verified: false,
      });
    }
  }

  if (reqAcc.level !== undefined || reqAcc.str !== undefined || reqAcc.dex !== undefined || reqAcc.int !== undefined) {
    result.requirements = reqAcc;
  }
  return result;
}

export function parseItemText(input: string): ParsedItemText {
  const warnings: string[] = [];
  const lines = input.replace(/\r\n?/g, "\n").split("\n");

  const sections: string[][] = [[]];
  for (const line of lines) {
    if (SECTION_SEPARATOR.test(line.trim())) {
      sections.push([]);
    } else {
      sections[sections.length - 1]?.push(line);
    }
  }
  // Descartar secciones completamente vacías al final.
  while (sections.length > 1 && (sections[sections.length - 1] ?? []).every((l) => l.trim() === "")) {
    sections.pop();
  }

  const parsed = parseSections(sections, warnings);
  if (!parsed) {
    // Fallback mínimo: conservar el texto crudo.
    return {
      item: {
        id: randomUUID(),
        name: "Objeto sin nombre",
        baseType: "Desconocida",
        slot: "other",
        rarity: "other",
        modifiers: [],
        rawText: input,
        sources: [],
      },
      warnings,
    };
  }

  const slot = guessSlot(parsed.itemClass, parsed.baseType);
  if (slot === "other") {
    warnings.push(
      `No verificado — no se pudo inferir el slot para Item Class "${parsed.itemClass || "?"}" / base "${parsed.baseType}".`,
    );
  }

  const item: Item = {
    id: randomUUID(),
    name: parsed.name,
    baseType: parsed.baseType,
    slot,
    rarity: parsed.rarity,
    modifiers: parsed.modifiers,
    rawText: input,
    sources: [
      {
        kind: "user",
        label: "Texto de objeto copiado desde el juego",
        retrievedAt: new Date().toISOString(),
      },
    ],
  };
  if (parsed.itemLevel !== undefined) item.itemLevel = parsed.itemLevel;
  if (parsed.quality !== undefined) item.quality = parsed.quality;
  if (parsed.requirements !== undefined) item.requirements = parsed.requirements;

  return { item, warnings };
}
