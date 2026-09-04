export function craftingLaboratoryRouteLabel(input: {
  diagnosisState: "complete" | "partial" | "blocked";
  objectiveReady: boolean;
  successCriteriaReady: boolean;
  stopAlreadyReached: boolean;
}): "Bloqueada" | "Parar" | "Lista" | "Después" {
  if (input.diagnosisState !== "complete") return "Bloqueada";
  if (input.stopAlreadyReached) return "Parar";
  return input.objectiveReady && input.successCriteriaReady ? "Lista" : "Después";
}
