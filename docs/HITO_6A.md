# Hito 6A — Primera conversación real con el mentor

> Vertical slice **basado en reglas**, **sin IA generativa**. No hay LLM y no hay
> generación de texto libre: cada respuesta se compone a partir de datos que ya
> existían. Sí puede haber red: el mentor delega en el mismo motor que el resto
> de la aplicación, y ese motor consulta el servicio documentado de precios
> cuando lo necesita.

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
- **Interfaz** «Habla con tu mentor» (`src/sections/MentorChatSection.tsx`).
  Convive con el diario, la sesión de decisión y las recomendaciones dentro del
  área **Mentor** del espacio de trabajo. (Cuando se escribió este hito la
  interfaz era una lista numerada y esta era la «sección 5»; hoy hay tres áreas:
  Mentor, Personaje y Plan y mercado.)

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

## Qué se puede afirmar (y qué no)

Afirmaciones **verificables** por las pruebas de este hito:

- **La decisión procede del motor, no de generación libre.** El servicio llama a
  `generateRecommendations` y transmite su resultado: la próxima acción, las
  fuentes, la confianza y lo no verificado son campos del motor o del diario,
  nunca texto inventado.
- **No hay IA generativa.** No se llama a ningún LLM en ninguna ruta de este
  hito; el explicador LLM sigue siendo un stub desactivado por flag.
- **La clasificación es puro emparejamiento** de cadenas normalizadas contra una
  lista corta y explícita.
- Los textos del mentor son **plantillas fijas** rellenadas con campos del motor
  (`title`, `reason`, `impact.description`, `risk`), del diario (`title`,
  `nextAction`) o constantes.
- **No se inventan** estadísticas, DPS, precios, mods ni conocimiento del juego.

Lo que **no** se afirma:

- **No se afirma que la respuesta sea idéntica palabra por palabra** entre dos
  consultas. La respuesta incluye `generatedAt`, y las fuentes llevan su
  `retrievedAt`: **fechas y evidencia cambian**. Si además cambian los precios
  del servicio o el contenido del diario, el motor puede priorizar otra decisión
  y el texto cambia con ella.
- **No se afirma que funcione sin red.** Cuando el motor necesita precios, el
  mentor usa el mismo **servicio documentado de poe.ninja** que el resto de la
  aplicación (desde el servidor, con caché SQLite y ETag; `POE_NINJA_OFFLINE`
  lo desactiva en pruebas). El único caso en que se garantiza que no se consulta
  precios es el que el motor ya cortaba antes: una acción principal activa en el
  diario, o una pregunta no soportada.

## Presentación de la respuesta

La respuesta principal se lee como la contaría una persona y **en este orden**:
diagnóstico, **única próxima acción** y confianza (en español: «Confianza Alta»,
nunca `high`).

Los valores internos del contrato — `next_improvement`, `explain_priority`,
`calculation`, `user`, la versión del motor y la fecha técnica — **no se pintan
por defecto**. La trazabilidad completa (fuentes con su tipo traducido, lo que
falta por verificar, tipo de consulta, versión del motor y momento de la
respuesta) vive en la sección plegable **«Ver evidencia y limitaciones»**, que es
un `<details>` nativo y se abre con teclado.

El contrato estructurado no cambia: el backend sigue devolviendo `intent`,
`inputFingerprint`, `engineVersion`, `generatedAt` y `memoryImpact` intactos.

## Desplazamiento del chat

Al añadir una pregunta, una respuesta o el estado de carga, el hilo se desplaza a
su último turno con `scrollTo` **sobre el propio contenedor**, nunca sobre la
página: la sección no salta bajo el cursor. Con `prefers-reduced-motion: reduce`
el salto es inmediato (`behavior: "auto"`) en vez de suave.

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

### Recuperación en la interfaz

Ante un 409 la interfaz **reinicia limpiamente el hilo** (`journal-stale` en
`src/lib/mentorThread.ts`) y recarga el diario, conservando solo el aviso.

Esto importa especialmente en la **primera** consulta: hasta que hay una
respuesta correcta el hilo todavía no tiene huella de inputs, así que la
invalidación por cambio de inputs no lo limpiaba y la pregunta recién fallada se
quedaba pintada; al recargar el diario y reintentar, la misma pregunta aparecía
dos veces. Tras el reinicio el jugador puede reintentar **sin pregunta
duplicada, sin respuesta antigua y sin acción guardable obsoleta**.

Un fallo que **no** sea 409 (por ejemplo, red caída) es distinto: la memoria del
servidor no ha cambiado, así que el hilo válido anterior se conserva y solo se
retira la pregunta que no llegó a responderse.

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

- `tests/unit/mentorIntent.test.ts` — intenciones, normalización, estabilidad de
  la clasificación.
- `tests/unit/mentorService.test.ts` — cada intención, acción activa, cero
  consultas de precio cuando el diario bloquea, reconciliación, honestidad y
  ausencia de niveles internos (`low`/`medium`/`high`) en el texto visible.
- `tests/unit/mentorThread.test.ts` — invalidación del hilo, contrato de memoria
  y **recuperación del 409 empezando con el hilo vacío**: la pregunta que acaba
  de fallar no se queda pintada, al reintentar no se duplica y no sobrevive
  ninguna respuesta antigua ni acción guardable obsoleta.
- `tests/integration/mentorApi.test.ts` — ruta, 409 por revisión obsoleta,
  carrera entre pestañas, inyección de memoria descartada.
- `scripts/mentor-smoke.mjs` — navegador real, base SQLite temporal y servidores
  propios (`npm run test:mentor`, `--dev`, `--all`, `--update-screenshots`).
  Cubre además la presentación (nada de identificadores internos por defecto, la
  evidencia plegada que se abre con teclado) y el **desplazamiento del chat** con
  turnos suficientes para desbordar el hilo: el último mensaje queda visible, la
  página no se mueve y `prefers-reduced-motion` se respeta.

El reductor del hilo vive aparte de React (`src/lib/mentorThread.ts`) justamente
para que esas transiciones se puedan probar sin navegador ni DOM.

Capturas: `docs/screenshots/mentor-seccion.png`,
`mentor-escritorio-prod.png`, `mentor-movil-prod.png`.
