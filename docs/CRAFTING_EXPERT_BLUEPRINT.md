# Plano experto de Crafting

Fecha de corte: 2026-08-24

## Problema que resuelve

El laboratorio avanzado ya permitía elegir objetivo, líneas intocables,
condiciones de parada y una herramienta. Sin embargo, su comparador repetía
principalmente tres datos: «legal», «aleatorio» y «precio sin verificar». Eso
no ayudaba a decidir el orden de las acciones ni dejaba visible el contrato
completo del craft.

## Contrato visible

`buildExpertCraftingBlueprint()` reúne, sin añadir conocimiento de juego:

1. el resultado que busca el jugador;
2. las líneas del snapshot que no quiere sacrificar;
3. la condición observable que termina el craft;
4. las rutas legales o pendientes de tooltip;
5. la primera acción conservadora cuando existe un orden estructural
   demostrable.

El plano pasa por seis estados: faltan datos del objeto, falta objetivo, falta
parada, objetivo ya cumplido, faltan datos de ruta y listo.

## Orden conservador

El plano no elige el “mejor craft”. Solo propone una primera acción en dos
casos demostrables:

- hay una única moneda básica legal;
- Aumento y Regio son legales a la vez: Aumento va primero porque mantiene la
  rareza mágica y Regio sigue disponible después. Usar Regio primero cierra
  Aumento.

Esta relación es un orden de opciones, no una afirmación de valor, DPS,
probabilidad o rentabilidad.

## Rutas de reemplazo

Essence y Alloy nunca aparecen como recetas confirmadas por su nombre. En una
pieza rara llena se muestran como reemplazos que exigen tooltip. El plano
declara que no puede prometer la conservación de las líneas intocables y lleva
al preflight existente, donde se introduce el efecto real.

## Límites

- No hay pool exhaustivo y redistribuible de modificadores: no se muestran
  probabilidades ni intentos esperados.
- No existe valoración completa de build: las etiquetas observadas no son
  DPS ni defensa efectiva.
- No existe precio total de una estrategia con reinicio verificado.
- El plano no ejecuta ninguna acción en el juego.

## Evidencia de aceptación

- 6 pruebas unitarias nuevas cubren orden Aumento → Regio, conservación del
  contrato, parada ya cumplida, reemplazos y objeto bloqueado.
- La suite completa queda en **547/547**.
- `coach-smoke --all` queda en **84/84** e incluye el estado inicial del plano,
  su condición de salida y el freno cuando ya se cumplió.
- Revisión manual en `localhost:7201`: objetivo de niveles, línea `+2` marcada
  como intocable, salida `+3` grado 2 o mejor y entrada correcta al preflight
  de Essence.
- Vista de 390×844 sin desbordamiento horizontal.
