# Academia de crafting — Nivel básico

> Sesión práctica dentro del área Crafting. No es documentación: es un bucle de
> ver objeto → decidir → recibir corrección → entender → continuar.

## Dónde vive

`Crafting` abre con dos recorridos (`CraftingModeChooser`):

- **Aprender crafting** → la Academia (`src/components/CraftingAcademy.tsx`).
- **Trabajar con mi objeto** → el banco existente, sin ningún cambio.

No hay una cuarta pestaña global. El banco **nunca se desmonta**: al entrar en
la Academia queda oculto con `hidden`, así que la pieza elegida, la sesión
abierta, las protecciones y los crafts pausados siguen intactos al volver con
«Practicar con mi objeto».

La Academia funciona **sin personaje**: se puede aprender antes de importar nada.

## Recorrido

| Bloque | Escenario | Respuesta correcta | Concepto |
| --- | --- | --- | --- |
| Lección 1 · Leer un objeto | `l1-rareza` | Raro | `rareza` |
| | `l1-afijos` | 2 prefijos | `afijos` |
| | `l1-huecos` | Caben hasta 3 más | `huecos` |
| Lección 2 · De normal a mágico | `l2-transmutacion` | Transmutación | `transmutacion` |
| Lección 3 · Completar un mágico | `l3-aumento` | Aumento | `aumento` |
| | `l3-limite` | No: el mágico admite 2 | `limite-magico` |
| Lección 4 · Pasar a raro | `l4-regio` | Regio | `regio` |
| | `l4-todavia-no` | Parar | `parar-datos` |
| Lección 5 · Añadir a un raro | `l5-exaltado` | Exaltado | `exaltado` |
| | `l5-parar` | Parar | `parar-limite` |
| Prueba final (6) | `examen-1..6` | Transmutación, Aumento, Regio, Exaltado, Parar ×2 | los mismos |

En las preguntas de lectura la tarjeta **oculta los contadores derivados**
(rareza, totales, huecos) hasta que respondes: el ejercicio es contarlos, no
que la tarjeta los cuente por ti.

## Procedencia de lo que se afirma

Todo el contenido factual procede de
`server/data/crafting/observedCurrencyActions.2026-08-22.json` y de sus capturas
en `docs/evidence/crafting/2026-08-22/`, a través de los mismos módulos que usa
el banco real:

- `OBSERVED_CRAFTING_ACTIONS` y `evaluateObservedCraftingActions` — qué acción
  es compatible con un objeto y por qué.
- `diagnoseCraftingItem` — rareza, prefijos, sufijos, límite total y huecos.

**La Academia no tiene una verdad propia.** `resolveAcademyAnswer()` recalcula la
respuesta correcta desde esos motores y la suite exige que coincida con el
`expectedOptionId` declarado en el contenido. Si el motor cambia y el texto no,
las pruebas fallan.

Hechos utilizados, tal y como los declara el snapshot observado:

- Transmutación: de normal a mágico, otorga 1 modificador.
- Aumento: añade 1 modificador aleatorio a un mágico; máximo declarado 2.
- Regio: de mágico a raro, conserva los modificadores actuales y añade 1.
- Exaltado: añade 1 modificador aleatorio a un raro; máximo declarado 6.

No se afirma nada más: ni pools, ni pesos, ni probabilidades, ni precios, ni
grados posibles, ni valor de objeto. Dos pruebas lo vigilan sobre el texto
(cifras prohibidas; y «probabilidad», «peso», «pool», «precio» y «garantiza»
solo pueden aparecer negados).

## Objetos de los ejercicios

Sintéticos y marcados como **«Ejercicio de aprendizaje»** en la tarjeta y en
`item.sources`. Sus estados estructurales son inventados a propósito para
plantear una situación; no representan drops reales ni resultados posibles.

## Progreso

`localStorage`, clave propia y versionada `exile-copilot:academia-crafting:v1`,
validada con Zod al restaurar. Se descarta y se empieza limpio ante JSON
ilegible, forma inválida, versión de contenido distinta o escenarios
desconocidos. Reiniciar exige confirmación explícita. No toca el personaje, el
expediente, el diario ni las sesiones de crafting.

## Límites conocidos

- Este documento cubre solo el nivel básico. El selector también ofrece el
  nivel medio documentado en `CRAFTING_ACADEMY_MEDIUM.md` y el avanzado en
  `CRAFTING_ACADEMY_ADVANCED.md`.
- La prueba mide comprensión de estas lecciones. El resultado dice
  explícitamente que **no** es una probabilidad de crafting ni una valoración.
- «Parar» se enseña con dos causas distintas —límite alcanzado y falta de
  datos— porque son las dos que el motor puede demostrar. Otras razones para
  parar (coste, objetivo cumplido) pertenecen al banco, no a este nivel.
- El repaso de conceptos pendientes reutiliza los escenarios de la prueba; no
  genera variantes nuevas.
