/**
 * Selección de recomendaciones "ya aplicadas" para la exportación.
 *
 * Solo se exportan ids que (a) el usuario marcó y (b) existen en el resultado
 * VIGENTE: un id marcado en una generación anterior (ya invalidada) nunca debe
 * colarse en el archivo .build como "Mejora planificada".
 */
export function selectAppliedRecommendationIds(
  applied: Record<string, boolean>,
  currentRecommendations: ReadonlyArray<{
    id: string;
    actionKind?: "game_change" | "profile_sync" | "session_gate";
  }>,
): string[] {
  return currentRecommendations
    .filter(
      (rec) =>
        applied[rec.id] === true && rec.actionKind !== "profile_sync" && rec.actionKind !== "session_gate",
    )
    .map((rec) => rec.id);
}
