# HANDOFF — Exile Copilot

> Informe para el propietario. Última actualización: sesión 1, 2026-08-19.

## Qué funciona (verificado)

- **Aplicación full-stack completa**: frontend React (español, tema oscuro) + API Express en un solo proyecto; `npm run dev` levanta ambos en http://localhost:7100 (verificado: frontend HTTP 200 y `/api/health` OK a través del mismo servidor).
- **Ejemplo precargado**: botón «Cargar ejemplo» — Mercenario Gemling con ballesta, nivel 70, liga Runes of Aldur, parche 0.5.0, con carencias deliberadas para que el motor tenga material (verificado vía `/api/character/demo`).
- **Importación**: `.build` (JSON versionado propio, validado con zod, tolerante con warnings), código de Path of Building (adaptador básico base64url+zlib, extracción best-effort marcada «No verificado») y texto de objetos copiado del juego (parser de secciones `--------`, rareza EN/ES, requisitos, mods con valores).
- **Corrección manual**: perfil editable (nombre, nivel, atributos, resistencias, items, skills, pasivas) con «Guardar correcciones» persistiendo en SQLite.
- **Mercado**: precios reales de la API económica pública documentada de poe.ninja (`/poe2/api/economy/...`), solo desde servidor, con caché SQLite + ETag, TTL 15 min, modo offline con fixtures y degradación honesta. Verificado en vivo: Divine Orb = 1 div, Exalted ≈ 0.0029 div, Chaos ≈ 0.097 div, `verified: true` (liga Runes of Aldur, 2026-08-19).
- **Motor de recomendaciones determinista** (sin IA, `engineVersion 1.0.0`): 6 reglas (resistencias <75 %, caos <0, atributos vs requisitos, arma sin calidad/pocos mods, supports incompletos, vida baja) ponderadas por objetivo. Devuelve exactamente 3 acciones con coste/impacto/riesgo/confianza/fuentes/parche/fechas y lista «Falta por verificar». Nunca DPS ficticio: métricas parciales etiquetadas.
- **Exportación `.build`**: descarga JSON versionado (`formatVersion: 1`) que se reimporta sin pérdida (round-trip probado en tests y e2e).
- **Pruebas**: 45/45 en verde (7 archivos: unitarias de parser/importador/motor/exportador/poe.ninja, integración de API y una e2e del flujo principal completo).
- **Build de producción**: `tsc -b` 0 errores, `vite build` OK (145 kB gzip).

## Cómo abrir la aplicación

```bash
cd exile-copilot
npm install
npm run dev    # http://localhost:7100
```

## Cómo probar el flujo principal

1. «Cargar ejemplo» → aparece el personaje demo con sus warnings.
2. (Opcional) Edita resistencias/atributos y «Guardar correcciones».
3. «Mercado actual»: liga Runes of Aldur, presupuesto 2 divine, objetivo equilibrio → consulta precios reales.
4. «Generar recomendaciones» → 3 tarjetas; la primera será cubrir resistencias (supervivencia) para este perfil demo.
5. Marca recomendaciones y «Descargar .build» → reimpórtalo para comprobar el round-trip.

## Descripción visual

Cabecera oscura con título «Exile Copilot», badge de parche (0.5.0) y la promesa del producto. Cuerpo en dos columnas (una en móvil): **Mi personaje** (importación, edición), **Build objetivo** (referencia opcional, etiquetada «Referencia, no verificada»), **Mercado actual** (liga/presupuesto/objetivo + precios con badges «desde caché»/«modo degradado») y **Próximas mejoras** (3 tarjetas con badges de prioridad, riesgo y confianza; advertencias ámbar/rojas para «puede perder mods valiosos» e «irreversible»; botón de descarga). Estados de carga (skeletons), vacío (con CTA al demo) y error (alertas) en cada sección.

Nota honesta: no se pudo hacer captura automatizada (el control del navegador integrado no estaba disponible en esta sesión); el renderizado se verificó por build, typecheck y respuestas HTTP, no con captura visual.

## Decisiones tomadas

- **Stack**: React 19 + Vite + Tailwind + shadcn/ui + Express + TypeScript, monorepo. SQLite vía `node:sqlite` (cero dependencias nativas, migrable a PostgreSQL).
- **Un solo servidor en dev**: la API Express se monta como middleware de Vite (`/api`), así `npm run dev` basta para todo.
- **Formato `.build` propio versionado**: GGG no publica un esquema formal del `.build` de PoE2; se definió `BuildFileSchema` (`formatVersion: 1`) documentado, con importador tolerante.
- **poe.ninja**: se migró a los endpoints documentados actuales (`/poe2/api/economy/...`) tras verificar la documentación oficial; los antiguos `/api/data/...` devuelven 404.
- **Motor sin IA**; capa de explicación con proveedor abstracto (determinista por defecto; LLM stub tras flag).
- **Liga/parche por defecto**: Runes of Aldur / 0.5.0 (verificado en vivo contra poe.ninja, 2026-08-19).

## Supuestos

- GGG no procesa nuevas apps OAuth → adaptador preparado pero desactivado (`GGG_OAUTH_ENABLED=false`).
- PoB/POBb.in: solo adaptador básico de decodificación; no bloquea el flujo principal (Hito 6 queda como extensión).
- Los nombres de nodos de pasivas del demo son ilustrativos (no hay fuente pública verificable integrada).

## Pruebas ejecutadas

- `npx tsc -b` → 0 errores (app + server + node).
- `npx vitest run` → 7 archivos, 45/45 verdes (~5 s).
- `npx vite build` → OK.
- Dev server real: `/api/health`, `/api/meta`, `/api/market/prices` (datos reales), `/api/character/demo` → OK; servidor detenido tras la verificación, sin procesos residuales.

## Funciones incompletas

- Adaptador PoB: decodifica y extrae lo básico; no parsea árboles de pasivas ni calidad de items de PoB.
- POBb.in: no integrado (no se encontró vía pública documentada).
- Explicador LLM: stub desactivado por flag.
- Sin captura visual automatizada (ver nota en «Descripción visual»).

## Errores conocidos

- En ligas hardcore o con poca liquidez, algunos precios pueden venir como «No verificado» (comportamiento intencionado, no bug).
- El precio de armas rare no existe en poe.ninja (solo únicos y divisa): las mejoras de arma rare muestran coste «No verificado».

## Riesgos legales o de datos

- Cumple las normas de poe.ninja: solo API económica documentada, llamadas desde servidor, User-Agent descriptivo, caché/ETag. Sin endpoints internos, sin scraping, sin clonar su web.
- Sin interacción con el cliente del juego ni con Mobalytics (solo enlaces guardados como referencia).
- Cero secretos en el repo (`.env` ignorado; `.env.example` solo con defaults).

## Próximo paso recomendado

Ampliar reglas del motor con una base de datos de mecánicas versionada (mods de ballesta por tier) y completar el adaptador PoB para importar árboles de pasivas reales.

## Archivos importantes

- `README.md` — cómo ejecutar y probar.
- `docs/PLAN.md` — arquitectura, contrato API, hitos y criterios de aceptación.
- `shared/domain.ts`, `shared/api.ts`, `shared/buildFile.ts` — contrato de datos (zod).
- `server/app.ts`, `server/index.ts` — API y arranque.
- `server/services/poeninja.ts` — cliente económico (caché/ETag/fixtures).
- `server/engine/rules.ts`, `server/engine/engine.ts` — motor determinista.
- `server/importers/` — importadores `.build` y texto de objetos.
- `server/exporters/buildFileExporter.ts` — exportación.
- `server/fixtures/` — demo build, texto de objeto y fixtures de poe.ninja.
- `src/App.tsx`, `src/sections/`, `src/components/RecommendationCard.tsx`, `src/lib/api.ts` — frontend.
- `tests/` — unitarias, integración y e2e.
- `.env.example` — configuración documentada.
