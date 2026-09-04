import { z } from "zod";

export const PlayerWalkthroughRoleSchema = z.enum([
  "new-player",
  "expert-player",
]);
export type PlayerWalkthroughRole = z.infer<typeof PlayerWalkthroughRoleSchema>;

export const PLAYER_WALKTHROUGH_ARTIFACT_VERSION =
  "EC-PLAYER-WALKTHROUGH-1";

export const PlayerWalkthroughCheckpointsSchema = z.object({
  foundStartingAction: z.boolean(),
  importedGameItem: z.boolean(),
  understoodInGameBoundary: z.boolean(),
  returnedObservedResult: z.boolean(),
  explainedStopDecision: z.boolean(),
});
export type PlayerWalkthroughCheckpoints = z.infer<
  typeof PlayerWalkthroughCheckpointsSchema
>;

export const PLAYER_WALKTHROUGH_CHECKPOINT_KEYS = [
  "foundStartingAction",
  "importedGameItem",
  "understoodInGameBoundary",
  "returnedObservedResult",
  "explainedStopDecision",
] as const satisfies readonly (keyof PlayerWalkthroughCheckpoints)[];

export const PLAYER_WALKTHROUGH_CHECKPOINT_LABELS: Record<
  keyof PlayerWalkthroughCheckpoints,
  string
> = {
  foundStartingAction: "Encontró la primera acción sin ayuda",
  importedGameItem: "Importó un objeto real del juego",
  understoodInGameBoundary: "Entendió que el craft ocurre dentro de PoE2",
  returnedObservedResult: "Pegó de vuelta el resultado observado",
  explainedStopDecision: "Explicó la decisión de continuar o parar",
};

export const PlayerWalkthroughRecordSchema = z.object({
  id: z.string().min(1),
  role: PlayerWalkthroughRoleSchema,
  patch: z.string().min(1),
  locale: z.string().min(2),
  observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outcome: z.enum(["pass", "blocked"]),
  checkpoints: PlayerWalkthroughCheckpointsSchema,
  blockers: z.array(z.string().min(1)),
  artifactPath: z.string().min(1),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PlayerWalkthroughRecord = z.infer<
  typeof PlayerWalkthroughRecordSchema
>;

export const PlayerWalkthroughManifestSchema = z.object({
  schemaVersion: z.literal(1),
  runs: z.array(PlayerWalkthroughRecordSchema),
});
export type PlayerWalkthroughManifest = z.infer<
  typeof PlayerWalkthroughManifestSchema
>;

export interface AuditedPlayerWalkthrough extends PlayerWalkthroughRecord {
  artifactVerified: boolean;
  artifactIssue: string | null;
}

export interface PlayerWalkthroughAudit {
  schemaVersion: 1;
  issues: string[];
  runs: AuditedPlayerWalkthrough[];
}

export const REQUIRED_PLAYER_WALKTHROUGH_ROLES =
  PlayerWalkthroughRoleSchema.options;

export const PLAYER_WALKTHROUGH_ROLE_LABELS: Record<
  PlayerWalkthroughRole,
  string
> = {
  "new-player": "jugador nuevo",
  "expert-player": "jugador experto",
};

export function walkthroughCheckpointsPassed(
  checkpoints: PlayerWalkthroughCheckpoints,
): boolean {
  return Object.values(checkpoints).every(Boolean);
}

export const PlayerWalkthroughArtifactInputSchema = z
  .object({
    role: PlayerWalkthroughRoleSchema,
    patch: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    locale: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    outcome: z.enum(["pass", "blocked"]),
    checkpoints: PlayerWalkthroughCheckpointsSchema,
    blockers: z.array(z.string().trim().min(1)),
    observations: z.array(z.string().trim().min(12)).min(3),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.outcome === "pass") {
      if (!walkthroughCheckpointsPassed(input.checkpoints)) {
        context.addIssue({
          code: "custom",
          message: "Un recorrido aprobado debe completar los cinco puntos.",
          path: ["checkpoints"],
        });
      }
      if (input.blockers.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Un recorrido aprobado no puede declarar bloqueos.",
          path: ["blockers"],
        });
      }
    } else if (input.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Un recorrido bloqueado debe describir al menos un bloqueo.",
        path: ["blockers"],
      });
    }
  });
export type PlayerWalkthroughArtifactInput = z.infer<
  typeof PlayerWalkthroughArtifactInputSchema
>;

export const PlayerWalkthroughSubmissionSchema = z
  .object({ id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/) })
  .and(PlayerWalkthroughArtifactInputSchema);
export type PlayerWalkthroughSubmission = z.infer<
  typeof PlayerWalkthroughSubmissionSchema
>;

/**
 * Formato humano y determinista que después vuelve a auditarse. La huella
 * protege los bytes; estas claves permiten demostrar qué contienen.
 */
export function buildPlayerWalkthroughArtifact(
  input: PlayerWalkthroughArtifactInput,
): string {
  return [
    "EXILE COPILOT — RECORRIDO REAL",
    `Formato: ${PLAYER_WALKTHROUGH_ARTIFACT_VERSION}`,
    `Rol: ${input.role}`,
    `Parche: ${input.patch}`,
    `Idioma: ${input.locale}`,
    `Fecha: ${input.observedAt}`,
    `Resultado: ${input.outcome}`,
    "",
    "PUNTOS COMPROBADOS",
    ...PLAYER_WALKTHROUGH_CHECKPOINT_KEYS.map(
      (key) =>
        `- [${input.checkpoints[key] ? "x" : " "}] ${key} · ${PLAYER_WALKTHROUGH_CHECKPOINT_LABELS[key]}`,
    ),
    "",
    "BLOQUEOS",
    ...(input.blockers.length > 0
      ? input.blockers.map((blocker) => `- ${blocker}`)
      : ["- Ninguno"]),
    "",
    "OBSERVACIONES",
    ...input.observations.map((observation) => `- ${observation}`),
  ].join("\n");
}
