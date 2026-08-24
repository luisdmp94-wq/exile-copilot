# Academia de crafting — Nivel medio

## Objetivo

El nivel medio une los dos extremos de la Academia:

- Básico: reconocer el estado de la pieza y una acción compatible.
- **Medio: comparar el resultado con el snapshot y decidir qué hacer después.**
- Avanzado: definir objetivo, líneas intocables, parada y ruta.

No enseña recetas ni valora si un afijo es bueno. Entrena el bucle que el
jugador repite después de gastar una moneda: **antes → después → decisión**.

## Seis comparaciones

1. Resultado incompleto → volver a copiarlo.
2. Identidad distinta → rechazar la comparación.
3. Estructura inesperada → revisar el paso aplicado.
4. Línea protegida perdida → frenar y registrar la pérdida.
5. Condición de salida cumplida → conservar y parar.
6. Resultado válido pero salida pendiente → volver al contrato.

`resolveMediumAcademyDecision()` aplica ese orden conservador. Los escenarios
son sintéticos y su respuesta se recalcula desde hechos estructurados; no hay
pools, pesos, probabilidades, precios ni resultados supuestos.

## Archivos

- Dominio y casos: `shared/craftingMediumAcademy.ts`.
- Interfaz: `src/components/CraftingMediumAcademy.tsx`.
- Pruebas: `tests/unit/craftingMediumAcademy.test.ts`.
- Recorrido real: `scripts/academy-smoke.mjs`.

## Verificación

- TypeScript sin errores.
- ESLint limpio en los archivos modificados.
- Suite completa: 557/557.
- Academia: 120/120 en producción y desarrollo/Strict Mode.
- Sin desbordamiento horizontal a 375 y 390 px.

