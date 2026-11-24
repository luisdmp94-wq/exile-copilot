/**
 * El personaje de la web convertido en una build de Path of Building 2 (XML).
 *
 * Dos caminos:
 *  - Si vino de un código de PoB2, se usa ese XML tal cual (con su equipo,
 *    joyas, atributos elegidos y configuración) y solo se cambia lo que el
 *    jugador tocó en la web: árbol, nivel y, si los cambió, objetos o gemas.
 *  - Si no, se escribe desde la ficha: clase, árbol, gemas con su nivel y
 *    objetos con su texto.
 *
 * Lo usan «Tus números» (el motor de PoB2 en el navegador) y «Exportar a
 * PoB2». Sin DOM ni Node.
 */
import type { CharacterProfile, Item, ItemSlot } from "./domain.js";
import { itemToEnglish, type ItemTranslations } from "./itemTranslation.js";
import { exportClassName } from "./passiveTree.js";

export interface PobClassInfo {
  name: string;
  integerId: number;
  ascendancies: Array<{ internalId: string; name: string }>;
}

export interface PobGemInfo {
  gameId: string;
  variantId: string;
  name: string;
  support: boolean;
  /** Nivel de personaje que pide cada nivel de la gema (índice 0 = nivel 1). */
  levels: number[];
}

export interface PobBuildData {
  /** Versión del árbol del motor («0_5»). */
  treeVersion: string;
  classes: PobClassInfo[];
  gems: PobGemInfo[];
  /** Nombre de gema en español (minúsculas) → nombre en inglés. */
  spanishGems: Record<string, string>;
  /** Clave numérica del árbol para una referencia que no lo sea («chaos31»). */
  resolveNode?: (ref: string) => string | null;
  /** Para traducir objetos copiados de un cliente en español. */
  itemTranslations?: ItemTranslations;
}

/** Nombres de ascendencia del cliente en español (poe2db/sp) → inglés. */
export const ASCENDANCY_FROM_SPANISH: Record<string, string> = {
  infernalista: "Infernalist",
  "maga de sangre": "Blood Mage",
  "mago de sangre": "Blood Mage",
  liche: "Lich",
  "liche abisal": "Abyssal Lich",
  titan: "Titan",
  "adalid de guerra": "Warbringer",
  "herrero de kitava": "Smith of Kitava",
  estratega: "Tactician",
  "cazador de brujas": "Witchhunter",
  "legionario gemita": "Gemling Legionnaire",
  tejetormentas: "Stormweaver",
  cronomante: "Chronomancer",
  "discipula de varashta": "Disciple of Varashta",
  amazona: "Amazon",
  "caminante espiritual": "Spirit Walker",
  ritualista: "Ritualist",
  tiradora: "Deadeye",
  rastreadora: "Pathfinder",
  "artista marcial": "Martial Artist",
  invocador: "Invoker",
  "acolito de chayula": "Acolyte of Chayula",
  oraculo: "Oracle",
  chaman: "Shaman",
};

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Huella corta y estable (FNV-1a) para saber si algo cambió desde que se importó. */
export function digest(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Lo que cuenta de los objetos y gemas para saber si el jugador los cambió en
 * la web. No depende del orden (la revisión rápida reordena las habilidades).
 * Empieza por «2:»; las huellas viejas (sin prefijo) se comparan con la fórmula vieja.
 */
export function pobContentDigests(profile: Pick<CharacterProfile, "items" | "skills">): { items: string; skills: string } {
  const items = profile.items.map((item) => JSON.stringify([item.slot, item.rawText ?? item.name, item.baseType])).sort();
  const skills = profile.skills
    .map((skill) => JSON.stringify([plain(skill.mainSkill), skill.supports.map((support) => plain(support.name)).sort()]))
    .sort();
  return { items: `2:${digest(items)}`, skills: `2:${digest(skills)}` };
}

function legacyContentDigests(profile: Pick<CharacterProfile, "items" | "skills">): { items: string; skills: string } {
  return {
    items: digest(profile.items.map((item) => [item.slot, item.rawText ?? item.name, item.baseType])),
    skills: digest(profile.skills.map((skill) => [skill.mainSkill, skill.level ?? null, skill.supports.map((support) => support.name)])),
  };
}

function unchangedSinceImport(saved: string | undefined, profile: CharacterProfile, part: "items" | "skills"): boolean {
  if (!saved) return true;
  const now = saved.startsWith("2:") ? pobContentDigests(profile) : legacyContentDigests(profile);
  return now[part] === saved;
}

/** El personaje sin el XML de PoB2: lo que viaja al Mentor y a las recomendaciones, que no lo usan. */
export function withoutPobXml<T extends Pick<CharacterProfile, "pobImport">>(profile: T): T {
  if (!profile.pobImport?.xml) return profile;
  const { xml: _xml, ...rest } = profile.pobImport;
  void _xml;
  return { ...profile, pobImport: rest };
}

// ---------------------------------------------------------------------------
// Clase, ascendencia y gemas
// ---------------------------------------------------------------------------

export function pobClassFor(data: PobBuildData, characterClass: string | null | undefined): PobClassInfo | null {
  const name = exportClassName(characterClass);
  return data.classes.find((candidate) => candidate.name === name) ?? null;
}

export function pobAscendancyFor(
  pobClass: PobClassInfo | null,
  ascendancy: string | null | undefined,
): { internalId: string; name: string } | null {
  if (!pobClass || !ascendancy) return null;
  const wanted = plain(ascendancy);
  const english = ASCENDANCY_FROM_SPANISH[wanted] ?? ascendancy.trim();
  return (
    pobClass.ascendancies.find((candidate) => plain(candidate.name) === plain(english)) ??
    pobClass.ascendancies.find((candidate) => plain(candidate.internalId) === wanted) ??
    null
  );
}

export function findPobGem(data: PobBuildData, name: string, gemId?: string | null): PobGemInfo | null {
  if (gemId) {
    const byId = data.gems.find((gem) => gem.gameId === gemId);
    if (byId) return byId;
  }
  const raw = name.trim().replace(/^(?:Support|Soporte):\s*/i, "");
  const english = data.spanishGems[plain(raw)] ?? raw;
  const wanted = plain(english).replace(/\s+support$/, "");
  return data.gems.find((gem) => plain(gem.name) === wanted) ?? null;
}

/** El nivel que PoB2 pondría a la gema para este nivel de personaje («characterLevel»). */
export function gemLevelFor(gem: PobGemInfo, characterLevel: number): number {
  for (let level = gem.levels.length; level >= 1; level--) {
    if ((gem.levels[level - 1] ?? 0) <= characterLevel) return level;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------------

const SLOT_NAMES: Partial<Record<ItemSlot, string[]>> = {
  weapon: ["Weapon 1"],
  offhand: ["Weapon 2"],
  helmet: ["Helmet"],
  body: ["Body Armour"],
  gloves: ["Gloves"],
  boots: ["Boots"],
  belt: ["Belt"],
  amulet: ["Amulet"],
  ring1: ["Ring 1"],
  ring2: ["Ring 2"],
  flask: ["Flask 1", "Flask 2"],
  charm: ["Charm 1", "Charm 2", "Charm 3"],
};

/** ¿El texto del objeto está en español (copiado de un cliente en español)? */
export function isSpanishItemText(text: string): boolean {
  return /^(?:Clase de objeto|Rareza)\s*:/im.test(text);
}

/** ¿Este objeto está en español? Por su texto copiado o, sin él, por su base. */
export function isSpanishItem(item: Item, translations?: ItemTranslations): boolean {
  if (item.rawText && item.rawText.trim()) return isSpanishItemText(item.rawText);
  if (translations && item.baseType in translations.bases) return true;
  return item.modifiers.some((modifier) => /^Otorga la habilidad/i.test(modifier.text));
}

const RARITY_NAME: Record<Item["rarity"], string> = {
  normal: "NORMAL",
  magic: "MAGIC",
  rare: "RARE",
  unique: "UNIQUE",
  currency: "NORMAL",
  gem: "NORMAL",
  other: "RARE",
};

/** En el texto de PoB2, runas y encantamientos van con los implícitos y una marca delante. */
const IMPLICIT_KINDS = new Set(["implicit", "enchant", "rune"]);
const KIND_PREFIX: Partial<Record<string, string>> = { enchant: "{enchant}", rune: "{rune}" };

/** Texto del objeto que PoB2 sabe leer: el copiado del juego o uno hecho con sus líneas. */
export function pobItemText(item: Item): { text: string; fromRaw: boolean } {
  if (item.rawText && item.rawText.trim()) return { text: item.rawText.trim(), fromRaw: true };
  const lines = [`Rarity: ${RARITY_NAME[item.rarity]}`];
  if (item.rarity === "rare" || item.rarity === "unique") lines.push(item.name);
  lines.push(item.baseType || item.name);
  if (item.quality) lines.push(`Quality: +${item.quality}%`);
  const implicit = item.modifiers.filter((modifier) => IMPLICIT_KINDS.has(modifier.kind));
  lines.push(`Implicits: ${implicit.length}`, ...implicit.map((modifier) => `${KIND_PREFIX[modifier.kind] ?? ""}${modifier.text}`));
  lines.push(
    ...item.modifiers.filter((modifier) => !implicit.includes(modifier) && modifier.kind !== "quality").map((modifier) => modifier.text),
  );
  return { text: lines.join("\n"), fromRaw: false };
}

/** «Grants Skill: Level 16 Chaos Bolt» (u «Otorga la habilidad: Nivel 16 Descarga de caos») → «chaos bolt». */
function grantedSkills(items: Item[], data: PobBuildData): Set<string> {
  const names = new Set<string>();
  for (const item of items) {
    const text = [item.rawText ?? "", ...item.modifiers.map((modifier) => modifier.text)].join("\n");
    for (const match of text.matchAll(/^(?:Grants Skill|Otorga la habilidad)\s*:\s*(?:(?:Level|Nivel)\s+\d+\s+)?(.+?)\s*$/gim)) {
      const name = plain(match[1]);
      names.add(plain(data.spanishGems[name] ?? match[1]));
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

export interface PobXmlNotes {
  /** De dónde sale el XML. */
  base: "import" | "profile";
  /** Gemas que PoB2 no conoce por ese nombre. */
  unknownGems: string[];
  /** Gemas sin nivel conocido: se pone el que permite el nivel del personaje. */
  guessedGemLevels: number;
  /** Objetos hechos con sus líneas (sin el texto copiado del juego). */
  itemsWithoutText: number;
  /** Objetos en español que no se han podido traducir: PoB2 solo lee inglés. */
  spanishItems: number;
  /** Objetos en español traducidos al inglés para PoB2. */
  translatedItems: number;
  /** Líneas de esos objetos que no se pudieron traducir (no cuentan). */
  untranslatedLines: number;
  /** Objetos cuya base no se reconoce en inglés. */
  unknownBases: number;
  /** No se sabe la clase: sin ella PoB2 no puede leer el árbol. */
  noClass: boolean;
  /** Se reescribió algo del XML importado porque cambió en la web. */
  rebuilt: Array<"items" | "skills">;
}

export interface PobXmlResult {
  xml: string;
  notes: PobXmlNotes;
  /** Grupo principal (1 = el primero), el de la habilidad de daño elegida. */
  mainGroup: number;
  /** Nombre en inglés del grupo principal, si se sabe. */
  mainSkill: string | null;
}

export interface PobXmlOptions {
  /** Habilidad de daño que calcular (nombre en cualquier idioma). */
  mainSkill?: string | null;
  /** Árbol a usar en vez del guardado (el editor de la web). */
  passives?: string[];
  /** Atributos elegidos a usar en vez de los guardados (el editor de la web). */
  attributeChoices?: Record<string, "str" | "dex" | "int">;
}

function nodeKeys(refs: string[], data: PobBuildData): string[] {
  const keys = new Set<string>();
  for (const ref of refs) {
    const key = /^\d+$/.test(ref) ? ref : data.resolveNode?.(ref) ?? null;
    if (key) keys.add(key);
  }
  return [...keys];
}

interface SkillGroupXml {
  xml: string;
  mainName: string | null;
}

function skillGroupsXml(profile: CharacterProfile, data: PobBuildData, notes: PobXmlNotes): SkillGroupXml[] {
  const level = profile.level || 1;
  const granted = grantedSkills(profile.items, data);
  const groups: SkillGroupXml[] = [];
  for (const setup of profile.skills) {
    const main = findPobGem(data, setup.mainSkill, setup.mainSkillGemId);
    if (!main) {
      notes.unknownGems.push(setup.mainSkill);
      continue;
    }
    // La habilidad que da un arma la crea PoB2 solo a partir del objeto.
    if (granted.has(plain(main.name))) continue;
    const gems: string[] = [];
    const mainLevel = setup.level ?? gemLevelFor(main, level);
    if (setup.level === undefined) notes.guessedGemLevels++;
    gems.push(gemXml(main, mainLevel, setup.quality ?? 0));
    for (const support of setup.supports) {
      const gem = findPobGem(data, support.name, support.gemId);
      if (!gem) {
        notes.unknownGems.push(support.name);
        continue;
      }
      gems.push(gemXml(gem, gem.support ? 1 : gemLevelFor(gem, level), 0));
    }
    groups.push({
      mainName: main.name,
      xml: `<Skill enabled="true" label="${escapeXml(setup.label && setup.label !== setup.mainSkill ? setup.label : "")}" mainActiveSkill="1" includeInFullDPS="false">${gems.join("")}</Skill>`,
    });
  }
  return groups;
}

function gemXml(gem: PobGemInfo, level: number, quality: number): string {
  return `<Gem gemId="${escapeXml(gem.gameId)}" variantId="${escapeXml(gem.variantId)}" nameSpec="${escapeXml(gem.name)}" level="${level}" quality="${quality}" enabled="true"/>`;
}

function itemsXml(profile: CharacterProfile, data: PobBuildData, notes: PobXmlNotes): string {
  const { items, slots } = itemEntries(profile, data, notes, 1);
  return `<Items activeItemSet="1">${items.join("")}<ItemSet id="1">${slots.join("")}</ItemSet></Items>`;
}

/** Los objetos de la ficha como `<Item>` (con ids desde `firstId`) y sus `<Slot>`. */
function itemEntries(
  profile: CharacterProfile,
  data: PobBuildData,
  notes: PobXmlNotes,
  firstId: number,
): { items: string[]; slots: string[] } {
  const used = new Map<string, number>();
  const items: string[] = [];
  const slots: string[] = [];
  let id = firstId - 1;
  for (const item of profile.items) {
    const names = SLOT_NAMES[item.slot];
    if (!names) continue;
    const count = used.get(item.slot) ?? 0;
    const slotName = names[count];
    if (!slotName) continue;
    used.set(item.slot, count + 1);
    let { text, fromRaw } = pobItemText(item);
    if (isSpanishItem(item, data.itemTranslations)) {
      if (data.itemTranslations) {
        const translated = itemToEnglish(item, data.itemTranslations, data.spanishGems);
        text = translated.text;
        fromRaw = true;
        notes.translatedItems++;
        notes.untranslatedLines += translated.untranslated;
        if (translated.unknownBase) notes.unknownBases++;
      } else {
        notes.spanishItems++;
      }
    }
    if (!fromRaw) notes.itemsWithoutText++;
    id++;
    items.push(`<Item id="${id}">\n${escapeXml(text)}\n</Item>`);
    slots.push(`<Slot name="${slotName}" itemId="${id}"/>`);
  }
  return { items, slots };
}

function mainGroupIndex(groups: Array<{ mainName: string | null }>, data: PobBuildData, mainSkill: string | null | undefined): number {
  if (mainSkill) {
    const gem = findPobGem(data, mainSkill);
    const wanted = plain(gem?.name ?? mainSkill);
    const index = groups.findIndex((group) => group.mainName !== null && plain(group.mainName) === wanted);
    if (index >= 0) return index + 1;
  }
  return 1;
}

function emptyNotes(base: PobXmlNotes["base"]): PobXmlNotes {
  return {
    base,
    unknownGems: [],
    guessedGemLevels: 0,
    itemsWithoutText: 0,
    spanishItems: 0,
    translatedItems: 0,
    untranslatedLines: 0,
    unknownBases: 0,
    noClass: false,
    rebuilt: [],
  };
}

/**
 * Penalización de resistencias elementales del acto en que suele estar un
 * personaje de este nivel (las opciones de PoB2: 0 en el acto 1, −10 por acto,
 * −60 en el final del juego). Solo se usa sin código de PoB2: con él manda la
 * configuración del jugador.
 */
export function resistancePenaltyFor(level: number): number {
  if (level < 15) return 0;
  if (level < 28) return -10;
  if (level < 38) return -20;
  if (level < 48) return -30;
  if (level < 55) return -40;
  if (level < 65) return -50;
  return -60;
}

/** XML desde la ficha del personaje. */
function xmlFromProfile(profile: CharacterProfile, data: PobBuildData, options: PobXmlOptions): PobXmlResult {
  const notes = emptyNotes("profile");
  const pobClass = pobClassFor(data, profile.characterClass);
  if (!pobClass) notes.noClass = true;
  const ascendancy = pobAscendancyFor(pobClass, profile.ascendancy);
  const nodes = nodeKeys(options.passives ?? profile.passives.allocated.map((node) => node.ref), data);
  const groups = skillGroupsXml(profile, data, notes);
  const mainGroup = mainGroupIndex(groups, data, options.mainSkill);
  const level = Math.max(1, Math.min(100, profile.level || 1));
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<PathOfBuilding2>`,
    `<Build level="${level}" targetVersion="0_1" className="${escapeXml(pobClass?.name ?? "Witch")}" ascendClassName="${escapeXml(ascendancy?.name ?? "None")}" mainSocketGroup="${mainGroup}" viewMode="TREE" characterLevelAutoMode="false"/>`,
    `<Tree activeSpec="1"><Spec title="Exile Copilot" treeVersion="${escapeXml(data.treeVersion)}" classInternalId="${pobClass?.integerId ?? 1}" ascendancyInternalId="${escapeXml(ascendancy?.internalId ?? "")}" nodes="${nodes.join(",")}">`,
    `<Overrides>${attributeOverrideXml(options.attributeChoices ?? profile.passives.attributeChoices ?? {}, nodes)}</Overrides>`,
    `</Spec></Tree>`,
    `<Skills activeSkillSet="1" defaultGemLevel="characterLevel"><SkillSet id="1">${groups.map((group) => group.xml).join("")}</SkillSet></Skills>`,
    itemsXml(profile, data, notes),
    `<Config activeConfigSet="1"><ConfigSet id="1" title="Default"><Input name="resistancePenalty" number="${resistancePenaltyFor(level)}"/></ConfigSet></Config>`,
    `</PathOfBuilding2>`,
  ].join("\n");
  return { xml, notes, mainGroup, mainSkill: groups[mainGroup - 1]?.mainName ?? null };
}

/** `<AttributeOverride …/>`: qué nodos «+5 a cualquier atributo» dan fuerza, destreza o inteligencia. */
function attributeOverrideXml(choices: Record<string, "str" | "dex" | "int">, nodes: string[]): string {
  const taken = new Set(nodes);
  const byAttribute = (attribute: "str" | "dex" | "int") =>
    Object.entries(choices)
      .filter(([key, value]) => value === attribute && taken.has(key))
      .map(([key]) => key)
      .join(",");
  return `<AttributeOverride strNodes="${byAttribute("str")}" dexNodes="${byAttribute("dex")}" intNodes="${byAttribute("int")}"/>`;
}

function setAttribute(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s${name}="[^"]*"`);
  const replacement = ` ${name}="${escapeXml(value)}"`;
  return pattern.test(tag) ? tag.replace(pattern, replacement) : tag.replace(/\s*\/?>$/, (end) => `${replacement}${end}`);
}

interface XmlElement {
  /** El elemento entero, de `<Tag` a `</Tag>` (o `/>`). */
  full: string;
  /** Solo la etiqueta de apertura. */
  open: string;
  /** Lo de dentro (vacío si se cierra solo). */
  body: string;
}

/** Los `<tag>` de un trozo de XML, con o sin cuerpo (no sirve para etiquetas anidadas iguales). */
function xmlElements(xml: string, tag: string): XmlElement[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/${tag}>)`, "g");
  return [...xml.matchAll(pattern)].map((match) => ({
    full: match[0],
    open: /^<[^>]*>/.exec(match[0])?.[0] ?? match[0],
    body: match[1] ?? "",
  }));
}

function xmlAttribute(open: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(open)?.[1] ?? null;
}

/** De varios `<Set>` dentro de `parent`, el activo, ya con id 1 y el padre apuntando a él. */
function keepActiveSet(parent: XmlElement, setTag: string, activeAttribute: string): { open: string; set: XmlElement } | null {
  const sets = xmlElements(parent.body, setTag);
  if (sets.length === 0) return null;
  const activeId = xmlAttribute(parent.open, activeAttribute) ?? "1";
  const set = sets.find((candidate) => xmlAttribute(candidate.open, "id") === activeId) ?? sets[0];
  const open = set.open;
  const renamed = setAttribute(open, "id", "1");
  return {
    open: setAttribute(parent.open, activeAttribute, "1"),
    set: { full: renamed + set.full.slice(open.length), open: renamed, body: set.body },
  };
}

/**
 * El XML de PoB2 recortado a lo que se calcula: el árbol, el equipo, las
 * gemas y la configuración activos (sin notas, sin estadísticas guardadas,
 * sin los otros árboles o sets). Así el personaje cabe en lo que guarda la web
 * y PoB2 no intenta cargar árboles de versiones que el motor no lleva.
 */
export function trimPobXml(xml: string): string {
  const root = /<PathOfBuilding2\b[^>]*>/.exec(xml)?.[0] ?? "<PathOfBuilding2>";
  const parts: string[] = [];

  const build = xmlElements(xml, "Build")[0];
  if (build) parts.push(build.full.replace(/\s*<PlayerStat\b[^>]*\/>/g, ""));

  const tree = xmlElements(xml, "Tree")[0];
  let spec: XmlElement | null = null;
  if (tree) {
    const specs = xmlElements(tree.body, "Spec");
    spec = specs[Number(xmlAttribute(tree.open, "activeSpec") ?? "1") - 1] ?? specs[0] ?? null;
    if (spec) parts.push(`<Tree activeSpec="1">${spec.full}</Tree>`);
  }

  const skills = xmlElements(xml, "Skills")[0];
  if (skills) {
    const active = keepActiveSet(skills, "SkillSet", "activeSkillSet");
    parts.push(active ? `${active.open}${active.set.full}</Skills>` : skills.full);
  }

  const items = xmlElements(xml, "Items")[0];
  if (items) {
    const active = keepActiveSet(items, "ItemSet", "activeItemSet");
    if (active) {
      // Solo los objetos que se usan: los del set activo y las joyas del árbol.
      const used = new Set<string>();
      for (const slot of xmlElements(active.set.body, "Slot")) used.add(xmlAttribute(slot.open, "itemId") ?? "");
      for (const socket of xmlElements(spec?.body ?? "", "Socket")) used.add(xmlAttribute(socket.open, "itemId") ?? "");
      used.delete("0");
      const kept = xmlElements(items.body, "Item").filter((item) => used.has(xmlAttribute(item.open, "id") ?? ""));
      parts.push(`${active.open}${kept.map((item) => item.full).join("")}${active.set.full}</Items>`);
    } else {
      parts.push(items.full);
    }
  }

  const config = xmlElements(xml, "Config")[0];
  if (config) {
    const active = keepActiveSet(config, "ConfigSet", "activeConfigSet");
    parts.push(active ? `${active.open}${active.set.full}</Config>` : config.full);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${root}\n${parts.join("\n")}\n</PathOfBuilding2>`;
}

/** Los grupos de habilidades del XML (ya recortado), con el nombre de su primera gema. */
function importedGroups(xml: string): Array<{ mainName: string | null }> {
  const skills = xmlElements(xml, "Skills")[0];
  if (!skills) return [];
  const set = xmlElements(skills.body, "SkillSet")[0];
  return xmlElements(set ? set.body : skills.body, "Skill").map((skill) => ({
    mainName: /<Gem\b[^>]*\bnameSpec="([^"]*)"/.exec(skill.body)?.[1] ?? null,
  }));
}

/**
 * Objetos cambiados en la web: los de la ficha entran con ids nuevos y ocupan
 * sus huecos; los demás objetos (las joyas del árbol, por ejemplo) se quedan.
 */
function patchImportedItems(xml: string, profile: CharacterProfile, data: PobBuildData, notes: PobXmlNotes): string {
  const items = xmlElements(xml, "Items")[0];
  if (!items) return xml.replace(/<\/PathOfBuilding2>\s*$/, `${itemsXml(profile, data, notes)}\n</PathOfBuilding2>`);
  const existing = xmlElements(items.body, "Item");
  const maxId = Math.max(0, ...existing.map((item) => Number(xmlAttribute(item.open, "id") ?? "0") || 0));
  const { items: added, slots } = itemEntries(profile, data, notes, maxId + 1);
  const managed = new Set(Object.values(SLOT_NAMES).flat());
  const set = xmlElements(items.body, "ItemSet")[0];
  const keptSlots = set
    ? xmlElements(set.body, "Slot")
        .filter((slot) => !managed.has(xmlAttribute(slot.open, "name") ?? ""))
        .map((slot) => slot.full)
    : [];
  const setOpen = set ? set.open.replace(/\/>$/, ">") : '<ItemSet id="1">';
  const next = `${setAttribute(items.open, "activeItemSet", "1")}${existing.map((item) => item.full).join("")}${added.join("")}${setOpen}${keptSlots.join("")}${slots.join("")}</ItemSet></Items>`;
  return xml.replace(items.full, () => next);
}

const gemNamesIn = (xml: string) => [...xml.matchAll(/<Gem\b[^>]*\bnameSpec="([^"]*)"/g)].map((match) => plain(match[1]));

/**
 * Gemas añadidas en la web. Una habilidad nueva entra como grupo nuevo; un
 * apoyo nuevo en una habilidad que ya venía en el código entra en su grupo
 * (antes se ignoraba: seguías el consejo de la web, marcabas el apoyo y «Tus
 * números» no se movía). Lo que ya estaba en el código (niveles, calidades,
 * sus apoyos, grupos de objetos) no se toca, y lo que se quita en la web
 * tampoco se quita aquí.
 */
function appendImportedSkills(xml: string, profile: CharacterProfile, data: PobBuildData, notes: PobXmlNotes): { xml: string; added: number } {
  const wanted = skillGroupsXml(profile, data, notes);
  let supports = 0;
  for (const group of wanted) {
    if (!group.mainName) continue;
    const main = plain(group.mainName);
    const existing = xmlElements(xml, "Skill").find((skill) => gemNamesIn(skill.full).includes(main));
    if (!existing || !existing.full.endsWith("</Skill>")) continue;
    const have = new Set(gemNamesIn(existing.full));
    const extra = [...group.xml.matchAll(/<Gem\b[^>]*?\/>/g)]
      .map((match) => match[0])
      .filter((tag) => !have.has(gemNamesIn(tag)[0] ?? ""));
    if (extra.length === 0) continue;
    const patched = `${existing.full.slice(0, -"</Skill>".length)}${extra.join("")}</Skill>`;
    xml = xml.replace(existing.full, () => patched);
    supports += extra.length;
  }
  const present = new Set(gemNamesIn(xml));
  const missing = wanted.filter((group) => group.mainName && !present.has(plain(group.mainName)));
  if (missing.length === 0) return { xml, added: supports };
  const groups = missing.map((group) => group.xml).join("");
  const added = supports + missing.length;
  if (/<\/SkillSet>/.test(xml)) return { xml: xml.replace(/<\/SkillSet>/, () => `${groups}</SkillSet>`), added };
  if (/<\/Skills>/.test(xml)) return { xml: xml.replace(/<\/Skills>/, () => `${groups}</Skills>`), added };
  return {
    xml: xml.replace(/<\/PathOfBuilding2>\s*$/, () => `<Skills activeSkillSet="1"><SkillSet id="1">${groups}</SkillSet></Skills>\n</PathOfBuilding2>`),
    added,
  };
}

/** XML importado de PoB2, con lo que el jugador cambió en la web encima. */
function xmlFromImport(profile: CharacterProfile, data: PobBuildData, options: PobXmlOptions, imported: string): PobXmlResult {
  const notes = emptyNotes("import");
  // Los perfiles guardados antes de recortar al importar traen el XML entero.
  let xml = trimPobXml(imported);
  const saved = profile.pobImport;

  if (!unchangedSinceImport(saved?.itemsDigest, profile, "items")) {
    xml = patchImportedItems(xml, profile, data, notes);
    notes.rebuilt.push("items");
  }
  if (!unchangedSinceImport(saved?.skillsDigest, profile, "skills")) {
    const appended = appendImportedSkills(xml, profile, data, notes);
    xml = appended.xml;
    if (appended.added > 0) notes.rebuilt.push("skills");
  }

  const groups = importedGroups(xml);
  const mainGroup = mainGroupIndex(groups, data, options.mainSkill);
  const level = Math.max(1, Math.min(100, profile.level || 1));
  // Una gema sin nivel o sin calidad tumba el cálculo de PoB2: se pone el
  // nivel que permite el personaje y calidad 0.
  xml = xml.replace(/<Gem\b[^>]*?\/?>/g, (tag) => {
    let next = tag;
    if (!/\squality="\d+"/.test(next)) next = setAttribute(next, "quality", "0");
    if (/\slevel="\d+"/.test(next)) return next;
    const name = /\snameSpec="([^"]*)"/.exec(next)?.[1] ?? "";
    const gemId = /\sgemId="([^"]*)"/.exec(next)?.[1] ?? null;
    const gem = findPobGem(data, name, gemId);
    notes.guessedGemLevels++;
    return setAttribute(next, "level", String(gem && !gem.support ? gemLevelFor(gem, level) : 1));
  });
  // El nivel lo pone la web. Con el modo automático de PoB2 encendido (viene así
  // en los códigos nuevos), el motor recalcula el nivel por los puntos gastados a
  // mitad de cuenta: lo que da cada nodo salía medido con otro nivel que el resto.
  xml = xml.replace(/<Build\b[^>]*>/, (tag) =>
    setAttribute(
      setAttribute(setAttribute(tag, "level", String(level)), "mainSocketGroup", String(mainGroup)),
      "characterLevelAutoMode",
      "false",
    ),
  );

  // El árbol: el de la web (puede haberlo editado).
  const nodes = nodeKeys(options.passives ?? profile.passives.allocated.map((node) => node.ref), data);
  const choices = options.attributeChoices ?? profile.passives.attributeChoices;
  const pobClass = pobClassFor(data, profile.characterClass);
  const ascendancy = pobAscendancyFor(pobClass, profile.ascendancy);
  const patchTree = (spec: string): string => {
    const open = /^<Spec\b[^>]*?(?=\/?>)/.exec(spec)?.[0] ?? "<Spec";
    let tag = setAttribute(`${open}>`, "nodes", nodes.join(","));
    // Códigos viejos o hechos a mano sin la clase en el árbol: PoB2 los rechaza.
    if (!/\s(?:classInternalId|classId)="/.test(tag)) {
      if (pobClass) tag = setAttribute(tag, "classInternalId", String(pobClass.integerId));
      else notes.noClass = true;
    }
    if (!/\s(?:ascendancyInternalId|ascendClassId)="/.test(tag)) tag = setAttribute(tag, "ascendancyInternalId", ascendancy?.internalId ?? "");
    // El motor solo lleva el árbol más nuevo (la web ya avisa si el código es de otro).
    tag = setAttribute(tag, "treeVersion", data.treeVersion);
    let next = tag.slice(0, -1) + spec.slice(open.length);
    if (choices) {
      const override = attributeOverrideXml(choices, nodes);
      if (/<AttributeOverride\b[^>]*\/>/.test(next)) next = next.replace(/<AttributeOverride\b[^>]*\/>/, override);
      else if (/<Overrides>/.test(next)) next = next.replace(/<Overrides>/, `<Overrides>${override}`);
      else if (next.endsWith("/>")) next = `${next.slice(0, -2)}><Overrides>${override}</Overrides></Spec>`;
      else next = next.replace(/<\/Spec>$/, `<Overrides>${override}</Overrides></Spec>`);
    }
    return next;
  };
  const spec = xmlElements(xml, "Spec")[0];
  if (spec) {
    const patched = patchTree(spec.full);
    xml = xml.replace(spec.full, () => patched);
  } else {
    const patched = patchTree(`<Spec nodes=""/>`);
    xml = xml.replace(/<\/PathOfBuilding2>\s*$/, () => `<Tree activeSpec="1">${patched}</Tree>\n</PathOfBuilding2>`);
  }
  return { xml, notes, mainGroup, mainSkill: groups[mainGroup - 1]?.mainName ?? null };
}

/** La build de PoB2 de este personaje. */
export function pobXmlForProfile(profile: CharacterProfile, data: PobBuildData, options: PobXmlOptions = {}): PobXmlResult {
  const imported = profile.pobImport?.xml;
  if (imported && /<PathOfBuilding2\b/.test(imported)) return xmlFromImport(profile, data, options, imported);
  return xmlFromProfile(profile, data, options);
}

// ---------------------------------------------------------------------------
// Código de PoB2
// ---------------------------------------------------------------------------

/** zlib → base64url, el formato de «Importar/Exportar» de PoB2. */
export function pobCodeFromDeflated(deflated: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < deflated.length; index += 0x8000) {
    binary += String.fromCharCode(...deflated.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

/** Gemas en español → inglés, desde los dos archivos de gemas de la web (mismo slug). */
export function spanishGemNames(
  es: Array<{ slug: string; name: string }>,
  en: Array<{ slug: string; name: string }>,
): Record<string, string> {
  const english = new Map(en.map((gem) => [gem.slug, gem.name]));
  const result: Record<string, string> = {};
  for (const gem of es) {
    const name = english.get(gem.slug);
    if (name) result[plain(gem.name)] = name;
  }
  return result;
}
