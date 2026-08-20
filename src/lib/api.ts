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
  type JournalEntryResponse,
  type JournalResponse,
  type MarketPricesResponse,
  type MetaResponse,
  type RecommendationsRequest,
  type RecommendationsResponse,
  type UpdateJournalEntryRequest,
} from "@shared/api.js";

type SaveCharacterResponse = z.infer<typeof SaveCharacterResponseSchema>;

/**
 * Cliente fetch tipado de la API de Exile Copilot.
 * Valida cada respuesta JSON con los esquemas zod compartidos.
 */

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly detail: string | undefined;

  constructor(message: string, status: number | null = null, detail?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    return err.detail ? `${err.message}: ${err.detail}` : err.message;
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
    throw new ApiRequestError("El servidor devolvió una respuesta no JSON", res.status);
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
      throw new ApiRequestError(apiError.data.error, res.status, apiError.data.detail);
    }
    throw new ApiRequestError(`Error del servidor (HTTP ${res.status})`, res.status);
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

  marketPrices: (league: string, names: string[]): Promise<MarketPricesResponse> => {
    const params = new URLSearchParams({ league, names: names.join(",") });
    return request(`/api/market/prices?${params.toString()}`, MarketPricesResponseSchema);
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
