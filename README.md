# Exile Copilot

Aplicación web para jugadores de **Path of Exile 2**:

> «Importa tu build, indica tu presupuesto y recibe las próximas mejoras ordenadas por impacto, coste y riesgo.»

No es un chatbot: construye un perfil estructurado del personaje, consulta datos verificables (API económica pública documentada de poe.ninja) y devuelve tres acciones concretas con coste, impacto, riesgo, confianza, fuentes y parche.

## Requisitos

- Node.js 24+ (usa `node:sqlite`, sin dependencias nativas)
- npm

## Puesta en marcha

```bash
npm install
cp .env.example .env   # opcional; todos los valores tienen default
npm run dev            # frontend + API en http://localhost:7100
```

- `npm run dev` — servidor de desarrollo único (Vite sirve el frontend y monta la API Express bajo `/api`).
- `npm start` — modo producción: sirve `dist/` + API en el puerto `PORT` (default 7177). Requiere `npm run build` previo.
- `npm run build` — typecheck completo (`tsc -b`) + build de producción.
- `npm test` — 45 pruebas (unitarias, integración y una e2e del flujo principal).

## Cómo probar el flujo principal (sin credenciales)

1. Abre http://localhost:7100 y pulsa **«Cargar ejemplo»** (perfil demo: Mercenario Gemling con ballesta, nivel 70, con carencias deliberadas).
2. Revisa/corrige campos en **Mi personaje** y pulsa **Guardar correcciones**.
3. En **Mercado actual** elige liga `Runes of Aldur`, presupuesto (p. ej. 2 divine) y objetivo; consulta precios (datos reales de poe.ninja con caché; si no hay red, fixtures degradados marcados como «No verificado»).
4. Pulsa **Generar recomendaciones** → 3 tarjetas con prioridad, acción, motivo, coste, impacto, riesgo, irreversibilidad, parche, fuentes, fecha y confianza.
5. Marca las recomendaciones aplicadas y pulsa **Descargar .build** → archivo `.build.json` reimportable (puedes volver a importarlo en el paso 1).

También puedes pegar texto de un objeto copiado del juego («Analizar objeto») o importar un `.build` / código de Path of Building (adaptador básico).

## Estructura

- `shared/` — esquemas zod y tipos compartidos (dominio, API, formato `.build`).
- `server/` — API Express: importadores, adaptadores (GGG OAuth desactivado por flag, PoB básico, Mobalytics solo referencia), servicio poe.ninja con caché SQLite+ETag y fixtures, motor determinista de recomendaciones, explicadores (determinista por defecto; LLM stub por flag), exportador `.build`.
- `src/` — frontend React + Tailwind + shadcn/ui (español, tema oscuro).
- `tests/` — vitest: unit, integration, e2e.
- `docs/PLAN.md` — plan, arquitectura y contrato API. `HANDOFF.md` — informe para el propietario.

## Variables de entorno

Todas documentadas en `.env.example`. Destacadas:

- `POE_NINJA_OFFLINE=true` — nunca hace red; sirve fixtures (ideal para demos/tests).
- `POE_NINJA_USER_AGENT` — User-Agent descriptivo (exigido por poe.ninja).
- `GGG_OAUTH_ENABLED` / `EXPLAINER_LLM_ENABLED` — flags desactivadas por defecto; el MVP no depende de ellas.

## Reglas de datos

- Solo API económica pública documentada de poe.ninja, llamada desde el servidor, con caché/ETag y fallback. Sin scraping ni endpoints internos (poe.ninja, Mobalytics) ni OAuth de GGG.
- Nunca se inventan precios, mods ni estadísticas: sin dato verificable se muestra **«No verificado»** y qué falta.
- Cada recomendación lleva fuente, parche y fecha de actualización de los datos.
