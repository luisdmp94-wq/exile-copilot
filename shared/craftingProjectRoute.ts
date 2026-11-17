export function craftingLaboratoryRouteLabel(input: {
  diagnosisState: "complete" | "partial" | "blocked";
  objectiveReady: boolean;
  successCriteriaReady: boolean;
  stopAlreadyReached: boolean;
}, lang: "es" | "en" = "es"):
  | "Bloqueada" | "Parar" | "Lista" | "Después"
  | "Blocked" | "Stop" | "Ready" | "Later" {
  const en = lang === "en";
  if (input.diagnosisState !== "complete") return en ? "Blocked" : "Bloqueada";
  if (input.stopAlreadyReached) return en ? "Stop" : "Parar";
  return input.objectiveReady && input.successCriteriaReady
    ? en ? "Ready" : "Lista"
    : en ? "Later" : "Después";
}
