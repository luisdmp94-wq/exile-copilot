/**
 * Selección de recomendaciones "ya aplicadas" para la exportación.
 *
 * Solo se exportan ids que (a) el usuario marcó y (b) existen en el resultado
 * VIGENTE: un id marcado en una generación anterior (ya invalidada) nunca debe
 * colarse en el archivo .build como "Mejora planificada".
 */
export function selectAppliedRecommendationIds(
  applied: Record<string, boolean>,
  currentRecommendations: ReadonlyArray<{ id: string }>,
): string[] {
  return currentRecommendations
    .filter((rec) => applied[rec.id] === true)
    .map((rec) => rec.id);
}
