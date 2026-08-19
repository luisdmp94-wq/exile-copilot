# Exile Copilot — PLAN

Aplicación web para jugadores de Path of Exile 2: «Importa tu build, indica tu presupuesto y recibe las próximas mejoras ordenadas por impacto, coste y riesgo».

## Decisiones de arquitectura

- **Monorepo simple**: frontend (React + Vite + Tailwind + shadcn/ui) y backend (Express + TypeScript) en el mismo proyecto.
- **Backend**: Express 4 ejecutado con `tsx` en desarrollo. API REST bajo `/api`. Vite actúa de proxy hacia el backend en dev.
- **Base de datos**: `node:sqlite` (`DatabaseSync`, integrado en Node 24, cero dependencias nativas). Capa de acceso fina en `server/db/`. Esquema pensado para migrar a PostgreSQL (solo SQL estándar, sin tipos exóticos).
- **Validación**: zod en shared (esquemas compartidos entre front y back).
- **Motor de recomendaciones**: 100 % determinista, reglas configurables en `server/engine/rules.ts`. Sin IA en el núcleo.
- **Capa de explicación IA**: abstracción `ExplainerProvider` con dos implementaciones: `DeterministicExplainer` (por defecto, sin API key) y `LlmExplainer` (stub desactivado por flag `EXPLAINER_LLM_ENABLED=false`).
- **Adaptadores externos**:
  - `PoeNinjaClient` (server/services/poeninja.ts): usa exclusivamente la API económica pública documentada (`https://poe.ninja/api/data/...`). Caché en SQLite con ETag, TTL configurable, User-Agent descriptivo configurable (`POE_NINJA_USER_AGENT`), fallback a último valor en caché y luego a fixtures. Nunca se llama desde el navegador.
  - `GggOAuthAdapter` (server/adapters/ggg.ts): interfaz preparada, desactivada con `GGG_OAUTH_ENABLED=false`. El MVP no depende de él.
  - `PobAdapter` (server/adapters/pob.ts): interfaz para Path of Building / POBb.in con soporte básico (decodifica el formato base64+zlib de PoB si `pako` disponible; si no, devuelve «No verificado»). No bloquea el flujo principal.
  - `MobalyticsAdapter`: solo guarda un enlace como referencia. Sin scraping.
- **Formato `.build`**: GGG no publica un esquema formal estable del `.build` de PoE2. Decisión: importador tolerante que acepta JSON con el esquema documentado en `shared/buildFile.ts` (validado con zod) y también intenta parsear PoB code. El exportador emite el mismo esquema JSON versionado (`formatVersion: 1`). Documentado como supuesto en HANDOFF.
- **Arquetipo inicial**: Mercenario/Gemling con ballesta. El modelo admite otros arquetipos vía `archetype` en el perfil.

## Estructura

```
exile-copilot/
  shared/            esquemas zod y tipos compartidos (domain.ts, buildFile.ts, api.ts)
  server/
    index.ts         arranque Express
    app.ts           creación de app (para tests)
    config.ts        variables de entorno documentadas
    db/              node:sqlite (conexión, esquema, repos)
    importers/       buildFileImporter, itemTextParser, pobAdapter
    services/        poeninja (caché+fixtures), priceService
    engine/          reglas deterministas + motor de recomendaciones
    explainers/      DeterministicExplainer, LlmExplainer (stub)
    adapters/        ggg.ts (flag off), mobalytics.ts (referencia), pob.ts
    exporters/       buildFileExporter
    routes/          character, market, recommendations, export, meta
    fixtures/        build de ejemplo, items, respuestas poe.ninja, precios
  src/               frontend React
  tests/             unit (vitest), integration (api), e2e (flujo principal)
  docs/PLAN.md       este archivo
  HANDOFF.md         informe vivo para el propietario
  .env.example       variables documentadas
```

## Modelo de datos (shared/domain.ts)

Entidades: `CharacterProfile`, `BuildTarget`, `Item`, `Modifier`, `SkillSetup`, `PassiveSelection`, `Budget`, `Goal`, `PriceQuote`, `PatchVersion`, `SourceEvidence`, `Recommendation`. Todas con esquemas zod. `Recommendation` incluye: prioridad, acción, motivo, coste/rango, impacto esperado, riesgo, pérdida potencial de mods, irreversibilidad, parche, fuentes, fecha de datos, confianza y campos no verificados.

## Contrato API (v1)

- `GET  /api/health` → `{ ok: true, patch, dataUpdatedAt }`
- `GET  /api/meta` → ligas, parches y objetivos disponibles.
- `POST /api/import/build` `{ content: string }` → `{ profile: CharacterProfile, warnings: string[] }` (detecta JSON .build, PoB code o texto).
- `POST /api/import/item-text` `{ text: string }` → `{ item: Item, warnings: string[] }`.
- `POST /api/character` guarda/actualiza el perfil normalizado (correcciones manuales).
- `GET  /api/character/demo` → perfil de demostración precargado.
- `GET  /api/market/prices?league=...&names=a,b,c` → `{ quotes: PriceQuote[], source, updatedAt, fromCache, degraded }`.
- `POST /api/recommendations` `{ profile, target?, budget, goal, league, patch }` → `{ recommendations: Recommendation[3] }`.
- `POST /api/export/build` `{ profile, appliedRecommendations?: string[] }` → descarga `.build` (JSON versionado, content-disposition attachment).

## Hitos

1. Estructura, modelo de datos, página principal, fixtures, ejemplo cargable.
2. Importación/validación `.build`, texto de objetos, corrección manual, perfil normalizado.
3. poe.ninja: caché, errores, fallback, evidencia y fechas.
4. Motor de recomendaciones: presupuesto, objetivo, riesgo, 3 acciones, explicaciones.
5. Exportación `.build`, validación, pruebas completas, accesibilidad, docs.
6. (Opcional) Adaptador PoB inicial / POBb.in si hay vía pública permitida.

## Pruebas

- Unitarias (vitest): parsers, motor de reglas, exportador, caché.
- Integración: rutas API con app Express en memoria.
- E2E: arranca el servidor real en puerto efímero y recorre el flujo principal (demo → precios → recomendaciones → exportación → reimportación).

## Criterios de aceptación

Ver brief: carga `.build` de ejemplo; muestra ascendencia/pasivas/skills; analiza texto de objeto; corrección manual; presupuesto y objetivo; precios poe.ninja reales o simulados con fallback; 3 recomendaciones estructuradas con coste/impacto/riesgo/confianza/fuente/parche; exporta `.build` válido; funciona sin API key; tests pasan; sin scraping ni APIs internas; README y HANDOFF completos.
