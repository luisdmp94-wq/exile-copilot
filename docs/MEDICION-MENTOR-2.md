# Medición del Mentor 2 · dos personajes novatos (24-11-2026)

Tarea 1 de `docs/PLAN-1.0.md`. Veinte preguntas de novato, diez por personaje.

## Resultado

| | Bien | A medias | Mal |
|---|---|---|---|
| Guerrero, nivel 14 | 3 | 2 | 5 |
| Exploradora, nivel 22 | 2 | 1 | 7 |
| **Total** | **5** | **3** | **12** |

**5 de 20 bien (25 %). El umbral era 8 de cada 10. No llega.**
Según el plan, el Mentor se queda donde está y sube al centro en enero.

Lo bueno: en veinte respuestas no se inventó nada. Cuando no sabe, lo dice.

## Después de la tarea 2 (24-11-2026)

Repetida con `--sin-ia`: **6 bien, 2 a medias, 12 mal.** Solo cambia G2, que pasa
a bien: propone tres asistencias de grado I (Furia I, Lucha, Puño de guerra I) y
avisa de que solo enseña ese grado. Las otras diecinueve respuestas son iguales.
De «Reglas que faltan», el punto 3 queda hecho.

Poe2db no dice desde qué nivel cae cada grado de gema sin tallar. Por eso el
Mentor no lo afirma: enseña grado I hasta nivel 14 y hasta grado II desde el 15
(la misma regla que ya usaba la portada), y pide el grado si el jugador lo sabe.

## Después de la tarea 4 (24-11-2026)

Repetida con `--sin-ia`, las mismas veinte preguntas: **16 bien, 4 a medias, 0 mal.**

| | Bien | A medias | Mal |
|---|---|---|---|
| Guerrero, nivel 14 | 7 | 3 | 0 |
| Exploradora, nivel 22 | 9 | 1 | 0 |
| **Total** | **16** | **4** | **0** |

**Ojo con esta cifra.** Las reglas se escribieron mirando estas veinte preguntas.
Con preguntas nuevas saldrá menos. Las notas las puse yo. La medida de verdad
son las preguntas reales que se guardan desde la tarea 3.

| # | Antes | Ahora | Qué contesta ahora |
|---|---|---|---|
| G3 | A medias | Bien | Solo habilidades de maza (su arma), ninguna de escudo. Propone subir las que van a nivel 3, no la que ya está a 5. |
| G4 | Mal | A medias | Dice que puede marcar el árbol a mano en «Tu árbol de pasivas», sin PoB2. Aún no le dice dónde poner los puntos. |
| G6 | Mal | A medias | Ninguna de sus habilidades usa escudo; cuáles se abrirían con escudo. No sabe decir cuál de las dos opciones es mejor, y lo dice. |
| G8 | Mal | Bien | El texto del juego, qué lo gasta, y dónde se consigue según las guías. |
| G9 | Mal | A medias | Sus tres ascendencias, dónde se consigue y cuál nombra más lo que usa (Titán: embates). No elige por él, y lo dice. |
| G10 | Mal | Bien | 30 % mientras sube, 75 % de tope, lo que quita cada acto y sus tres resistencias. |
| E2 | Mal | Bien | Disparo múltiple I, que ya puede tallar, y dos de grado III avisando de que piden otra gema. |
| E3 | A medias | Bien | «La II hace lo mismo y penaliza menos», con las dos líneas citadas. |
| E4 | Mal | Bien | Cuatro gemas de espíritu de nivel 4 que encajan con un arco (heraldos). Avisa de que no sabe el nivel de su gema. |
| E6 | Mal | Bien | Manda al comparador, con la ruta, y nombra el arco que lleva. |
| E7 | Mal | Bien | El texto del juego, y que ahora no tiene ninguna pieza rara donde gastarlo. |
| E8 | Mal | Bien | Qué significa el rojo, qué atributo pide cada color y cuál lleva más bajo. |
| E9 | Mal | A medias | Igual que G4. |
| E10 | Mal | Bien | Los tres orbes de joyero con el texto del juego. Ya no contesta otra cosa. |

Las otras seis (G1, G2, G5, G7, E1, E5) ya estaban bien y no cambian.

**La pregunta real de Luis** («tengo un arma unica pero no se si esta bien de daño
me lo cambio por una varita amarilla?») ya no cae en «me falta daño». Manda al
comparador con la ruta, nombra el arma que lleva y dice el límite: el comparador
no calcula el daño por segundo. Está en el script como caso R1, fuera de las veinte.

**Otra pregunta real de Luis** (web publicada, 24-11): «que gemas pondrias en drenar
esencia?». Recibió «el área Essences, Alloys… no está revisada»: la palabra
«esencia» del nombre de la gema se tomaba por crafteo con Essences. Arreglado: el
nombre de una gema no cuenta como palabra de crafteo, y «qué gemas pondrías en
‹habilidad›» se entiende como pregunta de asistencias. Es el caso R2 del script.

### De dónde sale cada respuesta nueva

- **Arma de cada habilidad:** tabla «Skill Gems Gemcutting» de poe2db (182 habilidades
  en ocho grupos). Está en `gems.es.json` como `cutGroups`. Tres salen en dos grupos.
- **Gemas de espíritu:** la lista «Spirit Gems» de poe2db (53). Corrige un dato:
  Heraldo de hielo es de nivel 4, no 1.
- **Espíritu, orbes de joyero, orbe exaltado:** el texto del juego, copiado de
  poe2db en español y en inglés (`GAME_TEXTS` en `server/mentor/basicsQuestions.ts`).
- **Resistencias, espíritu por acto, pruebas de ascendencia:** las guías de la web.
  Una prueba comprueba que el Mentor dice lo mismo que las guías.
- **Ascendencias de cada clase:** el árbol oficial que la web ya tenía.

### Lo que sigue sin saberse

- **Dónde poner las pasivas sin árbol (G4, E9).** Hace falta el árbol del jugador.
  El Mentor ya dice cómo marcarlo a mano.
- **Escudo o dos manos, qué ascendencia es mejor (G6, G9).** No hay datos para
  comparar. El Mentor da lo que hay y dice que no decide.
- **En qué zona cae cada orbe de joyero y con cuántos engarces empieza una gema.**
  poe2db solo da el «nivel de caída» (25, 45, 65).
- **Cuánto atributo pide cada gema a cada nivel.** No está en los datos de gemas.
- **Daño por segundo de un arma.** El comparador de la web no lo calcula.

## Tarea 12 · la IA entiende la pregunta (25-11-2026)

**Medido antes y después, en local, con la IA de verdad (Groq, `openai/gpt-oss-120b`).**

| Veinte preguntas | Antes (bien / a medias / mal) | Después |
|---|---|---|
| De control (la prueba limpia) | 4 / 2 / 14 | **14 / 4 / 2** |
| Nuevas | 9 / 1 / 10 | 17 / 2 / 1 |
| Las de siempre | 16 / 4 / 0 | 16 / 4 / 0 |

No se inventó nada. La IA entendió otra cosa en una de 26 (C6). Las cinco sin regla
siguen en «no lo sé». Las notas las puse yo.

### Qué cambia (paso 1)

Si ninguna regla reconoce la frase, la IA dice solo de qué tema es, de una lista
cerrada de veinte. Con ese tema contesta la regla de siempre, con sus datos.
La respuesta empieza con una línea fija: «Entiendo que preguntas por…». Así, si
la IA entendió otra cosa, se ve.

Lo que la IA no puede hacer:

- No escribe nada que llegue al jugador.
- No pone cifras: el nivel de la gema y los grados se leen de la pregunta.
- La habilidad o la asistencia que nombre tiene que existir en los datos del
  juego y estar en la pregunta o en el personaje. Si no, se descarta.
- Si dice «ninguno», o la IA falla, o no hay clave ni cupo: «no lo sé», como hoy.

A la IA le llegan la pregunta, hasta cuatro turnos, la clase, el nivel y los
nombres de las habilidades. Nada más.

Cambia una cosa de antes: con IA, una frase sin regla iba al motor y la IA elegía
entre sus recomendaciones. Ahí salieron las respuestas a otra cosa («¿cuál es el
límite de tus resistencias?»). Ahora esa frase pasa por la lista de temas.

### El antes (solo reglas, en local)

- **Las veinte de siempre: 16 bien, 4 a medias, 0 mal.** Igual que tras la tarea 4.
  Aquí la IA no puede mejorar nada: las reglas ya reconocen las veinte frases.
- **Preguntas reales guardadas: no hay ninguna en local.** Están en la web
  publicada, en `/estadisticas`, con la clave de Luis.
- **Veinte preguntas nuevas** (`--nuevas` en el script): las mismas dudas dichas
  de otra forma, escritas antes de ver ninguna respuesta. Dieciocho tienen regla y
  dos no (lo correcto en esas es «no lo sé»).

| | Bien | A medias | Mal |
|---|---|---|---|
| Las 18 con regla | 7 | 1 | 10 |
| Las 2 sin regla | 2 | 0 | 0 |
| **Total** | **9** | **1** | **10** |

| # | Pregunta | Antes |
|---|---|---|
| P1 | no aguanto nada, me revientan en dos toques | Bien |
| P2 | que le meto a terremoto para que pegue mas fuerte? | Bien |
| P3 | me ha caido una piedra de esas de habilidad de nivel 5, en que la gasto? | Mal: no lo sé |
| P4 | que es mejor subir, la roja o la verde? | Mal: no lo sé |
| P5 | para que vale lo del espiritu ese? | Bien |
| P6 | cuando puedo elegir subclase? | Mal: no lo sé |
| P7 | que resis tengo que llevar en el acto 2? | Mal: no lo sé |
| P8 | no me deja equipar la gema, pone que no cumplo los requisitos | Bien |
| P9 | en que me gasto los puntos del arbol? | A medias (como G4) |
| P10 | como le meto mas gemas de apoyo a una habilidad? | Mal: contesta qué asistencias poner |
| P11 | mi flecha de rayo se queda corta, como la subo? | Mal: no lo sé |
| P12 | me ha salido un arco nuevo, como se si me lo pongo? | Mal: no lo sé |
| P13 | tengo 3 exaltados, que hago con ellos? | Bien |
| P14 | que heraldos o auras me puedo poner? | Mal: no lo sé |
| P15 | hay alguna maldicion que me venga bien? | Bien |
| P16 | quiero ir con bichos que peleen por mi, cuales hay? | Mal: no lo sé |
| P17 | aceleracion de proyectiles, la 1 o la 2? | Bien |
| P18 | los jefes me duran una eternidad | Mal: no lo sé |
| P19 | donde farmeo oro rapido? | Bien: no lo sé |
| P20 | merece la pena el modo hardcore? | Bien: no lo sé |

Nueve de las diez «mal» son frases que ninguna regla reconoce: es lo que el paso 1
puede arreglar. P10 no: una regla la reconoce mal, y a la IA no se le pregunta.

### El después

**Las veinte nuevas: 17 bien, 2 a medias, 1 mal.** Las nueve «no lo sé» pasan a
contestar con la regla correcta. A medias quedan P9 (árbol sin marcar) y P14: pregunta
qué heraldos ponerse y la regla le habla de «tu gema de espíritu sin tallar», que no
ha dicho tener; la lista de heraldos sí le vale. P10 sigue mal.

**Ojo: esta cifra no es limpia.** Las instrucciones de la IA se escribieron
conociendo estas veinte preguntas («subclase», «resis», «bichos» están en ellas).

### La prueba limpia: veinte de control

Escritas después de dejar fijas las instrucciones de la IA, que no se han tocado
desde entonces (`--control` en el script). Diecisiete tienen regla y tres no.

| # | Pregunta | Antes | Después |
|---|---|---|---|
| C1 | con que complemento embate rodante? | Mal: no lo sé | Bien: asistencias para Embate rodante |
| C2 | se puede poner una cuarta gemita en la habilidad? | Mal: no lo sé | Bien: orbes de joyero |
| C3 | tengo puntos sin gastar del arbolito ese, donde van? | Mal: no lo sé | A medias (como G4) |
| C4 | me conviene mas fue o des? | Mal: no lo sé | Bien: fuerza |
| C5 | el boss del acto 1 me funde | Mal: no lo sé | Bien: huecos de equipo vacíos |
| C6 | que es eso de reservar que pone en los heraldos? | Mal: no lo sé | **Mal: la IA entendió «qué gema de espíritu ponerte»; era «qué es el espíritu»** |
| C7 | titan o herrero? | Mal: no lo sé | A medias (como G9: no elige) |
| C8 | el casco nuevo pone letras rojas y no me deja | Mal: no lo sé | Bien |
| C9 | que orbe uso para meterle otra propiedad a mi maza amarilla? | Mal: no lo sé | Bien: orbe exaltado |
| C10 | me pongo un escudo o sigo con el mazo grande? | A medias | A medias (igual) |
| C11 | pararrayos no hace nada de daño, que le hago? | A medias | A medias: habla del arma y de Flecha de rayo, no de Pararrayos |
| C12 | este carcaj es mejor o peor que el mio? | Mal: no lo sé | Bien: comparador, con su carcaj |
| C13 | hay algo para que los enemigos reciban mas daño de rayo? | Mal: «mejora el arma» | Mal (igual) |
| C14 | puedo llevar un lobo o algo que me acompañe? | Mal: no lo sé | Bien: gemas de esbirro |
| C15 | tengo 20 de frio, es poco? | Mal: no lo sé | Bien: 30 % mientras sube. Enseña el hielo guardado (5 %), no el 20 que dice |
| C16 | me ha tocado una gema de apoyo sin tallar, cual saco? | Bien | Bien (igual) |
| C17 | tengo una sin tallar del 9, que saco para el arco? | Mal: no lo sé | Bien: habilidades de arco hasta nivel 9 |
| C18 | para que sirve el orbe de caos? | Bien: no lo sé | Bien: no lo sé |
| C19 | que clase es la mas facil para empezar? | Bien: no lo sé | Bien: no lo sé |
| C20 | como vendo cosas a otros jugadores? | Bien: no lo sé | Bien: no lo sé |

**De 4 bien, 2 a medias y 14 mal, a 14 bien, 4 a medias y 2 mal.**

- La IA entendió 13 frases que las reglas no reconocían. Acertó el tema en 12.
- El fallo (C6) se ve: la respuesta empieza por «Entiendo que preguntas qué gema
  de espíritu ponerte». No se ha corregido para no tocar la prueba.
- C11 y C13 no pasan por el paso 1: las reglas las toman por «me falta daño».
- En C13 la IA de redactar (la que ya había) dio «respuesta incompleta» y
  contestaron las reglas. No es del paso 1.

### Las veinte de siempre, con la IA encendida

16 bien, 4 a medias, 0 mal: igual. Dieciséis respuestas son idénticas letra a
letra. En G1, G7, E1 y E5 cambia la redacción (la IA que ya había), no el consejo.

### Tiempo y gasto

- Cuando la regla reconoce la frase: al instante (unos 10 ms), sin IA.
- Cuando la IA tiene que entenderla: entre 0,7 y 1,8 segundos (tres medidas).
- Groq gratis da 8.000 tokens por minuto y 1.000 peticiones al día. Entender
  una pregunta gasta alrededor de mil tokens. Sin cupo, contesta como sin IA.

### Para repetirla

`node scripts/mentor-medicion.mjs --control`, `--nuevas` o sin nada (las de
siempre). Añade `--sin-ia` para el antes. Unos cuatro minutos cada una con IA.

## Cómo se midió

- En local, con base de datos temporal. La web publicada y sus estadísticas no se tocaron.
- Cada pregunta va sola a `/api/mentor/query`, sin conversación previa.
- Dos pasadas: solo reglas y con la IA encendida (ver «La IA» más abajo).
- Para repetirla: `node scripts/mentor-medicion.mjs --sin-ia` (unos segundos).
  Deja las veinte respuestas en un archivo temporal; las notas se ponen leyéndolas.
- Las preguntas se escribieron antes de ver ninguna respuesta y no se cambiaron.
- Personajes como los deja la web a un novato: clase, nivel, cuatro habilidades,
  unas pocas piezas pegadas, sin código de PoB2 (por tanto, sin árbol).
- Las piezas están escritas a mano, sin modificadores. Ver «Límites».

**Criterio.** Bien: contesta lo que se pregunta y el novato puede usarlo.
A medias: va de lo que se pregunta, pero con un fallo o sin poder aplicarlo.
Mal: no contesta o contesta otra cosa.

## Guerrero, nivel 14 (mazo a dos manos, Embate rodante)

| # | Pregunta | Nota | Por qué |
|---|---|---|---|
| G1 | me matan mucho, que hago? | Bien | Señala sus cinco huecos de equipo vacíos, con nombre. |
| G2 | que gema de asistencia le pongo a embate rodante? | A medias | Acierta la habilidad, pero propone asistencias de grado IV y V. A nivel 14 no puede tallarlas. |
| G3 | tengo una gema sin tallar de nivel 5, cual cojo? | A medias | Dos de las cuatro no le valen: una pide lanza y otra escudo. Y le sugiere subir Embate rodante a nivel 5, que ya está a 5. |
| G4 | donde pongo los puntos de pasivas? | Mal | Pide un código de Path of Building 2. Un novato no lo tiene. |
| G5 | que subo, fuerza o destreza? | Bien | Lee sus atributos y sus gemas y dice fuerza. |
| G6 | me conviene llevar escudo o un mazo a dos manos? | Mal | «No sé contestarlo.» |
| G7 | pego muy poco a los jefes | Bien | Mejorar el arma, con el nombre de la suya. |
| G8 | que es el espiritu y para que sirve? | Mal | «No sé contestarlo.» |
| G9 | que ascendencia me cojo? | Mal | «No sé contestarlo.» |
| G10 | cuanta resistencia necesito? | Mal | «No sé contestarlo.» Las guías de la web sí lo dicen. |

## Exploradora, nivel 22 (arco de rayo, Flecha de rayo)

| # | Pregunta | Nota | Por qué |
|---|---|---|---|
| E1 | que mejoro primero? | Bien | Rellenar sus cuatro huecos vacíos. |
| E2 | hay alguna asistencia para que flecha de rayo dispare mas flechas? | Mal | No la entiende porque dice «asistencia» y no «gema de asistencia». La regla existe. |
| E3 | que pongo, disparo multiple 1 o 2? | A medias | Los datos de las dos son correctos, pero la frase final dice lo contrario: que la II penaliza más. Penaliza menos (25 % frente a 35 %). |
| E4 | tengo una gema de espiritu sin tallar, que me pongo? | Mal | No la entiende por decir «qué me pongo». La regla existe. |
| E5 | por que muero de un golpe? | Bien | Sus huecos vacíos, con nombre. |
| E6 | como se si un arco es mejor que el que llevo? | Mal | «No sé contestarlo.» La web tiene un comparador de dos piezas y no lo nombra. |
| E7 | para que sirven los orbes exaltados? los gasto ya? | Mal | «No sé contestarlo.» |
| E8 | no puedo ponerme una gema, me sale en rojo | Mal | No la entiende. La regla de atributos habla justo de eso. |
| E9 | que pasivas cojo para hacer mas daño con el arco? | Mal | Pide el código de PoB2. |
| E10 | como consigo mas huecos para gemas de asistencia? | Mal | Contesta otra cosa: qué asistencias le van a Flecha de rayo. |

## Por qué falla (12 mal y 3 a medias)

1. **No sabe lo básico del juego (5):** G6, G8, G9, E7, E10. Espíritu, ascendencias,
   escudo o dos manos, para qué sirve un orbe, cómo se consiguen huecos. No hay datos
   ni reglas para esto. Es lo que más pregunta un novato.
2. **La regla existe, pero no reconoce la frase (3):** E2, E4, E8. Solo entiende la
   pregunta con las palabras exactas. Es lo más barato de arreglar.
3. **El árbol exige PoB2 (2):** G4, E9. Un novato no tiene código. La web deja marcar
   el árbol a mano y el Mentor no lo dice.
4. **La web ya lo tiene y el Mentor no manda allí (2):** G10 (guías por acto) y E6
   (comparador de piezas).
5. **Contesta sin mirar el nivel ni el arma (2 a medias):** G2 y G3.
6. **Una frase que contradice sus propios datos (1 a medias):** E3. Es el fallo más
   serio: es el único consejo equivocado de las veinte.

## Reglas que faltan (para la tarea 4)

Por orden de lo que más arregla con menos trabajo:

1. Entender «asistencia» a secas, «qué me pongo» y «me sale en rojo» (E2, E4, E8).
2. Corregir la frase final al comparar dos grados de una asistencia (E3).
3. Asistencias: no pasar del grado que puede tallar a su nivel (G2).
4. Gema sin tallar: no proponer subir una habilidad que ya está a ese nivel (G3).
   El arma que pide cada habilidad no está en los datos de gemas: habría que traerla.
5. Mandar a lo que la web ya tiene: resistencias por acto (G10), comparador (E6),
   marcar el árbol a mano (G4, E9).
   Caso real de Luis en la web (24-11): «tengo un arma unica pero no se si esta
   bien de daño me lo cambio por una varita amarilla?». Lleva «daño», así que el
   Mentor la toma por «me falta daño» y contesta «no veo una causa clara» y las
   resistencias. Es de comparar dos piezas: debe mandar al comparador. Y una
   pregunta de «¿cambio A por B?» no debe caer en el foco daño.
6. «Huecos para asistencias» no es «qué asistencia pongo» (E10).
7. Fichas cortas de lo básico: espíritu, ascendencias, orbes, escudo o dos manos
   (G6, G8, G9, E7). Hay que escribirlas con fuente; no salen de los datos de gemas.

Con los puntos 1 a 5, estas mismas veinte preguntas quedarían entre 12 y 14 bien.
Para llegar a 16 hacen falta también el punto 6 y las fichas del punto 7.
Es una estimación, no una medida.

## La IA

**No se pudo medir con IA.** La clave de Groq del `.env` local está caducada
(Groq contesta 401, «invalid_api_key»). En la pasada con la IA encendida las veinte
respuestas salieron idénticas a las de solo reglas.

En la web publicada la IA sí funciona. Por cómo está hecho el Mentor, no puede
cambiar mucho el resultado: la IA solo elige entre las recomendaciones del motor y
redacta; no puede dar conocimiento del juego. Las doce «mal» lo son por falta de
datos o de reglas, no de redacción. Esto es una lectura del código, no una medida.

Para comprobarlo: poner la clave nueva en el `.env` local y repetir (unos 7 minutos).

## Límites de esta medición

- Las piezas de los dos personajes están escritas a mano y sin modificadores.
  Repetido con dos modificadores por pieza: las veinte notas no cambian.
- Si el novato no ha pegado una pieza, el Mentor la da por vacía. No se midió
  cuántos novatos pegan todo el equipo.
- Las veinte preguntas las escribí yo imitando a un novato. No son de jugadores
  reales. Las de verdad llegarán con la tarea 3 (guardar lo que no sabe contestar).

## Tarea 13 · el Mentor conversa (25-11-2026)

Se mide con **charlas** (una pregunta y dos repreguntas seguidas), no con
preguntas sueltas: `node scripts/mentor-charla.mjs` (la bruja de nivel 49) y
`--control` (cuatro charlas nuevas con el guerrero y la exploradora).

**Qué cambia.** Las reglas siguen poniendo los datos. El servidor los parte en
frases sueltas («fichas»): la respuesta de las reglas a la pregunta, la de las
dos preguntas anteriores del jugador (recalculadas en el servidor), las ocho
asistencias que mejor le van a la habilidad de la que se habla, las que hacen
aguantar a los esbirros y la guía del acto que se nombre. La IA lee la charla,
elige de una a cuatro fichas y escribe una entrada corta y una pregunta de
cierre. Las fichas se enseñan copiadas tal cual.

**Por qué no redacta entera.** Primera prueba, redactando libre: siguió el hilo,
pero escribió «evita los círculos de descarga estática» (la guía dice que hay
que meterse dentro) y «lanzar más rápido sin perder daño» de una gema que quita
velocidad. Un filtro de nombres y cifras no ve eso. Copiando la frase no pasa.

**Filtro.** La entrada y el cierre no pueden traer una cifra, un grado, una gema
ni un nombre propio que no esté en las fichas, en el personaje o en lo que
escribió el jugador. El cierre solo se enseña si es una pregunta. Si algo
falla, tarda o no hay cupo, sale el texto de las reglas.

**Charla de la bruja (nueve turnos).** Con ella se escribieron las
instrucciones de la IA: no es una prueba limpia.

| | Bien | A medias | Mal |
|---|---|---|---|
| Antes | 2 | 1 | 6 |
| Después | 7 | 2 | 0 |

Antes: repite la misma lista letra a letra, contesta «rellena los huecos de
equipo» a «¿y por qué esa?», lista todas las gemas de esbirro a «se me mueren»
y dice «no lo sé» al jefe del acto 3. Después: las nueve redactadas por la IA,
ninguna cae a reglas y ningún dato inventado. A medias: «ya, pero ¿qué hago
exactamente?» repite las dos asistencias (no hay datos de cómo se ponen) y el
último turno mezcla el consejo de equipo con el del jefe. Tarda de 0,9 a 2,1 s.

**Charlas de control (doce turnos, escritas con las instrucciones ya fijas).**

- Antes: 4 bien, 2 a medias, 6 mal.
- Después: **sin medir.** Los tres primeros turnos salieron bien; desde el
  cuarto Groq cortó con un 429: se había gastado el cupo gratis del día
  (200.000 tokens; usados 199.861). Hay que repetirla otro día.

Las respuestas, tal cual, están en `docs/mediciones/tarea-13/` (bruja antes y
después, control antes). El «antes» del control se midió con el código de main:
no hace falta repetirlo.

**Lo que costó la medición.** Cada respuesta redactada gasta de 2.500 a 4.000
tokens. Con el cupo gratis salen unas 60 respuestas al día para todos los
visitantes juntos; después contestan las reglas. Para gastar menos, la IA ve
como mucho 6.000 caracteres de fichas y los cuatro últimos turnos.

**Modelo de reserva (25-11-2026, tarde).** Pagar en Groq no se puede: su
consola dice que el plan de pago está cerrado «por alta demanda». El 429 de
Groq nombra el modelo («Rate limit reached for model openai/gpt-oss-120b… on
tokens per day»): el cupo es por modelo. Ahora, si el modelo principal contesta
429, la misma petición va a `openai/gpt-oss-20b`
(`MENTOR_AI_FALLBACK_MODELS`). Probado con una charla de la bruja contestada
solo por el de reserva: sigue el hilo, elige bien los datos y tarda 0,7 s; la
entrada es algo más floja. La tabla de límites de Groq (console.groq.com →
Limits, leída por Luis el 25-11) da 200.000 tokens al día a cada modelo:
gpt-oss-120b, gpt-oss-20b y qwen3.8-27b. Los tres quedan en cadena: unos
600.000 tokens al día, unas 180 respuestas redactadas. Qwen, probado con otra
charla de la bruja, dice lo que ya llevas puesto y no repite; es también el
modelo que lee las capturas, así que va el último.

**Sin IA también mejora:** «¿cómo mato al jefe del acto 3?» ya contesta con la
guía (regla nueva, `server/mentor/guideKnowledge.ts`). Las guías se leen de
`server/data/guideKnowledge.json`: tras tocar una guía, `npm run data:guides`
(una prueba falla si se queda atrás).

**Fallos conocidos.** La entrada puede decir mal un nombre que sí está en los
datos («Lucha I» por «Lucha»). El cierre a veces ofrece explicar algo que el
Mentor no sabe («¿quieres saber cómo enlazarlas?»).
