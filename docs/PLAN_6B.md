# Hito 6B — Sesiones adaptativas de decisión

> **Documento histórico: la especificación con la que se construyó el
> prototipo.** El hito está implementado, corregido e **integrado en `main`**
> (`dd671178`). Lo que quedó finalmente en el producto —incluidas las nueve
> correcciones de la auditoría— se describe en `docs/HITO_6B.md`.

Especificación breve sobre el código inspeccionado (diario 5A/5B + mentor 6A).
No es un segundo diario ni un chatbot con memoria de mensajes.

## Qué se reutiliza

- `journal_entries` + `journal_state.primary_entry_id`: **una sola próxima acción**.
- Revisión `buildRecommendationMemory()` y 409 `memoria-diario-obsoleta`.
- Transiciones del diario: `active` → `waiting_result` → `completed`/`cancelled`.
- Motor determinista: sin LLM, sin precios nuevos, sin crafts inventados.
- El resultado libre del jugador sigue siendo evidencia, nunca estadística.

## Qué se añade (aditivo SQLite)

Tablas nuevas, sin borrar ni reescribir payloads 5A/5B:

- `decision_sessions`: una sesión activa por personaje (objetivo, hipótesis,
  restricciones, incógnitas, conclusión, huella de personaje).
- `decision_session_events`: historial **inmutable** de transiciones, acotado
  (máx. 40 por sesión) e idempotente (`idempotency_key` UNIQUE).
- `journal_state.active_session_id`: enlace a la sesión vigente.

La sesión **envuelve** la acción principal del diario: no duplica el paso activo.

## Estados de sesión

`active` → `waiting_result` → `paused` | `completed` | `discarded` | `reopening`

Transiciones ilegales se rechazan (400). Nunca hay dos acciones activas:
proponer una nueva cierra o bloquea la anterior en la misma transacción.

Conclusiones: continuar, cambiar estrategia, pausar, descartar, completar,
reabrir (solo como **candidata**, nunca como hecho demostrado).

## Reglas de producto (motor + sesión)

1. Incógnita crítica + acción irreversible → no se autoriza; el paso pide la evidencia.
2. Restricción core: conflicto explícito; no se sustituye por la siguiente puntuada.
3. Resultado inesperado valioso → se puede proteger y cambia el plan.
4. Descarte causal + condición de reapertura; evidencia compatible → candidata.
5. Pieza a sustituir pronto o presupuesto superado (misma moneda, coste conocido)
   → pausar / conservar recurso, no «fracaso».
6. Feedback subjetivo ≠ medición objetiva.
7. Perfil incompatible (huella distinta) → no se reutiliza la sesión en silencio.

## API

Bajo `/journal/:characterId/session*`, siempre con `journalRevision` e
`idempotencyKey`. Un 409 invalida la acción visible antes de recargar.

## Fuera de alcance

LLM, crafting, vídeo, precios nuevos, persistir el hilo 6A, mecánicas PoE2.
