import {
  CRAFTING_GOAL_LABELS,
  evaluateCraftingGoalSignal,
  type CraftingGoalCategory,
} from "./craftingGoal.js";
import type { Item, Modifier } from "./domain.js";
import {
  assessObservedModifierRoll,
  type ObservedModifierRollQuality,
} from "./craftingRollQuality.js";

export type AffixAssessmentKind =
  | "protect-first"
  | "goal-aligned"
  | "review-fit"
  | "contextual";

export interface CraftingAffixAssessmentEntry {
  modifier: Modifier;
  kind: AffixAssessmentKind;
  protected: boolean;
  label: string;
  reason: string;
  matchedTags: string[];
  rollQuality: ObservedModifierRollQuality;
}

export interface CraftingAffixCluster {
  tag: string;
  count: number;
}

export interface CraftingAffixAssessment {
  headline: string;
  summary: string;
  alignedCount: number;
  leadingAlignedCount: number;
  protectedCount: number;
  unknownTierCount: number;
  clusters: CraftingAffixCluster[];
  entries: CraftingAffixAssessmentEntry[];
  limitations: string[];
}

const GENERIC_CLUSTER_TAGS = new Set([
  "damage",
  "daño",
  "attack",
  "ataque",
  "defence",
  "defensa",
  "defences",
  "defensas",
]);

function normalized(tag: string): string {
  return tag.trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
}

function displayTag(tag: string): string {
  const clean = tag.trim();
  if (!clean) return clean;
  return clean.charAt(0).toLocaleUpperCase("es") + clean.slice(1);
}

function assessModifier(
  modifier: Modifier,
  goalCategory: CraftingGoalCategory,
  protectedIds: ReadonlySet<string>,
): CraftingAffixAssessmentEntry {
  const signal = evaluateCraftingGoalSignal(goalCategory, [modifier]);
  const leadingGrade = modifier.tier !== undefined && modifier.tier <= 2;
  const protectedModifier = protectedIds.has(modifier.id);
  const rollQuality = assessObservedModifierRoll(modifier);

  if (signal.status === "direct" && leadingGrade) {
    return {
      modifier,
      kind: "protect-first",
      protected: protectedModifier,
      label: "Protege primero",
      reason: `Coincide con el objetivo y el juego muestra grado ${modifier.tier}.`,
      matchedTags: signal.matchedTags,
      rollQuality,
    };
  }

  if (signal.status === "direct") {
    return {
      modifier,
      kind: "goal-aligned",
      protected: protectedModifier,
      label: "Aporta al objetivo",
      reason:
        modifier.tier === undefined
          ? "Sus etiquetas coinciden, pero el grado no está disponible."
          : `Sus etiquetas coinciden; el juego muestra grado ${modifier.tier}.`,
      matchedTags: signal.matchedTags,
      rollQuality,
    };
  }

  if (leadingGrade) {
    return {
      modifier,
      kind: "review-fit",
      protected: protectedModifier,
      label: "Revisa su encaje",
      reason: `El juego muestra grado ${modifier.tier}, pero sus etiquetas no coinciden directamente con este objetivo.`,
      matchedTags: [],
      rollQuality,
    };
  }

  return {
    modifier,
    kind: "contextual",
    protected: protectedModifier,
    label: "Depende de la build",
    reason:
      signal.status === "unknown"
        ? "El texto no aporta etiquetas suficientes para clasificarlo."
        : "No hay coincidencia literal; puede existir una interacción indirecta.",
    matchedTags: [],
    rollQuality,
  };
}

/**
 * Lectura del objeto observado, no del pool posible. Cruza exclusivamente el
 * grado y las etiquetas que el propio texto avanzado expone con el objetivo
 * elegido. Sitúa la tirada únicamente dentro del rango que imprime el juego;
 * no estima DPS, calidad frente al pool global, precio, peso ni probabilidad.
 */
export function assessCraftingAffixes(
  item: Item,
  goalCategory: CraftingGoalCategory,
  protectedModifierIds: readonly string[] = [],
): CraftingAffixAssessment {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const protectedIds = new Set(protectedModifierIds);
  const entries = explicit.map((modifier) =>
    assessModifier(modifier, goalCategory, protectedIds),
  );
  const aligned = entries.filter(
    (entry) => entry.kind === "protect-first" || entry.kind === "goal-aligned",
  );
  const leadingAlignedCount = aligned.filter(
    (entry) => entry.kind === "protect-first",
  ).length;
  const unknownTierCount = explicit.filter((modifier) => modifier.tier === undefined).length;

  const firstDisplayByNormalizedTag = new Map<string, string>();
  const clusterCounts = new Map<string, number>();
  for (const entry of aligned) {
    const uniqueTags = new Set((entry.modifier.tags ?? []).map(normalized).filter(Boolean));
    for (const tag of uniqueTags) {
      if (GENERIC_CLUSTER_TAGS.has(tag)) continue;
      firstDisplayByNormalizedTag.set(
        tag,
        firstDisplayByNormalizedTag.get(tag) ??
          entry.modifier.tags?.find((candidate) => normalized(candidate) === tag) ??
          tag,
      );
      clusterCounts.set(tag, (clusterCounts.get(tag) ?? 0) + 1);
    }
  }
  const clusters = [...clusterCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([tag, count]) => ({
      tag: displayTag(firstDisplayByNormalizedTag.get(tag) ?? tag),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag, "es"))
    .slice(0, 3);

  const goalLabel = CRAFTING_GOAL_LABELS[goalCategory].toLocaleLowerCase("es");
  let headline = "Define qué quieres conseguir";
  let summary = "La pieza se puede leer, pero falta una categoría para valorar su dirección.";
  if (goalCategory !== "other" && aligned.length === 0) {
    headline = `Sin núcleo directo de ${goalLabel}`;
    summary =
      "Ningún afijo aporta etiquetas literales del objetivo. Esto no demuestra que la pieza sea inútil.";
  } else if (goalCategory !== "other" && aligned.length === 1) {
    headline = `1 afijo apunta a ${goalLabel}`;
    summary = "Hay una señal aislada; el resto necesita contexto de la build antes de gastar más.";
  } else if (goalCategory !== "other") {
    headline = `${aligned.length} afijos apuntan a ${goalLabel}`;
    summary =
      clusters.length > 0
        ? "Hay varias señales que convergen en la misma dirección observable."
        : "Hay varias coincidencias con el objetivo, aunque no comparten una etiqueta específica adicional.";
  }

  return {
    headline,
    summary,
    alignedCount: aligned.length,
    leadingAlignedCount,
    protectedCount: entries.filter((entry) => entry.protected).length,
    unknownTierCount,
    clusters,
    entries,
    limitations: [
      "El grado mostrado no mide por sí solo el valor del afijo para esta build.",
      "Sin un pool completo no se calculan pesos ni probabilidades.",
      "La coincidencia de etiquetas no sustituye una medición de daño o defensa.",
    ],
  };
}
