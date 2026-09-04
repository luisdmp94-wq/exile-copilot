import { z } from "zod";
import { COACH_FOCUSES } from "@shared/craftingFocus.js";
import { ItemRequirementsSchema, ItemSchema } from "@shared/domain.js";

export const CRAFTING_COACH_PROGRESS_VERSION = "coach-contract-v2";
const STORAGE_PREFIX = "exile-copilot:crafting-coach:v2:";
const LEGACY_CONTENT_VERSION = "coach-contract-v1";
const LEGACY_STORAGE_PREFIX = "exile-copilot:crafting-coach:v1:";

export interface CraftingCoachIdentity {
  /** Evita que dos personajes con el mismo id local de objeto compartan contrato. */
  profileId?: string | null;
  itemId: string;
  baseType: string;
}

const IdentitySchema = z.object({
  profileId: z.string().min(1).max(200).nullable().optional(),
  itemId: z.string().min(1).max(200),
  baseType: z.string().min(1).max(240),
});

const PersistedItemSnapshotSchema = ItemSchema.extend({
  // Los perfiles creados por versiones anteriores podían serializar la ausencia
  // de requisitos como null. Al restaurar solo normalizamos esa ausencia; no
  // añadimos ni deducimos ningún requisito del objeto.
  requirements: z.preprocess(
    (value) => (value === null ? undefined : value),
    ItemRequirementsSchema.optional(),
  ),
});

export const CraftingCoachProgressSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.literal(CRAFTING_COACH_PROGRESS_VERSION),
  identity: IdentitySchema,
  direction: z.enum(["damage", "defence"]).nullable(),
  focus: z.enum(COACH_FOCUSES).nullable(),
  goalText: z.string().max(2_000),
  goalIntent: z.enum(["incremental", "unique-acquisition", "endgame-project"]),
  goalSource: z.enum(["player", "context"]),
  directionChosen: z.boolean(),
  directionNote: z.string().max(4_000).nullable(),
  protectedModifiers: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        text: z.string().min(1).max(1_000),
      }),
    )
    .max(32),
  unresolvedProtections: z.array(z.string().min(1).max(1_000)).max(32),
  rollMinimum: z.enum(["any", "middle", "high"]),
  attemptLimit: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  confirmedAttemptCount: z.number().int().min(0).max(3),
  noEvidence: z.boolean(),
  /**
   * Procedencia explícita de una pieza didáctica. Debe viajar con el snapshot:
   * si se pierde al recargar, una práctica podría parecer un objeto real y
   * autorizar un gasto que nunca ocurrió dentro de PoE2.
   */
  simulationMode: z.enum(["example", "practice"]).nullable().default(null),
  phase: z.enum(["choose", "recommend", "hold", "await-result", "result"]),
  pendingAttempt: z
    .object({
      before: PersistedItemSnapshotSchema,
      actionId: z.enum([
        "transmutation",
        "augmentation",
        "regal",
        "exalted",
        "essence",
        "alloy",
      ]),
      rollMinimum: z.enum(["any", "middle", "high"]),
      attemptNumber: z.number().int().min(1).max(3),
      attemptLimit: z.number().int().min(1).max(3),
    })
    .nullable(),
  workingItem: PersistedItemSnapshotSchema.nullable().default(null),
  resultItem: PersistedItemSnapshotSchema.nullable().default(null),
  resultText: z.string().max(100_000),
});

const LegacyCraftingCoachProgressSchema = CraftingCoachProgressSchema.extend({
  contentVersion: z.literal(LEGACY_CONTENT_VERSION),
  identity: z.object({
    itemId: z.string().min(1).max(200),
    baseType: z.string().min(1).max(240),
  }),
});

export type CraftingCoachProgress = z.infer<typeof CraftingCoachProgressSchema>;

/**
 * Una pieza didáctica nunca puede reanudar una fase que exige observar un
 * resultado dentro de PoE2. Repara contratos antiguos que se guardaron antes
 * de persistir la procedencia de simulación.
 */
export function protectSimulatedCraftingProgress(
  progress: CraftingCoachProgress,
  itemSimulationMode: "example" | null,
): CraftingCoachProgress {
  const simulationMode = progress.simulationMode === "practice"
    ? "practice" as const
    : itemSimulationMode;
  if (simulationMode === null) return progress;
  if (progress.phase !== "await-result" && progress.phase !== "result") {
    return { ...progress, simulationMode };
  }
  return {
    ...progress,
    simulationMode,
    phase: "recommend",
    pendingAttempt: null,
    resultItem: null,
    resultText: "",
    confirmedAttemptCount: 0,
  };
}

export function phaseAfterObservedResult(
  attemptNumber: number,
  attemptLimit: number,
): "hold" | "recommend" {
  return attemptNumber >= attemptLimit ? "hold" : "recommend";
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function storageKey(identity: CraftingCoachIdentity): string {
  const owner = identity.profileId ?? "sin-personaje";
  return `${STORAGE_PREFIX}${encodeURIComponent(owner)}:${encodeURIComponent(identity.itemId)}`;
}

function legacyStorageKey(itemId: string): string {
  return `${LEGACY_STORAGE_PREFIX}${encodeURIComponent(itemId)}`;
}

function normalizeProgress(progress: CraftingCoachProgress): CraftingCoachProgress {
  const confirmedAttemptCount = Math.min(
    progress.confirmedAttemptCount,
    progress.attemptLimit,
  );
  const pendingAttempt = progress.pendingAttempt === null
    ? null
    : {
        ...progress.pendingAttempt,
        attemptNumber: Math.min(
          progress.pendingAttempt.attemptNumber,
          progress.pendingAttempt.attemptLimit,
        ),
      };
  const phase =
    progress.phase === "recommend" && confirmedAttemptCount >= progress.attemptLimit
      ? "hold"
      : progress.phase;
  const isLegacyUncommittedSubstitution =
    progress.simulationMode === null &&
    progress.workingItem !== null &&
    progress.workingItem.baseType !== progress.identity.baseType &&
    progress.confirmedAttemptCount === 0 &&
    progress.pendingAttempt === null &&
    progress.resultItem === null;
  const simulationMode = isLegacyUncommittedSubstitution
    ? "practice" as const
    : progress.simulationMode;
  return {
    ...progress,
    confirmedAttemptCount,
    pendingAttempt,
    phase,
    simulationMode,
  };
}

export function emptyCraftingCoachProgress(
  identity: CraftingCoachIdentity,
): CraftingCoachProgress {
  return {
    schemaVersion: 1,
    contentVersion: CRAFTING_COACH_PROGRESS_VERSION,
    identity,
    direction: null,
    focus: null,
    goalText: "",
    goalIntent: "incremental",
    goalSource: "player",
    directionChosen: false,
    directionNote: null,
    protectedModifiers: [],
    unresolvedProtections: [],
    rollMinimum: "middle",
    attemptLimit: 1,
    confirmedAttemptCount: 0,
    noEvidence: false,
    simulationMode: null,
    phase: "choose",
    pendingAttempt: null,
    workingItem: null,
    resultItem: null,
    resultText: "",
  };
}

export function discardCraftingCoachProgress(
  identity: CraftingCoachIdentity,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey(identity));
  } catch {
    // El Coach sigue siendo utilizable aunque el almacenamiento esté bloqueado.
  }
}

export function loadCraftingCoachProgress(
  identity: CraftingCoachIdentity,
  storage: StorageLike | null = defaultStorage(),
): CraftingCoachProgress | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(identity));
  } catch {
    return null;
  }
  if (raw === null) {
    // Migración única del contrato anterior. El v1 no conocía al personaje,
    // pero sí la identidad exacta de la pieza; solo se adopta al abrir esa
    // misma pieza y se retira entonces para que otro perfil no pueda heredarlo.
    let legacyRaw: string | null = null;
    try {
      legacyRaw = storage.getItem(legacyStorageKey(identity.itemId));
    } catch {
      return null;
    }
    if (legacyRaw === null) return null;
    try {
      const legacy = LegacyCraftingCoachProgressSchema.safeParse(JSON.parse(legacyRaw));
      if (
        !legacy.success ||
        legacy.data.identity.itemId !== identity.itemId ||
        legacy.data.identity.baseType !== identity.baseType
      ) {
        return null;
      }
      const migrated = normalizeProgress({
        ...legacy.data,
        contentVersion: CRAFTING_COACH_PROGRESS_VERSION,
        identity,
      });
      if (!saveCraftingCoachProgress(migrated, storage)) return null;
      storage.removeItem(legacyStorageKey(identity.itemId));
      return migrated;
    } catch {
      return null;
    }
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    discardCraftingCoachProgress(identity, storage);
    return null;
  }
  const parsed = CraftingCoachProgressSchema.safeParse(decoded);
  if (!parsed.success) {
    discardCraftingCoachProgress(identity, storage);
    return null;
  }
  if (
    parsed.data.identity.itemId !== identity.itemId ||
    parsed.data.identity.baseType !== identity.baseType ||
    (parsed.data.identity.profileId ?? null) !== (identity.profileId ?? null)
  ) {
    return null;
  }
  if (parsed.data.phase === "await-result" && parsed.data.pendingAttempt === null) {
    discardCraftingCoachProgress(identity, storage);
    return null;
  }
  if (
    parsed.data.phase === "result" &&
    (parsed.data.pendingAttempt === null || parsed.data.resultItem === null)
  ) {
    discardCraftingCoachProgress(identity, storage);
    return null;
  }
  return normalizeProgress(parsed.data);
}

export function saveCraftingCoachProgress(
  progress: CraftingCoachProgress,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(progress.identity), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
