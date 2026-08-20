# Hito 6A — Primera conversación real con el mentor

> Vertical slice **determinista**. No hay LLM, no hay red y no hay generación de
> texto libre: cada respuesta se compone a partir de datos que ya existían.

## Qué está implementado

- **Contrato compartido** (`shared/mentorQuery.ts`): petición, respuesta,
  próxima acción única, estado explícito de «no soportado» y la huella de
  invalidación del hilo (`mentorInputsKey`).
- **Clasificador determinista** (`shared/mentorIntent.ts`): normaliza la
  pregunta (minúsculas, sin tildes ni signos) y la asigna a una de tres
  intenciones mediante una lista corta y explícita de patrones.
- **Servicio del mentor** (`server/mentor/mentorService.ts`): delega en
  `generateRecommendations` y traduce su resultado a una respuesta conversacional.
- **Ruta** `POST /api/mentor/query` con las mismas protecciones de memoria que
  `/api/recommendations`.
- **Interfaz** «5. Habla con tu mentor» (`src/sections/MentorChatSection.tsx`),
  que convive con personaje, equipo, recomendaciones y diario.

## Preguntas soportadas hoy

| Intención | Ejemplos reconocidos |
|---|---|
| `next_improvement` | «¿Qué mejoro ahora?», «¿Qué debería hacer primero?», «¿Qué hago ahora?», «¿Cuál es el siguiente paso?», «¿Por dónde empiezo?» |
| `explain_priority` | «¿Por qué me recomiendas esto?», «¿Cuál es mi principal problema?», «Explícame la prioridad», «¿Cuál es el motivo?» |

La lista exacta de patrones está en `shared/mentorIntent.ts`. Es pequeña a
propósito.

## Qué NO está soportado (y se dice)

Cualquier otra pregunta devuelve `intent: "unsupported"`, **sin** próxima
acción, con una explicación honesta y ejemplos válidos. No se ejecuta el motor
ni se consultan precios. Ejemplos que hoy caen aquí: tasación de objetos
(«¿cuánto vale mi arma?»), comparación con el meta, dudas generales de PoE2,
saludos y texto sin forma de pregunta reconocible.

## Determinismo

- Misma pregunta + mismos datos ⇒ misma respuesta, palabra por palabra.
- La clasificación es puro emparejamiento de cadenas normalizadas.
- Los textos del mentor son plantillas fijas rellenadas con campos del motor
  (`title`, `reason`, `impact.description`, `risk`), del diario (`title`,
  `nextAction`) o constantes.
- No se inventan estadísticas, DPS, precios, mods ni conocimiento del juego.

## Reutilización del motor (no hay un segundo sistema de consejos)

El servicio llama a `generateRecommendations` con la memoria autoritativa del
diario, así que hereda todas las reglas del Hito 5B:

- **Acción principal activa** → el motor devuelve cero recomendaciones y **no
  consulta precios**; el mentor *recuerda* ese paso (`canSaveToJournal: false`,
  `recalledFromEntryId`) en lugar de inventar otro.
- **Memoria completada pendiente** → el motor reconcilia el candidato repetido
  como `profile_sync`; el mentor lo transmite tal cual y lo declara en
  `memoryImpact.repeatedRecommendationIds`. El mentor **no reordena** nada: si
  el motor prioriza otra decisión, esa es la que se ofrece.
- **El resultado libre del diario es evidencia**, nunca se interpreta como
  estadística (hay una prueba que verifica que ese texto no aparece en la
  respuesta).
- Los precios solo se mencionan si el contrato actual ya los da por verificables.

## Protecciones de revisión

`POST /api/mentor/query` acepta `journalRevision` (lo que vio la interfaz) y:

1. carga la memoria autoritativa del servidor — el cliente **no puede inyectar
   memoria**, el esquema descarta claves desconocidas;
2. responde **409 `memoria-diario-obsoleta`** si la revisión enviada ya no coincide;
3. **vuelve a comprobar** la revisión tras la espera asíncrona, de modo que una
   acción creada en otra pestaña invalida la respuesta en vuelo.

## Limitación: la conversación no se persiste

El hilo vive **solo en memoria de la interfaz** (`src/hooks/useMentor.ts`):

- no se guarda en la base de datos ni en `localStorage`;
- se pierde al recargar la página;
- **se descarta automáticamente** cuando cambia cualquier input relevante
  (personaje, build objetivo, presupuesto, objetivo, liga, parche o revisión del
  diario), para no mostrar respuestas obsoletas — cambiar de pregunta no lo
  descarta;
- el historial **no** se envía al servidor: cada consulta es independiente y el
  contexto son los datos, no los turnos anteriores.

Persistir el historial es trabajo de un hito posterior.

## Uso futuro (opcional) de un LLM

Hoy **no se usa ningún LLM** y el hito no lo requiere. Si algún día se añade,
debe respetar estos límites: el LLM podría reformular el texto o ampliar el
reconocimiento de intención, pero **la decisión, la próxima acción, las fuentes,
la confianza y lo no verificado tienen que seguir saliendo del motor y del
diario**. Nunca debe generar estadísticas, precios ni conocimiento del juego.

## Pruebas

- `tests/unit/mentorIntent.test.ts` — intenciones, normalización, determinismo.
- `tests/unit/mentorService.test.ts` — cada intención, acción activa, cero
  consultas de precio cuando el diario bloquea, reconciliación, honestidad.
- `tests/unit/mentorThread.test.ts` — invalidación del hilo y contrato de memoria.
- `tests/integration/mentorApi.test.ts` — ruta, 409 por revisión obsoleta,
  carrera entre pestañas, inyección de memoria descartada.
- `scripts/mentor-smoke.mjs` — navegador real, base SQLite temporal y servidores
  propios (`npm run test:mentor`, `--dev`, `--all`, `--update-screenshots`).

Capturas: `docs/screenshots/mentor-seccion.png`,
`mentor-escritorio-prod.png`, `mentor-movil-prod.png`.
