import type {
  Attributes,
  Item,
  ItemSlot,
  PassiveNode,
  Resistances,
  SkillSetup,
} from "../../shared/domain.js";
import { parseItemText } from "../importers/itemTextParser.js";

/**
 * Lectura del XML de Path of Building 2, sin dependencias de Node.
 *
 * Un código PoB2 es XML comprimido con zlib y codificado como base64url. La
 * descompresión depende del entorno (Node en el servidor, DecompressionStream
 * en el navegador); todo lo que viene después vive aquí para que ambos lean
 * exactamente igual. Solo se trasladan los campos presentes; nada ausente se
 * convierte en cero.
 */
export interface PobPartial {
  /** Versión interna de compatibilidad declarada por PoB2; no es el parche del juego. */
  targetVersion?: string;
  /** Versión del árbol pasivo activo (p. ej. 0_5), comparable con la familia del parche. */
  passiveTreeVersion?: string;
  characterClass?: string;
  ascendancy?: string;
  level?: number;
  mainSkills: string[];
  skills: SkillSetup[];
  items: Item[];
  passives: PassiveNode[];
  attributes?: Attributes;
  resistances?: Resistances;
  life?: number;
  energyShield?: number;
  evasion?: number;
  armour?: number;
  notes?: string;
}

export interface PobDecodeResult {
  ok: boolean;
  xml?: string;
  partial: PobPartial;
  warnings: string[];
}

export const POB_MAX_INPUT_CHARS = 1_000_000;
export const POB_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export function emptyPartial(): PobPartial {
  return { mainSkills: [], skills: [], items: [], passives: [] };
}

export function looksLikePobCode(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.length >= 32 && /^[A-Za-z0-9\-_]+={0,2}$/.test(trimmed);
}

/** Decodificación cerrada: no interpreta DTD ni entidades externas. */
function decodeXmlText(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";
    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    try {
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    } catch {
      return match;
    }
  });
}

function parseAttrs(fragment: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of fragment.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const key = match[1];
    if (key) attrs[key] = decodeXmlText(match[2] ?? match[3] ?? "");
  }
  return attrs;
}

function extractElement(xml: string, tag: string): { attrs: Record<string, string>; body: string } | null {
  const match = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? { attrs: parseAttrs(match[1] ?? ""), body: match[2] ?? "" } : null;
}

function extractElements(xml: string, tag: string): Array<{ attrs: Record<string, string>; body: string }> {
  const elements: Array<{ attrs: Record<string, string>; body: string }> = [];
  const regex = new RegExp(`<${tag}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${tag}>)`, "gi");
  for (const match of xml.matchAll(regex)) {
    elements.push({ attrs: parseAttrs(match[1] ?? ""), body: match[2] ?? "" });
  }
  return elements;
}

function finiteNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integerStat(value: string | undefined): number | undefined {
  const parsed = finiteNumber(value);
  return parsed === undefined ? undefined : Math.round(parsed);
}

function readPlayerStats(buildBody: string): Map<string, number> {
  const stats = new Map<string, number>();
  for (const element of extractElements(buildBody, "PlayerStat")) {
    const name = element.attrs.stat;
    const value = finiteNumber(element.attrs.value);
    if (name && value !== undefined) stats.set(name, value);
  }
  return stats;
}

const SLOT_MAP: Record<string, ItemSlot> = {
  "weapon 1": "weapon",
  "weapon 2": "offhand",
  helmet: "helmet",
  "body armour": "body",
  gloves: "gloves",
  boots: "boots",
  belt: "belt",
  amulet: "amulet",
  "ring 1": "ring1",
  "ring 2": "ring2",
  "flask 1": "flask",
  "flask 2": "flask",
};

function slotFromPobName(name: string): ItemSlot {
  return SLOT_MAP[name.trim().toLowerCase()] ?? "other";
}

function itemClassForSlot(slot: ItemSlot): string {
  const labels: Record<ItemSlot, string> = {
    weapon: "Weapons",
    offhand: "Off Hands",
    helmet: "Helmets",
    body: "Body Armours",
    gloves: "Gloves",
    boots: "Boots",
    belt: "Belts",
    amulet: "Amulets",
    ring1: "Rings",
    ring2: "Rings",
    flask: "Flasks",
    other: "Other",
  };
  return labels[slot];
}

/** Normaliza la estructura compacta de PoB sin reescribir sus modificadores. */
function normalizePobItemText(raw: string, slot: ItemSlot): string {
  const lines = decodeXmlText(raw)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rarityIndex = lines.findIndex((line) => /^Rarity\s*:/i.test(line));
  const compact = rarityIndex >= 0 ? lines.slice(rarityIndex) : ["Rarity: Other", ...lines];
  const rarity = /^Rarity\s*:\s*(.+)$/i.exec(compact[0] ?? "")?.[1]?.trim().toLowerCase() ?? "other";
  const nameLineCount = rarity === "rare" || rarity === "unique" ? 2 : 1;
  const head = compact.slice(0, 1 + nameLineCount);
  const properties: string[] = [];
  const modifiers: string[] = [];
  const states: string[] = [];
  let implicitCount = 0;
  let reachedModifiers = false;

  for (const line of compact.slice(1 + nameLineCount)) {
    const levelReq = /^LevelReq\s*:\s*(\d+)/i.exec(line);
    const implicits = /^Implicits\s*:\s*(\d+)/i.exec(line);
    if (levelReq) {
      properties.push(`Requirements: Level: ${levelReq[1]}`);
      continue;
    }
    if (implicits) {
      implicitCount = Number.parseInt(implicits[1] ?? "0", 10);
      reachedModifiers = true;
      continue;
    }
    if (/^(?:Unique ID|Variant|Selected Variant|League|Crafted|Fractured|Synthesised|Source|Prefix|Suffix)\s*:/i.test(line)) continue;
    const state = /^(Corrupted|Mirrored|Split|Unidentified)\s*:\s*(true|1)$/i.exec(line);
    if (state) {
      states.push(state[1] ?? "");
      continue;
    }
    if (/^(?:Corrupted|Mirrored|Split|Unidentified)$/i.test(line)) {
      states.push(line);
      continue;
    }
    if (!reachedModifiers && /^(?:Item Level|Quality|Sockets|Physical Damage|Elemental Damage|Fire Damage|Cold Damage|Lightning Damage|Chaos Damage|Critical Hit Chance|Attacks per Second|Armour|Evasion|Energy Shield|Runic Ward|Spirit|Block Chance)\s*:/i.test(line)) {
      const quality = /^Quality\s*:\s*\+?(\d+)\s*$/i.exec(line);
      properties.push(quality ? `Quality: +${quality[1]}%` : line);
      continue;
    }
    reachedModifiers = true;
    modifiers.push(line);
  }

  const markedModifiers = modifiers.map((line, index) =>
    index < implicitCount && !/\((?:implicit|implícito)\)\s*$/i.test(line)
      ? `${line} (implicit)`
      : line,
  );
  return [
    `Item Class: ${itemClassForSlot(slot)}`,
    ...head,
    "--------",
    ...properties,
    "--------",
    ...markedModifiers,
    ...states,
  ].join("\n");
}

function extractActiveItems(xml: string, warnings: string[]): Item[] {
  const itemsElement = extractElement(xml, "Items");
  if (!itemsElement) return [];
  const activeId = itemsElement.attrs.activeItemSet ?? "1";
  const itemBodies = new Map<string, string>();
  for (const element of extractElements(itemsElement.body, "Item")) {
    const id = element.attrs.id;
    if (id) itemBodies.set(id, decodeXmlText(element.body).trim());
  }
  const sets = extractElements(itemsElement.body, "ItemSet");
  const activeSet = sets.find((set) => set.attrs.id === activeId) ?? sets[0];
  if (!activeSet) return [];

  const result: Item[] = [];
  let parserWarningCount = 0;
  for (const slotElement of extractElements(activeSet.body, "Slot")) {
    const pobSlot = slotElement.attrs.name ?? "";
    if (/\bswap\b/i.test(pobSlot)) continue;
    const itemId = slotElement.attrs.itemId;
    if (!itemId || itemId === "0") continue;
    const raw = itemBodies.get(itemId);
    if (!raw) {
      warnings.push(`No verificado — PoB referencia el objeto ${itemId} en ${pobSlot}, pero no incluye su texto.`);
      continue;
    }
    const slot = slotFromPobName(pobSlot);
    const parsed = parseItemText(normalizePobItemText(raw, slot));
    parserWarningCount += parsed.warnings.length;
    parsed.item.slot = slot;
    parsed.item.rawText = raw;
    parsed.item.sources = [{
      kind: "user",
      label: "Objeto importado desde Path of Building 2",
      retrievedAt: new Date().toISOString(),
    }];
    result.push(parsed.item);
  }
  if (parserWarningCount > 0) {
    warnings.push(`No verificado — ${parserWarningCount} detalle(s) del texto de objetos de PoB2 no pudieron clasificarse; se conservaron como texto.`);
  }
  return result;
}

function gemDisplayName(attrs: Record<string, string>): string | null {
  return attrs.nameSpec || attrs.name || attrs.skillId || attrs.gemId || null;
}

function extractActiveSkills(xml: string): SkillSetup[] {
  const skillsElement = extractElement(xml, "Skills");
  if (!skillsElement) return [];
  const activeId = skillsElement.attrs.activeSkillSet ?? "1";
  const sets = extractElements(skillsElement.body, "SkillSet");
  const activeSet = sets.find((set) => set.attrs.id === activeId) ?? sets[0];
  if (!activeSet) return [];

  const setups: SkillSetup[] = [];
  for (const skill of extractElements(activeSet.body, "Skill")) {
    if (/^(?:false|0)$/i.test(skill.attrs.enabled ?? "")) continue;
    const gems = extractElements(skill.body, "Gem").filter(
      (gem) => !/^(?:false|0)$/i.test(gem.attrs.enabled ?? ""),
    );
    const main = gems[0];
    const mainName = main ? gemDisplayName(main.attrs) : null;
    if (!mainName) continue;
    setups.push({
      id: crypto.randomUUID(),
      label: skill.attrs.label || skill.attrs.slot || mainName,
      mainSkill: mainName,
      mainSkillGemId: main?.attrs.gemId ?? null,
      supports: gems.slice(1).flatMap((gem) => {
        const name = gemDisplayName(gem.attrs);
        return name ? [{ name, gemId: gem.attrs.gemId ?? null }] : [];
      }),
    });
  }
  return setups;
}

function extractActiveTreeSpec(xml: string): { attrs: Record<string, string>; body: string } | null {
  const tree = extractElement(xml, "Tree");
  if (!tree) return null;
  const activeId = tree.attrs.activeSpec ?? "1";
  const specs = extractElements(tree.body, "Spec");
  return specs.find((spec) => spec.attrs.id === activeId) ?? specs[0] ?? null;
}

function extractActivePassives(xml: string): PassiveNode[] {
  const activeSpec = extractActiveTreeSpec(xml);
  const refs = (activeSpec?.attrs.nodes ?? "").split(",").map((ref) => ref.trim()).filter(Boolean);
  return [...new Set(refs)].map((ref) => ({ ref, isOfficialId: false }));
}

function extractXmlFields(xml: string, warnings: string[]): PobPartial {
  const partial = emptyPartial();
  const build = extractElement(xml, "Build") ?? extractElements(xml, "Build")[0] ?? null;
  if (build) {
    partial.targetVersion = build.attrs.targetVersion?.trim() || undefined;
    partial.characterClass = build.attrs.className || build.attrs.classname || undefined;
    partial.ascendancy = build.attrs.ascendClassName || build.attrs.ascendancyName || undefined;
    const level = integerStat(build.attrs.level);
    if (level !== undefined) partial.level = level;

    const stats = readPlayerStats(build.body);
    const stat = (name: string): number | undefined => {
      const value = stats.get(name);
      return value === undefined ? undefined : Math.round(value);
    };
    const str = stat("Str");
    const dex = stat("Dex");
    const int = stat("Int");
    if (str !== undefined || dex !== undefined || int !== undefined) {
      partial.attributes = { str: str ?? null, dex: dex ?? null, int: int ?? null };
    }
    const fire = stat("FireResist");
    const cold = stat("ColdResist");
    const lightning = stat("LightningResist");
    const chaos = stat("ChaosResist");
    if (fire !== undefined || cold !== undefined || lightning !== undefined || chaos !== undefined) {
      partial.resistances = { fire: fire ?? null, cold: cold ?? null, lightning: lightning ?? null, chaos: chaos ?? null };
    }
    const scalarStats: Array<["life" | "energyShield" | "evasion" | "armour", string]> = [
      ["life", "Life"], ["energyShield", "EnergyShield"], ["evasion", "Evasion"], ["armour", "Armour"],
    ];
    for (const [key, name] of scalarStats) {
      const value = stat(name);
      if (value !== undefined) partial[key] = value;
    }
  }

  partial.passiveTreeVersion = extractActiveTreeSpec(xml)?.attrs.treeVersion?.trim() || undefined;

  partial.items = extractActiveItems(xml, warnings);
  partial.skills = extractActiveSkills(xml);
  partial.mainSkills = partial.skills.map((skill) => skill.mainSkill).slice(0, 5);
  partial.passives = extractActivePassives(xml);
  const notes = extractElement(xml, "Notes");
  const noteText = notes ? decodeXmlText(notes.body).trim() : "";
  if (noteText) partial.notes = noteText;
  return partial;
}

/** Avisos de fallo antes de llegar al XML; compartidos por servidor y navegador. */
export const POB_TOO_LONG_WARNING = `No verificado — el código PoB supera el límite de entrada (${POB_MAX_INPUT_CHARS} caracteres); rechazado por seguridad.`;
export const POB_INVALID_BASE64_WARNING = "No verificado — el código PoB no es base64 válido";
export const POB_INFLATE_FAILED_WARNING =
  "No verificado — no se pudo descomprimir el código PoB (zlib) o supera el límite de descompresión de 2 MB";

export function pobFailure(warning: string): PobDecodeResult {
  return { ok: false, partial: emptyPartial(), warnings: [warning] };
}

/** Lee el XML ya descomprimido de un código PoB2. Nunca lanza. */
export function readPobXml(xml: string): PobDecodeResult {
  const warnings: string[] = [];
  try {
    if (/<PathOfBuilding\b/i.test(xml) && !/<PathOfBuilding2\b/i.test(xml)) {
      warnings.push("Rechazado — el código pertenece a Path of Building para PoE1. Exile Copilot solo acepta PathOfBuilding2.");
      return { ok: false, xml, partial: emptyPartial(), warnings };
    }
    if (!/<PathOfBuilding2\b/i.test(xml)) {
      warnings.push("No verificado — el contenido inflado no declara la raíz PathOfBuilding2 de PoE2");
      return { ok: false, xml, partial: emptyPartial(), warnings };
    }
    const partial = extractXmlFields(xml, warnings);
    warnings.push(`No verificado — instantánea leída de PoB2: ${partial.items.length} objeto(s), ${partial.skills.length} grupo(s) de habilidad y ${partial.passives.length} pasiva(s).`);
    if (partial.items.length === 0) warnings.push("El código PoB2 no contiene equipo activo.");
    if (partial.skills.length === 0) warnings.push("El código PoB2 no contiene grupos de habilidades activos.");
    return { ok: true, xml, partial, warnings };
  } catch (err) {
    warnings.push(`No verificado — error inesperado decodificando PoB: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, partial: emptyPartial(), warnings };
  }
}
