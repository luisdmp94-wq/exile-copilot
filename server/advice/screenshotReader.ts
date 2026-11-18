import type { ServerConfig } from "../config.js";
import {
  ScreenshotReadResponseSchema,
  tidySkillName,
  type ScreenshotReadResponse,
} from "../../shared/screenshotRead.js";

/**
 * Lee una captura del juego con el modelo de imagen del proveedor de la IA
 * (Groq por defecto). Devuelve solo números y nombres validados; si la IA
 * devuelve algo raro, falla y la web pide rellenar a mano.
 */
export type ScreenshotReader = (imageDataUrl: string) => Promise<ScreenshotReadResponse>;

const INSTRUCTIONS = `You read a screenshot from the game Path of Exile 2 (the client may be in Spanish or English).
Decide which screen it is:
- "character": the character sheet (Personaje / Character) with level, life, energy shield, mana, spirit, attributes and resistances.
- "skills": the skills window (Habilidades / Skills) listing skill gems with their level ("Nivel" / "Level").
- "other": anything else.
Return ONLY a JSON object, no markdown:
{"screen": "character"|"skills"|"other",
 "sheet": {"level", "className", "life", "energyShield", "mana", "spirit", "str", "dex", "int", "fire", "cold", "lightning", "chaos"} or null,
 "skills": [{"name", "level"}]}
Rules: copy names exactly as written; numbers as integers; for resistances use the first number shown; use null for anything not visible; never guess.`;

/** El modelo a veces envuelve el JSON en ```json … ```: se quita antes de leerlo. */
export function parseReaderOutput(content: string): ScreenshotReadResponse {
  const text = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const raw = JSON.parse(text) as Record<string, unknown>;
  const parsed = ScreenshotReadResponseSchema.parse({
    screen: raw.screen,
    sheet: raw.sheet ?? null,
    skills: Array.isArray(raw.skills) ? raw.skills : [],
  });
  return {
    ...parsed,
    skills: parsed.skills.map((skill) => ({ ...skill, name: tidySkillName(skill.name) })),
  };
}

export function createScreenshotReader(config: ServerConfig, fetchImpl: typeof fetch = fetch): ScreenshotReader | null {
  const apiKey = config.mentorAiApiKey;
  if (!config.mentorAiEnabled || !apiKey) return null;
  const endpoint =
    config.mentorAiProvider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

  return async (imageDataUrl) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(config.mentorAiTimeoutMs, 20_000));
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.mentorAiVisionModel,
          temperature: 0,
          max_completion_tokens: 1200,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: INSTRUCTIONS },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`el proveedor respondió ${response.status}`);
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
      return parseReaderOutput(body.choices?.[0]?.message?.content ?? "");
    } finally {
      clearTimeout(timeout);
    }
  };
}
