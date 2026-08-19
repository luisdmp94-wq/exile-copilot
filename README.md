# Exile Copilot

Aplicación web para jugadores de **Path of Exile 2**:

> «Importa tu build, indica tu presupuesto y recibe las próximas mejoras ordenadas por impacto, coste y riesgo.»

No es un chatbot: construye un perfil estructurado del personaje, consulta datos verificables (API económica pública documentada de poe.ninja) y devuelve tres acciones concretas con coste, impacto, riesgo, confianza, fuentes y parche.

## Requisitos

- Node.js 24+ (usa `node:sqlite`, sin dependencias nativas)
- npm
- (Opcional, solo para `npm run test:browser`) Microsoft Edge instalado

## Puesta en marcha

```bash
npm install
cp .env.example .env   # opcional; todos los valores tienen default
npm run dev            # frontend + API en http://localhost:7100
```

- `npm run dev` — servidor de desarrollo único (Vite sirve el frontend y monta la API Express bajo `/api`).
- `npm start` — modo producción: sirve `dist/` + API en el puerto `PORT` (default 7177). Requiere `npm run build` previo.
- `npm run build` — typecheck completo (`tsc -b`) + build de producción.
- `npm test` — pruebas automatizadas (unitarias, integración y e2e del flujo principal).
- `npm run lint` — ESLint sobre todo el repo.
- `npm run test:browser` — prueba real de navegador del flujo principal con Edge (Playwright, `channel: msedge`, sin descargar navegadores). `--dev` la ejecuta contra el servidor de desarrollo (Strict Mode), `--all` contra ambos. Requiere `npm run build` previo para el modo producción. Guarda capturas en `docs/screenshots/`.

## Cómo probar el flujo principal (sin credenciales)

1. Abre http://localhost:7100 y pulsa **«Cargar ejemplo»** (perfil demo: Mercenario Gemling con ballesta, nivel 70, con carencias deliberadas).
2. Revisa/corrige campos en **Mi personaje** (atributos, resistencias, vida y defensas; «Desconocido» = sin dato, nunca 0) y pulsa **Guardar correcciones**. El personaje se recupera automáticamente al recargar la página (el id solo se guarda tras persistir de verdad en el servidor).
3. Importa un **`.build` oficial** de GGG: se añade como **Build objetivo** (plan de referencia), no como personaje. Un código de **Path of Building** sí rellena un personaje parcial.
4. En **Mercado actual** elige liga, presupuesto y objetivo; consulta precios (datos reales de poe.ninja con caché; tasas de conversión con origen y verificación visibles).
5. Pulsa **Generar recomendaciones** → 3 tarjetas con prioridad, acción, motivo, coste, impacto, riesgo, irreversibilidad, parche, fuentes, fecha y confianza. Si cambias cualquier dato, las tarjetas se invalidan.
6. Marca las recomendaciones aplicadas y pulsa **Descargar .build** → archivo **`.build` oficial** (GGG Build Planner v1) con las mejoras planificadas incrustadas en `description`/`additional_text`, junto a un informe honesto de lo exportado y lo omitido.

## Formato `.build` — GGG Build Planner v1

El archivo exportado sigue el esquema oficial documentado por GGG en
<https://www.pathofexile.com/developer/docs/game>: un único objeto `Build` JSON con
`name`, `author`, `link`, `description`, `ascendancy`, `passives`, `skills` e `inventory_slots`.

Separación de conceptos:

- **CharacterProfileSnapshot** (`shared/domain.ts`): estado interno completo (nivel, liga, resistencias, vida, mods de objetos, presupuesto…).
- **GggBuildPlannerV1** (`shared/gggBuildPlanner.ts`): el archivo oficial exportable al juego.

El formato oficial **no puede almacenar** nivel, liga, parche, atributos, resistencias, vida/defensas, mods concretos de objetos, presupuesto ni objetivo. Además, pasivas y gemas solo se exportan cuando existe un **id oficial verificable** (tablas `PassiveSkills` / `BaseItemTypes`); lo que no lo tiene aparece en `skippedUnverified` del informe de exportación. Por tanto NO es un round-trip sin pérdida: la app informa siempre de lo omitido.

## Estructura

- `shared/` — esquemas zod: dominio interno, contrato API y esquema oficial GGG Build Planner v1.
- `server/` — API Express: importadores (`.build` oficial, texto de objetos, PoB básico con límite de descompresión), adaptadores (GGG OAuth desactivado por flag, Mobalytics solo referencia), servicio poe.ninja con caché SQLite+ETag tolerante a corrupción y fixtures, motor determinista de recomendaciones, explicadores (determinista por defecto; LLM stub por flag), exportador `.build` oficial con informe.
- `src/` — frontend React + Tailwind + shadcn/ui (español, tema oscuro).
- `tests/` — vitest: unit, integration, e2e. `scripts/browser-smoke.mjs` — prueba de navegador real.
- `docs/PLAN.md` — plan y arquitectura. `HANDOFF.md` — informe para el propietario.

## Variables de entorno

Todas documentadas en `.env.example`. Destacadas:

- `POE_NINJA_OFFLINE=true` — nunca hace red; sirve fixtures (ideal para demos/tests).
- `POE_NINJA_USER_AGENT` — User-Agent descriptivo (exigido por poe.ninja).
- `GGG_OAUTH_ENABLED` / `EXPLAINER_LLM_ENABLED` — flags desactivadas por defecto.

## Reglas de datos

- Solo API económica pública documentada de poe.ninja (`/poe2/api/economy/...`), llamada desde el servidor, con caché/ETag y fallback. Sin scraping ni endpoints internos ni OAuth de GGG.
- Los valores desconocidos permanecen `null` («Desconocido»); nunca se convierten en cero ni generan afirmaciones falsas.
- Los objetos raros nunca se valoran con precios de únicos por coincidencia de base; no se inventan rangos de precio.
- Los presupuestos se comparan solo tras normalizar divine/exalted/chaos con las tasas reales de poe.ninja; sin tasas verificables no se afirma que algo «entra en el presupuesto».
