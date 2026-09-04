/**
 * Después de validar las variables REALES del alojamiento, la barrera larga se
 * ejecuta en procesos locales y bases temporales. No debe heredar modo público,
 * secretos ni servicios externos: un navegador contra localhost no representa
 * al proxy HTTPS y una prueba nunca debe tocar la SQLite real o gastar proveedor.
 *
 * DEFAULT_PATCH se conserva a propósito: verify:public:1.0 aún debe demostrar
 * que toda la aplicación funciona con el parche que se pretende publicar.
 */
export function isolatedReleaseEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const isolated = { ...source };

  delete isolated.NODE_ENV;
  delete isolated.GROQ_API_KEY;
  delete isolated.OPENAI_API_KEY;

  return {
    ...isolated,
    PUBLIC_DEPLOYMENT: "false",
    SECURE_COOKIES: "false",
    TRUST_PROXY: "false",
    DATABASE_PATH: ":memory:",
    POE_NINJA_OFFLINE: "true",
    MENTOR_AI_ENABLED: "false",
    GGG_OAUTH_ENABLED: "false",
    EXPLAINER_LLM_ENABLED: "false",
  };
}
