# Academia de crafting — Nivel medio

## Objetivo

El nivel medio sucede dentro de Path of Exile 2. No enseña a manejar la web,
copiar tooltips ni confirmar resultados en el comparador.

- Básico: reconocer la rareza, los huecos y el efecto observado de cada moneda.
- **Medio: decidir qué pieza merece monedas, para qué objetivo y cuándo parar.**
- Avanzado: planear proyectos con riesgos, salidas y recuperación.

El recorrido convierte una secuencia mecánica de monedas en una decisión útil
para el personaje que el jugador está jugando.

## Siete situaciones dentro del juego

1. Elegir una base que encaje con el personaje.
2. Definir un solo problema principal que resolver.
3. Abandonar una salida mágica cuyo primer modificador no ayuda.
4. Completar con Aumento un mágico prometedor antes de subirlo.
5. Usar Regio cuando ya existe algo que merece conservarse.
6. Valorar Exaltado como una adición aleatoria, no como un acabado garantizado.
7. Equipar, probar y parar cuando la pieza ya cumple su función.

`resolveMediumAcademyDecision()` recalcula las respuestas desde el estado visible
de cada ejercicio. Los casos son sintéticos y no incluyen drops, pools, pesos,
probabilidades, precios ni recetas inventadas.

## Barrera de producto

Las instrucciones propias de Exile Copilot —copiar el objeto, reparar una
lectura, comparar el antes y el después— pertenecen a **Ayuda en vivo**. Una
prueba impide que ese lenguaje vuelva a introducirse en el contenido del nivel
medio.

## Archivos

- Dominio y situaciones: `shared/craftingMediumAcademy.ts`.
- Interfaz: `src/components/CraftingMediumAcademy.tsx`.
- Pruebas: `tests/unit/craftingMediumAcademy.test.ts`.
- Recorrido real: `scripts/academy-smoke.mjs`.

## Verificación esperada

- TypeScript y ESLint sin errores.
- Suite unitaria completa.
- Recorrido de Academia en producción y desarrollo/Strict Mode.
- Comprobación visual e interactiva en `localhost:7201`.
