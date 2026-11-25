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
- [ ] **5. Si la tarea 1 llega al umbral: el Mentor al centro de la portada**
  (caja para preguntar arriba, con el personaje ya cargado). Si no llega, se
  queda donde está y sube en enero.
  → La tarea 1 no llegó (5 de 20). Tras la tarea 4 la misma medición da 16 de 20,
  justo el umbral, pero con preguntas ya conocidas. **Decide Luis** si sube ahora
  o en enero.
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
- [ ] **10. Ensayo del día del parche** con `docs/DIA-DE-LA-1.0.md`.
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
