# Hito 6B — Sesiones adaptativas de decisión

> La sesión **envuelve** el diario: una sola próxima acción, historial acotado,
> sin LLM y sin un segundo sistema de consejos. El motor sigue siendo
> determinista; la sesión solo puede frenar, pausar o pedir evidencia.
>
> **Estado: integrado en `main` (`dd671178`)**, con las nueve correcciones de la
> auditoría independiente aplicadas (ver más abajo). En la interfaz vive en el
> área **Mentor**, entre la acción actual del diario y la conversación.

## Qué está implementado

- Contrato compartido (`shared/decisionSession.ts`): estados, conclusiones,
  evidencia, restricciones, huella de personaje y el freno `evaluateSessionGate`.
- Persistencia aditiva SQLite: `decision_sessions`, `decision_session_events`
  (máx. 40, `idempotency_key` UNIQUE) y `journal_state.active_session_id`.
  Los payloads 5A/5B no se reescriben.
- Servicio (`server/decision/sessionService.ts`) con transiciones explícitas,
  cierre de la acción anterior en la misma transacción y reintentos
  idempotentes.
- El digest de sesión entra en `buildRecommendationMemory()` y por tanto en la
  revisión y en el fingerprint del motor.
- API bajo `/journal/:characterId/session*` con `journalRevision` e
  `idempotencyKey`. Un 409 `memoria-diario-obsoleta` invalida la acción visible
  antes de recargar.
- Interfaz «Comprobar una decisión» en español, sin identificadores internos
  (`waiting_result`, `session_gate`, `guided_decision`).

## Criterios de producto (demostrados por prueba)

1. Incógnita crítica + paso irreversible → no se autoriza; se pide la evidencia.
2. Restricción core: conflicto explícito en el hueco 1; no se sustituye por la
   siguiente puntuada.
3. Resultado inesperado valioso → se protege y cambia el plan.
4. Descarte causal + condición de reapertura; evidencia compatible → candidata,
   nunca un hecho demostrado.
5. Pieza a sustituir pronto o presupuesto superado (misma moneda, coste conocido)
   → pausa para conservar el recurso, no «fracaso».
6. Feedback subjetivo ≠ medición objetiva.
7. Perfil incompatible (huella distinta) → 409; hay que confirmar antes de seguir.
8. Esquema aditivo: tablas nuevas, payloads del diario intactos.
9. Revisión obsoleta → 409 `memoria-diario-obsoleta`.
10. La misma `idempotencyKey` replayea el resultado, no duplica el evento.
11. Nunca dos acciones activas: una sesión abierta bloquea otra; proponer una
    nueva cierra la anterior en la misma transacción.
12. Transiciones ilegales → 400 `transicion-de-sesion-invalida`.
13. La sesión envuelve el diario: `primaryEntryId` es el paso de la sesión.
14. La interfaz habla en español y no pinta jerga interna.
15. Sin LLM, sin crafts inventados y sin precios nuevos: el freno `session_gate`
    no se exporta al `.build`.

## Fuera de alcance

LLM, crafting, vídeo, precios nuevos, persistir el hilo 6A, mecánicas PoE2.

## Verificación

Ver `HANDOFF.md` (sesión 12) para los recuentos ejecutados en esta rama.

---

## Correcciones tras la auditoría independiente (rama `hito-6b-corregido`)

La auditoría `AUDITORIA_HITO_6B_GROK.md` encontró cuatro P1 y cuatro P2 y aportó
siete regresiones que fallaban 7/7 contra el patch original. Estas son las
invariantes que ahora se sostienen, con su prueba.

| # | Invariante | Dónde vive | Prueba |
|---|---|---|---|
| 1 | El personaje autoritativo es el de SQLite, leído en la transacción | `loadAuthoritativeProfile` | regresión 3 · `sessionApi` «SQLite manda» |
| 2 | La huella detecta cualquier cambio relevante y es estable ante reordenaciones | `characterSessionFingerprint` | regresión 1 |
| 3 | Tras `continue`/`change_strategy` hay una entrada viva y `activeAction` la cita | `recordSessionResult` | regresión 2 |
| 4 | Resolver la incógnita restaura la acción original completa | `blockedRecommendation` + `addSessionEvidence` | regresión 7 |
| 5 | El historial siempre deja cerrar la sesión | `RESERVED_TERMINAL_EVENTS` | regresión 4 · fronteras 39/40 |
| 6 | La retención de ocho es real y solo borra sesiones cerradas | `enforceSessionRetention` | regresión 6 · fronteras 8/9 |
| 7 | El conflicto cita la protección que posee el id | `SessionMemoryDigest.constraints` | regresión 5 |
| 8 | La interfaz no ofrece acciones que el servidor rechazará | `DecisionSessionSection` | `session-smoke` (4 comprobaciones) |
| 9 | La idempotencia está ligada a operación y payload | `operation` + `request_fingerprint` | `sessionApi` «clave reutilizada» |

### Límites reales (sin constantes decorativas)

- `MAX_SESSION_EVENTS = 40` acota el **material** (restricciones y evidencia).
- `RESERVED_TERMINAL_EVENTS = 2` son plazas EXTRA que solo pueden usar pausar,
  registrar el resultado o descartar. Tope duro real: 42 eventos.
- `MAX_SESSIONS_PER_CHARACTER = 8` se aplica de verdad, en la transacción, y
  **solo sobre sesiones cerradas**: si las que sobran siguen abiertas no se borra
  ninguna. La sesión activa nunca se borra por retención.

### Cambios de contrato

- `DecisionSession` gana `blockedRecommendation` y `budget` (ambos anulables).
- `SessionMemoryDigest` gana `constraints` (label + itemIds). Los dos arrays
  planos siguen publicándose por compatibilidad, pero no deciden el conflicto.
- `decision_session_events` gana `operation` y `request_fingerprint` mediante
  migración aditiva; las filas antiguas quedan a NULL y se tratan como reintento.
- Nueva ruta `POST /journal/:characterId/session/constraints/release`.
- **Trabajar con una sesión exige personaje guardado**: sin él se responde 409
  `personaje-no-guardado`. Es el precio de que SQLite sea la fuente autoritativa.
