# Hito 6D — Identidad persistente de la build

## Problema

Una protección `core` ya podía frenar una sesión, pero no sobrevivía como regla
general del personaje. El mentor podía recordar un resultado y aun así perder
la identidad que el jugador quiere conservar entre decisiones.

## Alcance del primer corte

Cada personaje puede conservar reglas clasificadas como:

- **Core**: el mentor se detiene si la recomendación prioritaria choca con ella.
- **Flexible**: pertenece al plan actual, pero puede cambiarse.
- **Experimental**: se está probando; todavía no es una conclusión.
- **Descartado**: conserva el motivo y, opcionalmente, la condición para
  reconsiderarlo.

Las reglas viven en SQLite independientemente de las sesiones y forman parte de
la revisión determinista de la memoria. Un cambio invalida recomendaciones
preparadas con una revisión anterior.

## Límite de inferencia

El texto declarado por el jugador no se convierte en estadísticas ni mecánicas
de PoE2. Una regla Core solo frena automáticamente cuando:

1. está vinculada mediante `relatedItemIds` a un objeto que la recomendación
   pretende modificar; o
2. la coincidencia textual explícita satisface el mismo contrato conservador
   que ya usaban las restricciones de sesión.

Flexible, Experimental y Descartado se persisten y se muestran, pero este
primer corte no los usa para inventar recomendaciones ni conclusiones.

## Persistencia y compatibilidad

- Tabla aditiva `build_memory_entries`; no reescribe personajes, diario ni
  sesiones existentes.
- `CharacterJournal.buildMemory` tiene valor por defecto `[]`.
- `RecommendationMemory.build` forma parte de la huella y tiene un valor vacío
  compatible con respuestas anteriores.
- Archivar retira una regla de la vista y de la memoria activa sin borrar su
  fila físicamente.

## Criterios del corte

1. Añadir una regla desde el expediente.
2. Vincularla opcionalmente a un objeto equipado real.
3. Cambiar su clasificación o archivarla.
4. Conservar motivo y condición de reconsideración.
5. Cambiar la revisión del mentor al modificar la identidad.
6. Frenar una recomendación que choque con un objeto Core.
7. No afectar a `main` hasta revisión independiente.

## Cierre antes de integrar

- Regresión de navegador dedicada al formulario, persistencia tras recargar,
  reclasificación y archivado, tanto en producción como en desarrollo.
- Capturas de escritorio y móvil a 390 px, sin desbordamiento horizontal.
- Las dos rutas nuevas usan la revisión completa del diario. Si dos pestañas
  parten de la misma revisión, la primera escritura gana y la segunda recibe
  `409 memoria-diario-obsoleta`; la UI recarga la memoria y no duplica filas.
- Los ids de objetos se comprueban contra el snapshot guardado del personaje.

Experimental y Descartado siguen siendo memoria declarada y visible. No
participan en inferencias automáticas: incorporarlas a una conversación sin
convertir texto libre en hechos queda explícitamente fuera de este hito.
