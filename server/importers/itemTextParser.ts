import { randomUUID } from "node:crypto";
import type {
  CraftingItemState,
  Item,
  ItemRarity,
  ItemRequirements,
  ItemSlot,
  Modifier,
} from "../../shared/domain.js";

/**
 * Parser del texto de objeto copiado desde el juego (formato clipboard PoE2).
 *
 * Admite el formato normal en inglés y el formato avanzado localizado al
 * español. Las cabeceras `{ Mod. ... }` gobiernan la agrupación: todas las
 * líneas hasta la siguiente cabecera forman un único modificador.
 *
 * Regla de oro: nunca inventamos mods; todo lo no reconocido se conserva como
 * texto con `verified: false`.
 */

export interface ParsedItemText {
  item: Item;
  warnings: string[];
}

const SECTION_SEPARATOR = /^-{8,}$/;
const BASE_PROPERTY_RE = /^(?:quality|calidad|physical damage|daño físico|elemental damage|daño elemental|chaos damage|daño de caos|cold damage|daño de hielo|critical hit chance|probabilidad de impacto crítico|attacks per second|ataques por segundo|reload time|tiempo de recarga|armour|armadura|evasion|evasión|energy shield|escudo de energía|block chance|probabilidad de bloqueo|sockets|engarces|limited to|limitado a|grants skill|otorga habilidad)\s*:/i;

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
    [/crossbow|ballesta|bow|arco|wand|vara|sceptre|cetro|staff|bast[oó]n|mace|maza|axe|hacha|sword|espada|dagger|daga|claw|garra|spear|lanza|flail/, "weapon"],
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
  // El guion de un rango (41-60) es un separador, no el signo de -60.
  const normalizedRanges = text.replace(/(?<=\d)-(?=\d)/g, " ");
  for (const m of normalizedRanges.matchAll(/-?\d+(?:[.,]\d+)?/g)) {
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
  craftingState: CraftingItemState;
  /**
   * `false` mientras el texto no permita AFIRMAR estos estados. Sin esto, un
   * pegado truncado devolvía los cuatro campos en `false` y se presentaba como
   * «estado conocido» solo porque las palabras no aparecían.
   */
  craftingStateVerified: boolean;
  modifiers: Modifier[];
}

/**
 * Marcas y encabezados ESTRUCTURALES del texto copiado.
 *
 * Se declaran una sola vez porque se usan en dos sitios que no pueden
 * divergir: la frontera que cierra un modificador avanzado pendiente y el
 * tratamiento posterior de esa misma línea.
 */
const CORRUPTED_RE = /^(?:corrupted|corrupto)$/i;
const MIRRORED_RE = /^(?:mirrored|reflejado)$/i;
const SPLIT_RE = /^(?:split|dividido)$/i;
const UNIDENTIFIED_RE = /^(?:unidentified|sin identificar)$/i;
const IDENTIFIED_RE = /^(?:identified|identificado)$/i;
const DOUBLE_CORRUPTED_RE = /^(?:double corrupted|doble corrupci[oó]n|doblemente corrupto)$/i;
const SANCTIFIED_RE = /^(?:sanctified|santificado)$/i;
const UNMODIFIABLE_EXCEPT_CHAOS_RE = /^(?:unmodifiable except by chaos|no modificable salvo mediante caos)$/i;
const UNMODIFIABLE_RE = /^(?:unmodifiable|no modificable)$/i;
const MUTATED_RE = /^(?:mutated|mutado)$/i;
const DESECRATED_RE = /^(?:desecrated|profanado)$/i;
const ITEM_LEVEL_RE = /^(?:item level|nivel de objeto)\s*:\s*(\d+)/i;
const REQUIREMENTS_RE = /^(?:requirements|requiere)\s*:?/i;

/**
 * Prefijo Markdown que el importador ya aceptaba (`## Nivel de objeto: 32`).
 * Se retira antes de clasificar para que la frontera y el tratamiento vean la
 * misma línea.
 */
function withoutMarkdownPrefix(line: string): string {
  return line.replace(/^#+\s*/, "").trim();
}

/**
 * ¿Esta línea es estructura del objeto y no parte de un modificador?
 *
 * Una cabecera `{ Mod. ... }` agrupa las líneas siguientes, pero ese grupo NO
 * puede tragarse la estructura del objeto: si lo hace, «Corrupto» acaba dentro
 * del texto de un afijo y `craftingState.corrupted` se queda en false, con lo
 * que la matriz de acciones llegaría a declarar «compatible» un objeto que el
 * propio texto declara corrupto.
 *
 * Es deliberadamente una lista corta y cerrada: solo líneas cuyo significado
 * estructural es inequívoco en el formato que este parser ya procesa.
 */
function isStructuralBoundary(line: string): boolean {
  return (
    CORRUPTED_RE.test(line) ||
    MIRRORED_RE.test(line) ||
    SPLIT_RE.test(line) ||
    UNIDENTIFIED_RE.test(line) ||
    IDENTIFIED_RE.test(line) ||
    DOUBLE_CORRUPTED_RE.test(line) ||
    SANCTIFIED_RE.test(line) ||
    UNMODIFIABLE_EXCEPT_CHAOS_RE.test(line) ||
    UNMODIFIABLE_RE.test(line) ||
    MUTATED_RE.test(line) ||
    DESECRATED_RE.test(line) ||
    ITEM_LEVEL_RE.test(line) ||
    REQUIREMENTS_RE.test(line)
  );
}

interface AdvancedModifierHeader {
  kind: Modifier["kind"];
  affix?: "prefix" | "suffix";
  name?: string;
  tier?: number;
  tags?: string[];
  crafted?: boolean;
  desecrated?: boolean;
  fractured?: boolean;
  mutated?: boolean;
}

function parseAdvancedModifierHeader(line: string): AdvancedModifierHeader | null {
  if (/^\{\s*(?:mod\.|modifier)\s+(?:implícito|implicit)\s*\}$/i.test(line)) {
    return { kind: "implicit" };
  }

  const match = /^\{\s*(?:mod\.|modifier)\s+(?:de\s+)?(prefijo|sufijo|prefix|suffix)\s+"([^"]+)"([\s\S]*?)\}$/i.exec(
    line,
  );
  if (!match) return null;

  const localizedAffix = (match[1] ?? "").toLowerCase();
  const details = match[3] ?? "";
  const tierMatch = /\((?:grado|tier)\s*:\s*(\d+)\)/i.exec(details);
  const tagsMatch = /—\s*(.+?)\s*$/u.exec(details);
  const tags = tagsMatch?.[1]
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    kind: "explicit",
    affix: localizedAffix === "prefijo" || localizedAffix === "prefix" ? "prefix" : "suffix",
    name: (match[2] ?? "").trim(),
    ...(tierMatch ? { tier: Number.parseInt(tierMatch[1] ?? "0", 10) } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(/\bde fabricación\b|\bcrafted\b/i.test(details) ? { crafted: true } : {}),
    ...(/\bprofanado\b|\bdesecrated\b/i.test(details) ? { desecrated: true } : {}),
    ...(/\bfracturad[oa]\b|\bfractured\b/i.test(details) ? { fractured: true } : {}),
    ...(/\bmutad[oa]\b|\bmutated\b/i.test(details) ? { mutated: true } : {}),
  };
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

  const localizedKeys: Array<[RegExp, keyof typeof acc]> = [
    [/(?:nivel|level)\s*:?\s*(\d+)/i, "level"],
    [/(?:fue|fuerza|str)\s*:?\s*(\d+)/i, "str"],
    [/(?:des|destreza|dex)\s*:?\s*(\d+)/i, "dex"],
    [/(?:int|inteligencia)\s*:?\s*(\d+)/i, "int"],
    [/(\d+)\s*(?:fue|fuerza|str)\b/i, "str"],
    [/(\d+)\s*(?:des|destreza|dex)\b/i, "dex"],
    [/(\d+)\s*(?:int|inteligencia)\b/i, "int"],
  ];
  for (const [pattern, key] of localizedKeys) {
    const match = pattern.exec(line);
    if (match?.[1]) acc[key] = Number.parseInt(match[1], 10);
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
    const classMatch = /^(?:item class|clase de objeto)\s*:\s*(.+)$/i.exec(line);
    if (classMatch) {
      itemClass = (classMatch[1] ?? "").trim();
      continue;
    }
    const rarityMatch = /^(?:rarity|rareza)\s*:\s*(.+)$/i.exec(line);
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

  // Declarada de verdad: una rareza ilegible NO cuenta como cabecera completa.
  const rarityDeclared = rarity !== null;

  if (!itemClass) warnings.push("No verificado — falta 'Item Class'/'Clase de objeto' en la cabecera.");
  if (!rarity) {
    warnings.push("No verificado — falta 'Rarity'/'Rareza' en la cabecera; se asume 'other'.");
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
    craftingState: {
      corrupted: false,
      mirrored: false,
      split: false,
      unidentified: false,
    },
    craftingStateVerified: false,
    modifiers: [],
  };

  /**
   * El texto declaró EXPLÍCITAMENTE al menos un estado positivo. Esa evidencia
   * vale aunque el resto del pegado esté incompleto: es algo que el jugador
   * copió, no una deducción por ausencia.
   */
  let positiveStateMark = false;

  let inRequirements = false;
  const reqAcc: { level?: number; str?: number; dex?: number; int?: number } = {};

  let pendingAdvanced: { header: AdvancedModifierHeader; lines: string[] } | null = null;
  const flushAdvanced = (): void => {
    if (!pendingAdvanced) return;
    const text = pendingAdvanced.lines.join("\n").trim();
    if (text.length === 0) {
      warnings.push("No verificado — cabecera avanzada sin texto de modificador.");
      pendingAdvanced = null;
      return;
    }
    result.modifiers.push({
      id: randomUUID(),
      text,
      values: extractNumbers(text),
      verified: false,
      ...pendingAdvanced.header,
    });
    pendingAdvanced = null;
  };

  for (const section of sections.slice(1)) {
    for (const rawLine of section) {
      const line = rawLine.trim();
      if (line.length === 0) continue;

      const advancedHeader = parseAdvancedModifierHeader(line);
      if (advancedHeader) {
        flushAdvanced();
        pendingAdvanced = { header: advancedHeader, lines: [] };
        continue;
      }

      const structuralLine = withoutMarkdownPrefix(line);

      // La estructura cierra el grupo pendiente ANTES de tratarse. Así nunca
      // entra en `modifier.text` ni en `modifier.values`, no crea un
      // modificador nuevo y no se pierde por venir tras una cabecera.
      if (pendingAdvanced && isStructuralBoundary(structuralLine)) {
        flushAdvanced();
      }
      if (pendingAdvanced) {
        pendingAdvanced.lines.push(line);
        continue;
      }

      if (/^(?:requirements|requiere)\s*:?$/i.test(structuralLine)) {
        inRequirements = true;
        continue;
      }
      if (inRequirements) {
        if (/^(?:level|nivel|str|fue|fuerza|dex|des|destreza|int|inteligencia)\b/i.test(structuralLine)) {
          parseRequirementsLine(structuralLine, reqAcc);
          continue;
        }
        inRequirements = false;
      }
      // Formato combinado en una sola línea: "Requirements: Level: 68, Str: 100"
      const combinedReq = /^(?:requirements|requiere)\s*:\s*(.+)$/i.exec(structuralLine);
      if (combinedReq) {
        parseRequirementsLine(combinedReq[1] ?? "", reqAcc);
        continue;
      }

      const qualityMatch = /^(?:quality|calidad)\s*:\s*\+?(\d+)%/i.exec(structuralLine);
      if (qualityMatch) {
        result.quality = Number.parseInt(qualityMatch[1] ?? "0", 10);
        continue;
      }
      const ilvlMatch = ITEM_LEVEL_RE.exec(structuralLine);
      if (ilvlMatch) {
        result.itemLevel = Number.parseInt(ilvlMatch[1] ?? "0", 10);
        continue;
      }
      // Propiedades base (daño, velocidad, sockets...) — no son mods.
      if (BASE_PROPERTY_RE.test(structuralLine)) {
        continue;
      }
      if (CORRUPTED_RE.test(structuralLine)) {
        result.craftingState.corrupted = true;
        positiveStateMark = true;
        continue;
      }
      if (MIRRORED_RE.test(structuralLine)) {
        result.craftingState.mirrored = true;
        positiveStateMark = true;
        continue;
      }
      if (SPLIT_RE.test(structuralLine)) {
        result.craftingState.split = true;
        positiveStateMark = true;
        continue;
      }
      if (UNIDENTIFIED_RE.test(structuralLine)) {
        result.craftingState.unidentified = true;
        positiveStateMark = true;
        continue;
      }
      if (IDENTIFIED_RE.test(structuralLine)) {
        // Solo despeja la duda sobre «sin identificar». NO es evidencia de los
        // otros tres estados, así que no cuenta como marca positiva.
        result.craftingState.unidentified = false;
        continue;
      }
      if (DOUBLE_CORRUPTED_RE.test(structuralLine)) {
        result.craftingState.corrupted = true;
        result.craftingState.doubleCorrupted = true;
        positiveStateMark = true;
        continue;
      }
      if (SANCTIFIED_RE.test(structuralLine)) {
        result.craftingState.sanctified = true;
        positiveStateMark = true;
        continue;
      }
      if (UNMODIFIABLE_EXCEPT_CHAOS_RE.test(structuralLine)) {
        result.craftingState.unmodifiableExceptChaos = true;
        positiveStateMark = true;
        continue;
      }
      if (UNMODIFIABLE_RE.test(structuralLine)) {
        result.craftingState.unmodifiable = true;
        positiveStateMark = true;
        continue;
      }
      if (MUTATED_RE.test(structuralLine)) {
        result.craftingState.mutated = true;
        positiveStateMark = true;
        continue;
      }
      if (DESECRATED_RE.test(structuralLine)) {
        result.craftingState.desecrated = true;
        positiveStateMark = true;
        continue;
      }

      // Todo lo demás se conserva como mod (nunca se inventa ni se descarta).
      let kind: Modifier["kind"] = "explicit";
      let text = line;
      const marker =
        /\((implicit|implícito|implicito|enchant|encantamiento|rune|runa)\)\s*$/iu.exec(text);
      if (marker) {
        const k = (marker[1] ?? "").toLowerCase();
        kind =
          k === "implicit" || k === "implícito" || k === "implicito"
            ? "implicit"
            : k === "enchant" || k === "encantamiento"
              ? "enchant"
              : "rune";
        text = text
          .replace(
            /\((implicit|implícito|implicito|enchant|encantamiento|rune|runa)\)\s*$/iu,
            "",
          )
          .trim();
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
    flushAdvanced();
  }

  if (reqAcc.level !== undefined || reqAcc.str !== undefined || reqAcc.dex !== undefined || reqAcc.int !== undefined) {
    result.requirements = reqAcc;
  }

  /**
   * ¿El texto es lo bastante completo para AFIRMAR los cuatro estados?
   *
   * Solo señales estructurales que este parser ya reconoce; nada de nombres de
   * objeto ni reglas de build:
   *
   *  1. cabecera con clase de objeto,
   *  2. rareza declarada y legible,
   *  3. nivel de objeto presente,
   *  4. al menos una sección tras el separador (no es un fragmento suelto),
   *  5. todos los explícitos vienen de una cabecera `{ Mod. ... }`, es decir,
   *     el jugador copió con descripciones avanzadas activas. Un objeto sin
   *     explícitos lo cumple de forma trivial.
   *
   * Si falla cualquiera, el estado queda SIN AFIRMAR. La única excepción es una
   * marca positiva explícita en el texto: eso es evidencia copiada del juego y
   * se conserva aunque el resto esté incompleto.
   */
  const explicitModifiers = result.modifiers.filter((modifier) => modifier.kind === "explicit");
  const everyExplicitClassified = explicitModifiers.every(
    (modifier) => modifier.affix !== undefined,
  );
  const structurallyComplete =
    itemClass.length > 0 &&
    rarityDeclared &&
    result.itemLevel !== undefined &&
    sections.length > 1 &&
    everyExplicitClassified;

  result.craftingStateVerified = structurallyComplete || positiveStateMark;
  return result;
}

export function parseItemText(input: string): ParsedItemText {
  const warnings: string[] = [];
  const lines = input.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n");

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
    ...(parsed.itemClass ? { itemClass: parsed.itemClass } : {}),
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
  // Ausente = el texto no permite afirmar estos estados. Es lo que hace que la
  // matriz de acciones responda «faltan datos» en lugar de «compatible».
  if (parsed.craftingStateVerified) item.craftingState = parsed.craftingState;
  if (parsed.itemLevel !== undefined) item.itemLevel = parsed.itemLevel;
  if (parsed.quality !== undefined) item.quality = parsed.quality;
  if (parsed.requirements !== undefined) item.requirements = parsed.requirements;

  return { item, warnings };
}
