# HANDOFF — Exile Copilot

> Informe para el propietario. Última actualización: sesión 31,
> 2026-08-23.
>
> **Estado actual:** `main` incorpora el rediseño visual, los Hitos 6C
> «Probar y volver» y 6D «Identidad persistente de la build», y el banco de
> crafting jugable de la sesión 29. Las secciones de sesiones anteriores son
> HISTORIA: los SHA y
> los «sin integrar» que aparecen en ellas describen el momento en que se
> escribieron, no el estado actual.

## Sesión 31 — lectura observable del núcleo de afijos

- Crafting añade un resumen compacto «Núcleo de afijos» que cruza el objetivo
  con las etiquetas y grados del texto avanzado real.
- Distingue «Protege primero», «Aporta al objetivo», «Revisa su encaje» y
  «Depende de la build» sin convertir estas señales en una puntuación.
- Detecta convergencias específicas entre varios afijos y mantiene el detalle
  completo plegado por defecto.
- Se corrigió un falso positivo importante: la etiqueta genérica «Ataque» ya no
  basta para declarar daño directo. Un afijo de precisión con esa única etiqueta
  queda como contexto, no como mejora de daño demostrada.
- Validación manual con «Rama de alma»: 3/6 afijos alineados con daño, dos con
  convergencia física y un afijo alineado de grado 1–2.

Verificación: **456/456** pruebas; TypeScript y ESLint sin errores; build de
producción correcto; equipo y Crafting **190/190** en producción y
desarrollo/Strict Mode.

## Sesión 30 — asesor conservador después de cada craft

- Una pieza llena con afijos de grado 1–2 ya no recibe la recomendación
  engañosa «Prueba controlada»: el banco indica «No arriesgues aún» y muestra
  cuántos afijos relevantes quedarían expuestos.
- Las rutas de reemplazo con Essence o Alloy permanecen ocultas y desactivadas
  hasta que el jugador revisa explícitamente ese riesgo.
- Tras pegar el resultado, aparece una sola decisión dominante: continuar,
  parar y conservar o replantear la ruta. La decisión distingue un resultado
  útil con hueco libre, uno útil que llena la pieza y uno lleno sin señal del
  objetivo.
- Los bloqueos por requisitos o por pérdida de un modificador protegido siempre
  prevalecen. No se destruye ningún objeto ni se inventan DPS, precios,
  probabilidades o valor de afijos.

Verificación: TypeScript y ESLint sin errores; **452/452** pruebas; build de
producción correcto; equipo y Crafting **186/186** en producción y
desarrollo/Strict Mode.

## Sesión 29 — banco de crafting jugable y navegación reparada

- Crafting deja de empezar como una tabla técnica: primero pregunta qué busca
  el jugador y resume en cuatro señales compactas si debe esperar, probar de
  forma controlada o revisar la pieza.
- La lectura separa modificadores con coincidencia literal con el objetivo,
  modificadores sin señal directa y afijos de grado 1–2 candidatos a conservar.
  No llama «malo» a un mod ni inventa DPS, precio, pesos o probabilidad.
- Monedas básicas pasan de tres confirmaciones repetidas a una confirmación
  compacta que conserva las mismas tres condiciones de seguridad. La ruta
  mínima desde un objeto suelto queda en seis interacciones.
- El detalle del objeto ya no duplica el planificador entero: muestra el objeto,
  sus datos y un único botón para llevarlo al banco.
- Todas las piezas muestran una ilustración local por clase/hueco y rareza en
  equipo, detalle y Crafting. Son siluetas propias y deterministas, no arte de
  GGG ni una imagen exacta resuelta desde BaseItemTypes.
- La marca «Exile Copilot» vuelve siempre al expediente. Un botón Volver recupera
  el área anterior sin recargar la página.

Verificación: TypeScript y ESLint sin errores; **447/447** pruebas; build de
producción correcto; equipo y Crafting **184/184**, flujo principal completo y
mentor **88/88** en producción y desarrollo/Strict Mode.

## Sesión 28 — auditoría adversarial y ruta de próxima decisión

- Se recorrió en navegador el ciclo completo desde objeto suelto hasta
  comparación, valoración y actualización del mismo objeto.
- Se corrigió una contradicción del dominio: una base normal sin afijos ya no
  aparece bloqueada y entra por Transmutación; una base normal con explícitos
  sigue deteniéndose como inconsistente.
- Ausencia de estados especiales, dividido, sin identificar, mutado y
  profanado ya no pueden presentarse como «pieza lista».
- El diagnóstico ahora termina en una acción visible: prepara la única moneda
  compatible, muestra todas si existen varias sin inventar un ranking, o lleva
  a Essence/Alloy cuando un raro lleno necesita reemplazo.
- La ruta es navegación sobre compatibilidad ya demostrada: no interpreta
  utilidad de afijos, no calcula probabilidades y no declara compatible una
  herramienta cuyo tooltip todavía no se ha pegado.

Informe completo: `docs/CRAFTING_ADVERSARIAL_AUDIT_2026-08-23.md`.

## Sesión 27 — entrada orientada a tareas

- La pantalla vacía ya no obliga a entender la arquitectura del producto:
  pregunta «¿Qué quieres hacer hoy?» y ofrece tres recorridos completos.
- «Mejorar mi personaje» abre el importador existente; «Empezar desde cero»
  crea un perfil local editable; «Evaluar o craftear» acepta directamente el
  texto de un objeto y abre el banco de Crafting con esa pieza seleccionada.
- El perfil manual no se presenta como importado ni se persiste hasta que el
  jugador lo guarda. Un objeto suelto tampoco requiere fingir que existe un
  personaje completo.
- El smoke principal prueba las tres rutas en producción y desarrollo. La
  limpieza de temporales de Windows informa un bloqueo tardío de antivirus o
  indexadores sin convertirlo en un falso fallo funcional.

## Sesión 26 — Alloys guiados y comprobables

- Nuevo preflight propio para Alloys dentro de Crafting. No deduce el efecto
  por el nombre: exige nombre, tooltip, objetivo, rareza, modificador fabricado
  garantizado y forma de selección del reemplazo observados por el jugador.
- La regla global se limita a lo demostrado por GGG en 0.5.0: reemplazo de un
  modificador por uno fabricado garantizado y máximo de un fabricado por objeto.
  La matriz Alloy × pieza y la forma de retirada no se inventan.
- Se bloquean estados incompatibles conocidos y se detienen como «Faltan datos»
  las interacciones especiales no verificadas.
- La sesión persistente conserva el snapshot, el Alloy, el efecto declarado y
  el contrato de comparación. El resultado solo se confirma si desaparece un
  explícito, aparece uno fabricado y no hay más de un fabricado total.

Verificación: TypeScript y ESLint sin errores; **421/421** pruebas; build de
producción correcto; flujo real de navegador **138/138** entre producción y
desarrollo/Strict Mode. Los puertos temporales 7188/7189 se liberaron.

## Sesión 24 — motor matemático conservador de crafting

- Nuevo contrato separado para pools completos, parciales, observados y no
  disponibles. Peso desconocido es `null`; peso conocido cero conserva su
  significado matemático.
- La probabilidad exacta solo se calcula con alcance, pesos y elegibilidad
  completos. Incluye intentos medios, acumulada a N intentos y coste esperado
  únicamente con precio verificado y fechado.
- Las secuencias usan probabilidades condicionales. El coste hasta acertar se
  bloquea si no está demostrado que cada fallo puede reiniciarse al mismo estado
  y cuánto cuesta ese reinicio.
- El comparador de estrategias solo ordena costes totales en la misma moneda;
  no confunde coste matemático con utilidad para la build.
- Los fixtures son sintéticos y no representan mods ni pesos reales de PoE2.
  La conexión con pools reales queda bloqueada hasta que el registro de datos
  entregue un snapshot `verified-complete`.

Pruebas específicas del motor: **22/22**; suite global **367/367**, TypeScript y
ESLint sin errores y build de producción correcto. Véase
`docs/CRAFTING_MATH_ENGINE.md` para los invariantes y límites.

## Sesión 23 — cierre de consistencia del banco de Crafting

- El preflight ya no se duplica dentro del detalle del objeto: allí solo se
  consulta el diagnóstico y se navega al banco de Crafting con la pieza elegida.
- Solo se monta una instancia viva de la sesión de crafting; el expediente
  muestra un enlace de retorno cuando el caso activo pertenece al banco.
- La comparación exige coincidencia conocida de base y nivel de objeto. Nivel
  ausente, dos mods nuevos, roll cambiado o transición inesperada quedan como
  inconclusos o incompatibles, nunca como confirmación.
- La evidencia estructural y la valoración subjetiva se persisten por separado.
  El expediente se guarda antes de cerrar; si falla, la sesión sigue abierta y
  puede reintentarse. Un cerrojo síncrono impide cierres concurrentes.
- La prueba de navegador simula de forma explícita un fallo de guardado y comprueba
  la recuperación completa contra SQLite. Su espera usa sondeo real del servidor,
  no una promesa asíncrona que pudiera producir un falso positivo.

Verificación: TypeScript y ESLint sin errores; **345/345** pruebas unitarias;
build de producción correcto; flujo de equipo y crafting **120/120** en
producción y desarrollo, repetido dos veces seguidas (**240/240**). También
pasan flujo principal **32/32**, diario **58/58**, mentor **88/88**, sesiones
**58/58** y memoria de build **20/20**. Los puertos temporales se liberan al
terminar.

## Sesión 22 — primer ciclo cerrado de crafting

- «Crafting» es una tercera pestaña principal junto a «Expediente y mentor» y
  «Plan y mercado»; selección, preflight, sesión y comparación permanecen en
  ese espacio de trabajo.
- El importador español conserva prefijo/sufijo, grado, etiquetas, fabricación,
  profanación, runas, implícitos y estados de crafting a partir del texto
  avanzado aportado por el jugador.
- Una matriz conservadora evalúa Transmutación, Aumento, Regio y Exaltado con
  sus variantes observadas; no inventa variantes, pesos ni probabilidades.
- La variante exacta elegida (base/superior/perfecta), su etiqueta y el nivel
  mínimo mostrado por el tooltip se guardan en la sesión. Los registros
  anteriores siguen cargando sin que se les invente una variante base.
- Antes de gastar se crea una sesión con snapshot estructurado del objeto,
  moneda protegida, objetivo del jugador, incógnitas y restricciones.
- Al volver del juego se pega el nuevo objeto. La app compara base, nivel de
  objeto cuando está presente, rareza y el multiconjunto completo de mods; solo
  confirma si se preserva todo y aparece exactamente un explícito nuevo.
- La valoración «me sirve / no era lo que buscaba» queda separada de la
  comparación factual. El resultado y el snapshot persisten en el diario, y el
  expediente sustituye el objeto conservando su id y su hueco local.
- Sesiones antiguas siguen siendo válidas: `craftingExperiment` es opcional.

Verificación histórica de esa sesión: TypeScript y ESLint sin errores;
**330/330** pruebas; build correcto; navegador de equipo y crafting **112/112** en producción y en
desarrollo/Strict Mode. Los puertos temporales 7188/7189 se liberan al acabar.

## Sesión 21 — endurecimiento del mentor contextual

Se cerraron los defectos descubiertos en la auditoría del panel contextual:

- Todas las preguntas creadas por la interfaz llevan una intención permitida y
  una prueba de contrato las enfrenta al clasificador determinista.
- La procedencia visible sale de `responseMode`: IA supervisada con su modelo,
  respaldo por reglas o motor. Ya no se presenta cualquier respuesta como Groq.
- Cada petición lleva identidad propia. Cambiar de área, objeto o decisión
  invalida el panel anterior; una respuesta tardía no puede pisar el contexto
  nuevo ni un turno viejo puede cerrar el estado de uno reciente.
- El panel ya no se reconstruye al responder: conserva plegado y foco. Empieza
  plegado en escritorio y móvil para no interceptar acciones del expediente,
  pero su cabecera sigue reaccionando a los eventos semánticos.
- Presupuesto se anuncia con debounce; guardar perfil, importar plan, aplicar o
  invalidar una recomendación, resultados/pausas de sesión y errores producen
  cues específicos. Sin personaje se muestra un estado honesto y sin consulta.
- La región viva accesible es estable; el contenido móvil tiene alto acotado y
  el botón de teclado conserva el foco tras respuestas síncronas o remotas.

Verificación final: TypeScript y ESLint sin errores; **309/309** pruebas;
build correcto; mentor **88/88**, equipo **82/82**, sesiones **58/58**, diario
**58/58** y flujo principal completo en producción y desarrollo/Strict Mode.

## Sesión 18 — Groq como proveedor del mentor IA

El selector de Hito 6E ahora acepta proveedores compatibles y usa Groq por
defecto. `MENTOR_AI_PROVIDER=groq`, `GROQ_API_KEY` y
`openai/gpt-oss-120b` permiten probar el mentor con la cuota gratuita de Groq.
La clave permanece exclusivamente en el servidor.

- Groq usa `https://api.groq.com/openai/v1/responses` con JSON Schema estricto.
- No se le envían `store` ni `safety_identifier`, campos que su Responses API no
  admite. OpenAI sigue disponible y conserva ambos controles.
- La salida vuelve a validarse con Zod y todos los ids se comprueban contra el
  contexto canónico. Ante cualquier error, el motor responde por reglas.
- Desactivado por defecto: sin flag o sin clave no hay petición externa.

## Sesión 17 — Hito 6E: mentor IA supervisado

Rama aislada `hito-6e-mentor-ia` sobre `f55aef2`. La IA es un selector opcional,
no un segundo motor: recibe un contexto compacto, trata todo texto del usuario
como dato no confiable y devuelve únicamente una decisión estructurada.

- Puede elegir uno de los ids de recomendación del motor, pedir uno de los ids
  de dato faltante, explicar el caso actual o declarar que no hay acción segura.
- El servidor valida todos los ids y reconstruye acción, fuentes, confianza y
  texto final. El modelo no puede persistir memoria ni crear cambios de juego.
- Una acción activa evita por completo la llamada IA. Los frenos Core y de
  sesión siguen gobernados por el motor.
- En OpenAI se usan `store:false` e identificador de seguridad pseudónimo. En
  Groq se omiten esos campos incompatibles. Timeout y salida máxima siguen
  configurables; flag y clave solo en servidor, desactivado por defecto.
- Si falta clave, hay timeout, error HTTP, negativa, salida incompleta, JSON
  inválido o un id inexistente, responde el motor y muestra el motivo seguro.
- Groq puede usarse con su cuota gratuita; OpenAI conserva facturación separada
  de ChatGPT. No se guarda ninguna clave en el repositorio.

Verificado localmente: TypeScript y ESLint sin errores, **297/297** pruebas,
build de producción correcto, smoke normal **72/72** (producción + desarrollo)
y smoke con IA activa sin clave **36/36**, sin peticiones externas. La llamada
real queda pendiente de una clave y presupuesto de API proporcionados por el
propietario.

## Sesión 16 — Hito 6D: identidad persistente de la build

Rama aislada `hito-6d-build-memory` sobre `2576577`. El expediente conserva
reglas declaradas por el jugador como **Core, Flexible, Experimental o
Descartado**, con motivo, objeto relacionado opcional y condición para volver a
considerar algo descartado.

- Las reglas viven en SQLite y sobreviven a recargar. Archivar las retira de la
  memoria activa sin borrar su historial físico.
- La memoria forma parte de la revisión determinista del personaje. Dos
  pestañas que escriben desde la misma revisión no pueden pisarse: la primera
  gana y la segunda recibe `409 memoria-diario-obsoleta`, recarga y no duplica
  la regla.
- Un objeto relacionado debe existir en el snapshot guardado. Un id ajeno se
  rechaza con `400 objeto-de-memoria-desconocido`.
- Solo una regla Core puede frenar automáticamente, y únicamente con una
  relación estructurada por id de objeto o la coincidencia textual conservadora
  ya existente. Flexible, Experimental y Descartado no se convierten en hechos
  ni mecánicas inventadas.
- El personaje de ejemplo explica que primero debe guardarse y ofrece
  «Guardar personaje y activar memoria»; después permite añadir, reclasificar y
  archivar reglas desde el expediente.

Verificado en esta rama: TypeScript y ESLint sin errores, **284/284** tests,
build de producción correcto, smoke 6D **20/20** (producción + desarrollo,
escritorio + móvil a 390 px) y regresión 6C **58/58**. Las cuatro capturas están
en `docs/screenshots/memoria-build-*.png`.

## Sesión 15 — Hito 6C: ciclo «Probar y volver»

Rama aislada `hito-6c-return-loop` sobre `5f726a2`. El objetivo es convertir
una recomendación en un ciclo reconocible y útil fuera de la web:

1. **Probar y volver.** La recomendación nombra una acción y explica de forma
   visible qué observar después del cambio.
2. **Volví de jugar.** El retorno no exige redactar un informe: ofrece cinco
   resultados rápidos (resuelto, mejoró, igual, empeoró o algo diferente) y un
   comentario opcional.
3. **Continuidad honesta.** «Resuelto» cierra el caso; los resultados parciales
   lo mantienen abierto; un hallazgo valioso inesperado cambia la estrategia.
   Una sensación se conserva como experiencia del jugador, nunca como medición.
4. **Menos ruido.** Evidencias y protecciones avanzadas permanecen disponibles
   dentro de un bloque secundario. El informe de exportación queda plegado por
   defecto.

La compatibilidad con sesiones anteriores se conserva: `outcome` es nullable y
los registros antiguos se leen como resultado no estructurado. El motor sigue
siendo determinista; no se añadieron precios, crafts ni conocimiento inventado.

## Sesión 14 — microcorrección de consistencia posterior al 6B

Rama `post-6b-consistency`, worktree aislado sobre `dd671178`. Sin funciones
nuevas ni cambios visuales.

- **El objetivo de la sesión deja de perderse.** `goal` era un `z.string()`
  libre; la interfaz mandaba `"balanced"` fijo en sus dos caminos y el servidor
  ni siquiera lo pasaba al servicio, así que la entrada del diario nacía con
  `goal: null`. Ahora usa el enum del dominio (`GoalKind`), la sección lo recibe
  desde `App.tsx`, la ruta lo entrega al servicio, la sesión lo conserva y sus
  entradas lo heredan. Las sesiones guardadas antes de este campo se cargan con
  `goal: null` = **desconocido**, sin inventarles «equilibrado».
- **`equipment-smoke` y `browser-smoke` ya no pueden tocar la base real.** Usan
  el mismo patrón que los otros tres smokes: carpeta temporal única por
  ejecución y `DATABASE_PATH` explícito, con limpieza en `finally` y validación
  de la ruta absoluta antes de borrar (helpers en `scripts/browserLaunch.mjs`).
  Cada smoke comprueba en ejecución que su base es la temporal.
- **Documentación al día**: lo que era «sin integrar», «sección 5» o SHA del
  repositorio de Grok queda marcado como historia o corregido.

## Sesión 13 — Hito 6B corregido tras auditoría independiente

Rama `hito-6b-corregido` (worktree aislado sobre el entonces baseline
`f6152c47`). **Ya integrada en `main`** mediante `hito-6b-integracion`
(fast-forward a `dd671178`). Parte del patch original de Grok (commit `e6288f2`,
conservado sin tocar como prototipo) y aplica las nueve correcciones que exigía
`AUDITORIA_HITO_6B_GROK.md`.

- **SQLite es la fuente autoritativa del personaje.** Toda operación de sesión
  carga el perfil guardado DENTRO de la transacción (`loadAuthoritativeProfile`).
  El `profile` que envía una pestaña ya no decide nada: una pestaña antigua que
  reenvía su snapshot recibe `sesion-incompatible-con-perfil` (409). Trabajar con
  una sesión exige un personaje guardado (`personaje-no-guardado`).
- **Huella completa y estable**: nivel, liga, parche, vida y defensas, atributos,
  resistencias, habilidades, pasivas y el CONTENIDO del equipo (slot, id, base,
  rareza, calidad, requisitos y mods). Todas las colecciones se ordenan por clave
  estable y se excluye lo volátil (fechas, `sources`, `rawText`): reordenar no
  cambia la huella, editar sí.
- **Invariante de próxima acción**: tras `continue` o `change_strategy` la sesión
  abierta siempre tiene una entrada principal viva con
  `activeAction.journalEntryId === primaryEntryId`. En transiciones terminales el
  id se pone a `null`: nunca apunta a una entrada completada.
- **Desbloqueo real por evidencia**: la recomendación frenada se conserva
  validada (`blockedRecommendation`) junto al presupuesto aceptado. Al resolver
  la incógnita crítica se REEVALÚA el freno y, si ya es seguro, se restaura la
  acción original con sus fuentes, coste, riesgo e ids.
- **Historial cerrable**: `MAX_SESSION_EVENTS` (40) acota el material; las
  transiciones terminales disponen de `RESERVED_TERMINAL_EVENTS` (2) plazas
  extra. Una sesión con el historial lleno SIEMPRE puede pausarse, cerrarse o
  descartarse, y el mensaje de error nombra esas acciones.
- **Retención honesta de ocho sesiones**: `enforceSessionRetention` se aplica en
  la misma transacción al abrir y al cerrar. Solo borra sesiones YA CERRADAS y
  nunca la activa: no se pierde historia viva en silencio.
- **Restricciones no aplanadas**: el digest publica `constraints` (label + sus
  itemIds) y el freno atribuye el conflicto a la protección que POSEE el id, no
  a la primera de la lista.
- **Interfaz coherente por estado**: una sesión cerrada no ofrece resultado,
  evidencia ni pausa, y expone «Empezar otra decisión»; hay un selector visible
  de qué incógnita resuelve la evidencia (antes dependía de un estado local que
  se perdía al recargar); y cada protección se puede retirar a conciencia
  (`POST /session/constraints/release`), que es lo que el texto del conflicto
  proponía sin ofrecerlo.
- **Idempotencia ligada a la operación**: cada evento guarda `operation` y una
  huella estable del request. La misma clave con otra ruta u otro payload
  devuelve 409 `clave-de-idempotencia-reutilizada` en vez de un éxito silencioso.

### Estado del prototipo original

El patch de Grok aplica limpio y compila, pero **no debe integrarse tal cual**:
las siete regresiones independientes de la auditoría fallan contra él (7/7) y
pasan contra esta rama.

## HISTÓRICO — sesión 12: Hito 6B, prototipo de Grok sin corregir

> **Procedencia, no estado actual.** Lo que sigue describe el prototipo tal y
> como llegó. Se conservó como commit `e6288f2` y HOY está corregido e integrado
> en `main` (ver sesión 13). Los identificadores
> `hito-6b-adaptive-decision-sessions`, la etiqueta `source-f6152c47` y el commit
> `d6b003c` pertenecen al **repositorio ajeno de Grok**: no existen aquí y no
> deben buscarse en este historial.

- **La sesión envuelve el diario**, no lo duplica: una sola próxima acción
  (`journal_state.primary_entry_id` + `active_session_id`). Proponer una nueva
  cierra la anterior en la misma transacción; una sesión abierta bloquea otro
  paso principal.
- **Freno determinista** (`evaluateSessionGate`): incógnita crítica +
  irreversible pide evidencia; restricción core ocupa el hueco 1 y no se
  sustituye por la siguiente puntuada; pieza a sustituir pronto o presupuesto
  superado (misma moneda, coste conocido) pausa para conservar el recurso.
- **Resultado inesperado valioso** se protege y cambia el plan. **Descarte
  causal** deja una condición de reapertura; evidencia compatible → candidata,
  nunca un hecho demostrado. **Lo subjetivo no se trata como medición.**
- **Huella de personaje**: si cambian nivel, liga, parche o equipo, la sesión
  no se reutiliza en silencio (409 + confirmación). *(Corregido en la sesión 13:
  la huella original solo miraba los IDS de los objetos, así que editar una pieza
  sin cambiar su id no se detectaba.)*
- **SQLite aditivo**: `decision_sessions`, `decision_session_events` (máx. 40,
  `idempotency_key` UNIQUE) y columna `active_session_id`. Los payloads 5A/5B
  no se reescriben. *(Corregido en la sesión 13: el tope de 40 impedía también
  cerrar la sesión, y `MAX_SESSIONS_PER_CHARACTER` no se aplicaba.)*
- **Revisión e idempotencia**: `journalRevision` forma parte del digest de
  sesión; un 409 `memoria-diario-obsoleta` retira la acción visible y recarga.
  Reintentar la misma clave no duplica el evento.
- **Interfaz «Comprobar una decisión»** en español, sin jerga interna. Desde
  una recomendación, «Comprobar esto». `session_gate` no se guarda como compra
  ni se exporta al `.build`.
- **Sin LLM, sin crafts inventados, sin precios nuevos.**
- Verificado en esta máquina: `tsc -b` 0 errores, ESLint 0 errores,
  **230/230** tests, build OK, smokes de navegador: sesión **26/26**, diario
  **58/58**, mentor **68/68**, equipo **70/70**, flujo principal **20/20**
  (producción + Strict Mode). Capturas en
  `docs/screenshots/sesion-*.png`.
- Detalle en `docs/HITO_6B.md` y `docs/PLAN_6B.md`.

## Sesión 11 — Hito 6A: primera conversación real con el mentor

Trabajo hecho en la rama `hito-6a-conversational-mentor` (worktree aislado).
**Ya integrado en `main`** (fast-forward a `f6152c4`).

- **«Habla con tu mentor»** (hoy dentro del área **Mentor**; entonces era la
  sección numerada 5): campo de texto, sugerencias, turnos
  diferenciados, estado de carga, respuesta estructurada con fuentes, confianza
  y «falta por verificar», y botón para guardar la próxima acción en el diario.
- **Basado en reglas, sin IA generativa**: un clasificador de intención pequeño y
  explícito (`next_improvement`, `explain_priority`, `unsupported`). Sin LLM y sin
  texto inventado; las respuestas son plantillas rellenadas con datos del motor y
  del diario. **La decisión procede del motor, no de generación libre**: esa es la
  afirmación verificable del hito.
- **Sí puede haber red**: cuando el motor necesita precios, el mentor usa el mismo
  servicio documentado de poe.ninja que el resto de la app (desde el servidor, con
  caché SQLite y ETag). Por eso ya **no se afirma «sin red» ni «misma respuesta
  palabra por palabra»**: `generatedAt` y el `retrievedAt` de las fuentes cambian,
  y si cambian precios o diario el motor puede priorizar otra decisión.
- **Presentación humana**: la respuesta se lee primero como diagnóstico, única
  próxima acción y confianza (en español; nunca `high`/`medium`/`low`). Los
  valores internos (`next_improvement`, `explain_priority`, `calculation`, `user`,
  versión del motor y fecha técnica) no se muestran por defecto; fuentes, fecha,
  motor y lo no verificado siguen accesibles en «Ver evidencia y limitaciones»
  (`<details>` nativo, se abre con teclado). El contrato estructurado y la
  trazabilidad del backend no cambian.
- **Recuperación del primer 409**: ante `memoria-diario-obsoleta` la interfaz
  reinicia limpiamente el hilo y recarga el diario, así que al reintentar no hay
  pregunta duplicada, respuesta antigua ni acción guardable obsoleta. Antes, en la
  PRIMERA consulta el hilo aún no tenía huella de inputs y la pregunta recién
  fallada se quedaba pintada. Regresión que empieza con el hilo vacío en
  `tests/unit/mentorThread.test.ts`.
- **Desplazamiento del chat**: al añadir pregunta, respuesta o estado de carga, el
  contenedor del hilo va al último turno sin mover la página entera, y respeta
  `prefers-reduced-motion`.
- **Reutiliza el motor**: con una acción activa el mentor RECUERDA ese paso y no
  consulta precios; una memoria completada se reconcilia como `profile_sync`; el
  resultado libre del jugador sigue siendo evidencia, nunca estadística.
- **`POST /api/mentor/query`** con las mismas protecciones que
  `/api/recommendations`: memoria autoritativa del servidor, 409 por revisión
  obsoleta y segunda comprobación tras la espera asíncrona.
- **Limitación declarada**: la conversación NO se persiste. Vive en memoria de la
  interfaz y se descarta al cambiar personaje, build objetivo, presupuesto,
  objetivo, liga, parche o revisión del diario.
- Verificado: `tsc -b` 0 errores, ESLint 0 errores, **181/181** tests, build OK,
  smoke del mentor **48/48** (24 × producción + desarrollo con Strict Mode) y sin
  regresiones en los smokes previos (principal, equipo 35/35, diario 29/29).
- Detalle completo en `docs/HITO_6A.md`.

## Sesión 10 — Hito 5B: la memoria influye en la siguiente decisión

- El servidor proyecta el Character Journal a un contexto autoritativo de
  tamaño acotado: acción principal y hasta diez resultados de recomendaciones.
- Una acción `active`/`waiting_result` detiene el motor antes de precios: cero
  tareas paralelas. Si una recomendación completada sigue activándose, se
  reemplaza por una única acción `profile_sync`; el resultado libre se conserva
  como evidencia, pero jamás se analiza como estadísticas o mods.
- `journalRevision` detecta UI obsoleta; una segunda lectura después de precios
  y explainer cierra la carrera entre pestañas (409 antes de responder). La UI
  reconoce ese 409, retira inmediatamente las decisiones obsoletas y recarga el
  diario en vez de quedar atascada.
- Lectura del motor indexada y acotada en SQLite. Migración aditiva de entradas
  5A: añade metadatos, conserva los payloads y no borra filas (regresión sobre
  esquema antiguo). Solo resultados `game_change` ocupan las diez plazas: las
  reconciliaciones `profile_sync` no pueden expulsar la memoria original.
- Acciones `profile_sync` no muestran el control de exportación. La selección
  frontend las descarta y el exportador vuelve a validarlo: ids desconocidos se
  omiten y se declaran en `skippedUnverified`, nunca aparecen crudos en `.build`.
- Dos rondas de auditoría independiente sobre el commit inicial `0052e06` y
  sus correcciones: cerradas la carrera entre pestañas, la evicción de memoria,
  la invalidación tardía del 409 y la frontera de títulos persistentes.
- Verificado tras las correcciones: TypeScript 0 errores, **147/147 tests** (13
  archivos), ESLint 0 errores, build de producción correcto y **58/58**
  comprobaciones de navegador 5A/5B en producción + Strict Mode.

## Sesión 9 — Hito 5A: memoria persistente del mentor

- Diario SQLite por personaje para decisiones, experimentos, crafts, hitos y
  notas; una sola próxima acción principal.
- Separación real entre acción pendiente, ejecutada/esperando resultado y
  completada. Una acción no puede completarse sin resultado del jugador.
- Recomendaciones convertibles en decisiones auditables con snapshot, fuentes,
  coste, riesgo, confianza, parche, presupuesto y objetivo del momento.
- Interfaz «Mentor del personaje», historial y seguimiento manual; persistencia
  tras recargar y responsive comprobado en 320/360/390 px.

## Sesión 8 — consistencia y reproducibilidad

- **Aviso de importación actualizado**: ya no afirma que las pasivas «no son resolubles». El aviso vigente dice que las pasivas se resuelven con el registro oficial cuando el id existe, que los ids desconocidos permanecen visibles y marcados como no verificados, y que los nombres de skills/support skills todavía no se resuelven por falta de fuente incorporada. Regresión que falla con el mensaje antiguo.
- **Reproducibilidad byte a byte**: `.gitattributes` fija `eol=lf` para `server/data/passives/*.json`; regenerar el registro desde un checkout limpio de Windows produce exactamente los mismos bytes y deja `git status` limpio (verificado, no solo comparación semántica).
- **Ascendencias parcialmente conocidas**: cuando la fuente no publica el nombre pero sí la clase (Ranger2, Druid3), la UI muestra ambas realidades por separado — «Nombre no verificado · clase Ranger (Ranger2)» — vía `describeAscendancy` (helper puro con tests).
- Este documento revisado por completo: las secciones antiguas quedan marcadas como históricas y los supuestos/pendientes reflejan el estado real tras el Hito 4A.

## Sesión 7 — Hito 4A: resolución de pasivas y ascendencias (export oficial de GGG)

- **Registro interno** derivado solo del export oficial `grindinggear/poe2-skilltree-export`,
  commit fijado `1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6`, SHA-256 del `data.json`
  `f83c94ce7b09f2bfc5b3b1d63523c2ab3d2582d0e964f6aeec34b8b0390abcfe` (5 141 380 bytes),
  obtenido el 2026-08-20. Datos de Grinding Gear Games; **licencia explícita: no encontrada**.
  4912 nodos, 12 clases y 25 ascendencias; sin sprites ni recursos gráficos.
- **El parche no se atribuye a la fuente**: el commit de origen se etiqueta a sí mismo como
  `0.5.2`; nosotros solo declaramos `testedAgainstPatch: "0.5.4f"` (compatibilidad probada).
  Por eso el artefacto se llama `passiveRegistry.1e9eb2d8.json` y no `passives.0.5.4f.json`.
- **Proceso offline y reproducible** (`scripts/build-passive-registry.ts`): verifica el
  SHA-256 de la revisión fijada, valida entrada y salida con esquemas estrictos y falla
  con mensaje claro si la estructura oficial cambia. En runtime no hay red ni descargas.
- **Servicio de solo lectura** (`server/registry/passiveRegistry.ts`): id de pasiva → nombre
  inglés verificado; ascendancy id → nombre y clase; desconocido → explícitamente no
  verificado con el id crudo siempre disponible. El nombre nunca se deduce del id.
- **Integración**: `POST /import/build` devuelve `resolution` en PARALELO al plan; el `.build`
  crudo no se toca (test: importar, resolver y reexportar Titan Warrior es verbatim).
  Titan Warrior resuelve **34/34** pasivas y `Warrior1` → **Titan** (clase Warrior). La UI
  muestra nombre inglés + id, y los desconocidos como «No verificado».
- **Aviso obligatorio** visible en la interfaz: «This product isn't affiliated with or
  endorsed by Grinding Gear Games in any way.»
- Corregido de paso el desfase de `MAX_MARKUP_TAG_LENGTH`: una etiqueta de exactamente 32
  caracteres ya respeta el límite documentado (prueba de frontera 32/33 que fallaba antes).
- Verificado: `tsc -b` 0 errores, **98/98** tests, ESLint 0 errores, build OK, 20/20 smoke
  (prod+dev) y 14/14 comprobaciones de navegador del flujo del registro.
- Limitaciones: la fuente publica algunas ascendencias sin nombre (`Ranger2`, `Druid3`) y se
  marcan como no verificadas; no se resuelven gemas ni supports (fuera de alcance).

## Sesión 5 — validación manual dentro del juego y corrección de markup

- **Validación manual en PoE2 real (2026-08-20)**: el propietario importó en el juego un `.build` exportado por Exile Copilot (plan Titan Warrior con mejora aplicada incrustada). PoE2 importó correctamente el nombre y la ascendencia, las **34 pasivas con sus rutas**, las **4 habilidades** (Boneshatter, Earthquake, Infernal Cry, Shockwave Totem) y los **9 huecos de equipo**, incluido el texto añadido al anillo «Mejora planificada: Cubrir resistencias elementales hasta el cap». Evidencia: [árbol de pasivas](docs/screenshots/ingame-arbol-pasivas.jpg), [habilidades](docs/screenshots/ingame-habilidades.jpg), [equipo con la mejora incrustada](docs/screenshots/ingame-equipo-mejora-incrustada.jpg). Esto es una validación **manual y puntual de ese archivo**, distinta de las pruebas automatizadas (que validan contra el esquema documentado); el resto de exports siguen siendo «válidos contra el esquema», no «probados en el juego».
- **Corregido**: las recomendaciones de la regla «Acercarse a la build de referencia» mostraban restos del markup oficial («Increased Armour}; …»). Causa: las pistas de los inventory_slots se limpiaban línea a línea, pero los bloques `<tag>{...}` del markup GGG abren y cierran en líneas distintas, así que la llave de cierre sobrevivía en la última línea del bloque. Ahora el markup se elimina sobre el texto completo antes de trocearlo, con un parser de **un solo recorrido O(n)** (pila que distingue la llave de un wrapper de una llave literal); las llaves/paréntesis de texto legítimo fuera de un wrapper no se tocan y un wrapper sin cerrar se conserva verbatim. La primera versión del arreglo era iterativa y cuadrática: medida en esta máquina, 50 000 niveles anidados (342 kB, dentro del límite de 2 MB de la API) bloqueaban el servidor 25 960 ms, frente a 3,5 ms con el parser actual y salida idéntica. Se limitan además las pistas incorporadas a una recomendación (`MAX_PLAN_HINTS` 40, `MAX_LISTED_GAPS` 12, con el resto declarado por número). Regresiones en `tests/unit/auditRegressions.test.ts` (fallaban antes de cada arreglo). 80/80 tests.

## Sesión 4 — auditoría independiente y correcciones

Las afirmaciones de la sesión 3 se verificaron de forma independiente: `tsc -b` (0 errores), 65/65 tests, ESLint 0 errores, build OK y 20/20 comprobaciones de navegador (Edge, prod + dev) reproducidas en esta sesión. El esquema `.build` se contrastó contra la documentación oficial de GGG (pathofexile.com/developer/docs/game), los endpoints de poe.ninja contra poe.ninja/docs/api, el hilo «0.5.4f Hotfix» (Stacey_GGG) contra el foro oficial y el fixture PoB2 contra la issue #2412 (coincide byte a byte). No se encontraron P0/P1. Defectos P2 corregidos (72/72 tests tras las correcciones, con regresiones que fallaban antes de cada arreglo):

- **`level_interval`**: la doc oficial lo define como `?(array of uint, or uint)`; el esquema solo aceptaba tuplas de exactamente 2 y rechazaba archivos válidos según la doc. Ahora acepta uint o array de uint.
- **Campos no documentados**: un `.build` con campos fuera del esquema v1 los perdía en silencio al importar/reexportar. Ahora los esquemas son *loose*: se conservan tal cual, el importador los declara en warnings y la reexportación los preserva (incluidos los del objeto raíz).
- **`primaryCurrency`**: con una moneda primaria no reconocida la API respondía `"exalted"` (un desconocido convertido en afirmación concreta). Ahora responde `null`; los quotes individuales conservan su nota «No verificado».
- **Mejoras aplicadas obsoletas**: una recomendación marcada en una generación anterior (ya invalidada) podía colarse en el `.build` exportado. Ahora las marcas se reinician con cada resultado y la exportación filtra contra el resultado vigente.
- **Mutación del plan al exportar**: `exportGggBuild` mutaba el plan de entrada al anotar la mejora de skill (copia superficial); dos exports con el mismo objeto duplicaban texto. Corregido con copia por elemento.
- Menor: el placeholder de importación aún mostraba el formato propietario eliminado (`{"formatVersion": 1}`).

Notas sin cambio de código: la afirmación de fidelidad de la sesión 3 se apoyaba en el fixture oficial Titan Warrior, que **no contiene** `level_interval`, `weapon_set` ni coordenadas; ahora existe un test con un plan sintético que ejercita todos los campos documentados. `meta.archetypes` sigue hardcodeado y sin uso en el frontend (P3). `demoMercenary.build` no lo usa ningún código ni test (P3). La reproducibilidad depende de Node 24+ en PATH (en esta máquina solo existe el Node 24.15 empaquetado con kimi-desktop).

## HISTÓRICO — sesión 3: qué funcionaba entonces

> Redactado en la sesión 3 y conservado como historial. Varios puntos han
> evolucionado después: la sesión 5 añadió una validación manual dentro del
> juego y la sesión 7 incorporó el registro oficial de pasivas. El estado
> vigente es el de las secciones de sesión más reciente y «Pruebas ejecutadas».

- **Integridad del repo**: `server/data/patches.json` estaba ignorado por un patrón `.gitignore` demasiado amplio (`data`); corregido a `/data/` y versionado. Verificado con `git ls-files` y con clon limpio (ver «Pruebas ejecutadas»).
- **Separación personaje actual vs plan `.build`**: un `.build` oficial de GGG ya NO se convierte en snapshot del personaje. Importarlo crea un **BuildTargetPlan** (sección «Build objetivo», con aviso «no es tu personaje actual») y conserva el objeto oficial crudo. El motor nunca ejecuta reglas de equipo/quality/mods/resistencias sobre inventory_slots del planner. Eliminado el `archetype: "mercenary-crossbow"` hardcodeado. Test obligatorio incluido: importar «Titan Warrior» nunca menciona ballesta, quality ni «0 mods».
- **Fidelidad del `.build`**: importar y reexportar conserva `level_interval`, `weapon_set`, `additional_text` (con markup), coordenadas `slot_x/slot_y`, `author` y `link` (tests con `toEqual` sobre el fixture oficial y, desde la sesión 4, sobre un plan sintético que ejercita todos los campos documentados y los no documentados). Las pérdidas se listan expresamente en el informe. `ascendancyId` (id oficial) separado del nombre visible. `unique_name` solo se exporta si es verificada (por defecto no, y se reporta). En la UI y docs: «válido contra el esquema GGG», nunca «probado en el juego».
- **Persistencia**: restauración corregida para React Strict Mode (efecto idempotente, no se queda en «Restaurando…»); el id solo se guarda en localStorage tras un `POST /api/character` exitoso (perfil real en SQLite). Verificado en navegador, en producción y desarrollo: guardar vida=2150 → recargar → exactamente vida=2150, y la respuesta de guardado se comprueba (200 + `profile.life === 2150`).
- **Recomendaciones aplicadas**: el servidor ya no las descarta — se incrustan como texto legible en `description` («Mejoras planificadas: 1) …») y en `additional_text` del slot/skill relacionado. Test que comprueba el contenido del archivo, no solo el HTTP 200.
- **Mercado**: `verified: true` exige moneda primaria reconocida (test de primaria desconocida); las tasas transportan origen (`live`/`cache-fresh`/`cache-stale`/`fixture`) y verificación; tasas fixture/stale nunca justifican afirmar que una compra entra en el presupuesto (test de quote live + rates stale).
- **Datos**: parche local actualizado a `content: 0.5.4`, `hotfix: f`, `asOf: 2026-08-12`, fuente: hilo oficial «0.5.4f Hotfix» (Stacey_GGG, foro de parches de pathofexile.com) — verificado en el foro oficial en esta sesión.
- **Fixture PoB2 real**: los tests del adaptador PoB usan un código REAL extraído de la issue #2412 del repo PathOfBuilding-PoE2 (decodifica a XML `PathOfBuilding2` de 12 929 bytes, clase Ranger), con `PROVENANCE.txt`; los payloads sintéticos solo cubren los límites de seguridad.
- `docs/PLAN.md` reescrito: ya no documenta el formato propietario eliminado.

## Cómo abrir la aplicación

```bash
cd exile-copilot
npm install
npm run dev    # http://localhost:7100 (frontend + API en un solo servidor)
```

## Cómo probar el flujo principal

Manual: «Cargar ejemplo» → editar vida → «Guardar correcciones» → presupuesto → «Generar recomendaciones» → marcar una → «Descargar .build» → ver informe → recargar (el personaje vuelve con la vida exacta). Importar un `.build` oficial lo añade como build objetivo (plan), no como personaje.

Automatizada (navegador real, Edge):

```bash
npm run build
npm run test:browser        # producción
node scripts/browser-smoke.mjs --all   # producción + desarrollo (Strict Mode)
```

## Capturas

`docs/screenshots/flujo-prod.png` y `flujo-dev.png` (smoke automatizado, regeneradas en cada ejecución) e `ingame-*.jpg` (validación manual dentro del juego, sesión 5).

## HISTÓRICO — decisiones tomadas (sesión 3)

- El `.build` oficial se trata siempre como PLAN: la importación aterriza en «Build objetivo»; solo los códigos PoB rellenan un personaje parcial.
- Fidelidad vía conservación del objeto crudo en `target.plan`: la reexportación parte del plan original y declara cualquier pérdida.
- Las mejoras aplicadas se exportan como texto legible (description/additional_text), no como datos estructurados inventados.
- La restauración del personaje hace una doble petición GET bajo Strict Mode (idempotente); se priorizó corrección sobre ahorro.

## Supuestos (vigentes)

- Adaptador GGG OAuth desactivado por flag (`GGG_OAUTH_ENABLED=false`). No hemos verificado el estado actual del proceso de solicitudes OAuth de GGG; activarlo exigiría comprobarlo primero.
- Pasivas y ascendencias SÍ se resuelven a su nombre inglés oficial con el registro derivado del export de GGG (Hito 4A); los ids fuera del registro se muestran como «No verificado». Sigue sin existir fuente incorporada para `BaseItemTypes`: los nombres de skills y support skills no se resuelven todavía.
- PoB/POBb.in: adaptador básico (Hito 6 pendiente).

## HISTÓRICO — pruebas ejecutadas en la sesión 8 (2026-08-20)

- `npx tsc -b` → 0 errores.
- `npx vitest run` → **9 archivos, 102/102 verdes**.
- `npm run lint` → 0 errores.
- `npx vite build` → OK (~151 kB gzip).
- `node scripts/browser-smoke.mjs --all` → **20/20** (10 comprobaciones en producción + 10 en desarrollo con Strict Mode).
- Flujo del registro en navegador (plan Titan Warrior): resolución 34/34 visible, nombre inglés + id, ascendencia Titan, procedencia y aviso de GGG.
- Verificación desde **checkout limpio**: ver sección siguiente.

## Verificación desde checkout limpio

Realizada sobre un `git clone` del commit final (no sobre el working tree): `npm install` → `npx tsc -b` (0 errores) → `npx vitest run` (102/102) → `npm run lint` (0 errores) → `npx vite build` (OK). Además, regenerar el registro de pasivas desde el `data.json` fijado (`npx tsx scripts/build-passive-registry.ts --input …`) produce **exactamente los mismos bytes** que el artefacto versionado y deja `git status` limpio, gracias a la regla `eol=lf` de `.gitattributes`. Clon eliminado tras la verificación; sin procesos residuales.

## Funciones incompletas

- Resolución de skills y support skills (`BaseItemTypes`): sin fuente incorporada; sus nombres siguen sin resolverse. (La resolución de PassiveSkills y ascendencias está TERMINADA — Hito 4A.)
- Adaptador PoB: extracción básica. POBb.in: sin vía pública documentada.
- Explicador LLM: stub desactivado.

## Errores conocidos

- Precios de objetos raros: «No verificado» (poe.ninja solo cotiza únicos y divisa).
- Bundle JS > 500 kB (aviso de Vite sin impacto funcional).

## Riesgos legales o de datos

- Solo API económica documentada de poe.ninja desde servidor, con User-Agent, caché/ETag. Sin scraping ni endpoints internos. Cero secretos en el repo.

## Próximo paso recomendado

## Sesión 20 — mentor contextual persistente

El mentor deja de vivir únicamente dentro del acordeón de conversación. Un
panel flotante acompaña ahora las dos áreas del producto y cambia de contexto
cuando el jugador:

- abre una pieza del equipo;
- cambia entre expediente y plan/mercado;
- modifica objetivo, presupuesto, moneda o liga;
- genera recomendaciones, consulta mercado o guarda un próximo paso;
- inicia una sesión de decisión.

Cada reacción inmediata se deriva de datos estructurados ya presentes en la
aplicación y no consume IA. «Analizar este contexto» envía una pregunta acotada
al proveedor supervisado existente; la respuesta vuelve al propio panel y queda
también en la conversación completa. No se escucha cada clic del DOM y no se
añaden hechos, precios, mods ni acciones fuera del motor.

Validación: `tsc -b`, ESLint, build y **305/305** pruebas; recorrido real en
navegador sobre el perfil Demo Gemling comprobado para cambio de área,
inspección de `Doom Song`, respuesta real de Groq y salto al historial.

Hitos 5A, 5B, 6A y 6B están **integrados en `main`** (`dd671178`), y la
microcorrección posterior al 6B —contrato de `goal`, aislamiento de SQLite en los
smokes y esta puesta al día documental— está **terminada**.

Lo siguiente es el **rediseño visual «Expediente del personaje»**: el área
Mentor apila hoy diario, sesión, conversación y recomendaciones, y esa pila pide
una jerarquía mejor. Después, **Copilot conversacional v1**: historial
persistente de la conversación (hoy el hilo vive solo en memoria de la
interfaz), reconocimiento de intención más amplio y seguimiento de crafts paso a
paso — manteniendo la regla de que la decisión, la próxima acción, las fuentes,
la confianza y lo no verificado salgan siempre del motor y del diario, aunque
algún día se añada un LLM para redactar.

La resolución de `BaseItemTypes` (nombres de skills y support skills) continúa
pendiente, pero no bloquea nada de lo anterior.

## Sesión 28 — contrato de protección de modificadores

El preflight de Monedas, Essences y Alloys permite declarar qué modificadores
explícitos son indispensables antes de gastar. `shared/craftingProtection.ts`
evalúa la protección usando solo el snapshot real y el mecanismo de retirada
declarado: retirada aleatoria = riesgo posible, retirada elegida = segura si
existe una alternativa no protegida, retirada desconocida = faltan datos y
pérdida inevitable = bloqueo. No se presentan probabilidades inventadas.

La intención se conserva en `DecisionSession.craftingExperiment` y la
comparación posterior informa por separado si los modificadores protegidos se
mantuvieron, se perdieron o ya no pueden verificarse. Una pérdida protegida no
se oculta aunque el cambio estructural de la moneda sea correcto. La selección
queda acotada al objeto y a sus ids de modificadores vigentes para impedir que
una protección obsoleta se reutilice después de actualizar el snapshot.

Validación final: TypeScript y ESLint sin errores, build de producción correcto,
**429/429** pruebas y **166/166** comprobaciones del recorrido de equipo y
Crafting en producción y desarrollo/Strict Mode. Los puertos temporales 7188 y
7189 quedaron libres.

## Sesión 29 — Crafting orientado a una decisión

Se aplicaron los hallazgos verificables de la auditoría visual sin alterar el
motor. El banco sigue la jerarquía pieza → estado → siguiente paso → método: la
pieza seleccionada muestra un semáforo textual, una lectura parcial ofrece
volver directamente al importador de objetos y Monedas, Essences y Alloys se
presentan como controles compactos. La información de conocimiento,
probabilidades y límites vive ahora en el mismo bloque de evidencia, en lugar
de tres superficies repetidas.

Se corrigió el crecimiento horizontal del carrusel con `min-w-0`/`max-w-full`
y se añadió una regresión exacta a 375 px. El guardado de memoria dejó de
competir visualmente con «Generar recomendaciones»: conserva su función, pero
usa jerarquía secundaria. No se modificó `ContextualMentor`, porque la auditoría
lo describía como estático pero el código vigente ya lo posicionaba fijo.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**429/429** pruebas y **168/168** comprobaciones reales en producción y
desarrollo/Strict Mode. Crafting mide 375/375 px sin desbordamiento y su estado
inicial se mantiene por debajo de 2,5 pantallas móviles.

## Sesión 30 — Crafting utilizable en menos de un minuto

Se cerró el recorrido principal alrededor del motor sin cambiar sus reglas. Un
objeto suelto puede preparar una sesión en el mismo gesto: el perfil mínimo se
persiste, se recarga su diario y el editor completo no aparece. La acción
compatible queda visible por delante de las bloqueadas; las monedas que solo
añaden y las Essences sin retirada ya no muestran protección de afijos.

Al crear la sesión, el foco y el desplazamiento llegan al caso de Crafting. El
planificador anterior permanece montado para conservar borradores, pero queda
oculto mientras la sesión está activa. La sesión específica se reduce a tres
etapas visibles —antes de gastar, pegar resultado y decidir— y elimina badges,
restricciones, próxima acción y evidencia avanzada que duplicaban el mismo
mensaje. Una comparación confirmada deja en pantalla solo el cambio y las
decisiones «Sí, me sirve», «No era lo que buscaba» y «Parar por ahora».

Validación: TypeScript y ESLint sin errores, build de producción correcta,
**429/429** pruebas y **184/184** comprobaciones de navegador en producción y
desarrollo/Strict Mode. El recorrido desde la bienvenida usa ocho interacciones
y cubre también un fallo controlado del primer autoguardado: conserva objeto,
objetivo y confirmaciones, no abre el editor ni crea una sesión fantasma, y el
mismo botón reintenta con éxito. Además, se recorrió una instancia temporal con
la ballesta real: sesión visible y enfocada, y planificador oculto. Los puertos
y las bases SQLite temporales quedaron cerrados y eliminados al terminar.

## Sesión 31 — el resultado responde al objetivo del jugador

El preflight de Monedas, Essences y Alloys conserva ahora dos capas del
objetivo: una categoría explícita —daño, defensa, atributos, velocidad,
habilidades u otro— y la descripción libre del jugador. La categoría es
opcional en el contrato persistido para que las sesiones anteriores sigan
siendo válidas.

Después del craft, `shared/craftingGoal.ts` compara exclusivamente las
etiquetas literales de los modificadores añadidos con la categoría elegida.
Devuelve tres estados honestos: señal directa, sin señal directa o datos
insuficientes. No analiza nombres ni texto del afijo, no calcula utilidad y
explica que una ausencia de señal puede esconder una interacción indirecta.
La pregunta «¿me sirve?» y la decisión final permanecen en manos del jugador.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**440/440** pruebas y **190/190** comprobaciones reales del flujo de equipo y
Crafting en producción y desarrollo/Strict Mode. La regresión de navegador
selecciona «Daño», importa un resultado etiquetado por el juego como «Daño,
Ataque» y exige que aparezca la señal directa antes de la valoración humana.

## Sesión 32 — lectura contextual del resultado

`shared/craftingCharacterContext.ts` convierte la comparación ya observada en
una decisión contextual conservadora: **candidato**, **revisar** o **detenerse**.
Comprueba el nivel y los atributos frente a los requisitos del resultado,
prioriza cualquier pérdida de modificadores protegidos y puede relacionar una
etiqueta literal de resistencias con resistencias elementales conocidas bajo
75%. También indica si la pieza está realmente vinculada al equipo y si la
categoría del craft coincide de forma inequívoca con el objetivo general
`damage` o `survival`.

No calcula DPS, defensas derivadas, precio ni una nota numérica. Si el craft
añadió o retiró un modificador etiquetado como atributo, invalida el total
anterior para comprobar requisitos en vez de presentar un dato obsoleto como
hecho. La interfaz resume la salida en tres chips y mantiene hechos y límites
plegados bajo «Por qué dice esto» para no volver a llenar la pantalla de texto.

Validación: TypeScript y ESLint sin errores, build de producción correcto,
**445/445** pruebas y **190/190** comprobaciones reales del recorrido de equipo
y Crafting en producción y desarrollo/Strict Mode. Los puertos temporales 7188
y 7189 quedaron libres.

## Archivos importantes

- `README.md`, `docs/PLAN.md`, `docs/HITO_5A.md`, `docs/HITO_5B.md`, `HANDOFF.md`.
- `shared/domain.ts` (snapshot), `shared/gggBuildPlanner.ts` (oficial + BuildTargetPlan), `shared/api.ts`.
- `server/importers/gggBuildImporter.ts` (→ plan), `server/exporters/gggBuildExporter.ts` (fidelidad + informe + mejoras planificadas).
- `server/services/poeninja.ts` (rates con origen/verificación), `server/engine/`, `server/data/patches.json`.
- `server/fixtures/ggg/titanWarrior.build.json` (oficial verbatim), `server/fixtures/pob2/` (código PoB2 real + procedencia), `server/fixtures/demoSnapshot.json`.
- `src/` (frontend, Strict Mode), `scripts/browser-smoke.mjs`, `tests/`.
