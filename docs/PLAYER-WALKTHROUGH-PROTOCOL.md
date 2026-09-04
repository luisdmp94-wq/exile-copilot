# Recorridos reales obligatorios antes de publicar

La suite automática demuestra contratos, pero no demuestra que una persona
entienda la pantalla. La barrera de PoE2 1.0 exige por ello dos recorridos
manuales independientes: uno con un jugador nuevo y otro con un jugador
experto.

## Reglas

- Usar el cliente real del parche que se quiere publicar.
- No dirigir los clics ni explicar la interfaz durante el recorrido. Solo se
  puede aclarar qué tarea intenta completar la persona.
- No registrar nombre de cuenta, correo, IP, identificadores ni conversación
  privada. El artefacto contiene observaciones del producto, no datos del
  jugador.
- Un recorrido bloqueado se conserva como evidencia, pero no aprueba el
  lanzamiento. Después de corregirlo se repite con otra ejecución fechada.
- Cada rol necesita su propio artefacto; copiar el mismo informe dos veces no
  cuenta como dos perspectivas.

## Tarea común

1. Entrar desde la portada y encontrar sin ayuda dónde comenzar.
2. Pegar un objeto copiado del juego con `Ctrl+Alt+C`.
3. Explicar con sus propias palabras que Exile Copilot enseña el paso, pero la
   acción se realiza dentro de PoE2.
4. Realizar una acción de Crafting segura dentro del juego y pegar el resultado
   completo de vuelta.
5. Explicar por qué continuaría, se detendría o cambiaría de base.

El jugador nuevo debe completar la tarea sin conocer previamente la estructura
de Exile Copilot. El experto debe comprobar además que la página no afirma
pools, pesos, probabilidades ni resultados garantizados que no pueda demostrar.

## Plantilla del artefacto

El informe usa este formato exacto y versionado. Las claves técnicas permiten
que la auditoría compruebe que el texto y el manifiesto describen la misma
sesión; no deben traducirse ni cambiarse. Debe haber al menos tres observaciones
concretas sobre lo que la persona hizo, entendió o no encontró.

```text
EXILE COPILOT — RECORRIDO REAL
Formato: EC-PLAYER-WALKTHROUGH-1
Rol: new-player
Parche: 1.0
Idioma: es
Fecha: 2026-12-11
Resultado: pass

PUNTOS COMPROBADOS
- [x] foundStartingAction · Encontró la primera acción sin ayuda
- [x] importedGameItem · Importó un objeto real del juego
- [x] understoodInGameBoundary · Entendió que el craft ocurre dentro de PoE2
- [x] returnedObservedResult · Pegó de vuelta el resultado observado
- [x] explainedStopDecision · Explicó la decisión de continuar o parar

BLOQUEOS
- Ninguno

OBSERVACIONES
- Encontró la entrada principal sin recibir instrucciones del observador.
- Explicó que la moneda se utiliza dentro del juego y no en la página.
- Volvió con el resultado completo y justificó por qué debía detenerse.
```

Para el segundo recorrido, `Rol` será `expert-player`. Si la sesión queda
bloqueada, `Resultado` será `blocked`, se desmarcarán los puntos no completados
y `BLOQUEOS` enumerará los problemas concretos en el mismo orden que el
manifiesto.

## Registro verificable

No se debe editar el manifiesto ni calcular la huella a mano. Preparar un JSON
temporal con los mismos datos observados, añadiendo un `id` único y las tres o
más observaciones, y ejecutar:

```console
npm run record:walkthrough -- --input <informe.json>
```

El comando valida las relaciones entre resultado, puntos y bloqueos; genera el
informe versionado bajo `docs/evidence/player-walkthroughs/<parche>/`, calcula
su SHA-256 y añade una entrada a `server/data/playerWalkthroughs.json`. Rechaza
ids, rutas o artefactos repetidos y no sobrescribe evidencia anterior. El JSON
temporal no debe contener datos personales y puede eliminarse después de
comprobar el registro.

Ejemplo mínimo aprobado:

```json
{
  "id": "new-player-1.0-2026-12-11-a",
  "role": "new-player",
  "patch": "1.0",
  "locale": "es",
  "observedAt": "2026-12-11",
  "outcome": "pass",
  "checkpoints": {
    "foundStartingAction": true,
    "importedGameItem": true,
    "understoodInGameBoundary": true,
    "returnedObservedResult": true,
    "explainedStopDecision": true
  },
  "blockers": [],
  "observations": [
    "Encontró la entrada principal sin recibir instrucciones del observador.",
    "Explicó que la moneda se utiliza dentro del juego y no en la página.",
    "Volvió con el resultado completo y justificó por qué debía detenerse."
  ]
}
```

`npm run readiness:1.0` vuelve a leer el informe, comprueba su huella y contrasta
cabecera, metadatos, cinco puntos, bloqueos y observaciones con el manifiesto.
Un archivo vacío o una checklist incoherente no aprueban aunque su SHA-256 sea
correcto. Solo aprobará cuando existan recorridos íntegros, posteriores al
lanzamiento y sin bloqueos para `new-player` y `expert-player`.
