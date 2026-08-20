# HANDOFF — Exile Copilot

> Informe para el propietario. Última actualización: sesión 8 (consistencia y reproducibilidad), 2026-08-20.

## Sesión 8 — consistencia y reproducibilidad

- **Aviso de importación actualizado**: ya no afirma que las pasivas «no son resolubles». El aviso vigente dice que las pasivas se resuelven con el registro oficial cuando el id existe, que los ids desconocidos permanecen visibles y marcados como no verificados, y que los nombres de skills/support skills todavía no se resuelven por falta de fuente incorporada. Regresión que falla con el mensaje antiguo.
- **Reproducibilidad byte a byte**: `.gitattributes` fija `eol=lf` para `server/data/passives/*.json`; regenerar el registro desde un checkout limpio de Windows produce exactamente los mismos bytes y deja `git status` limpio (verificado, no solo comparación semántica).
- **Ascendencias parcialmente conocidas**: cuando la fuente no publica el nombre pero sí la clase (Ranger2, Druid3), la UI muestra ambas realidades por separado — «Nombre no verificado · clase Ranger (Ranger2)» — vía `describeAscendancy` (helper puro con tests).
- Este documento revisado por completo: las secciones antiguas quedan marcadas como históricas y los supuestos/pendientes reflejan el estado real tras el Hito 4A.

## Sesión 7 — Hito 4A: resolución de pasivas y ascendencias (export oficial de GGG)

- **Registro interno** derivado solo del export oficial `grindinggear/poe2-skilltree-export`,
  commit fijado `1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6`, SHA-256 del `data.json`
  `f83c94ce7b09f2bfc5b3b1d63523c2ab3d2582d0e964f6aeec34b8b0390abcfe` (5 141 380 bytes),
  obtenido el 2026-08-20. Datos de Grinding Gear Games; **licencia explícita: no encontrada**.
  4912 nodos, 12 clases y 25 ascendencias; sin sprites ni recursos gráficos.
- **El parche no se atribuye a la fuente**: el commit de origen se etiqueta a sí mismo como
  `0.5.2`; nosotros solo declaramos `testedAgainstPatch: "0.5.4f"` (compatibilidad probada).
  Por eso el artefacto se llama `passiveRegistry.1e9eb2d8.json` y no `passives.0.5.4f.json`.
- **Proceso offline y reproducible** (`scripts/build-passive-registry.ts`): verifica el
  SHA-256 de la revisión fijada, valida entrada y salida con esquemas estrictos y falla
  con mensaje claro si la estructura oficial cambia. En runtime no hay red ni descargas.
- **Servicio de solo lectura** (`server/registry/passiveRegistry.ts`): id de pasiva → nombre
  inglés verificado; ascendancy id → nombre y clase; desconocido → explícitamente no
  verificado con el id crudo siempre disponible. El nombre nunca se deduce del id.
- **Integración**: `POST /import/build` devuelve `resolution` en PARALELO al plan; el `.build`
  crudo no se toca (test: importar, resolver y reexportar Titan Warrior es verbatim).
  Titan Warrior resuelve **34/34** pasivas y `Warrior1` → **Titan** (clase Warrior). La UI
  muestra nombre inglés + id, y los desconocidos como «No verificado».
- **Aviso obligatorio** visible en la interfaz: «This product isn't affiliated with or
  endorsed by Grinding Gear Games in any way.»
- Corregido de paso el desfase de `MAX_MARKUP_TAG_LENGTH`: una etiqueta de exactamente 32
  caracteres ya respeta el límite documentado (prueba de frontera 32/33 que fallaba antes).
- Verificado: `tsc -b` 0 errores, **98/98** tests, ESLint 0 errores, build OK, 20/20 smoke
  (prod+dev) y 14/14 comprobaciones de navegador del flujo del registro.
- Limitaciones: la fuente publica algunas ascendencias sin nombre (`Ranger2`, `Druid3`) y se
  marcan como no verificadas; no se resuelven gemas ni supports (fuera de alcance).

## Sesión 5 — validación manual dentro del juego y corrección de markup

- **Validación manual en PoE2 real (2026-08-20)**: el propietario importó en el juego un `.build` exportado por Exile Copilot (plan Titan Warrior con mejora aplicada incrustada). PoE2 importó correctamente el nombre y la ascendencia, las **34 pasivas con sus rutas**, las **4 habilidades** (Boneshatter, Earthquake, Infernal Cry, Shockwave Totem) y los **9 huecos de equipo**, incluido el texto añadido al anillo «Mejora planificada: Cubrir resistencias elementales hasta el cap». Evidencia: [árbol de pasivas](docs/screenshots/ingame-arbol-pasivas.jpg), [habilidades](docs/screenshots/ingame-habilidades.jpg), [equipo con la mejora incrustada](docs/screenshots/ingame-equipo-mejora-incrustada.jpg). Esto es una validación **manual y puntual de ese archivo**, distinta de las pruebas automatizadas (que validan contra el esquema documentado); el resto de exports siguen siendo «válidos contra el esquema», no «probados en el juego».
- **Corregido**: las recomendaciones de la regla «Acercarse a la build de referencia» mostraban restos del markup oficial («Increased Armour}; …»). Causa: las pistas de los inventory_slots se limpiaban línea a línea, pero los bloques `<tag>{...}` del markup GGG abren y cierran en líneas distintas, así que la llave de cierre sobrevivía en la última línea del bloque. Ahora el markup se elimina sobre el texto completo antes de trocearlo, con un parser de **un solo recorrido O(n)** (pila que distingue la llave de un wrapper de una llave literal); las llaves/paréntesis de texto legítimo fuera de un wrapper no se tocan y un wrapper sin cerrar se conserva verbatim. La primera versión del arreglo era iterativa y cuadrática: medida en esta máquina, 50 000 niveles anidados (342 kB, dentro del límite de 2 MB de la API) bloqueaban el servidor 25 960 ms, frente a 3,5 ms con el parser actual y salida idéntica. Se limitan además las pistas incorporadas a una recomendación (`MAX_PLAN_HINTS` 40, `MAX_LISTED_GAPS` 12, con el resto declarado por número). Regresiones en `tests/unit/auditRegressions.test.ts` (fallaban antes de cada arreglo). 80/80 tests.

## Sesión 4 — auditoría independiente y correcciones

Las afirmaciones de la sesión 3 se verificaron de forma independiente: `tsc -b` (0 errores), 65/65 tests, ESLint 0 errores, build OK y 20/20 comprobaciones de navegador (Edge, prod + dev) reproducidas en esta sesión. El esquema `.build` se contrastó contra la documentación oficial de GGG (pathofexile.com/developer/docs/game), los endpoints de poe.ninja contra poe.ninja/docs/api, el hilo «0.5.4f Hotfix» (Stacey_GGG) contra el foro oficial y el fixture PoB2 contra la issue #2412 (coincide byte a byte). No se encontraron P0/P1. Defectos P2 corregidos (72/72 tests tras las correcciones, con regresiones que fallaban antes de cada arreglo):

- **`level_interval`**: la doc oficial lo define como `?(array of uint, or uint)`; el esquema solo aceptaba tuplas de exactamente 2 y rechazaba archivos válidos según la doc. Ahora acepta uint o array de uint.
- **Campos no documentados**: un `.build` con campos fuera del esquema v1 los perdía en silencio al importar/reexportar. Ahora los esquemas son *loose*: se conservan tal cual, el importador los declara en warnings y la reexportación los preserva (incluidos los del objeto raíz).
- **`primaryCurrency`**: con una moneda primaria no reconocida la API respondía `"exalted"` (un desconocido convertido en afirmación concreta). Ahora responde `null`; los quotes individuales conservan su nota «No verificado».
- **Mejoras aplicadas obsoletas**: una recomendación marcada en una generación anterior (ya invalidada) podía colarse en el `.build` exportado. Ahora las marcas se reinician con cada resultado y la exportación filtra contra el resultado vigente.
- **Mutación del plan al exportar**: `exportGggBuild` mutaba el plan de entrada al anotar la mejora de skill (copia superficial); dos exports con el mismo objeto duplicaban texto. Corregido con copia por elemento.
- Menor: el placeholder de importación aún mostraba el formato propietario eliminado (`{"formatVersion": 1}`).

Notas sin cambio de código: la afirmación de fidelidad de la sesión 3 se apoyaba en el fixture oficial Titan Warrior, que **no contiene** `level_interval`, `weapon_set` ni coordenadas; ahora existe un test con un plan sintético que ejercita todos los campos documentados. `meta.archetypes` sigue hardcodeado y sin uso en el frontend (P3). `demoMercenary.build` no lo usa ningún código ni test (P3). La reproducibilidad depende de Node 24+ en PATH (en esta máquina solo existe el Node 24.15 empaquetado con kimi-desktop).

## HISTÓRICO — sesión 3: qué funcionaba entonces

> Redactado en la sesión 3 y conservado como historial. Varios puntos han
> evolucionado después: la sesión 5 añadió una validación manual dentro del
> juego y la sesión 7 incorporó el registro oficial de pasivas. El estado
> vigente es el de las secciones de sesión más reciente y «Pruebas ejecutadas».

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

`docs/screenshots/flujo-prod.png` y `flujo-dev.png` (smoke automatizado, regeneradas en cada ejecución) e `ingame-*.jpg` (validación manual dentro del juego, sesión 5).

## HISTÓRICO — decisiones tomadas (sesión 3)

- El `.build` oficial se trata siempre como PLAN: la importación aterriza en «Build objetivo»; solo los códigos PoB rellenan un personaje parcial.
- Fidelidad vía conservación del objeto crudo en `target.plan`: la reexportación parte del plan original y declara cualquier pérdida.
- Las mejoras aplicadas se exportan como texto legible (description/additional_text), no como datos estructurados inventados.
- La restauración del personaje hace una doble petición GET bajo Strict Mode (idempotente); se priorizó corrección sobre ahorro.

## Supuestos (vigentes)

- Adaptador GGG OAuth desactivado por flag (`GGG_OAUTH_ENABLED=false`). No hemos verificado el estado actual del proceso de solicitudes OAuth de GGG; activarlo exigiría comprobarlo primero.
- Pasivas y ascendencias SÍ se resuelven a su nombre inglés oficial con el registro derivado del export de GGG (Hito 4A); los ids fuera del registro se muestran como «No verificado». Sigue sin existir fuente incorporada para `BaseItemTypes`: los nombres de skills y support skills no se resuelven todavía.
- PoB/POBb.in: adaptador básico (Hito 6 pendiente).

## Pruebas ejecutadas (salidas reales de la sesión 8, 2026-08-20)

- `npx tsc -b` → 0 errores.
- `npx vitest run` → **9 archivos, 102/102 verdes**.
- `npm run lint` → 0 errores.
- `npx vite build` → OK (~151 kB gzip).
- `node scripts/browser-smoke.mjs --all` → **20/20** (10 comprobaciones en producción + 10 en desarrollo con Strict Mode).
- Flujo del registro en navegador (plan Titan Warrior): resolución 34/34 visible, nombre inglés + id, ascendencia Titan, procedencia y aviso de GGG.
- Verificación desde **checkout limpio**: ver sección siguiente.

## Verificación desde checkout limpio

Realizada sobre un `git clone` del commit final (no sobre el working tree): `npm install` → `npx tsc -b` (0 errores) → `npx vitest run` (102/102) → `npm run lint` (0 errores) → `npx vite build` (OK). Además, regenerar el registro de pasivas desde el `data.json` fijado (`npx tsx scripts/build-passive-registry.ts --input …`) produce **exactamente los mismos bytes** que el artefacto versionado y deja `git status` limpio, gracias a la regla `eol=lf` de `.gitattributes`. Clon eliminado tras la verificación; sin procesos residuales.

## Funciones incompletas

- Resolución de skills y support skills (`BaseItemTypes`): sin fuente incorporada; sus nombres siguen sin resolverse. (La resolución de PassiveSkills y ascendencias está TERMINADA — Hito 4A.)
- Adaptador PoB: extracción básica. POBb.in: sin vía pública documentada.
- Explicador LLM: stub desactivado.

## Errores conocidos

- Precios de objetos raros: «No verificado» (poe.ninja solo cotiza únicos y divisa).
- Bundle JS > 500 kB (aviso de Vite sin impacto funcional).

## Riesgos legales o de datos

- Solo API económica documentada de poe.ninja desde servidor, con User-Agent, caché/ETag. Sin scraping ni endpoints internos. Cero secretos en el repo.

## Próximo paso recomendado

La resolución de PassiveSkills y ascendencias ya está hecha (Hito 4A, registro oficial versionado). El siguiente paso natural, cuando el propietario lo autorice, es decidir una fuente oficial verificable para `BaseItemTypes` y resolver así los nombres de gemas y supports. No iniciado.

## Archivos importantes

- `README.md`, `docs/PLAN.md`, `HANDOFF.md`.
- `shared/domain.ts` (snapshot), `shared/gggBuildPlanner.ts` (oficial + BuildTargetPlan), `shared/api.ts`.
- `server/importers/gggBuildImporter.ts` (→ plan), `server/exporters/gggBuildExporter.ts` (fidelidad + informe + mejoras planificadas).
- `server/services/poeninja.ts` (rates con origen/verificación), `server/engine/`, `server/data/patches.json`.
- `server/fixtures/ggg/titanWarrior.build.json` (oficial verbatim), `server/fixtures/pob2/` (código PoB2 real + procedencia), `server/fixtures/demoSnapshot.json`.
- `src/` (frontend, Strict Mode), `scripts/browser-smoke.mjs`, `tests/`.
