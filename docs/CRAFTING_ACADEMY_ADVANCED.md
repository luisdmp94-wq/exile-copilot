# Academia de crafting — Nivel avanzado

> Seis decisiones cortas para aprender a diseñar un craft antes de gastar.

## Qué enseña

El nivel avanzado no añade recetas ni una segunda verdad al producto. Entrena
la jerarquía que ya usa el plano experto del laboratorio:

1. completar la lectura de la pieza;
2. definir el resultado buscado;
3. declarar una condición de salida comprobable;
4. proteger las líneas que no se quieren sacrificar;
5. conservar opciones cuando dos acciones son legales;
6. pedir el tooltip antes de aceptar un reemplazo;
7. parar cuando el contrato ya se cumple;
8. comparar riesgos sin fingir que existe un ganador.

## Arquitectura

- `shared/craftingAdvancedAcademy.ts` contiene los seis casos y
  `resolveAdvancedAcademyDecision()`, una función pura con la misma precedencia
  conservadora que `buildExpertCraftingBlueprint()`.
- `src/components/CraftingAdvancedAcademy.tsx` presenta un contrato de tres
  celdas —resultado, no sacrificar, parar cuando—, las rutas relevantes y una
  única decisión.
- `src/components/CraftingAcademy.tsx` ofrece el selector Básico / Medio /
  Avanzado. Medio permanece desactivado; cambiar de nivel no toca personaje,
  objeto ni sesiones.

## Límites honestos

- Todos los casos son sintéticos y están marcados como entrenamiento.
- No se enseñan pools, pesos, probabilidades, precios, DPS ni recetas óptimas.
- Essence y Alloy solo se tratan como rutas de reemplazo cuando el caso declara
  si el tooltip está verificado; el nombre nunca basta.
- La puntuación mide las seis decisiones del recorrido, no la calidad de un
  objeto real.

## Verificación

- Las pruebas unitarias exigen que cada respuesta declarada coincida con el
  resolutor y cubren precedencia, salida cumplida y reemplazo sin tooltip.
- `scripts/academy-smoke.mjs --all` recorre Básico y Avanzado en producción y
  desarrollo/Strict Mode, además de los breakpoints de 375 y 390 px.
