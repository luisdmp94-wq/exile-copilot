# Preparación de Exile Copilot para PoE2 1.0

Objetivo de lanzamiento: **Path of Exile 2 1.0 — 11 de diciembre de 2026**.

Fuente del anuncio: publicación oficial de Path of Exile 2 en Steam durante gamescom 2026, registrada en `server/data/patchCompatibility.json`.

## Regla principal

Un parche nuevo nunca hereda la compatibilidad del anterior. Si su id no tiene una entrada completa en el registro, `/api/health` devuelve `review-required` y Crafting deja de recomendar monedas o rutas. El Mentor aplica el mismo bloqueo.

Cada área declara `evidenceIds` concretos. No basta con marcar una capacidad como cubierta: la API solo puede usar los snapshots o registros enumerados expresamente para ese parche.

`covered` significa que el alcance descrito fue contrastado. No significa que la aplicación conozca todos los afijos, resultados o probabilidades. `limited` permite una función conservadora con sus límites visibles. `review-required` la detiene.

## Activación de un parche nuevo

Antes de tocar `DEFAULT_PATCH`, ejecutar:

```text
npm run readiness:1.0
```

Este informe no cambia datos ni activa funciones. `npm run verify:1.0` es la
barrera estricta: primero exige que 1.0 figure como publicado, que exista en
`patches.json`, que las cinco áreas tengan evidencia nueva propia, que el
registro de pasivas coincida y que `DEFAULT_PATCH` ya apunte exactamente a 1.0;
solo después permite ejecutar la suite completa de publicación.

1. Añadir el parche a `server/data/patches.json` con fecha y fuente oficial.
2. Añadir una cobertura a `server/data/patchCompatibility.json`. Debe incluir exactamente las cinco áreas del contrato y los ids exactos de sus evidencias.
3. Mantener el estado global en `review-required` mientras alguna capacidad esencial no haya sido contrastada.
4. Validar textos de objetos copiados desde el cliente, incluidos prefijos, sufijos, rareza, nivel de objeto y estados especiales.
5. Volver a observar las monedas básicas y comprobar sus transiciones normal → mágico → raro.
6. Revisar Essences y Alloys con sus tooltips reales; no inferir efectos a partir del nombre.
7. Actualizar el registro de pasivas, su `testedAgainstPatch` y el `evidenceId` autorizado. La importación del `.build` seguirá funcionando si falta, pero no resolverá nombres antiguos.
8. Confirmar ligas y mercado sin convertir una cotización temporal en un precio garantizado.
9. Ejecutar `verify:release` y comprobar manualmente el recorrido de un jugador nuevo y uno avanzado.
10. Cambiar `DEFAULT_PATCH` al nuevo id únicamente cuando los puntos anteriores
    estén cerrados y ejecutar `npm run verify:1.0` como comprobación final.

## Criterios mínimos para 1.0

- `/api/health` identifica exactamente `1.0`, no una versión anterior ni un valor sin hotfix.
- Las cinco áreas de cobertura aparecen una sola vez y llevan evidencia concreta.
- Un personaje de un parche sin revisar ve el bloqueo comprensible de Crafting.
- El importador no pierde información del nuevo formato de tooltip.
- El lector de objetos exige el parche activo y permanece cerrado hasta que `item-import` autorice sus fixtures.
- El guía nunca llama “mejor” a una acción que solo es estructuralmente legal.
- Aleatoriedad, datos ausentes y condiciones de parada siguen visibles.
- El mentor contextual no contradice el estado de compatibilidad.
- `/api/crafting/knowledge` exige parche, devuelve su cobertura y no carga snapshots no autorizados.
- `/api/market/prices` exige parche y no consulta ni muestra precios hasta que `market` tenga una fuente autorizada.
- Un `.build` de 1.0 se conserva íntegro aunque el registro de pasivas aún no esté listo; ningún id se presenta como resuelto usando datos de 0.5.4f.
- Tests unitarios, integración y recorridos reales de navegador pasan sin errores de consola ni API.

## Estado actual

La cobertura de `0.5.4f` es **limitada y explícita**: importación de objetos y árbol de pasivas tienen cobertura registrada; Crafting básico, avanzado y mercado conservan límites visibles. La versión `1.0` está registrada únicamente como objetivo anunciado, no como parche compatible. Crafting, Mentor, conocimiento de monedas y resolución de pasivas fallan de forma cerrada hasta su revisión.
