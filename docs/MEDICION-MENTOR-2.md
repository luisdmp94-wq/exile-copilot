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
