# Hito 5A — memoria persistente del mentor

## Objetivo

Convertir el dashboard en la memoria de un mentor de PoE2, no en otro listado de
datos. El hito añade un diario persistente por personaje y mantiene **una única
próxima acción principal**.

El flujo implementado es:

1. Guardar una recomendación o seguimiento manual.
2. Mostrar decisión, motivo breve, contexto, fuentes, confianza, coste y riesgo.
3. Pedir una sola acción concreta.
4. Marcarla como ejecutada, sin afirmar todavía que funcionó.
5. Esperar el resultado real del jugador.
6. Cerrar el paso conservando el resultado en el historial.

## Contrato y persistencia

- `JournalEntry`: decisión, experimento, craft, hito o nota.
- Estados: `active`, `waiting_result`, `completed`, `cancelled`.
- `recommendationSnapshot` conserva la recomendación que originó la decisión.
- `context` conserva nivel, liga, parche, presupuesto y objetivo de ese momento.
- `journal_state.primary_entry_id` separa la acción principal del resto del
  historial. Sustituirla no borra ni marca como completadas las entradas previas.
- No hay `DELETE`: una entrada se completa o cancela para no reescribir la
  historia silenciosamente.

Rutas bajo `/api`:

- `GET /journal/:characterId`
- `POST /journal/:characterId/entries`
- `PATCH /journal/:characterId/entries/:entryId`

## Límites deliberados

- No hay LLM en este hito. El contenido procede de reglas deterministas o de lo
  escrito explícitamente por el jugador.
- El historial se muestra limitado a ocho entradas recientes en la interfaz;
  todavía no hay paginación ni archivado.
- El servidor no exige que el personaje exista antes de crear un diario. Esto
  mantiene compatible el flujo actual de importación, pero deberá revisarse al
  introducir cuentas y autenticación.
- La memoria aún no alimenta automáticamente una siguiente recomendación. El
  siguiente hito debe incorporar el último resultado al contexto del motor antes
  de generar el paso posterior.

## Verificación

- Esquemas compartidos y reglas de transformación: `tests/unit/journal.test.ts`.
- Persistencia, transiciones y aislamiento entre personajes:
  `tests/integration/api.test.ts`.
- Flujo real, recarga, resultado, creación manual, móvil y ausencia de llamadas
  externas: `npm run test:journal`; añadir `--dev` o `--all` para Strict Mode.
