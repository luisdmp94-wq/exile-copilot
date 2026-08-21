# Informe final — Hito 6B

> **Documento histórico: es el informe del PROTOTIPO tal y como llegó.**
>
> Estado actual: el Hito 6B, ya **corregido tras la auditoría independiente**,
> está **integrado en `main`** (`dd671178`). Las correcciones y sus pruebas se
> describen en `docs/HITO_6B.md`; la trazabilidad, en `HANDOFF.md`.
>
> **Procedencia ajena:** la rama `hito-6b-adaptive-decision-sessions`, la
> etiqueta `source-f6152c47` y el commit `d6b003c` pertenecen al repositorio de
> Grok del que se importó el ZIP. **No existen en este repositorio** y no
> describen su estado.

## Qué se entregó

Sesiones adaptativas de decisión que envuelven el Character Journal:

- Una sola próxima acción.
- Historial acotado e idempotente en SQLite.
- Freno determinista (evidencia, restricción, pausa) sin LLM, sin crafts y sin precios nuevos.
- Interfaz en español, sin jerga interna.

## Verificación ejecutada

| Puerta | Resultado |
|---|---|
| `tsc -b` | 0 errores |
| ESLint | 0 errores |
| `vitest run` | 230/230 |
| `npm run build` | OK |
| `session-smoke --all` | 26/26 |
| `journal-smoke --all` | 58/58 |
| `mentor-smoke --all` | 68/68 |
| `equipment-smoke --all` | 70/70 |
| `browser-smoke --all` | 20/20 |

Capturas: `docs/screenshots/sesion-escritorio-prod.png`, `sesion-escritorio-dev.png`, `sesion-movil-prod.png`, `sesion-movil-dev.png`.

## Archivos principales

- `shared/decisionSession.ts`, `shared/journalMemory.ts`, `shared/api.ts`, `shared/domain.ts`
- `server/decision/sessionService.ts`, `server/db/database.ts`, `server/db/repositories.ts`
- `server/engine/engine.ts`, `server/app.ts`, `server/mentor/mentorService.ts`
- `src/sections/DecisionSessionSection.tsx`, `src/App.tsx`, `src/hooks/useJournal.ts`
- `scripts/session-smoke.mjs`, `tests/unit/decisionSession.test.ts`, `tests/unit/sessionService.test.ts`, `tests/integration/sessionApi.test.ts`

## Riesgos residuales

- Ninguna regla actual del motor marca `irreversible: true`; el freno de evidencia crítica se demuestra con recomendaciones sintéticas y con el arranque manual de sesión.
- El select nativo de «pieza a sustituir» se acotó para no desbordar a 320 px; conviene seguir comprobando viewports estrechos si se añaden opciones más largas.
- `node:sqlite` es experimental en Node 22 (el README pide Node 24+).
- La conversación 6A sigue sin persistirse: fuera de alcance de 6B.

## Cómo aplicar el parche sobre el baseline

Desde un árbol limpio idéntico a `source-f6152c47`:

```bash
git apply --check exile-copilot-hito-6b.patch
git apply exile-copilot-hito-6b.patch
```
