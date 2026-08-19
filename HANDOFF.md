# HANDOFF — Exile Copilot

> Informe para el propietario. Última actualización: sesión 5 (validación en el juego + corrección de markup), 2026-08-20.

## Sesión 5 — validación manual dentro del juego y corrección de markup

- **Validación manual en PoE2 real (2026-08-20)**: el propietario importó en el juego un `.build` exportado por Exile Copilot (plan Titan Warrior con mejora aplicada incrustada). PoE2 importó correctamente el nombre y la ascendencia, las **34 pasivas con sus rutas**, las **4 habilidades** (Boneshatter, Earthquake, Infernal Cry, Shockwave Totem) y los **9 huecos de equipo**, incluido el texto añadido al anillo «Mejora planificada: Cubrir resistencias elementales hasta el cap». Evidencia: [árbol de pasivas](docs/screenshots/ingame-arbol-pasivas.jpg), [habilidades](docs/screenshots/ingame-habilidades.jpg), [equipo con la mejora incrustada](docs/screenshots/ingame-equipo-mejora-incrustada.jpg). Esto es una validación **manual y puntual de ese archivo**, distinta de las pruebas automatizadas (que validan contra el esquema documentado); el resto de exports siguen siendo «válidos contra el esquema», no «probados en el juego».
- **Corregido**: las recomendaciones de la regla «Acercarse a la build de referencia» mostraban restos del markup oficial («Increased Armour}; …»). Causa: las pistas de los inventory_slots se limpiaban línea a línea, pero los bloques `<tag>{...}` del markup GGG abren y cierran en líneas distintas, así que la llave de cierre sobrevivía en la última línea del bloque. Ahora el markup se elimina sobre el texto completo (de dentro hacia fuera, anidamiento incluido) antes de trocearlo; las llaves/paréntesis de texto legítimo fuera de un wrapper no se tocan. Regresión en `tests/unit/auditRegressions.test.ts` (fallaba antes del arreglo). 74/74 tests.

## Sesión 4 — auditoría independiente y correcciones

Las afirmaciones de la sesión 3 se verificaron de forma independiente: `tsc -b` (0 errores), 65/65 tests, ESLint 0 errores, build OK y 20/20 comprobaciones de navegador (Edge, prod + dev) reproducidas en esta sesión. El esquema `.build` se contrastó contra la documentación oficial de GGG (pathofexile.com/developer/docs/game), los endpoints de poe.ninja contra poe.ninja/docs/api, el hilo «0.5.4f Hotfix» (Stacey_GGG) contra el foro oficial y el fixture PoB2 contra la issue #2412 (coincide byte a byte). No se encontraron P0/P1. Defectos P2 corregidos (72/72 tests tras las correcciones, con regresiones que fallaban antes de cada arreglo):

- **`level_interval`**: la doc oficial lo define como `?(array of uint, or uint)`; el esquema solo aceptaba tuplas de exactamente 2 y rechazaba archivos válidos según la doc. Ahora acepta uint o array de uint.
- **Campos no documentados**: un `.build` con campos fuera del esquema v1 los perdía en silencio al importar/reexportar. Ahora los esquemas son *loose*: se conservan tal cual, el importador los declara en warnings y la reexportación los preserva (incluidos los del objeto raíz).
- **`primaryCurrency`**: con una moneda primaria no reconocida la API respondía `"exalted"` (un desconocido convertido en afirmación concreta). Ahora responde `null`; los quotes individuales conservan su nota «No verificado».
- **Mejoras aplicadas obsoletas**: una recomendación marcada en una generación anterior (ya invalidada) podía colarse en el `.build` exportado. Ahora las marcas se reinician con cada resultado y la exportación filtra contra el resultado vigente.
- **Mutación del plan al exportar**: `exportGggBuild` mutaba el plan de entrada al anotar la mejora de skill (copia superficial); dos exports con el mismo objeto duplicaban texto. Corregido con copia por elemento.
- Menor: el placeholder de importación aún mostraba el formato propietario eliminado (`{"formatVersion": 1}`).

Notas sin cambio de código: la afirmación de fidelidad de la sesión 3 se apoyaba en el fixture oficial Titan Warrior, que **no contiene** `level_interval`, `weapon_set` ni coordenadas; ahora existe un test con un plan sintético que ejercita todos los campos documentados. `meta.archetypes` sigue hardcodeado y sin uso en el frontend (P3). `demoMercenary.build` no lo usa ningún código ni test (P3). La reproducibilidad depende de Node 24+ en PATH (en esta máquina solo existe el Node 24.15 empaquetado con kimi-desktop).

## Qué funciona (verificado en esta sesión, incluido checkout limpio)

- **Integridad del repo**: `server/data/patches.json` estaba ignorado por un patrón `.gitignore` demasiado amplio (`data`); corregido a `/data/` y versionado. Verificado con `git ls-files` y con clon limpio (ver «Pruebas ejecutadas»).
- **Separación personaje actual vs plan `.build`**: un `.build` oficial de GGG ya NO se convierte en snapshot del personaje. Importarlo crea un **BuildTargetPlan** (sección «Build objetivo», con aviso «no es tu personaje actual») y conserva el objeto oficial crudo. El motor nunca ejecuta reglas de equipo/quality/mods/resistencias sobre inventory_slots del planner. Eliminado el `archetype: "mercenary-crossbow"` hardcodeado. Test obligatorio incluido: importar «Titan Warrior» nunca menciona ballesta, quality ni «0 mods».
- **Fidelidad del `.build`**: importar y reexportar conserva `level_interval`, `weapon_set`, `additional_text` (con markup), coordenadas `slot_x/slot_y`, `author` y `link` (tests con `toEqual` sobre el fixture oficial y, desde la sesión 4, sobre un plan sintético que ejercita todos los campos documentados y los no documentados). Las pérdidas se listan expresamente en el informe. `ascendancyId` (id oficial) separado del nombre visible. `unique_name` solo se exporta si es verificada (por defecto no, y se reporta). En la UI y docs: «válido contra el esquema GGG», nunca «probado en el juego».
- **Persistencia**: restauración corregida para React Strict Mode (efecto idempotente, no se queda en «Restaurando…»); el id solo se guarda en localStorage tras un `POST /api/character` exitoso (perfil real en SQLite). Verificado en navegador, en producción y desarrollo: guardar vida=2150 → recargar → exactamente vida=2150, y la respuesta de guardado se comprueba (200 + `profile.life === 2150`).
- **Recomendaciones aplicadas**: el servidor ya no las descarta — se incrustan como texto legible en `description` («Mejoras planificadas: 1) …») y en `additional_text` del slot/skill relacionado. Test que comprueba el contenido del archivo, no solo el HTTP 200.
- **Mercado**: `verified: true` exige moneda primaria reconocida (test de primaria desconocida); las tasas transportan origen (`live`/`cache-fresh`/`cache-stale`/`fixture`) y verificación; tasas fixture/stale nunca justifican afirmar que una compra entra en el presupuesto (test de quote live + rates stale).
- **Datos**: parche local actualizado a `content: 0.5.4`, `hotfix: f`, `asOf: 2026-08-12`, fuente: hilo oficial «0.5.4f Hotfix» (Stacey_GGG, foro de parches de pathofexile.com) — verificado en el foro oficial en esta sesión.
- **Fixture PoB2 real**: los tests del adaptador PoB usan un código REAL extraído de la issue #2412 del repo PathOfBuilding-PoE2 (decodifica a XML `PathOfBuilding2` de 12 929 bytes, clase Ranger), con `PROVENANCE.txt`; los payloads sintéticos solo cubren los límites de seguridad.
- `docs/PLAN.md` reescrito: ya no documenta el formato propietario eliminado.

## Cómo abrir la aplicación

```bash
cd exile-copilot
npm install
npm run dev    # http://localhost:7100 (frontend + API en un solo servidor)
```

## Cómo probar el flujo principal

Manual: «Cargar ejemplo» → editar vida → «Guardar correcciones» → presupuesto → «Generar recomendaciones» → marcar una → «Descargar .build» → ver informe → recargar (el personaje vuelve con la vida exacta). Importar un `.build` oficial lo añade como build objetivo (plan), no como personaje.

Automatizada (navegador real, Edge):

```bash
npm run build
npm run test:browser        # producción
node scripts/browser-smoke.mjs --all   # producción + desarrollo (Strict Mode)
```

## Capturas

`docs/screenshots/flujo-prod.png` y `flujo-dev.png` (capturas reales de esta sesión).

## Decisiones tomadas (sesión 3)

- El `.build` oficial se trata siempre como PLAN: la importación aterriza en «Build objetivo»; solo los códigos PoB rellenan un personaje parcial.
- Fidelidad vía conservación del objeto crudo en `target.plan`: la reexportación parte del plan original y declara cualquier pérdida.
- Las mejoras aplicadas se exportan como texto legible (description/additional_text), no como datos estructurados inventados.
- La restauración del personaje hace una doble petición GET bajo Strict Mode (idempotente); se priorizó corrección sobre ahorro.

## Supuestos

- GGG no procesa nuevas apps OAuth → adaptador desactivado por flag.
- Sin tabla oficial de nombres de PassiveSkills/BaseItemTypes: los nombres legibles de pasivas importadas se muestran como «no verificado».
- PoB/POBb.in: adaptador básico (Hito 6 pendiente).

## Pruebas ejecutadas (salidas reales; reverificadas en la sesión 4 tras las correcciones)

- `npx tsc -b` → 0 errores.
- `npx vitest run` → **8 archivos, 74/74 verdes** (65 previas + 9 regresiones de auditoría; reverificado en la sesión 5).
- `npm run lint` → 0 errores.
- `npx vite build` → OK (~150 kB gzip).
- `node scripts/browser-smoke.mjs --all` → **20/20** (10 comprobaciones en producción + 10 en desarrollo con Strict Mode): carga, sin «Restaurando…» atascado, demo, guardado 200 con vida=2150, 3 recomendaciones, descarga `.build`, esquema GGG completo, recomendación aplicada incrustada en description, vida restaurada exactamente 2150.
- Verificación desde **checkout limpio**: ver sección siguiente.

## Verificación desde checkout limpio

Realizada sobre un `git clone` del commit final (no sobre el working tree): `npm install` → `npx tsc -b` (0 errores) → `npx vitest run` (65/65) → `npm run lint` (0 errores) → `npx vite build` (OK) → `node scripts/browser-smoke.mjs --all` (**20/20**, producción y desarrollo con Strict Mode). `server/data/patches.json` presente en el clon (`git ls-files` lo confirma). Clon eliminado tras la verificación; sin procesos residuales.

## Funciones incompletas

- Tabla de ids oficiales (PassiveSkills/BaseItemTypes): pendiente a petición expresa del propietario (no añadida en esta fase).
- Adaptador PoB: extracción básica. POBb.in: sin vía pública documentada.
- Explicador LLM: stub desactivado.

## Errores conocidos

- Precios de objetos raros: «No verificado» (poe.ninja solo cotiza únicos y divisa).
- Bundle JS > 500 kB (aviso de Vite sin impacto funcional).

## Riesgos legales o de datos

- Solo API económica documentada de poe.ninja desde servidor, con User-Agent, caché/ETag. Sin scraping ni endpoints internos. Cero secretos en el repo.

## Próximo paso recomendado

Cuando el propietario lo autorice: tabla versionada de ids oficiales para resolver nombres legibles y exportar skills/pasivas del arquetipo con ids verificables.

## Archivos importantes

- `README.md`, `docs/PLAN.md`, `HANDOFF.md`.
- `shared/domain.ts` (snapshot), `shared/gggBuildPlanner.ts` (oficial + BuildTargetPlan), `shared/api.ts`.
- `server/importers/gggBuildImporter.ts` (→ plan), `server/exporters/gggBuildExporter.ts` (fidelidad + informe + mejoras planificadas).
- `server/services/poeninja.ts` (rates con origen/verificación), `server/engine/`, `server/data/patches.json`.
- `server/fixtures/ggg/titanWarrior.build.json` (oficial verbatim), `server/fixtures/pob2/` (código PoB2 real + procedencia), `server/fixtures/demoSnapshot.json`.
- `src/` (frontend, Strict Mode), `scripts/browser-smoke.mjs`, `tests/`.
