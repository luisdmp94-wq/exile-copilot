import { describe, expect, it } from "vitest";
import { loadConfig } from "../../server/config.js";

describe("configuración del mentor IA", () => {
  it("está apagado y sin clave por defecto", () => {
    const config = loadConfig({});
    expect(config.mentorAiEnabled).toBe(false);
    expect(config.mentorAiProvider).toBe("groq");
    expect(config.mentorAiApiKey).toBeNull();
    expect(config.mentorAiModel).toBe("openai/gpt-oss-120b");
  });

  it("acepta activación explícita de Groq y solo lee su clave", () => {
    const config = loadConfig({
      MENTOR_AI_ENABLED: "true",
      MENTOR_AI_PROVIDER: "groq",
      GROQ_API_KEY: "  gsk_prueba  ",
      OPENAI_API_KEY: "no-usar",
      MENTOR_AI_MODEL: "modelo-prueba",
      MENTOR_AI_REASONING_EFFORT: "medium",
    });
    expect(config.mentorAiEnabled).toBe(true);
    expect(config.mentorAiProvider).toBe("groq");
    expect(config.mentorAiApiKey).toBe("gsk_prueba");
    expect(config.mentorAiModel).toBe("modelo-prueba");
    expect(config.mentorAiReasoningEffort).toBe("medium");
  });

  it("mantiene OpenAI como proveedor opcional y separado", () => {
    const config = loadConfig({
      MENTOR_AI_ENABLED: "true",
      MENTOR_AI_PROVIDER: "openai",
      GROQ_API_KEY: "no-usar",
      OPENAI_API_KEY: "  sk-prueba  ",
    });
    expect(config.mentorAiProvider).toBe("openai");
    expect(config.mentorAiApiKey).toBe("sk-prueba");
    expect(config.mentorAiModel).toBe("gpt-5.4-mini");
  });

  it("un proveedor desconocido vuelve de forma segura a Groq", () => {
    const config = loadConfig({ MENTOR_AI_PROVIDER: "desconocido" });
    expect(config.mentorAiProvider).toBe("groq");
    expect(config.mentorAiModel).toBe("openai/gpt-oss-120b");
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
