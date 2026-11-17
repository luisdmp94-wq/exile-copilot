import type { CharacterProfile, Item } from "./domain.js";
import type { CoachFocus } from "./craftingFocus.js";

export interface VisibleWeaponPerformance {
  physicalDps: number;
  elementalDps: number;
  totalDps: number;
  fireDps: number;
  coldDps: number;
  lightningDps: number;
  chaosDps: number;
  attacksPerSecond: number;
  criticalChance: number | null;
  reloadTime: number | null;
}

export interface WeaponMetricComparison {
  label: string;
  /** La misma métrica sin el matiz «visible», para etiquetas compactas. */
  shortLabel: string;
  before: number;
  after: number;
  delta: number;
  percent: number | null;
  outcome: "higher" | "equal" | "lower";
}

export interface CraftingWeaponPerformance {
  candidate: VisibleWeaponPerformance;
  craftDelta: WeaponMetricComparison;
  focusComparison: WeaponMetricComparison | null;
  baselineLabel: string;
  comparedToEquipped: boolean;
  limitation: string;
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function average(range: { min: number; max: number } | undefined): number {
  return range === undefined ? 0 : (range.min + range.max) / 2;
}

/**
 * Calcula únicamente el rendimiento que ya aparece en el tooltip del arma.
 * No aplica crítico, pasivas, gemas, buffs ni hipótesis sobre la recarga.
 */
export function calculateVisibleWeaponPerformance(
  item: Item,
): VisibleWeaponPerformance | null {
  const stats = item.weaponStats;
  if (!stats?.attacksPerSecond) return null;
  const hasDamage = Boolean(
    stats.physical || stats.fire || stats.cold || stats.lightning || stats.chaos,
  );
  if (!hasDamage) return null;

  const speed = stats.attacksPerSecond;
  const physicalDps = average(stats.physical) * speed;
  const fireDps = average(stats.fire) * speed;
  const coldDps = average(stats.cold) * speed;
  const lightningDps = average(stats.lightning) * speed;
  const chaosDps = average(stats.chaos) * speed;
  const elementalDps = fireDps + coldDps + lightningDps;

  return {
    physicalDps: rounded(physicalDps),
    elementalDps: rounded(elementalDps),
    totalDps: rounded(physicalDps + elementalDps + chaosDps),
    fireDps: rounded(fireDps),
    coldDps: rounded(coldDps),
    lightningDps: rounded(lightningDps),
    chaosDps: rounded(chaosDps),
    attacksPerSecond: speed,
    criticalChance: stats.criticalChance ?? null,
    reloadTime: stats.reloadTime ?? null,
  };
}

function compareMetric(
  label: string,
  before: number,
  after: number,
  shortLabel: string = label,
): WeaponMetricComparison {
  const delta = rounded(after - before);
  return {
    label,
    shortLabel,
    before: rounded(before),
    after: rounded(after),
    delta,
    percent: before === 0 ? null : rounded((delta / before) * 100),
    outcome: Math.abs(delta) < 0.05 ? "equal" : delta > 0 ? "higher" : "lower",
  };
}

function focusMetric(
  focus: CoachFocus | null,
  performance: VisibleWeaponPerformance,
  lang: "es" | "en",
): { label: string; shortLabel: string; value: number } | null {
  const en = lang === "en";
  const metric = (es: string, esShort: string, english: string, englishShort: string, value: number) =>
    en
      ? { label: english, shortLabel: englishShort, value }
      : { label: es, shortLabel: esShort, value };
  switch (focus) {
    case "physical":
      return metric("DPS físico visible", "DPS físico", "visible physical DPS", "physical DPS", performance.physicalDps);
    case "fire":
      return metric("DPS de fuego visible", "DPS de fuego", "visible fire DPS", "fire DPS", performance.fireDps);
    case "cold":
      return metric("DPS de hielo visible", "DPS de hielo", "visible cold DPS", "cold DPS", performance.coldDps);
    case "lightning":
      return metric("DPS de rayo visible", "DPS de rayo", "visible lightning DPS", "lightning DPS", performance.lightningDps);
    case "chaos":
      return metric("DPS de caos visible", "DPS de caos", "visible chaos DPS", "chaos DPS", performance.chaosDps);
    case "attack-speed":
      return metric("ataques por segundo", "ataques por segundo", "attacks per second", "attacks per second", performance.attacksPerSecond);
    case "critical":
      return performance.criticalChance === null
        ? null
        : metric(
            "probabilidad de crítico visible",
            "probabilidad de crítico",
            "visible critical hit chance",
            "critical hit chance",
            performance.criticalChance,
          );
    default:
      return null;
  }
}

function equippedBaseline(
  profile: CharacterProfile | null,
  originalItem: Item,
): { item: Item; linked: boolean } | null {
  if (profile === null) return null;
  const originalIsEquipped = profile.items.some(
    (item) => item.id === originalItem.id && item.slot === originalItem.slot,
  );
  if (originalIsEquipped) return { item: originalItem, linked: true };
  const equippedWeapon = profile.items.find(
    (item) => item.slot === "weapon" && item.id !== originalItem.id && item.weaponStats !== undefined,
  );
  return equippedWeapon ? { item: equippedWeapon, linked: true } : null;
}

export function evaluateCraftingWeaponPerformance(input: {
  originalItem: Item;
  resultItem: Item;
  profile: CharacterProfile | null;
  focus: CoachFocus | null;
}, lang: "es" | "en" = "es"): CraftingWeaponPerformance | null {
  const en = lang === "en";
  const { originalItem, resultItem, profile, focus } = input;
  if (resultItem.slot !== "weapon") return null;
  const candidate = calculateVisibleWeaponPerformance(resultItem);
  const beforeCraft = calculateVisibleWeaponPerformance(originalItem);
  if (candidate === null || beforeCraft === null) return null;

  const equipped = equippedBaseline(profile, originalItem);
  const equippedPerformance = equipped
    ? calculateVisibleWeaponPerformance(equipped.item)
    : null;
  const baseline = equippedPerformance ?? beforeCraft;
  const baselineLabel = equippedPerformance
    ? equipped?.item.name || equipped?.item.baseType || (en ? "your equipped weapon" : "arma equipada")
    : en
      ? "the item before the craft"
      : "la pieza antes del craft";
  const beforeFocus = focusMetric(focus, baseline, lang);
  const afterFocus = focusMetric(focus, candidate, lang);

  return {
    candidate,
    craftDelta: compareMetric(
      en ? "total visible DPS" : "DPS visible total",
      beforeCraft.totalDps,
      candidate.totalDps,
      en ? "total DPS" : "DPS total",
    ),
    focusComparison:
      beforeFocus && afterFocus && beforeFocus.label === afterFocus.label
        ? compareMetric(afterFocus.label, beforeFocus.value, afterFocus.value, afterFocus.shortLabel)
        : null,
    baselineLabel,
    comparedToEquipped: equippedPerformance !== null,
    limitation: en
      ? "Doesn't include passives, gems, effective critical damage, buffs or the effect of reload time."
      : "No incluye pasivas, gemas, daño crítico efectivo, buffs ni el efecto del tiempo de recarga.",
  };
}
