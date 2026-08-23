# Evidencia de crafting en juego — 2026-08-22

Capturas y texto aportados por el usuario desde el cliente de Path of Exile 2
en español. Esta carpeta conserva observaciones del juego; no convierte por sí
sola una observación en una regla universal.

## Reglas observadas directamente

| Acción | Objetivo | Transición observada | Variante superior | Variante perfecta | Evidencia |
| --- | --- | --- | --- | --- | --- |
| Orbe de transmutación | objeto normal | pasa a mágico y obtiene 1 modificador | nivel mínimo del modificador 44 | nivel mínimo del modificador 70 | `01-transmutation-variants.jpg` |
| Orbe de aumento | objeto mágico | añade 1 modificador aleatorio; el tooltip declara un máximo de 2 modificadores aleatorios para objetos mágicos | nivel mínimo del modificador 44 | nivel mínimo del modificador 70 | `02-augmentation-variants.jpg` |
| Orbe regio | objeto mágico | pasa a raro, conserva los modificadores actuales y añade 1 | nivel mínimo del modificador 35 | no observada | `03-regal-variants.jpg` |
| Orbe exaltado | objeto raro | añade 1 modificador aleatorio; el tooltip declara un máximo de 6 modificadores aleatorios para objetos raros | nivel mínimo del modificador 35 | no observada | `04-exalted-variants.jpg` |

Cuando una variante no muestra un nivel mínimo, la evidencia solo permite decir
“no mostrado”; no demuestra que no exista ninguna restricción interna.

## Objeto avanzado observado

`Rama de alma`, Arco obliterador raro de nivel de objeto 81:

- 3 líneas de procedencia rúnica/implícita que no forman parte de los seis
  afijos aleatorios.
- 3 prefijos y 3 sufijos observados.
- Los grados aparecen explícitamente en el texto avanzado del juego.
- Un afijo puede ocupar varias líneas. En concreto, `del mercenario` combina
  daño físico y precisión; `de Amanamu` combina velocidad de ataque propia y
  de compañeros.
- Se observan procedencias especiales: `rune`, `de fabricación` y `profanado`.

Fuentes: `05-rare-bow-advanced.jpg` y `soul-branch-advanced.es.txt`.

`Núcleo de fénix`, Ballesta barnizada rara de nivel de objeto 32:

- 3 prefijos y 2 sufijos observados.
- El sufijo `de resplandor` contiene dos líneas (precisión y radio de
  iluminación), pero sigue siendo un solo afijo.
- Los requisitos aparecen en una sola línea localizada:
  `Nivel 24, 19 Fue, 19 Des`.
- Las propiedades base y las etiquetas de los modificadores también aparecen
  localizadas al español.

Fuente: `phoenix-core-crossbow-advanced.es.txt`.

## No demostrado todavía

- Que 3 prefijos y 3 sufijos sea el máximo universal para todos los objetos
  raros; solo se ha observado que esta distribución es válida.
- Probabilidades o pesos de aparición.
- Existencia o reglas de variantes no mostradas en las capturas.
- Interacción de estas monedas con corrupción, fractura, profanación u otros
  estados especiales.
- Que las reglas observadas sigan vigentes después de un cambio de parche.

## Consecuencia para el parser

El formato avanzado en español exige agrupar las líneas que siguen a cada
cabecera `{ Mod. ... }` como un solo modificador. Contar líneas produciría
afijos ficticios. También debe separar propiedades, engarces, runas, implícitos,
prefijos, sufijos, fabricación y profanación.
