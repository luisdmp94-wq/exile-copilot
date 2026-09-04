# Preparación de Exile Copilot para PoE2 1.0

Objetivo de lanzamiento: **Path of Exile 2 1.0 — 11 de diciembre de 2026**.

Fuente del anuncio: publicación oficial de Path of Exile 2 en Steam durante gamescom 2026, registrada en `server/data/patchCompatibility.json`.

## Regla principal

Un parche nuevo nunca hereda la compatibilidad del anterior. Si su id no tiene una entrada completa en el registro, `/api/health` devuelve `review-required` y Crafting deja de recomendar monedas o rutas. El Mentor aplica el mismo bloqueo.

Cada área declara `evidenceIds` concretos. No basta con marcar una capacidad como cubierta: la API solo puede usar los snapshots o registros enumerados expresamente para ese parche.

Cada id debe existir además en `server/data/releaseEvidence.json`. El catálogo
liga la evidencia a una única área y declara el parche que la fuente demuestra.
Las entradas nuevas fijan mediante SHA-256 tanto un recibo semántico como el
archivo fuente preservado; cambiar cualquiera de los dos invalida la evidencia
en desarrollo y producción. Una observación con
`patch: null` puede sostener únicamente una función `limited`, con el límite
visible; nunca una cobertura `covered` ni un lanzamiento nuevo. Un fichero
ausente, una huella modificada, un recibo que contradiga el catálogo, un id de
otra área o una evidencia que declare otro parche detienen esa función durante
la ejecución, aunque su id aparezca escrito en el registro de compatibilidad.
Todas las evidencias enumeradas para un área deben ser nuevas, declarar
exactamente el parche objetivo y estar fechadas el día del lanzamiento oficial
o después. No se permite completar una cobertura mezclando una prueba válida
con otra heredada del parche anterior.

`covered` significa que el alcance descrito fue contrastado. No significa que la aplicación conozca todos los afijos, resultados o probabilidades. `limited` permite una función conservadora con sus límites visibles. `review-required` la detiene.

## Activación de un parche nuevo

Antes de tocar `DEFAULT_PATCH`, ejecutar:

```text
npm run readiness:1.0
```

Este informe no cambia datos ni activa funciones. `npm run verify:1.0` es la
barrera estricta: primero exige que 1.0 figure como publicado, que exista en
`patches.json`, que las cinco áreas tengan evidencia nueva propia, que el
registro de pasivas coincida, que el corpus reproduzca copias directas del
cliente 1.0 en español e inglés y que `DEFAULT_PATCH` ya apunte exactamente a 1.0;
solo después permite ejecutar la suite completa de publicación.

La auditoría usa además la fecha real de ejecución. Un estado `released`, una
revisión, una captura o un recorrido fechado en el futuro no pueden adelantar la
apertura: todas las fechas deben quedar entre el lanzamiento oficial y el día de
la auditoría.

1. Sustituir la ficha anunciada de `server/data/patches.json` por los metadatos
   publicados y una fuente oficial posterior al lanzamiento; nunca basta con
   cambiar `status` sin esa fuente nueva.
2. Añadir una cobertura a `server/data/patchCompatibility.json`. Debe incluir exactamente las cinco áreas del contrato y los ids exactos de sus evidencias.
3. Preservar cada fuente y registrarla con
   `npm run record:evidence -- --input <evidencia.json>` siguiendo
   `RELEASE-EVIDENCE-PROTOCOL.md`. El comando genera el recibo, fija las huellas
   de recibo y fuente y actualiza `server/data/releaseEvidence.json`; no editar
   esas rutas o hashes a mano. No atribuir un parche que no aparezca en la
   propia fuente.
4. Mantener el estado global en `review-required` mientras alguna capacidad esencial no haya sido contrastada.
5. Incorporar al corpus textos de objetos copiados desde el cliente 1.0 con
   `npm run record:item-sample`, siguiendo
   `ITEM-TEXT-CORPUS-PROTOCOL.md`. El alta contrasta procedencia, parche,
   prefijos, sufijos, rareza, nivel de objeto y estados especiales antes de
   preservar el fixture. Debe existir al menos una copia directa,
   reproducible y fechada desde el lanzamiento por cada idioma soportado
   (`es`, `en`). Los casos de parche no declarado, otro parche o derivados de
   un foro solo sirven como regresión de formato y no autorizan cobertura 1.0.
6. Volver a observar las monedas básicas y comprobar sus transiciones normal → mágico → raro.
7. Revisar Essences y Alloys con sus tooltips reales; no inferir efectos a partir del nombre.
8. Actualizar el registro de pasivas, su `testedAgainstPatch` y el `evidenceId` autorizado. La importación del `.build` seguirá funcionando si falta, pero no resolverá nombres antiguos.
9. Confirmar ligas y mercado sin convertir una cotización temporal en un precio garantizado.
10. Ejecutar `verify:release` y comprobar manualmente el recorrido de un jugador
    nuevo y uno experto siguiendo `PLAYER-WALKTHROUGH-PROTOCOL.md`. Guardar dos
    artefactos independientes con el formato versionado mediante
    `npm run record:walkthrough`; no editar a mano sus huellas ni
    `server/data/playerWalkthroughs.json`. Corregir cualquier recorrido
    bloqueado antes de repetirlo. La auditoría debe contrastar además los
    metadatos, puntos, bloqueos y observaciones del informe con el manifiesto.
11. Cambiar `DEFAULT_PATCH` al nuevo id únicamente cuando los puntos anteriores
    estén cerrados y ejecutar `npm run verify:1.0` como comprobación final.

## Criterios mínimos para 1.0

- `/api/health` identifica exactamente `1.0`, no una versión anterior ni un valor sin hotfix.
- Las cinco áreas de cobertura aparecen una sola vez y llevan evidencia concreta.
- Cada evidencia resuelve a un artefacto local íntegro, pertenece al área
  declarada, afirma exactamente `patch: "1.0"` y fue obtenida el 11 de
  diciembre de 2026 o después.
- Un personaje de un parche sin revisar ve el bloqueo comprensible de Crafting.
- El importador no pierde información del nuevo formato de tooltip.
- El informe `readiness:1.0` muestra en verde el corpus real de `es` y `en`; no
  basta con añadir ids al catálogo si los textos fuente dejan de reproducirse.
- El mismo informe muestra en verde recorridos posteriores al lanzamiento de
  un jugador nuevo y otro experto. Ambos deben completar los cinco puntos,
  carecer de bloqueos y resolver a artefactos distintos con SHA-256 válida.
  La cabecera, los metadatos, los cinco puntos y los bloqueos deben coincidir
  con el manifiesto, y cada informe debe aportar tres observaciones concretas.
- El lector de objetos exige el parche activo y permanece cerrado hasta que `item-import` autorice sus fixtures.
- El guía nunca llama “mejor” a una acción que solo es estructuralmente legal.
- Aleatoriedad, datos ausentes y condiciones de parada siguen visibles.
- El Mentor contextual y `/api/mentor/query` no contradicen el estado de
  compatibilidad: una pregunta libre o un contexto de cliente antiguo tampoco
  pueden reabrir un área en `review-required`, y el proveedor de IA no se
  consulta para esa respuesta.
- `/api/crafting/knowledge` exige parche, devuelve su cobertura y no carga snapshots no autorizados.
- `/api/market/prices` exige parche y no consulta ni muestra precios hasta que `market` tenga una fuente autorizada.
- Un `.build` de 1.0 se conserva íntegro aunque el registro de pasivas aún no esté listo; ningún id se presenta como resuelto usando datos de 0.5.4f.
- Tests unitarios, integración y recorridos reales de navegador pasan sin errores de consola ni API.

## Estado actual

La cobertura de `0.5.4f` es **limitada y explícita**: importación de objetos y árbol de pasivas tienen cobertura registrada; Crafting básico y mercado conservan límites visibles. Crafting avanzado está en `review-required` porque sus evidencias solo alcanzan 0.5.0/0.5.3: Essences y Alloys no se ofrecen, no pueden iniciar una sesión y tampoco pueden reaparecer como recomendación del Mentor hasta revisarse contra el parche activo.

`0.5.5` está registrado como **anunciado para el 4 de septiembre de 2026**, con fuente oficial del 27 de agosto, pero sus cinco áreas permanecen en `review-required`: las notas del parche y las capturas directas del cliente todavía no existen. El parche operativo sigue siendo `0.5.4f`; el orden del catálogo nunca puede adelantar automáticamente la aplicación. El Duelista anunciado pertenece al lanzamiento `1.0` del 11 de diciembre, no se trata como una clase disponible en `0.5.5`.

La transición intermedia usa exactamente el mismo contrato mediante
`npm run readiness:0.5.5`. Cuando el informe tenga evidencias reales posteriores
al 4 de septiembre y el parche operativo se haya cambiado deliberadamente,
`npm run verify:0.5.5` exige además toda la suite de publicación. Este ensayo no
cambia `targetRelease`: el objetivo público del producto continúa siendo 1.0.

La versión `1.0` tiene una ficha anunciada y una cobertura explícita con las cinco
áreas en `review-required`. No es un parche compatible: Crafting, Mentor,
conocimiento de monedas, mercado y resolución de pasivas fallan de forma cerrada
hasta su revisión posterior al lanzamiento.
