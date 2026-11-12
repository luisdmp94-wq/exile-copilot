import type { ServerConfig } from "../config.js";

/**
 * Llamada mínima a la IA para los consejos de gemas: manda unas instrucciones
 * y un objeto con datos, y espera un objeto JSON. Reutiliza el proveedor, el
 * modelo y la clave del Mentor. Devuelve null si la IA no está configurada.
 */
export type AdviceJsonCall = (instructions: string, payload: unknown, maxTokens: number) => Promise<unknown>;

export function createAdviceJsonCall(config: ServerConfig, fetchImpl: typeof fetch = fetch): AdviceJsonCall | null {
  const apiKey = config.mentorAiApiKey;
  if (!config.mentorAiEnabled || !apiKey) return null;
  const endpoint =
    config.mentorAiProvider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

  return async (instructions, payload, maxTokens) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.mentorAiTimeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.mentorAiModel,
          max_completion_tokens: maxTokens,
          reasoning_effort: config.mentorAiReasoningEffort,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: JSON.stringify(payload) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`el proveedor respondió ${response.status}`);
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
      return JSON.parse(body.choices?.[0]?.message?.content ?? "") as unknown;
    } finally {
      clearTimeout(timeout);
    }
  };
}

/** Texto plano y corto: lo que escribe la IA nunca se interpreta como HTML ni se alarga. */
export function cleanAiText(value: string, max = 400): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function aiFailureReason(error: unknown): string {
  return error instanceof Error && error.name === "AbortError"
    ? "La IA tardó demasiado; se usaron las reglas."
    : "La IA no dio una respuesta válida; se usaron las reglas.";
}
