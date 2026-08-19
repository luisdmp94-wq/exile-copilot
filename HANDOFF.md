# HANDOFF — Exile Copilot

> Informe para el propietario. Última actualización: sesión 2 (fase de corrección), 2026-08-19.

## Qué funciona (verificado en esta sesión)

- **Formato `.build` oficial (GGG Build Planner v1)**: importador y exportador del esquema documentado en <https://www.pathofexile.com/developer/docs/game>. El archivo descargado termina en `.build` y valida contra el esquema oficial. Fixture verbatim del ejemplo oficial «Titan Warrior» de GGG.
- **Separación de formatos**: `CharacterProfileSnapshot` (interno, completo) vs `GggBuildPlannerV1` (oficial, limitado). La exportación incluye un **informe honesto**: qué se exportó, qué no puede almacenar el formato (nivel, liga, resistencias, vida, mods, presupuesto…) y qué se omitió por falta de id oficial verificable. Ya NO se afirma «round-trip sin pérdida».
- **Exactitud de datos**:
  - Valores desconocidos = `null`/«Desconocido» en toda la app; nunca se convierten a 0 ni generan afirmaciones tipo «tienes 0%» ni recomendaciones de confianza alta derivadas de ellos (tests específicos).
  - Los objetos raros nunca se valoran con precios de únicos por coincidencia de base (test específico).
  - Eliminado el rango inventado `precio × 1,5`; sin precio consultable → «No verificado».
  - Precios offline/fixture marcados «No verificado» aunque tengan valor numérico (test específico).
  - Comparación con presupuesto solo tras normalizar divine/exalted/chaos con las tasas reales (`core.rates`) de poe.ninja; sin tasas → «No verificado si entra en el presupuesto» (tests de conversión y de caso sin tasas).
- **Comportamiento**:
  - La **build objetivo** (mods deseados) influye de verdad en el motor: test que demuestra salidas diferentes con y sin target.
  - Las recomendaciones se **invalidan** al cambiar personaje, equipo, objetivo, liga o presupuesto (huella de inputs en cliente + `inputFingerprint` del servidor).
  - El personaje guardado se **recupera tras recargar** (localStorage + `GET /api/character/:id`); botón «Empezar de nuevo».
  - Formulario manual completo: vida, energy shield, evasión, armadura, nivel, liga y parche, además de atributos/resistencias/items/skills/pasivas.
  - Parche con **versión de contenido y hotfix separados**, con fuente y fecha (`server/data/patches.json`); nada etiquetado como «actual».
- **Seguridad/robustez**: importador PoB con límite de descompresión (2 MB) y de entrada (1M chars) con tests; caché SQLite corrupta manejada sin derribar la petición (borra la fila y sigue); ESLint en 0 errores en todo el repo.

## Cómo abrir la aplicación

```bash
cd exile-copilot
npm install
npm run dev    # http://localhost:7100 (frontend + API en un solo servidor)
```

## Cómo probar el flujo principal

Manual: «Cargar ejemplo» → editar vida → «Guardar correcciones» → presupuesto 5 → «Generar recomendaciones» → marcar recomendación → «Descargar .build» → ver informe → recargar la página (el personaje vuelve solo).

Automatizada en navegador real:

```bash
npm run build
npm run test:browser   # Edge headless vía Playwright, capturas en docs/screenshots/
```

## Capturas / descripción visual

Capturas reales de esta sesión en `docs/screenshots/` (`recomendaciones.png`, `app-completa.png`). Cabecera oscura con badge de parche (contenido+hotfix, tooltip con fuente y fecha). Cuatro secciones: **Mi personaje** (importación y edición completa), **Build objetivo**, **Mercado actual** (precios con badges «desde caché»/«modo degradado»/«No verificado») y **Próximas mejoras** (3 tarjetas con prioridad, riesgo, confianza, parche, fuentes, «Falta por verificar», advertencias de pérdida de mods e irreversibilidad, checkbox para incluir en la exportación, informe de exportación con lo que el formato oficial no puede guardar).

## Decisiones tomadas (sesión 2)

- El formato propietario anterior se eliminó por completo: solo GGG Build Planner v1 como archivo `.build`.
- El demo sigue siendo rico (resistencias conocidas, vida baja, dex insuficiente) vía snapshot interno (`server/fixtures/demoSnapshot.json`); el `.build` oficial de demo es mínimo y honesto porque GGG no publica los ids de gemas de ballesta — no se inventaron.
- Solo se exportan pasivas/gemas con id oficial verificable; lo demás se declara omitido.
- La persistencia usa la tabla `characters` de SQLite + id en localStorage del navegador.

## Supuestos

- GGG no procesa nuevas apps OAuth → adaptador preparado pero desactivado.
- La ascendencia oficial usa ids tipo `Warrior1`; sin mapeo oficial clase↔ascendencia documentado, la clase importada queda «Desconocida» salvo dato explícito.
- PoB/POBb.in: adaptador básico (Hito 6 pendiente), no bloquea el flujo principal.

## Pruebas ejecutadas (salidas reales)

- `npx tsc -b` → 0 errores.
- `npx vitest run` → **7 archivos, 57/57 verdes** (incl. tests nuevos: esquema oficial, null-safety, conversión de monedas, sin tasas, rare-vs-unique, fixture offline, efecto de target, caché corrupta, límites PoB, persistencia).
- `npm run lint` → 0 errores.
- `npx vite build` → OK (149 kB gzip).
- `node scripts/browser-smoke.mjs` (Edge real, modo producción) → **9/9 comprobaciones**: carga, demo, corrección manual, 3 recomendaciones, descarga `.build`, Build válido, informe visible, persistencia tras recargar.
- Verificación en vivo de poe.ninja (sesión anterior, 2026-08-19): Divine 1 div, Exalted ≈ 0.0029 div, Chaos ≈ 0.097 div, liga Runes of Aldur.

## Funciones incompletas

- Adaptador PoB: extracción básica; no importa árboles completos.
- POBb.in: sin vía pública documentada; no integrado.
- Explicador LLM: stub desactivado por flag.
- Los nombres legibles de pasivas importadas desde `.build` oficial no se resuelven (se muestra el id con warning «nombre no verificado»); haría falta una tabla oficial de nombres.

## Errores conocidos

- El precio de objetos raros no existe en poe.ninja (solo únicos y divisa): las mejoras sobre rares muestran coste «No verificado» (intencionado).
- El bundle JS supera 500 kB (aviso de Vite sin impacto funcional).

## Riesgos legales o de datos

- Solo API económica pública documentada de poe.ninja, desde servidor, con User-Agent descriptivo, caché/ETag. Sin endpoints internos, sin scraping, sin OAuth.
- Cero secretos en el repo (`.env` ignorado).

## Próximo paso recomendado

Integrar una tabla versionada de nombres/ids oficiales (PassiveSkills y BaseItemTypes de gemas de ballesta) para resolver nombres legibles y poder exportar skills/pasivas del arquetipo MVP con ids verificables.

## Archivos importantes

- `README.md` — cómo ejecutar y probar. `docs/PLAN.md` — arquitectura y contrato.
- `shared/domain.ts` (snapshot interno), `shared/gggBuildPlanner.ts` (esquema oficial), `shared/api.ts` (contrato).
- `server/importers/gggBuildImporter.ts`, `server/exporters/gggBuildExporter.ts` — formato oficial.
- `server/services/poeninja.ts` — economía con caché/ETag/rates.
- `server/engine/` — motor determinista (null-safe, target, fingerprint).
- `server/fixtures/ggg/titanWarrior.build.json` (ejemplo oficial GGG), `demoMercenary.build`, `demoSnapshot.json`.
- `server/data/patches.json` — parches versionados con fuente.
- `src/` — frontend. `scripts/browser-smoke.mjs` — prueba de navegador real.
- `tests/` — unitarias, integración, e2e.
