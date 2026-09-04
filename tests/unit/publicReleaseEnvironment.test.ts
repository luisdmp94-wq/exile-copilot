import { describe, expect, it } from "vitest";
import { isolatedReleaseEnvironment } from "../../server/publicReleaseEnvironment.js";

describe("entorno aislado de la barrera pública", () => {
  it("conserva el parche pero no la publicación, la base ni los secretos reales", () => {
    const source: NodeJS.ProcessEnv = {
      PUBLIC_DEPLOYMENT: "true",
      NODE_ENV: "production",
      SECURE_COOKIES: "true",
      TRUST_PROXY: "loopback",
      DATABASE_PATH: "/volumen/real/exile-copilot.db",
      DEFAULT_PATCH: "1.0",
      DEFAULT_LEAGUE: "Liga 1.0",
      POE_NINJA_OFFLINE: "false",
      MENTOR_AI_ENABLED: "true",
      GROQ_API_KEY: "secreto-groq",
      OPENAI_API_KEY: "secreto-openai",
      MARCADOR_INOFENSIVO: "se-conserva",
    };

    const isolated = isolatedReleaseEnvironment(source);

    expect(isolated).toMatchObject({
      PUBLIC_DEPLOYMENT: "false",
      SECURE_COOKIES: "false",
      TRUST_PROXY: "false",
      DATABASE_PATH: ":memory:",
      DEFAULT_PATCH: "1.0",
      DEFAULT_LEAGUE: "Liga 1.0",
      POE_NINJA_OFFLINE: "true",
      MENTOR_AI_ENABLED: "false",
      GGG_OAUTH_ENABLED: "false",
      EXPLAINER_LLM_ENABLED: "false",
      MARCADOR_INOFENSIVO: "se-conserva",
    });
    expect(isolated.NODE_ENV).toBeUndefined();
    expect(isolated.GROQ_API_KEY).toBeUndefined();
    expect(isolated.OPENAI_API_KEY).toBeUndefined();
    expect(source.PUBLIC_DEPLOYMENT).toBe("true");
    expect(source.DATABASE_PATH).toBe("/volumen/real/exile-copilot.db");
  });
});
