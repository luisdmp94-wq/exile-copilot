import { describe, expect, it } from "vitest";
import { loadConfig } from "../../server/config.js";

describe("configuración del mentor IA", () => {
  it("está apagado y sin clave por defecto", () => {
    const config = loadConfig({});
    expect(config.mentorAiEnabled).toBe(false);
    expect(config.mentorAiApiKey).toBeNull();
    expect(config.mentorAiModel).toBe("gpt-5.4-mini");
  });

  it("acepta activación explícita sin confundirla con la suscripción de ChatGPT", () => {
    const config = loadConfig({
      MENTOR_AI_ENABLED: "true",
      OPENAI_API_KEY: "  sk-prueba  ",
      MENTOR_AI_MODEL: "modelo-prueba",
      MENTOR_AI_REASONING_EFFORT: "medium",
    });
    expect(config.mentorAiEnabled).toBe(true);
    expect(config.mentorAiApiKey).toBe("sk-prueba");
    expect(config.mentorAiModel).toBe("modelo-prueba");
    expect(config.mentorAiReasoningEffort).toBe("medium");
  });

  it("limita timeout, tokens y esfuerzo a valores permitidos", () => {
    const config = loadConfig({
      MENTOR_AI_TIMEOUT_MS: "999999",
      MENTOR_AI_MAX_OUTPUT_TOKENS: "1",
      MENTOR_AI_REASONING_EFFORT: "ultra",
    });
    expect(config.mentorAiTimeoutMs).toBe(30_000);
    expect(config.mentorAiMaxOutputTokens).toBe(128);
    expect(config.mentorAiReasoningEffort).toBe("low");
  });
});
