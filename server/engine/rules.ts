import {
  readCharacterLevel,
  RESISTANCE_LABELS,
  type BuildTarget,
  type CharacterProfile,
  type GoalKind,
  type Item,
  type ResistanceKind,
  type SourceEvidence,
} from "../../shared/domain.js";
import { QUICK_REVIEW_SKILL_ID } from "../../shared/quickReview.js";
import { resistancesFromItems } from "../../shared/itemResistances.js";

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
  "rec-enlaces-skill": "Ponle apoyos a tu habilidad principal",
  "rec-vida-baja": "Subir la vida máxima",
  "rec-datos-resistencias": "Completar datos del personaje: resistencias",
  "rec-datos-atributos": "Completar datos del personaje: atributos",
  "rec-datos-vida": "Completar datos del personaje: vida máxima",
  "rec-datos-nivel-personaje": "Completar datos del personaje: nivel",
  "rec-mods-objetivo": "Acercarse a la build de referencia",
  "rec-huecos-equipo": "Rellenar los huecos de equipo vacíos",
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

/**
 * Umbral provisional usado para detectar una carencia elemental.
 *
 * No se presenta como una regla oficial de PoE2: a 2026-08-27 no tenemos una
 * fuente primaria de GGG incorporada que documente el 75% base. La UI debe
 * conservar esta limitación visible y pedir comprobar el límite en el juego.
 */
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

export type RuleLang = "es" | "en";

export interface RuleContext {
  profile: CharacterProfile;
  league: string;
  patch: string;
  target?: BuildTarget;
  /** Idioma de las frases. Las reglas deciden igual en los dos; sin él, español. */
  lang?: RuleLang;
}

/** Elige la frase del idioma pedido: `tr(lang)("hola", "hello")`. */
export function tr(lang: RuleLang | undefined): (es: string, en: string) => string {
  return (es, en) => (lang === "en" ? en : es);
}

const RESISTANCE_LABELS_EN: Record<ResistanceKind, string> = {
  fire: "fire",
  cold: "cold",
  lightning: "lightning",
  chaos: "chaos",
};

function resistanceLabel(kind: ResistanceKind, lang: RuleLang | undefined): string {
  return lang === "en" ? RESISTANCE_LABELS_EN[kind] : RESISTANCE_LABELS[kind];
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
  lang?: RuleLang;
  /** Qué hacer, si el dato tiene un sitio concreto donde mirarlo y anotarlo. */
  action?: string;
}): RuleCandidate {
  const t = tr(args.lang);
  return {
    ruleId: args.ruleId,
    title: t(`Completa los datos de tu personaje: ${args.what}`, `Fill in your character's data: ${args.what}`),
    action:
      args.action ??
      t(
        `Me falta tu dato de ${args.what}. Míralo en el juego (tecla C) y anótalo en los datos de tu personaje.`,
        `I'm missing your ${args.what}. Check it in game (C key) and write it in your character's data.`,
      ),
    reason: t(
      `Sin el dato "${args.what}" no se puede evaluar esta área sin inventar números.`,
      `Without "${args.what}" this area can't be evaluated without making up numbers.`,
    ),
    impactMetric: args.what,
    impactDescription: t("Evaluación pendiente de datos (métrica parcial).", "Evaluation waiting for data (partial metric)."),
    magnitude: "low",
    riskLevel: "low",
    riskDescription: t("Solo es una corrección de datos.", "It's only a data correction."),
    mayLoseValuableMods: false,
    irreversible: false,
    priceQueries: [],
    goalWeights: args.goalWeights ?? { ...BALANCED, survival: 0.8 },
    confidenceBase: "low",
    unverified: [
      t(
        `No verificado — falta el dato "${args.what}" en el perfil. ${args.detail}`,
        `Not verified — "${args.what}" is missing from the profile. ${args.detail}`,
      ),
    ],
    extraSources: [],
    relatedItemIds: [],
  };
}

/**
 * «un 92% más» o «2,4 veces más»: el daño recibido de un tipo es proporcional
 * a (100 − resistencia), así que basta comparar ese factor con el del objetivo.
 */
export function extraDamageTaken(resistance: number, target: number, lang?: RuleLang): string {
  const ratio = (100 - resistance) / (100 - target);
  if (lang === "en") {
    if (ratio >= 2) return `${(Math.round(ratio * 10) / 10).toLocaleString("en-GB")} times more`;
    return `${Math.round((ratio - 1) * 100)}% more`;
  }
  if (ratio >= 2) return `${(Math.round(ratio * 10) / 10).toLocaleString("es-ES")} veces más`;
  return `un ${Math.round((ratio - 1) * 100)}% más`;
}

// ---------------------------------------------------------------------------
// Regla 1: resistencias elementales bajo el umbral provisional — null-safe
// ---------------------------------------------------------------------------

/**
 * Enumera resistencias en español para el texto del jugador. Las claves del
 * dominio (`fire`, `cold`, …) nunca salen a la superficie: solo su etiqueta.
 */
function listarResistencias(kinds: ResistanceKind[], lang?: RuleLang): string {
  return kinds.map((k) => resistanceLabel(k, lang)).join(", ");
}

export const elementalResistancesRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  const label = (kind: ResistanceKind) => resistanceLabel(kind, lang);
  const res = profile.resistances;
  const keys: ResistanceKind[] = ["fire", "cold", "lightning"];
  const unknown = keys.filter((k) => res[k] === null);
  const known = keys.filter((k) => res[k] !== null);

  const out: RuleCandidate[] = [];
  if (unknown.length > 0) {
    // Lo que suma el equipo orienta, pero el valor real (tecla C) incluye
    // pasivas y penalizaciones: se pide ese y se dice de dónde sale cada uno.
    const gear = resistancesFromItems(profile.items);
    const gearList = unknown
      .map((k) => `${label(k)} ${gear[k] >= 0 ? "+" : ""}${gear[k]} %`)
      .join(", ");
    out.push(
      dataGapCandidate({
        ruleId: "datos-resistencias",
        what: t("resistencias", "resistances"),
        detail: t(`Resistencias desconocidas: ${listarResistencias(unknown)}.`, `Unknown resistances: ${listarResistencias(unknown, lang)}.`),
        action: t(
          `Mira tus resistencias en el juego (tecla C) y escríbelas en la revisión rápida.${gear.found ? ` Tu equipo suma ahora: ${gearList}; el juego añade tus pasivas.` : ""}`,
          `Check your resistances in game (C key) and write them in the quick review.${gear.found ? ` Your gear adds up to: ${gearList}; the game adds your passives.` : ""}`,
        ),
        lang,
        // Para survival es el dato crítico: sin resistencias no se puede evaluar nada.
        goalWeights: { ...BALANCED, survival: 2.5 },
      }),
    );
  }

  const lows = known.filter((k) => (res[k] ?? 0) < RESISTANCE_CAP);
  if (lows.length === 0) return out;

  const worst = Math.min(...lows.map((k) => res[k] ?? 0));
  const worstKind = lows.find((k) => res[k] === worst) ?? lows[0];
  const labels = lows
    .map((k) =>
      t(
        `${label(k)} ${res[k]}% (te faltan ${RESISTANCE_CAP - (res[k] ?? 0)} puntos)`,
        `${label(k)} ${res[k]}% (${RESISTANCE_CAP - (res[k] ?? 0)} points short)`,
      ),
    )
    .join(", ");
  const extraDamage = t(
    `Con ${label(worstKind)} al ${worst}% recibes ${extraDamageTaken(worst, RESISTANCE_CAP)} daño de ${label(worstKind)} que con el ${RESISTANCE_CAP}%.`,
    `With ${label(worstKind)} at ${worst}% you take ${extraDamageTaken(worst, RESISTANCE_CAP, "en")} ${label(worstKind)} damage than at ${RESISTANCE_CAP}%.`,
  );
  out.push({
    ruleId: "resistencias-elementales",
    title: t("Cubrir resistencias elementales", "Cover your elemental resistances"),
    action: t(
      `Eleva hacia ${RESISTANCE_CAP}% las resistencias que ahora están así: ${labels}. Después vuelve a comprobar el límite que muestra el juego; ${RESISTANCE_CAP}% se usa aquí solo como objetivo provisional.`,
      `Raise these resistances towards ${RESISTANCE_CAP}%: ${labels}. Then check the cap the game shows again; ${RESISTANCE_CAP}% is only used here as a provisional target.`,
    ),
    reason: t(
      `Tienes resistencias elementales conocidas por debajo del umbral provisional: ${labels}. ${extraDamage}`,
      `Some known elemental resistances are below the provisional threshold: ${labels}. ${extraDamage}`,
    ),
    impactMetric: t("resistencias", "resistances"),
    impactDescription: t("Impacto estimado en supervivencia (métrica parcial orientativa).", "Estimated impact on survival (partial, rough metric)."),
    magnitude: worst < 50 ? "high" : "medium",
    riskLevel: "medium",
    riskDescription: t(
      "Sustituir piezas puede hacerte perder otros mods valiosos; compara el objeto completo antes de cambiarlo.",
      "Replacing items can make you lose other valuable modifiers; compare the whole item before changing it.",
    ),
    mayLoseValuableMods: true,
    irreversible: false,
    priceQueries: [],
    goalWeights: { ...BALANCED, survival: 2, mapping: 1.3, bossing: 1.3, damage: 0.6 },
    confidenceBase: "medium",
    unverified: [
      t(
        `No verificado — ${RESISTANCE_CAP}% es un umbral provisional; confirma el límite actual de cada resistencia dentro de PoE2.`,
        `Not verified — ${RESISTANCE_CAP}% is a provisional threshold; confirm each resistance's current cap inside PoE2.`,
      ),
      ...(unknown.length > 0
        ? [
            t(
              `No verificado — resistencias desconocidas no evaluadas: ${listarResistencias(unknown)}.`,
              `Not verified — unknown resistances not evaluated: ${listarResistencias(unknown, lang)}.`,
            ),
          ]
        : []),
    ],
    extraSources: [],
  });
  return out;
};

// ---------------------------------------------------------------------------
// Regla 2: resistencia al caos negativa — null-safe
// ---------------------------------------------------------------------------
export const chaosResistanceRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  const chaos = profile.resistances.chaos;
  if (chaos === null) return []; // desconocido: ya lo cubre la regla de datos
  if (chaos >= 0) return [];
  return [
    {
      ruleId: "resistencia-caos",
      title: t("Corregir la resistencia al caos negativa", "Fix your negative chaos resistance"),
      action: t(
        `Tu resistencia al caos es ${chaos}%. Busca al menos llegar a 0% con un mod de caos en anillo, amuleto o cinturón.`,
        `Your chaos resistance is ${chaos}%. Aim for at least 0% with a chaos modifier on a ring, amulet or belt.`,
      ),
      reason: t(
        "La resistencia al caos negativa amplifica el daño de caos recibido, cada vez más presente en mapas.",
        "Negative chaos resistance amplifies the chaos damage you take, which shows up more and more in maps.",
      ),
      impactMetric: t("resistencias", "resistances"),
      impactDescription: t(
        "Impacto estimado en supervivencia frente a daño de caos (métrica parcial).",
        "Estimated impact on survival against chaos damage (partial metric).",
      ),
      magnitude: "medium",
      riskLevel: "medium",
      riskDescription: t(
        "Sustituir una pieza puede hacerte perder otros mods valiosos; compara el objeto completo antes de cambiarlo.",
        "Replacing an item can make you lose other valuable modifiers; compare the whole item before changing it.",
      ),
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
export const attributeRequirementsRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  const attrs = profile.attributes;
  const levelReading = readCharacterLevel(profile);
  const itemsWithReqs = profile.items.filter((i) => i.requirements !== undefined);
  if (itemsWithReqs.length === 0) return [];

  if (attrs.str === null || attrs.dex === null || attrs.int === null) {
    return [
      dataGapCandidate({
        ruleId: "datos-atributos",
        what: t("atributos", "attributes"),
        detail: t("Hay equipo con requisitos, pero tus atributos son desconocidos.", "Some gear has requirements, but your attributes are unknown."),
        lang,
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
    const have = (value: number | null) => t(`tienes ${value}`, `you have ${value}`);
    if (req.str !== undefined && req.str > (attrs.str ?? 0)) unmet.push(`Str ${req.str} (${have(attrs.str)})`);
    if (req.dex !== undefined && req.dex > (attrs.dex ?? 0)) unmet.push(`Dex ${req.dex} (${have(attrs.dex)})`);
    if (req.int !== undefined && req.int > (attrs.int ?? 0)) unmet.push(`Int ${req.int} (${have(attrs.int)})`);
    if (req.level !== undefined) {
      if (!levelReading.known) {
        hasUnknownLevelRequirement = true;
      } else if (req.level > levelReading.level) {
        unmet.push(t(`nivel ${req.level} (eres ${levelReading.level})`, `level ${req.level} (you're ${levelReading.level})`));
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
            what: t("nivel del personaje", "character level"),
            detail: t(
              "Hay equipo con requisito de nivel, pero el nivel real del personaje no está declarado.",
              "Some gear has a level requirement, but the character's real level isn't stated.",
            ),
            lang,
          }),
        ]
      : [];
  }

  return [
    {
      ruleId: "requisitos-atributos",
      title: t("Resolver requisitos de atributos no cumplidos", "Meet unmet attribute requirements"),
      action: t(
        `Hay equipo con requisitos por encima de tus atributos: ${problems.join("; ")}. Añade atributos en amuleto/anillos o nodos de atributos.`,
        `Some gear needs more than your attributes: ${problems.join("; ")}. Add attributes on your amulet/rings or with attribute nodes.`,
      ),
      reason: t(
        "Un objeto cuyos requisitos no cumples puede dejar de aplicar sus stats o impedir equipar mejoras.",
        "An item whose requirements you don't meet may stop applying its stats or keep you from equipping upgrades.",
      ),
      impactMetric: t("requisitos", "requirements"),
      impactDescription: t("Desbloquea el uso efectivo del equipo actual (métrica parcial).", "Unlocks the real use of your current gear (partial metric)."),
      magnitude: "medium",
      riskLevel: "low",
      riskDescription: t("Añadir atributos no destruye equipo existente.", "Adding attributes doesn't destroy any existing gear."),
      mayLoseValuableMods: false,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, balanced: 1.2 },
      confidenceBase: "medium",
      unverified: [
        t(
          "No verificado — los atributos del perfil dependen de lo importado; revísalos antes de comprar nada.",
          "Not verified — the profile's attributes depend on what was imported; check them before buying anything.",
        ),
        ...(hasUnknownLevelRequirement
          ? [
              t(
                "No verificado — falta el nivel real del personaje; no se evaluaron requisitos de nivel.",
                "Not verified — the character's real level is missing; level requirements weren't evaluated.",
              ),
            ]
          : []),
      ],
      extraSources: [],
      // Vínculo demostrable: son exactamente los objetos cuyos requisitos no se cumplen.
      relatedItemIds: problemItemIds,
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 4: arma sin quality o con pocos mods explícitos
// ---------------------------------------------------------------------------

/**
 * Armas de hechicero: varitas, cetros y bastones (no los báculos, que son de
 * ataque). La calidad apenas les da daño a los hechizos; lo que cuenta son los
 * niveles de habilidades de hechizo y el daño de hechizos.
 */
const CASTER_WEAPON_RE = /wand|varita|sceptre|cetro|\bstaff\b|\bstaves\b|bast[oó]n/i;

export function isCasterWeapon(item: Pick<Item, "itemClass" | "baseType">): boolean {
  return CASTER_WEAPON_RE.test(item.itemClass?.trim() || item.baseType);
}

export const weaponUpgradeRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  const weapon = profile.items.find((i) => i.slot === "weapon");
  if (!weapon) return [];
  const caster = isCasterWeapon(weapon);
  const explicitCount = weapon.modifiers.filter((m) => m.kind === "explicit").length;
  const quality = weapon.quality ?? 0;
  // A un arma de hechicero la calidad apenas le da daño, y un único trae sus
  // mods fijos. Antes una varita única buena salía como «mejora el arma».
  const lacksQuality = quality === 0 && !caster;
  const fewMods = weapon.rarity !== "unique" && explicitCount < MIN_WEAPON_EXPLICITS;
  if (!lacksQuality && !fewMods) return [];

  const issues: string[] = [];
  if (lacksQuality) issues.push(t("sin calidad", "without quality"));
  if (fewMods) issues.push(t(`solo ${explicitCount} mods explícitos`, `only ${explicitCount} explicit modifiers`));

  // Solo hay precio consultable para ÚNICOS (match exacto de nombre). Un rare
  // nunca se valora con precios de únicos aunque coincida la base.
  const priceQueries: RulePriceQuery[] =
    weapon.rarity === "unique" ? [{ name: weapon.name, rarity: weapon.rarity }] : [];
  const unverified: string[] = [];
  if (weapon.rarity !== "unique") {
    unverified.push(
      t(
        `No verificado — "${weapon.name}" es ${weapon.rarity}: no existe precio de mercado consultable para objetos no únicos.`,
        `Not verified — "${weapon.name}" is ${weapon.rarity}: there's no market price to look up for non-unique items.`,
      ),
    );
  }

  return [
    {
      ruleId: "mejora-arma",
      title: t("Mejorar el arma", "Upgrade your weapon"),
      // Sin «busca una ${baseType}»: mandaba a buscar la misma base que ya tenía.
      action: !fewMods
        ? t(
            `Tu arma "${weapon.name}" (${weapon.baseType}) está sin calidad. Súbele la calidad antes de cambiarla: es daño gratis.`,
            `Your weapon "${weapon.name}" (${weapon.baseType}) has no quality. Raise its quality before replacing it: it's free damage.`,
          )
        : caster
        ? t(
            `Tu arma "${weapon.name}" (${weapon.baseType}) tiene ${issues.join(" y ")}. Busca una con «+X al nivel de las habilidades de hechizo» y daño de hechizos aumentado, dentro de tu presupuesto.`,
            `Your weapon "${weapon.name}" (${weapon.baseType}) has ${issues.join(" and ")}. Look for one with "+X to Level of all Spell Skills" and increased spell damage, within your budget.`,
          )
        : t(
            `Tu arma "${weapon.name}" (${weapon.baseType}) está ${issues.join(" y ")}. Busca otra con mejores mods, o de una base de más nivel, dentro de tu presupuesto.`,
            `Your weapon "${weapon.name}" (${weapon.baseType}) is ${issues.join(" and ")}. Look for one with better modifiers, or a higher-level base, within your budget.`,
          ),
      reason: caster
        ? t(
            "En un arma de hechicero, lo que más daño da son los niveles de habilidades de hechizo y el daño de hechizos; la calidad apenas cuenta.",
            "On a caster weapon, spell skill levels and spell damage give the most damage; quality barely matters.",
          )
        : t(
            "El arma es la principal palanca de daño en la mayoría de builds de ataque; una base mejor compensa varios upgrades menores.",
            "Your weapon is the main damage lever in most attack builds; a better base is worth several smaller upgrades.",
          ),
      impactMetric: t("daño del arma", "weapon damage"),
      impactDescription: t(
        "Impacto estimado en daño por mejora de base/mods del arma (métrica parcial orientativa).",
        "Estimated damage impact from a better weapon base/modifiers (partial, rough metric).",
      ),
      magnitude: "high",
      riskLevel: "medium",
      riskDescription: t(
        "Comprar o craftear un arma nueva puede consumir gran parte del presupuesto.",
        "Buying or crafting a new weapon can eat a large part of your budget.",
      ),
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
export const skillLinksRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  const main = profile.skills[0];
  if (!main) return [];
  // La habilidad que el jugador escribió en la revisión rápida llega sin sus
  // apoyos: no se sabe cuántos lleva, así que no se afirma «tiene 0».
  if (main.id === QUICK_REVIEW_SKILL_ID) return [];
  if (main.supports.length >= MIN_MAIN_SUPPORTS) return [];

  const missing = MIN_MAIN_SUPPORTS - main.supports.length;
  const unverified = [
    t(
      `No verificado — ${MIN_MAIN_SUPPORTS} supports es un umbral heurístico interno, no una regla universal de PoE2.`,
      `Not verified — ${MIN_MAIN_SUPPORTS} supports is an internal rule of thumb, not a universal PoE2 rule.`,
    ),
    t(
      "No verificado — compatibilidad exacta de supports pendiente de validar en el juego o en una guía de referencia.",
      "Not verified — exact support compatibility still needs checking in game or in a reference guide.",
    ),
    t("No verificado — coste de las gemas support no consultado.", "Not verified — support gem cost not looked up."),
  ];
  if (main.mainSkillGemId === null) {
    unverified.push(
      t(
        "No verificado — la skill principal no tiene id oficial de gema (mainSkillGemId null).",
        "Not verified — the main skill has no official gem id (mainSkillGemId null).",
      ),
    );
  }
  return [
    {
      ruleId: "enlaces-skill",
      title: t("Ponle apoyos a tu habilidad principal", "Fill in your main skill's supports"),
      action: t(
        `"${main.mainSkill}" lleva ${main.supports.length} ${main.supports.length === 1 ? "apoyo" : "apoyos"}. Ponle ${missing} más que ${missing === 1 ? "encaje" : "encajen"} con su tipo de daño (mira tu guía de referencia).`,
        `"${main.mainSkill}" has ${main.supports.length} ${main.supports.length === 1 ? "support" : "supports"}. Add ${missing} more that ${missing === 1 ? "fits" : "fit"} its damage type (check your saved reference guides).`,
      ),
      reason: t(
        `Con menos de ${MIN_MAIN_SUPPORTS} gemas de apoyo, tu habilidad principal suele quedarse corta de daño. Es una regla orientativa: cada apoyo tiene que encajar con ella, compruébalo en el juego.`,
        `With fewer than ${MIN_MAIN_SUPPORTS} support gems, your main skill usually falls short on damage. It's a rule of thumb: each support has to fit the skill, so check it in game.`,
      ),
      impactMetric: t("enlaces de skill", "skill links"),
      impactDescription: t(
        "Impacto estimado en daño de la skill principal (métrica parcial orientativa).",
        "Estimated damage impact on the main skill (partial, rough metric).",
      ),
      magnitude: "medium",
      riskLevel: "low",
      riskDescription: t(
        "Cambiar supports es reversible; su compatibilidad y coste todavía no están verificados.",
        "Changing supports is reversible; their compatibility and cost aren't verified yet.",
      ),
      mayLoseValuableMods: false,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, damage: 1.4, mapping: 1.1 },
      confidenceBase: "low",
      unverified,
      extraSources: [],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 6: vida ausente o baja para el nivel
// ---------------------------------------------------------------------------
export const lifeRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  if (profile.life === undefined) {
    return [
      dataGapCandidate({
        ruleId: "datos-vida",
        what: t("vida máxima", "maximum life"),
        detail: t(
          `Sin el dato no se puede evaluar la heurística de ${LIFE_PER_LEVEL} por nivel.`,
          `Without it the rule of thumb of ${LIFE_PER_LEVEL} per level can't be evaluated.`,
        ),
        goalWeights: { ...BALANCED, survival: 0.8 },
        lang,
      }),
    ];
  }
  const levelReading = readCharacterLevel(profile);
  if (!levelReading.known) {
    return [
      dataGapCandidate({
        ruleId: "datos-nivel-personaje",
        what: t("nivel del personaje", "character level"),
        detail: t(
          `Sin el nivel real no se puede evaluar la heurística de ${LIFE_PER_LEVEL} de vida por nivel.`,
          `Without the real level the rule of thumb of ${LIFE_PER_LEVEL} life per level can't be evaluated.`,
        ),
        goalWeights: { ...BALANCED, survival: 0.8 },
        lang,
      }),
    ];
  }
  const expected = levelReading.level * LIFE_PER_LEVEL;
  if (profile.life >= expected) return [];

  return [
    {
      ruleId: "vida-baja",
      title: t("Subir la vida máxima", "Raise your maximum life"),
      action: t(
        `Tienes ${profile.life} de vida a nivel ${levelReading.level} (heurística orientativa: ${expected}). Prioriza mods de "+vida máxima" en casco, pecho y cinturón.`,
        `You have ${profile.life} life at level ${levelReading.level} (rough rule of thumb: ${expected}). Prioritise "+maximum life" modifiers on your helmet, body armour and belt.`,
      ),
      reason: t(
        `La heurística de ${LIFE_PER_LEVEL} de vida por nivel sugiere que estás por debajo de lo sostenible para tu nivel.`,
        `The rule of thumb of ${LIFE_PER_LEVEL} life per level suggests you're below what's sustainable for your level.`,
      ),
      impactMetric: t("vida", "life"),
      impactDescription: t(
        "Impacto estimado en supervivencia (métrica parcial, basada en heurística no verificada).",
        "Estimated impact on survival (partial metric, based on an unverified rule of thumb).",
      ),
      magnitude: profile.life < expected * 0.7 ? "high" : "medium",
      riskLevel: "medium",
      riskDescription: t(
        "Sustituir casco, pecho o cinturón puede hacerte perder otros mods valiosos; compara el objeto completo antes de cambiarlo.",
        "Replacing your helmet, body armour or belt can make you lose other valuable modifiers; compare the whole item before changing it.",
      ),
      mayLoseValuableMods: true,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, survival: 1.5, bossing: 1.2, damage: 0.5 },
      confidenceBase: "medium",
      unverified: [
        t(
          "No verificado — la heurística de vida por nivel es orientativa, no un dato oficial.",
          "Not verified — the life-per-level rule of thumb is a rough guide, not official data.",
        ),
      ],
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

export const targetGapsRule: Rule = ({ profile, target, lang }) => {
  const t = tr(lang);
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
  const listedText = `${listed.join("; ")}${omitted > 0 ? t(` (y ${omitted} más no enumeradas)`, ` (and ${omitted} more not listed)`) : ""}`;

  const extraSources: SourceEvidence[] = [
    {
      kind: "community",
      label: t(`Build de referencia (referenceOnly): ${target.name}`, `Reference build (referenceOnly): ${target.name}`),
      ...(target.sourceUrl !== undefined ? { url: target.sourceUrl } : {}),
      retrievedAt: new Date().toISOString(),
    },
  ];
  if (target.plan) {
    extraSources.push({
      kind: "user",
      label: t(`Plan oficial .build importado: ${target.plan.build.name}`, `Imported official .build plan: ${target.plan.build.name}`),
      retrievedAt: target.plan.importedAt,
    });
  }

  return [
    {
      ruleId: "mods-objetivo",
      title: t("Acercarse a la build de referencia", "Get closer to the reference build"),
      action: t(
        `La build de referencia "${target.name}" sugiere stats que no tienes: ${listedText}. Valora piezas que los cubran.`,
        `The reference build "${target.name}" suggests stats you don't have: ${listedText}. Consider items that cover them.`,
      ),
      reason: t(
        "Comparación de los mods de tu equipo con los desiredMods y las pistas del plan de referencia (matching por texto normalizado).",
        "Comparison of your gear's modifiers with the reference plan's desiredMods and hints (matching by normalised text).",
      ),
      impactMetric: t("mods objetivo", "target mods"),
      impactDescription: t("Acercamiento a la build de referencia (métrica parcial orientativa).", "Getting closer to the reference build (partial, rough metric)."),
      magnitude: "medium",
      riskLevel: "medium",
      riskDescription: t(
        "Cambiar piezas para perseguir la referencia puede no encajar en tu presupuesto real.",
        "Changing items to chase the reference may not fit your real budget.",
      ),
      mayLoseValuableMods: true,
      irreversible: false,
      priceQueries: [],
      goalWeights: { damage: 1.4, survival: 1, mapping: 1.2, bossing: 1, balanced: 1.6 },
      confidenceBase: "low",
      unverified: [
        t(
          "No verificado — la build objetivo es una referencia comunitaria/oficial (referenceOnly), nunca verdad absoluta.",
          "Not verified — the target build is a community/official reference (referenceOnly), never absolute truth.",
        ),
        t(
          "No verificado — el matching de mods es por texto normalizado y puede producir falsos positivos/negativos.",
          "Not verified — modifier matching uses normalised text and can give false positives/negatives.",
        ),
      ],
      extraSources,
    },
  ];
};

/** Reglas activas del motor (orden estable; la prioridad la decide el score). */
// ---------------------------------------------------------------------------
// Regla: huecos de equipo vacíos (traída del chequeo de build)
// ---------------------------------------------------------------------------

/** Huecos que toda build lleva ocupados; la mano secundaria depende del arma. */
const REQUIRED_SLOTS: Array<{ slot: CharacterProfile["items"][number]["slot"]; label: string; labelEn: string }> = [
  { slot: "weapon", label: "Arma", labelEn: "Weapon" },
  { slot: "helmet", label: "Casco", labelEn: "Helmet" },
  { slot: "body", label: "Pecho", labelEn: "Body armour" },
  { slot: "gloves", label: "Guantes", labelEn: "Gloves" },
  { slot: "boots", label: "Botas", labelEn: "Boots" },
  { slot: "belt", label: "Cinturón", labelEn: "Belt" },
  { slot: "amulet", label: "Amuleto", labelEn: "Amulet" },
  { slot: "ring1", label: "Anillo 1", labelEn: "Ring 1" },
  { slot: "ring2", label: "Anillo 2", labelEn: "Ring 2" },
];

export const emptySlotsRule: Rule = ({ profile, lang }) => {
  const t = tr(lang);
  // Un perfil sin ningún objeto es un expediente sin equipo, no nueve huecos vacíos.
  if (profile.items.length === 0) return [];
  const occupied = new Set(profile.items.map((item) => item.slot));
  const empty = REQUIRED_SLOTS.filter(({ slot }) => !occupied.has(slot));
  if (empty.length === 0) return [];
  const names = empty.map(({ label, labelEn }) => (lang === "en" ? labelEn : label)).join(", ");
  const missingCore = empty.some(({ slot }) => slot === "weapon" || slot === "body");
  return [
    {
      ruleId: "huecos-equipo",
      title: t("Rellenar los huecos de equipo vacíos", "Fill your empty gear slots"),
      action: t(
        `Tienes vacío: ${names}. Hasta un objeto raro barato con vida o resistencias ya ayuda.`,
        `Empty: ${names}. Even a cheap rare with life or resistances already helps.`,
      ),
      reason: t(
        "Cada hueco vacío es vida, resistencias o daño que no estás recibiendo.",
        "Every empty slot is life, resistances or damage you're not getting.",
      ),
      impactMetric: t("equipo", "gear"),
      impactDescription: t(
        "Impacto directo en supervivencia y daño: el hueco no aporta nada ahora mismo.",
        "Direct impact on survival and damage: the slot gives nothing right now.",
      ),
      magnitude: missingCore || empty.length >= 3 ? "high" : "medium",
      riskLevel: "low",
      riskDescription: t("No sustituyes nada: solo ocupas un hueco libre.", "You don't replace anything: you just fill a free slot."),
      mayLoseValuableMods: false,
      irreversible: false,
      priceQueries: [],
      goalWeights: { ...BALANCED, survival: 2, mapping: 1.3, bossing: 1.3, balanced: 1.3 },
      confidenceBase: "high",
      unverified: [],
      extraSources: [],
      relatedItemIds: [],
    },
  ];
};

export const RULES: Rule[] = [
  elementalResistancesRule,
  chaosResistanceRule,
  emptySlotsRule,
  attributeRequirementsRule,
  weaponUpgradeRule,
  skillLinksRule,
  lifeRule,
  targetGapsRule,
];
