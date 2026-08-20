import {
  RecommendationMemorySchema,
  type CharacterJournal,
  type JournalEntry,
  type RecommendationMemory,
  type RecommendationMemoryEntry,
} from "./domain.js";

const MAX_COMPLETED_ENTRIES = 10;

/** Hash FNV-1a de 64 bits: no es criptográfico ni se usa para seguridad; solo
 * crea una revisión síncrona y estable en navegador/servidor. */
function revisionHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function toMemoryEntry(entry: JournalEntry): RecommendationMemoryEntry {
  return {
    entryId: entry.id,
    status: entry.status,
    title: entry.title,
    nextAction: entry.nextAction,
    result: entry.result,
    recommendationId: entry.recommendationSnapshot?.id ?? null,
    relatedItemIds: entry.relatedItemIds,
    updatedAt: entry.updatedAt,
    patch: entry.context.patch,
  };
}

/**
 * Proyecta el diario completo a un contexto pequeño y determinista. Solo se
 * incluyen resultados explícitos del jugador; el texto no se analiza.
 */
export function buildRecommendationMemory(
  journal: CharacterJournal,
): RecommendationMemory {
  const primaryEntry = journal.primaryEntry
    ? toMemoryEntry(journal.primaryEntry)
    : null;
  const recentCompleted = journal.entries
    .filter(
      (entry) =>
        entry.status === "completed" &&
        entry.result !== null &&
        entry.recommendationSnapshot?.actionKind === "game_change",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_COMPLETED_ENTRIES)
    .map(toMemoryEntry);

  const revisionPayload = JSON.stringify({ primaryEntry, recentCompleted });

  return RecommendationMemorySchema.parse({
    revision: `journal-memory-v1:${revisionHash(revisionPayload)}`,
    primaryEntry,
    recentCompleted,
  });
}
