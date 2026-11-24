# Auditoría del trabajo de Opus 5.5 (21 a 23 de noviembre de 2026)

Qué se revisó: los 25 commits de `03bcee7` a `d67a529`, unas 14.000 líneas
reales. Todo eso ya estaba publicado. Las referencias `archivo:línea` son
sobre `d67a529`.

Cómo: cinco revisores independientes, uno por zona, que solo leyeron. Después
comprobé cada hallazgo que he arreglado contra el código o los datos del
juego. Lo que no comprobé yo lo digo en cada punto.

Dónde están los arreglos: rama `revision-opus-5-5`, dieciocho commits de
arreglo, sin pasar a `main` y sin subir. Cada arreglo lleva su test.

## Lo esencial

- El trabajo es bueno de base: los cinco revisores encontraron sólidas las
  partes difíciles (firma de R2, límites del lector de códigos, el motor de
  PoB2 aislado, caminos del árbol, ES/EN de la guía del acto 4).
- Había **tres fallos que podían tirar o parar la web** desde fuera. Arreglados.
- Había **consejos falsos para el jugador** en la regla del arma, en el
  Mentor y en el árbol. Arreglados los que tenían arreglo claro.
- Quedan **decisiones tuyas**: el texto de privacidad con las copias en R2,
  la licencia de una pieza de PoB2, y unas pocas dudas de producto y de
  contenido. Están al final, por orden.

## Arreglado en la rama

### Podían tirar o parar la web

1. **Caché del árbol sin límite** — bloqueante.
   `server/advice/passiveTreeAdvisor.ts:39-46`. La clave era el texto de la
   clase que manda cualquiera (hasta 60 letras). Cada texto distinto guardaba
   1 MB para siempre: un guion dejaba el servidor sin memoria en minutos. Lo
   vieron dos revisores por separado. Ahora la clave es la clase reconocida
   (nueve como mucho). Commit `30769a3`.
2. **Un código PoB2 hecho a mala fe paraba el servidor** — bloqueante.
   `shared/pobBuild.ts:482-489` y `server/adapters/pobXml.ts:93-105`. Las
   búsquedas crecían al cuadrado con miles de etiquetas sin cerrar: un código
   de 4 KB podía ser minutos de servidor parado. Ahora el XML pasa antes una
   comprobación de forma, lineal. El código real de prueba del repositorio
   sigue leyéndose igual. Commit `8a71b82`.
3. **La copia nocturna se saltaba un día** — importante.
   `server/backup/r2Backup.ts:270-275`. Con un reinicio a la hora de la
   copia, la de ayer tenía 24 h y el umbral era 25: no se hacía. Ahora mira
   si existe la copia de la última hora programada. Commit `fed9ec4`.

### Consejos o datos falsos para el jugador

4. **Bastón y báculo al revés** — importante.
   `server/engine/rules.ts:461-470`. En el juego en español «Báculo» es el
   Staff del hechicero y «Bastón» el Quarterstaff del monje (17 y 36 bases en
   `server/data/pob/item-translations.json`). La regla los tenía cambiados:
   a un monje le pedía niveles de hechizo y a un hechicero, calidad. El test
   fijaba el error. Commit `557dd47`.
5. **Arma leída de un código PoB2** — importante. `rules.ts:468-469` con
   `server/adapters/pobXml.ts:150-166`. Llega con la clase genérica
   «Weapons», así que una varita se trataba como arma de ataque. Ahora se
   mira también la base. Mismo commit.
6. **Arma corrupta y cetros** — menor. A un arma corrupta se le pedía subir
   la calidad (no se puede). A un cetro se le pedían niveles de hechizo.
   Mismo commit.
7. **El Mentor entendía lo contrario** — importante.
   `shared/mentorIntent.ts:106-167`. «El jefe me hace mucho daño» se
   contestaba con «mejora el arma»; «el jefe no se muere», con consejos de
   aguante. Ahora manda quién recibe el daño y quién no muere. También
   entiende «mi mayor problema». Commit `37dcf02`.
8. **El «Por qué» del árbol decía lo contrario del nodo** — importante.
   `shared/passiveTreeAdvice.ts:352-366`. «Break 40% increased Armour» salía
   como «más armadura, que ya llevas»; un umbral sacado del escudo, como «más
   escudo de energía»; resistencia negativa contaba a favor. Probado con las
   líneas reales del árbol. Commit `91a02de`.
9. **Código con varios árboles** — importante.
   `server/adapters/pobXml.ts:317-323`. PoB2 no pone `id` a sus árboles: se
   leía siempre el primero («Acto 1») y se calculaba con el activo («Final»).
   Commit `8a71b82`.
10. **Nivel automático de PoB2** — importante. `shared/pobBuild.ts:642-644`.
    Lo que daba cada nodo se medía con otro nivel que los números
    principales. El revisor lo midió con el motor (vida 557 frente a 65); yo
    solo comprobé el código y que al quitarlo queda como sin código. Mismo
    commit.
11. **Paso con «+0 puntos»** — menor. `shared/passiveTreeOrder.ts:69`.
    Commit `4e84cd0`.
12. **«Tienes 51 pasivas» con 50 puntos**, y singulares («1 puntos») — menor.
    `src/components/PassiveTreeCard.tsx:962`. Mismo commit.
13. **Preguntas secuestradas por el árbol** — menor.
    `server/mentor/treeQuestion.ts:20`. «Una mejora notable» recibía la
    respuesta del árbol. Mismo commit.
14. **Se perdían las elecciones de atributo** al editar pasivas a mano —
    menor. `src/sections/CharacterSection.tsx:1085-1146`. Commit `51b0057`.

### Guía del acto 4

15. **«para el los interludios»** — importante, se veía en la web y en la
    página para buscadores. `src/lib/guideCheck.ts:206,213`,
    `src/components/GuideCharacterCheck.tsx:53`, `src/guides/prerender.ts:71`.
    Commit `696816d`.
16. **Trozos de mapa numerados fuera de orden** (el primero que encuentras
    decía «2 de 4») — menor. `src/guides/actFour.ts:80,86,158` y su par en
    inglés. Mismo commit.
17. **«+15 % gratis»** se podía leer como +15 % a cada resistencia; son +5 %
    a cada una — menor. `actFour.ts:242`. Mismo commit.
18. **Español traducido literal**: «más fácil de criticar», «para cortarlo»,
    «corta a los sacerdotes» — menor. `actFour.ts:103,205,220`. Mismo commit.

### Copias de seguridad (además del punto 3)

19. **`backup now` en el portátil subía la base de pruebas** como la copia
    más nueva de producción, o una base vacía si el archivo no existía.
    `server/backup/cli.ts:39-41`. Ahora se niega fuera de producción salvo con
    `--desde-este-equipo`. Commit `fed9ec4`.
20. **Solo se podía restaurar la última copia.** `cli.ts:57-60`. Si la de
    anoche ya copió datos estropeados, no servía. Ahora
    `check --key <clave>`. Mismo commit.
21. **Fuentes de la 1.0 con finales de línea de Windows.** `.gitattributes`
    solo cubría la 0.5.5: una fuente nueva en `docs/evidence/1.0/` habría
    dado una huella que Render no reconoce el día del lanzamiento. Mismo
    commit.

### Segunda tanda (comportamientos que confundían)

22. **La revisión rápida se quedaba con el arma vieja.**
    `src/lib/quickReviewForm.ts:177-190`, `src/components/QuickReviewCard.tsx:166-173`.
    Cualquier cambio en la tarjeta guardaba el formulario entero y congelaba
    el nivel del arma, el de la gema y la lista de habilidades. Ahora cada
    dato guardado lleva al lado lo que decía la ficha: si la ficha cambia
    después, manda la ficha. Commit `bab41a1`.
23. **«Rellénalo rápido» cambiaba la revisión antes de guardar.**
    `src/components/ProfileQuickRead.tsx:96-105`,
    `src/sections/CharacterSection.tsx:685-693`. Pegar el código de una guía y
    cerrar sin guardar dejaba la revisión con la otra build. El editor ya no
    escribe nada en el navegador: la revisión mira la ficha. Mismo commit.
24. **El editor del árbol quitaba nodos sueltos que no tenían que ver.**
    `shared/passiveTreeEdit.ts:57-90`. Commit `a85bb2f`.
25. **Pasivas que el árbol no sabe leer** salían como «tienes 0 pasivas» y «no
    veo ningún notable cerca». `shared/passiveTree.ts:174-185`,
    `src/components/PassiveTreeCard.tsx:962-979`,
    `server/mentor/treeQuestion.ts:52-56`. Ahora dice que no las ha leído y
    cómo meterlas. La ascendencia de un `.build` oficial ya no cuenta como
    nodo desconocido. Commit `c8fdfe8`.
26. **Cálculo de PoB2 colgado para siempre**, y un fallo del motor salía como
    «revisa tu conexión». `src/pob/pobClient.ts:123-148`. Ahora espera 90
    segundos, deja reintentar y dice que el motor se paró. Commit `ac9596e`.
27. **«Daño por segundo» ignoraba la habilidad elegida** con códigos que
    marcan «Include in Full DPS». `src/pob/engine/commands.lua:26`. Probado
    con el motor real; el test nuevo falla sin el arreglo. Commit `74d840f`.
28. **Un apoyo añadido en la web a una habilidad del código no contaba.**
    `shared/pobBuild.ts:597-608`. Ahora entra en el grupo de esa habilidad.
    Lo que quitas en la web sigue sin quitarse del código. Commit `986f9ff`.
29. **Etiquetas de recompensa que un jugador nuevo no entiende** («+5 % a las
    tres», «+10 % de hielo»). Lo viste tú en la ventanita. `src/guides/act*.ts`.
    Commit `9dd66a6`.

## Pendiente: lo decides tú

Por orden de importancia. Ninguno está tocado.

### Texto público y licencias

- **A. Privacidad y copias en R2.** `src/components/DataPrivacyDialog.tsx:46,54-59`.
  La web dice que borrar tus datos es irreversible. Con la copia nocturna
  encendida, la base entera queda en Cloudflare 30 días (o para siempre si no
  se crea la regla de caducidad: el código no borra copias). La copia va
  comprimida, no cifrada. **Antes de encender R2 hay que añadir una frase al
  texto de privacidad.** Te la propongo cuando quieras.
- **B. Licencia de PoB2.** `THIRD_PARTY_NOTICES.md:14` y
  `src/components/PobPanel.tsx:62` dicen «MIT». El paquete incluye
  `base64.lua`, que es LGPL (`server/data/pob/LICENSE-PathOfBuilding.md:111`),
  y ningún aviso de licencia llega a quien descarga el motor. No lo comprobé
  más allá de leer esos archivos. Arreglo probable: corregir el aviso y
  servir el texto de las licencias desde la web.

### Dudas de producto

- **C. Segunda arma de una mano va sola a la mano secundaria.**
  `src/lib/importedItemPlacement.ts:23-28,55-66`. Pegar una varita nueva con
  otra puesta la manda a la otra mano en vez de preguntar. Depende de qué
  parejas deja llevar el juego: tú lo sabes mejor que yo.
- **D. Resistencias con la penalización del final del juego (−60 %)** al
  pegar un código, aunque estés en el acto 2. `shared/pobBuild.ts:414-419`.
  Coincide con PoB de escritorio, y eso lo comprobaste tú como punto fuerte.
  Cambiarlo daría las resistencias reales del juego, pero ya no los mismos
  números que tu PoB. Si se deja así, conviene al menos decirlo en el panel.
- **E. Quitar una gema en la web no la quita del código importado** (lo de
  añadir ya está arreglado, punto 28).
- **F. Revisiones rápidas guardadas antes de este cambio** siguen como
  estaban hasta que el jugador toque un dato: de esas no se sabe qué decía la
  ficha cuando se escribieron.

### Datos del árbol en español

- **G. Texto en español equivocado o con basura** en algunos nodos.
  `scripts/build-passive-tree.ts:323-341`. Dos notables con estadísticas que
  no son las suyas, tres con la línea «can see monster categories [1]», y 371
  nodos pequeños sin traducir (salen en inglés en la lista). Comprobé que la
  línea basura está tres veces en `server/data/passives/tree.json`. Arreglarlo
  es regenerar los datos con internet (poe2db); mejor hacerlo junto con la
  revisión de la 1.0.

### Guía del acto 4 (contenido)

- **H.** El paso de Omnifobia (`actFour.ts:94`) dice «hay que volver con
  Dannig» y ningún paso dice dónde está. Quedó separado del paso que
  continuaba al mover Bahía de las anclas al principio.
- **I.** «Se abre al rescatar a Matiki» (`actFour.ts:125`): la ruta no dice
  cuándo pasa eso.
- **J.** «El primer viaje es obligado» cita fuentes que, según el comentario
  del propio archivo (`actFour.ts:9-13`), dan el orden como sugerencia. La
  fuente real eres tú jugando el 22-11: falta en la lista.
- **K.** La mejora de frascos de la Diosa de la justicia está en un paso de
  «historia» (`actFour.ts:103`), así que no sale en «Lo más importante, para
  siempre». Se puede cambiar, quizá por eso no es «clave»: decide tú.
- **L.** Dos pasos del acto 4 llevan `optional` aunque la zona es obligada
  por la historia (`actFour.ts:92-95,114-116`). Hoy no se nota en la web.

### Operación y documentos

- **M.** Una copia nocturna que falla solo deja una línea en el registro, sin
  reintento. `server/backup/r2Backup.ts:253-256`. Puede estar muerta semanas
  sin que nadie lo vea.
- **N.** La copia se hace en el mismo hilo que la web
  (`r2Backup.ts:127-152`): hoy es un instante; con una base de decenas de MB
  serían segundos de web parada.
- **Ñ.** `docs/ROADMAP.md` está al día solo en «Ideas apuntadas»: dice
  «estado consolidado: 31 de agosto» (`:3`), que no hay alojamiento
  (`:16-32`) y que leer una captura está sin empezar (`:307-308`), y ya está
  hecho y publicado.
- **O.** `docs/DIA-DE-LA-1.0.md:10` apunta a `docs/promo/` y
  `LANZAMIENTO.md`, que solo existen en este portátil.

### Tests que no prueban lo que dicen

Los cinco revisores señalaron tests con nombre más ambicioso que su
contenido: `tests/integration/pobEngine.test.ts:91-99`,
`tests/unit/passiveTree.test.ts:51-61` y `:243-247`,
`tests/integration/r2Backup.test.ts:180-192`. Los arreglos de esta rama
añaden los suyos; estos otros siguen igual.

## Qué no se cubrió

- Nada se probó contra R2 real.
- Los datos del juego de las guías no se contrastaron con las fuentes (sin
  red en la revisión).
- Las pruebas de navegador son las del propio proyecto (Edge sin ventana); no
  hay prueba a mano en un móvil.

## Comprobado en la rama

- Batería completa: 157 archivos, 1559 tests, todos pasan.
- `eslint` limpio, `tsc -b` sin errores y `npm run build` termina bien. La
  página generada del acto 4 dice «para los interludios» y numera los Trozos
  de mapa 1, 2, 3 y 4.
- Pruebas de navegador del proyecto, en producción y en desarrollo: la
  principal (`browser-smoke`) pasa entera, con PoB2 calculando en el
  navegador; `equipment-smoke` 216 de 216 y `mentor-smoke` 102 de 102.
- La prueba principal sirvió: cazó un fallo de la segunda tanda (el aviso «no
  he sabido leer tus pasivas» saltaba con un código que solo traía el inicio
  de la clase y un nodo desconocido). Corregido antes de dar esto por bueno.
- Al pasar a `main`, repetir batería y compilación por si `main` cambió.
