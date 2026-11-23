# Ventanita guía (prototipo)

Una ventana pequeña encima de Path of Exile 2, al estilo de las guías de
leveo de WoW (Polestar): sigue la zona donde estás y te dice el paso de la
guía (actos 1 a 4, las guías de `src/guides`).

- **Arrancar:** doble clic en `ventanita.cmd`. La primera vez repasa tu
  Client.txt entero (unos segundos); después, solo lo nuevo.
- **PoE2** tiene que estar en *pantalla completa sin bordes* (o en ventana).

## Qué enseña

- El paso de la zona donde estás y el siguiente («Luego»).
- **La recompensa para siempre** del paso (+10 % de hielo, +30 de espíritu…)
  con una casilla: pulsa **Fin** al cogerla.
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

Para moverla: icono de la bandeja → «Mover la ventanita», arrástrala y luego
«Fijar la ventanita aquí». Si otro programa ya usa una de las teclas, la
ventanita lo avisa.

Mientras la ventanita está abierta, esas teclas son suyas también en otros
programas (por ejemplo, Re Pág en el navegador).

**Icono ámbar de la bandeja** (abajo a la derecha): ruta completa o rápida,
recompensas, mover, aspecto (tamaño, compacta, fondo), ocultar, empezar de
cero (personaje nuevo), elegir Client.txt y salir.

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
partida (zonas, recompensas, nivel, lo que te dejas). Tests:
`tests/unit/ventanita.test.ts`. Tipos: `npx tsc -p overlay`.
