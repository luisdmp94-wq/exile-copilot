import type { BuildTarget } from "@shared/domain.js";
import type { TargetDraft } from "@/sections/TargetSection";

/**
 * Convierte el borrador de la sección «Build objetivo» en un BuildTarget.
 * Devuelve undefined si el borrador está completamente vacío.
 */
export function buildTargetFromDraft(draft: TargetDraft): BuildTarget | undefined {
  const desiredMods = draft.desiredModsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const hasContent =
    draft.name.trim().length > 0 ||
    draft.sourceUrl.trim().length > 0 ||
    draft.summary.trim().length > 0 ||
    desiredMods.length > 0;
  if (!hasContent) return undefined;
  return {
    name: draft.name.trim() || "Build objetivo",
    sourceUrl: draft.sourceUrl.trim() || undefined,
    summary: draft.summary.trim() || undefined,
    desiredMods,
    referenceOnly: true,
  };
}
