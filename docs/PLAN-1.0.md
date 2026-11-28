# Plan hasta la 1.0 y después (acordado el 24-11-2026)

**Idea:** el producto es el mentor. La web es su memoria (lee el personaje y
tiene los datos del juego). La ventanita es donde vivirá mientras se juega.

**Cómo se trabaja:** una tarea por chat. Al acabar cada tarea se marca aquí
con `[x]`, se apunta el resultado en una línea y se le da a Luis el prompt de
la siguiente. Nada se sube sin su sí.

## Etapa 1 · hasta el 10-12: que no falle

### Semana 1 (24 al 30 de noviembre)

- [x] **1. Medir el Mentor con dos personajes novatos** que no sean la Liche de
  Luis (por ejemplo un guerrero y una arquera, nivel 10-25). Veinte preguntas
  de novato, diez por personaje. Resultado en `docs/MEDICION-MENTOR-2.md`:
  bien / a medias / mal, y por qué. **Umbral: 8 de cada 10 bien.**
  → Hecho el 24-11: **5 bien, 3 a medias, 12 mal. No llega al umbral.** No inventó
  nada. Falla por no saber lo básico del juego y por no reconocer frases. Sin
  medir con IA: la clave local de Groq da 401.
- [x] **2. Arreglar la respuesta floja** de la «primera gema de asistencia»
  (propone veneno para Descarga de caos).
  → Hecho el 24-11: la primera gema ya propone lo que funciona siempre
  (Destrucción controlada, Lanzamiento rápido I, Rebote III) y dice dónde
  ponerla. Sin decir el grado, enseña grado I hasta nivel 14 y hasta II desde
  el 15, y lo avisa. Medición repetida: G2 pasa a bien, **6 de 20**.
- [x] **3. Guardar las preguntas que el Mentor no sabe contestar** (antes,
  comprobar si ya se guardan). Sin texto personal: solo la pregunta y el motivo.
  → Hecho el 24-11: no se guardaban (solo un contador sin texto). Ahora se apunta
  la pregunta, el motivo, el idioma y cuántas veces llega; sin sesión, personaje
  ni hora. Luis las lee en `/estadisticas`, con su clave, en «Preguntas que el
  Mentor no supo contestar». Se borran a los 90 días sin repetirse. El aviso de
  privacidad de la web lo dice.
- [x] **4. Escribir las reglas que falten** según la medición de la tarea 1
  (lista ordenada en `docs/MEDICION-MENTOR-2.md`, «Reglas que faltan»).
  → Hecho el 24-11: los siete puntos de la lista. Medición repetida: **16 bien,
  4 a medias, 0 mal.** La pregunta real de Luis (arma única o varita amarilla)
  manda al comparador. Ojo: las reglas se escribieron mirando estas veinte
  preguntas; con preguntas nuevas saldrá menos. A medias quedan el árbol sin
  marcar (G4, E9), escudo o dos manos (G6) y qué ascendencia (G9): faltan datos.
- [x] **5. Si la tarea 1 llega al umbral: el Mentor al centro de la portada**
  (caja para preguntar arriba, con el personaje ya cargado). Si no llega, se
  queda donde está y sube en enero.
  → La tarea 1 no llegó (5 de 20). Tras la tarea 4 la misma medición da 16 de 20,
  justo el umbral, pero con preguntas ya conocidas. **Decide Luis** si sube ahora
  o en enero.
  → El 28-11 Luis dijo «hazlo». **Hecho en local, SIN commit y SIN subir**
  (se publica con su sí, después de la comprobación con IA de las 13:15): con
  personaje, la tarjeta «Pregúntale a tu Mentor» es lo primero de la página
  (caja, tres ejemplos y la conversación, que se abre ahí mismo); «Tu
  siguiente paso» va debajo y ya no lleva la caja. También en móvil: el equipo
  baja de la primera pantalla (antes se exigía lo contrario; los dos recorridos
  de humo se actualizaron). No cambia nada de lo que contesta el Mentor.
  **Sin hacer:** quien entra sin personaje sigue sin poder preguntar (el
  Mentor necesita un personaje; habría que abrir en el servidor las preguntas
  del juego sin él).
  → El 28-11 a las 13:30, **comprobado, sigue sin commit y sin subir:** lint,
  1787 pruebas, `npm run build` (salida 0) y los dos recorridos de humo
  (navegador y Mentor 51/51), con la IA apagada. Y una pregunta real con IA
  desde la caja de arriba (bruja de la base local): contesta la IA y la
  conversación se abre en la misma tarjeta, sin errores de consola. Copia de
  seguridad de los cambios en `refs/backup/mentor-arriba-28-11`. Falta solo el
  sí de Luis para publicarlo.
  → El 28-11 por la tarde, **publicado en main con el «sí, publícalo» de Luis.**
  Antes de subir se repitieron lint, pruebas, `npm run build` y los dos
  recorridos de humo.
- [ ] **6. Botón de donación** discreto.
  → Hecho el 25-11 salvo un dato: enlace de Ko-fi en el pie («¿Te ha servido?
  Invítame a un café»), junto a «Privacidad» y «Avisar de un problema». Los
  clics se cuentan en `/estadisticas` y el aviso de privacidad lo dice. **Falta
  el enlace de Ko-fi de Luis:** se pone en `shared/donation.ts`; mientras esté
  vacío, el enlace no se ve. Subido así el 25-11.
- [x] **7. Recorrer como novato las tres puertas** (guías, revisión rápida,
  árbol con PoB2) y arreglar cada atasco.
  → Hecho el 25-11: recorrido en local como visitante nuevo; 17 atascos en la
  lista: 16 arreglados y 1 falsa alarma (tocar el nombre de la zona ya marcaba
  la casilla). Lo gordo: el Mentor ya entiende «estoy atascado» y «ayúdame»; la
  revisión rápida pide todos los datos de una vez y no se cierra si falta
  alguno; «Crear mi personaje» pide el nivel y ya no acaba en «Faltan datos»;
  sin personaje, la portada sale aunque vinieras de una guía; el menú de la
  izquierda lleva nombre en portátil; la mascota se aparta al escribir; la
  habilidad se elige de una lista y avisa si no existe; PoB2 no da ranking de
  daño si no reconoce la habilidad. Pasados el 25-11: `npm run build`, la batería
  completa (1652 pruebas) y las ocho pruebas de humo. Una comprobación de humo
  buscaba la frase vieja del panel de PoB2: corregida la prueba, no la web.
  Pendiente aparte: el motor de recomendaciones apunta al 75 % de resistencias
  y la revisión rápida y las guías al 30 % en el acto 1; no se ha tocado.
  En la rama `ventanita-guia` (no en main): casilla con clic para cada trozo de
  mapa del acto 4, y aviso en Punta del botín si falta alguno.

### Semana 2 (1 al 7 de diciembre)

- [ ] **8. Dos o tres personas reales** que no conozcan la web la usan y Luis
  mira sin ayudar. Arreglar donde se atasquen.
- [x] **9. Textos del lanzamiento escritos:** guía de Steam actualizada,
  Discusiones de Steam, Discord, Reddit y el directo.
  → Hecho el 25-11: todos en `docs/promo/lanzamiento-1.0.md` y la guía en
  `docs/promo/guia-steam-acto-1.md` (cambian título, descripción y secciones
  2, 3 y 7). Steam y Discord van en inglés y en español; Reddit, en inglés con
  las normas 9 y 11. Escritos con los datos de la 0.5.5: **no pegar hasta que
  la web tenga los datos de la 1.0** y se haya mirado el acto 1, si los actos
  3 y 4 siguen en borrador y si hay actos nuevos.
- [x] **10. Ensayo del día del parche** con `docs/DIA-DE-LA-1.0.md`.
  → Hecho el 25-11: los scripts son unos 6 minutos; lo largo es esperar a las
  fuentes y los pasos a mano (guías, parche y liga). Nueve atascos arreglados:
  los scripts de datos ya dicen qué ha cambiado (antes se perdían traducciones
  sin aviso), `data:status` ya no da por buenas las gemas leídas antes del
  parche, dos pruebas del árbol que habrían fallado sin motivo el día 11, y el
  documento (orden gemas → PoB2, comando del paso 8, rutas viejas). **Sin
  ensayar, porque Luis jugaba:** la descarga de PoB2 (`npm run data:pob`, un día
  que no juegue) y `verify:release` (va en la tarea 11). Lista entera en el
  documento, «Ensayo del 25-11-2026».
- [x] **12. El Mentor usa la IA para entender y redactar** (pedido por Luis el
  25-11: era su idea original). La IA entiende la pregunta y la redacta; las
  reglas ponen los datos del juego. Nunca al revés: en noviembre, cuando la IA
  elegía sola, se inventó dos cosas.
  - Paso 1: la IA decide qué se está preguntando (gemas, árbol, resistencias,
    mejorar una habilidad…) cuando las reglas no reconocen la frase, y después
    contestan las reglas de siempre. Si ninguna encaja, sigue el «no lo sé».
  - Paso 2: la IA redacta la respuesta de las reglas con sus palabras, sin
    poder añadir cifras ni nombres que no vengan de ellas (el filtro ya existe).
  - Medir antes y después con las veinte preguntas de
    `docs/MEDICION-MENTOR-2.md` y con las preguntas reales guardadas en
    `/estadisticas`. Si no mejora, no se sube.
  - Sin clave o sin cupo (Groq gratis: 200.000 tokens al día), contesta por
    reglas como hoy.
  - Dato del 25-11: la web publicada dice `ai-assisted` con Groq, pero eso
    solo es que hay clave puesta; falta comprobar que la clave funciona. En
    local da 401.
  - Antes del 8-12, que se congela.
  → El 25-11, **paso 1 hecho, medido en local y subido**: la IA
  dice el tema, de una lista cerrada de veinte, y contesta la regla de ese tema.
  Prueba limpia con veinte preguntas de control: **de 4 bien, 2 a medias y 14 mal
  a 14 bien, 4 a medias y 2 mal.** No inventó nada; entendió otra cosa en una
  (C6, espíritu). Las veinte de siempre siguen en 16 bien. Tarda de 0,7 a 1,8 s
  cuando hace falta la IA. Detalle en `docs/MEDICION-MENTOR-2.md`, «Tarea 12».
  Preguntas reales guardadas en local: ninguna (están en la web publicada).
  **Paso 2 sin hacer: decide Luis.** Recomendación: después de la 1.0 (solo
  cambia el tono, y la redacción con IA que ya había falló dos veces al medir).
  Falta comprobar que la clave de Groq de Render funciona: preguntar en la web
  algo dicho raro; si la respuesta empieza por «Entiendo que…», funciona.

- [x] **13. El Mentor conversa: la IA contesta con los datos de las reglas**
  (queja de Luis el 25-11 al probarlo: «responde la web antes que la IA y
  sigue diciendo lo mismo sin ayudarme»). Reproducido en local con una bruja
  de nivel 49 y siete frases seguidas:
  - «¿y por qué esa?» tras una respuesta de gemas → habla de los huecos de
    equipo vacíos. No sabe de qué se estaba hablando.
  - «esa no la tengo, ¿qué otra me vale?» → repite la misma lista, letra a letra.
  - «mis esbirros se mueren enseguida» → lista de gemas de esbirro (ve la
    palabra «esbirros» y nada más).
  - «¿cómo mato al jefe del acto 3?» → «no sé», y la web tiene la guía del acto 3.
  - «ya, pero ¿qué hago exactamente?» → la frase genérica de siempre.
  Causa: las reglas contestan por palabras sueltas, con textos fijos y sin
  mirar la charla; la IA solo entra cuando ninguna regla reconoce la frase, y
  solo para decir el tema. Es el paso 2 de la tarea 12, hecho de verdad:
  - Las reglas siguen poniendo los datos (gemas candidatas, problemas del
    personaje, textos de las guías). La IA escribe la respuesta con ellos,
    mirando la pregunta y los turnos anteriores.
  - El filtro de siempre: ni un nombre ni una cifra que no venga de los datos.
    Si la IA falla, tarda o no hay cupo, sale el texto de las reglas, como hoy.
  - Las guías por acto entran como datos (jefes, zonas, recompensas).
  - Medir con **charlas** (pregunta y dos repreguntas), no con preguntas
    sueltas: las mediciones anteriores no veían este fallo.
  - Coste: 1 o 2 s por respuesta y el cupo gratis de Groq (200.000 tokens al
    día, unas cien respuestas). Antes del 8-12, que se congela.
  → El 25-11, **hecho en local, sin subir: falta medir el control.** La IA lee
  la charla, elige los datos que contestan y escribe la entrada; los datos
  salen copiados tal cual (redactando libre llegó a decir lo contrario de la
  guía). Charla de la bruja: **de 2 bien, 1 a medias y 6 mal a 7 bien, 2 a
  medias y 0 mal**; ningún dato inventado. Las guías por acto ya son datos, y
  sin IA el jefe del acto 3 también se contesta. Control nuevo (12 turnos):
  antes 4 bien, 2 a medias, 6 mal; **después, sin medir: las mediciones
  gastaron el cupo gratis de Groq del día.** Coste real: de 2.500 a 4.000
  tokens por respuesta, unas 60 al día con el cupo gratis. Pasadas: 17 pruebas
  nuevas y las 269 del Mentor y las guías; la batería completa, sin pasar
  (Luis jugaba). Detalle en `docs/MEDICION-MENTOR-2.md`, «Tarea 13».
  Pagar en Groq está cerrado; para no depender de un solo cupo, si el modelo
  principal se queda sin él la petición va a dos de reserva (gpt-oss-20b y
  qwen3.8-27b): tres cupos de 200.000 tokens al día en vez de uno.
  → El 26-11, **control medido: de 4 bien, 2 a medias y 6 mal a 8 bien, 3 a
  medias y 1 mal** (una pasada, doce turnos, todos con el modelo principal,
  sin datos inventados). El que falla: tras hablar del conde, «¿y qué hago en
  la pelea?» vuelve al equipo. A medias: «¿dónde está?» sitúa solo una de dos
  cosas, «¿cuál pongo primero?» no nombra ninguna y «hace poco daño» se calla
  el arma sin mods. Detalle turno a turno en `docs/MEDICION-MENTOR-2.md`.
  En la rama, el 26-11: lint, las 1713 pruebas y `npm run build` en verde; las
  pruebas de humo, sin pasar (se pasan al fusionar).
  **Subido a main el 26-11 con el «sí, súbelo» de Luis.** Lo flojo del control
  queda para otro chat, con un control nuevo (este ya no vale si se retoca).
  Comprobado en la web publicada el 26-11 con una charla de dos turnos (el
  conde del acto 1): contesta la IA, sigue el hilo y tarda 1 s.
- [x] **14. Lo flojo de la charla** (propuesta del 26-11, sale del control de
  la tarea 13; antes del 8-12). Cuatro casos:
  - Tras hablar de un jefe, «¿y qué hago en la pelea?» vuelve al equipo: la
    regla de «qué hago» se queda la pregunta antes de llegar a la guía.
  - «¿Y eso dónde está?» cuando la respuesta anterior nombró dos cosas: sitúa
    solo una.
  - «¿Cuál pongo primero?» repite la lista sin nombrar ninguna.
  - «Hace poco daño» da asistencias y ya no dice que el arma no tiene mods
    (antes de la tarea 13 sí lo decía).
  Y los cierres: a veces ofrecen lo que el Mentor no sabe («¿te explico cómo
  enlazarlas?») o cambian una palabra de la guía («círculos de hielo» por
  «manchas de hielo», visto en la web el 26-11).
  Método: primero escribir un control NUEVO (cuatro charlas, otros personajes,
  sin mirar respuestas) y medirlo antes; arreglar; medirlo después. El control
  K1-K4 de `scripts/mentor-charla.mjs` ya está visto: sirve de regresión, no de
  prueba limpia. Como mucho dos pasadas con IA al día.
  → El 26-11, **arreglado en local, sin subir: falta la regresión K1-K4.**
  Control nuevo (`--control14`, doce turnos): **de 6 bien, 5 a medias y 1 mal
  a 8, 3 y 1 en la pasada completa; 9, 3 y 0 tras un retoque** (repetidas solo
  dos charlas). «¿Dónde está?» sitúa las 4 cosas (antes 2), «hace poco daño»
  dice el arma sin mods, y los cierres ya no ofrecen (de 9 de 12 a 0). El
  control encontró un dato inventado: «vale, y de gemas…» pasaba por saludo y
  la IA contestaba libre, con gemas que no existen; cerrado. Queda flojo: la
  repregunta de la pelea repite lo del primer turno, «¿algún jefe duro?» da
  uno solo y algún cierre pregunta lo que el Mentor ya sabe. Lint y las 1567
  pruebas en verde. Detalle en `docs/MEDICION-MENTOR-2.md`, «Tarea 14».
  → El 27-11, **regresión K1-K4 pasada y subido a main: de 8 bien, 3 a medias
  y 1 mal a 11, 1 y 0** (una pasada, doce turnos con el modelo principal, sin
  datos inventados; ningún turno baja). Lo que queda flojo: 6 de 12 cierres
  preguntan lo que el Mentor ya sabe y «¿qué hago en la pelea?» repite el
  primer turno. Lint, 1734 pruebas, `npm run build` y el humo del Mentor
  (51/51) en verde. De paso: el Mentor ya dice Ctrl+Alt+C al comparar piezas.
- [ ] **15. Los cierres y las repreguntas del Mentor** (lo flojo que dejó la
  regresión K1-K4 del 27-11; antes del 8-12). Tres casos:
  - Cierres que preguntan lo que el Mentor ya sabe (6 de 12 en K1-K4: «¿qué
    arco estás usando ahora?» justo después de nombrarlo).
  - «¿Y qué hago en la pelea?» repite las frases del primer turno aunque la
    guía tenga más de esa pelea.
  - A «dame otra» o «¿otra cosa?» da una sola; antes daba tres.
  Método: control NUEVO (`--control15`, cuatro charlas, otros personajes, sin
  mirar respuestas) medido antes de tocar nada; mirar las fichas gratis con
  `scripts/mentor-fichas.ts`; arreglar; medir después. K1-K4 y N1-N4 ya están
  vistos: solo valen de regresión. Como mucho dos pasadas con IA al día. Si no
  mejora, no se sube.
  → El 27-11, **arreglado en local, sin subir: falta medir el «después».**
  Control nuevo (`--control15`, doce turnos), antes: **4 bien, 7 a medias y 1
  mal; 8 de 12 cierres malos** (preguntan lo sabido o repiten el anterior). El
  control encontró dos cosas más: a la primera pregunta de gemas también daba
  una sola, y la tarjeta de Rudja salía como si fuera de Jamanra. Causas, vistas
  en las fichas: el detalle de la pelea del jefe final iba etiquetado como
  «otros jefes», nada decía qué frases estaban ya dichas y las instrucciones
  del cierre se contradecían. Arreglo: las guías marcan qué es de la pelea
  final, el servidor marca lo «ya dicho» y lo quita si se pide más, completa a
  tres asistencias y borra los cierres que preguntan por la hoja del personaje.
  Lint, 1744 pruebas y `npm run build` en verde. El «después» no se midió ese
  día: ya iban dos pasadas con IA (la regresión K de las 04:00 y este «antes»).
  Detalle en `docs/MEDICION-MENTOR-2.md`, «Tarea 15».
  → El 27-11 a las 13:15, **medido el «después»: 8 bien, 3 a medias y 1 mal;
  1 de 12 cierres malos** (una pasada, modelo principal, notas de quien
  escribió el código). Suben seis turnos y bajan dos: a «dame otra» no dio
  ninguna gema (P3.2, mal) y «¿qué resistencia subo?» cayó a la regla genérica
  porque la redacción de la IA se descartó (P2.3, a medias). Sin datos
  inventados en las frases enseñadas. Retoque después, **sin medir con IA**:
  «dame otra» da las tres siguientes si la IA no elige ninguna, «piezas» entra
  en el filtro de cierres y el registro guarda por qué se descarta una
  redacción. Lint, 1746 pruebas y `npm run build` en verde. **Sigue sin commit
  y sin subir.** Falta: regresión K1-K4 y repetir P2 y P3; otro día, N1-N4.
  → El 27-11 a las 16:00, **no se midió: ya iban tres pasadas con IA ese día
  (03:30, 04:20 y 13:15) y Luis eligió esperar al 28-11.** El arreglo está en
  un commit local (a751af8), sin subir. `npm run build` (código de salida 0) y
  las 1746 pruebas, en verde otra vez; el lint no se repitió. Sigue faltando
  lo mismo: regresión K1-K4 y repetir P2 y P3 (el 28-11); N1-N4, otro día.
  → El 27-11 por la tarde, **publicado en main (b8061ef) con el «súbelo todo»
  de Luis, sin la regresión con IA.** Antes de subir: lint, 1787 pruebas,
  `npm run build` y el humo del Mentor (51/51), todo sin IA. La regresión
  K1-K4, P2 y P3 y N1-N4 quedan pendientes con el cambio ya publicado: si algo
  baja, se arregla o se revierte.
  → El 27-11 a las 16:40 Luis volvió a pegar el prompt de la medición; iban
  3 h y media desde la última pasada (13:15) y tres pasadas en el día. Eligió
  **medir el 28-11 a partir de las 13:15**. No se midió nada ni se tocó código;
  la web publicada responde (portada 200, `/api/health` ok).
  → El 28-11 a las 13:16, **medida la regresión con IA, con el cambio ya
  publicado** (dos pasadas, modelo principal, sin datos inventados; notas de
  quien escribió el código). K1-K4: **de 11 bien y 1 a medias a 9 bien y 3 a
  medias; cierres que preguntan lo sabido, de 6 de 12 a 0.** Sube «¿y qué hago
  en la pelea?» (ya no repite). Bajan tres turnos de las charlas de gemas: la
  primera lista no empieza por las que mejor encajan, «dame otra» vuelve a dar
  la gema que el jugador dijo que no tenía, y «¿cuál de esas pongo primero?»
  nombra una que no estaba entre las tres recién dadas. P2 y P3: los seis
  turnos bien; los dos que bajaron el 27-11 (P2.3 y P3.2) están arreglados.
  **Propuesto, sin hacer (decide Luis):** tres arreglos de reglas en el
  servidor y medirlos otro día; N1-N4 sigue pendiente. Detalle en
  `docs/MEDICION-MENTOR-2.md`, «Comprobación con IA de las tareas 15 y 16».
- [ ] **16. Elegir habilidades y «Monta tu build»** (pedido por Luis el 27-11,
  a partir de lo que contó su hermano Gabo: «lo peor es elegir habilidades»,
  quiere montar la suya y saber si le vale con sus armas; acabó copiando una
  build porque montar la suya era difícil y lento). Dos partes:
  - El Mentor contesta cuatro preguntas con los datos de gemas, sin IA: «¿qué
    habilidad me cojo?», «¿me vale X con mi arma?», «¿por qué combina esta
    asistencia con esta habilidad?» y «¿cómo monto mi build?».
  - Un configurador en Guías (pestaña de gemas y piezas): arma → habilidades →
    «puedes usar 3 de 4» → asistencias de cada una.
  Lo que no hace, a propósito: un porcentaje de efectividad. La web no calcula
  daño; el recuento dice qué se puede usar con qué arma.
  → El 27-11, **hecho en local, en la rama `tarea-16-elegir-habilidades`, sin
  subir.** Control nuevo (`node scripts/mentor-elegir.mjs --control`, doce
  preguntas con cuatro personajes), SOLO REGLAS: **de 0 bien y 12 mal a 12
  bien** (notas de quien escribió el código). Las 98 preguntas de siempre,
  solo reglas, no cambian ni una. Lint, 1787 pruebas y `npm run build` en
  verde; el configurador, visto en el navegador en escritorio y en móvil con
  el personaje de la base local. **Sin medir con IA** (el cupo del día estaba
  gastado): con la IA encendida las respuestas pasan por la redacción y eso no
  se ha visto. Tampoco se ha pasado el humo del Mentor ni las pruebas e2e.
  Falta: medir con IA (después de cerrar la 15), el sí de Luis y fusionar.
  Detalle en `docs/MEDICION-MENTOR-2.md`, «Tarea 16».
  → El 27-11 por la tarde, **publicado en main (b8061ef) con el «súbelo todo»
  de Luis, sin medir con IA.** Humo del Mentor 51/51. Falta medirla con la IA
  encendida (`node scripts/mentor-elegir.mjs --control --con-ia`) y enseñársela
  a Gabo.
  → El 28-11 de madrugada (la medición con IA esperaba a las 13:15), **repaso
  de «Monta tu build» como jugador nuevo, en local: sin personaje, con la bruja
  de la base local, en inglés y en móvil. Arreglado y, con el «sí, publícalo»
  de Luis, publicado en main (a933f14) a las 03:26.** Comprobado en
  exilecopilot.com sin personaje: `?open=gems` y `?open=build` pintan la
  herramienta y la portada sigue saliendo. No toca el Mentor: la regresión con
  IA no cambia.
  - **Fallo en producción desde el 25-11:** `?open=gems` y `?open=compare`
    dejaban el área de guías en blanco a quien llega sin personaje (pestaña
    elegida, nada pintado). Visto en exilecopilot.com el 28-11. Causa: el área
    inicial se calculaba dos veces en `src/App.tsx` y una se olvidó del enlace
    directo. Ahora se calcula una vez.
  - Enlace directo nuevo: `?open=build` (o `?abrir=monta`) abre «Monta tu
    build». Sirve para pasárselo a Gabo.
  - Ya no propone la misma asistencia como primera para dos habilidades (la web
    reparte una copia por familia; la tarjeta no lo respetaba).
  - Las habilidades del personaje importado salen en el idioma de la web (antes
    «Chaos Bolt»), y al cambiar de idioma la build elegida sigue marcada.
  - Textos: «ade» pasa a «área»; «Furia I · grado I» ya no repite el grado; si
    la primera línea de una gema es lo que quita, va delante lo que da y
    después «A cambio: …»; el aviso «Ya tienes 4» sube encima de la lista; la
    nota de «nivel de gema» solo sale cuando hay lista.
  Lint, 1787 pruebas y `npm run build` (salida 0) en verde. Sin arreglar,
  apuntado: desde la portada nada lleva a «Monta tu build»; «1 de 4» no dice
  qué hacer con las otras tres; dos frases pegadas sin punto en los datos de
  «Maleficio duradero»; a Ofrenda de dolor le propone acortar su duración; no
  hay prueba automática de los enlaces directos sin personaje.
  → El 28-11 a las 13:25, **medida con la IA encendida: 10 bien, 1 a medias y
  1 mal** (solo reglas daba 12 bien). El que falla: «¿cuáles son las
  habilidades de ballesta?» → la IA no enseña ningún dato y contesta con las
  que el personaje ya lleva. A medias: «¿qué hechizos puedo elegir?» trae tres
  hechizos de verdad, pero la entrada generaliza por su cuenta. Uno cayó a las
  reglas (bien). **Propuesto, sin hacer:** si las reglas tenían respuesta y la
  IA no enseña ninguna frase, que salga la de las reglas. Sigue faltando
  enseñársela a Gabo.

- [ ] **17. Aprovechar la versión de septiembre** (pedido por Luis el 28-11).
  La rama `crafting-real-item-coach` guarda 517 cambios del 3 al 20-09 que no
  están en la web de hoy y que solo existen en su portátil (GitHub se quedó en
  el primero). Era la versión buena en septiembre; al relanzar en octubre se
  partió de `main` del 4-09 y eso quedó fuera. Unirla entera no es viable
  (ensayo: 152 archivos en choque). Se traen piezas sueltas, rehechas para la
  web de hoy, cada una en su rama y sin publicar hasta el sí de Luis.
  → El 28-11, **primera pieza hecha en local, en la rama
  `me-sirve-lo-encontrado` (faf1c10), SIN subir:** «¿Me sirve lo que he
  encontrado?». Se pega una pieza y la web la compara con la que el personaje
  lleva en ese hueco; contesta sí, no o da igual, y avisa si no llega de nivel
  o de atributos. Reglas, sin IA; español e inglés. Lint, 1802 pruebas y
  `npm run build` en verde; probada en local con el personaje de ejemplo.
  Falta: que Luis la vea, el humo y decidir cuándo se publica.
  Pendiente aparte: copia de la rama de septiembre en GitHub (el repositorio
  es público: antes, buscar claves en sus commits).
  Tropiezo del 28-11: al arrancar la versión de septiembre usó la base de datos
  local de la web de hoy y dejó una tabla vacía (`mentor_rate_limits`); nada
  más cambió. Desde entonces las otras carpetas se arrancan con
  `.claude/vite-aislado.mjs`.
  → El 28-11 a mediodía, en la carpeta de «¿Me sirve…?»: lint, 1802 pruebas,
  `npm run build` y los dos recorridos de humo en verde. Los recorridos pasaban
  sin tocar la tarjeta: añadida una comprobación propia a `browser-smoke.mjs`
  (pega unos guantes y lee el veredicto frente a los puestos), **sin commit**.
  Falta: que Luis la vea (abierta en `me-sirve-7210`), juntarla con main y su
  sí para publicar.
  → El 28-11 por la tarde, con el «sube todo lo que hayas acabado» de Luis,
  **unida a main y publicada** junto con las tareas 18 y 19 (ver la 19 para la
  batería). La unión no dio conflictos.
  **Claves en la rama de septiembre:** revisados los 517 commits que GitHub no
  tiene. Ninguna clave real (solo valores de prueba: `synthetic-…`,
  `test-key-not-real`), ningún `.env` ni base de datos. Si se sube al
  repositorio público se verían la carpeta de usuario de Windows en cinco
  documentos (`AGENTS.md`, `HANDOFF.md` y tres de `docs/`) y cuatro páginas
  oficiales guardadas en `docs/evidence/sources/`. Alternativa: copia en un
  repositorio privado. **Decide Luis.**
  **Qué más hay en septiembre que hoy no está** (repaso de solo lectura):
  aviso de atributos al cambiar una pieza (hecho en la tarea 18), tabla de
  cifras lado a lado (necesita `displayedProperties`, que hoy no existe), guía
  de qué recoger (el código es poco; el contenido era una sola build de arco
  de veneno), Mentor de equipo con IA (tarea 18) y cinco planificadores de
  crafteo avanzado (tarea 19). El gestor de varios personajes y «me falta
  daño» ya están cubiertos hoy.

- [ ] **18. El Mentor de equipo** (idea de Luis, de la versión de septiembre;
  pedido el 28-11: «púlelo antes de subirlo, mételo con tu código»). En
  septiembre la IA elegía la pieza y escribía los motivos: 27 archivos de
  filtros, unos 7.500 tokens por consulta, y aun así confundía habilidades y
  se quedaba sin cupo. Rehecho como el Mentor de hoy: **las reglas comparan y
  deciden; la IA solo elige frases y redacta.**
  → El 28-11, **hecho en local, en la rama `mentor-equipo` (sobre
  `me-sirve-lo-encontrado`), carpeta `exile-copilot-mentor-equipo`, SIN commit
  y SIN subir.** Debajo del veredicto de «¿Me sirve lo que he encontrado?» hay
  una caja «Pregúntale al Mentor por este cambio», con tres ejemplos («¿Por
  qué?», «¿Qué pierdo si me la pongo?», «¿Le sirve a mi habilidad?») y
  pregunta libre; la charla es de esa pieza.
  - El comparador pasa a `shared/` (`itemCompare.ts`, `foundItem.ts`,
    `pastedItemResistances.ts`): el servidor rehace la comparación y no se fía
    del veredicto del navegador. La petición lleva `gear` (pieza encontrada,
    cuál sustituye, estilo).
  - `server/mentor/gearQuestion.ts`: de la comparación salen frases con tema
    (veredicto, motivo, lo que gana, lo que pierde, requisitos, atributos,
    líneas que no aprovecha) y la respuesta sin IA. Camino propio en
    `answerMentorQuery` (`answerAboutGear`): no toca el Mentor de siempre ni
    las instrucciones de la IA.
  - `shared/gearSwap.ts`: «si me quito esto, ¿se me cae otra cosa?». Avisa,
    con los cuatro números, de la pieza que se quedaría sin su requisito de
    fuerza, destreza o inteligencia. También se ve en la tarjeta, sin preguntar.
  - `server/mentor/gearSkillFit.ts`: con las etiquetas de la gema, qué líneas
    de daño le llegan a la habilidad principal y cuáles no («es para ataques y
    Descarga de caos no es un ataque»). No juzga el daño físico ni lo que la
    línea no deja claro.
  - Una cifra o un nombre que no esté en las frases tira la redacción y salen
    las reglas, como en el Mentor de siempre.
  Lint, 1842 pruebas (40 más que «¿Me sirve…?»), `npm run build` y los dos recorridos de humo
  en verde; visto en el navegador en escritorio y en móvil con el personaje de
  ejemplo, **solo con reglas**. De paso: la compilación fallaba con un `@shared`
  en `guideCheck.ts` (el generador de guías no lo resuelve); va con ruta
  relativa.
  **Falta:** probarlo con la IA encendida (el 28-11 ya iban dos pasadas),
  comprobación propia en el recorrido de humo, que las líneas de un personaje
  importado en inglés salgan en español, llevarlo también a «¿Cuál de estas
  dos es mejor?», que Luis lo pruebe y su sí para publicar (detrás de «el
  Mentor arriba» y de «¿Me sirve…?»).
  → El 28-11 por la tarde, con el «sube todo lo que hayas acabado» de Luis,
  **unido a main y publicado, contestando con las reglas.** Como la redacción
  con IA de estas respuestas no se ha medido, va detrás de un interruptor
  apagado (`MENTOR_GEAR_AI_ENABLED`, en `server/config.ts`; Render no lo
  tiene puesto): la caja «Pregúntale al Mentor por este cambio» contesta con
  las frases de la comparación, sin llamar a la IA. **Falta:** tres preguntas
  con IA en local (a partir del 29-11 a las 13:30) y, si van bien, encenderlo
  en Render; lo demás de la lista de arriba sigue igual.

- [ ] **19. Planificadores de crafteo avanzado** (también de septiembre,
  pedido por Luis el 28-11 para después de la 18): flujos, emociones,
  fracturar, sacrificio y previsión. Son reglas, sin IA, pero grandes y atados
  a las sesiones de decisión del servidor (el formato guardado cambia). Ojo con
  la fecha: la web se congela el 8-12.
  → El 28-11 por la tarde Luis pidió empezarlos. **Dato que cambia el plan:** la
  web tiene apagado todo el crafteo avanzado (`advanced-crafting` en
  `server/data/patchCompatibility.json` está en «review-required» para 0.5.4f,
  0.5.5 y 1.0), así que Essences y Alloys tampoco se ven hoy; y el servidor
  vuelve a apagarlo si se cambia el estado sin evidencia («Detenido por
  evidencia inconsistente»). Además, las reglas de septiembre de los cinco
  tenían `testedAgainstPatch: null`. **Decisión de Luis: hacerlos y dejarlos
  apagados** hasta revisar todo el crafteo avanzado con la 1.0.
  → **Primero, el Orbe fracturante, hecho en local** (rama
  `planificadores-crafteo` sobre main 1f5ed07, carpeta
  `exile-copilot-planificadores`, SIN commit y SIN subir). Regla comprobada el
  28-11 en poe2db (inglés y español): objeto raro, al menos 4 modificadores,
  uno al azar queda fijo, no vale en objetos ya fracturados; nombre del juego
  en español, «Orbe fracturante». Rehecho con respuesta primero: en vez de
  pedir que el jugador copie la descripción del orbe y marque tres casillas,
  la tarjeta mira la pieza y dice si se puede usar, dónde puede caer y la
  probabilidad de que el fijo sea uno de los que marcó para conservar («2 de 5
  (40 %)»). No crea sesión ni toca el formato guardado.
  - `shared/craftingFracturing.ts`, `src/components/FracturingPlanner.tsx`,
    pestaña nueva en `CraftingActionPlanner.tsx` (detrás del mismo interruptor;
    no pide el consentimiento de reemplazo, porque no quita nada) y la
    herramienta nueva en el contexto del Mentor (`shared/mentorContext.ts`).
  - Vista previa solo en desarrollo: `?avanzado=1`
    (`src/lib/advancedCraftingPreview.ts`; en la versión publicada no existe).
  - Con tres explícitos y un implícito no afirma nada: el texto dice «4
    modificadores» sin decir si cuentan los implícitos.
  **Faltan** flujos, emociones, sacrificio y previsión (cada uno: leer su
  texto de hoy en poe2db antes de escribir una regla), y decidir con la 1.0 si
  se enciende el crafteo avanzado.
  → El 28-11 por la tarde, **hechos los otros cuatro, en local** (misma rama y
  carpeta, SIN commit y SIN subir; siguen apagados en la web publicada). El
  jugador ya no copia ninguna descripción: el texto de cada moneda sale del
  juego (poe2db, español e inglés, leído ese día).
  - **Mechón de Hinekora** (previsión; en español no se llama «Cierre»): dice
    si se le puede poner a la pieza y para qué sirve. El resultado previsto lo
    enseña el juego.
  - **Orbes de sacrificio:** dice cuál de los cuatro le toca a la pieza (arma o
    carcaj, armadura, amuleto/anillo/cinturón, joya), si se puede usar (rara,
    corrupta, con encantamiento) y la probabilidad de perder un modificador
    marcado. Una pieza corrupta ya no se queda en «no admite este craft»:
    debajo sale esta tarjeta.
  - **Emociones líquidas:** las 26 del juego (13 normales y 13 antiguas) con lo
    que pone cada una en cada joya, en un archivo generado
    (`node scripts/refresh-emotion-data.mjs`). Se elige la emoción y dice qué
    modificador pondría en esa joya.
  - **Flujos:** lee las resistencias de la pieza y dice qué haría cada uno de
    los cuatro, con la tabla de equivalencias del juego (hacia caos el rango
    baja).
  - Los modificadores que se quieren conservar se marcan con un toque en la
    propia tarjeta (también en el Orbe fracturante).
  - **Lo que no se sabe, y la tarjeta lo dice:** en qué se convierte cada
    encantamiento corrupto; si un flujo conserva el número exacto o qué pasa
    con dos líneas iguales; si el Mechón vale en piezas corruptas; si una joya
    con un modificador de fabricación admite otro.
  - **Dos erratas del juego en español** frente al inglés: el orbe de Yugul
    dice «armadura rara» (en inglés, joya) y el Flujo electrizante nombra
    también el rayo como origen. Se enseña el texto tal cual y, en el orbe, se
    avisa.
  Visto en el navegador con cuatro piezas de prueba pegadas (ballesta, anillo
  con resistencias, botas corruptas y un rubí), en español e inglés, en
  ordenador y en móvil. Detalle en `docs/PLANIFICADORES-CRAFTEO.md`.
  → El mismo día, con el «sube todo lo que hayas acabado» de Luis, **unidas a
  main las tareas 17, 18 y 19 y publicadas** (las tres uniones, sin
  conflictos). En producción los planificadores no se ven: siguen detrás del
  interruptor del crafteo avanzado. Batería en main con todo junto y la IA
  apagada: lint, 1898 pruebas, `npm run build` (salida 0), el recorrido del
  navegador en producción y en desarrollo y el del Mentor, en verde. (La
  primera pasada falló una comprobación del modo desarrollo, «PoB2 corre en
  el navegador», por tener cuatro servidores de prueba abiertos a la vez;
  cerrados, pasa entera.) Subida también la rama `ventanita-guia` (8 commits;
  no publica la web).
  **Falta:** nada se ha probado con la moneda en la mano dentro del juego;
  decidir con la 1.0 si se enciende el crafteo avanzado. Visto de paso, sin
  tocar: al pegar una joya, Crafting dice «todavía caben 3 más» (cuenta seis
  huecos, como en el equipo).

- [x] **20. Repaso de cómo está colocada la web** (pedido por Luis el 28-11,
  con las tareas 16 a 19 ya dentro: «que esté organizada con todo lo que hemos
  implementado»). Recorrida en local con todo unido, sin personaje y con el de
  ejemplo, en ordenador y en móvil, y la publicada en solo lectura.
  Lo que estaba descolocado y cómo queda:
  - Las cuatro herramientas (Monta tu build, gema de asistencia, «¿Me sirve lo
    que he encontrado?» y comparar dos piezas) salían apiladas bajo el título
    «Acto 1: cómo no morir…», con un texto que hablaba de «dos dudas». Ahora
    esa vista se titula «Gemas y piezas: herramientas para cualquier acto», no
    enseña el selector de actos y empieza con un índice de botones que baja a
    cada herramienta.
  - Desde Personaje, «Otras dudas de cada partida» no llevaba a «Monta tu
    build» (apuntado sin arreglar el 28-11 de madrugada). Ya tiene su botón,
    el primero.
  - En la portada, quien llega sin personaje no veía ninguna herramienta
    aunque tres no lo piden. Hay una fila nueva: «Sin personaje también
    puedes: Montar tu build · Elegir una gema de asistencia · Comparar dos
    piezas».
  - En Crafting, con el crafteo avanzado apagado, las cinco pestañas de los
    planificadores salían grises junto a Essences y Alloys. Ya no se pintan
    hasta que se encienda (Essences y Alloys siguen como estaban).
  Sin tocar, para decidir: las herramientas siguen dentro del área «Guías»
  (darles un área propia cambia la barra de arriba, que en móvil tiene cuatro
  huecos); y la pestaña del navegador sigue diciendo «Acto 1…» en esa vista.
  **Decisiones de Luis ese día (preguntadas de una en una):**
  - «Cargar ejemplo» deja la página arriba, donde ahora está la caja del
    Mentor (antes se quedaba a media altura). Hecho.
  - Copia de la versión de septiembre: en un repositorio **privado**. Falta
    que Luis lo cree en GitHub (el navegador de trabajo no tiene su sesión);
    después se sube la rama `crafting-real-item-coach`.
  - Limpieza de carpetas y ramas viejas: sí, comprobando antes una a una que
    todo está en main. La de septiembre y la ventanita no se tocan.
  - De ahora en adelante, lo terminado y comprobado se publica en la misma
    sesión sin preguntar y se le avisa; lo que use IA sin medir o cambie mucho
    la web se sigue preguntando.
  Publicado ese día. Antes: lint, 1898 pruebas, `npm run build` (salida 0) y
  los recorridos del navegador y del Mentor, con la IA apagada. **Ojo con el
  recorrido del navegador en modo desarrollo:** la primera pasada después de
  compilar (`npm run build`) falla siempre una comprobación, «PoB2 corre en
  el navegador» (se agota su espera de 120 s); repetida justo después, pasa
  entera. Visto cuatro veces el 28-11, con y sin `--all`. El de producción
  pasa siempre. Parece el arranque en frío de Vite, no la web; no sé si ya
  pasaba antes del 28-11: mirarlo antes de congelar.
  Comprobado en exilecopilot.com tras la primera subida (solo lectura, con
  «Cargar ejemplo»): la tarjeta «¿Me sirve lo que he encontrado?» y su botón
  en Personaje están; en Crafting los planificadores no se ven; sin errores
  de consola.

### Del 8 al 10 de diciembre

- [ ] **11. Congelar:** batería completa y ningún cambio de última hora.

### Tareas de Luis

- [ ] Encender la copia en R2 (pasos en `docs/DEPLOYMENT.md`).
- [ ] Poner la clave nueva de Groq en su `.env` local.

## Etapa 2 · 11 al 25 de diciembre: lanzar y medir

- Día 11: primero los datos al día, después avisar.
- Difusión donde funcionó: Steam en español, Reddit para novatos, Discords
  hispanos y el directo.
- Luis juega la 1.0 preguntando al Mentor de la web. Cada pregunta que falle
  es una regla que falta.
- Día 25: cuántos entran, cuántos vuelven, cuántas preguntas recibe el Mentor
  y cuántas no sabe contestar.

## Etapa 3 · desde enero: el mentor

- El Mentor en el centro (si no subió ya en la tarea 5).
- Las reglas deciden y la IA solo explica. Crece con las preguntas reales.
- El Mentor dentro de la ventanita: preguntar sin salir del juego, en español.
- Dinero: donaciones. Una IA mejor, solo con límite de uso.

## Lo que no se hace antes de la 1.0

- El Mentor dentro de la ventanita (instalador, aviso de Windows, sin probar
  por nadie más).
- Funciones nuevas fuera de esta lista sin que Luis lo pida.
