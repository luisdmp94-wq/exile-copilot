# Laboratorio avanzado de Crafting

## Qué resuelve este primer corte

El tercer recorrido de la pestaña Crafting está pensado para una pieza real y un jugador que ya conoce las monedas básicas. Convierte el banco técnico existente en cinco decisiones visibles:

1. **Pieza**: prioriza una pieza cuya estructura avanzada pueda leerse completa.
2. **Objetivo**: categoría observable y descripción libre del resultado buscado.
3. **Intocables**: modificadores actuales que no se acepta perder.
4. **Parada**: hasta tres condiciones comprobables, incluidas varias líneas exactas con `grado X o mejor`.
5. **Ruta**: acciones legales desde el estado actual y herramientas de reemplazo que requieren copiar su tooltip real.

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
