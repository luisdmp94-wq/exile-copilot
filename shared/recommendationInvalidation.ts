/**
 * Distingue una invalidación real de la transición normal «guardar este mismo
 * consejo como siguiente paso».
 *
 * Guardar el consejo cambia la revisión del diario y, por tanto, la huella de
 * la petición. Eso obliga a retirar el lote anterior, pero no significa que el
 * personaje, el objetivo o el presupuesto hayan cambiado. La interfaz puede
 * cerrar el lote en silencio y conservar el mensaje honesto de seguimiento.
 */
export function journalNowTracksVisibleRecommendation(
  result: { recommendations: readonly { id: string }[] } | null,
  journal: {
    primaryEntry: {
      recommendationSnapshot: { id: string } | null;
    } | null;
  } | null,
): boolean {
  const trackedId = journal?.primaryEntry?.recommendationSnapshot?.id;
  return Boolean(
    trackedId &&
      result?.recommendations.some(
        (recommendation) => recommendation.id === trackedId,
      ),
  );
}
