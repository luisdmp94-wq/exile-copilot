# Ventanita guía (prototipo)

Una ventana pequeña encima de Path of Exile 2, al estilo de las guías de
leveo de WoW (Polestar): sigue la zona donde estás y te dice el paso de la
guía (actos 1 a 4, las guías de `src/guides`).

- **Arrancar:** doble clic en `ventanita.cmd`. La primera vez repasa tu
  Client.txt entero (unos segundos); después, solo lo nuevo. Si ya estaba
  abierta, abrirla otra vez la reinicia con la última versión.
- **PoE2** tiene que estar en *pantalla completa sin bordes* (o en ventana).

## Qué enseña

- La zona donde estás, en grande, y el texto entero de su paso en la guía.
- **La recompensa para siempre** del paso («Para siempre: +10 % de hielo»)
  con una casilla: pulsa **Fin** al cogerla, o haz clic en la casilla.
- **Las gemas fijas** de la zona (◆ «Gema de habilidad nv. 5: tras el
  verdugo») y **el jefe opcional** que te puedes saltar (○).
- **Luego:** la zona siguiente y, si la tiene, su recompensa para siempre.
- **Nivel de la zona y el tuyo** («zona nv 26 · tú 20»). En ámbar si vas 3
  niveles por debajo; en rojo y con aviso si vas 6.
- **Lo que te dejas:** al pasar de acto avisa de las zonas con algo para
  siempre que no pisaste («Te dejaste en el acto 1: Villafrey (+30 de
  espíritu)»). Se va solo tras tres zonas.
- **Recompensas del acto** (Ctrl+Alt+R): ✓ cogida · ? estuviste en la zona ·
  ○ te la dejaste · · más adelante.
- **Ruta rápida** (icono de la bandeja): se salta Lodazal, la cámara fundida y
  Punta del botín, y dice qué jefes sin premio puedes saltarte.
- Fuera de los actos 1-4 (guarida, mapas, interludios) se queda en una línea.

## Teclas

| Tecla | Qué hace |
| --- | --- |
| Re Pág / Av Pág | Paso anterior / siguiente |
| Fin | Marcar la recompensa del paso como cogida |
| Ctrl+Alt+R | Ver o cerrar las recompensas del acto |

**Moverla:** arrastra el asa ⠿ de la izquierda de la cabecera. No se puede
sacar de la pantalla. Si otro programa ya usa una de las teclas, la ventanita
lo avisa.

**Ajustes:** el engranaje ⚙ de la derecha de la cabecera abre los ajustes en
la propia ventanita: ruta completa o rápida, tamaño, fondo, compacta, solo con
PoE2 delante, recompensas del acto, volver a su sitio, elegir Client.txt,
empezar de cero (pide un segundo clic) y cerrarla. Solo el asa, el engranaje,
la casilla y los ajustes cogen el ratón; el resto deja pasar los clics al juego.

**Solo con PoE2 delante:** al cambiar de ventana (Alt+Tab) se esconde y vuelve
con el juego. Se mira qué programa está delante preguntando a Windows, no al
juego. Se puede quitar en los ajustes («Solo con PoE2 delante»).

Mientras la ventanita está abierta, esas teclas son suyas también en otros
programas (por ejemplo, Re Pág en el navegador).

**Icono ámbar de la bandeja** (abajo a la derecha; Windows 11 lo guarda tras
la flecha ^): el mismo menú con clic izquierdo o derecho, y además «Ocultar».

## Qué hace y qué no

- Solo **lee** `Client.txt` (carpeta `logs` del juego, Steam o independiente):
  la línea de cambio de zona (`Generating level 48 area "G1_2"`, igual en
  cualquier idioma) y la de subida de nivel («(Liche) es ahora nivel 51» o
  «is now level»). El resto (chat, cuenta, nombres) se ignora.
- No lee la memoria del juego, no le inyecta nada y no le manda teclas ni
  clics. No pide cuenta ni contraseña. Nada sale del equipo.
- Guarda la partida en `%APPDATA%\exile-copilot-ventanita\estado.json`.

## Límites conocidos

- El registro no dice con qué personaje juegas. Si alternas personajes, las
  zonas pisadas se mezclan y el nivel es el de la última subida. Volver a la
  orilla del río desde un acto posterior cuenta como personaje nuevo.
- «Pisaste la zona» no es «cogiste la recompensa»: por eso existe la casilla.
- Las islas del acto 4 se hacen en cualquier orden; el resumen las ordena
  como la guía.

## Código

`src/zones.ts` une cada paso de la guía con sus códigos de zona (sacados de
un Client.txt real). `src/progress.ts` elige el paso; `src/run.ts` lleva la
partida (zonas, recompensas, nivel, lo que te dejas); `src/place.ts` la
mantiene dentro de la pantalla. Tests: `tests/unit/ventanita.test.ts`. Tipos:
`npx tsc -p overlay`.

La ventana se coloca siempre con `setBounds` (posición y tamaño juntos): con
la pantalla al 125 %, `setPosition` la hace crecer un píxel en cada llamada.
