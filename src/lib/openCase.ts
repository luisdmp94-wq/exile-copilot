import type { JournalResponse } from "@shared/api.js";
import type { JournalEntry, Recommendation } from "@shared/domain.js";
import type { DecisionSession } from "@shared/decisionSession.js";
import { sessionIsOpen } from "@shared/decisionSession.js";

/**
 * Selección del contenido DOMINANTE del Caso Abierto (Fase Visual 1, §3).
 *
 * El Caso Abierto no guarda un segundo estado de negocio: mira el estado que ya
 * existe (sesión, diario, recomendaciones) y decide cuál de los cuatro
 * contenidos manda. Es una función pura para poder probar la jerarquía sin
 * montar la interfaz.
 */
export type OpenCaseKind =
  | "session"
  | "journal"
  | "recommendation"
  | "generate"
  | "welcome";

export interface OpenCaseSelection {
  kind: OpenCaseKind;
  /** Recomendación dominante; null salvo en `kind === "recommendation"`. */
  recommendation: Recommendation | null;
  /** Entrada dominante del diario; null salvo en `kind === "journal"`. */
  journalEntry: JournalEntry | null;
  /**
   * Ids de objeto del contenido dominante, para el paperdoll.
   *
   * Solo salen de un vínculo estructurado que YA existe en el dominio
   * (`Recommendation.relatedItemIds` o `JournalEntry.relatedItemIds`). Nunca se
   * deducen leyendo texto ni se inventa un campo nuevo para la sesión: cuando
   * el contenido dominante no tiene vínculo, la lista queda vacía.
   */
  relatedItemIds: string[];
  /**
   * Recomendaciones que NO dominan, en el mismo orden en que llegaron.
   * Alimentan «Otras posibilidades» sin duplicar la principal.
   */
  otherRecommendations: Recommendation[];
}

/**
 * Recomendación vigente: la de menor `priority`. Ante empate gana la primera
 * que devolvió el motor, que ya viene ordenada por su propia puntuación.
 */
function pickDominantRecommendation(
  recommendations: readonly Recommendation[],
): Recommendation | null {
  let best: Recommendation | null = null;
  for (const candidate of recommendations) {
    if (best === null || candidate.priority < best.priority) best = candidate;
  }
  return best;
}

/**
 * Vínculo estructurado de una sesión abierta: la sesión no tiene
 * `relatedItemIds` propios y no se le inventa uno. El único enlace inequívoco
 * que ya existe es su acción activa, que apunta a una entrada del diario; se
 * usan los ids de ESA entrada, o ninguno.
 */
function sessionRelatedItemIds(
  session: DecisionSession,
  entries: readonly JournalEntry[],
): string[] {
  const entryId = session.activeAction?.journalEntryId ?? null;
  if (entryId === null) return [];
  const entry = entries.find((candidate) => candidate.id === entryId);
  return entry ? [...entry.relatedItemIds] : [];
}

export function selectOpenCase(input: {
  hasProfile: boolean;
  journal: JournalResponse | null;
  recommendations: readonly Recommendation[];
}): OpenCaseSelection {
  const { hasProfile, journal, recommendations } = input;
  const empty: OpenCaseSelection = {
    kind: "welcome",
    recommendation: null,
    journalEntry: null,
    relatedItemIds: [],
    otherRecommendations: [],
  };

  if (!hasProfile) return empty;

  // 1. Sesión abierta. `completed` y `discarded` no dominan.
  const session = journal?.session ?? null;
  if (session !== null && sessionIsOpen(session.status)) {
    return {
      ...empty,
      kind: "session",
      relatedItemIds: sessionRelatedItemIds(session, journal?.entries ?? []),
      otherRecommendations: [...recommendations],
    };
  }

  // 2. Acción activa del diario. Una entrada sin `nextAction` no domina.
  const primary = journal?.primaryEntry ?? null;
  if (primary !== null && primary.nextAction !== null) {
    return {
      ...empty,
      kind: "journal",
      journalEntry: primary,
      relatedItemIds: [...primary.relatedItemIds],
      otherRecommendations: [...recommendations],
    };
  }

  // 3. Recomendación vigente.
  const dominant = pickDominantRecommendation(recommendations);
  if (dominant !== null) {
    return {
      ...empty,
      kind: "recommendation",
      recommendation: dominant,
      relatedItemIds: [...dominant.relatedItemIds],
      otherRecommendations: recommendations.filter((rec) => rec.id !== dominant.id),
    };
  }

  // 4. Sin recomendación vigente, pero con personaje cargado.
  return { ...empty, kind: "generate" };
}

/**
 * Aviso discreto de limitaciones (§6, nivel 1). Solo procede de
 * `Recommendation.unverified` o del `unverified` del snapshot de una entrada
 * del diario. Las sesiones usan sus propias incógnitas y evidencia, nunca esto.
 */
export function openCaseLimitations(selection: OpenCaseSelection): string[] {
  if (selection.kind === "recommendation") {
    return selection.recommendation?.unverified ?? [];
  }
  if (selection.kind === "journal") {
    return selection.journalEntry?.recommendationSnapshot?.unverified ?? [];
  }
  return [];
}
