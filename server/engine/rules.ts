import {
  readCharacterLevel,
  RESISTANCE_LABELS,
  type BuildTarget,
  type CharacterProfile,
  type GoalKind,
  type ResistanceKind,
  type SourceEvidence,
} from "../../shared/domain.js";

/**
 * Reglas deterministas del motor de recomendaciones.
 *
 * Reglas de exactitud:
 *  - Una estadística DESCONOCIDA (null) nunca se trata como 0 ni genera
 *    afirmaciones ("tienes 0%"): la regla se abstiene o emite una
 *    recomendación de "completar datos" con confidence "low" y coste null.
 *  - Las reglas NUNCA inventan precios, mods ni estadísticas; lo que falta
 *    se declara en `unverified`.
 */

export const ENGINE_VERSION = "1.1.0";

/** Etiquetas legibles de recomendación (para la sección "Mejoras planificadas" del exportador). */
export const RECOMMENDATION_LABELS: Record<string, string> = {
  "rec-resistencias-elementales": "Cubrir resistencias elementales hasta el cap",
  "rec-resistencia-caos": "Corregir la resistencia al caos negativa",
  "rec-requisitos-atributos": "Resolver requisitos de atributos no cumplidos",
  "rec-mejora-arma": "Mejorar el arma",
  "rec-enlaces-skill": "Completar los supports de la skill principal",
  "rec-vida-baja": "Subir la vida máxima",
  "rec-datos-resistencias": "Completar datos del personaje: resistencias",
  "rec-datos-atributos": "Completar datos del personaje: atributos",
  "rec-datos-vida": "Completar datos del personaje: vida máxima",
  "rec-datos-nivel-personaje": "Completar datos del personaje: nivel",
  "rec-mods-objetivo": "Acercarse a la build de referencia",
};

/** Hueco/skill relacionado con una recomendación (para additional_text al exportar). */
export const RECOMMENDATION_SLOT_HINTS: Record<
  string,
  { kind: "inventory"; inventoryId: string } | { kind: "skill" }
> = {
  "rec-mejora-arma": { kind: "inventory", inventoryId: "Weapon1" },
  "rec-resistencias-elementales": { kind: "inventory", inventoryId: "Ring1" },
  "rec-enlaces-skill": { kind: "skill" },
};

export const RESISTANCE_CAP = 75;
/**
 * Tope de pistas de texto que se recogen de los inventory_slots del plan y
 * tope de carencias que se enumeran en la acción. Un `.build` puede traer
 * miles de líneas: sin estos límites la recomendación sería inmanejable.
 * Al truncar se declara expresamente cuántas quedan fuera.
 */
export const MAX_PLAN_HINTS = 40;
export const MAX_LISTED_GAPS = 12;
/** Heurística de vida mínima: nivel × 30 (documentada, no verificada). */
export const LIFE_PER_LEVEL = 30;
/** Mínimo de supports razonable en la skill principal. */
export const MIN_MAIN_SUPPORTS = 2;
/** Mínimo de mods explícitos deseables en el arma. */
export const MIN_WEAPON_EXPLICITS = 4;

export type Magnitude = "low" | "medium" | "high";

/** Consulta de precio con contexto de rareza (un rare nunca se valora con precios de únicos). */
export interface RulePriceQuery {
  name: string;
  rarity?: CharacterProfile["items"][number]["rarity"];
}

export interface RuleCandidate {
  ruleId: string;
  title: string;
  action: string;
  reason: string;
  impactMetric: string;
  impactDescription: string;
  magnitude: Magnitude;
  riskLevel: "low" | "medium" | "high";
  riskDescription: string;
  mayLoseValuableMods: boolean;
  irreversible: boolean;
  /** Consultas de precio a intentar con poe.ninja (vacío = sin precio consultable). */
  priceQueries: RulePriceQuery[];
  /** Peso de la regla según el objetivo del jugador. */
  goalWeights: Record<GoalKind, number>;
  confidenceBase: "low" | "medium" | "high";
  unverified: string[];
  /** Fuentes extra (p. ej. la build de referencia comunitaria del target). */
  extraSources: SourceEvidence[];
  /**
   * Ids de objetos del perfil que la regla leyó para emitir el candidato.
   * Solo se rellena cuando la regla accede a una pieza concreta del equipo
   * (p. ej. el arma que evalúa); jamás por coincidencia de texto.
   */
  relatedItemIds?: string[];
}

export interface RuleContext {
  profile: CharacterProfile;
  league: string;
  patch: string;
  target?: BuildTarget;
}

export type Rule = (ctx: RuleContext) => RuleCandidate[];

const BALANCED: Record<GoalKind, number> = {
  damage: 1,
  survival: 1,
  mapping: 1,
  bossing: 1,
  balanced: 1,
};

/** Recomendación "completa los datos" cuando falta una estadística clave. */
function dataGapCandidate(args: {
  ruleId: string;
  what: string;
  detail: string;
  goalWeights?: Record<GoalKind, number>;
}): RuleCandidate {
  return {
    ruleId: args.ruleId,
    title: `Completa los datos de tu personaje: ${args.what}`,
    action: `El dato "${args.what}" es desconocido en tu perfil. Anótalo manualmente para poder evaluarlo.`,
    reason: `Sin el dato "${args.what}" no se puede evaluar esta área sin inventar números.`,
    impactMetric: args.what,
    impactDescription: "Evaluación pendiente de datos (métrica parcial).",
    magnitude: "low",
    riskLevel: "low",
    riskDescription: "Solo es una corrección de datos.",
    mayLoseValuableMods: false,
    irreversible: false,
    priceQueries: [],
    goalWeights: args.goalWeights ?? { ...BALANCED, survival: 0.8 },
    confidenceBase: "low",
    unverified: [`No verificado — falta el dato "${args.what}" en el perfil. ${args.detail}`],
    extraSources: [],
    relatedItemIds: [],
  };
}

// ---------------------------------------------------------------------------
// Regla 1: resistencias elementales por debajo del cap (75%) — null-safe
// ---------------------------------------------------------------------------

/**
 * Enumera resistencias en español para el texto del jugador. Las claves del
 * dominio (`fire`, `cold`, …) nunca salen a la superficie: solo su etiqueta.
 */
function listarResistencias(kinds: ResistanceKind[]): string {
  return kinds.map((k) => RESISTANCE_LABELS[k]).join(", ");
}

export const elementalResistancesRule: Rule = ({ profile }) => {
  const res = profile.resistances;
  const keys: ResistanceKind[] = ["fire", "cold", "lightning"];
  const unknown = keys.filter((k) => res[k] === null);
  const known = keys.filter((k) => res[k] !== null);

  const out: RuleCandidate[] = [];
  if (unknown.length > 0) {
    out.push(
      dataGapCandidate({
        ruleId: "datos-resistencias",
        what: "resistencias",
        detail: `Resistencias desconocidas: ${listarResistencias(unknown)}.`,
        // Para survival es el dato crítico: sin resistencias no se puede evaluar nada.
        goalWeights: { ...BALANCED, survival: 2.5 },
      }),
    );
  }

  const lows = known.filter((k) => (res[k] ?? 0) < RESISTANCE_CAP);
  if (lows.length === 0) return out;

  const worst = Math.min(...lows.map((k) => res[k] ?? 0));
  const labels = lows.map((k) => `${RESISTANCE_LABELS[k]} ${res[k]}%`).join(", ");
  out.push({
    ruleId: "resistencias-elementales",
    title: "Cubrir resistencias elementales",
    action: `Sube ${labels} hasta el cap de ${RESISTANCE_CAP}% (p. ej. mods de resistencia en anillos, cinturón o botas).`,
    reason: `Tienes resistencias conocidas por debajo del cap: ${labels}. Es la fuente más común de muertes evitables.`,
    impactMetric: "resistencias",
    impactDescription: "Impacto estimado en supervivencia (métrica parcial orientativa).",
    magnitude: worst < 50 ? "high" : "medium",
    riskLevel: "low",
    riskDescription: "Cambio incremental de piezas de equipo; sin riesgo relevante.",
    mayLoseValuableMods: true,
    irreversible: false,
    priceQueries: [],
    goalWeights: { ...BALANCED, survival: 2, mapping: 1.3, bossing: 1.3, damage: 0.6 },
    confidenceBase: "high",
    unverified:
      unknown.length > 0
        ? [`No verificado — resistencias desconocidas no evaluadas: ${listarResistencias(unknown)}.`]
        : [],
    extraSources: [],
  });
  return out;
};

// ---------------------------------------------------------------------------
// Regla 2: resistencia al caos negativa — null-safe
// ---------------------------------------------------------------------------
export const chaosResistanceRule: Rule = ({ profile }) => {
  const chaos = profile.resistances.chaos;
  if (chaos === null) return []; // desconocido: ya lo cubre la regla de datos
  if (chaos >= 0) return [];
  return [
    {
      ruleId: "resistencia-caos",
      title: "Corregir la resistencia al caos negativa",
      action: `Tu resistencia al caos es ${chaos}%. Busca al menos llegar a 0% con un mod de caos en anillo, amuleto o cinturón.`,
      reason: "La resistencia al caos negativa amplifica el daño de caos recibido, cada vez más presente en mapas.",
      impactMetric: "resistencias",
      impactDescription: "Impacto estimado en supervivencia frente a daño de caos (métrica parcial).",
      magnitude: "medium",
      riskLevel: "low",
      riskDescription: "Cambio incremental de equipo; sin riesgo relevante.",
      mayLoseValuableMods: true,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, survival: 1.4, bossing: 1.2, damage: 0.5 },
      confidenceBase: "medium",
      unverified: [],
      extraSources: [],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 3: requisitos de atributos no cumplidos — null-safe
// ---------------------------------------------------------------------------
export const attributeRequirementsRule: Rule = ({ profile }) => {
  const attrs = profile.attributes;
  const levelReading = readCharacterLevel(profile);
  const itemsWithReqs = profile.items.filter((i) => i.requirements !== undefined);
  if (itemsWithReqs.length === 0) return [];

  if (attrs.str === null || attrs.dex === null || attrs.int === null) {
    return [
      dataGapCandidate({
        ruleId: "datos-atributos",
        what: "atributos",
        detail: "Hay equipo con requisitos, pero tus atributos son desconocidos.",
      }),
    ];
  }

  const problems: string[] = [];
  const problemItemIds: string[] = [];
  let hasUnknownLevelRequirement = false;
  for (const item of itemsWithReqs) {
    const req = item.requirements;
    if (!req) continue;
    const unmet: string[] = [];
    if (req.str !== undefined && req.str > (attrs.str ?? 0)) unmet.push(`Str ${req.str} (tienes ${attrs.str})`);
    if (req.dex !== undefined && req.dex > (attrs.dex ?? 0)) unmet.push(`Dex ${req.dex} (tienes ${attrs.dex})`);
    if (req.int !== undefined && req.int > (attrs.int ?? 0)) unmet.push(`Int ${req.int} (tienes ${attrs.int})`);
    if (req.level !== undefined) {
      if (!levelReading.known) {
        hasUnknownLevelRequirement = true;
      } else if (req.level > levelReading.level) {
        unmet.push(`nivel ${req.level} (eres ${levelReading.level})`);
      }
    }
    if (unmet.length > 0) {
      problems.push(`${item.name} (${item.slot}): ${unmet.join(", ")}`);
      problemItemIds.push(item.id);
    }
  }
  if (problems.length === 0) {
    return hasUnknownLevelRequirement
      ? [
          dataGapCandidate({
            ruleId: "datos-nivel-personaje",
            what: "nivel del personaje",
            detail: "Hay equipo con requisito de nivel, pero el nivel real del personaje no está declarado.",
          }),
        ]
      : [];
  }

  return [
    {
      ruleId: "requisitos-atributos",
      title: "Resolver requisitos de atributos no cumplidos",
      action: `Hay equipo con requisitos por encima de tus atributos: ${problems.join("; ")}. Añade atributos en amuleto/anillos o nodos de atributos.`,
      reason: "Un objeto cuyos requisitos no cumples puede dejar de aplicar sus stats o impedir equipar mejoras.",
      impactMetric: "requisitos",
      impactDescription: "Desbloquea el uso efectivo del equipo actual (métrica parcial).",
      magnitude: "medium",
      riskLevel: "low",
      riskDescription: "Añadir atributos no destruye equipo existente.",
      mayLoseValuableMods: false,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, balanced: 1.2 },
      confidenceBase: "medium",
      unverified: [
        "No verificado — los atributos del perfil dependen de lo importado; revísalos antes de comprar nada.",
        ...(hasUnknownLevelRequirement
          ? ["No verificado — falta el nivel real del personaje; no se evaluaron requisitos de nivel."]
          : []),
      ],
      extraSources: [],
      // Vínculo demostrable: son exactamente los objetos cuyos requisitos no se cumplen.
      relatedItemIds: problemItemIds,
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 4: arma (ballesta) sin quality o con pocos mods explícitos
// ---------------------------------------------------------------------------
export const weaponUpgradeRule: Rule = ({ profile }) => {
  const weapon = profile.items.find((i) => i.slot === "weapon");
  if (!weapon) return [];

  const explicitCount = weapon.modifiers.filter((m) => m.kind === "explicit").length;
  const quality = weapon.quality ?? 0;
  if (quality > 0 && explicitCount >= MIN_WEAPON_EXPLICITS) return [];

  const issues: string[] = [];
  if (quality === 0) issues.push("sin quality");
  if (explicitCount < MIN_WEAPON_EXPLICITS) issues.push(`solo ${explicitCount} mods explícitos`);

  // Solo hay precio consultable para ÚNICOS (match exacto de nombre). Un rare
  // nunca se valora con precios de únicos aunque coincida la base.
  const priceQueries: RulePriceQuery[] =
    weapon.rarity === "unique" ? [{ name: weapon.name, rarity: weapon.rarity }] : [];
  const unverified: string[] = [];
  if (weapon.rarity !== "unique") {
    unverified.push(
      `No verificado — "${weapon.name}" es ${weapon.rarity}: no existe precio de mercado consultable para objetos no únicos.`,
    );
  }

  return [
    {
      ruleId: "mejora-arma",
      title: "Mejorar el arma",
      action: `Tu arma "${weapon.name}" (${weapon.baseType}) está ${issues.join(" y ")}. Busca una ${weapon.baseType} o base similar con mejores mods dentro de tu presupuesto.`,
      reason: "El arma es la principal palanca de daño en la mayoría de builds de ataque; una base mejor compensa varios upgrades menores.",
      impactMetric: "daño del arma",
      impactDescription: "Impacto estimado en daño por mejora de base/mods del arma (métrica parcial orientativa).",
      magnitude: "high",
      riskLevel: "medium",
      riskDescription: "Comprar o craftear un arma nueva puede consumir gran parte del presupuesto.",
      mayLoseValuableMods: false,
      irreversible: false,
      priceQueries,
      goalWeights: { ...BALANCED, damage: 2, bossing: 1.5, mapping: 1.3, survival: 0.6 },
      confidenceBase: "medium",
      unverified,
      extraSources: [],
      // Vínculo demostrable: la regla evalúa exactamente esta pieza.
      relatedItemIds: [weapon.id],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 5: skill principal con pocos supports
// ---------------------------------------------------------------------------
export const skillLinksRule: Rule = ({ profile }) => {
  const main = profile.skills[0];
  if (!main) return [];
  if (main.supports.length >= MIN_MAIN_SUPPORTS) return [];

  const missing = MIN_MAIN_SUPPORTS - main.supports.length;
  const unverified = [
    "No verificado — compatibilidad exacta de supports pendiente de validar en el juego o en una guía de referencia.",
    "No verificado — coste de las gemas support no consultado.",
  ];
  if (main.mainSkillGemId === null) {
    unverified.push("No verificado — la skill principal no tiene id oficial de gema (mainSkillGemId null).");
  }
  return [
    {
      ruleId: "enlaces-skill",
      title: "Completar los supports de la skill principal",
      action: `"${main.mainSkill}" tiene ${main.supports.length} support(s). Añade ${missing} support(s) compatible(s) con su tipo de daño (revisa las guías de referencia guardadas).`,
      reason: "Los supports son el multiplicador de daño más barato del juego temprano; una skill principal infra-enlazada pierde gran parte de su potencial.",
      impactMetric: "enlaces de skill",
      impactDescription: "Impacto estimado en daño de la skill principal (métrica parcial orientativa).",
      magnitude: "medium",
      riskLevel: "low",
      riskDescription: "Cambiar supports es reversible y de bajo coste habitual (coste no verificado).",
      mayLoseValuableMods: false,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, damage: 1.4, mapping: 1.1 },
      confidenceBase: "medium",
      unverified,
      extraSources: [],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 6: vida ausente o baja para el nivel
// ---------------------------------------------------------------------------
export const lifeRule: Rule = ({ profile }) => {
  if (profile.life === undefined) {
    return [
      dataGapCandidate({
        ruleId: "datos-vida",
        what: "vida máxima",
        detail: `Sin el dato no se puede evaluar la heurística de ${LIFE_PER_LEVEL} por nivel.`,
        goalWeights: { ...BALANCED, survival: 0.8 },
      }),
    ];
  }
  const levelReading = readCharacterLevel(profile);
  if (!levelReading.known) {
    return [
      dataGapCandidate({
        ruleId: "datos-nivel-personaje",
        what: "nivel del personaje",
        detail: `Sin el nivel real no se puede evaluar la heurística de ${LIFE_PER_LEVEL} de vida por nivel.`,
        goalWeights: { ...BALANCED, survival: 0.8 },
      }),
    ];
  }
  const expected = levelReading.level * LIFE_PER_LEVEL;
  if (profile.life >= expected) return [];

  return [
    {
      ruleId: "vida-baja",
      title: "Subir la vida máxima",
      action: `Tienes ${profile.life} de vida a nivel ${levelReading.level} (heurística orientativa: ${expected}). Prioriza mods de "+vida máxima" en casco, pecho y cinturón.`,
      reason: `La heurística de ${LIFE_PER_LEVEL} de vida por nivel sugiere que estás por debajo de lo sostenible para tu nivel.`,
      impactMetric: "vida",
      impactDescription: "Impacto estimado en supervivencia (métrica parcial, basada en heurística no verificada).",
      magnitude: profile.life < expected * 0.7 ? "high" : "medium",
      riskLevel: "low",
      riskDescription: "Cambio incremental de equipo; sin riesgo relevante.",
      mayLoseValuableMods: true,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, survival: 1.5, bossing: 1.2, damage: 0.5 },
      confidenceBase: "medium",
      unverified: ["No verificado — la heurística de vida por nivel es orientativa, no un dato oficial."],
      extraSources: [],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 7: huecos frente a la build objetivo (referenceOnly, nunca verdad absoluta)
// ---------------------------------------------------------------------------

/**
 * Longitud máxima admitida (inclusive) para el nombre de una etiqueta de markup:
 * una etiqueta de exactamente 32 caracteres se reconoce; una de 33 ya no. Acota el
 * avance al buscar el `>` de apertura: sin este tope, una entrada como
 * "<<<<<…>" obligaría a reescanear y el recorrido dejaría de ser O(n).
 */
const MAX_MARKUP_TAG_LENGTH = 32;

/**
 * Si en `index` empieza una apertura de wrapper `<tag>{`, devuelve ese texto
 * literal (para poder restaurarlo si el wrapper nunca se cierra); si no, null.
 * El nombre de la etiqueta no puede contener `<`, `>`, `{` ni `}`.
 */
function matchWrapperOpen(text: string, index: number): string | null {
  const limit = Math.min(text.length, index + 2 + MAX_MARKUP_TAG_LENGTH);
  for (let j = index + 1; j < limit; j++) {
    const char = text[j];
    if (char === "<" || char === "{" || char === "}") return null;
    if (char === ">") {
      // Etiqueta no vacía y seguida de `{`: es una apertura de wrapper.
      return j > index + 1 && text[j + 1] === "{" ? text.slice(index, j + 2) : null;
    }
  }
  return null;
}

/**
 * Elimina el markup oficial de los planes GGG (`<tag>{...}`, anidable y con
 * bloques que abren y cierran en líneas distintas) dejando solo el texto.
 * Se aplica al additional_text COMPLETO antes de trocearlo en líneas: limpiar
 * línea a línea dejaba la llave de cierre del bloque ("3. Increased Armour}").
 *
 * Parser de UN SOLO RECORRIDO, O(n): una pila registra qué llave abierta
 * pertenece a un wrapper (su cierre se descarta) y cuál es texto literal (su
 * cierre se conserva). La versión iterativa anterior reescribía la cadena
 * completa por cada nivel anidado, con coste cuadrático: un `.build` malicioso
 * de hasta 2 MB podía bloquear el servidor.
 *
 * Garantías: las llaves y paréntesis que no forman parte de un wrapper
 * reconocido se conservan literalmente, igual que un wrapper sin cierre (se
 * restaura su texto original). Es una función pura: el plan crudo que se
 * conserva para reexportar nunca se modifica.
 */
function stripGggMarkup(text: string): string {
  const chunks: string[] = [];
  /** Llaves abiertas: objeto = wrapper (con hueco reservado); null = llave literal. */
  const open: Array<{ slot: number; raw: string } | null> = [];
  let plainStart = 0;
  let i = 0;

  const flushPlain = (end: number): void => {
    if (end > plainStart) chunks.push(text.slice(plainStart, end));
  };

  while (i < text.length) {
    const char = text[i];

    if (char === "<") {
      const wrapper = matchWrapperOpen(text, i);
      if (wrapper === null) {
        i += 1; // `<` suelto: texto literal
        continue;
      }
      flushPlain(i);
      // Hueco reservado: si este wrapper no llega a cerrarse, se restaura aquí
      // su texto original en lugar de perderlo.
      open.push({ slot: chunks.length, raw: wrapper });
      chunks.push("");
      i += wrapper.length;
      plainStart = i;
      continue;
    }

    if (char === "{") {
      open.push(null); // llave literal: su cierre también será literal
      i += 1;
      continue;
    }

    if (char === "}") {
      const entry = open.pop();
      if (entry === undefined || entry === null) {
        i += 1; // llave literal o sin pareja: se conserva
        continue;
      }
      flushPlain(i); // cierre de wrapper: se descarta la llave
      i += 1;
      plainStart = i;
      continue;
    }

    i += 1;
  }

  flushPlain(text.length);
  for (const entry of open) {
    if (entry !== null) chunks[entry.slot] = entry.raw;
  }
  return chunks.join("");
}

/** Normaliza texto de mods para comparación aproximada (minúsculas, sin números ni signos). */
function normalizeModText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[+-]?\d+(?:[.,]\d+)?%?/g, " ")
    .replace(/[^a-záéíóúñü ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const targetGapsRule: Rule = ({ profile, target }) => {
  if (!target) return [];

  // Referencias del target: desiredMods explícitos + pistas de texto de los
  // inventory_slots del plan oficial (additional_text). Son REFERENCIA
  // (community/user, referenceOnly): nunca se convierten en stats.
  const planHints: string[] = [];
  const planSlots = target.plan?.build.inventory_slots ?? [];
  for (const slot of planSlots) {
    if (planHints.length >= MAX_PLAN_HINTS) break;
    if (!slot.additional_text) continue;
    // El markup se limpia sobre el texto completo (los bloques <tag>{...}
    // abren y cierran en líneas distintas) y DESPUÉS se trocea en líneas
    // tipo "1. Increased Health" de las pistas de prioridad de stats.
    for (const rawLine of stripGggMarkup(slot.additional_text).split("\n")) {
      if (planHints.length >= MAX_PLAN_HINTS) break;
      const line = rawLine.replace(/^\s*\d+[.)]\s*/, "").trim();
      if (/^(increased|flat|level of|maximum|highest)/i.test(line) && line.length < 60) {
        planHints.push(line);
      }
    }
  }

  const desired = [...target.desiredMods, ...planHints];
  if (desired.length === 0) return [];

  const owned = new Set(
    profile.items.flatMap((i) => i.modifiers.map((m) => normalizeModText(m.text))),
  );
  const seen = new Set<string>();
  const missing = desired.filter((d) => {
    const norm = normalizeModText(d);
    if (norm.length === 0 || seen.has(norm)) return false;
    seen.add(norm);
    for (const have of owned) {
      if (have.includes(norm) || norm.includes(have)) return false;
    }
    return true;
  });
  if (missing.length === 0) return [];

  // La acción enumera como mucho MAX_LISTED_GAPS carencias; el resto se
  // declara por número, nunca se oculta.
  const listed = missing.slice(0, MAX_LISTED_GAPS);
  const omitted = missing.length - listed.length;
  const listedText = `${listed.join("; ")}${omitted > 0 ? ` (y ${omitted} más no enumeradas)` : ""}`;

  const extraSources: SourceEvidence[] = [
    {
      kind: "community",
      label: `Build de referencia (referenceOnly): ${target.name}`,
      ...(target.sourceUrl !== undefined ? { url: target.sourceUrl } : {}),
      retrievedAt: new Date().toISOString(),
    },
  ];
  if (target.plan) {
    extraSources.push({
      kind: "user",
      label: `Plan oficial .build importado: ${target.plan.build.name}`,
      retrievedAt: target.plan.importedAt,
    });
  }

  return [
    {
      ruleId: "mods-objetivo",
      title: "Acercarse a la build de referencia",
      action: `La build de referencia "${target.name}" sugiere stats que no tienes: ${listedText}. Valora piezas que los cubran.`,
      reason:
        "Comparación de los mods de tu equipo con los desiredMods y las pistas del plan de referencia (matching por texto normalizado).",
      impactMetric: "mods objetivo",
      impactDescription: "Acercamiento a la build de referencia (métrica parcial orientativa).",
      magnitude: "medium",
      riskLevel: "medium",
      riskDescription: "Cambiar piezas para perseguir la referencia puede no encajar en tu presupuesto real.",
      mayLoseValuableMods: true,
      irreversible: false,
      priceQueries: [],
      goalWeights: { damage: 1.4, survival: 1, mapping: 1.2, bossing: 1, balanced: 1.6 },
      confidenceBase: "low",
      unverified: [
        "No verificado — la build objetivo es una referencia comunitaria/oficial (referenceOnly), nunca verdad absoluta.",
        "No verificado — el matching de mods es por texto normalizado y puede producir falsos positivos/negativos.",
      ],
      extraSources,
    },
  ];
};

/** Reglas activas del motor (orden estable; la prioridad la decide el score). */
export const RULES: Rule[] = [
  elementalResistancesRule,
  chaosResistanceRule,
  attributeRequirementsRule,
  weaponUpgradeRule,
  skillLinksRule,
  lifeRule,
  targetGapsRule,
];
