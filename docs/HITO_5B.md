# Hito 5B — memoria como contexto del motor

## Objetivo

Conectar el Character Journal con el motor determinista sin convertir texto
libre en estadísticas ni introducir un LLM. La memoria cambia la siguiente
decisión mediante dos reglas explícitas:

1. Si existe una acción principal `active` o `waiting_result`, el motor se
   detiene, devuelve cero recomendaciones y no consulta precios.
2. Si el jugador completó una recomendación pero el perfil actual aún activa
   la misma regla, el motor no repite la mejora: genera una única acción para
   reconciliar el resultado guardado con «Mi personaje» y volver a calcular.

## Flujo de datos

- `buildRecommendationMemory()` proyecta el diario completo a una vista de
  tamaño limitado: acción principal y diez resultados recientes.
- La interfaz envía únicamente la revisión que ha visto (`journalRevision`).
- El servidor carga el diario autoritativo desde SQLite. Si la revisión de la
  interfaz está obsoleta responde `409 memoria-diario-obsoleta`.
- La memoria forma parte de `inputFingerprint`; cualquier cambio invalida las
  recomendaciones anteriores.
- `memoryImpact` explica las entradas utilizadas, el bloqueo por acción activa
  y las recomendaciones anteriores que continúan activándose.

## Regla de exactitud

El campo `result` es evidencia aportada por el jugador. Puede mostrarse en el
historial, pero el motor **no lo analiza** para extraer resistencias, mods,
precios o cantidades. Por ejemplo, escribir «ahora tengo 75 %» no modifica la
resistencia del perfil. El jugador debe actualizar el campo estructurado y
volver a generar.

Las acciones de reconciliación:

- no consultan precios;
- no modifican objetos;
- conservan una fuente `user` que enlaza conceptualmente con la entrada del
  diario;
- muestran por qué el perfil y la memoria están en conflicto.

## Límites deliberados

- Solo un resultado vinculado a una recomendación estructurada puede detectar
  que la misma regla se repite. Las notas y crafts manuales bloquean tareas
  paralelas mientras estén activos, pero no se asignan a una regla por texto.
- No hay extracción automática de datos desde el resultado.
- No hay conversación libre ni LLM; ese será otro hito y deberá operar sobre
  estos contratos, nunca sustituirlos.

## Verificación

- Unidad: bloqueo sin consultas de precio, reconciliación sin interpretar texto
  y fingerprint sensible a la revisión de memoria.
- Integración: acción activa, revisión obsoleta y resultado completado que
  cambia la siguiente respuesta.
- Navegador: ciclo completo en producción y Strict Mode, incluida recarga,
  bloqueo, resultado y reconciliación, con SQLite temporal.
