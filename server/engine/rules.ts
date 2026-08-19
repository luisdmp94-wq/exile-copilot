import type { CharacterProfile, GoalKind } from "../../shared/domain.js";

/**
 * Reglas deterministas del motor de recomendaciones.
 *
 * Diseñadas para el arquetipo MVP `mercenary-crossbow`, pero parametrizadas
 * por `goalWeights` para extender a otros arquetipos/reglas sin tocar el motor.
 *
 * Regla de oro: las reglas NUNCA inventan precios, mods ni estadísticas.
 * Si falta un dato, se declara en `unverified` y el coste queda en null.
 */

export const ENGINE_VERSION = "1.0.0";

export const RESISTANCE_CAP = 75;
/** Heurística de vida mínima: nivel × 30 (documentada, no verificada). */
export const LIFE_PER_LEVEL = 30;
/** Mínimo de supports razonable en la skill principal. */
export const MIN_MAIN_SUPPORTS = 2;
/** Mínimo de mods explícitos deseables en el arma. */
export const MIN_WEAPON_EXPLICITS = 4;

export type Magnitude = "low" | "medium" | "high";

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
  /** Nombres a intentar valorar con poe.ninja (arma, base...). */
  priceNames: string[];
  /** Peso de la regla según el objetivo del jugador. */
  goalWeights: Record<GoalKind, number>;
  confidenceBase: "low" | "medium" | "high";
  unverified: string[];
}

export interface RuleContext {
  profile: CharacterProfile;
  league: string;
  patch: string;
}

export type Rule = (ctx: RuleContext) => RuleCandidate[];

const BALANCED: Record<GoalKind, number> = {
  damage: 1,
  survival: 1,
  mapping: 1,
  bossing: 1,
  balanced: 1,
};

// ---------------------------------------------------------------------------
// Regla 1: resistencias elementales por debajo del cap (75%)
// ---------------------------------------------------------------------------
export const elementalResistancesRule: Rule = ({ profile }) => {
  const res = profile.resistances;
  const lows = (["fire", "cold", "lightning"] as const).filter((k) => res[k] < RESISTANCE_CAP);
  if (lows.length === 0) return [];

  const worst = Math.min(res.fire, res.cold, res.lightning);
  const labels = lows.map((k) => `${k} ${res[k]}%`).join(", ");
  return [
    {
      ruleId: "resistencias-elementales",
      title: "Cubrir resistencias elementales",
      action: `Sube ${labels} hasta el cap de ${RESISTANCE_CAP}% (p. ej. mods de resistencia en anillos, cinturón o botas).`,
      reason: `Tienes resistencias por debajo del cap: ${labels}. Es la fuente más común de muertes evitables.`,
      impactMetric: "resistencias",
      impactDescription: "Impacto estimado en supervivencia (métrica parcial orientativa).",
      magnitude: worst < 50 ? "high" : "medium",
      riskLevel: "low",
      riskDescription: "Cambio incremental de piezas de equipo; sin riesgo relevante.",
      mayLoseValuableMods: true,
      irreversible: false,
      priceNames: [],
      goalWeights: { ...BALANCED, survival: 2, mapping: 1.3, bossing: 1.3, damage: 0.6 },
      confidenceBase: "high",
      unverified: [],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 2: resistencia al caos negativa
// ---------------------------------------------------------------------------
export const chaosResistanceRule: Rule = ({ profile }) => {
  if (profile.resistances.chaos >= 0) return [];
  return [
    {
      ruleId: "resistencia-caos",
      title: "Corregir la resistencia al caos negativa",
      action: `Tu resistencia al caos es ${profile.resistances.chaos}%. Busca al menos llegar a 0% con un mod de caos en anillo, amuleto o cinturón.`,
      reason: "La resistencia al caos negativa amplifica el daño de caos recibido, cada vez más presente en mapas.",
      impactMetric: "resistencias",
      impactDescription: "Impacto estimado en supervivencia frente a daño de caos (métrica parcial).",
      magnitude: "medium",
      riskLevel: "low",
      riskDescription: "Cambio incremental de equipo; sin riesgo relevante.",
      mayLoseValuableMods: true,
      irreversible: false,
      priceNames: [],
      goalWeights: { ...BALANCED, survival: 1.4, bossing: 1.2, damage: 0.5 },
      confidenceBase: "medium",
      unverified: [],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 3: requisitos de atributos no cumplidos por algún item equipado
// ---------------------------------------------------------------------------
export const attributeRequirementsRule: Rule = ({ profile }) => {
  const attrs = profile.attributes;
  const problems: string[] = [];
  for (const item of profile.items) {
    const req = item.requirements;
    if (!req) continue;
    const unmet: string[] = [];
    if (req.str !== undefined && req.str > attrs.str) unmet.push(`Str ${req.str} (tienes ${attrs.str})`);
    if (req.dex !== undefined && req.dex > attrs.dex) unmet.push(`Dex ${req.dex} (tienes ${attrs.dex})`);
    if (req.int !== undefined && req.int > attrs.int) unmet.push(`Int ${req.int} (tienes ${attrs.int})`);
    if (req.level !== undefined && req.level > profile.level) unmet.push(`nivel ${req.level} (eres ${profile.level})`);
    if (unmet.length > 0) problems.push(`${item.name} (${item.slot}): ${unmet.join(", ")}`);
  }
  if (problems.length === 0) return [];

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
      priceNames: [],
      goalWeights: { ...BALANCED, balanced: 1.2 },
      confidenceBase: "medium",
      unverified: [
        "No verificado — los atributos del perfil dependen de lo importado; revísalos antes de comprar nada.",
      ],
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

  return [
    {
      ruleId: "mejora-arma",
      title: "Mejorar la ballesta",
      action: `Tu arma "${weapon.name}" (${weapon.baseType}) está ${issues.join(" y ")}. Busca una ${weapon.baseType} o base similar con mejor daño físico y quality dentro de tu presupuesto.`,
      reason: "En el arquetipo mercenario-ballesta el arma es la principal palanca de daño; una base mejor compensa varios upgrades menores.",
      impactMetric: "daño del arma",
      impactDescription: "Impacto estimado en daño por mejora de base/mods del arma (métrica parcial orientativa).",
      magnitude: "high",
      riskLevel: "medium",
      riskDescription: "Comprar o craftear un arma nueva puede consumir gran parte del presupuesto.",
      mayLoseValuableMods: false,
      irreversible: false,
      priceNames: [weapon.baseType, weapon.name],
      goalWeights: { ...BALANCED, damage: 2, bossing: 1.5, mapping: 1.3, survival: 0.6 },
      confidenceBase: "medium",
      unverified: [],
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
      priceNames: [],
      goalWeights: { ...BALANCED, damage: 1.4, mapping: 1.1 },
      confidenceBase: "medium",
      unverified: [
        "No verificado — compatibilidad exacta de supports pendiente de validar en el juego o en una guía de referencia.",
        "No verificado — coste de las gemas support no consultado.",
      ],
    },
  ];
};

// ---------------------------------------------------------------------------
// Regla 6: vida ausente o baja para el nivel
// ---------------------------------------------------------------------------
export const lifeRule: Rule = ({ profile }) => {
  const expected = profile.level * LIFE_PER_LEVEL;
  if (profile.life === undefined) {
    return [
      {
        ruleId: "vida-desconocida",
        title: "Verificar la vida máxima del personaje",
        action: "El perfil no incluye la vida máxima. Anótala manualmente para poder evaluar tu supervivencia.",
        reason: `Sin el dato de vida no se puede evaluar si superas la heurística de ${LIFE_PER_LEVEL} por nivel.`,
        impactMetric: "vida",
        impactDescription: "Evaluación de supervivencia pendiente de datos (métrica parcial).",
        magnitude: "low",
        riskLevel: "low",
        riskDescription: "Solo es una corrección de datos.",
        mayLoseValuableMods: false,
        irreversible: false,
        priceNames: [],
        goalWeights: { ...BALANCED, survival: 0.8 },
        confidenceBase: "low",
        unverified: ["No verificado — falta la vida máxima del personaje en el perfil."],
      },
    ];
  }
  if (profile.life >= expected) return [];

  return [
    {
      ruleId: "vida-baja",
      title: "Subir la vida máxima",
      action: `Tienes ${profile.life} de vida a nivel ${profile.level} (heurística orientativa: ${expected}). Prioriza mods de "+vida máxima" en casco, pecho y cinturón.`,
      reason: `La heurística de ${LIFE_PER_LEVEL} de vida por nivel sugiere que estás por debajo de lo sostenible para tu nivel.`,
      impactMetric: "vida",
      impactDescription: "Impacto estimado en supervivencia (métrica parcial, basada en heurística no verificada).",
      magnitude: profile.life < expected * 0.7 ? "high" : "medium",
      riskLevel: "low",
      riskDescription: "Cambio incremental de equipo; sin riesgo relevante.",
      mayLoseValuableMods: true,
      irreversible: false,
      priceNames: [],
      goalWeights: { ...BALANCED, survival: 1.5, bossing: 1.2, damage: 0.5 },
      confidenceBase: "medium",
      unverified: ["No verificado — la heurística de vida por nivel es orientativa, no un dato oficial."],
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
];
