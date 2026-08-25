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

function compareMetric(label: string, before: number, after: number): WeaponMetricComparison {
  const delta = rounded(after - before);
  return {
    label,
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
): { label: string; value: number } | null {
  switch (focus) {
    case "physical":
      return { label: "DPS físico visible", value: performance.physicalDps };
    case "fire":
      return { label: "DPS de fuego visible", value: performance.fireDps };
    case "cold":
      return { label: "DPS de hielo visible", value: performance.coldDps };
    case "lightning":
      return { label: "DPS de rayo visible", value: performance.lightningDps };
    case "chaos":
      return { label: "DPS de caos visible", value: performance.chaosDps };
    case "attack-speed":
      return { label: "ataques por segundo", value: performance.attacksPerSecond };
    case "critical":
      return performance.criticalChance === null
        ? null
        : { label: "probabilidad de crítico visible", value: performance.criticalChance };
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
}): CraftingWeaponPerformance | null {
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
    ? equipped?.item.name || equipped?.item.baseType || "arma equipada"
    : "la pieza antes del craft";
  const beforeFocus = focusMetric(focus, baseline);
  const afterFocus = focusMetric(focus, candidate);

  return {
    candidate,
    craftDelta: compareMetric("DPS visible total", beforeCraft.totalDps, candidate.totalDps),
    focusComparison:
      beforeFocus && afterFocus && beforeFocus.label === afterFocus.label
        ? compareMetric(afterFocus.label, beforeFocus.value, afterFocus.value)
        : null,
    baselineLabel,
    comparedToEquipped: equippedPerformance !== null,
    limitation:
      "No incluye pasivas, gemas, daño crítico efectivo, buffs ni el efecto del tiempo de recarga.",
  };
}
