# Hito 6B — Sesiones adaptativas de decisión

> La sesión **envuelve** el diario: una sola próxima acción, historial acotado,
> sin LLM y sin un segundo sistema de consejos. El motor sigue siendo
> determinista; la sesión solo puede frenar, pausar o pedir evidencia.

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
