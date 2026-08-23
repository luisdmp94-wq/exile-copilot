# Entrenador de objeto real

> Estado: implementado en la rama `crafting-real-item-coach` desde el baseline
> `8526910`.

## Problema que resuelve

El banco completo mostraba simultáneamente diagnóstico, intención,
protecciones, parada, evidencias y tres familias de herramientas. Toda esa
información sigue disponible, pero ya no gobierna la primera experiencia.

El modo guiado presenta únicamente la decisión que corresponde ahora:

1. qué quiere mejorar el jugador;
2. con qué señal observable dejará de gastar;
3. qué acción estructuralmente compatible puede preparar.

El preflight de una moneda básica se completa dentro del mismo entrenador. No
es necesario desplegar el banco detallado para iniciar el ciclo y volver con el
resultado.

## Límites deliberados

- No puntúa la pieza ni afirma que sea buena.
- No calcula DPS, precios, pools, pesos o probabilidades.
- No ordena dos rutas legales como mejor o peor sin evidencia.
- Essence y Alloy siguen exigiendo sus tooltips y consentimientos específicos.
- El banco detallado permanece accesible para cambiar matices, proteger líneas
  y usar las herramientas avanzadas existentes.

## Evidencia de cierre

- Lint limitado a todos los archivos TypeScript modificados: cero errores.
- TypeScript: cero errores.
- Vitest: 50 archivos, 486/486 pruebas.
- Build de producción correcto.
- Equipo/Crafting: 220/220 comprobaciones en producción y desarrollo/Strict
  Mode.
- Vista inicial del objeto real del smoke: 119 palabras, 886 px de alto en un
  viewport de 390×844 y sin desbordamiento horizontal.
