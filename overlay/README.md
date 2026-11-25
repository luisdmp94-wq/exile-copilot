# Ventanita guía (prototipo)

Una ventana pequeña encima de Path of Exile 2, al estilo de las guías de
leveo de WoW (Polestar): sigue la zona donde estás y te dice el paso de la
guía (actos 1 a 4, las guías de `src/guides`).

- **Arrancar:** doble clic en `ventanita.cmd`. La primera vez repasa tu
  Client.txt entero (unos segundos); después, solo lo nuevo. Si ya estaba
  abierta, abrirla otra vez la reinicia con la última versión.
- **PoE2** tiene que estar en *pantalla completa sin bordes* (o en ventana).

## Qué enseña

- La zona donde estás, en grande, y el texto entero de su paso en la guía,
  **una frase por línea**. El tipo de daño del jefe («pega con rayo») va de su
  color. En la vista compacta las frases van seguidas, en dos líneas.
- **La recompensa para siempre** del paso («Para siempre: +10 % resistencia al hielo»)
  con una casilla que **se marca sola** cuando el juego escribe que la has
  recibido. Tu primera ascendencia también: se nota en que tu clase cambia
  («Bruja» → «Liche») en la siguiente subida de nivel. Solo los puntos de la
  Prueba de Caos se marcan a mano (**Fin** o clic).
- **El jefe de la zona**, cuando el registro deja saber que ha caído (15 de
  los jefes de los actos 1-4): su casilla también se marca sola.
- **Los jefes que no hablan** (otros 17: el rey del óxido, el verdugo, Tor Gul,
  la reina de la inmundicia, el prisionero…) tienen casilla a mano: **Fin** o
  clic al matarlos, y la zona ya dice «Zona hecha». Fin funciona también con
  la ventanita minimizada.
- **Punta del botín** no tiene jefe: su casilla dice «Objetivo: el tesoro
  enterrado (Farrow)» y se marca sola con la última frase de Farrow en la isla
  («…Lo llevaré a Marca del rey»). Con el juego en otro idioma, **Fin**.
- **Los trozos de mapa** del acto 4 se marcan a mano, con su casilla. Al entrar
  en Punta del botín se dan los cuatro por cogidos: sin ellos la isla no se abre.
- **«Zona hecha: puedes seguir»**, en verde, cuando todo lo que se puede
  comprobar del paso está hecho. Debajo, en grande, **adónde vas**
  («→ Ngakanu y El corazón de la tribu»), y el texto de lo ya hecho se apaga.
- Si el texto del paso empieza solo con el nombre del jefe y ya sale en su
  línea «Jefe:», esa frase no se repite.
- **Las gemas fijas** de la zona (◆ «Gema de habilidad nv. 5: tras el
  verdugo») y **el jefe opcional** que te puedes saltar (○).
- **Lo fijo de la zona que la guía no cuenta** (○ «en Ngakanu hay siempre una
  fosa de Profundidades abisales»). Solo sale en la ventanita: está en
  `ZONE_NOTES` (`src/objectives.ts`), la guía de la web no se toca.
- **Luego:** la siguiente zona que aún tiene algo por hacer y, si la tiene,
  su recompensa para siempre. Las que ya pisaste y no dejan nada se saltan.
- Si una zona sale en dos pasos (El final del viaje, Isla Whakapanu) y el
  primero ya está hecho, al volver enseña el segundo.
- **Nivel de la zona y el tuyo** («zona nv 26 · Exiliada 20», con el nombre
  de tu personaje). En ámbar si vas 3 niveles por debajo; en rojo y con aviso
  si vas 6.
- **Una partida por personaje:** al cambiar de personaje, la ventanita sigue
  la suya (zonas, recompensas, jefes) y guarda la del anterior.
- **Lo que te dejas:** al pasar de acto avisa de las zonas con algo para
  siempre que no pisaste («Te dejaste en el acto 1: Villafrey (+30 de
  espíritu)»). Se va solo tras tres zonas.
- **Resistencias al cambiar de acto:** al entrar en el acto 2, 3 o 4, o en los
  interludios, avisa en ámbar de cuánto bajan («Acto 3: la penalización de
  resistencias es ya de −20 %. Mira tu hoja: apunta a un 30 % en fuego, hielo
  y rayo»). Las cifras son las de la guía del acto 1. Se va solo tras tres
  zonas, o al abrir las recompensas del acto. La ventanita no sabe cuánta
  resistencia tienes: solo te recuerda que mires.
- **Recompensas del acto** (Ctrl+Alt+R): ✓ la tienes · ○ no la tienes
  (estuviste y el juego nunca escribió que la recibieras, o ni pisaste la
  zona) · ? estuviste y no se puede saber · · más adelante. Debajo, **lo que
  te falta de los actos anteriores** (como mucho seis líneas y «y N más»). De
  un acto del que el registro no tiene ni una zona (lo jugaste en otro equipo o
  se borró Client.txt) no afirma nada: «De los actos 1, 2 y 3 no vi nada en el
  registro: no sé qué te falta de ahí».
- **Ruta rápida** (icono de la bandeja): se salta Lodazal, la cámara fundida y
  Punta del botín, y dice qué jefes sin premio puedes saltarte.
- Fuera de los actos 1-4 se queda en una línea que dice dónde estás:
  «Interludio: la guía llega hasta el acto 4», «En tu guarida», «En mapas» o
  «Fuera de la campaña».

## Teclas

| Tecla | Qué hace |
| --- | --- |
| Re Pág / Av Pág | Paso anterior / siguiente |
| Fin | Marcar al jefe del paso si no habla; si no, su recompensa; y si el paso no tiene recompensa, su jefe u objetivo |
| Ctrl+Alt+R | Ver o cerrar las recompensas del acto |

**Moverla:** arrastra el asa ⠿ de la izquierda de la cabecera. No se puede
sacar de la pantalla. Si otro programa ya usa una de las teclas, la ventanita
lo avisa.

**Minimizar:** el botón **–**, junto al engranaje, la deja en una línea con la
zona y el paso («Salones de los muertos · 9/15»), tan ancha como ese texto.
Con la zona hecha enseña adónde vas: «✓ La excavación → Ngakanu y El corazón
de la tribu». **▢** la despliega. Minimizada solo enseña lo que te dejaste al
cambiar de acto.

**Ajustes:** el engranaje ⚙ de la derecha de la cabecera abre los ajustes en
la propia ventanita: ruta completa o rápida, tamaño, fondo, compacta, solo con
PoE2 delante, recompensas del acto, volver a su sitio, elegir Client.txt,
empezar de cero (pide un segundo clic) y cerrarla. Solo el asa, el engranaje,
la casilla y los ajustes cogen el ratón; el resto deja pasar los clics al juego.
Las letras llevan una sombra fina: con el fondo «Claro» sobre nieve o arena la
caja se queda gris, y sin sombra no se leían.

**Solo con PoE2 delante:** al cambiar de ventana (Alt+Tab) se esconde y vuelve
con el juego. Se mira qué programa está delante preguntando a Windows, no al
juego. Se puede quitar en los ajustes («Solo con PoE2 delante»).

Las teclas solo son suyas mientras se ve con el juego delante. Al cambiar de
ventana las suelta: Re Pág, Av Pág y Fin funcionan normal en el navegador o en
otro juego aunque la ventanita siga abierta.

**Icono ámbar de la bandeja** (abajo a la derecha; Windows 11 lo guarda tras
la flecha ^): el mismo menú con clic izquierdo o derecho, y además «Ocultar».

## Qué hace y qué no

- Solo **lee** `Client.txt` (carpeta `logs` del juego, Steam o independiente).
  Mira seis cosas: el cambio de zona (`Generating level 48 area "G1_2"`,
  igual en cualquier idioma), la subida de nivel («Exiliada (Liche) es ahora
  nivel 51» o «is now level»), el mensaje de una recompensa recibida («ha
  recibido +10% a la resistencia al hielo» o «You have received…»), unas
  pocas frases que ciertos personajes del juego dicen solo al caer un jefe,
  la vuelta a la pantalla de entrada y quién se une o sale de tu zona. El
  resto (chat, cuenta) se descarta al leerlo.
- **Nombres:** guarda el nombre de tus personajes, para tener una partida de
  cada uno. De los demás jugadores no guarda el nombre: solo una huella que
  no se puede leer, para no confundir su nivel o sus recompensas con los tuyos.
- No lee la memoria del juego, no le inyecta nada y no le manda teclas ni
  clics. No pide cuenta ni contraseña. Nada sale del equipo.
- Guarda la partida en `%APPDATA%\exile-copilot-ventanita\estado.json`.

## Límites conocidos

- El registro no dice con qué personaje entras: lo nombra cuando sube de
  nivel o recibe una recompensa. Hasta entonces (los primeros minutos tras
  entrar) la ventanita enseña la partida del personaje anterior; en cuanto
  sale el nombre, lo andado pasa a la partida correcta.
- Con el juego en un idioma que no sea español o inglés no hay nombres: una
  sola partida, y volver a la orilla del río desde un acto posterior cuenta
  como personaje nuevo.
- «Pisaste la zona» no es «cogiste la recompensa»: por eso existe la casilla.
- **Jefes:** el registro no dice «jefe muerto». Solo se marcan los que dicen
  (ellos o alguien a su lado) una frase únicamente al caer, y solo con el
  juego en español. Los que no hablan (el devorador, el rey del óxido, el
  verdugo, Tor Gul, la reina de la inmundicia, el prisionero…) se marcan a
  mano. Si se te olvida marcar uno, la guía sigue igual: solo esa zona se
  queda sin su «Zona hecha».
- Los jefes que sueltan la recompensa para siempre del paso (Beira, Kabala,
  Quijada negra…) y los opcionales no tienen casilla: de los primeros avisa
  la recompensa al recibirla.
- Con dos libros de 2 puntos en el mismo acto, si usas los dos en el pueblo
  puede marcar primero el otro; al usar el segundo quedan bien los dos.
- Las islas del acto 4 se hacen en cualquier orden; el resumen las ordena
  como la guía.

## Código

`src/zones.ts` une cada paso de la guía con sus códigos de zona (sacados de
un Client.txt real). `src/progress.ts` elige el paso; `src/run.ts` lleva la
partida (zonas, recompensas, nivel, lo que te dejas); `src/characters.ts`
reparte los eventos entre tus personajes; `src/objectives.ts`
dice cómo se nota en el registro cada recompensa y cada jefe; `src/place.ts`
la mantiene dentro de la pantalla. `src/interludes.ts` guarda la ruta de los
tres interludios (19 zonas, con fuentes y sus códigos `P1_1`…`P3_7`): son solo
datos, la ventanita todavía no los enseña. Tests: `tests/unit/ventanita.test.ts`. Tipos:
`npx tsc -p overlay`.

La ventana se coloca siempre con `setBounds` (posición y tamaño juntos): con
la pantalla al 125 %, `setPosition` la hace crecer un píxel en cada llamada.
