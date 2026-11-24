# Laboratorio avanzado de Crafting

## Qué resuelve este primer corte

El tercer recorrido de la pestaña Crafting está pensado para una pieza real y un jugador que ya conoce las monedas básicas.

Desde el 24-11-2026 es **una sola vista**, no cinco pasos. Luis lo probó y no se entendía qué había que hacer: preguntaba cuatro cosas antes de decir nada y hablaba en jerga («contrato», «intocables», «pool»). Ahora:

1. **Una pregunta**: «¿Qué quieres mejorar?». Ninguna opción llega marcada.
2. **La respuesta, en la misma pantalla**: la siguiente moneda, «Dentro de PoE2: usa un … sobre «pieza»», el aviso si cambia la rareza y un único botón («Empezar») tras marcar que aún no se ha usado.
3. **Lo que se puede ajustar, plegado debajo**:
   - **No quiero perder…**: modificadores actuales que no se acepta perder.
   - **Paro cuando…**: hasta tres condiciones comprobables, incluidas líneas exactas con `grado X o mejor`. Viene puesta la recomendada (un afijo más de lo que buscas) para que la respuesta salga con un clic.
   - **Comparar con otra pieza parecida**: las demás piezas pegadas de la misma clase.

Reglas de esa vista:

- La pieza se explica con la misma frase que en Ayuda en vivo («Es mágico: tiene 1 prefijo y 1 sufijo…»), no con contadores.
- Con la pieza mal copiada no se pregunta nada: el aviso de arriba dice cómo arreglarlo.
- Si el último intento aconsejó parar, la tarjeta lo dice («Si decides seguir») en vez de presentar el paso como si nada.
- Si lo único que queda está en revisión para el parche (Essence y Alloy), dice que por ahora no hay nada que hacerle, sin enseñar opciones apagadas.
- Pegar la primera pieza desde el Taller deja al jugador en el Taller.

La prueba de navegador (`scripts/coach-smoke.mjs`) comprueba la vista única y que su texto no vuelva a la jerga de auditoría.

El laboratorio reutiliza el mismo expediente, sesiones persistentes, comparación antes/después y registro de resultados del banco. No mantiene una segunda verdad paralela.

## Escala de grado

En los textos avanzados observados, un número de grado menor representa un nivel superior. El contrato guarda el peor grado aceptable (`maximumTier`):

- `1` significa solo grado 1;
- `3` significa grado 1, 2 o 3;
- sin grado significa que cualquier grado satisface la condición de texto.

Si la línea aparece pero el tooltip pegado no aporta grado, el resultado es **desconocido**, nunca éxito.

## Frenos deliberados

- Si la pieza ya cumple todas las condiciones de parada, no se puede preparar otra ruta para perseguir el mismo final.
- Un pool parcial o ausente no produce probabilidades, intentos esperados ni costes totales.
- El comparador muestra legalidad y efecto observado; no llama “mejor” a una ruta.
- Essence y Alloy no se evalúan por su nombre: exigen el efecto real del tooltip.
- El laboratorio no ejecuta acciones dentro del juego. El jugador aplica una moneda y vuelve a pegar el resultado.

## Fuera de este corte

- Pool exhaustivo y versionado de mods para ballestas.
- Pesos de aparición y bloqueo de grupos verificados.
- Coste de mercado normalizado por ruta completa.
- Simulación Monte Carlo o cálculo probabilístico con datos incompletos.
- Optimización de DPS o valoración de una pieza para una build concreta.

Estas ausencias se muestran en la interfaz y no se sustituyen por estimaciones inventadas.
