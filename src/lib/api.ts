import type { z } from "zod";
import type { CharacterProfile } from "@shared/domain.js";
import {
  MentorQueryResponseSchema,
  type MentorQueryRequest,
  type MentorQueryResponse,
} from "@shared/mentorQuery.js";
import {
  ApiErrorSchema,
  DemoCharacterResponseSchema,
  ExportBuildResponseSchema,
  GetCharacterResponseSchema,
  HealthResponseSchema,
  ImportBuildResponseSchema,
  ImportItemTextResponseSchema,
  JournalEntryResponseSchema,
  BuildMemoryEntryResponseSchema,
  CraftingKnowledgeResponseSchema,
  JournalResponseSchema,
  MarketPricesResponseSchema,
  MetaResponseSchema,
  RecommendationsResponseSchema,
  SaveCharacterResponseSchema,
  type DemoCharacterResponse,
  type ExportBuildRequest,
  type ExportBuildResponse,
  type GetCharacterResponse,
  type HealthResponse,
  type ImportBuildRequest,
  type ImportBuildResponse,
  type ImportItemTextRequest,
  type ImportItemTextResponse,
  type CreateJournalEntryRequest,
  type AbandonSessionRequest,
  type JournalEntryResponse,
  type BuildMemoryEntryResponse,
  type CraftingKnowledgeResponse,
  type CreateBuildMemoryEntryRequest,
  type UpdateBuildMemoryEntryRequest,
  type JournalResponse,
  type MarketPricesResponse,
  type MetaResponse,
  type RecommendationsRequest,
  type RecommendationsResponse,
  type UpdateJournalEntryRequest,
  type StartDecisionSessionRequest,
  type AddSessionConstraintRequest,
  type ReleaseSessionConstraintRequest,
  type AddSessionEvidenceRequest,
  type RecordSessionResultRequest,
  type PauseSessionRequest,
  type ReopenSessionRequest,
  type ReconcileSessionRequest,
} from "@shared/api.js";

type SaveCharacterResponse = z.infer<typeof SaveCharacterResponseSchema>;

/**
 * Cliente fetch tipado de la API de Exile Copilot.
 * Valida cada respuesta JSON con los esquemas zod compartidos.
 */

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly detail: string | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    status: number | null = null,
    detail?: string,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
    this.requestId = requestId;
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    const message = err.detail ? `${err.message}: ${err.detail}` : err.message;
    return err.status !== null && err.status >= 500 && err.requestId
      ? `${message} · Referencia ${err.requestId}`
      : message;
  }
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiRequestError(
      "El servidor devolvió una respuesta no JSON",
      res.status,
      undefined,
      res.headers.get("x-request-id") ?? undefined,
    );
  }
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiRequestError(
      "No se pudo conectar con el servidor. ¿Está el backend en marcha?",
    );
  }

  const body = await parseJsonSafe(res);

  if (!res.ok) {
    const apiError = ApiErrorSchema.safeParse(body);
    if (apiError.success) {
      throw new ApiRequestError(
        apiError.data.error,
        res.status,
        apiError.data.detail,
        apiError.data.requestId ?? res.headers.get("x-request-id") ?? undefined,
      );
    }
    throw new ApiRequestError(
      `Error del servidor (HTTP ${res.status})`,
      res.status,
      undefined,
      res.headers.get("x-request-id") ?? undefined,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("; ");
    throw new ApiRequestError(
      `Respuesta inesperada del servidor en ${path} — ${issues}`,
      res.status,
      undefined,
      res.headers.get("x-request-id") ?? undefined,
    );
  }
  return parsed.data;
}

function jsonInit(payload: unknown, method: "POST" | "PATCH" = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export const api = {
  health: (): Promise<HealthResponse> => request("/api/health", HealthResponseSchema),

  meta: (): Promise<MetaResponse> => request("/api/meta", MetaResponseSchema),

  importBuild: (payload: ImportBuildRequest): Promise<ImportBuildResponse> =>
    request("/api/import/build", ImportBuildResponseSchema, jsonInit(payload)),

  importItemText: (payload: ImportItemTextRequest): Promise<ImportItemTextResponse> =>
    request("/api/import/item-text", ImportItemTextResponseSchema, jsonInit(payload)),

  saveCharacter: (profile: CharacterProfile): Promise<SaveCharacterResponse> =>
    request("/api/character", SaveCharacterResponseSchema, jsonInit({ profile })),

  demoCharacter: (): Promise<DemoCharacterResponse> =>
    request("/api/character/demo", DemoCharacterResponseSchema),

  getCharacter: (id: string): Promise<GetCharacterResponse> =>
    request(`/api/character/${encodeURIComponent(id)}`, GetCharacterResponseSchema),

  journal: (characterId: string): Promise<JournalResponse> =>
    request(`/api/journal/${encodeURIComponent(characterId)}`, JournalResponseSchema),

  createJournalEntry: (
    characterId: string,
    payload: CreateJournalEntryRequest,
  ): Promise<JournalEntryResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/entries`,
      JournalEntryResponseSchema,
      jsonInit(payload),
    ),

  updateJournalEntry: (
    characterId: string,
    entryId: string,
    payload: UpdateJournalEntryRequest,
  ): Promise<JournalEntryResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/entries/${encodeURIComponent(entryId)}`,
      JournalEntryResponseSchema,
      jsonInit(payload, "PATCH"),
    ),

  createBuildMemoryEntry: (
    characterId: string,
    payload: CreateBuildMemoryEntryRequest,
  ): Promise<BuildMemoryEntryResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/build-memory`,
      BuildMemoryEntryResponseSchema,
      jsonInit(payload),
    ),

  updateBuildMemoryEntry: (
    characterId: string,
    entryId: string,
    payload: UpdateBuildMemoryEntryRequest,
  ): Promise<BuildMemoryEntryResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/build-memory/${encodeURIComponent(entryId)}`,
      BuildMemoryEntryResponseSchema,
      jsonInit(payload, "PATCH"),
    ),

  startDecisionSession: (
    characterId: string,
    payload: StartDecisionSessionRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  addSessionConstraint: (
    characterId: string,
    payload: AddSessionConstraintRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/constraints`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  releaseSessionConstraint: (
    characterId: string,
    payload: ReleaseSessionConstraintRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/constraints/release`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  addSessionEvidence: (
    characterId: string,
    payload: AddSessionEvidenceRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/evidence`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  recordSessionResult: (
    characterId: string,
    payload: RecordSessionResultRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/result`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  pauseSession: (
    characterId: string,
    payload: PauseSessionRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/pause`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  abandonSession: (
    characterId: string,
    payload: AbandonSessionRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/abandon`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  reopenSession: (
    characterId: string,
    payload: ReopenSessionRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/reopen`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  reconcileSession: (
    characterId: string,
    payload: ReconcileSessionRequest,
  ): Promise<JournalResponse> =>
    request(
      `/api/journal/${encodeURIComponent(characterId)}/session/reconcile`,
      JournalResponseSchema,
      jsonInit(payload),
    ),

  marketPrices: (
    league: string,
    names: string[],
    patch: string,
  ): Promise<MarketPricesResponse> => {
    const params = new URLSearchParams({ league, names: names.join(","), patch });
    return request(`/api/market/prices?${params.toString()}`, MarketPricesResponseSchema);
  },

  craftingKnowledge: (input: {
    itemClass?: string;
    baseType?: string;
    patch: string;
  }): Promise<CraftingKnowledgeResponse> => {
    const params = new URLSearchParams();
    if (input.itemClass) params.set("itemClass", input.itemClass);
    if (input.baseType) params.set("baseType", input.baseType);
    params.set("patch", input.patch);
    const query = params.toString();
    return request(
      `/api/crafting/knowledge${query ? `?${query}` : ""}`,
      CraftingKnowledgeResponseSchema,
    );
  },

  /** Conversación determinista con el mentor (Hito 6A). */
  mentorQuery: (payload: MentorQueryRequest): Promise<MentorQueryResponse> =>
    request("/api/mentor/query", MentorQueryResponseSchema, jsonInit(payload)),

  recommendations: (payload: RecommendationsRequest): Promise<RecommendationsResponse> =>
    request("/api/recommendations", RecommendationsResponseSchema, jsonInit(payload)),

  /**
   * Exporta la build al formato oficial GGG Build Planner v1.
   * La respuesta es JSON: { fileName, content, report }.
   * El archivo descargable se construye en el cliente con un Blob a partir de `content`.
   */
  exportBuild: (
    payload: ExportBuildRequest,
  ): Promise<ExportBuildResponse> =>
    request("/api/export/build", ExportBuildResponseSchema, jsonInit(payload)),
};
