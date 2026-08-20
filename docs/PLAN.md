# Exile Copilot — PLAN

Aplicación web para jugadores de Path of Exile 2: «Importa tu build, indica tu presupuesto y recibe las próximas mejoras ordenadas por impacto, coste y riesgo».

> Actualizado en la fase de corrección 3 (2026-08-19). El formato `.build` propietario inicial fue eliminado: se usa exclusivamente el esquema oficial GGG Build Planner v1.

## Decisiones de arquitectura

- **Monorepo simple**: frontend (React + Vite + Tailwind + shadcn/ui) y backend (Express + TypeScript) en el mismo proyecto. En desarrollo, la API Express se monta como middleware de Vite (un solo `npm run dev`); en producción `npm start` sirve `dist/` + API.
- **Base de datos**: `node:sqlite` (`DatabaseSync`, integrado en Node 24, cero dependencias nativas). Capa fina en `server/db/`. Migrable a PostgreSQL.
- **Validación**: zod en `shared/` (esquemas compartidos entre front y back).
- **Motor de recomendaciones**: 100 % determinista, reglas en `server/engine/rules.ts`. Sin IA en el núcleo. Null-safe: un dato desconocido (`null`) nunca se convierte en 0 ni genera afirmaciones de confianza alta.
- **Capa de explicación IA**: abstracción `ExplainerProvider`; `DeterministicExplainer` por defecto; `LlmExplainer` stub tras flag `EXPLAINER_LLM_ENABLED=false`.

## Modelo de datos — separación clave

- **CharacterProfileSnapshot** (`shared/domain.ts`): estado interno del personaje ACTUAL (nivel, liga, atributos, resistencias, vida/defensas, items con mods, skills, pasivas). Los stats desconocidos son `null`, nunca 0.
- **GggBuildPlannerV1** (`shared/gggBuildPlanner.ts`): el archivo `.build` OFICIAL de GGG (https://www.pathofexile.com/developer/docs/game). Es un **plan/instructor**, no una captura del personaje: solo guarda `name`, `author`, `link`, `description`, `ascendancy` (id oficial), `passives` (ids PassiveSkills), `skills` (ids BaseItemTypes) e `inventory_slots` (pistas de texto). `level_interval` es `uint` o `array de uint` (doc oficial); los esquemas son *loose*: los campos no documentados se conservan tal cual (el importador los declara en warnings) y se reexportan sin pérdida silenciosa.
- **BuildTargetPlan**: un `.build` importado se conserva crudo como plan objetivo (sección «Build objetivo»), nunca se convierte en snapshot. El motor no ejecuta reglas de equipo/quality/mods/resistencias sobre sus inventory_slots.
- El exportador snapshot → `.build` oficial genera un **informe honesto** (`ExportReport`): exportado / no exportable por el formato / omitido por falta de id oficial verificable. `ascendancyId` (id oficial) se separa del nombre visible. `unique_name` solo se exporta si es entrada verificada.

## Fuentes externas

- **poe.ninja**: solo API económica pública documentada (`/poe2/api/economy/leagues`, `/poe2/api/economy/exchange/current/overview`, `/poe2/api/economy/stash/current/item/overview`). Llamadas solo desde el servidor, caché SQLite + ETag (tolerante a corrupción), TTL configurable, User-Agent descriptivo, fallback a caché antigua y luego fixtures (marcadas «No verificado»). Las tasas de conversión (`core.rates`) transportan origen y estado de verificación; tasas fixture/stale nunca justifican afirmar que una compra entra en el presupuesto. `verified: true` exige moneda primaria reconocida; una primaria no reconocida deja `primaryCurrency: null` (un desconocido nunca se convierte en afirmación concreta).
- **GGG OAuth**: adaptador stub desactivado por flag (`GGG_OAUTH_ENABLED=false`); el flujo OAuth real no está implementado. El estado actual del procedimiento de solicitud de aplicaciones OAuth de GGG debe verificarse antes de activarlo.
- **PoB**: adaptador básico base64url+zlib con límites de entrada y de descompresión (`maxOutputLength`); fixture real del repo PathOfBuilding-PoE2 (`server/fixtures/pob2/`, procedencia documentada).
- **Mobalytics**: solo enlace guardado como referencia. Sin scraping.

## Estructura

```
exile-copilot/
  shared/            domain.ts (snapshot), gggBuildPlanner.ts (oficial + plan), api.ts (contrato)
  server/
    index.ts         arranque standalone (dist/ + API)
    app.ts           createApiApp (rutas sin prefijo, montadas en /api)
    config.ts        variables de entorno
    data/patches.json  parches versionados (content + hotfix, fuente y fecha)
    db/              node:sqlite (price_cache, characters)
    importers/       buildImporter (dispatcher), gggBuildImporter (→ plan), itemTextParser
    services/        poeninja (caché+ETag+fixtures+rates), priceService
    engine/          reglas deterministas null-safe + fingerprint
    explainers/      DeterministicExplainer, LlmExplainer (stub, flag)
    adapters/        ggg.ts (off), mobalytics.ts (referencia), pob.ts (límites)
    exporters/       gggBuildExporter (informe honesto + mejoras planificadas)
    fixtures/        demoSnapshot.json, demoMercenary.build, ggg/titanWarrior.build.json (oficial verbatim), pob2/ (código real), poeNinja/
  src/               frontend React (español, tema oscuro, Strict Mode)
  tests/             vitest: unit, integration, e2e
  scripts/browser-smoke.mjs  prueba real de navegador (Edge, prod y dev)
```

## Contrato API (v1, bajo /api)

- `GET  /health` → `{ ok, patch: {content, hotfix, asOf, source}, dataUpdatedAt }`
- `GET  /meta` → ligas (poe.ninja, con fallback), parches versionados, goals, currencies, arquetipos.
- `POST /import/build` → `{ warnings, detectedFormat, plan? | profile? }` (plan XOR profile).
- `POST /import/item-text` → `{ item, warnings }`.
- `POST /character` / `GET /character/:id` / `GET /character/demo`.
- `GET  /market/prices?league=&names=` → quotes + `primaryCurrency` + `rates {values, origin, verified, fetchedAt} | null`.
- `POST /recommendations` → 3 recomendaciones + `inputFingerprint`.
- `POST /export/build` → `{ fileName (.build), content, report }`.

## Pruebas

- Unitarias e integración (vitest): parsers, esquema oficial, fidelidad de reexportación, null-safety, conversión de monedas (y caso sin tasas / primaria desconocida / rates stale), rare-vs-unique, efecto del target, caché corrupta, límites PoB, persistencia, contenido de recomendaciones aplicadas.
- E2E del flujo principal (servidor real en puerto efímero).
- Navegador real (Edge vía Playwright): `npm run test:browser` (prod), `--dev` (Strict Mode), `--all`.

## Criterios de aceptación

Verificados desde un checkout limpio: tests, lint, build y prueba de navegador en verde; `.build` válido contra el esquema GGG (nunca «probado en el juego»); desconocidos como null; precios honestos; README y HANDOFF actualizados.
