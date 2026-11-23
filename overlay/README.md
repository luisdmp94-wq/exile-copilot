# Ventanita guía (prototipo)

Una ventana pequeña encima de Path of Exile 2 que enseña el paso de la guía
de la zona donde estás (actos 1 a 4, las guías de `src/guides`).

- **Arrancar:** doble clic en `ventanita.cmd`.
- **PoE2** tiene que estar en *pantalla completa sin bordes* (o en ventana).
- **Re Pág / Av Pág:** paso anterior / siguiente.
- **Ctrl+Alt+M:** mover la ventanita (arrastrar) y fijarla otra vez.
- **Icono ámbar de la bandeja (abajo a la derecha):** ocultar, volver al
  acto 1, elegir Client.txt y salir.

## Qué hace y qué no

- Solo **lee** `Client.txt` (carpeta `logs` del juego, Steam o independiente).
  Mira la línea `Generating level N area "G1_2"`: el código de zona es igual
  en cualquier idioma. El resto del registro (chat, cuenta) se ignora.
- No lee la memoria del juego, no le inyecta nada y no le manda teclas ni
  clics. No pide cuenta ni contraseña. Nada sale del equipo.
- Recuerda el paso en `%APPDATA%\exile-copilot-ventanita\estado.json`.

## Cómo se elige el paso

`src/zones.ts` une cada paso de la guía con sus códigos de zona (sacados de
un Client.txt real). Al entrar en una zona se enseña su paso; el pueblo no
mueve la guía; una zona de otro acto cambia de acto. Fuera de los actos 1-4
(interludios, mapas) avisa y deja el último paso.

Tests: `tests/unit/ventanita.test.ts`. Comprobar tipos: `npx tsc -p overlay`.
