# Crafting: investigación y orden de implementación

Fecha de corte: 2026-08-22

Este documento convierte la investigación del crafting de Path of Exile 2 en
decisiones implementables para Exile Copilot. No sustituye la base de
conocimiento versionada ni afirma probabilidades cuando no existe un pool de
modificadores completo y verificable.

## Conclusión principal

El siguiente bloque importante no debe ser otra capa de interfaz. Debe ser un
**evaluador de legalidad versionado** que responda, antes de proponer una
moneda:

1. si la acción puede aplicarse al objeto;
2. qué parte del resultado está garantizada;
3. qué parte es aleatoria;
4. qué información falta para calcular probabilidades;
5. si la acción existe en el parche y liga seleccionados;
6. cuándo debe detenerse el jugador y volver a pegar el resultado.

## Hechos oficiales que afectan al modelo

### Estado del objeto y de los modificadores

El contrato público de objetos de GGG contempla estados que deben formar parte
del dominio del simulador: `corrupted`, `doubleCorrupted`, `sanctified`,
`unmodifiable`, `unmodifiableExceptChaos`, `split`, `mutated` y `desecrated`.
También distingue modificadores `crafted`, `desecrated`, `fractured` y
`mutated`, además de `runeMods` y `bondedMods`.

Fuente: https://www.pathofexile.com/developer/docs/reference

### Reglas globales del parche 0.5

- Todos los modificadores fabricados están garantizados, pero un objeto solo
  puede tener un modificador fabricado a la vez.
- Los modificadores profanados ya no cuentan como fabricados, pero un objeto
  solo puede tener uno.
- Los Alloys añaden un modificador fabricado garantizado reemplazando un
  modificador existente, de forma parecida a las Perfect Essences.
- Los Fluxes transforman resistencias de un elemento a otro.
- Los Liquid Emotions fabrican modificadores en joyas reemplazando un
  modificador existente; sus variantes superiores permiten modificadores que
  no aparecen de otra forma.
- El Recombinator está deshabilitado en 0.5 y el Omen of Recombination fue
  eliminado.
- La Greater Transmutation y la Greater Augmentation exigen nivel mínimo de
  modificador 44.
- La sanctification multiplica cada valor de modificador usando su valor
  actual como base.

Fuente: https://www.pathofexile.com/forum/view-thread/3932540/filter-account-type/staff

### Esencias y monedas de previsión

Las esencias tienen cuatro niveles. Lesser, Normal y Greater convierten un
objeto mágico en raro y añaden su modificador garantizado. Perfect y las
esencias de corrupción eliminan un modificador aleatorio de un raro y añaden
el modificador garantizado. Hinekora's Lock permite prever el resultado de la
próxima moneda y cualquier modificación elimina esa previsión.

Fuente: https://www.pathofexile.com/forum/view-thread/3826682

### Cambios de disponibilidad

La disponibilidad es parte de la regla, no una nota decorativa. Por ejemplo,
los Omens of Homogenising Exaltation y Coronation dejaron de caer en 0.4, y
en 0.5 el Omen of Recombination fue eliminado. En 0.5.4 se añadieron cuatro
Orbs of Sacrifice que mejoran encantamientos corruptos a cambio de eliminar
aleatoriamente un modificador explícito.

Fuentes:

- https://www.pathofexile.com/forum/view-thread/3883495/filter-account-type/staff
- https://www.pathofexile.com/forum/view-thread/3975218

## Restricción de datos que condiciona la precisión

GGG no publica oficialmente para PoE2 un conjunto completo de pools, pesos y
tags de modificadores fuera de las APIs admitidas. Tampoco se deben descubrir
endpoints internos ni extraer los archivos del juego desde Exile Copilot.

Fuentes:

- https://www.pathofexile.com/developer/docs/data
- https://www.pathofexile.com/developer/docs/index

RePoE documenta una representación útil de grupos, `spawn_weights`,
`generation_weights`, niveles requeridos y restricciones por tags. Puede servir
como fuente externa versionada después de una decisión explícita de procedencia,
pero no debe presentarse como dato oficial de GGG ni extraerse en tiempo de
ejecución.

Fuentes:

- https://github.com/repoe-fork/poe2
- https://github.com/repoe-fork/repoe/blob/master/RePoE/schema/mods.json
- https://github.com/tskimmett/repoe/blob/master/RePoE/docs/mods.md

## Prioridades de implementación

### P0 — Legalidad y estado del objeto

Extender el parser y el dominio con:

- doble corrupción, sanctification, `unmodifiable` y
  `unmodifiableExceptChaos`;
- modificadores fabricados, profanados, fracturados y mutados;
- `runeMods` y `bondedMods` cuando la entrada los exponga;
- contador y restricción de un fabricado y un profanado;
- bloqueo de objetos corruptos o sanctified salvo que la acción declare de
  forma verificable que los admite;
- disponibilidad por parche y liga: `active`, `legacy-only`, `disabled`.

Resultado esperado: la app deja de recomendar acciones imposibles aunque aún
no conozca el pool exacto.

### P1 — Familias de crafting con resultado garantizado

Modelar como acciones declarativas:

- esencias por sus cuatro niveles;
- Alloys;
- Liquid/Potent/Ancient Emotions para joyas;
- Fluxes de resistencias;
- Orbs of Sacrifice;
- Hinekora's Lock y el estado de previsión.

Cada acción separará claramente:

- efecto garantizado;
- parte aleatoria;
- condición de entrada;
- consumo y reversibilidad;
- dato que debe volver a pegar el usuario antes del siguiente paso.

### P2 — Coste verificable

Añadir el Currency Exchange público de GGG como fuente de ratios históricos
por hora. La respuesta incluye pares de mercado, volumen, stock y ratios, pero
no ofrece la hora actual; la interfaz debe mostrar edad y procedencia.

Endpoint documentado:

`GET https://web.poecdn.com/api/currency-exchange/poe2[/timestamp]`

Fuente: https://www.pathofexile.com/developer/docs/reference

La fuente existente de poe.ninja puede mantenerse como complemento. Ninguna
de las dos convierte por sí sola un objeto raro en un precio fiable.

### P3 — Probabilidad exacta solo con pool completo

El motor matemático debe seguir rechazando el cálculo si falta cualquiera de
estos elementos:

- todos los modificadores elegibles;
- peso de aparición de cada modificador;
- tags y orden de evaluación;
- grupos mutuamente excluyentes;
- multiplicadores de generación;
- nivel de objeto, base, influencia/estado y parche aplicables.

No usar reparto equiprobable como sustituto. Si el pool está incompleto, la
salida correcta es `no_calculable` y debe explicar exactamente qué falta.

### P4 — Sistemas grandes del parche 0.5

Tratar después, como guías deterministas o semideterministas independientes:

- Runeforging y sus runic recipes;
- Genesis Tree;
- Remnant recipes;
- Runic Ward;
- Ancient/Mythical runes.

Son valiosos, pero ampliarían demasiado el alcance antes de cerrar el ciclo
básico de una pieza normal, mágica o rara.

## Flujo de producto recomendado

1. El jugador pega el texto avanzado del objeto.
2. Elige qué quiere conservar y qué resultado busca.
3. El sistema clasifica estado, afijos, huecos y bloqueos.
4. Solo muestra acciones legales en el parche seleccionado.
5. Para cada acción separa lo garantizado de lo aleatorio.
6. Calcula probabilidad únicamente si el pool es completo y trazable.
7. Muestra coste con fuente, liga y antigüedad.
8. Recomienda una sola acción y un punto de parada.
9. El jugador aplica esa acción y vuelve a pegar el objeto.
10. La app compara antes/después y decide continuar, proteger o abandonar.

## Criterios de aceptación inmediatos

- Un objeto corrupto no recibe una recomendación ordinaria que no lo admita.
- Un objeto con un fabricado no recibe otro sin una operación de reemplazo
  compatible.
- Una acción eliminada o solo legacy nunca aparece como activa.
- Toda acción muestra parche, fuente y fecha de verificación.
- Ningún resultado aleatorio se redacta como garantizado.
- Ninguna probabilidad aparece si el pool no es completo.
- Cada paso termina con `continuar`, `detener` o `pegar el resultado`, nunca con
  una cadena automática de monedas irreversibles.

## Decisión para el siguiente bloque grande

Implementar **P0 + el esqueleto común de P1**. Esto aporta más seguridad y
utilidad real que añadir ahora más monedas o una interfaz más vistosa, y deja
preparado el sistema para incorporar la base de conocimiento que se está
auditando en paralelo.
