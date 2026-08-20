import type { Item, ItemRarity, ItemSlot, ModifierKind } from "@shared/domain.js";

/**
 * Helpers puros del panel de equipamiento (Hito 4B).
 *
 * Solo trabajan con el array `items` del CharacterProfileSnapshot: el equipo
 * REAL del personaje. Las pistas `inventory_slots` de un plan `.build`
 * importado NO son equipo y jamás entran aquí (ni siquiera son del mismo
 * tipo: esta capa solo acepta `Item`).
 *
 * Nada de esto inventa datos: lo desconocido se declara como desconocido y no
 * se presupone ninguna cantidad de huecos que el dominio no tenga.
 */

/**
 * Huecos canónicos con posición fija en el panel, en orden de lectura.
 * Los frascos NO están aquí: el dominio no fija cuántos hay, así que se
 * derivan de los datos reales (ver `flaskItems`).
 */
export const EQUIPMENT_SLOTS = [
  "weapon",
  "helmet",
  "offhand",
  "gloves",
  "body",
  "amulet",
  "ring1",
  "belt",
  "ring2",
  "boots",
] as const satisfies readonly ItemSlot[];

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** Un hueco del panel: el slot y el objeto que lo ocupa (o null si está vacío). */
export interface EquipmentCell {
  slot: EquipmentSlot;
  item: Item | null;
}

export interface EquipmentLayout {
  cells: EquipmentCell[];
  /**
   * TODOS los objetos con `slot: "flask"` del perfil, sin número fijo: si hay
   * varios se agrupan; si no hay ninguno, la lista queda vacía y la interfaz
   * lo dice explícitamente. El dominio de PoE2 no define aquí un número de
   * frascos y esta capa no lo inventa.
   */
  flaskItems: Item[];
  /**
   * Objetos con slot "other" o duplicados de un hueco ya ocupado: se muestran
   * aparte en lugar de descartarlos en silencio.
   */
  extraItems: Item[];
  filledCount: number;
  emptyCount: number;
}

/**
 * Reparte los objetos del perfil en los huecos del panel.
 * El primer objeto de cada hueco lo ocupa; los siguientes van a `extraItems`
 * (nunca se pierden ni se sobrescriben en silencio). Los frascos se agrupan.
 */
export function buildEquipmentLayout(items: readonly Item[]): EquipmentLayout {
  const used = new Set<string>();
  const cells: EquipmentCell[] = EQUIPMENT_SLOTS.map((slot) => {
    const item = items.find((candidate) => candidate.slot === slot && !used.has(candidate.id));
    if (item) used.add(item.id);
    return { slot, item: item ?? null };
  });

  const flaskItems = items.filter((item) => item.slot === "flask");
  for (const flask of flaskItems) used.add(flask.id);

  const extraItems = items.filter((item) => !used.has(item.id));
  const filledCount = cells.filter((cell) => cell.item !== null).length + flaskItems.length;
  const emptyCount = cells.filter((cell) => cell.item === null).length;
  return { cells, flaskItems, extraItems, filledCount, emptyCount };
}

// ---------------------------------------------------------------------------
// Rareza — color Y texto (nunca solo color)
// ---------------------------------------------------------------------------

/**
 * Paleta por rareza. Colores propios de Exile Copilot sobre tema oscuro,
 * elegidos por contraste; no reproducen la paleta del cliente del juego.
 * La rareza SIEMPRE se acompaña de su etiqueta de texto.
 */
export const RARITY_STYLES: Record<ItemRarity, { border: string; text: string; dot: string }> = {
  normal: { border: "border-zinc-500/40", text: "text-zinc-200", dot: "bg-zinc-300" },
  magic: { border: "border-sky-400/45", text: "text-sky-200", dot: "bg-sky-300" },
  rare: { border: "border-amber-400/45", text: "text-amber-200", dot: "bg-amber-300" },
  unique: { border: "border-orange-500/50", text: "text-orange-200", dot: "bg-orange-400" },
  currency: { border: "border-emerald-400/40", text: "text-emerald-200", dot: "bg-emerald-300" },
  gem: { border: "border-teal-400/40", text: "text-teal-200", dot: "bg-teal-300" },
  other: { border: "border-border", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export function rarityStyle(rarity: ItemRarity) {
  return RARITY_STYLES[rarity] ?? RARITY_STYLES.other;
}

// ---------------------------------------------------------------------------
// Datos desconocidos y procedencia
// ---------------------------------------------------------------------------

/** Texto para un entero opcional: nunca convierte un desconocido en 0. */
export function formatOptionalInt(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "Desconocido";
}

/** Calidad: 0 es un dato real («sin calidad»), `undefined` es desconocido. */
export function formatQuality(quality: number | undefined): string {
  if (quality === undefined) return "Desconocido";
  return `${quality}%`;
}

export type ItemDataOrigin =
  | "oficial"
  | "interna"
  | "usuario"
  | "mercado"
  | "comunidad"
  | "calculo"
  | "sin-fuente";

export interface ItemDataState {
  origin: ItemDataOrigin;
  label: string;
  detail: string;
  /** Tono visual: solo "oficial" es fuente oficial de GGG. */
  tone: "oficial" | "interna" | "sin-verificar";
}

/**
 * PRECEDENCIA de procedencia, de más a menos autoridad:
 *   ggg > internal > user > poe.ninja > community > calculation
 *
 * Se muestra la fuente de mayor autoridad presente y, si hay varias, el
 * detalle enumera TODAS. Cada categoría dice lo que realmente es:
 *  - "ggg"         → «Fuente oficial (GGG)»   (única que puede decir "oficial")
 *  - "internal"    → «Datos internos verificados» (propios, NUNCA "oficial")
 *  - "user"        → «Lo has indicado tú»
 *  - "poe.ninja"   → «Dato de poe.ninja»
 *  - "community"   → «Referencia comunitaria»
 *  - "calculation" → «Calculado por Exile Copilot»
 *  - sin sources   → «Fuente no disponible»
 *
 * Importar desde `.build`, PoB o texto NO convierte los datos en verificados;
 * cada `modifier.verified` se respeta por separado en el detalle.
 */
const ORIGIN_BY_KIND: Array<{
  kind: Item["sources"][number]["kind"];
  origin: ItemDataOrigin;
  label: string;
  detail: string;
  tone: ItemDataState["tone"];
}> = [
  {
    kind: "ggg",
    origin: "oficial",
    label: "Fuente oficial (GGG)",
    detail: "Procede de datos oficiales de Grinding Gear Games.",
    tone: "oficial",
  },
  {
    kind: "internal",
    origin: "interna",
    label: "Datos internos verificados",
    detail:
      "Datos propios de Exile Copilot, versionados y verificados. No son datos oficiales de GGG.",
    tone: "interna",
  },
  {
    kind: "user",
    origin: "usuario",
    label: "Lo has indicado tú",
    detail:
      "Dato proporcionado manualmente o importado por ti: no está verificado contra una fuente oficial.",
    tone: "sin-verificar",
  },
  {
    kind: "poe.ninja",
    origin: "mercado",
    label: "Dato de poe.ninja",
    detail: "Procede de la API económica pública de poe.ninja. No es una fuente oficial de GGG.",
    tone: "sin-verificar",
  },
  {
    kind: "community",
    origin: "comunidad",
    label: "Referencia comunitaria",
    detail: "Procede de una referencia de la comunidad: nunca es verdad absoluta ni oficial.",
    tone: "sin-verificar",
  },
  {
    kind: "calculation",
    origin: "calculo",
    label: "Calculado por Exile Copilot",
    detail: "Resultado de un cálculo determinista propio, no de una fuente externa.",
    tone: "sin-verificar",
  },
];

export function describeItemDataState(item: Item): ItemDataState {
  if (item.sources.length === 0) {
    return {
      origin: "sin-fuente",
      label: "Fuente no disponible",
      detail: "El objeto no registra ninguna procedencia.",
      tone: "sin-verificar",
    };
  }
  const kinds = new Set(item.sources.map((source) => source.kind));
  const match = ORIGIN_BY_KIND.find((entry) => kinds.has(entry.kind));
  if (match === undefined) {
    // Tipo de fuente no contemplado: se declara sin verificar, nunca "oficial".
    return {
      origin: "sin-fuente",
      label: "Fuente no disponible",
      detail: `Procedencia no reconocida: ${[...kinds].join(", ")}.`,
      tone: "sin-verificar",
    };
  }
  // Con varias fuentes se muestra la de mayor autoridad y se enumeran todas.
  const detail =
    kinds.size > 1
      ? `${match.detail} Fuentes registradas: ${[...kinds].join(", ")}.`
      : match.detail;
  return { origin: match.origin, label: match.label, detail, tone: match.tone };
}

/** Agrupa los modificadores por tipo conservando el orden original dentro de cada grupo. */
export function groupModifiersByKind(
  item: Item,
): Array<{ kind: ModifierKind; mods: Item["modifiers"] }> {
  const order = ["implicit", "explicit", "rune", "enchant", "quality"] as const;
  const groups = new Map<ModifierKind, Item["modifiers"]>();
  for (const mod of item.modifiers) {
    const list = groups.get(mod.kind) ?? [];
    list.push(mod);
    groups.set(mod.kind, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = order.indexOf(a as (typeof order)[number]);
      const ib = order.indexOf(b as (typeof order)[number]);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    })
    .map(([kind, mods]) => ({ kind, mods }));
}

/** Requisitos legibles; devuelve [] cuando el objeto no declara ninguno. */
export function describeRequirements(item: Item): string[] {
  const req = item.requirements;
  if (!req) return [];
  const out: string[] = [];
  if (req.level !== undefined) out.push(`Nivel ${req.level}`);
  if (req.str !== undefined) out.push(`Fuerza ${req.str}`);
  if (req.dex !== undefined) out.push(`Destreza ${req.dex}`);
  if (req.int !== undefined) out.push(`Inteligencia ${req.int}`);
  return out;
}

/**
 * Ids de objetos señalados por las recomendaciones vigentes.
 * Usa EXCLUSIVAMENTE el vínculo estructurado `relatedItemIds` que emite el
 * motor; nunca se deduce buscando «anillo», «casco» o «arma» en los textos.
 * Sin vínculo estructurado no se marca ningún hueco.
 */
export function collectHighlightedItemIds(
  recommendations: ReadonlyArray<{ relatedItemIds: string[] }>,
): Set<string> {
  const out = new Set<string>();
  for (const rec of recommendations) {
    for (const id of rec.relatedItemIds) out.add(id);
  }
  return out;
}

/**
 * Diagnóstico contextual del equipo: recuentos derivados de datos REALES.
 * No hay puntuaciones, porcentajes de afinidad ni salud de build inventados.
 */
export interface EquipmentDiagnostics {
  equipped: number;
  emptySlots: number;
  userProvided: number;
  withoutSource: number;
  unverifiedModifiers: number;
  highlighted: number;
}

export function computeEquipmentDiagnostics(
  layout: EquipmentLayout,
  highlightedItemIds: ReadonlySet<string>,
): EquipmentDiagnostics {
  const all = [
    ...layout.cells.map((cell) => cell.item).filter((item): item is Item => item !== null),
    ...layout.flaskItems,
    ...layout.extraItems,
  ];
  return {
    equipped: all.length,
    emptySlots: layout.emptyCount,
    userProvided: all.filter((item) => describeItemDataState(item).origin === "usuario").length,
    withoutSource: all.filter((item) => describeItemDataState(item).origin === "sin-fuente").length,
    unverifiedModifiers: all.reduce(
      (total, item) => total + item.modifiers.filter((mod) => !mod.verified).length,
      0,
    ),
    highlighted: all.filter((item) => highlightedItemIds.has(item.id)).length,
  };
}
